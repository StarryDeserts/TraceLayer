# Data Model

## Modeling Principles

- The local database is the operational source of truth for UI queries.
- Walrus is the source of truth for artifact bytes once uploaded and certified.
- Sui is the source of truth for compact proof receipts after transactions are finalized and indexed.
- Hashes are computed over exact uploaded bytes.
- Private memory contents and private chain-of-thought are never stored in TraceLayer MVP records.
- Future encrypted artifacts must be encrypted before Walrus upload.

## Entity Overview

| Entity | MVP Role | Primary Storage | Public/Private |
| --- | --- | --- | --- |
| `UserProject` | Groups local runs and settings | Local DB | Mostly private/local |
| `AgentRun` | Core run timeline item | Local DB, optional Sui event | Mixed metadata |
| `ArtifactRef` | Links run to Walrus artifact | Local DB, Walrus, optional Sui anchor | Public identifiers, artifact privacy depends on content |
| `MemoryRef` | References external memory without plaintext | Local DB | Private/local by default |
| `ProofEvent` | Timeline of proof actions | Local DB, some mirrored on Sui | Mixed; Sui proofs public |
| `DelegateEvent` | Grant/revoke receipt | Local DB, optional Sui receipt | Public receipt, private policy details offchain |
| `ReplayContext` | Derived reconstruction view | Derived from DB + Walrus + Sui | Private/local view |

## `UserProject`

```ts
type UserProject = {
  projectId: string;
  ownerAddress: string;
  name: string;
  description?: string;
  createdAtMs: number;
  updatedAtMs: number;
  defaultWalrusNetwork: 'testnet' | 'mainnet' | 'devnet' | 'localnet';
  defaultSuiNetwork: 'testnet' | 'mainnet' | 'devnet' | 'localnet';
};
```

| Property | Classification |
| --- | --- |
| Source of truth | Local DB |
| Stored locally | Yes |
| Stored on Walrus | No |
| Stored on Sui | No |
| Public/private | Private/local project metadata |
| Hash requirements | None in MVP |
| Future encryption | Encrypt hosted project metadata if multi-tenant |

## `AgentRun`

```ts
type AgentRun = {
  runId: string;
  projectId: string;
  agentId: string;
  agentVersion?: string;
  ownerAddress: string;
  status: 'created' | 'running' | 'artifact_generated' | 'uploaded' | 'anchored' | 'failed';
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
```

| Property | Classification |
| --- | --- |
| Source of truth | Local DB; optional Sui run receipt/event for proof root |
| Stored locally | Yes |
| Stored on Walrus | Only if included in a future proof manifest |
| Stored on Sui | Run ID and proof root only if registered |
| Public/private | Mixed; task summaries can leak sensitive context and should be sanitized |
| Hash requirements | `inputHashSha256` for sanitized input bytes; `artifactManifestHashSha256` for artifact manifest |
| Future encryption | Encrypt full input bundle before Walrus upload; store only hash/ref locally for private runs |

## `ArtifactRef`

```ts
type ArtifactRef = {
  artifactId: string;
  runId: string;
  ownerAddress: string;
  artifactType: 'markdown_report' | 'tool_output' | 'manifest' | 'screenshot' | 'patch' | 'other';
  contentType: string;
  byteLength: number;
  sha256: string;
  blobId?: string;
  blobObjectId?: string;
  walrusNetwork: string;
  epochs?: number;
  deletable?: boolean;
  uploadStatus: 'not_uploaded' | 'uploading' | 'uploaded' | 'upload_failed';
  verificationStatus: 'not_checked' | 'verified' | 'mismatch' | 'read_failed';
  anchorObjectId?: string;
  anchorTxDigest?: string;
  createdAtMs: number;
  uploadedAtMs?: number;
  verifiedAtMs?: number;
  anchoredAtMs?: number;
};
```

| Property | Classification |
| --- | --- |
| Source of truth | Local DB for operational index; Walrus for bytes; Sui for anchor after transaction |
| Stored locally | Yes |
| Stored on Walrus | Artifact bytes |
| Stored on Sui | Owner, run ID, blob ID, hash, type, timestamp |
| Public/private | Blob ID and anchor are public; artifact bytes may be public if not encrypted |
| Hash requirements | SHA-256 over exact uploaded bytes is required |
| Future encryption | Encrypt bytes before upload and hash ciphertext or record both plaintext/ciphertext hash policy explicitly |

## `MemoryRef`

```ts
type MemoryRef = {
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
```

| Property | Classification |
| --- | --- |
| Source of truth | Local DB or external memory provider |
| Stored locally | Reference metadata only |
| Stored on Walrus | No plaintext private memory in MVP |
| Stored on Sui | No |
| Public/private | Private by default; labels can leak context |
| Hash requirements | Hash external/sanitized reference manifests when replay depends on them |
| Future encryption | Use encrypted memory manifests and external policy-bound access |

## `ProofEvent`

```ts
type ProofEvent = {
  proofEventId: string;
  projectId: string;
  runId?: string;
  artifactId?: string;
  delegateEventId?: string;
  type:
    | 'run_registered'
    | 'artifact_uploaded'
    | 'artifact_verified'
    | 'artifact_anchor_submitted'
    | 'artifact_anchored'
    | 'replay_requested'
    | 'delegate_granted'
    | 'delegate_revoked';
  status: 'pending' | 'succeeded' | 'failed';
  summary: string;
  walrusBlobId?: string;
  suiObjectId?: string;
  suiTxDigest?: string;
  hashSha256?: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAtMs: number;
};
```

| Property | Classification |
| --- | --- |
| Source of truth | Local DB; Sui events for on-chain actions |
| Stored locally | Yes |
| Stored on Walrus | Optional future proof manifest |
| Stored on Sui | Event subset for anchor/delegate/revoke |
| Public/private | Public if mirrored on Sui; local-only proof events can contain private operational metadata |
| Hash requirements | Include artifact hash for upload/verify/anchor events |
| Future encryption | Private proof details can move to encrypted Walrus manifests with public hash anchors |

## `DelegateEvent`

```ts
type DelegateEvent = {
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
```

| Property | Classification |
| --- | --- |
| Source of truth | Local DB for MVP; Sui receipt event/object for proof |
| Stored locally | Yes |
| Stored on Walrus | Optional encrypted policy manifest in future |
| Stored on Sui | Delegate/revoke receipt metadata only |
| Public/private | Delegate address and scope become public if anchored on Sui |
| Hash requirements | Hash policy details if they are too sensitive or large to store directly |
| Future encryption | Enforce actual access with Seal/MemWal instead of receipt-only semantics |

## `ReplayContext`

```ts
type ReplayContext = {
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
```

| Property | Classification |
| --- | --- |
| Source of truth | Derived from local DB, Walrus readback, and Sui receipts |
| Stored locally | Can be cached, but derivable |
| Stored on Walrus | No in MVP |
| Stored on Sui | No |
| Public/private | Private/local UI view unless exported |
| Hash requirements | Can include proof root over included refs in future |
| Future encryption | Exported replay bundles should be encrypted if they include private input summaries or memory labels |

## Core MVP Entities

The MVP implementation should prioritize:
1. `AgentRun`
2. `ArtifactRef`
3. `ProofEvent`

`MemoryRef`, `DelegateEvent`, and `ReplayContext` can start minimal but must exist conceptually so the demo can show replay and delegation without changing the architecture later.

## Hash Policy

- Text artifacts: encode as UTF-8 bytes, hash exact bytes.
- JSON artifacts: deterministic serialization before hashing.
- Binary artifacts: hash raw bytes.
- Multi-artifact runs: hash each artifact, then hash a deterministic manifest containing artifact IDs, hashes, content types, byte lengths, blob IDs, and parent artifact IDs.

## Privacy Policy

- Do not store private chain-of-thought.
- Do not upload private memory plaintext.
- Treat Walrus blob bytes as public unless encrypted before upload.
- Treat Sui object/event fields as public forever.
- Keep input previews sanitized and short.
