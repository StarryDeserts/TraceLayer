# Proof Trail and Replay

## Core Differentiator

TraceLayer differentiates through Replay + Delegation + Proof Trail. The product is valuable when a developer can inspect a run, verify its artifacts, understand where they are stored, see Sui receipts, and reconstruct context without exposing private chain-of-thought.

## Proof Trail Model

A proof trail is an ordered timeline of local and on-chain proof events. Local events make the UI responsive and complete; Sui events make selected proof claims durable and public. State transitions and idempotency rules are defined in [Proof Event State Machine](13-proof-event-state-machine.md).

## Proof Event Types

| Type | Meaning | Local DB | Walrus | Sui |
| --- | --- | --- | --- | --- |
| `run_registered` | Run metadata recorded | Yes | No | Optional event/object |
| `artifact_uploaded` | Artifact bytes uploaded to Walrus | Yes | Write | No |
| `artifact_verified` | Readback hash matched stored hash | Yes | Read | No |
| `artifact_anchor_submitted` | Wallet signing prepared/pending or Sui anchor transaction submitted | Yes | No | Pending tx or wallet flow |
| `artifact_anchored` | Sui anchor confirmed/indexed | Yes | No | Event/object |
| `artifact_anchor_failed` | Wallet signing or Sui anchor transaction failed | Yes | No | Optional failed tx |
| `replay_requested` | User reconstructed replay context | Yes | Optional read | Optional read |
| `delegate_granted` | Delegation receipt recorded | Yes | No | Optional event/object |
| `delegate_revoked` | Revoke receipt recorded | Yes | No | Optional event/object |

## Artifact Upload Proof

An artifact upload proof links:
- Run ID
- Artifact ID
- Artifact type
- SHA-256 hash
- Byte length
- Content type
- Walrus blob ID
- Sui blob object ID if returned
- Upload timestamp
- Raw SDK response summary

The proof claim is: “these bytes, represented by this SHA-256 hash, were uploaded to Walrus and are readable through this blob ID.”

## Hash Verification Proof

A verification proof links:
- Artifact ID
- Blob ID
- Expected SHA-256
- Actual SHA-256 from readback bytes
- Verification result
- Verification timestamp

The proof claim is: “reading this Walrus blob returned bytes whose hash matched the artifact hash recorded for this run.”

Verification does not prove that plaintext was safe to upload. It proves byte integrity against the stored hash.

## Sui Anchor Proof

A Sui anchor proof links:
- Anchor mode: `wallet-signed` or `server-signed-fallback`
- Signer address
- On-chain owner address
- Claimed owner address if the app records one separately
- Run ID
- Blob ID
- Artifact hash
- Artifact type
- Created timestamp
- Sui transaction digest
- Anchor object ID or event ID
- Package ID and network

The proof claim depends on signer mode:
- Wallet-signed: “this connected wallet signed a Sui transaction tying this run, blob ID, and artifact hash together.”
- Server-signed fallback: “the TraceLayer service signer recorded a Sui proof tying this run, blob ID, and artifact hash together.”

Sui anchor proof does not mean artifact bytes are stored on Sui. Server-signed fallback does not prove the user's wallet owns the anchor.

## Delegate Grant Proof

A delegate grant proof links:
- Owner address
- Delegate address
- Scope: project, run, or artifact
- Run ID and/or artifact hash
- Policy hash if policy details are private or large
- Local delegate event ID
- Optional Sui transaction digest/event

The proof claim is: “a grant receipt was recorded for this delegate and scope.”

In the MVP, this is not cryptographic access enforcement.

## Delegate Revoke Proof

A delegate revoke proof links:
- Original grant reference
- Owner address
- Delegate address
- Scope
- Policy hash
- Local revoke event ID
- Optional Sui transaction digest/event

The proof claim is: “a revoke receipt was recorded for this delegate and scope.”

Revoke cannot make already-seen plaintext unseen. Actual future enforcement requires encrypted artifacts and key policy updates.

## Proof Receipt vs Actual Access Control

A proof receipt is evidence that TraceLayer recorded a control-plane action. Actual access control is enforcement over who can read artifact bytes.

| Concept | MVP Meaning | Future Meaning |
| --- | --- | --- |
| Delegate grant proof | A local and optional Sui receipt says a grant was recorded | Encrypted artifact keys or policies are made available to the delegate |
| Delegate revoke proof | A local and optional Sui receipt says a revoke was recorded | Keys rotate or policies prevent future decrypt/access operations |
| Artifact anchor proof | A public claim ties run ID, blob ID, and hash together | Same, possibly referencing encrypted artifact manifests |

The MVP must describe delegation as receipt-based. It must not claim cryptographic access enforcement until encrypted artifacts and key-policy infrastructure exist.

## Replay Requested Proof

A replay requested proof records:
- Run ID
- Requesting owner/delegate
- Timestamp
- Whether artifact verification was requested
- Verification summary
- Previous run dependency count

The proof claim is: “TraceLayer reconstructed the run context view at this time using these available refs and verification states.”

## What Replay Means

Replay means context reconstruction. It rebuilds the developer-visible context needed to understand a run and its artifact lineage.

Replay includes:
- Task input preview
- Input hash when available
- Memory refs
- Artifact refs
- Walrus blob IDs
- Hash verification state
- Sui anchor references
- Previous run dependencies
- Delegation/revoke receipts
- Output summary

Replay does not include:
- Private chain-of-thought
- Model-internal hidden reasoning
- Private memory plaintext
- Full private prompts unless explicitly sanitized and stored
- Secrets or raw credentials

## Replay Context Assembly

```text
load AgentRun
  -> load MemoryRefs
  -> load ArtifactRefs
  -> optionally read and verify Walrus artifacts
  -> load ProofEvents
  -> reconcile Sui anchor receipts if available
  -> load previous run dependencies
  -> produce ReplayContext(chainOfThoughtIncluded=false)
  -> write replay_requested proof event
```

## Artifact Lineage

Artifact lineage should show:
- Parent run
- Parent artifacts, if derived
- Blob ID
- Hash
- Verification status
- Anchor status
- Delegate status
- Previous run dependencies

MVP lineage can be a simple list. Future lineage can become a graph.

## Proof Root Future

For multi-artifact runs, TraceLayer can create a deterministic manifest:

```json
{
  "runId": "run_...",
  "artifacts": [
    {
      "artifactId": "art_...",
      "artifactType": "markdown_report",
      "sha256": "...",
      "byteLength": 1234,
      "contentType": "text/markdown",
      "blobId": "...",
      "parentArtifactIds": []
    }
  ]
}
```

The app can hash the manifest and anchor the manifest hash as a run-level proof root. This is future work unless needed for demo clarity.

## UX Requirements

Every proof event should show:
- Human-readable label
- Machine-readable type
- Status
- Correlation ID
- Demo mode: `live`, `recorded`, or `dry-run`
- Anchor mode when relevant
- Signer address when relevant
- Timestamp
- Linked run/artifact/delegate
- Blob ID when relevant
- Hash when relevant
- Sui digest/object/event when relevant
- Whether the event is local-only or mirrored on-chain

## Proof Limitations

- A hash proves byte equality, not semantic truth.
- A wallet-signed Sui anchor proves the connected wallet signed the anchor transaction.
- A service-signed fallback anchor proves the service signer recorded a public claim, not user wallet ownership.
- A Sui anchor proves a public claim was recorded, not that the artifact is safe or correct.
- A delegate receipt proves product intent, not access enforcement.
- A replay context reconstructs observable context, not model-private reasoning.
