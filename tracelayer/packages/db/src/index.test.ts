import { describe, expect, it } from 'vitest';
import type { AgentRun, ArtifactRef } from '@tracelayer/types';
import {
  assembleReplayData,
  createInMemoryTraceLayerDb,
  getArtifact,
  initializeSchema,
  insertAgentRun,
  insertArtifact,
  insertProofEvent,
  listAgentRuns,
  listArtifacts,
  listProofEvents,
  updateArtifactAnchor,
  updateArtifactUpload,
  updateArtifactVerification,
} from './index.js';

const run: AgentRun = {
  runId: 'run-1',
  projectId: 'project-1',
  agentId: 'agent-1',
  ownerAddress: 'local-owner',
  status: 'artifact_generated',
  taskSummary: 'demo',
  inputPreview: 'input',
  previousRunIds: [],
  startedAtMs: 1,
  walrusNetwork: 'local-dry-run',
  suiNetwork: 'local-dry-run',
};

const artifact: ArtifactRef = {
  artifactId: 'artifact-1',
  runId: 'run-1',
  ownerAddress: 'local-owner',
  artifactType: 'markdown_report',
  contentType: 'text/markdown; charset=utf-8',
  byteLength: 5,
  sha256: 'b'.repeat(64),
  walrusNetwork: 'local-dry-run',
  state: 'generated',
  uploadStatus: 'not_uploaded',
  verificationStatus: 'not_checked',
  createdAtMs: 2,
};

describe('db', () => {
  it('stores runs, artifacts, proof events, and replay data', () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);

    insertAgentRun(db, run);
    insertArtifact(db, artifact);
    insertProofEvent(db, {
      proofEventId: 'proof-1',
      correlationId: 'corr-1',
      projectId: 'project-1',
      runId: 'run-1',
      artifactId: 'artifact-1',
      type: 'artifact_generated',
      status: 'succeeded',
      mode: 'dry-run',
      dryRun: true,
      summary: 'generated',
      hashSha256: artifact.sha256,
      metadata: {},
      createdAtMs: 3,
    });

    expect(listAgentRuns(db)).toHaveLength(1);
    expect(listArtifacts(db, 'run-1')).toHaveLength(1);
    expect(listProofEvents(db, { runId: 'run-1' })).toHaveLength(1);
    expect(assembleReplayData(db, 'run-1').chainOfThoughtIncluded).toBe(false);
    db.close();
  });

  it('updates artifact upload and verification metadata', () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    insertAgentRun(db, run);
    insertArtifact(db, artifact);

    const uploaded = updateArtifactUpload(db, artifact.artifactId, {
      state: 'uploaded',
      uploadStatus: 'uploaded',
      blobId: '0x1234567890abcdef1234567890abcdef',
      blobObjectId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      walrusNetwork: 'testnet',
      epochs: 1,
      deletable: true,
      rawWalrusResponse: { kind: 'writeBlob', hasBlobObject: true },
      uploadedAtMs: 4,
    });

    expect(uploaded.blobId).toBe('0x1234567890abcdef1234567890abcdef');
    expect(uploaded.rawWalrusResponse?.kind).toBe('writeBlob');

    const verified = updateArtifactVerification(db, artifact.artifactId, {
      state: 'verified',
      verificationStatus: 'verified',
      verifiedAtMs: 5,
    });

    expect(verified.verificationStatus).toBe('verified');
    expect(getArtifact(db, artifact.artifactId)?.verifiedAtMs).toBe(5);

    const readFailed = updateArtifactVerification(db, artifact.artifactId, {
      state: 'uploaded',
      verificationStatus: 'read_failed',
      rawWalrusResponse: { kind: 'readBlob', error: true },
      verifiedAtMs: 6,
    });

    expect(readFailed.verificationStatus).toBe('read_failed');
    expect(readFailed.rawWalrusResponse?.kind).toBe('readBlob');
    db.close();
  });

  it('updates artifact anchor metadata', () => {
    const db = createInMemoryTraceLayerDb();
    initializeSchema(db);
    insertAgentRun(db, run);
    insertArtifact(db, artifact);

    const submitted = updateArtifactAnchor(db, artifact.artifactId, {
      state: 'anchor_submitted',
      anchorMode: 'wallet-signed',
      claimedOwnerAddress: '0x1234',
    });
    const anchored = updateArtifactAnchor(db, artifact.artifactId, {
      state: 'anchored',
      signerAddress: '0x5678',
      onChainOwnerAddress: '0x5678',
      serviceSigned: false,
      anchorObjectId: `0x${'1'.repeat(64)}`,
      anchorTxDigest: '4f4XSYqgMZMKVvVm8xWKDLV9ZyTqZ6XVBhQCbPrf5D4Z',
      anchoredAtMs: 7,
    });

    expect(submitted.anchorMode).toBe('wallet-signed');
    expect(anchored.state).toBe('anchored');
    expect(anchored.claimedOwnerAddress).toBe('0x1234');
    expect(anchored.signerAddress).toBe('0x5678');
    expect(anchored.serviceSigned).toBe(false);
    expect(anchored.anchorObjectId).toBe(`0x${'1'.repeat(64)}`);
    expect(anchored.anchorTxDigest).toBe('4f4XSYqgMZMKVvVm8xWKDLV9ZyTqZ6XVBhQCbPrf5D4Z');
    expect(anchored.anchoredAtMs).toBe(7);
    db.close();
  });
});
