import { randomUUID } from 'node:crypto';
import {
  assertNoDryRunPublicProofIds,
  isPlaceholderPublicProofId,
  looksLikeRecordedBlobId,
  looksLikeSuiTxDigest,
} from '@tracelayer/config';
import type { AnchorMode, ArtifactRef, ArtifactState, JsonMetadata, ProofEvent, ProofEventStatus, ProofEventType, ProofMode, ReplayContext } from '@tracelayer/types';

export type CreateProofEventInput = Omit<ProofEvent, 'proofEventId' | 'createdAtMs' | 'metadata'> & {
  proofEventId?: string;
  createdAtMs?: number;
  metadata?: ProofEvent['metadata'];
};

const uploadableStates = new Set<ArtifactState>(['generated', 'upload_pending', 'upload_failed']);
const verifiableStates = new Set<ArtifactState>(['uploaded', 'verifying', 'mismatch']);
const anchorableStates = new Set<ArtifactState>(['verified']);

export function createCorrelationId(prefix = 'corr'): string {
  return `${prefix}_${randomUUID()}`;
}

export function canUploadArtifact(artifact: Pick<ArtifactRef, 'state' | 'blobId'>): boolean {
  return uploadableStates.has(artifact.state) && artifact.blobId === undefined;
}

export function canVerifyArtifact(artifact: Pick<ArtifactRef, 'state' | 'blobId'>): boolean {
  return verifiableStates.has(artifact.state) && looksLikeRecordedBlobId(artifact.blobId);
}

export function canAnchorArtifact(artifact: Pick<ArtifactRef, 'state' | 'blobId' | 'verificationStatus'>): boolean {
  return anchorableStates.has(artifact.state) && artifact.verificationStatus === 'verified' && looksLikeRecordedBlobId(artifact.blobId);
}

export function assertCanVerifyArtifact(artifact: Pick<ArtifactRef, 'state' | 'blobId'>): void {
  if (!canVerifyArtifact(artifact)) {
    throw new Error('cannot verify artifact without uploaded state and real blobId');
  }
}

export function assertCanAnchorArtifact(artifact: Pick<ArtifactRef, 'state' | 'blobId' | 'verificationStatus'>): void {
  if (!canAnchorArtifact(artifact)) {
    throw new Error('cannot anchor artifact unless it is verified and has a real blobId');
  }
}

export function assertDryRunHasNoPublicProofIds(value: {
  mode?: ProofMode;
  blobId?: string;
  txDigest?: string;
  walrusBlobId?: string;
  suiTxDigest?: string;
  suiObjectId?: string;
}): void {
  if (value.mode !== 'dry-run') return;
  if (value.suiObjectId !== undefined) throw new Error('dry-run config must not include Sui object IDs');
  assertNoDryRunPublicProofIds({
    demoMode: 'dry-run',
    ...(value.blobId ?? value.walrusBlobId ? { recordedBlobId: value.blobId ?? value.walrusBlobId } : {}),
    ...(value.txDigest ?? value.suiTxDigest ? { recordedTxDigest: value.txDigest ?? value.suiTxDigest } : {}),
  });
}

export function createProofEvent(input: CreateProofEventInput): ProofEvent {
  if (input.correlationId.trim().length === 0) {
    throw new Error('proof event requires correlationId');
  }
  if (input.mode === 'dry-run' && (input.walrusBlobId !== undefined || input.suiTxDigest !== undefined || input.suiObjectId !== undefined)) {
    throw new Error('dry-run proof event must not include public proof identifiers');
  }
  if (input.mode !== 'dry-run' && input.walrusBlobId !== undefined && !looksLikeRecordedBlobId(input.walrusBlobId)) {
    throw new Error('proof event blobId must be real-looking');
  }
  if (input.mode !== 'dry-run' && input.suiTxDigest !== undefined && !looksLikeSuiTxDigest(input.suiTxDigest)) {
    throw new Error('proof event tx digest must be real-looking');
  }
  if (isPlaceholderPublicProofId(input.suiObjectId)) {
    throw new Error('proof event Sui object ID must not be placeholder or fake');
  }

  return {
    ...input,
    proofEventId: input.proofEventId ?? `proof_${randomUUID()}`,
    metadata: input.metadata ?? {},
    createdAtMs: input.createdAtMs ?? Date.now(),
  };
}

export function assertUniqueTxDigests(events: readonly Pick<ProofEvent, 'proofEventId' | 'suiTxDigest'>[]): void {
  const seen = new Map<string, string>();
  for (const event of events) {
    if (event.suiTxDigest === undefined) continue;
    const prior = seen.get(event.suiTxDigest);
    if (prior !== undefined) {
      throw new Error(`duplicate tx digest ${event.suiTxDigest} in ${prior} and ${event.proofEventId}`);
    }
    seen.set(event.suiTxDigest, event.proofEventId);
  }
}

export function hasUniqueTxDigests(events: readonly Pick<ProofEvent, 'suiTxDigest'>[]): boolean {
  const digests = events.flatMap((event) => (event.suiTxDigest === undefined ? [] : [event.suiTxDigest]));
  return new Set(digests).size === digests.length;
}

export function transitionArtifactState(artifact: ArtifactRef, nextState: ArtifactState): ArtifactRef {
  const allowed: Record<ArtifactState, readonly ArtifactState[]> = {
    generated: ['upload_pending', 'uploaded', 'upload_failed', 'replay_requested'],
    upload_pending: ['uploading', 'upload_failed', 'replay_requested'],
    uploading: ['uploaded', 'upload_failed'],
    uploaded: ['verifying', 'verified', 'mismatch', 'anchor_submitted', 'replay_requested'],
    upload_failed: ['upload_pending', 'replay_requested'],
    verifying: ['verified', 'mismatch'],
    verified: ['anchor_submitted', 'anchored', 'replay_requested'],
    mismatch: ['verifying', 'replay_requested'],
    anchor_submitted: ['anchored', 'anchor_failed'],
    anchored: ['replay_requested'],
    anchor_failed: ['anchor_submitted', 'replay_requested'],
    replay_requested: [],
  };

  if (!allowed[artifact.state].includes(nextState)) {
    throw new Error(`invalid artifact state transition ${artifact.state} -> ${nextState}`);
  }
  if (nextState === 'verifying' || nextState === 'verified') assertCanVerifyArtifact({ ...artifact, state: 'uploaded' });
  if (nextState === 'anchor_submitted') assertCanAnchorArtifact(artifact);
  if (nextState === 'anchored' && artifact.state !== 'anchor_submitted') assertCanAnchorArtifact(artifact);
  return { ...artifact, state: nextState };
}

export function createArtifactProofEvent(input: {
  projectId: string;
  runId: string;
  artifactId: string;
  type: ProofEventType;
  status?: ProofEventStatus;
  mode: ProofMode;
  summary: string;
  correlationId?: string;
  walrusBlobId?: string;
  hashSha256?: string;
  anchorMode?: AnchorMode;
  signerAddress?: string;
  claimedOwnerAddress?: string;
  onChainOwnerAddress?: string;
  suiObjectId?: string;
  suiTxDigest?: string;
  metadata?: JsonMetadata;
  createdAtMs?: number;
}): ProofEvent {
  return createProofEvent({
    correlationId: input.correlationId ?? createCorrelationId(),
    projectId: input.projectId,
    runId: input.runId,
    artifactId: input.artifactId,
    type: input.type,
    status: input.status ?? 'succeeded',
    mode: input.mode,
    dryRun: input.mode === 'dry-run',
    recorded: input.mode === 'recorded',
    summary: input.summary,
    ...(input.walrusBlobId ? { walrusBlobId: input.walrusBlobId } : {}),
    ...(input.hashSha256 ? { hashSha256: input.hashSha256 } : {}),
    ...(input.anchorMode ? { anchorMode: input.anchorMode } : {}),
    ...(input.signerAddress ? { signerAddress: input.signerAddress } : {}),
    ...(input.claimedOwnerAddress ? { claimedOwnerAddress: input.claimedOwnerAddress } : {}),
    ...(input.onChainOwnerAddress ? { onChainOwnerAddress: input.onChainOwnerAddress } : {}),
    ...(input.suiObjectId ? { suiObjectId: input.suiObjectId } : {}),
    ...(input.suiTxDigest ? { suiTxDigest: input.suiTxDigest } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
    ...(input.createdAtMs ? { createdAtMs: input.createdAtMs } : {}),
  });
}

export function assembleReplayContext(input: {
  runId: string;
  taskInputPreview: string;
  inputHashSha256?: string;
  previousRunIds: string[];
  memoryRefs?: ReplayContext['memoryRefs'];
  artifactRefs: ArtifactRef[];
  proofEvents: ProofEvent[];
  generatedAtMs?: number;
  replayContextId?: string;
}): ReplayContext {
  const verifiedArtifacts = input.artifactRefs.filter((artifact) => artifact.verificationStatus === 'verified').length;
  const mismatchedArtifacts = input.artifactRefs.filter((artifact) => artifact.verificationStatus === 'mismatch').length;
  return {
    replayContextId: input.replayContextId ?? `replay_${randomUUID()}`,
    runId: input.runId,
    generatedAtMs: input.generatedAtMs ?? Date.now(),
    taskInputPreview: input.taskInputPreview,
    ...(input.inputHashSha256 ? { inputHashSha256: input.inputHashSha256 } : {}),
    memoryRefs: input.memoryRefs ?? [],
    artifactRefs: input.artifactRefs,
    proofEvents: input.proofEvents,
    previousRunIds: input.previousRunIds,
    verificationSummary: {
      totalArtifacts: input.artifactRefs.length,
      verifiedArtifacts,
      mismatchedArtifacts,
      uncheckedArtifacts: input.artifactRefs.length - verifiedArtifacts - mismatchedArtifacts,
    },
    chainOfThoughtIncluded: false,
  };
}
