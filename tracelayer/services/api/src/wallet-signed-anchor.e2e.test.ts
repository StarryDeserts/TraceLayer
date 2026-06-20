import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createInMemoryTraceLayerDb, getArtifact, initializeSchema, listProofEvents } from '@tracelayer/db';
import {
  handleApiRequest,
  type AnchorOperations,
  type ApiState,
  type WalrusOperations,
} from './index.js';
import { createInMemoryArtifactByteStore } from './artifact-bytes.js';

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

const walletSignerAddress = `0x${'7'.repeat(64)}`;
const recordedAnchorObjectId = `0x${'2'.repeat(64)}`;
const recordedOnChainOwnerAddress = `0x${'3'.repeat(64)}`;
const recordedTxDigest = '4f4XSYqgMZMKVvVm8xWKDLV9ZyTqZ6XVBhQCbPrf5D4Z';
const recordedBlobId = '0x1234567890abcdef1234567890abcdef';

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

function liveModelRunRequest(artifactJsonText: string): Request {
  return new Request('http://localhost/api/live-demo/model-artifact-run', {
    method: 'POST',
    headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
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

function uploadRequest(artifactId: string): Request {
  return new Request(`http://localhost/api/artifacts/${artifactId}/upload`, {
    method: 'POST',
    headers: { authorization: 'Bearer secret-token' },
  });
}

function verifyRequest(artifactId: string): Request {
  return new Request(`http://localhost/api/artifacts/${artifactId}/verify`, {
    method: 'POST',
    headers: { authorization: 'Bearer secret-token' },
  });
}

function prepareAnchorRequest(artifactId: string, correlationId: string): Request {
  return new Request(`http://localhost/api/artifacts/${artifactId}/anchor`, {
    method: 'POST',
    headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
    body: JSON.stringify({
      anchorMode: 'wallet-signed',
      correlationId,
      signerAddress: walletSignerAddress,
      claimedOwnerAddress: walletSignerAddress,
    }),
  });
}

function recordAnchorRequest(artifactId: string, correlationId: string): Request {
  return new Request(`http://localhost/api/artifacts/${artifactId}/anchor`, {
    method: 'POST',
    headers: { authorization: 'Bearer secret-token', 'content-type': 'application/json' },
    body: JSON.stringify({
      anchorMode: 'wallet-signed',
      correlationId,
      signerAddress: walletSignerAddress,
      claimedOwnerAddress: walletSignerAddress,
      anchorTxDigest: recordedTxDigest,
      anchorObjectId: recordedAnchorObjectId,
    }),
  });
}

function createE2EWalrus(roundTripText: string): WalrusOperations & { uploadCalls: number; readCalls: number } {
  return {
    uploadCalls: 0,
    readCalls: 0,
    async uploadArtifact(input) {
      this.uploadCalls += 1;
      return {
        blobId: recordedBlobId,
        blobObjectId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        sha256: input.expectedSha256,
        byteLength: input.bytes.byteLength,
        rawWalrusResponse: { kind: 'writeBlob', hasBlobObject: true },
      };
    },
    async readArtifact() {
      this.readCalls += 1;
      return new TextEncoder().encode(roundTripText);
    },
  };
}

function createE2EAnchor(): AnchorOperations & { prepareCalls: number; waitCalls: number } {
  return {
    prepareCalls: 0,
    waitCalls: 0,
    async prepareAnchorArtifact(input) {
      this.prepareCalls += 1;
      return {
        anchorMode: 'wallet-signed',
        packageId: input.packageId,
        target: `${input.packageId}::artifact_anchor::anchor_artifact`,
        transactionJson: JSON.stringify({ kind: 'ProgrammableTransaction', sender: input.signerAddress, blobId: input.blobId }),
        rawSuiResponse: { prepared: true },
      };
    },
    async waitForAnchorTransaction(input) {
      this.waitCalls += 1;
      return {
        txDigest: input.txDigest,
        anchorObjectId: recordedAnchorObjectId,
        onChainOwnerAddress: recordedOnChainOwnerAddress,
        rawSuiResponse: { confirmed: true },
      };
    },
  };
}

describe('wallet-signed anchor E2E', () => {
  it('threads register → upload → verify → prepare → record into a single anchored proof chain', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const artifactJsonText = JSON.stringify(validLiveModelArtifact, null, 2);
    const expectedSha256 = createHash('sha256').update(new TextEncoder().encode(artifactJsonText)).digest('hex');
    const walrus = createE2EWalrus(artifactJsonText);
    const anchor = createE2EAnchor();
    const state: ApiState = {
      db,
      walrus,
      anchor,
      artifactBytes: createInMemoryArtifactByteStore(),
      env: liveAnchorEnv,
    };
    const correlationId = 'corr-wallet-signed-e2e';

    const registerResponse = await handleApiRequest(liveModelRunRequest(artifactJsonText), state);
    const registered = (await registerResponse.json()) as { run: { runId: string }; artifact: { artifactId: string; sha256: string } };
    expect(registerResponse.status).toBe(201);
    expect(registered.artifact.sha256).toBe(expectedSha256);
    const { artifactId, runId } = { artifactId: registered.artifact.artifactId, runId: registered.run.runId };

    const uploadResponse = await handleApiRequest(uploadRequest(artifactId), state);
    const uploaded = (await uploadResponse.json()) as { artifact: { blobId: string; uploadStatus: string; state: string } };
    expect(uploadResponse.status).toBe(200);
    expect(uploaded.artifact.blobId).toBe(recordedBlobId);
    expect(uploaded.artifact.uploadStatus).toBe('uploaded');
    expect(walrus.uploadCalls).toBe(1);

    const verifyResponse = await handleApiRequest(verifyRequest(artifactId), state);
    const verified = (await verifyResponse.json()) as { artifact: { state: string; verificationStatus: string }; expectedSha256: string; actualSha256: string };
    expect(verifyResponse.status).toBe(200);
    expect(verified.artifact.verificationStatus).toBe('verified');
    expect(verified.expectedSha256).toBe(expectedSha256);
    expect(verified.actualSha256).toBe(expectedSha256);
    expect(walrus.readCalls).toBe(1);

    const prepareResponse = await handleApiRequest(prepareAnchorRequest(artifactId, correlationId), state);
    const prepared = (await prepareResponse.json()) as {
      artifact: { state: string; anchorMode: string; signerAddress: string };
      preparedAnchor: { packageId: string; target: string; transactionJson: string };
    };
    expect(prepareResponse.status).toBe(200);
    expect(anchor.prepareCalls).toBe(1);
    expect(prepared.artifact.state).toBe('anchor_submitted');
    expect(prepared.artifact.anchorMode).toBe('wallet-signed');
    expect(prepared.artifact.signerAddress).toBe(walletSignerAddress);
    const preparedTransaction = JSON.parse(prepared.preparedAnchor.transactionJson) as { sender: string; blobId: string };
    expect(preparedTransaction.sender).toBe(walletSignerAddress);
    expect(preparedTransaction.blobId).toBe(recordedBlobId);

    const recordResponse = await handleApiRequest(recordAnchorRequest(artifactId, correlationId), state);
    const recorded = (await recordResponse.json()) as {
      artifact: {
        state: string;
        anchorMode: string;
        signerAddress: string;
        anchorObjectId: string;
        onChainOwnerAddress: string;
        anchorTxDigest: string;
        serviceSigned: boolean;
      };
      anchor: { txDigest: string; anchorObjectId: string };
    };
    expect(recordResponse.status).toBe(200);
    expect(anchor.waitCalls).toBe(1);
    expect(recorded.artifact.state).toBe('anchored');
    expect(recorded.artifact.anchorMode).toBe('wallet-signed');
    expect(recorded.artifact.signerAddress).toBe(walletSignerAddress);
    expect(recorded.artifact.anchorObjectId).toBe(recordedAnchorObjectId);
    expect(recorded.artifact.onChainOwnerAddress).toBe(recordedOnChainOwnerAddress);
    expect(recorded.artifact.anchorTxDigest).toBe(recordedTxDigest);
    expect(recorded.artifact.serviceSigned).toBe(false);

    const storedArtifact = getArtifact(db, artifactId);
    expect(storedArtifact?.state).toBe('anchored');
    expect(storedArtifact?.serviceSigned).toBe(false);

    const proofEvents = listProofEvents(db, { runId });
    const eventTypes = proofEvents.map((event) => event.type);
    expect(eventTypes).toEqual([
      'run_registered',
      'artifact_generated',
      'artifact_uploaded',
      'artifact_verified',
      'artifact_anchor_submitted',
      'artifact_anchored',
    ]);

    const anchorEvents = proofEvents.filter((event) =>
      event.type === 'artifact_anchor_submitted' || event.type === 'artifact_anchored',
    );
    expect(anchorEvents).toHaveLength(2);
    expect(anchorEvents.every((event) => event.correlationId === correlationId)).toBe(true);
    expect(anchorEvents.every((event) => event.anchorMode === 'wallet-signed')).toBe(true);
    expect(anchorEvents.every((event) => event.signerAddress === walletSignerAddress)).toBe(true);

    const anchoredEvent = anchorEvents.find((event) => event.type === 'artifact_anchored');
    expect(anchoredEvent?.suiTxDigest).toBe(recordedTxDigest);
    expect(anchoredEvent?.suiObjectId).toBe(recordedAnchorObjectId);
    expect(anchoredEvent?.onChainOwnerAddress).toBe(recordedOnChainOwnerAddress);
    expect(anchoredEvent?.walrusBlobId).toBe(recordedBlobId);
    expect(anchoredEvent?.hashSha256).toBe(expectedSha256);

    const proofChainText = JSON.stringify(proofEvents);
    expect(proofChainText).not.toContain('secret-token');
    expect(proofChainText).not.toContain('suiprivkey');

    db.close();
  });

  it('rejects duplicate wallet-signed anchor tx digests across runs in the same chain', async () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    const artifactJsonText = JSON.stringify(validLiveModelArtifact, null, 2);
    const sharedArtifactBytes = createInMemoryArtifactByteStore();
    const sharedAnchor = createE2EAnchor();
    const state: ApiState = {
      db,
      walrus: createE2EWalrus(artifactJsonText),
      anchor: sharedAnchor,
      artifactBytes: sharedArtifactBytes,
      env: liveAnchorEnv,
    };

    const drive = async () => {
      const register = await handleApiRequest(liveModelRunRequest(artifactJsonText), state);
      const registered = (await register.json()) as { artifact: { artifactId: string } };
      await handleApiRequest(uploadRequest(registered.artifact.artifactId), state);
      await handleApiRequest(verifyRequest(registered.artifact.artifactId), state);
      await handleApiRequest(prepareAnchorRequest(registered.artifact.artifactId, `corr-${registered.artifact.artifactId}`), state);
      return registered.artifact.artifactId;
    };

    const firstArtifactId = await drive();
    const secondArtifactId = await drive();

    const firstRecord = await handleApiRequest(recordAnchorRequest(firstArtifactId, `corr-${firstArtifactId}`), state);
    expect(firstRecord.status).toBe(200);

    const duplicateRecord = await handleApiRequest(recordAnchorRequest(secondArtifactId, `corr-${secondArtifactId}`), state);
    const duplicateBody = (await duplicateRecord.json()) as { error: string };
    expect(duplicateRecord.status).toBe(409);
    expect(duplicateBody.error).toContain('duplicate Sui anchor tx digest');
    expect(sharedAnchor.waitCalls).toBe(1);
    db.close();
  });
});
