# Walrus Integration

## Role of Walrus

Walrus stores durable artifact bytes for agent runs. TraceLayer uses Walrus as the availability layer and Sui as the compact proof anchor layer. The app database maps run IDs and artifact IDs to Walrus blob IDs, Sui blob object IDs when available, artifact hashes, proof states, and proof events.

Walrus data should be treated as public/discoverable by default. Sensitive artifacts must be encrypted or redacted before upload.

## Server-Side MVP Upload Flow

1. Demo runner produces a markdown artifact.
2. API serializes the artifact to deterministic UTF-8 bytes.
3. API computes SHA-256 over the exact bytes to upload.
4. API initializes the Walrus-enabled Sui client in a Node runtime.
5. API uploads bytes using `client.walrus.writeBlob(...)`.
6. API persists:
   - App artifact ID
   - Run ID
   - Walrus network
   - Sui network
   - Walrus blob ID
   - Sui blob object ID if returned
   - SHA-256 hash
   - Content type
   - Byte length
   - Epochs
   - Deletable/permanent flag
   - Raw SDK response summary
   - Upload proof event
7. API creates an upload proof event with a `correlationId`.
8. API optionally reads the blob back.
9. API recomputes SHA-256 and records verification status.

## Client Initialization Assumption

Current expected pattern:

```ts
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { walrus } from '@mysten/walrus';

const client = new SuiGrpcClient({
  network: 'testnet',
  baseUrl: process.env.SUI_GRPC_URL!,
}).$extend(
  walrus({
    uploadRelay: {
      host: process.env.WALRUS_UPLOAD_RELAY_URL!,
      sendTip: {
        max: 1_000,
      },
    },
  }),
);
```

TODO verify against official docs before use:
- Exact package versions.
- Whether the environment variable should point to `SUI_GRPC_URL`, a fullnode URL, or another documented endpoint.
- Exact `walrus()` options for upload relay, storage-node timeouts, WASM URL, and package config.
- Current upload relay tip configuration shape.

## Upload Pseudocode

```ts
type UploadArtifactInput = {
  runId: string;
  artifactId: string;
  contentType: 'text/markdown';
  bytes: Uint8Array;
};

async function uploadArtifact(input: UploadArtifactInput) {
  const sha256 = await sha256Hex(input.bytes);

  const result = await client.walrus.writeBlob({
    // TODO verify against official docs before use: current docs have shown both `blob` and `bl` in examples.
    blob: input.bytes,
    deletable: true,
    epochs: 3,
    signer: serverSigner,
  });

  return {
    artifactId: input.artifactId,
    runId: input.runId,
    sha256,
    byteLength: input.bytes.byteLength,
    contentType: input.contentType,
    blobId: result.blobId,
    // TODO verify against official docs before use: exact object field shape is version-sensitive.
    blobObjectId: result.blobObject?.id,
    rawWalrusResponse: result,
  };
}
```

This is architecture pseudocode, not production implementation.

## Readback and Verification Flow

1. Load `ArtifactRef` from local DB.
2. Read bytes with `client.walrus.readBlob({ blobId })`.
3. Compute SHA-256 over returned bytes.
4. Compare to stored `ArtifactRef.sha256`.
5. Mark artifact as `verified`, `mismatch`, or `read_failed`.
6. Decode bytes only after verification when integrity matters.
7. Create an `artifact_verified` proof event.

```ts
async function verifyArtifact(artifact: ArtifactRef) {
  const bytes = await client.walrus.readBlob({ blobId: artifact.blobId });
  const actual = await sha256Hex(bytes);
  const verified = timingSafeEqualHex(actual, artifact.sha256);

  return {
    artifactId: artifact.artifactId,
    expectedSha256: artifact.sha256,
    actualSha256: actual,
    verificationStatus: verified ? 'verified' : 'mismatch',
  };
}
```

TODO verify against official docs before use: exact `readBlob` response type and any recommended file/quilt-aware APIs for the selected SDK version.

## Blob ID vs Sui Blob Object ID

| Identifier | Meaning | Used For |
| --- | --- | --- |
| `blobId` | Walrus content identifier | Reading artifact bytes and displaying proof linkage |
| `blobObjectId` | Sui object representing blob ownership/lifetime/metadata when returned | Extend, delete, ownership checks, attributes |
| `anchorObjectId` | TraceLayer Sui object created by `artifact_anchor.move` | Artifact proof receipt |
| `anchorTxDigest` | Sui transaction digest for anchor call | Proof trail and explorer link |

Never use a Sui object ID as a Walrus blob ID or vice versa.

## Upload Relay Usage

The upload relay can reduce client or server fanout to storage nodes and simplify upload reliability. In the MVP, configure relay host through environment variables only.

Rules:
- Do not hardcode public relay URLs.
- Do not hardcode tip settings beyond documented examples.
- If the relay is paid, confirm `/v1/tip-config` behavior before implementation.
- Relay does not replace on-chain registration/certification requirements.
- Keep relay failures visible as proof events or upload status messages.

TODO verify against official docs before use: relay host, auth, tip config, request limits, and return fields.

## Demo Modes

`TRACE_LAYER_DEMO_MODE` is defined in [Demo Mode and Fallback Plan](15-demo-mode-and-fallback-plan.md).

| Mode | Walrus behavior | Sui behavior |
| --- | --- | --- |
| `live` | Real `writeBlob` and `readBlob` verification | Real wallet-signed anchor or labeled service-signed fallback |
| `recorded` | Pre-recorded real blob ID from an earlier live run | Pre-recorded real transaction digest from an earlier live run |
| `dry-run` | Local artifact bytes and SHA-256 only | No Sui transaction |

Dry-run should:
- Generate artifact bytes.
- Compute SHA-256.
- Create local `ArtifactRef` with `uploadStatus: 'not_uploaded'`.
- Create a proof event labeled with `dryRun: true`.
- Avoid pretending that a Walrus blob ID exists.
- Display “No Walrus blob created” rather than placeholder blob IDs.

Dry-run must not create fake Walrus blob IDs, fake Sui transaction digests, fake anchor object IDs, or fake permanent proof claims.

## Failure Handling

| Failure | User-visible state | Recovery |
| --- | --- | --- |
| Serialization failure | Artifact generation failed | Fix demo runner or artifact schema |
| Hash failure | Artifact hashing failed | Retry locally; no upload attempted |
| Upload relay unavailable | Upload failed | Retry, switch relay, or dry-run |
| Walrus write fails after partial steps | Upload failed / resumable if flow API used | Persist flow steps in future implementation |
| DB write fails after upload | Upload succeeded but local indexing failed | Reconcile from raw response/logs before anchoring |
| Readback fails | Verification read failed | Retry readback; do not mark verified |
| Hash mismatch | Verification mismatch | Block Sui anchor until reviewed |

For production-grade long-running uploads, prefer `writeBlobFlow` or `writeFilesFlow` with persisted step state.

## Browser Wallet Future Flow

Browser upload is future work because wallet popups, relay configuration, WASM loading, CORS, and mobile resource constraints add risk.

Future browser flow:
1. User selects or generates artifact.
2. Browser encrypts sensitive bytes if needed.
3. `writeBlobFlow` or `writeFilesFlow` encodes bytes.
4. User clicks Register and signs the register transaction.
5. Client uploads bytes through storage nodes or relay.
6. User clicks Certify and signs certification.
7. App persists flow steps and proof events.

This future path lets users pay and sign directly, but it is not required for the hackathon MVP.

## Sensitive Plaintext Avoidance

Before upload, classify the artifact:
- Non-sensitive demo report: may upload plaintext.
- Private prompt bundle: do not upload plaintext.
- Memory refs: upload only sanitized manifest or encrypted bytes.
- Tool output: redact credentials, URLs with tokens, PII, and private internal data.

MVP should use non-sensitive demo artifacts so the proof trail is easy to inspect publicly.

## Mapping Artifacts to Runs

The local DB maps:

```text
AgentRun(run_id, owner, status, proof_root_hash, created_at_ms, sui_anchor_id?)
Artifact(run_id, artifact_id, blob_id, blob_object_id, sha256, type, content_type, byte_length, created_at_ms)
ProofEvent(run_id, artifact_id, type, status, blob_id, hash, tx_digest?, created_at_ms)
```

Walrus is not the operational query index. The database is the index; Walrus is the durable artifact store.
