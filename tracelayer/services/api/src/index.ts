import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { assertLiveSuiAnchorConfig, createTraceLayerConfig, looksLikeRecordedBlobId, looksLikeSuiObjectId, looksLikeSuiTxDigest, type TraceLayerConfig } from '@tracelayer/config';
import { validateLiveModelArtifactJsonText } from './model-artifact.js';
import {
  createInMemoryArtifactByteStore,
  createPersistentArtifactByteStore,
  resolveDefaultArtifactBytesDirectory,
  type ArtifactByteStore,
} from './artifact-bytes.js';
import {
  assembleReplayData,
  getAgentRun,
  getArtifact,
  initializeSchema,
  insertAgentRun,
  insertArtifact,
  insertProofEvent,
  listAgentRuns,
  listArtifacts,
  listProofEvents,
  openTraceLayerDb,
  updateArtifactAnchor,
  updateArtifactPreview,
  updateArtifactUpload,
  updateArtifactVerification,
  type TraceLayerDb,
} from '@tracelayer/db';
import { assertCanAnchorArtifact, createArtifactProofEvent, createCorrelationId, createProofEvent } from '@tracelayer/proof';
import type { AgentRun, AnchorMode, ArtifactRef, JsonMetadata, ProofEvent, ProofMode } from '@tracelayer/types';

export type WalrusOperations = {
  uploadArtifact(input: { artifactId: string; bytes: Uint8Array; contentType: string; expectedSha256: string }): Promise<{
    blobId: string;
    blobObjectId?: string;
    sha256: string;
    byteLength: number;
    rawWalrusResponse: JsonMetadata;
  }>;
  readArtifact(input: { artifactId: string; blobId: string }): Promise<Uint8Array>;
};

export type PreparedAnchorArtifact = {
  anchorMode: 'wallet-signed';
  packageId: string;
  target: string;
  transactionJson: string;
  transactionBytesBase64?: string;
  rawSuiResponse?: JsonMetadata;
};

export type AnchorTransactionResult = {
  txDigest: string;
  anchorObjectId?: string;
  onChainOwnerAddress?: string;
  rawSuiResponse: JsonMetadata;
};

export type ServerSignedAnchorResult = AnchorTransactionResult & {
  anchorMode: 'server-signed-fallback';
  signerAddress: string;
  onChainOwnerAddress: string;
  serviceSigned: true;
};

export type AnchorOperations = {
  prepareAnchorArtifact(input: {
    artifactId: string;
    runId: string;
    blobId: string;
    artifactHash: string;
    artifactType: string;
    createdAtMs: number;
    packageId: string;
    signerAddress: string;
    claimedOwnerAddress?: string;
  }): Promise<PreparedAnchorArtifact>;
  waitForAnchorTransaction(input: { artifactId: string; txDigest: string; packageId: string }): Promise<AnchorTransactionResult>;
  executeServerSignedAnchor?(input: {
    artifactId: string;
    runId: string;
    blobId: string;
    artifactHash: string;
    artifactType: string;
    createdAtMs: number;
    claimedOwnerAddress?: string;
  }): Promise<ServerSignedAnchorResult>;
};

export type ApiState = {
  db: TraceLayerDb;
  walrus?: WalrusOperations;
  anchor?: AnchorOperations;
  artifactBytes?: ArtifactByteStore;
  env?: NodeJS.ProcessEnv;
};

export type { ArtifactByteStore } from './artifact-bytes.js';

const defaultArtifactByteStore: ArtifactByteStore = createInMemoryArtifactByteStore();

function resolveArtifactByteStore(state: ApiState): ArtifactByteStore {
  return state.artifactBytes ?? defaultArtifactByteStore;
}

export function createDefaultApiState(): ApiState {
  const db = openTraceLayerDb(process.env.TRACE_LAYER_DB_PATH);
  initializeSchema(db);
  const artifactBytes = createPersistentArtifactByteStore(resolveDefaultArtifactBytesDirectory(process.env));
  return { db, artifactBytes };
}

export async function handleApiRequest(request: Request, state: ApiState): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    const artifactAction = parseArtifactAction(path);
    if (request.method === 'GET' && path === '/api/live-demo/capabilities') return liveDemoCapabilitiesResponse(state);
    if (request.method === 'POST' && path === '/api/live-demo/model-artifact-run') return await createLiveModelArtifactRunResponse(request, state);
    if (request.method === 'POST' && path === '/api/runs/demo') return jsonResponse(createDemoRun(state.db, resolveArtifactByteStore(state)), 201);
    if (request.method === 'POST' && path === '/api/dev/recorded-walrus-artifact') return await createRecordedWalrusArtifactResponse(request, state);
    if (request.method === 'POST' && artifactAction?.action === 'upload') return await uploadArtifactResponse(request, state, artifactAction.artifactId);
    if (request.method === 'POST' && artifactAction?.action === 'verify') return await verifyArtifactResponse(request, state, artifactAction.artifactId);
    if (request.method === 'POST' && artifactAction?.action === 'anchor') return await anchorArtifactResponse(request, state, artifactAction.artifactId);
    if (request.method === 'GET' && artifactAction?.action === 'read') return await readArtifactResponse(request, state, artifactAction.artifactId);
    if (request.method === 'GET' && path === '/api/runs') return jsonResponse({ runs: listAgentRuns(state.db) });
    if (request.method === 'GET' && path.startsWith('/api/runs/')) return getRunResponse(state.db, decodeURIComponent(path.slice('/api/runs/'.length)));
    if (request.method === 'GET' && path.startsWith('/api/artifacts/')) return getArtifactResponse(state.db, decodeURIComponent(path.slice('/api/artifacts/'.length)));
    if (request.method === 'GET' && path === '/api/proofs') return jsonResponse({ proofEvents: listProofEvents(state.db) });
    if (request.method === 'POST' && path.startsWith('/api/replay/')) return replayResponse(state.db, decodeURIComponent(path.slice('/api/replay/'.length)));
    return jsonResponse({ error: 'not found' }, 404);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'internal error' }, 500);
  }
}

function liveDemoCapabilitiesResponse(state: ApiState): Response {
  const config = createTraceLayerConfig(state.env ?? process.env);
  return jsonResponse({
    demoMode: config.demoMode,
    walrusLiveUpload: config.liveWalrusUpload,
    suiAnchorLive: config.liveSuiAnchor,
    suiNetwork: config.suiNetwork,
    suiAnchorPackageConfigured: looksLikeSuiObjectId(config.suiAnchorPackageId),
    ...(looksLikeSuiObjectId(config.suiAnchorPackageId) ? { suiAnchorPackageId: config.suiAnchorPackageId } : {}),
  });
}

async function createLiveModelArtifactRunResponse(request: Request, state: ApiState): Promise<Response> {
  const config = createTraceLayerConfig(state.env ?? process.env);
  const unauthorized = apiTokenResponse(request, config);
  if (unauthorized) return unauthorized;
  let body: LiveModelArtifactRunRequest;
  let validated: ReturnType<typeof validateLiveModelArtifactJsonText>;
  try {
    body = await readLiveModelArtifactRunRequest(request);
    validated = validateLiveModelArtifactJsonText(body.artifactJsonText);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'invalid live model artifact request' }, 400);
  }
  const now = Date.now();
  const runId = `run_${randomUUID()}`;
  const artifactId = `artifact_${randomUUID()}`;
  const projectId = 'local-live-model-demo';
  const ownerAddress = body.ownerAddress ?? 'local-byok-user';
  const sha256 = sha256Hex(validated.bytes);
  const correlationId = createCorrelationId('corr_live_model');
  const run: AgentRun = {
    runId,
    projectId,
    agentId: 'tracelayer-live-model-agent',
    agentVersion: 'phase-5',
    ownerAddress,
    status: 'artifact_generated',
    taskSummary: validated.artifact.title,
    inputPreview: body.taskInputPreview,
    inputHashSha256: sha256Hex(new TextEncoder().encode(body.taskInputPreview)),
    outputSummary: validated.artifact.summary,
    previousRunIds: [],
    startedAtMs: now,
    completedAtMs: now,
    walrusNetwork: config.suiNetwork,
    suiNetwork: config.suiNetwork,
  };
  const artifact: ArtifactRef = {
    artifactId,
    runId,
    ownerAddress,
    artifactType: 'markdown_report',
    contentType: 'application/json; charset=utf-8',
    byteLength: validated.bytes.byteLength,
    sha256,
    walrusNetwork: config.suiNetwork,
    state: 'generated',
    uploadStatus: 'not_uploaded',
    verificationStatus: 'not_checked',
    textPreview: body.artifactJsonText,
    createdAtMs: now,
  };
  const metadata: JsonMetadata = omitUndefined<JsonMetadata>({
    modelName: body.modelName,
    endpointMode: body.endpointMode,
    providerOrigin: body.providerOrigin,
    chainOfThoughtIncluded: false,
  });
  const proofEvents = [
    createProofEvent({
      correlationId,
      projectId,
      runId,
      type: 'run_registered',
      status: 'succeeded',
      mode: config.demoMode,
      dryRun: config.demoMode === 'dry-run',
      recorded: config.demoMode === 'recorded',
      summary: 'Registered BYOK live model run without storing provider credentials.',
      metadata,
      createdAtMs: now,
    }),
    createArtifactProofEvent({
      correlationId,
      projectId,
      runId,
      artifactId,
      type: 'artifact_generated',
      mode: config.demoMode,
      summary: 'Validated structured model artifact for Walrus proof flow.',
      hashSha256: sha256,
      metadata,
      createdAtMs: now + 1,
    }),
  ];

  insertAgentRun(state.db, run);
  insertArtifact(state.db, artifact);
  resolveArtifactByteStore(state).set(artifactId, validated.bytes);
  for (const event of proofEvents) insertProofEvent(state.db, event);
  return jsonResponse({ run, artifact, proofEvents }, 201);
}

export function createDemoRun(db: TraceLayerDb, artifactBytes: ArtifactByteStore = defaultArtifactByteStore): { run: AgentRun; artifact: ArtifactRef; proofEvents: ProofEvent[] } {
  const config = createTraceLayerConfig({ TRACE_LAYER_DEMO_MODE: 'dry-run' });
  const now = Date.now();
  const runId = `run_${randomUUID()}`;
  const artifactId = `artifact_${randomUUID()}`;
  const projectId = 'local-demo-project';
  const ownerAddress = 'local-owner';
  const markdown = `# TraceLayer Phase 1 Demo\n\nRun ID: ${runId}\n\nThis local dry-run artifact contains no secrets and was not uploaded.\n`;
  const bytes = new TextEncoder().encode(markdown);
  const sha256 = sha256Hex(bytes);

  const run: AgentRun = {
    runId,
    projectId,
    agentId: 'tracelayer-demo-agent',
    agentVersion: 'phase-1',
    ownerAddress,
    status: 'artifact_generated',
    taskSummary: 'Generate local Phase 1 dry-run demonstration artifact',
    inputPreview: 'Create a synthetic non-sensitive markdown artifact for local replay.',
    outputSummary: 'Generated one markdown artifact locally. Upload was not started.',
    previousRunIds: [],
    startedAtMs: now,
    completedAtMs: now,
    walrusNetwork: 'local-dry-run',
    suiNetwork: 'local-dry-run',
  };

  const artifact: ArtifactRef = {
    artifactId,
    runId,
    ownerAddress,
    artifactType: 'markdown_report',
    contentType: 'text/markdown; charset=utf-8',
    byteLength: bytes.byteLength,
    sha256,
    walrusNetwork: 'local-dry-run',
    state: 'generated',
    uploadStatus: 'not_uploaded',
    verificationStatus: 'not_checked',
    textPreview: markdown,
    createdAtMs: now,
  };

  const correlationId = createCorrelationId();
  const proofEvents = [
    createProofEvent({
      correlationId,
      projectId,
      runId,
      type: 'run_registered',
      status: 'succeeded',
      mode: config.demoMode,
      dryRun: true,
      summary: 'Local dry-run registered without Walrus or Sui calls.',
      createdAtMs: now,
    }),
    createArtifactProofEvent({
      correlationId,
      projectId,
      runId,
      artifactId,
      type: 'artifact_generated',
      mode: config.demoMode,
      summary: 'Generated synthetic markdown artifact locally.',
      hashSha256: sha256,
      createdAtMs: now + 1,
    }),
    createArtifactProofEvent({
      correlationId,
      projectId,
      runId,
      artifactId,
      type: 'artifact_generated',
      status: 'pending',
      mode: config.demoMode,
      summary: 'Walrus upload not started in Phase 1 dry-run.',
      hashSha256: sha256,
      createdAtMs: now + 2,
    }),
  ];

  insertAgentRun(db, run);
  insertArtifact(db, artifact);
  artifactBytes.set(artifactId, bytes);
  for (const event of proofEvents) insertProofEvent(db, event);
  return { run, artifact, proofEvents };
}

async function uploadArtifactResponse(request: Request, state: ApiState, artifactId: string): Promise<Response> {
  const artifactStore = resolveArtifactByteStore(state);
  const artifact = getArtifact(state.db, artifactId);
  if (artifact === undefined) return jsonResponse({ error: 'artifact not found' }, 404);
  const config = createTraceLayerConfig(state.env ?? process.env);
  const force = await readForce(request);

  if (artifact.blobId !== undefined && !force) return jsonResponse({ artifact });
  if (config.demoMode === 'dry-run') return jsonResponse({ error: 'dry-run mode does not upload to Walrus' }, 409);
  const unauthorized = apiTokenResponse(request, config);
  if (unauthorized) return unauthorized;
  if (config.demoMode === 'recorded') return jsonResponse(recordRecordedUpload(state.db, artifact, config), 200);
  if (state.walrus === undefined) return jsonResponse({ error: 'live Walrus operations are not configured' }, 500);

  const bytes = artifactStore.get(artifactId) ?? encodePreview(artifact);
  const expectedSha256 = sha256Hex(bytes);
  if (expectedSha256 !== artifact.sha256) return jsonResponse({ error: 'artifact bytes do not match stored sha256' }, 409);
  const correlationId = createCorrelationId();
  updateArtifactUpload(state.db, artifactId, {
    state: 'uploading',
    uploadStatus: 'uploading',
    walrusNetwork: config.suiNetwork,
  });

  try {
    const upload = await state.walrus.uploadArtifact({ artifactId, bytes, contentType: artifact.contentType, expectedSha256 });
    const uploaded = updateArtifactUpload(state.db, artifactId, {
      state: 'uploaded',
      uploadStatus: 'uploaded',
      blobId: upload.blobId,
      ...(upload.blobObjectId ? { blobObjectId: upload.blobObjectId } : {}),
      walrusNetwork: config.suiNetwork,
      epochs: config.walrusEpochs,
      deletable: config.walrusDeletable,
      rawWalrusResponse: upload.rawWalrusResponse,
      uploadedAtMs: Date.now(),
    });
    insertProofEvent(state.db, createArtifactProofEvent({
      correlationId,
      projectId: artifactProjectId(state.db, artifact),
      runId: artifact.runId,
      artifactId,
      type: 'artifact_uploaded',
      mode: 'live',
      summary: 'Uploaded artifact bytes to Walrus.',
      walrusBlobId: upload.blobId,
      hashSha256: artifact.sha256,
    }));
    artifactStore.delete(artifactId);
    return jsonResponse({ artifact: uploaded });
  } catch (error) {
    const failed = updateArtifactUpload(state.db, artifactId, {
      state: 'upload_failed',
      uploadStatus: 'upload_failed',
      walrusNetwork: config.suiNetwork,
    });
    insertProofEvent(state.db, createArtifactProofEvent({
      correlationId,
      projectId: artifactProjectId(state.db, artifact),
      runId: artifact.runId,
      artifactId,
      type: 'artifact_uploaded',
      status: 'failed',
      mode: 'live',
      summary: error instanceof Error ? error.message : 'Walrus upload failed.',
      hashSha256: artifact.sha256,
    }));
    return jsonResponse({ artifact: failed, error: 'walrus upload failed' }, 502);
  }
}

async function verifyArtifactResponse(request: Request, state: ApiState, artifactId: string): Promise<Response> {
  const artifact = getArtifact(state.db, artifactId);
  if (artifact === undefined) return jsonResponse({ error: 'artifact not found' }, 404);
  const config = createTraceLayerConfig(state.env ?? process.env);
  if (!looksLikeRecordedBlobId(artifact.blobId)) return jsonResponse({ error: 'missing real blobId' }, 409);
  if (config.demoMode !== 'live') return jsonResponse({ artifact, verificationStatus: artifact.verificationStatus });
  const unauthorized = apiTokenResponse(request, config);
  if (unauthorized) return unauthorized;
  if (state.walrus === undefined) return jsonResponse({ error: 'live Walrus operations are not configured' }, 500);

  let bytes: Uint8Array;
  try {
    bytes = await state.walrus.readArtifact({ artifactId, blobId: artifact.blobId });
  } catch (error) {
    const updated = updateArtifactVerification(state.db, artifactId, {
      state: 'uploaded',
      verificationStatus: 'read_failed',
      rawWalrusResponse: { kind: 'readBlob', error: true },
      verifiedAtMs: Date.now(),
    });
    insertProofEvent(state.db, createArtifactProofEvent({
      correlationId: createCorrelationId(),
      projectId: artifactProjectId(state.db, artifact),
      runId: artifact.runId,
      artifactId,
      type: 'artifact_verified',
      status: 'failed',
      mode: 'live',
      summary: error instanceof Error ? error.message : 'Walrus readback failed.',
      walrusBlobId: artifact.blobId,
      hashSha256: artifact.sha256,
    }));
    return jsonResponse({ artifact: updated, error: 'walrus read failed', verificationStatus: updated.verificationStatus }, 502);
  }

  const actualSha256 = sha256Hex(bytes);
  const ok = actualSha256 === artifact.sha256;
  const updated = updateArtifactVerification(state.db, artifactId, {
    state: ok ? 'verified' : 'mismatch',
    verificationStatus: ok ? 'verified' : 'mismatch',
    verifiedAtMs: Date.now(),
  });
  if (ok && artifact.contentType.startsWith('text/')) updateArtifactPreview(state.db, artifactId, new TextDecoder().decode(bytes));
  insertProofEvent(state.db, createArtifactProofEvent({
    correlationId: createCorrelationId(),
    projectId: artifactProjectId(state.db, artifact),
    runId: artifact.runId,
    artifactId,
    type: 'artifact_verified',
    status: ok ? 'succeeded' : 'failed',
    mode: 'live',
    summary: ok ? 'Walrus readback hash matched stored artifact hash.' : 'Walrus readback hash mismatched stored artifact hash.',
    walrusBlobId: artifact.blobId,
    hashSha256: actualSha256,
  }));

  return jsonResponse(
    { artifact: updated, expectedSha256: artifact.sha256, actualSha256, verificationStatus: updated.verificationStatus },
    ok ? 200 : 409,
  );
}

async function anchorArtifactResponse(request: Request, state: ApiState, artifactId: string): Promise<Response> {
  const artifact = getArtifact(state.db, artifactId);
  if (artifact === undefined) return jsonResponse({ error: 'artifact not found' }, 404);
  const config = createTraceLayerConfig(state.env ?? process.env);
  if (config.demoMode === 'dry-run') return jsonResponse({ error: 'dry-run mode does not anchor artifacts on Sui' }, 409);

  const unauthorized = apiTokenResponse(request, config);
  if (unauthorized) return unauthorized;
  const body = await readAnchorRequest(request);
  const correlationId = body.correlationId ?? createCorrelationId();

  if (config.demoMode === 'recorded') {
    return recordedAnchorResponse(state.db, artifact, config, correlationId);
  }

  assertLiveSuiAnchorConfig(config);
  if (!config.suiAnchorPackageId) throw new Error('live Sui anchor requires SUI_ANCHOR_PACKAGE_ID');
  if (state.anchor === undefined) return jsonResponse({ error: 'live Sui anchor operations are not configured' }, 500);

  if (body.anchorMode === 'wallet-signed') {
    if (looksLikeSuiTxDigest(body.anchorTxDigest)) {
      return await recordWalletSignedAnchorResponse(state, artifact, config, body, correlationId);
    }
    return await prepareWalletSignedAnchorResponse(state, artifact, config, body, correlationId);
  }

  if (body.anchorMode === 'server-signed-fallback') {
    return await serverSignedAnchorResponse(state, artifact, config, body, correlationId);
  }

  return jsonResponse({ error: 'anchorMode must be wallet-signed or server-signed-fallback' }, 400);
}

async function readArtifactResponse(request: Request, state: ApiState, artifactId: string): Promise<Response> {
  const artifact = getArtifact(state.db, artifactId);
  if (artifact === undefined) return jsonResponse({ error: 'artifact not found' }, 404);
  if (artifact.verificationStatus !== 'verified') return jsonResponse({ error: 'artifact must be verified before reading preview' }, 409);
  if (!artifact.contentType.startsWith('text/')) return jsonResponse({ error: 'artifact is not safe text content' }, 415);
  if (artifact.textPreview !== undefined) {
    return jsonResponse({ artifactId, contentType: artifact.contentType, text: artifact.textPreview, sha256: artifact.sha256, verificationStatus: artifact.verificationStatus });
  }

  const config = createTraceLayerConfig(state.env ?? process.env);
  if (config.demoMode !== 'live' || state.walrus === undefined || !artifact.blobId) return jsonResponse({ error: 'verified text preview is unavailable' }, 404);
  const unauthorized = apiTokenResponse(request, config);
  if (unauthorized) return unauthorized;
  const bytes = await state.walrus.readArtifact({ artifactId, blobId: artifact.blobId });
  if (sha256Hex(bytes) !== artifact.sha256) return jsonResponse({ error: 'hash mismatch while reading artifact' }, 409);
  const text = new TextDecoder().decode(bytes);
  updateArtifactPreview(state.db, artifactId, text);
  return jsonResponse({ artifactId, contentType: artifact.contentType, text, sha256: artifact.sha256, verificationStatus: artifact.verificationStatus });
}

async function prepareWalletSignedAnchorResponse(state: ApiState, artifact: ArtifactRef, config: TraceLayerConfig, body: AnchorRequestBody, correlationId: string): Promise<Response> {
  try {
    assertCanAnchorArtifact(artifact);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'artifact cannot be anchored' }, 409);
  }

  if (!body.signerAddress) {
    return jsonResponse({ error: { code: 'missing_transaction_sender', message: 'Wallet-signed anchor prepare requires signerAddress.' } }, 400);
  }

  const blobId = requireArtifactBlobId(artifact);
  const packageId = requireSuiAnchorPackageId(config);
  const prepared = await state.anchor!.prepareAnchorArtifact({
    artifactId: artifact.artifactId,
    runId: artifact.runId,
    blobId,
    artifactHash: artifact.sha256,
    artifactType: artifact.artifactType,
    createdAtMs: Date.now(),
    packageId,
    signerAddress: body.signerAddress,
    ...(body.claimedOwnerAddress ? { claimedOwnerAddress: body.claimedOwnerAddress } : {}),
  });
  const submitted = updateArtifactAnchor(state.db, artifact.artifactId, {
    state: 'anchor_submitted',
    anchorMode: 'wallet-signed',
    signerAddress: body.signerAddress,
    ...(body.claimedOwnerAddress ? { claimedOwnerAddress: body.claimedOwnerAddress } : {}),
  });
  const metadata: JsonMetadata = { packageId, target: prepared.target };
  if (prepared.rawSuiResponse !== undefined) Object.assign(metadata, prepared.rawSuiResponse);
  const proofEvent = createArtifactProofEvent({
    correlationId,
    projectId: artifactProjectId(state.db, artifact),
    runId: artifact.runId,
    artifactId: artifact.artifactId,
    type: 'artifact_anchor_submitted',
    status: 'pending',
    mode: 'live',
    summary: 'Prepared wallet-signed Sui artifact anchor transaction.',
    walrusBlobId: blobId,
    hashSha256: artifact.sha256,
    anchorMode: 'wallet-signed',
    signerAddress: body.signerAddress,
    ...(body.claimedOwnerAddress ? { claimedOwnerAddress: body.claimedOwnerAddress } : {}),
    metadata,
  });
  insertProofEvent(state.db, proofEvent);
  return jsonResponse({ artifact: submitted, preparedAnchor: prepared, proofEvent });
}

async function recordWalletSignedAnchorResponse(state: ApiState, artifact: ArtifactRef, config: TraceLayerConfig, body: AnchorRequestBody, correlationId: string): Promise<Response> {
  if (!looksLikeSuiTxDigest(body.anchorTxDigest)) return jsonResponse({ error: 'anchorTxDigest must be a real Sui transaction digest' }, 400);
  if (!body.signerAddress) return jsonResponse({ error: 'wallet-signed anchor record requires signerAddress' }, 400);
  if (artifact.state !== 'anchor_submitted') return jsonResponse({ error: 'wallet-signed anchor must be submitted before recording completion' }, 409);
  const duplicate = listProofEvents(state.db).find((event) => event.suiTxDigest === body.anchorTxDigest);
  if (duplicate !== undefined) return jsonResponse({ error: 'duplicate Sui anchor tx digest', proofEventId: duplicate.proofEventId }, 409);

  const blobId = requireArtifactBlobId(artifact);
  const packageId = requireSuiAnchorPackageId(config);
  try {
    const confirmation = await state.anchor!.waitForAnchorTransaction({ artifactId: artifact.artifactId, txDigest: body.anchorTxDigest, packageId });
    const anchorObjectId = confirmation.anchorObjectId ?? body.anchorObjectId;
    const onChainOwnerAddress = confirmation.onChainOwnerAddress ?? body.onChainOwnerAddress ?? body.signerAddress;
    const anchored = updateArtifactAnchor(state.db, artifact.artifactId, {
      state: 'anchored',
      anchorMode: 'wallet-signed',
      signerAddress: body.signerAddress,
      ...(body.claimedOwnerAddress ? { claimedOwnerAddress: body.claimedOwnerAddress } : {}),
      onChainOwnerAddress,
      serviceSigned: false,
      ...(anchorObjectId ? { anchorObjectId } : {}),
      anchorTxDigest: body.anchorTxDigest,
      anchoredAtMs: Date.now(),
    });
    const proofEvent = createArtifactProofEvent({
      correlationId,
      projectId: artifactProjectId(state.db, artifact),
      runId: artifact.runId,
      artifactId: artifact.artifactId,
      type: 'artifact_anchored',
      mode: 'live',
      summary: 'Confirmed wallet-signed Sui artifact anchor transaction.',
      walrusBlobId: blobId,
      hashSha256: artifact.sha256,
      anchorMode: 'wallet-signed',
      signerAddress: body.signerAddress,
      ...(body.claimedOwnerAddress ? { claimedOwnerAddress: body.claimedOwnerAddress } : {}),
      onChainOwnerAddress,
      ...(anchorObjectId ? { suiObjectId: anchorObjectId } : {}),
      suiTxDigest: body.anchorTxDigest,
      metadata: { packageId, ...confirmation.rawSuiResponse },
    });
    insertProofEvent(state.db, proofEvent);
    return jsonResponse({ artifact: anchored, anchor: confirmation, proofEvent });
  } catch (error) {
    const failed = updateArtifactAnchor(state.db, artifact.artifactId, { state: 'anchor_failed' });
    insertProofEvent(state.db, createArtifactProofEvent({
      correlationId,
      projectId: artifactProjectId(state.db, artifact),
      runId: artifact.runId,
      artifactId: artifact.artifactId,
      type: 'artifact_anchor_failed',
      status: 'failed',
      mode: 'live',
      summary: error instanceof Error ? error.message : 'Sui anchor transaction confirmation failed.',
      walrusBlobId: blobId,
      hashSha256: artifact.sha256,
      anchorMode: 'wallet-signed',
      signerAddress: body.signerAddress,
      suiTxDigest: body.anchorTxDigest,
      metadata: { packageId },
    }));
    return jsonResponse({ artifact: failed, error: 'sui anchor confirmation failed' }, 502);
  }
}

async function serverSignedAnchorResponse(state: ApiState, artifact: ArtifactRef, config: TraceLayerConfig, body: AnchorRequestBody, correlationId: string): Promise<Response> {
  if (!config.allowSuiAnchorServerFallback) return jsonResponse({ error: 'server-signed Sui anchor fallback requires SUI_ANCHOR_SERVER_FALLBACK=true' }, 409);
  try {
    assertCanAnchorArtifact(artifact);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'artifact cannot be anchored' }, 409);
  }
  if (state.anchor?.executeServerSignedAnchor === undefined) return jsonResponse({ error: 'server-signed Sui anchor fallback is not configured' }, 500);
  const blobId = requireArtifactBlobId(artifact);
  try {
    const result = await state.anchor.executeServerSignedAnchor({
      artifactId: artifact.artifactId,
      runId: artifact.runId,
      blobId,
      artifactHash: artifact.sha256,
      artifactType: artifact.artifactType,
      createdAtMs: Date.now(),
      ...(body.claimedOwnerAddress ? { claimedOwnerAddress: body.claimedOwnerAddress } : {}),
    });
    const anchored = updateArtifactAnchor(state.db, artifact.artifactId, {
      state: 'anchored',
      anchorMode: 'server-signed-fallback',
      signerAddress: result.signerAddress,
      ...(body.claimedOwnerAddress ? { claimedOwnerAddress: body.claimedOwnerAddress } : {}),
      onChainOwnerAddress: result.onChainOwnerAddress,
      serviceSigned: true,
      ...(result.anchorObjectId ? { anchorObjectId: result.anchorObjectId } : {}),
      anchorTxDigest: result.txDigest,
      anchoredAtMs: Date.now(),
    });
    const proofEvent = createArtifactProofEvent({
      correlationId,
      projectId: artifactProjectId(state.db, artifact),
      runId: artifact.runId,
      artifactId: artifact.artifactId,
      type: 'artifact_anchored',
      mode: 'live',
      summary: 'Confirmed server-signed fallback Sui artifact anchor transaction.',
      walrusBlobId: blobId,
      hashSha256: artifact.sha256,
      anchorMode: 'server-signed-fallback',
      signerAddress: result.signerAddress,
      ...(body.claimedOwnerAddress ? { claimedOwnerAddress: body.claimedOwnerAddress } : {}),
      onChainOwnerAddress: result.onChainOwnerAddress,
      ...(result.anchorObjectId ? { suiObjectId: result.anchorObjectId } : {}),
      suiTxDigest: result.txDigest,
      metadata: result.rawSuiResponse,
    });
    insertProofEvent(state.db, proofEvent);
    return jsonResponse({ artifact: anchored, anchor: result, proofEvent });
  } catch (error) {
    const failed = updateArtifactAnchor(state.db, artifact.artifactId, { state: 'anchor_failed' });
    insertProofEvent(state.db, createArtifactProofEvent({
      correlationId,
      projectId: artifactProjectId(state.db, artifact),
      runId: artifact.runId,
      artifactId: artifact.artifactId,
      type: 'artifact_anchor_failed',
      status: 'failed',
      mode: 'live',
      summary: error instanceof Error ? error.message : 'Server-signed Sui anchor fallback failed.',
      walrusBlobId: blobId,
      hashSha256: artifact.sha256,
      anchorMode: 'server-signed-fallback',
    }));
    return jsonResponse({ artifact: failed, error: 'server-signed sui anchor failed' }, 502);
  }
}

function recordedAnchorResponse(db: TraceLayerDb, artifact: ArtifactRef, config: TraceLayerConfig, correlationId: string): Response {
  if (!looksLikeSuiTxDigest(config.recordedTxDigest)) throw new Error('recorded mode requires a real recorded Sui tx digest');
  if (config.recordedArtifactSha256 !== artifact.sha256) throw new Error('recorded artifact hash does not match current artifact');
  try {
    assertCanAnchorArtifact(artifact);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'artifact cannot be anchored' }, 409);
  }
  const blobId = requireArtifactBlobId(artifact);
  const anchored = updateArtifactAnchor(db, artifact.artifactId, {
    state: 'anchored',
    anchorMode: 'wallet-signed',
    anchorTxDigest: config.recordedTxDigest,
    anchoredAtMs: Date.now(),
  });
  const proofEvent = createArtifactProofEvent({
    correlationId,
    projectId: artifactProjectId(db, artifact),
    runId: artifact.runId,
    artifactId: artifact.artifactId,
    type: 'artifact_anchored',
    mode: 'recorded',
    summary: 'Recorded real Sui anchor transaction associated without live network calls.',
    walrusBlobId: blobId,
    hashSha256: artifact.sha256,
    anchorMode: 'wallet-signed',
    suiTxDigest: config.recordedTxDigest,
    metadata: { recorded: true },
  });
  insertProofEvent(db, proofEvent);
  return jsonResponse({ artifact: anchored, proofEvent });
}

function recordRecordedUpload(db: TraceLayerDb, artifact: ArtifactRef, config: TraceLayerConfig): { artifact: ArtifactRef; proofEvent: ProofEvent } {
  if (!looksLikeRecordedBlobId(config.recordedBlobId)) throw new Error('recorded mode requires a real recorded blobId');
  if (config.recordedArtifactSha256 !== artifact.sha256) throw new Error('recorded artifact hash does not match current artifact');
  const uploaded = updateArtifactUpload(db, artifact.artifactId, {
    state: 'uploaded',
    uploadStatus: 'uploaded',
    blobId: config.recordedBlobId,
    walrusNetwork: config.suiNetwork,
    rawWalrusResponse: { kind: 'recorded', recorded: true },
    uploadedAtMs: Date.now(),
  });
  const proofEvent = createArtifactProofEvent({
    correlationId: createCorrelationId(),
    projectId: artifactProjectId(db, artifact),
    runId: artifact.runId,
    artifactId: artifact.artifactId,
    type: 'artifact_uploaded',
    mode: 'recorded',
    summary: 'Recorded real Walrus blob ID associated without live network calls.',
    walrusBlobId: config.recordedBlobId,
    hashSha256: artifact.sha256,
  });
  insertProofEvent(db, proofEvent);
  return { artifact: uploaded, proofEvent };
}

async function createRecordedWalrusArtifactResponse(request: Request, state: ApiState): Promise<Response> {
  const config = createTraceLayerConfig(state.env ?? process.env);
  if (config.demoMode !== 'live') return jsonResponse({ error: 'dev recorded Walrus artifact seed requires live mode' }, 409);
  const unauthorized = apiTokenResponse(request, config);
  if (unauthorized) return unauthorized;
  const body = await readRecordedWalrusFixtureRequest(request);
  const runId = body.runId ?? 'run_phase_2_5_test';
  const artifactId = body.artifactId ?? `artifact_${runId}`;
  const now = Date.now();
  const run: AgentRun = {
    runId,
    projectId: 'local-demo-project',
    agentId: 'tracelayer-dev-anchor-smoke',
    agentVersion: 'phase-3.5',
    ownerAddress: 'wallet-smoke-user',
    status: 'uploaded',
    taskSummary: 'Seed recorded Walrus artifact for wallet-signed Sui anchor smoke',
    inputPreview: 'Use Phase 2.5 recorded Walrus proof fixture for Phase 3.5 wallet validation.',
    outputSummary: 'Seeded one verified recorded Walrus artifact without uploading new bytes.',
    previousRunIds: [],
    startedAtMs: now,
    completedAtMs: now,
    walrusNetwork: body.network,
    suiNetwork: config.suiNetwork,
  };
  const artifact: ArtifactRef = {
    artifactId,
    runId,
    ownerAddress: 'wallet-smoke-user',
    artifactType: 'markdown_report',
    contentType: body.contentType,
    byteLength: body.byteLength,
    sha256: body.sha256,
    blobId: body.blobId,
    ...(body.blobObjectId ? { blobObjectId: body.blobObjectId } : {}),
    walrusNetwork: body.network,
    state: 'verified',
    uploadStatus: 'uploaded',
    verificationStatus: 'verified',
    rawWalrusResponse: { kind: 'recorded-walrus-fixture', recorded: true },
    ...(body.artifactTextPreview ? { textPreview: body.artifactTextPreview } : {}),
    createdAtMs: now,
    uploadedAtMs: now,
    verifiedAtMs: now,
  };
  try {
    insertAgentRun(state.db, run);
    insertArtifact(state.db, artifact);
    const correlationId = body.correlationId ?? createCorrelationId();
    const uploadEvent = createArtifactProofEvent({
      correlationId,
      projectId: run.projectId,
      runId,
      artifactId,
      type: 'artifact_uploaded',
      mode: 'recorded',
      summary: 'Seeded recorded real Walrus blob ID for wallet-signed anchor smoke.',
      walrusBlobId: body.blobId,
      hashSha256: body.sha256,
      metadata: { source: 'phase-2.5-fixture' },
    });
    const verifiedEvent = createArtifactProofEvent({
      correlationId,
      projectId: run.projectId,
      runId,
      artifactId,
      type: 'artifact_verified',
      mode: 'recorded',
      summary: 'Seeded recorded artifact as hash-verified for wallet-signed anchor smoke.',
      walrusBlobId: body.blobId,
      hashSha256: body.sha256,
      metadata: { source: 'phase-2.5-fixture' },
    });
    insertProofEvent(state.db, uploadEvent);
    insertProofEvent(state.db, verifiedEvent);
    return jsonResponse({ run, artifact, proofEvents: [uploadEvent, verifiedEvent] }, 201);
  } catch (error) {
    const existing = getArtifact(state.db, artifactId);
    if (existing !== undefined) return jsonResponse({ run: getAgentRun(state.db, runId), artifact: existing, proofEvents: listProofEvents(state.db, { artifactId }) });
    throw error;
  }
}

function getRunResponse(db: TraceLayerDb, runId: string): Response {
  const run = getAgentRun(db, runId);
  if (run === undefined) return jsonResponse({ error: 'run not found' }, 404);
  return jsonResponse({ run, artifacts: listArtifacts(db, runId), proofEvents: listProofEvents(db, { runId }) });
}

function getArtifactResponse(db: TraceLayerDb, artifactId: string): Response {
  const artifact = getArtifact(db, artifactId);
  if (artifact === undefined) return jsonResponse({ error: 'artifact not found' }, 404);
  return jsonResponse({ artifact, proofEvents: listProofEvents(db, { artifactId }) });
}

function replayResponse(db: TraceLayerDb, runId: string): Response {
  return jsonResponse({ replayContext: assembleReplayData(db, runId) });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function parseArtifactAction(path: string): { artifactId: string; action: 'upload' | 'verify' | 'read' | 'anchor' } | undefined {
  const match = /^\/api\/artifacts\/([^/]+)\/(upload|verify|read|anchor)$/.exec(path);
  if (match === null) return undefined;
  const artifactId = match[1];
  const action = match[2];
  if (artifactId === undefined || (action !== 'upload' && action !== 'verify' && action !== 'read' && action !== 'anchor')) return undefined;
  return { artifactId: decodeURIComponent(artifactId), action };
}

type AnchorRequestBody = {
  anchorMode?: AnchorMode;
  correlationId?: string;
  claimedOwnerAddress?: string;
  signerAddress?: string;
  onChainOwnerAddress?: string;
  anchorObjectId?: string;
  anchorTxDigest?: string;
};

type RecordedWalrusFixtureRequest = {
  runId?: string;
  artifactId?: string;
  correlationId?: string;
  network: string;
  blobId: string;
  blobObjectId?: string;
  sha256: string;
  byteLength: number;
  contentType: string;
  artifactTextPreview?: string;
};

type LiveModelArtifactRunRequest = {
  artifactJsonText: string;
  taskInputPreview: string;
  modelName: string;
  endpointMode: string;
  providerOrigin?: string;
  ownerAddress?: string;
};

async function readForce(request: Request): Promise<boolean> {
  if (request.headers.get('content-type')?.includes('application/json') !== true) return false;
  const body = (await request.json()) as { force?: unknown };
  return body.force === true;
}

async function readAnchorRequest(request: Request): Promise<AnchorRequestBody> {
  if (request.headers.get('content-type')?.includes('application/json') !== true) return { anchorMode: 'wallet-signed' };
  const body = (await request.json()) as Record<string, unknown>;
  return omitUndefined<AnchorRequestBody>({
    anchorMode: body.anchorMode === 'server-signed-fallback' ? 'server-signed-fallback' : 'wallet-signed',
    correlationId: optionalBodyString(body.correlationId),
    claimedOwnerAddress: optionalBodyString(body.claimedOwnerAddress),
    signerAddress: optionalBodyString(body.signerAddress),
    onChainOwnerAddress: optionalBodyString(body.onChainOwnerAddress),
    anchorObjectId: optionalBodyString(body.anchorObjectId),
    anchorTxDigest: optionalBodyString(body.anchorTxDigest),
  });
}

async function readLiveModelArtifactRunRequest(request: Request): Promise<LiveModelArtifactRunRequest> {
  if (request.headers.get('content-type')?.includes('application/json') !== true) throw new Error('live model artifact run requires JSON body');
  const body = (await request.json()) as Record<string, unknown>;
  return omitUndefined<LiveModelArtifactRunRequest>({
    artifactJsonText: requiredBodyString(body.artifactJsonText, 'artifactJsonText'),
    taskInputPreview: requiredBodyString(body.taskInputPreview, 'taskInputPreview'),
    modelName: requiredBodyString(body.modelName, 'modelName'),
    endpointMode: requiredBodyString(body.endpointMode, 'endpointMode'),
    providerOrigin: optionalBodyString(body.providerOrigin),
    ownerAddress: optionalBodyString(body.ownerAddress),
  });
}

async function readRecordedWalrusFixtureRequest(request: Request): Promise<RecordedWalrusFixtureRequest> {
  if (request.headers.get('content-type')?.includes('application/json') !== true) throw new Error('recorded Walrus fixture seed requires JSON body');
  const body = (await request.json()) as Record<string, unknown>;
  const network = requiredBodyString(body.network, 'network');
  const blobId = requiredBodyString(body.blobId, 'blobId');
  const sha256 = requiredBodyString(body.sha256, 'sha256');
  const byteLength = requiredBodyNumber(body.byteLength, 'byteLength');
  const contentType = requiredBodyString(body.contentType, 'contentType');
  return omitUndefined<RecordedWalrusFixtureRequest>({
    runId: optionalBodyString(body.runId),
    artifactId: optionalBodyString(body.artifactId),
    correlationId: optionalBodyString(body.correlationId),
    network,
    blobId,
    blobObjectId: optionalBodyString(body.blobObjectId),
    sha256,
    byteLength,
    contentType,
    artifactTextPreview: optionalBodyString(body.artifactTextPreview),
  });
}

function requiredBodyString(value: unknown, name: string): string {
  const parsed = optionalBodyString(value);
  if (parsed === undefined) throw new Error(`${name} is required`);
  return parsed;
}

function requiredBodyNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative safe integer`);
  return value;
}

function optionalBodyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function requireSuiAnchorPackageId(config: TraceLayerConfig): string {
  if (!looksLikeSuiObjectId(config.suiAnchorPackageId)) throw new Error('SUI_ANCHOR_PACKAGE_ID must be a real Sui package ID');
  return config.suiAnchorPackageId;
}

function requireArtifactBlobId(artifact: ArtifactRef): string {
  if (!looksLikeRecordedBlobId(artifact.blobId)) throw new Error('artifact requires a real blobId');
  return artifact.blobId;
}

function omitUndefined<T>(value: { [K in keyof T]: T[K] | undefined }): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function apiTokenResponse(request: Request, config: TraceLayerConfig): Response | undefined {
  if (!config.apiToken) {
    return config.demoMode === 'live' ? jsonResponse({ error: 'live API operations require TRACE_LAYER_API_TOKEN' }, 500) : undefined;
  }
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;
  if (token !== undefined && safeEqual(token, config.apiToken)) return undefined;
  return jsonResponse({ error: 'unauthorized' }, 401);
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function encodePreview(artifact: ArtifactRef): Uint8Array {
  if (artifact.textPreview === undefined) throw new Error('artifact bytes unavailable');
  return new TextEncoder().encode(artifact.textPreview);
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function artifactProjectId(db: TraceLayerDb, artifact: ArtifactRef): string {
  return getAgentRun(db, artifact.runId)?.projectId ?? 'local-demo-project';
}
