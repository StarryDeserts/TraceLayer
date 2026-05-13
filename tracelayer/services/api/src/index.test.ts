import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canAnchorArtifact } from '@tracelayer/proof';
import { createInMemoryTraceLayerDb, getArtifact, initializeSchema, listProofEvents, updateArtifactUpload, updateArtifactVerification } from '@tracelayer/db';
import { createDemoRun, handleApiRequest, type AnchorOperations, type WalrusOperations } from './index.js';

function createFakeWalrus(readText = '# TraceLayer Phase 1 Demo\n'): WalrusOperations & { uploadCalls: number; readCalls: number } {
  return {
    uploadCalls: 0,
    readCalls: 0,
    async uploadArtifact(input) {
      this.uploadCalls += 1;
      return {
        blobId: '0x1234567890abcdef1234567890abcdef',
        blobObjectId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        sha256: input.expectedSha256,
        byteLength: input.bytes.byteLength,
        rawWalrusResponse: { kind: 'writeBlob', hasBlobObject: true },
      };
    },
    async readArtifact() {
      this.readCalls += 1;
      return new TextEncoder().encode(readText);
    },
  };
}

function createFakeAnchor(): AnchorOperations & { prepareCalls: number; waitCalls: number; serverCalls: number } {
  return {
    prepareCalls: 0,
    waitCalls: 0,
    serverCalls: 0,
    async prepareAnchorArtifact(input) {
      this.prepareCalls += 1;
      return {
        anchorMode: 'wallet-signed',
        packageId: input.packageId,
        target: `${input.packageId}::artifact_anchor::anchor_artifact`,
        transactionJson: JSON.stringify({ kind: 'ProgrammableTransaction', sender: input.signerAddress }),
        rawSuiResponse: { prepared: true, signerAddress: input.signerAddress },
      };
    },
    async waitForAnchorTransaction(input) {
      this.waitCalls += 1;
      return {
        txDigest: input.txDigest,
        anchorObjectId: `0x${'2'.repeat(64)}`,
        onChainOwnerAddress: `0x${'3'.repeat(64)}`,
        rawSuiResponse: { confirmed: true },
      };
    },
    async executeServerSignedAnchor() {
      this.serverCalls += 1;
      return {
        anchorMode: 'server-signed-fallback',
        txDigest: '4f4XSYqgMZMKVvVm8xWKDLV9ZyTqZ6XVBhQCbPrf5D4Z',
        anchorObjectId: `0x${'4'.repeat(64)}`,
        signerAddress: `0x${'5'.repeat(64)}`,
        onChainOwnerAddress: `0x${'5'.repeat(64)}`,
        serviceSigned: true,
        rawSuiResponse: { serviceSigned: true },
      };
    },
  };
}

const liveAnchorEnv = {
  TRACE_LAYER_DEMO_MODE: 'live',
  WALRUS_LIVE_UPLOAD: 'true',
  TRACE_LAYER_API_TOKEN: 'secret-token',
  SUI_PRIVATE_KEY: 'suiprivkey1examplebutnotusedinunittests',
  SUI_RPC_URL: 'https://sui.example.invalid',
  WALRUS_RELAY_URL: 'https://relay.example.invalid',
  SUI_ANCHOR_LIVE: 'true',
  SUI_ANCHOR_PACKAGE_ID: `0x${'1'.repeat(64)}`,
};

const validLiveModelArtifact = {
  title: 'Supply-chain risk summary',
  summary: 'Summarizes observable dependency risk from the user-provided task.',
  taskUnderstanding: 'Review package metadata and produce a concise markdown report.',
  artifactType: 'markdown_report',
  artifactMarkdown: '# Supply-chain risk summary\n\nNo private chain-of-thought is included.',
  memoryRefs: [
    {
      label: 'User task',
      summary: 'The user asked for a dependency risk summary.',
      sourceType: 'user_input',
    },
  ],
  replayNotes: ['Used only observable task input and generated output.'],
  riskNotes: ['Requires human review before operational use.'],
  chainOfThoughtIncluded: false,
};

function liveModelRunRequest(artifactJsonText = JSON.stringify(validLiveModelArtifact, null, 2), headers: HeadersInit = { authorization: 'Bearer secret-token', 'content-type': 'application/json' }): Request {
  return new Request('http://localhost/api/live-demo/model-artifact-run', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      artifactJsonText,
      taskInputPreview: 'Review dependency risk from the supplied package notes.',
      modelName: 'openai-compatible-demo-model',
      endpointMode: 'responses',
      providerOrigin: 'https://provider.example.invalid',
      ownerAddress: `0x${'8'.repeat(64)}`,
    }),
  });
}

function markVerifiedArtifact(db: ReturnType<typeof createInMemoryTraceLayerDb>, artifactId: string): void {
  updateArtifactUpload(db, artifactId, {
    state: 'uploaded',
    uploadStatus: 'uploaded',
    blobId: '0x1234567890abcdef1234567890abcdef',
    walrusNetwork: 'testnet',
    uploadedAtMs: 1,
  });
  updateArtifactVerification(db, artifactId, {
    state: 'verified',
    verificationStatus: 'verified',
    verifiedAtMs: 2,
  });
}

describe('api', () => {
  it('reports live demo capabilities without secrets', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);

    const response = await handleApiRequest(new Request('http://localhost/api/live-demo/capabilities'), { db, env: liveAnchorEnv });
    const body = (await response.json()) as {
      demoMode: string;
      walrusLiveUpload: boolean;
      suiAnchorLive: boolean;
      suiNetwork: string;
      suiAnchorPackageConfigured: boolean;
      suiAnchorPackageId?: string;
      apiToken?: string;
      suiPrivateKey?: string;
    };

    expect(response.status).toBe(200);
    expect(body.demoMode).toBe('live');
    expect(body.walrusLiveUpload).toBe(true);
    expect(body.suiAnchorLive).toBe(true);
    expect(body.suiNetwork).toBe('testnet');
    expect(body.suiAnchorPackageConfigured).toBe(true);
    expect(body.suiAnchorPackageId).toBe(liveAnchorEnv.SUI_ANCHOR_PACKAGE_ID);
    expect(body.apiToken).toBeUndefined();
    expect(body.suiPrivateKey).toBeUndefined();
    db.close();
  });

  it('accepts live model artifact registration with Authorization Bearer auth only', async () => {
    const authorizedDb = createInMemoryTraceLayerDb();
    initializeSchema(authorizedDb);
    const authorized = await handleApiRequest(liveModelRunRequest(), { db: authorizedDb, env: liveAnchorEnv });
    const authorizedText = await authorized.text();

    expect(authorized.status).toBe(201);
    expect(authorizedText).not.toContain('secret-token');
    authorizedDb.close();

    const rejectedDb = createInMemoryTraceLayerDb();
    initializeSchema(rejectedDb);
    const rejected = await handleApiRequest(liveModelRunRequest(undefined, { 'x-api-token': 'secret-token', 'content-type': 'application/json' }), { db: rejectedDb, env: liveAnchorEnv });
    const rejectedText = await rejected.text();

    expect(rejected.status).toBe(401);
    expect(rejectedText).toContain('unauthorized');
    expect(rejectedText).not.toContain('secret-token');
    rejectedDb.close();
  });

  it('registers live model artifact with exact-byte hash and safe proof events', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const artifactJsonText = JSON.stringify(validLiveModelArtifact, null, 2);
    const expectedSha256 = createHash('sha256').update(new TextEncoder().encode(artifactJsonText)).digest('hex');

    const response = await handleApiRequest(liveModelRunRequest(artifactJsonText), { db, env: liveAnchorEnv });
    const body = (await response.json()) as { run: { runId: string }; artifact: { artifactId: string; sha256: string; textPreview?: string; blobId?: string }; proofEvents: { type: string; walrusBlobId?: string; suiTxDigest?: string; metadata: Record<string, unknown> }[] };
    const replay = await handleApiRequest(new Request(`http://localhost/api/replay/${body.run.runId}`, { method: 'POST' }), { db });

    expect(response.status).toBe(201);
    expect(body.artifact.artifactId).toMatch(/^artifact_/);
    expect(body.artifact.sha256).toBe(expectedSha256);
    expect(body.artifact.textPreview).toBe(artifactJsonText);
    expect(body.artifact.blobId).toBeUndefined();
    expect(body.proofEvents.map((event) => event.type)).toEqual(['run_registered', 'artifact_generated']);
    expect(body.proofEvents.every((event) => event.walrusBlobId === undefined && event.suiTxDigest === undefined)).toBe(true);
    expect(JSON.stringify(body)).not.toContain('secret-token');
    expect(replay.status).toBe(200);
    db.close();
  });

  it('uploads exact bytes from a registered live model artifact', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const artifactJsonText = JSON.stringify(validLiveModelArtifact, null, 2);
    const expectedSha256 = createHash('sha256').update(new TextEncoder().encode(artifactJsonText)).digest('hex');
    let uploadedText = '';
    const walrus: WalrusOperations = {
      async uploadArtifact(input) {
        uploadedText = new TextDecoder().decode(input.bytes);
        return {
          blobId: '0x1234567890abcdef1234567890abcdef',
          blobObjectId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          sha256: input.expectedSha256,
          byteLength: input.bytes.byteLength,
          rawWalrusResponse: { kind: 'writeBlob', hasBlobObject: true },
        };
      },
      async readArtifact() {
        return new TextEncoder().encode(artifactJsonText);
      },
    };
    const state = { db, walrus, env: liveAnchorEnv };

    const register = await handleApiRequest(liveModelRunRequest(artifactJsonText), state);
    const registered = (await register.json()) as { artifact: { artifactId: string } };
    const upload = await handleApiRequest(new Request(`http://localhost/api/artifacts/${registered.artifact.artifactId}/upload`, { method: 'POST', headers: { authorization: 'Bearer secret-token' } }), state);
    const verify = await handleApiRequest(new Request(`http://localhost/api/artifacts/${registered.artifact.artifactId}/verify`, { method: 'POST', headers: { authorization: 'Bearer secret-token' } }), state);
    const verified = (await verify.json()) as { verificationStatus: string; expectedSha256: string; actualSha256: string };

    expect(upload.status).toBe(200);
    expect(uploadedText).toBe(artifactJsonText);
    expect(verified.verificationStatus).toBe('verified');
    expect(verified.expectedSha256).toBe(expectedSha256);
    expect(verified.actualSha256).toBe(expectedSha256);
    db.close();
  });

  it('rejects live model artifacts that include provider keys or proof IDs', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);

    const withKey = await handleApiRequest(liveModelRunRequest(JSON.stringify({ ...validLiveModelArtifact, provider: { apiKey: 'sk-test-value' } })), { db, env: liveAnchorEnv });
    const withBlobId = await handleApiRequest(liveModelRunRequest(JSON.stringify({ ...validLiveModelArtifact, blobId: 'hD_YDFkdI8yTI0ZnRa_BEiEArOU8HY3SokY4T9Qg5sk' })), { db, env: liveAnchorEnv });

    expect(withKey.status).toBe(400);
    expect(withBlobId.status).toBe(400);
    db.close();
  });

  it('demo run creates run, artifact, and proof records', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);

    const response = await handleApiRequest(new Request('http://localhost/api/runs/demo', { method: 'POST' }), { db });
    const body = (await response.json()) as ReturnType<typeof createDemoRun>;

    expect(response.status).toBe(201);
    expect(body.run.runId).toBeTruthy();
    expect(body.artifact.blobId).toBeUndefined();
    expect(body.proofEvents).toHaveLength(3);
    expect(body.proofEvents.some((event) => event.type === 'run_registered')).toBe(true);
    expect(body.proofEvents.every((event) => event.walrusBlobId === undefined && event.suiTxDigest === undefined)).toBe(true);

    const runsResponse = await handleApiRequest(new Request('http://localhost/api/runs'), { db });
    const runsBody = (await runsResponse.json()) as { runs: unknown[] };
    expect(runsBody.runs).toHaveLength(1);

    const proofsResponse = await handleApiRequest(new Request('http://localhost/api/proofs'), { db });
    const proofsBody = (await proofsResponse.json()) as { proofEvents: unknown[] };
    expect(proofsBody.proofEvents).toHaveLength(3);
    db.close();
  });

  it('assembles replay context for demo run', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const { run } = createDemoRun(db);

    const response = await handleApiRequest(new Request(`http://localhost/api/replay/${run.runId}`, { method: 'POST' }), { db });
    const body = (await response.json()) as { replayContext: { chainOfThoughtIncluded: false; artifactRefs: unknown[] } };

    expect(body.replayContext.chainOfThoughtIncluded).toBe(false);
    expect(body.replayContext.artifactRefs).toHaveLength(1);
    db.close();
  });

  it('dry-run upload does not call Walrus or create fake blob IDs', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const fakeWalrus = createFakeWalrus();
    const { artifact } = createDemoRun(db);

    const response = await handleApiRequest(new Request(`http://localhost/api/artifacts/${artifact.artifactId}/upload`, { method: 'POST' }), { db, walrus: fakeWalrus });
    const stored = getArtifact(db, artifact.artifactId);

    expect(response.status).toBe(409);
    expect(fakeWalrus.uploadCalls).toBe(0);
    expect(stored?.blobId).toBeUndefined();
    db.close();
  });

  it('live upload fails closed without API token configuration', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const fakeWalrus = createFakeWalrus();
    const { artifact } = createDemoRun(db);

    const response = await handleApiRequest(new Request(`http://localhost/api/artifacts/${artifact.artifactId}/upload`, { method: 'POST' }), {
      db,
      walrus: fakeWalrus,
      env: {
        TRACE_LAYER_DEMO_MODE: 'live',
        WALRUS_LIVE_UPLOAD: 'true',
        SUI_PRIVATE_KEY: 'suiprivkey1examplebutnotusedinunittests',
        SUI_RPC_URL: 'https://sui.example.invalid',
        WALRUS_RELAY_URL: 'https://relay.example.invalid',
      },
    });

    expect(response.status).toBe(500);
    expect(fakeWalrus.uploadCalls).toBe(0);
    db.close();
  });

  it('live upload records artifact_uploaded proof event', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const fakeWalrus = createFakeWalrus();
    const { artifact } = createDemoRun(db);

    const response = await handleApiRequest(
      new Request(`http://localhost/api/artifacts/${artifact.artifactId}/upload`, { method: 'POST', headers: { authorization: 'Bearer secret-token' } }),
      {
        db,
        walrus: fakeWalrus,
        env: {
          TRACE_LAYER_DEMO_MODE: 'live',
          WALRUS_LIVE_UPLOAD: 'true',
          TRACE_LAYER_API_TOKEN: 'secret-token',
          SUI_PRIVATE_KEY: 'suiprivkey1examplebutnotusedinunittests',
          SUI_RPC_URL: 'https://sui.example.invalid',
          WALRUS_RELAY_URL: 'https://relay.example.invalid',
        },
      },
    );
    const body = (await response.json()) as { artifact: { blobId: string; uploadStatus: string } };

    expect(response.status).toBe(200);
    expect(body.artifact.blobId).toBe('0x1234567890abcdef1234567890abcdef');
    expect(body.artifact.uploadStatus).toBe('uploaded');
    expect(fakeWalrus.uploadCalls).toBe(1);
    expect(listProofEvents(db, { artifactId: artifact.artifactId }).some((event) => event.type === 'artifact_uploaded')).toBe(true);
    db.close();
  });

  it('live upload requires API token when configured', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const fakeWalrus = createFakeWalrus();
    const { artifact } = createDemoRun(db);
    const state = {
      db,
      walrus: fakeWalrus,
      env: {
        TRACE_LAYER_DEMO_MODE: 'live',
        WALRUS_LIVE_UPLOAD: 'true',
        TRACE_LAYER_API_TOKEN: 'secret-token',
        SUI_PRIVATE_KEY: 'suiprivkey1examplebutnotusedinunittests',
        SUI_RPC_URL: 'https://sui.example.invalid',
        WALRUS_RELAY_URL: 'https://relay.example.invalid',
      },
    };

    const unauthorized = await handleApiRequest(new Request(`http://localhost/api/artifacts/${artifact.artifactId}/upload`, { method: 'POST' }), state);
    const unauthorizedBody = (await unauthorized.json()) as { error: string };
    const authorized = await handleApiRequest(
      new Request(`http://localhost/api/artifacts/${artifact.artifactId}/upload`, { method: 'POST', headers: { authorization: 'Bearer secret-token' } }),
      state,
    );

    expect(unauthorized.status).toBe(401);
    expect(unauthorizedBody).toEqual({ error: 'unauthorized' });
    expect(authorized.status).toBe(200);
    expect(fakeWalrus.uploadCalls).toBe(1);
    db.close();
  });

  it('recorded upload requires matching recorded artifact hash', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const { artifact } = createDemoRun(db);

    const mismatch = await handleApiRequest(new Request(`http://localhost/api/artifacts/${artifact.artifactId}/upload`, { method: 'POST' }), {
      db,
      env: {
        TRACE_LAYER_DEMO_MODE: 'recorded',
        TRACE_LAYER_RECORDED_BLOB_ID: '0x1234567890abcdef1234567890abcdef',
        TRACE_LAYER_RECORDED_TX_DIGEST: '4f4XSYqgMZMKVvVm8xWKDLV9ZyTqZ6XVBhQCbPrf5D4Z',
        TRACE_LAYER_RECORDED_ARTIFACT_SHA256: 'a'.repeat(64),
      },
    });
    const matched = await handleApiRequest(new Request(`http://localhost/api/artifacts/${artifact.artifactId}/upload`, { method: 'POST' }), {
      db,
      env: {
        TRACE_LAYER_DEMO_MODE: 'recorded',
        TRACE_LAYER_RECORDED_BLOB_ID: '0x1234567890abcdef1234567890abcdef',
        TRACE_LAYER_RECORDED_TX_DIGEST: '4f4XSYqgMZMKVvVm8xWKDLV9ZyTqZ6XVBhQCbPrf5D4Z',
        TRACE_LAYER_RECORDED_ARTIFACT_SHA256: artifact.sha256,
        SUI_NETWORK: 'testnet',
      },
    });
    const stored = getArtifact(db, artifact.artifactId);
    const proofEvents = listProofEvents(db, { artifactId: artifact.artifactId });

    expect(mismatch.status).toBe(500);
    expect(matched.status).toBe(200);
    expect(stored?.walrusNetwork).toBe('testnet');
    expect(proofEvents.some((event) => event.recorded === true && event.walrusBlobId === '0x1234567890abcdef1234567890abcdef')).toBe(true);
    db.close();
  });

  it('duplicate upload returns existing result unless forced', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const fakeWalrus = createFakeWalrus();
    const { artifact } = createDemoRun(db);
    const state = {
      db,
      walrus: fakeWalrus,
      env: {
        TRACE_LAYER_DEMO_MODE: 'live',
        WALRUS_LIVE_UPLOAD: 'true',
        TRACE_LAYER_API_TOKEN: 'secret-token',
        SUI_PRIVATE_KEY: 'suiprivkey1examplebutnotusedinunittests',
        SUI_RPC_URL: 'https://sui.example.invalid',
        WALRUS_RELAY_URL: 'https://relay.example.invalid',
      },
    };

    await handleApiRequest(new Request(`http://localhost/api/artifacts/${artifact.artifactId}/upload`, { method: 'POST', headers: { authorization: 'Bearer secret-token' } }), state);
    await handleApiRequest(new Request(`http://localhost/api/artifacts/${artifact.artifactId}/upload`, { method: 'POST', headers: { authorization: 'Bearer secret-token' } }), state);

    expect(fakeWalrus.uploadCalls).toBe(1);
    db.close();
  });

  it('verify without blobId fails', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const { artifact } = createDemoRun(db);

    const response = await handleApiRequest(new Request(`http://localhost/api/artifacts/${artifact.artifactId}/verify`, { method: 'POST' }), { db, walrus: createFakeWalrus() });

    expect(response.status).toBe(409);
    db.close();
  });

  it('verify success records artifact_verified proof event', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const { artifact } = createDemoRun(db);
    const state = {
      db,
      walrus: createFakeWalrus(artifact.textPreview),
      env: {
        TRACE_LAYER_DEMO_MODE: 'live',
        WALRUS_LIVE_UPLOAD: 'true',
        TRACE_LAYER_API_TOKEN: 'secret-token',
        SUI_PRIVATE_KEY: 'suiprivkey1examplebutnotusedinunittests',
        SUI_RPC_URL: 'https://sui.example.invalid',
        WALRUS_RELAY_URL: 'https://relay.example.invalid',
      },
    };

    await handleApiRequest(new Request(`http://localhost/api/artifacts/${artifact.artifactId}/upload`, { method: 'POST', headers: { authorization: 'Bearer secret-token' } }), state);
    const response = await handleApiRequest(new Request(`http://localhost/api/artifacts/${artifact.artifactId}/verify`, { method: 'POST', headers: { authorization: 'Bearer secret-token' } }), state);
    const body = (await response.json()) as { verificationStatus: string };

    expect(response.status).toBe(200);
    expect(body.verificationStatus).toBe('verified');
    expect(listProofEvents(db, { artifactId: artifact.artifactId }).some((event) => event.type === 'artifact_verified')).toBe(true);
    db.close();
  });

  it('read failure records read_failed verification state', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const { artifact } = createDemoRun(db);
    const failingWalrus: WalrusOperations = {
      async uploadArtifact(input) {
        return {
          blobId: '0x1234567890abcdef1234567890abcdef',
          sha256: input.expectedSha256,
          byteLength: input.bytes.byteLength,
          rawWalrusResponse: { kind: 'writeBlob' },
        };
      },
      async readArtifact() {
        throw new Error('read unavailable');
      },
    };
    const state = {
      db,
      walrus: failingWalrus,
      env: {
        TRACE_LAYER_DEMO_MODE: 'live',
        WALRUS_LIVE_UPLOAD: 'true',
        TRACE_LAYER_API_TOKEN: 'secret-token',
        SUI_PRIVATE_KEY: 'suiprivkey1examplebutnotusedinunittests',
        SUI_RPC_URL: 'https://sui.example.invalid',
        WALRUS_RELAY_URL: 'https://relay.example.invalid',
      },
    };

    await handleApiRequest(new Request(`http://localhost/api/artifacts/${artifact.artifactId}/upload`, { method: 'POST', headers: { authorization: 'Bearer secret-token' } }), state);
    const response = await handleApiRequest(new Request(`http://localhost/api/artifacts/${artifact.artifactId}/verify`, { method: 'POST', headers: { authorization: 'Bearer secret-token' } }), state);
    const stored = getArtifact(db, artifact.artifactId);

    expect(response.status).toBe(502);
    expect(stored?.verificationStatus).toBe('read_failed');
    expect(listProofEvents(db, { artifactId: artifact.artifactId }).some((event) => event.type === 'artifact_verified' && event.status === 'failed')).toBe(true);
    db.close();
  });

  it('hash mismatch sets mismatch and blocks anchor', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const { artifact } = createDemoRun(db);
    const state = {
      db,
      walrus: createFakeWalrus('different bytes'),
      env: {
        TRACE_LAYER_DEMO_MODE: 'live',
        WALRUS_LIVE_UPLOAD: 'true',
        TRACE_LAYER_API_TOKEN: 'secret-token',
        SUI_PRIVATE_KEY: 'suiprivkey1examplebutnotusedinunittests',
        SUI_RPC_URL: 'https://sui.example.invalid',
        WALRUS_RELAY_URL: 'https://relay.example.invalid',
      },
    };

    await handleApiRequest(new Request(`http://localhost/api/artifacts/${artifact.artifactId}/upload`, { method: 'POST', headers: { authorization: 'Bearer secret-token' } }), state);
    const response = await handleApiRequest(new Request(`http://localhost/api/artifacts/${artifact.artifactId}/verify`, { method: 'POST', headers: { authorization: 'Bearer secret-token' } }), state);
    const stored = getArtifact(db, artifact.artifactId);

    expect(response.status).toBe(409);
    expect(stored?.verificationStatus).toBe('mismatch');
    expect(stored ? canAnchorArtifact(stored) : true).toBe(false);
    db.close();
  });

  it('read endpoint returns safe preview only after verification', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const { artifact } = createDemoRun(db);
    const state = {
      db,
      walrus: createFakeWalrus(artifact.textPreview),
      env: {
        TRACE_LAYER_DEMO_MODE: 'live',
        WALRUS_LIVE_UPLOAD: 'true',
        TRACE_LAYER_API_TOKEN: 'secret-token',
        SUI_PRIVATE_KEY: 'suiprivkey1examplebutnotusedinunittests',
        SUI_RPC_URL: 'https://sui.example.invalid',
        WALRUS_RELAY_URL: 'https://relay.example.invalid',
      },
    };

    const before = await handleApiRequest(new Request(`http://localhost/api/artifacts/${artifact.artifactId}/read`), state);
    await handleApiRequest(new Request(`http://localhost/api/artifacts/${artifact.artifactId}/upload`, { method: 'POST', headers: { authorization: 'Bearer secret-token' } }), state);
    await handleApiRequest(new Request(`http://localhost/api/artifacts/${artifact.artifactId}/verify`, { method: 'POST', headers: { authorization: 'Bearer secret-token' } }), state);
    const after = await handleApiRequest(new Request(`http://localhost/api/artifacts/${artifact.artifactId}/read`, { headers: { authorization: 'Bearer secret-token' } }), state);
    const body = (await after.json()) as { text: string };

    expect(before.status).toBe(409);
    expect(after.status).toBe(200);
    expect(body.text).toContain('TraceLayer Phase 1 Demo');
    db.close();
  });

  it('cannot anchor unless verified', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const { artifact } = createDemoRun(db);
    const fakeAnchor = createFakeAnchor();

    const response = await handleApiRequest(
      new Request(`http://localhost/api/artifacts/${artifact.artifactId}/anchor`, {
        method: 'POST',
        headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
        body: JSON.stringify({ anchorMode: 'wallet-signed', signerAddress: `0x${'7'.repeat(64)}` }),
      }),
      { db, anchor: fakeAnchor, env: liveAnchorEnv },
    );

    expect(response.status).toBe(409);
    expect(fakeAnchor.prepareCalls).toBe(0);
    db.close();
  });

  it('cannot anchor without blobId', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const { artifact } = createDemoRun(db);
    const fakeAnchor = createFakeAnchor();
    updateArtifactVerification(db, artifact.artifactId, { state: 'verified', verificationStatus: 'verified', verifiedAtMs: 1 });

    const response = await handleApiRequest(
      new Request(`http://localhost/api/artifacts/${artifact.artifactId}/anchor`, {
        method: 'POST',
        headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
        body: JSON.stringify({ anchorMode: 'wallet-signed', signerAddress: `0x${'7'.repeat(64)}` }),
      }),
      { db, anchor: fakeAnchor, env: liveAnchorEnv },
    );

    expect(response.status).toBe(409);
    expect(fakeAnchor.prepareCalls).toBe(0);
    db.close();
  });

  it('mismatch blocks anchor endpoint', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const { artifact } = createDemoRun(db);
    const fakeAnchor = createFakeAnchor();
    updateArtifactUpload(db, artifact.artifactId, {
      state: 'uploaded',
      uploadStatus: 'uploaded',
      blobId: '0x1234567890abcdef1234567890abcdef',
      walrusNetwork: 'testnet',
    });
    updateArtifactVerification(db, artifact.artifactId, { state: 'mismatch', verificationStatus: 'mismatch', verifiedAtMs: 1 });

    const response = await handleApiRequest(
      new Request(`http://localhost/api/artifacts/${artifact.artifactId}/anchor`, {
        method: 'POST',
        headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
        body: JSON.stringify({ anchorMode: 'wallet-signed', signerAddress: `0x${'7'.repeat(64)}` }),
      }),
      { db, anchor: fakeAnchor, env: liveAnchorEnv },
    );

    expect(response.status).toBe(409);
    expect(fakeAnchor.prepareCalls).toBe(0);
    db.close();
  });

  it('wallet-signed prepare without signerAddress returns missing transaction sender', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const { artifact } = createDemoRun(db);
    const fakeAnchor = createFakeAnchor();
    markVerifiedArtifact(db, artifact.artifactId);

    const response = await handleApiRequest(
      new Request(`http://localhost/api/artifacts/${artifact.artifactId}/anchor`, {
        method: 'POST',
        headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
        body: JSON.stringify({ anchorMode: 'wallet-signed', correlationId: 'corr-anchor', claimedOwnerAddress: `0x${'6'.repeat(64)}` }),
      }),
      { db, anchor: fakeAnchor, env: liveAnchorEnv },
    );
    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(400);
    expect(body.error).toEqual({ code: 'missing_transaction_sender', message: 'Wallet-signed anchor prepare requires signerAddress.' });
    expect(fakeAnchor.prepareCalls).toBe(0);
    db.close();
  });

  it('wallet-signed prepare records submitted anchor state, sender, and correlation ID', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const { artifact } = createDemoRun(db);
    const fakeAnchor = createFakeAnchor();
    const signerAddress = `0x${'7'.repeat(64)}`;
    markVerifiedArtifact(db, artifact.artifactId);

    const response = await handleApiRequest(
      new Request(`http://localhost/api/artifacts/${artifact.artifactId}/anchor`, {
        method: 'POST',
        headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
        body: JSON.stringify({ anchorMode: 'wallet-signed', correlationId: 'corr-anchor', signerAddress, claimedOwnerAddress: `0x${'6'.repeat(64)}` }),
      }),
      { db, anchor: fakeAnchor, env: liveAnchorEnv },
    );
    const body = (await response.json()) as { preparedAnchor: { transactionJson: string } };
    const transaction = JSON.parse(body.preparedAnchor.transactionJson) as { sender?: string };
    const stored = getArtifact(db, artifact.artifactId);
    const proofEvents = listProofEvents(db, { artifactId: artifact.artifactId });

    expect(response.status).toBe(200);
    expect(fakeAnchor.prepareCalls).toBe(1);
    expect(transaction.sender).toBe(signerAddress);
    expect(stored?.state).toBe('anchor_submitted');
    expect(stored?.anchorMode).toBe('wallet-signed');
    expect(stored?.signerAddress).toBe(signerAddress);
    expect(proofEvents.some((event) => event.type === 'artifact_anchor_submitted' && event.correlationId === 'corr-anchor' && event.signerAddress === signerAddress)).toBe(true);
    db.close();
  });

  it('wallet-signed record requires signerAddress', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const { artifact } = createDemoRun(db);
    const fakeAnchor = createFakeAnchor();
    markVerifiedArtifact(db, artifact.artifactId);
    const state = { db, anchor: fakeAnchor, env: liveAnchorEnv };

    await handleApiRequest(
      new Request(`http://localhost/api/artifacts/${artifact.artifactId}/anchor`, {
        method: 'POST',
        headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
        body: JSON.stringify({ anchorMode: 'wallet-signed', signerAddress: `0x${'7'.repeat(64)}` }),
      }),
      state,
    );
    const response = await handleApiRequest(
      new Request(`http://localhost/api/artifacts/${artifact.artifactId}/anchor`, {
        method: 'POST',
        headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
        body: JSON.stringify({ anchorMode: 'wallet-signed', anchorTxDigest: '4f4XSYqgMZMKVvVm8xWKDLV9ZyTqZ6XVBhQCbPrf5D4Z' }),
      }),
      state,
    );

    expect(response.status).toBe(400);
    expect(fakeAnchor.waitCalls).toBe(0);
    db.close();
  });

  it('wallet-signed record writes anchor metadata and proof event', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const { artifact } = createDemoRun(db);
    const fakeAnchor = createFakeAnchor();
    markVerifiedArtifact(db, artifact.artifactId);
    const state = { db, anchor: fakeAnchor, env: liveAnchorEnv };

    await handleApiRequest(
      new Request(`http://localhost/api/artifacts/${artifact.artifactId}/anchor`, {
        method: 'POST',
        headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
        body: JSON.stringify({ anchorMode: 'wallet-signed', correlationId: 'corr-anchor', signerAddress: `0x${'7'.repeat(64)}` }),
      }),
      state,
    );
    const response = await handleApiRequest(
      new Request(`http://localhost/api/artifacts/${artifact.artifactId}/anchor`, {
        method: 'POST',
        headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
        body: JSON.stringify({
          anchorMode: 'wallet-signed',
          correlationId: 'corr-anchor',
          anchorTxDigest: '4f4XSYqgMZMKVvVm8xWKDLV9ZyTqZ6XVBhQCbPrf5D4Z',
          signerAddress: `0x${'7'.repeat(64)}`,
        }),
      }),
      state,
    );
    const stored = getArtifact(db, artifact.artifactId);
    const proofEvents = listProofEvents(db, { artifactId: artifact.artifactId });

    expect(response.status).toBe(200);
    expect(fakeAnchor.waitCalls).toBe(1);
    expect(stored?.state).toBe('anchored');
    expect(stored?.anchorMode).toBe('wallet-signed');
    expect(stored?.serviceSigned).toBe(false);
    expect(proofEvents.some((event) => event.type === 'artifact_anchored' && event.anchorMode === 'wallet-signed' && event.onChainOwnerAddress === `0x${'3'.repeat(64)}`)).toBe(true);
    expect(stored?.anchorTxDigest).toBe('4f4XSYqgMZMKVvVm8xWKDLV9ZyTqZ6XVBhQCbPrf5D4Z');
    expect(stored?.signerAddress).toBe(`0x${'7'.repeat(64)}`);
    expect(stored?.onChainOwnerAddress).toBe(`0x${'3'.repeat(64)}`);
    expect(proofEvents.some((event) => event.type === 'artifact_anchored' && event.correlationId === 'corr-anchor')).toBe(true);
    db.close();
  });

  it('rejects duplicate anchor tx digests', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const first = createDemoRun(db).artifact;
    const second = createDemoRun(db).artifact;
    const fakeAnchor = createFakeAnchor();
    const state = { db, anchor: fakeAnchor, env: liveAnchorEnv };
    markVerifiedArtifact(db, first.artifactId);
    markVerifiedArtifact(db, second.artifactId);

    for (const artifact of [first, second]) {
      await handleApiRequest(
        new Request(`http://localhost/api/artifacts/${artifact.artifactId}/anchor`, {
          method: 'POST',
          headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
          body: JSON.stringify({ anchorMode: 'wallet-signed', signerAddress: `0x${'7'.repeat(64)}` }),
        }),
        state,
      );
    }
    await handleApiRequest(
      new Request(`http://localhost/api/artifacts/${first.artifactId}/anchor`, {
        method: 'POST',
        headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
        body: JSON.stringify({ anchorMode: 'wallet-signed', anchorTxDigest: '4f4XSYqgMZMKVvVm8xWKDLV9ZyTqZ6XVBhQCbPrf5D4Z', signerAddress: `0x${'7'.repeat(64)}` }),
      }),
      state,
    );
    const duplicate = await handleApiRequest(
      new Request(`http://localhost/api/artifacts/${second.artifactId}/anchor`, {
        method: 'POST',
        headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
        body: JSON.stringify({ anchorMode: 'wallet-signed', anchorTxDigest: '4f4XSYqgMZMKVvVm8xWKDLV9ZyTqZ6XVBhQCbPrf5D4Z', signerAddress: `0x${'8'.repeat(64)}` }),
      }),
      state,
    );

    expect(duplicate.status).toBe(409);
    db.close();
  });

  it('seeds recorded Walrus fixture as verified dev artifact', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);

    const response = await handleApiRequest(
      new Request('http://localhost/api/dev/recorded-walrus-artifact', {
        method: 'POST',
        headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
        body: JSON.stringify({
          runId: 'run_phase_2_5_test',
          network: 'testnet',
          blobId: 'hD_YDFkdI8yTI0ZnRa_BEiEArOU8HY3SokY4T9Qg5sk',
          blobObjectId: '0x852f689742895aedb92353fb40f8c4aef4846ec3f71c041d070d9615d2ba8efd',
          sha256: 'b372b678a239bbec78d2221533ae27d361fad3a4a4c232196b54f991e6177e0e',
          byteLength: 61,
          contentType: 'text/plain; charset=utf-8',
          artifactTextPreview: 'TraceLayer Phase 2 live Walrus smoke: non-sensitive artifact.',
        }),
      }),
      { db, env: liveAnchorEnv },
    );
    const body = (await response.json()) as { artifact: { verificationStatus: string; blobId: string } };

    expect(response.status).toBe(201);
    expect(body.artifact.verificationStatus).toBe('verified');
    expect(body.artifact.blobId).toBe('hD_YDFkdI8yTI0ZnRa_BEiEArOU8HY3SokY4T9Qg5sk');
    expect(listProofEvents(db, { artifactId: 'artifact_run_phase_2_5_test' })).toHaveLength(2);
    db.close();
  });

  it('dry-run anchor does not emit fake Sui public IDs', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const { artifact } = createDemoRun(db);
    markVerifiedArtifact(db, artifact.artifactId);

    const response = await handleApiRequest(
      new Request(`http://localhost/api/artifacts/${artifact.artifactId}/anchor`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ anchorMode: 'wallet-signed', signerAddress: `0x${'7'.repeat(64)}` }),
      }),
      { db, anchor: createFakeAnchor() },
    );
    const proofEvents = listProofEvents(db, { artifactId: artifact.artifactId });

    expect(response.status).toBe(409);
    expect(proofEvents.every((event) => event.suiTxDigest === undefined && event.suiObjectId === undefined)).toBe(true);
    db.close();
  });

  it('server-signed fallback records service ownership fields', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const { artifact } = createDemoRun(db);
    const fakeAnchor = createFakeAnchor();
    markVerifiedArtifact(db, artifact.artifactId);

    const response = await handleApiRequest(
      new Request(`http://localhost/api/artifacts/${artifact.artifactId}/anchor`, {
        method: 'POST',
        headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
        body: JSON.stringify({ anchorMode: 'server-signed-fallback', claimedOwnerAddress: `0x${'9'.repeat(64)}` }),
      }),
      { db, anchor: fakeAnchor, env: { ...liveAnchorEnv, SUI_ANCHOR_SERVER_FALLBACK: 'true' } },
    );
    const stored = getArtifact(db, artifact.artifactId);
    const proofEvents = listProofEvents(db, { artifactId: artifact.artifactId });

    expect(response.status).toBe(200);
    expect(fakeAnchor.serverCalls).toBe(1);
    expect(stored?.anchorMode).toBe('server-signed-fallback');
    expect(stored?.serviceSigned).toBe(true);
    expect(stored?.signerAddress).toBe(`0x${'5'.repeat(64)}`);
    expect(stored?.onChainOwnerAddress).toBe(`0x${'5'.repeat(64)}`);
    expect(stored?.claimedOwnerAddress).toBe(`0x${'9'.repeat(64)}`);
    expect(stored?.onChainOwnerAddress).not.toBe(stored?.claimedOwnerAddress);
    expect(proofEvents.some((event) => event.type === 'artifact_anchored' && event.anchorMode === 'server-signed-fallback' && event.signerAddress === event.onChainOwnerAddress)).toBe(true);
    db.close();
  });
});
