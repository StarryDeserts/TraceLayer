# Frontend UX Architecture

## UX Goal

The UI should make the proof trail understandable in five minutes. Every screen should answer at least one provenance question: what ran, what artifact was produced, where it is stored, whether it verifies, whether it was anchored, what replay context can be reconstructed, and what delegation receipts exist.

## Navigation

Primary navigation:
- Dashboard
- Runs
- Artifacts
- Proofs
- Replay
- Delegates

MVP can implement Artifacts as links from runs rather than a top-level list, but `/artifacts/[id]` must exist conceptually.

## `/dashboard`

| Item | Design |
| --- | --- |
| Purpose | Landing screen for demo status and primary actions |
| Data dependencies | Latest runs, latest proof events, Walrus/Sui config status, `TRACE_LAYER_DEMO_MODE`, anchor signing mode |
| Primary action | Start demo run |
| Empty state | “No runs yet. Start a demo run to generate a verifiable artifact.” |
| Loading state | Skeleton cards for latest run, proof status, and network config |
| Error state | Show API/config error and offer dry-run mode |
| Demo value | Gives judges immediate context and a single start button |

Key cards:
- Latest run
- Artifact verification status
- Sui anchor status
- Delegation status
- Network/config readiness

## `/runs`

| Item | Design |
| --- | --- |
| Purpose | Timeline list of agent runs |
| Data dependencies | `GET /api/runs` |
| Primary action | Open a run detail page |
| Empty state | “No agent runs have been recorded.” |
| Loading state | List skeleton with status pills |
| Error state | “Could not load runs” with retry |
| Demo value | Shows TraceLayer as run lineage, not file browsing |

Each row should show:
- Run ID
- Agent ID
- Task summary
- Status
- Artifact count
- Proof event count
- Created timestamp
- Verification/anchor badges

## `/runs/[id]`

| Item | Design |
| --- | --- |
| Purpose | Main detail page for one run |
| Data dependencies | `GET /api/runs/:id`, `GET /api/proofs?runId=...` |
| Primary action | Verify artifact, anchor artifact, or reconstruct replay context |
| Empty state | “Run has no artifacts yet” if artifact generation failed |
| Loading state | Header skeleton, artifact card skeleton, proof timeline skeleton |
| Error state | Run not found or not authorized |
| Demo value | The best page to explain run -> artifact -> proof trail |

Sections:
1. Run summary
2. Task input preview
3. Output summary
4. Memory refs
5. Artifact refs
6. Proof trail
7. Replay CTA
8. Delegation CTA

## `/artifacts/[id]`

| Item | Design |
| --- | --- |
| Purpose | Inspect one artifact and its verification status |
| Data dependencies | `GET /api/artifacts/:id`, `GET /api/artifacts/:id/read`, `GET /api/proofs?artifactId=...` |
| Primary action | Read and verify artifact; anchor if verified |
| Empty state | Artifact metadata exists but no Walrus blob ID yet |
| Loading state | Metadata skeleton and artifact preview loading state |
| Error state | Missing blob, read failure, hash mismatch, decode failure |
| Demo value | Shows Walrus blob ID, hash, and exact verification result |

Sections:
- Artifact metadata
- Walrus identifiers
- Hash comparison
- Markdown preview
- Sui anchor status
- Related proof events

## `/proofs`

| Item | Design |
| --- | --- |
| Purpose | Global proof timeline across runs and artifacts |
| Data dependencies | `GET /api/proofs` |
| Primary action | Filter by run, artifact, or proof type |
| Empty state | “No proof events yet.” |
| Loading state | Timeline skeleton |
| Error state | Proof query failed with retry |
| Demo value | Makes Replay + Delegation + Proof Trail explicit |

Timeline event types:
- Run registered
- Artifact uploaded
- Artifact verified
- Artifact anchored
- Replay requested
- Delegate granted
- Delegate revoked

Each event card should show:
- Event type
- Status
- Timestamp
- Run/artifact links
- Blob ID if relevant
- Sui transaction digest if relevant
- Hash if relevant

## `/replay/[runId]`

| Item | Design |
| --- | --- |
| Purpose | Reconstruct run context without private chain-of-thought |
| Data dependencies | `POST /api/replay/:runId`, related run/artifact/proof data |
| Primary action | Generate or refresh replay context |
| Empty state | “Replay context has not been requested for this run.” |
| Loading state | Reconstruction progress list |
| Error state | Missing run, verification failure, missing artifact, or DB read error |
| Demo value | Shows the product’s definition of replay clearly |

Replay sections:
- Task input preview
- Memory refs
- Artifact refs
- Blob IDs
- Verification summary
- Previous run dependencies
- Proof trail references
- Explicit “chain-of-thought not included” notice

## `/delegates`

| Item | Design |
| --- | --- |
| Purpose | Show grant/revoke receipt records |
| Data dependencies | Delegate records plus proof events |
| Primary action | Grant delegate or revoke existing delegate |
| Empty state | “No delegation receipts have been recorded.” |
| Loading state | Delegate table skeleton |
| Error state | Invalid address, transaction failure, or DB write failure |
| Demo value | Demonstrates the control-plane side of the project |

Sections:
- Grant form
- Active local grants
- Revoke actions
- Sui receipt status
- Proof receipt vs access control explanation

## Five-Minute Demo Path

### 0:00-0:30 — Open Dashboard

Show the positioning line: “Agent Observability & Control Plane on Walrus.” Explain that the demo will trace one agent artifact from generation to Walrus to Sui proof to replay context.

### 0:30-1:15 — Start Demo Run

Click “Start demo run.” Show the run detail page with task summary, input preview, output summary, and generated markdown artifact.

### 1:15-2:00 — Upload to Walrus

Click or show “Upload to Walrus.” Display blob ID, content type, byte length, and SHA-256. Explain that the hash is over exact uploaded bytes.

### 2:00-2:40 — Verify Readback

Trigger verification. Show expected hash, actual hash, and verified badge. Explain that TraceLayer decodes the artifact only after readback verification when integrity matters.

### 2:40-3:25 — Anchor on Sui

Click “Anchor on Sui.” Prefer the connected wallet flow and show “Wallet-signed Sui anchor by 0x...” after execution. If the fallback path is used, show “Service-signed fallback proof” and explain that it does not prove user wallet ownership. Show transaction digest, anchor object/event, signer, on-chain owner, run ID, blob ID, artifact hash, and artifact type.

### 3:25-4:10 — Proof Trail

Open `/proofs` or the proof section in `/runs/[id]`. Walk through run registered, artifact uploaded, artifact verified, artifact anchored, replay requested, delegate granted, and delegate revoked.

### 4:10-4:45 — Replay Context

Open `/replay/[runId]`. Show task input preview, memory refs, artifact refs, blob IDs, hash verification state, and previous dependencies. Emphasize that this reconstructs context, not private chain-of-thought.

### 4:45-5:00 — Delegation/Revoke

Open `/delegates`, grant and revoke a delegate receipt, or show pre-recorded receipts. Explain that MVP receipts prove control-plane actions but do not enforce encrypted access until a future Seal/MemWal integration.

## UI Copy Rules

Use precise labels:
- “Replay context” instead of “reasoning replay.”
- “Proof receipt” instead of “access granted on-chain” unless encryption/access enforcement exists.
- “Walrus blob ID” instead of “file ID.”
- “Sui anchor” instead of “stored on Sui.”
- “Wallet-signed Sui anchor by 0x...” when the connected wallet signed the transaction.
- “Service-signed fallback proof” when the backend service signer submitted the transaction.
- “Uploaded by TraceLayer service to Walrus” for MVP Walrus uploads.
- “Verified hash” only after readback comparison.

Do not use “user-owned anchor” for service-signed fallback anchors.

## Demo Fallback States

Demo mode labels should follow [Demo Mode and Fallback Plan](15-demo-mode-and-fallback-plan.md):
- `live`: real Walrus upload/readback and real Sui anchor transaction.
- `recorded`: pre-recorded real blob ID and tx digest, labeled as a proof example.
- `dry-run`: local artifact and SHA-256 only.

If live Walrus or Sui calls fail during the demo:
- Show dry-run artifact generation and local hash.
- Show previously recorded real blob ID and tx digest only in recorded mode.
- Clearly label fallback records as pre-recorded proof examples.
- Do not display fake transaction digests or fake blob IDs as live results.
- If service-signed fallback anchor is used, label it as service-owned/service-signed proof.
