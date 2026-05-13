# API Design

## API Style

Use REST for MVP. REST is sufficient for the small endpoint set, easy to demo, and maps cleanly to Next.js route handlers or a Node API service. tRPC can be reconsidered after the MVP if tighter type coupling becomes more valuable than simple HTTP inspectability.

## Common Assumptions

- Auth: local demo identity plus optional connected Sui wallet address.
- `ownerAddress` in request bodies is demo-only and must not be treated as production authentication.
- Wallet-signed Sui anchors should derive owner from the connected wallet signer and on-chain transaction sender.
- Local DB: SQLite operational index.
- Walrus calls: server-side Node runtime only.
- Sui calls: wallet-signed artifact anchors when possible; server-side signer only for service-signed fallback anchors and optional receipt calls.
- Error shape:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

## Endpoint Matrix

| Endpoint | DB | Walrus | Sui | Purpose |
| --- | --- | --- | --- | --- |
| `POST /api/runs/demo` | Write | Optional upload if configured | No | Start demo run and create artifact |
| `GET /api/runs` | Read | No | No | List runs |
| `GET /api/runs/:id` | Read | No | No | Run detail |
| `GET /api/artifacts/:id` | Read | No | No | Artifact metadata |
| `GET /api/artifacts/:id/read` | Read | Read | No | Read Walrus bytes |
| `POST /api/artifacts/:id/verify` | Read/write | Read | No | Verify hash |
| `POST /api/artifacts/:id/anchor` | Read/write | No | Write | Anchor artifact |
| `GET /api/proofs` | Read | No | Optional read | Proof timeline |
| `POST /api/replay/:runId` | Read/write | Optional read | Optional read | Reconstruct context |
| `POST /api/delegates` | Write | No | Optional write | Grant receipt |
| `POST /api/delegates/:id/revoke` | Write | No | Optional write | Revoke receipt |

## `POST /api/runs/demo`

### Request

```json
{
  "projectId": "default",
  "ownerAddress": "0x...",
  "task": "Research Walrus artifact verification patterns",
  "mode": "dry-run-or-real-upload"
}
```

### Response

```json
{
  "run": {
    "runId": "run_...",
    "agentId": "demo-research-agent",
    "status": "artifact_generated",
    "taskSummary": "Research Walrus artifact verification patterns"
  },
  "artifact": {
    "artifactId": "art_...",
    "sha256": "hex...",
    "contentType": "text/markdown",
    "uploadStatus": "not_uploaded"
  },
  "proofEvents": [
    { "type": "run_registered", "status": "succeeded" }
  ]
}
```

### Side Effects

- Generates markdown artifact.
- Computes hash.
- Writes `AgentRun`, `ArtifactRef`, and initial `ProofEvent` records.
- If `mode` requests real upload, may upload to Walrus and update artifact status.

### Error Cases

- `invalid_owner_address`
- `artifact_generation_failed`
- `hash_failed`
- `walrus_upload_failed`
- `db_write_failed`

### Touchpoints

- Auth: local demo identity or wallet address.
- DB: write.
- Walrus: optional write.
- Sui: no.

## `GET /api/runs`

### Request

Query params:

```text
?projectId=default&ownerAddress=0x...&limit=25&cursor=...
```

### Response

```json
{
  "runs": [
    {
      "runId": "run_...",
      "agentId": "demo-research-agent",
      "status": "uploaded",
      "taskSummary": "...",
      "artifactCount": 1,
      "proofEventCount": 3,
      "createdAtMs": 1710000000000
    }
  ],
  "nextCursor": null
}
```

### Side Effects

None.

### Error Cases

- `invalid_query`
- `db_read_failed`

### Touchpoints

- Auth: filter by owner/project.
- DB: read.
- Walrus: no.
- Sui: no.

## `GET /api/runs/:id`

### Response

```json
{
  "run": {},
  "artifacts": [],
  "memoryRefs": [],
  "proofEvents": [],
  "delegates": []
}
```

### Side Effects

None.

### Error Cases

- `run_not_found`
- `not_authorized`
- `db_read_failed`

### Touchpoints

- Auth: owner/project check.
- DB: read.
- Walrus: no.
- Sui: no.

## `GET /api/artifacts/:id`

### Response

```json
{
  "artifact": {
    "artifactId": "art_...",
    "runId": "run_...",
    "artifactType": "markdown_report",
    "contentType": "text/markdown",
    "byteLength": 1234,
    "sha256": "hex...",
    "blobId": "...",
    "blobObjectId": "...",
    "verificationStatus": "verified",
    "anchorTxDigest": "..."
  },
  "proofEvents": []
}
```

### Side Effects

None.

### Error Cases

- `artifact_not_found`
- `not_authorized`
- `db_read_failed`

### Touchpoints

- Auth: owner/project check.
- DB: read.
- Walrus: no.
- Sui: no.

## `GET /api/artifacts/:id/read`

### Response

```json
{
  "artifactId": "art_...",
  "contentType": "text/markdown",
  "text": "# Demo Artifact\n...",
  "sha256": "hex...",
  "verificationStatus": "verified"
}
```

### Side Effects

- May create a local read proof event if the product chooses to show artifact reads.
- Must not mark as verified unless hash comparison succeeds.

### Error Cases

- `artifact_not_found`
- `missing_blob_id`
- `walrus_read_failed`
- `hash_mismatch`
- `decode_failed`

### Touchpoints

- Auth: owner/project check.
- DB: read, optional write.
- Walrus: read.
- Sui: no.

## `POST /api/artifacts/:id/verify`

### Request

```json
{
  "readBack": true
}
```

### Response

```json
{
  "artifactId": "art_...",
  "expectedSha256": "hex...",
  "actualSha256": "hex...",
  "verificationStatus": "verified",
  "proofEventId": "proof_..."
}
```

### Side Effects

- Reads artifact bytes from Walrus.
- Recomputes SHA-256.
- Updates `ArtifactRef.verificationStatus`.
- Writes `artifact_verified` proof event.

### Error Cases

- `artifact_not_found`
- `missing_blob_id`
- `walrus_read_failed`
- `hash_mismatch`
- `db_write_failed`

### Touchpoints

- Auth: owner/project check.
- DB: read/write.
- Walrus: read.
- Sui: no.

## `POST /api/artifacts/:id/anchor`

Supports `anchorMode = "wallet-signed" | "server-signed-fallback"`.

### Request

```json
{
  "anchorMode": "wallet-signed",
  "ownerAddress": "0x...",
  "correlationId": "corr_..."
}
```

For server-signed fallback:

```json
{
  "anchorMode": "server-signed-fallback",
  "ownerAddress": "0x...",
  "correlationId": "corr_..."
}
```

`ownerAddress` is demo-only and may be stored as `claimedOwnerAddress`; it is not production authentication.

### Response

Wallet-signed preparation response:

```json
{
  "artifactId": "art_...",
  "anchorMode": "wallet-signed",
  "correlationId": "corr_...",
  "transactionData": "base64-or-json-transaction-data",
  "status": "anchor_submitted"
}
```

After wallet execution, the frontend calls the same endpoint to record the result:

```json
{
  "anchorMode": "wallet-signed",
  "correlationId": "corr_...",
  "signerAddress": "0x...",
  "anchorTxDigest": "..."
}
```

Final recording response after wallet execution or service-signed fallback:

```json
{
  "artifactId": "art_...",
  "anchorMode": "wallet-signed",
  "signerAddress": "0x..."
  "onChainOwnerAddress": "0x...",
  "anchorTxDigest": "...",
  "anchorObjectId": "0x...",
  "proofEventId": "proof_...",
  "status": "anchored"
}
```

### Side Effects

- Requires artifact status `verified`; `mismatch` and unverified artifacts block anchoring.
- Wallet-signed mode prepares anchor transaction data for the frontend wallet to sign and execute.
- After wallet execution, records the submitted transaction digest, signer address, anchor mode, and indexed anchor result.
- Server-signed fallback mode builds and executes the transaction with the service signer and labels the proof as service-signed.
- Anchor requests are idempotent by `artifactId`; an already anchored artifact returns the existing anchor record.
- Writes `artifact_anchor_submitted`, `artifact_anchored`, or `artifact_anchor_failed` proof events with the same `correlationId`.

### Error Cases

- `artifact_not_found`
- `artifact_not_uploaded`
- `artifact_not_verified`
- `missing_package_id`
- `wallet_signature_rejected`
- `sui_transaction_failed`
- `sui_indexing_timeout`
- `duplicate_tx_digest`
- `db_write_failed`

### Touchpoints

- Auth: owner/project check; `ownerAddress` request field is demo-only.
- DB: read/write.
- Walrus: no direct call.
- Sui: wallet-signed write when possible; service-signed write only for fallback.

## `GET /api/proofs`

### Request

Query params:

```text
?projectId=default&runId=run_...&artifactId=art_...&limit=50
```

### Response

```json
{
  "proofEvents": [
    {
      "proofEventId": "proof_...",
      "type": "artifact_anchored",
      "status": "succeeded",
      "summary": "Artifact anchored on Sui",
      "walrusBlobId": "...",
      "suiTxDigest": "...",
      "createdAtMs": 1710000000000
    }
  ]
}
```

### Side Effects

None, unless `sync=true` is later added to trigger event polling.

### Error Cases

- `invalid_query`
- `db_read_failed`
- `sui_event_query_failed` if live sync is requested in future

### Touchpoints

- Auth: owner/project check.
- DB: read.
- Walrus: no.
- Sui: optional read in future.

## `POST /api/replay/:runId`

### Request

```json
{
  "verifyArtifacts": true,
  "includePreviousRuns": true
}
```

### Response

```json
{
  "replayContext": {
    "runId": "run_...",
    "taskInputPreview": "...",
    "memoryRefs": [],
    "artifactRefs": [],
    "proofEvents": [],
    "previousRunIds": [],
    "verificationSummary": {
      "totalArtifacts": 1,
      "verifiedArtifacts": 1,
      "mismatchedArtifacts": 0,
      "uncheckedArtifacts": 0
    },
    "chainOfThoughtIncluded": false
  },
  "proofEventId": "proof_..."
}
```

### Side Effects

- Optionally verifies artifacts.
- Writes `replay_requested` proof event.
- May cache replay context locally.

### Error Cases

- `run_not_found`
- `not_authorized`
- `artifact_verification_failed`
- `db_write_failed`

### Touchpoints

- Auth: owner/project check.
- DB: read/write.
- Walrus: optional read.
- Sui: optional read for anchor reconciliation.

## `POST /api/delegates`

### Request

```json
{
  "projectId": "default",
  "runId": "run_...",
  "artifactId": "art_...",
  "delegateAddress": "0x...",
  "scope": "artifact",
  "receiptMode": "local-plus-sui"
}
```

### Response

```json
{
  "delegateEvent": {
    "delegateEventId": "del_...",
    "action": "grant",
    "status": "receipt_confirmed",
    "receiptTxDigest": "..."
  },
  "proofEventId": "proof_..."
}
```

### Side Effects

- Writes local delegate grant record.
- Optionally executes Sui receipt event transaction.
- Writes `delegate_granted` proof event.

### Error Cases

- `invalid_delegate_address`
- `scope_not_found`
- `not_authorized`
- `sui_transaction_failed`
- `db_write_failed`

### Touchpoints

- Auth: owner/project check.
- DB: write.
- Walrus: no.
- Sui: optional write.

## `POST /api/delegates/:id/revoke`

### Request

```json
{
  "receiptMode": "local-plus-sui"
}
```

### Response

```json
{
  "delegateEvent": {
    "delegateEventId": "del_revoke_...",
    "action": "revoke",
    "status": "receipt_confirmed",
    "receiptTxDigest": "..."
  },
  "proofEventId": "proof_..."
}
```

### Side Effects

- Writes local revoke record.
- Optionally executes Sui revoke receipt transaction.
- Writes `delegate_revoked` proof event.

### Error Cases

- `delegate_event_not_found`
- `already_revoked`
- `not_authorized`
- `sui_transaction_failed`
- `db_write_failed`

### Touchpoints

- Auth: owner/project check.
- DB: write.
- Walrus: no.
- Sui: optional write.

## Implementation Notes

- All Walrus upload/read operations must run in Node runtime, not Edge runtime.
- Server signer material must never be returned to the browser.
- No endpoint should expose private memory plaintext.
- Anchor endpoints must block when artifact verification failed.
- Anchor endpoints must record `anchorMode`, `signerAddress`, and `correlationId`.
- Sui transaction digests must be unique across successful proof events.
- Server-signed fallback anchors must be labeled as service-signed proof, not user-owned anchors.
- Delegation endpoints should label receipts as proof records, not enforced access control.
