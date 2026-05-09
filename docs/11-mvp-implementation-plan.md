# MVP Implementation Plan

## Phase 0: Architecture Validation

| Item | Details |
| --- | --- |
| Goal | Confirm version-sensitive Walrus, Sui SDK, and Move assumptions before code generation. |
| Deliverables | Verified SDK notes, selected package versions, confirmed testnet endpoints, Move syntax notes, env var checklist. |
| Acceptance criteria | Current docs confirm client initialization, upload/read APIs, PTB execution, event query approach, and Move object/event syntax. |
| Risks | SDK examples may differ across versions; docs may show `blob` vs `bl`; client response shape may change. |
| Estimated complexity | Low to medium. |
| Claude Code can safely generate | Research notes, env var checklist, architecture updates, pseudocode refinements. |
| Human must review | Final SDK version choice, endpoints, package IDs, signer custody, public relay choice. |

Tasks:
- Re-check `/websites/sdk_mystenlabs_walrus` and `/websites/sdk_mystenlabs` via Context7.
- Confirm `@mysten/walrus` and `@mysten/sui` versions.
- Confirm `SuiGrpcClient` setup and Walrus extension options.
- Confirm `writeBlob`, `readBlob`, `writeBlobFlow`, and `writeFilesFlow` signatures.
- Confirm Sui transaction execution and event query patterns.
- Confirm Move syntax for `UID`, `ID`, events, vectors, and `TxContext`.

## Phase 1: MVP Scaffold

| Item | Details |
| --- | --- |
| Goal | Create the minimal workspace, UI shell, API shell, shared types, and local DB schema. |
| Deliverables | pnpm workspace, Next.js app, Node API routes/service boundary, SQLite schema, shared types. |
| Acceptance criteria | App starts locally, dashboard loads, API health endpoint works, DB initializes, shared entities compile. |
| Risks | Over-scaffolding, dependency churn, mixing server-only SDK code into browser bundle. |
| Estimated complexity | Medium. |
| Claude Code can safely generate | Workspace files, TypeScript types, local DB schema, basic pages, API route skeletons. |
| Human must review | Dependency choices, app structure, private env handling, deployment target. |

Suggested build order:
1. `packages/types` entity types.
2. SQLite schema for runs, artifacts, memory refs, proofs, delegates.
3. `services/api` or Next.js route handlers.
4. `apps/web` dashboard/runs shell.
5. Local demo identity configuration.

## Phase 2: Walrus Artifact Pipeline

| Item | Details |
| --- | --- |
| Goal | Generate, hash, upload, read, and verify one markdown artifact per run. |
| Deliverables | Demo runner, SHA-256 helper, Walrus client wrapper, dry-run mode, upload endpoint, readback verification endpoint. |
| Acceptance criteria | A run creates a markdown artifact; hash is stored; dry-run works; real upload can store blob ID; readback verification can mark verified. |
| Risks | Testnet fees, relay configuration, SDK return shape, accidental secret exposure, uploading sensitive plaintext. |
| Estimated complexity | Medium to high. |
| Claude Code can safely generate | Non-secret SDK wrappers, hash helpers, dry-run path, API handlers, UI status cards. |
| Human must review | Signer loading, relay URL, cost settings, content classification, real upload toggle. |

Implementation rules:
- Node runtime only for upload/read routes.
- Hash exact uploaded bytes.
- Store `blobId` separately from `blobObjectId`.
- Decode after verification when integrity matters.
- Never put private key in frontend or `NEXT_PUBLIC_*`.

## Phase 3: Sui Anchor

| Item | Details |
| --- | --- |
| Goal | Publish lightweight Move anchor package on testnet and call anchor function from the API or wallet flow. |
| Deliverables | Move package, `artifact_anchor.move`, optional `run_registry.move`, optional `permission_receipt.move`, TS PTB call, tx digest capture. |
| Acceptance criteria | Verified artifact can be anchored; transaction digest and anchor proof event appear in UI. |
| Risks | Move syntax errors, package ID handling, ownership semantics, timestamp trust, event indexing delay. |
| Estimated complexity | High. |
| Claude Code can safely generate | Draft Move modules, Move tests, PTB wrapper, event parser, UI proof display. |
| Human must review | Contract authorization, upgrade capability custody, package publication, gas/signer policy. |

Implementation rules:
- Store only owner, run ID, blob ID, artifact hash, artifact type, timestamp, schema version.
- Do not store artifacts or private context on-chain.
- Check transaction failure state.
- Wait for indexing before querying.

## Phase 4: Run Timeline and Proof Trail

| Item | Details |
| --- | --- |
| Goal | Make the UI tell the full run-to-proof story. |
| Deliverables | `/runs`, `/runs/[id]`, `/artifacts/[id]`, `/proofs`, proof timeline components, status badges. |
| Acceptance criteria | User can start at dashboard, open a run, inspect artifact status, view proof events, and understand what happened. |
| Risks | UI becomes a generic dashboard; proof semantics become unclear; too many statuses for demo. |
| Estimated complexity | Medium. |
| Claude Code can safely generate | Pages, components, API clients, loading/empty/error states, proof event copy. |
| Human must review | Demo narrative, copy accuracy, visual clarity, judge-facing flow. |

Implementation rules:
- Use proof-specific labels.
- Show local-only vs on-chain proof state.
- Keep 5-minute path visible.

## Phase 5: Delegation/Revoke MVP

| Item | Details |
| --- | --- |
| Goal | Add lightweight control-plane receipts for grant and revoke actions. |
| Deliverables | Delegate records, grant/revoke API endpoints, optional Sui receipt calls, `/delegates` page, proof events. |
| Acceptance criteria | User can record a grant and revoke; proof trail shows both; UI explains receipt vs access control. |
| Risks | Users may assume access is cryptographically enforced; public delegate addresses can leak relationships. |
| Estimated complexity | Medium. |
| Claude Code can safely generate | Local delegate model, endpoints, UI, receipt events, explanatory copy. |
| Human must review | Privacy implications, public metadata, future Seal/MemWal wording. |

Implementation rules:
- Label receipts honestly.
- Do not claim revoke removes access to already-seen plaintext.
- Do not implement fake encryption.

## Phase 6: Hackathon Polish

| Item | Details |
| --- | --- |
| Goal | Package the project for a clear Sui Overflow Walrus-track submission. |
| Deliverables | README, screenshots, demo script, fallback data, deployment notes, judge story. |
| Acceptance criteria | Demo works in five minutes; fallback path exists; README explains Walrus-native value and Sui object model. |
| Risks | Live testnet instability, unclear story, overloaded UI, missing setup docs. |
| Estimated complexity | Medium. |
| Claude Code can safely generate | README, screenshots checklist, demo fixtures, deployment checklist, final docs. |
| Human must review | Submission requirements, video, deployed app, real tx/blob evidence, final product positioning. |

## Open Questions

### Walrus SDK

| Priority | Question | Why it matters | How to resolve |
| --- | --- | --- | --- |
| High | Is the current raw upload parameter `blob` or `bl` for `writeBlob`? | Pseudocode and implementation must compile. | Query current official docs and installed TypeDoc before coding. |
| High | What exact fields are returned by `writeBlob` and `writeFiles`? | Need to persist blob ID, blob object ID, cost, and tx metadata correctly. | Inspect SDK docs and run a smoke test after dependencies are installed. |
| High | What upload relay host/tip config should testnet use? | Demo upload reliability and cost depend on correct relay settings. | Verify official relay docs and `/v1/tip-config`. |
| Medium | Should MVP use `writeBlob` or `writeFiles` for one markdown artifact? | `writeBlob` is simpler; `writeFiles` gives file metadata/quilt semantics. | Start with `writeBlob`; revisit if multiple artifacts are added. |

### Sui Move

| Priority | Question | Why it matters | How to resolve |
| --- | --- | --- | --- |
| High | Should anchors be owned objects, events only, or shared registry entries? | Affects gas, lookup, ownership, and demo clarity. | Use owned object + event for MVP; review before publishing. |
| High | Should timestamps be client-provided or derived from clock? | Trust semantics differ. | Verify Sui Clock usage and decide during Move implementation. |
| Medium | Should string-like fields use `vector<u8>` or `String`? | Affects Move ergonomics and event decoding. | Confirm current Sui Move string/event best practices. |
| Medium | How should package upgrade capability be held? | Security and future upgrades depend on custody. | Human owner decides before testnet publish. |

### Product/Demo

| Priority | Question | Why it matters | How to resolve |
| --- | --- | --- | --- |
| High | Must the live demo execute real Walrus/Sui calls, or can it use pre-recorded fallback proofs? | Determines reliability strategy. | Prepare both; lead with live calls, fallback to recorded real examples. |
| Medium | What demo task should the research agent run? | The artifact should make the proof trail obvious. | Use a Walrus/Sui research report with memory refs and one artifact. |
| Medium | Should delegation be shown live or pre-recorded? | Live grant/revoke can consume time. | Use local grant live and Sui receipt pre-recorded if time is tight. |

### Security/Privacy

| Priority | Question | Why it matters | How to resolve |
| --- | --- | --- | --- |
| High | What exact data is safe to upload in the demo artifact? | Walrus blobs may be public/discoverable. | Use synthetic non-sensitive content only. |
| High | How will server signer secrets be stored locally and in deployment? | Prevents accidental private key exposure. | Use local `.env` and deployment secret manager; never use `NEXT_PUBLIC_*`. |
| Medium | Should hashes cover plaintext, ciphertext, or both in future encrypted artifacts? | Audit semantics differ. | Document policy before adding encryption. |

### Deployment

| Priority | Question | Why it matters | How to resolve |
| --- | --- | --- | --- |
| High | Where will the Next.js/API app run for judging? | Node runtime and secrets are required. | Choose a host that supports Node runtime and private env vars. |
| Medium | Is SQLite sufficient for deployed demo? | Some serverless hosts have ephemeral storage. | Use local demo or hosted SQLite-compatible persistence if needed. |
| Medium | What testnet faucet/cost setup is needed? | Live Sui/Walrus calls require funds. | Prepare funded testnet account before recording/demo. |

### Hackathon Submission

| Priority | Question | Why it matters | How to resolve |
| --- | --- | --- | --- |
| High | What exact Sui Overflow 2026 Walrus track criteria must be emphasized? | Submission scoring should shape README and video. | Review official track rules before final polish. |
| High | Are testnet transaction links and blob IDs required in submission? | Need stable proof artifacts. | Capture real examples during Phase 6. |
| Medium | Should docs include architecture diagrams in README or separate docs only? | Judges may not read deep docs. | Put a concise diagram and demo path in README later. |
