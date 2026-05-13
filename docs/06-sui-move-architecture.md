# Sui Move Architecture

## Role of Sui

Sui provides compact, public proof receipts for TraceLayer. It does not store artifact bytes, private memory contents, full prompts, private chain-of-thought, or large run logs. The local database remains the operational index; Sui anchors are durable verification points.

## Design Principles

- Keep on-chain state minimal.
- Prefer one owned anchor object per important artifact for MVP simplicity.
- Emit query-friendly events for proof trails.
- Store hashes and identifiers, not large metadata.
- Treat every on-chain field as public.
- For MVP, implement `artifact_anchor.move` first; add run registry and permission receipts only after the anchor flow works.
- Keep delegation/revoke semantics as proof receipts in MVP, not actual access enforcement.
- Review Move authorization, ownership, upgrade policy, and event schema manually before publishing.

## Module Overview

| Module | Purpose | MVP Priority |
| --- | --- | --- |
| `artifact_anchor.move` | Anchor Walrus blob ID and artifact hash for a run | Required first |
| `run_registry.move` | Optional run registration and proof-root receipt | After first anchor flow works |
| `permission_receipt.move` | Record delegation and revoke receipt events | After artifact anchor and proof trail work |

## `run_registry.move`

### Purpose

Records that a TraceLayer run exists and optionally stores a run-level proof root. This module is optional after the first `artifact_anchor.move` flow works. The MVP can represent `run_registered` as a local proof event until artifact anchoring is stable.

### Objects

```move
public struct RunRecord has key {
    id: UID,
    owner: address,
    run_id: vector<u8>,
    proof_root_hash: vector<u8>,
    created_at_ms: u64,
    schema_version: u64,
}
```

### Events

```move
public struct RunRegistered has copy, drop {
    run_record_id: ID,
    owner: address,
    run_id: vector<u8>,
    proof_root_hash: vector<u8>,
    created_at_ms: u64,
    schema_version: u64,
}
```

### Entry Functions

```move
public entry fun register_run(
    run_id: vector<u8>,
    proof_root_hash: vector<u8>,
    created_at_ms: u64,
    ctx: &mut TxContext,
)
```

### Stored On-Chain

- Owner address
- Run ID
- Proof root hash
- Created timestamp
- Schema version

### Intentionally Not Stored On-Chain

- Full task input
- Prompt text
- Memory contents
- Artifact bytes
- Tool logs
- Chain-of-thought
- Private run metadata

### Risks

- Public run IDs can leak product or user activity.
- Timestamp source must be reviewed; if using client-provided timestamp, it is not a trusted chain timestamp.
- Proof root canonicalization must be stable before it is relied on.

## `artifact_anchor.move`

### Purpose

Creates a lightweight Sui object/event tying an owner, run ID, Walrus blob ID, artifact hash, artifact type, and timestamp together. This is the only required Move module for the first MVP anchor flow.

### Objects

```move
public struct ArtifactAnchor has key {
    id: UID,
    owner: address,
    run_id: vector<u8>,
    blob_id: vector<u8>,
    artifact_hash: vector<u8>,
    artifact_type: vector<u8>,
    created_at_ms: u64,
    schema_version: u64,
}
```

### Events

```move
public struct ArtifactAnchored has copy, drop {
    anchor_id: ID,
    owner: address,
    run_id: vector<u8>,
    blob_id: vector<u8>,
    artifact_hash: vector<u8>,
    artifact_type: vector<u8>,
    created_at_ms: u64,
    schema_version: u64,
}
```

### Entry Functions

```move
public entry fun anchor_artifact(
    run_id: vector<u8>,
    blob_id: vector<u8>,
    artifact_hash: vector<u8>,
    artifact_type: vector<u8>,
    created_at_ms: u64,
    ctx: &mut TxContext,
)
```

### Stored On-Chain

- Owner address from transaction sender
- Run ID
- Walrus blob ID
- Artifact hash
- Artifact type
- App-created timestamp
- Schema version

### Validation Requirements

The entry function should reject invalid proof metadata before creating the object or emitting the event:
- `run_id <= 64` bytes.
- `blob_id <= 256` bytes.
- `artifact_hash` must be exactly 32 bytes.
- `artifact_type <= 32` bytes.

### Timestamp Semantics

`created_at_ms` is an app-supplied timestamp describing when TraceLayer created the artifact/proof record. It is not a trusted chain timestamp. If the implementation needs chain time, it should explicitly use Sui Clock and document that separate field.

### Intentionally Not Stored On-Chain

- Artifact bytes
- Full markdown report
- Full metadata manifest
- Private prompts
- Private memory references
- Private chain-of-thought
- Raw SDK responses

### Risks

- Blob IDs and artifact hashes are public.
- Artifact type may leak business context.
- If hash canonicalization changes, old anchors remain valid only under their original schema.
- If a server signer submits the transaction, `owner = tx_context::sender(ctx)` makes the service signer the on-chain owner.
- If service-signed fallback needs to display a user address, store it separately as `claimed_owner`; that field is an app claim, not signer proof.

## `permission_receipt.move`

### Purpose

Records proof receipts for delegation and revoke actions. This module is optional after the artifact anchor and proof trail work. In MVP, these receipts do not enforce data access. They provide public proof that the app recorded a grant or revoke action for a run, artifact, or project.

### Objects

The MVP can use events only. If an object is desired for explorer visibility, use a minimal receipt object:

```move
public struct PermissionReceipt has key {
    id: UID,
    owner: address,
    delegate: address,
    action: vector<u8>,
    scope: vector<u8>,
    run_id: vector<u8>,
    artifact_hash: vector<u8>,
    policy_hash: vector<u8>,
    created_at_ms: u64,
    schema_version: u64,
}
```

### Events

```move
public struct DelegateGranted has copy, drop {
    owner: address,
    delegate: address,
    scope: vector<u8>,
    run_id: vector<u8>,
    artifact_hash: vector<u8>,
    policy_hash: vector<u8>,
    created_at_ms: u64,
    schema_version: u64,
}

public struct DelegateRevoked has copy, drop {
    owner: address,
    delegate: address,
    scope: vector<u8>,
    run_id: vector<u8>,
    artifact_hash: vector<u8>,
    policy_hash: vector<u8>,
    created_at_ms: u64,
    schema_version: u64,
}
```

### Entry Functions

```move
public entry fun grant_delegate(
    delegate: address,
    scope: vector<u8>,
    run_id: vector<u8>,
    artifact_hash: vector<u8>,
    policy_hash: vector<u8>,
    created_at_ms: u64,
    ctx: &mut TxContext,
)

public entry fun revoke_delegate(
    delegate: address,
    scope: vector<u8>,
    run_id: vector<u8>,
    artifact_hash: vector<u8>,
    policy_hash: vector<u8>,
    created_at_ms: u64,
    ctx: &mut TxContext,
)
```

### Stored On-Chain

- Owner address
- Delegate address
- Scope
- Run ID or artifact hash
- Policy hash
- Created timestamp
- Schema version

### Intentionally Not Stored On-Chain

- Access tokens
- Encryption keys
- Private policy text
- Private artifact content
- Private memory contents

### Proof Receipt vs Access Control

A permission receipt proves that a grant or revoke event was recorded. It does not prove that the delegate technically could or could not read data. Actual access control requires encrypted artifacts and key/policy enforcement, which is future work with Seal or a MemWal-style integration.

### Risks

- Public delegate addresses may reveal collaboration relationships.
- Revoke receipts cannot remove already-seen plaintext.
- Without encryption, revoke is a product-state claim, not cryptographic enforcement.

## Ownership Semantics

If `ArtifactAnchor.owner` is set from `tx_context::sender(ctx)`, the owner is the transaction signer:
- Wallet-signed anchor: owner is the connected user's wallet.
- Server-signed fallback anchor: owner is the TraceLayer service signer.

A server-signed fallback anchor proves the service recorded the blob ID and artifact hash. It must not be described as user-owned unless the user wallet actually signed the transaction.

## PTB Pseudocode

```ts
import { Transaction } from '@mysten/sui/transactions';

const tx = new Transaction();

tx.moveCall({
  target: `${packageId}::artifact_anchor::anchor_artifact`,
  arguments: [
    tx.pure.vector('u8', utf8Bytes(runId)),
    tx.pure.vector('u8', utf8Bytes(blobId)),
    tx.pure.vector('u8', hexToBytes(artifactHashSha256)),
    tx.pure.vector('u8', utf8Bytes(artifactType)),
    tx.pure.u64(createdAtMs),
  ],
});

const result = await client.signAndExecuteTransaction({
  signer,
  transaction: tx,
});

if (result.$kind === 'FailedTransaction') {
  throw new Error('Artifact anchor transaction failed');
}

await client.waitForTransaction({ digest: result.digest });
```

TODO verify against official docs before use:
- Current transaction execution response shape.
- Exact failed transaction discriminator.
- Current `waitForTransaction` method location for the selected client.
- Whether `vector<u8>` is the best representation or if `String` should be used for some fields.

## Event Polling / Indexing

MVP event polling can query events by package/module/type and persist cursor state locally.

Polling responsibilities:
- Backfill recent `ArtifactAnchored`, `DelegateGranted`, and `DelegateRevoked` events.
- De-duplicate by event ID or transaction digest plus event sequence.
- Reconcile local proof events with Sui transaction status.
- Surface failed or missing anchor events in the UI.

Production indexing should use a dedicated indexer or checkpoint stream.

## Upgrade and Package ID Assumptions

- MVP can publish one testnet package and store `PACKAGE_ID` in server environment config.
- Package ID must not be hardcoded in frontend source unless it is public config.
- Upgrade capability custody must be reviewed by the human maintainer.
- Event schema should include `schema_version` so old receipts remain interpretable.

## Human Review Required

Before publishing contracts, review:
- Object abilities and transfer semantics.
- Whether anchors should be owned, shared, or event-only.
- Authorization and UI labeling for wallet-signed anchors vs service-signed fallback anchors.
- Event field types and query patterns.
- Package upgrade policy.
- Sensitive metadata leakage.
- Gas costs and sponsored transaction policy.
