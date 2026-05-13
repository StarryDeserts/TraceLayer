import { describe, expect, it } from 'vitest';
import type { ArtifactRef, ProofEvent } from '@tracelayer/types';
import {
  assembleReplayContext,
  assertUniqueTxDigests,
  canAnchorArtifact,
  canVerifyArtifact,
  createArtifactProofEvent,
  createCorrelationId,
  createProofEvent,
  hasUniqueTxDigests,
  transitionArtifactState,
} from './index.js';

const artifact: ArtifactRef = {
  artifactId: 'artifact-1',
  runId: 'run-1',
  ownerAddress: 'local-owner',
  artifactType: 'markdown_report',
  contentType: 'text/markdown; charset=utf-8',
  byteLength: 10,
  sha256: 'a'.repeat(64),
  walrusNetwork: 'local-dry-run',
  state: 'generated',
  uploadStatus: 'not_uploaded',
  verificationStatus: 'not_checked',
  createdAtMs: 1,
};

describe('proof helpers', () => {
  it('creates correlation IDs', () => {
    expect(createCorrelationId()).toMatch(/^corr_/);
  });

  it('requires correlation ID for proof events', () => {
    expect(() =>
      createProofEvent({
        correlationId: '',
        projectId: 'project-1',
        type: 'run_registered',
        status: 'succeeded',
        mode: 'dry-run',
        summary: 'registered',
      }),
    ).toThrow(/correlationId/);
  });

  it('rejects dry-run public proof IDs', () => {
    expect(() =>
      createProofEvent({
        correlationId: 'corr-1',
        projectId: 'project-1',
        type: 'artifact_uploaded',
        status: 'succeeded',
        mode: 'dry-run',
        summary: 'uploaded',
        walrusBlobId: 'fake-blob-id',
      }),
    ).toThrow(/dry-run proof event/);
    expect(() =>
      createProofEvent({
        correlationId: 'corr-1',
        projectId: 'project-1',
        type: 'artifact_anchored',
        status: 'succeeded',
        mode: 'dry-run',
        summary: 'anchored',
        suiObjectId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      }),
    ).toThrow(/dry-run proof event/);
  });

  it('does not verify without a real blob ID', () => {
    const uploaded = { ...artifact, state: 'uploaded' as const };

    expect(canVerifyArtifact(uploaded)).toBe(false);
    expect(() => transitionArtifactState(uploaded, 'verified')).toThrow(/cannot verify/);
  });

  it('does not anchor unless verified', () => {
    const uploaded = {
      ...artifact,
      state: 'uploaded' as const,
      uploadStatus: 'uploaded' as const,
      blobId: '0x1234567890abcdef1234567890abcdef',
    };

    expect(canAnchorArtifact(uploaded)).toBe(false);
    expect(() => transitionArtifactState(uploaded, 'anchor_submitted')).toThrow(/cannot anchor/);
  });

  it('anchors only verified artifacts', () => {
    const verified = {
      ...artifact,
      state: 'verified' as const,
      uploadStatus: 'uploaded' as const,
      verificationStatus: 'verified' as const,
      blobId: '0x1234567890abcdef1234567890abcdef',
    };

    expect(canAnchorArtifact(verified)).toBe(true);
    expect(transitionArtifactState(verified, 'anchored').state).toBe('anchored');
  });

  it('creates anchor proof events with correlation and Sui fields', () => {
    const event = createArtifactProofEvent({
      correlationId: 'corr-anchor',
      projectId: 'project-1',
      runId: 'run-1',
      artifactId: 'artifact-1',
      type: 'artifact_anchored',
      mode: 'live',
      summary: 'anchored',
      anchorMode: 'wallet-signed',
      signerAddress: `0x${'1'.repeat(64)}`,
      onChainOwnerAddress: `0x${'1'.repeat(64)}`,
      walrusBlobId: '0x1234567890abcdef1234567890abcdef',
      suiObjectId: `0x${'2'.repeat(64)}`,
      suiTxDigest: '4f4XSYqgMZMKVvVm8xWKDLV9ZyTqZ6XVBhQCbPrf5D4Z',
      hashSha256: artifact.sha256,
      metadata: { packageId: `0x${'3'.repeat(64)}` },
    });

    expect(event.correlationId).toBe('corr-anchor');
    expect(event.anchorMode).toBe('wallet-signed');
    expect(event.suiTxDigest).toBe('4f4XSYqgMZMKVvVm8xWKDLV9ZyTqZ6XVBhQCbPrf5D4Z');
  });

  it('checks tx digest uniqueness', () => {
    const events: ProofEvent[] = [
      createProofEvent({
        proofEventId: 'proof-1',
        correlationId: 'corr-1',
        projectId: 'project-1',
        type: 'artifact_anchored',
        status: 'succeeded',
        mode: 'recorded',
        summary: 'anchored',
        suiTxDigest: '4f4XSYqgMZMKVvVm8xWKDLV9ZyTqZ6XVBhQCbPrf5D4Z',
      }),
      createProofEvent({
        proofEventId: 'proof-2',
        correlationId: 'corr-2',
        projectId: 'project-1',
        type: 'artifact_anchored',
        status: 'succeeded',
        mode: 'recorded',
        summary: 'anchored again',
        suiTxDigest: '4f4XSYqgMZMKVvVm8xWKDLV9ZyTqZ6XVBhQCbPrf5D4Z',
      }),
    ];

    expect(hasUniqueTxDigests(events)).toBe(false);
    expect(() => assertUniqueTxDigests(events)).toThrow(/duplicate tx digest/);
  });

  it('assembles replay context without chain of thought', () => {
    const context = assembleReplayContext({
      runId: 'run-1',
      taskInputPreview: 'input',
      previousRunIds: [],
      artifactRefs: [artifact],
      proofEvents: [],
    });

    expect(context.chainOfThoughtIncluded).toBe(false);
    expect(context.verificationSummary.uncheckedArtifacts).toBe(1);
  });
});
