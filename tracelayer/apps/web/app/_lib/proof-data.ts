import walrusProof from '../../../../fixtures/recorded/walrus-proof.testnet.json' with { type: 'json' };
import suiAnchor from '../../../../fixtures/recorded/sui-anchor-wallet-signed.testnet.json' with { type: 'json' };
import type { Tone } from './proof-labels.js';

export type ProofStepKind =
  | 'artifact_generated'
  | 'walrus_uploaded'
  | 'walrus_readback_verified'
  | 'sui_anchor_wallet_signed'
  | 'proof_event_recorded'
  | 'replay_context_ready'
  | 'delegation_receipt_recorded';

export type ProofStep = {
  kind: ProofStepKind;
  title: string;
  description: string;
  tone: Tone;
  timestampMs: number;
  reference?: string;
};

export type ProofModel = {
  mode: 'recorded';
  network: 'testnet';
  run: {
    runId: string;
    agentId: string;
    ownerAddress: string;
    status: string;
    taskSummary: string;
    inputPreview: string;
    outputSummary: string;
    startedAtMs: number;
    completedAtMs: number;
    correlationId: string;
  };
  artifact: {
    artifactId: string;
    artifactType: string;
    name: string;
    blobId: string;
    blobObjectId: string;
    expectedSha256: string;
    readbackSha256: string;
    byteLength: number;
    contentType: string;
    preview: string;
  };
  anchor: {
    anchorMode: 'wallet-signed';
    serviceSigned: false;
    packageId: string;
    anchorTxDigest: string;
    anchorObjectId: string;
    signerAddress: string;
    connectedWalletAddress: string;
    onChainOwnerAddress: string;
    ownerMatchesWallet: boolean;
    schemaVersion: number;
    createdAtMs: string;
  };
  replay: {
    endpoint: string;
    packetId: string;
    includesPrivateReasoning: false;
    contextRefs: string[];
  };
  delegation: {
    receiptId: string;
    scope: string;
    status: string;
  };
  timeline: ProofStep[];
};

export function buildRecordedProofModel(): ProofModel {
  const capturedAtMs = suiAnchor.capturedAtMs;
  const runId = suiAnchor.runId;
  const artifactId = 'artifact_run_phase_2_5_test';
  const ownerAddress = suiAnchor.connectedWalletAddress;
  const correlationId = suiAnchor.proofEventCorrelationId;

  return {
    mode: 'recorded',
    network: 'testnet',
    run: {
      runId,
      agentId: 'agent_demo',
      ownerAddress,
      status: 'complete',
      taskSummary: 'Generate a non-sensitive artifact lineage report and prove its public storage and anchor path.',
      inputPreview: 'Summarize TraceLayer proof lineage using observable metadata only.',
      outputSummary: 'Produced a markdown report artifact with Walrus readback verification and wallet-signed Sui anchor metadata.',
      startedAtMs: walrusProof.capturedAtMs,
      completedAtMs: capturedAtMs,
      correlationId,
    },
    artifact: {
      artifactId,
      artifactType: suiAnchor.artifactType,
      name: 'artifact_summary.md',
      blobId: walrusProof.blobId,
      blobObjectId: walrusProof.blobObjectId,
      expectedSha256: suiAnchor.artifactHash,
      readbackSha256: walrusProof.sha256,
      byteLength: walrusProof.byteLength,
      contentType: walrusProof.contentType,
      preview: walrusProof.artifactTextPreview,
    },
    anchor: {
      anchorMode: 'wallet-signed',
      serviceSigned: false,
      packageId: suiAnchor.packageId,
      anchorTxDigest: suiAnchor.anchorTxDigest,
      anchorObjectId: suiAnchor.anchorObjectId,
      signerAddress: suiAnchor.signerAddress,
      connectedWalletAddress: suiAnchor.connectedWalletAddress,
      onChainOwnerAddress: suiAnchor.onChainOwnerAddress,
      ownerMatchesWallet: suiAnchor.ownerMatchesWallet,
      schemaVersion: suiAnchor.schemaVersion,
      createdAtMs: suiAnchor.createdAtMs,
    },
    replay: {
      endpoint: replayEndpoint(runId),
      packetId: `replay_${runId}`,
      includesPrivateReasoning: false,
      contextRefs: ['observable inputs', 'artifact metadata', 'Walrus proof', 'Sui anchor', 'proof events'],
    },
    delegation: {
      receiptId: `receipt_${correlationId}`,
      scope: 'read proof trail and replay context metadata',
      status: 'recorded receipt preview',
    },
    timeline: proofTimeline({ runId, artifactId, capturedAtMs, correlationId }),
  };
}

export function replayEndpoint(runId: string): string {
  return `/api/replay/${encodeURIComponent(runId)}`;
}

function proofTimeline(input: { runId: string; artifactId: string; capturedAtMs: number; correlationId: string }): ProofStep[] {
  return [
    {
      kind: 'artifact_generated',
      title: 'artifact_generated',
      description: 'TraceLayer captured observable run metadata and a non-sensitive markdown artifact.',
      tone: 'gray',
      timestampMs: walrusProof.capturedAtMs,
      reference: input.artifactId,
    },
    {
      kind: 'walrus_uploaded',
      title: 'walrus_uploaded',
      description: 'The artifact bytes were uploaded to Walrus and received a real testnet Walrus blob ID.',
      tone: 'cyan',
      timestampMs: walrusProof.capturedAtMs,
      reference: walrusProof.blobId,
    },
    {
      kind: 'walrus_readback_verified',
      title: 'walrus_readback_verified',
      description: 'TraceLayer read the Walrus blob back and matched the SHA-256 artifact hash.',
      tone: 'green',
      timestampMs: walrusProof.capturedAtMs,
      reference: walrusProof.sha256,
    },
    {
      kind: 'sui_anchor_wallet_signed',
      title: 'sui_anchor_wallet_signed',
      description: 'The connected testnet wallet signed the Sui anchor transaction; the on-chain owner matches the wallet address.',
      tone: 'purple',
      timestampMs: input.capturedAtMs,
      reference: suiAnchor.anchorTxDigest,
    },
    {
      kind: 'proof_event_recorded',
      title: 'proof_event_recorded',
      description: 'TraceLayer linked the artifact, Walrus proof, Sui anchor, and correlation ID into one proof trail.',
      tone: 'green',
      timestampMs: input.capturedAtMs,
      reference: input.correlationId,
    },
    {
      kind: 'replay_context_ready',
      title: 'replay_context_ready',
      description: 'Replay context can reconstruct observable run inputs, references, outputs, and proof events without private chain-of-thought.',
      tone: 'cyan',
      timestampMs: input.capturedAtMs,
      reference: input.runId,
    },
    {
      kind: 'delegation_receipt_recorded',
      title: 'delegation_receipt_recorded',
      description: 'A receipt preview shows how scoped proof access can be represented without implementing delegation protocol logic in Phase 4.',
      tone: 'amber',
      timestampMs: input.capturedAtMs,
      reference: input.correlationId,
    },
  ];
}
