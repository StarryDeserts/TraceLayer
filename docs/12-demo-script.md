# Demo Script

## Demo Goal

Show TraceLayer as an agent observability and control plane for verifiable artifacts and run lineage on Walrus. The judge should understand Replay + Delegation + Proof Trail in five minutes.

## Pre-Demo Checklist

- App is running.
- Demo account has Sui testnet funds if live anchor is shown.
- Walrus upload relay and Sui endpoint are configured if live upload is shown.
- At least one fallback run has a real Walrus blob ID and real Sui transaction digest captured beforehand.
- Demo artifact contains only synthetic, non-sensitive content.
- Browser is on `/dashboard`.

## 5-Minute Script

### 0:00-0:30 — Positioning

Screen: `/dashboard`

Say:
> TraceLayer is an agent observability and control plane on Walrus. It helps developers answer what an agent produced, where the artifact is stored, whether the bytes verify, whether there is a Sui anchor, and what replay context can be reconstructed without exposing private chain-of-thought.

Show:
- Product positioning card
- Latest run/proof widgets
- “Start demo run” button

### 0:30-1:10 — Generate Agent Run

Screen: `/dashboard` then `/runs/[id]`

Action:
- Click “Start demo run.”

Say:
> This demo runner simulates a research agent. It produces one markdown artifact plus structured metadata: run ID, agent ID, owner, task summary, input preview, output summary, memory refs, and artifact refs.

Show:
- Run ID
- Agent ID
- Task summary
- Input preview
- Memory refs
- Generated artifact card

### 1:10-1:55 — Upload Artifact to Walrus

Screen: `/runs/[id]` or `/artifacts/[id]`

Action:
- Click “Upload to Walrus” or show completed upload state.

Say:
> TraceLayer hashes the exact artifact bytes with SHA-256, then uploads those bytes to Walrus. The app stores the Walrus blob ID, optional Sui blob object ID, byte length, content type, and hash in the local run index.

Show:
- SHA-256
- Blob ID
- Byte length
- Content type
- Upload proof event

### 1:55-2:35 — Verify Readback

Screen: `/artifacts/[id]`

Action:
- Click “Verify readback.”

Say:
> Verification reads the blob back from Walrus, recomputes the SHA-256 hash, and compares it to the hash recorded at upload time. Only then does the artifact get a verified proof status.

Show:
- Expected hash
- Actual hash
- Verified badge
- `artifact_verified` proof event

### 2:35-3:20 — Anchor on Sui

Screen: `/artifacts/[id]`

Action:
- Click “Anchor on Sui” or show captured anchor.

Say:
> Sui is not storing the artifact. It stores a compact proof receipt: owner, run ID, blob ID, artifact hash, artifact type, and timestamp. That gives the artifact lineage a public anchor without putting large or private content on-chain.

Show:
- Transaction digest
- Anchor object/event
- Owner
- Run ID
- Blob ID
- Artifact hash

### 3:20-4:00 — Proof Trail

Screen: `/proofs` or proof section on `/runs/[id]`

Say:
> The proof trail is the core product surface. It shows the run registered, artifact uploaded, artifact verified, artifact anchored, replay requested, delegate granted, and delegate revoked events. Some events are local operational records; selected receipts are mirrored on Sui.

Show timeline:
- Run registered
- Artifact uploaded
- Artifact verified
- Artifact anchored
- Replay requested
- Delegate granted
- Delegate revoked

### 4:00-4:35 — Replay Context

Screen: `/replay/[runId]`

Action:
- Click “Reconstruct replay context.”

Say:
> Replay here means context reconstruction, not model-internal reasoning replay. TraceLayer reconstructs the task input preview, memory refs, artifact refs, blob IDs, verification state, and previous run dependencies. It does not expose private chain-of-thought.

Show:
- Task input preview
- Memory refs
- Artifact refs
- Verification summary
- `chainOfThoughtIncluded: false` notice

### 4:35-5:00 — Delegation and Revoke

Screen: `/delegates`

Action:
- Grant and revoke a delegate receipt, or show existing receipts.

Say:
> Delegation is lightweight in the MVP. TraceLayer records grant and revoke receipts in the proof trail. This proves the control-plane action happened, but actual encrypted access control is future work with Seal or a MemWal-style integration.

Show:
- Delegate address
- Grant receipt
- Revoke receipt
- Proof receipt vs access control note

## Fallback Path

If live Walrus upload fails:
- Show locally generated artifact and SHA-256.
- Switch to a pre-recorded real blob ID from a prior successful run.
- Say clearly: “This is a pre-recorded real Walrus proof example because the live network call is unavailable.”

If live Sui anchor fails:
- Show the verified Walrus artifact.
- Switch to a pre-recorded real Sui transaction digest and anchor event.
- Say clearly: “This is a pre-recorded real Sui anchor example.”

Never show fake blob IDs or fake transaction digests as live proof.

## Judge Takeaway

End with:
> TraceLayer makes AI agent artifacts verifiable and replayable without becoming an agent framework. Walrus stores the durable artifact bytes, Sui anchors compact proof receipts, and the UI turns those records into a developer-facing proof trail for replay and delegation.
