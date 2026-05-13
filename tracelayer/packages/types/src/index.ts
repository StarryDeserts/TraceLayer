export type ProofMode = 'live' | 'recorded' | 'dry-run';
export type AnchorMode = 'wallet-signed' | 'server-signed-fallback';

export type ArtifactState =
  | 'generated'
  | 'upload_pending'
  | 'uploading'
  | 'uploaded'
  | 'upload_failed'
  | 'verifying'
  | 'verified'
  | 'mismatch'
  | 'anchor_submitted'
  | 'anchored'
  | 'anchor_failed'
  | 'replay_requested';

export type ProofEventType =
  | 'run_registered'
  | 'artifact_generated'
  | 'artifact_uploaded'
  | 'artifact_verified'
  | 'artifact_anchor_submitted'
  | 'artifact_anchored'
  | 'artifact_anchor_failed'
  | 'replay_requested'
  | 'delegate_granted'
  | 'delegate_revoked';

export type ProofEventStatus = 'pending' | 'succeeded' | 'failed';
export type AgentRunStatus = 'created' | 'running' | 'artifact_generated' | 'uploaded' | 'anchored' | 'failed';
export type UploadStatus = 'not_uploaded' | 'upload_pending' | 'uploading' | 'uploaded' | 'upload_failed';
export type VerificationStatus = 'not_checked' | 'verifying' | 'verified' | 'mismatch' | 'read_failed';
export type ArtifactType = 'markdown_report' | 'tool_output' | 'manifest' | 'screenshot' | 'patch' | 'other';

export type JsonMetadata = Record<string, string | number | boolean | null>;

export type AgentRun = {
  runId: string;
  projectId: string;
  agentId: string;
  agentVersion?: string;
  ownerAddress: string;
  status: AgentRunStatus;
  taskSummary: string;
  inputPreview: string;
  inputHashSha256?: string;
  outputSummary?: string;
  artifactManifestHashSha256?: string;
  previousRunIds: string[];
  startedAtMs: number;
  completedAtMs?: number;
  walrusNetwork: string;
  suiNetwork: string;
  errorSummary?: string;
};

export type ArtifactRef = {
  artifactId: string;
  runId: string;
  ownerAddress: string;
  artifactType: ArtifactType;
  contentType: string;
  byteLength: number;
  sha256: string;
  blobId?: string;
  blobObjectId?: string;
  walrusNetwork: string;
  epochs?: number;
  deletable?: boolean;
  state: ArtifactState;
  uploadStatus: UploadStatus;
  verificationStatus: VerificationStatus;
  anchorMode?: AnchorMode;
  signerAddress?: string;
  claimedOwnerAddress?: string;
  onChainOwnerAddress?: string;
  serviceSigned?: boolean;
  anchorObjectId?: string;
  anchorTxDigest?: string;
  rawWalrusResponse?: JsonMetadata;
  textPreview?: string;
  createdAtMs: number;
  uploadedAtMs?: number;
  verifiedAtMs?: number;
  anchoredAtMs?: number;
};

export type MemoryRef = {
  memoryRefId: string;
  runId: string;
  provider: 'local' | 'memwal' | 'external' | 'manual';
  label: string;
  description?: string;
  refUri?: string;
  refHashSha256?: string;
  accessLevel: 'private' | 'delegated' | 'public_reference';
  createdAtMs: number;
};

export type ProofEvent = {
  proofEventId: string;
  correlationId: string;
  projectId: string;
  runId?: string;
  artifactId?: string;
  delegateEventId?: string;
  type: ProofEventType;
  status: ProofEventStatus;
  mode: ProofMode;
  anchorMode?: AnchorMode;
  signerAddress?: string;
  claimedOwnerAddress?: string;
  onChainOwnerAddress?: string;
  dryRun?: boolean;
  recorded?: boolean;
  summary: string;
  walrusBlobId?: string;
  suiObjectId?: string;
  suiTxDigest?: string;
  hashSha256?: string;
  metadata: JsonMetadata;
  createdAtMs: number;
};

export type DelegateEvent = {
  delegateEventId: string;
  projectId: string;
  runId?: string;
  artifactId?: string;
  ownerAddress: string;
  delegateAddress: string;
  action: 'grant' | 'revoke';
  scope: 'run' | 'artifact' | 'project';
  policyHashSha256?: string;
  receiptTxDigest?: string;
  receiptObjectId?: string;
  status: 'local_recorded' | 'receipt_submitted' | 'receipt_confirmed' | 'failed';
  createdAtMs: number;
};

export type ReplayContext = {
  replayContextId: string;
  runId: string;
  generatedAtMs: number;
  taskInputPreview: string;
  inputHashSha256?: string;
  memoryRefs: MemoryRef[];
  artifactRefs: ArtifactRef[];
  proofEvents: ProofEvent[];
  previousRunIds: string[];
  verificationSummary: {
    totalArtifacts: number;
    verifiedArtifacts: number;
    mismatchedArtifacts: number;
    uncheckedArtifacts: number;
  };
  chainOfThoughtIncluded: false;
};
