# TraceLayer

> **The verifiable delivery layer for AI agent work — built on Sui + Walrus.**

Every important AI artifact should ship with a proof packet anyone can verify, without trusting the agent or the operator. TraceLayer wraps an AI agent run in a public, end-to-end proof: artifact bytes stored on **Walrus**, SHA-256 readback verification, wallet-signed proof metadata anchored on **Sui testnet**, an ordered Proof Trail, and a Replay Context that excludes private chain-of-thought.

**🏆 Sui Overflow 2026 Hackathon — AI × Walrus track submission.**

---

## Table of contents

- [Why TraceLayer](#why-tracelayer)
- [How it works](#how-it-works)
- [Sui + Walrus integration](#sui--walrus-integration)
- [Live testnet evidence](#live-testnet-evidence)
- [Repository layout](#repository-layout)
- [Quick start](#quick-start)
- [Live demo walkthrough](#live-demo-walkthrough)
- [Operating modes](#operating-modes)
- [Verification commands](#verification-commands)
- [Scope & non-goals](#scope--non-goals)
- [Roadmap](#roadmap)

---

## Why TraceLayer

AI agents today produce reports, code reviews, compliance notes, security findings, and research summaries that teams actually want to reuse. Most agent demos stop at "the model returned an answer." Real teams need to know:

- **What** artifact was produced?
- **Where** do its exact bytes live, and can I read them back unchanged?
- **Who** signed the proof metadata, on which chain, with which wallet?
- **How** was it produced — what observable context can I replay without leaking private reasoning or provider keys?

TraceLayer turns the answer into a verifiable artifact, not a screenshot.

```
AI artifact  ──►  Walrus bytes  ──►  SHA-256 readback  ──►  Wallet-signed Sui anchor  ──►  Replay Context
                  (storage proof)     (integrity proof)        (ownership proof)             (observability proof)
```

Each card on the product UI is **one public boundary a verifier can inspect independently**. No provider keys and no private chain-of-thought ever leave the trust boundary.

---

## How it works

```
┌─────────────┐    1. BYOK run     ┌──────────────┐
│  Web (UI)   │ ─────────────────► │ Live API     │
│  Next.js    │                    │ (Node 22+)   │
└──────┬──────┘                    └──────┬───────┘
       │                                  │
       │ 2. Validate artifact JSON        │ 3. Upload bytes via backend boundary
       │    (rejects CoT, server-side IDs)│
       │                                  ▼
       │                          ┌──────────────────┐
       │                          │ Walrus testnet   │
       │                          │ (upload relay)   │
       │                          └──────┬───────────┘
       │                                 │ 4. Readback + SHA-256 verify
       │                                 ▼
       │                          ┌──────────────────┐
       │ 5. Prepare anchor tx     │  Verified hash   │
       │ ◄────────────────────────│  (load-bearing)  │
       │                          └──────────────────┘
       │
       │ 6. Wallet signs Sui anchor (user holds the keys)
       ▼
┌─────────────┐                   ┌──────────────────┐
│ Sui Wallet  │ ────────────────► │   Sui testnet    │
│ (Slush etc.)│  signed tx        │  ArtifactAnchor  │
└─────────────┘                   └──────────────────┘
```

1. A BYOK (Bring Your Own Key) OpenAI-compatible model run produces structured artifact JSON.
2. TraceLayer validates the schema and rejects model-supplied proof IDs or private chain-of-thought.
3. Walrus stores the **exact artifact bytes** through the backend boundary (the browser never imports the Walrus SDK directly).
4. TraceLayer reads the blob back and recomputes SHA-256; the artifact is `verified` only when expected == actual.
5. The connected wallet (e.g. Slush testnet) prepares and **signs** a compact Sui anchor transaction itself — TraceLayer does not submit a server-signed transaction in the wallet-signed path.
6. The chain becomes the ownership ledger: `signerAddress` and `onChainOwnerAddress` both equal the connected wallet → `anchorMode = wallet-signed`, `serviceSigned = false`.

---

## Sui + Walrus integration

### Walrus — durable artifact bytes

Walrus is the storage layer for artifact bytes. The product shows both Walrus identifiers and only marks a `Verified hash` once readback matches the expected SHA-256.

- Walrus network: **testnet**
- Upload relay: `https://upload-relay.testnet.walrus.space`
- Backend boundary enforced by `scripts/check-walrus-import-boundary.mjs` — the web app cannot import raw Walrus SDKs.

### Sui — wallet-signed proof metadata

Sui anchors **compact proof metadata only**, never artifact bytes. The Move module records the artifact hash, Walrus blob ID, artifact type, run ID, and signer-derived ownership.

- Move package: [`tracelayer/contracts/move`](tracelayer/contracts/move) — `tracelayer_anchor::artifact_anchor`
- Sui network: **testnet**
- Sui package ID: `0x97dd4dbe2ab37affdf9521ba4062a8c363bdacb4d2feb91e4920129a6c4de0ab`
- Publisher tx digest: `wqrTvjiG2tHboZuZAKgwzHdcxjGBpr2UuKjycXaXRog`
- Entry function: `anchor_artifact(run_id, blob_id, artifact_hash, artifact_type, created_at_ms)`
- Emits event: `ArtifactAnchored { anchor_id, owner, run_id, blob_id, artifact_hash, artifact_type, created_at_ms, schema_version }`

Wallet-signed anchor means the on-chain `owner` is the connected wallet — never a server fallback identity.

---

## Live testnet evidence

These are real, verifiable identifiers from a successful end-to-end run preserved at [`tracelayer/fixtures/recorded/phase5-live-model-run.testnet.json`](tracelayer/fixtures/recorded/phase5-live-model-run.testnet.json). Judges can verify each value independently on Sui/Walrus testnet today.

| Field | Value |
| ----- | ----- |
| Run ID | `run_16614eb4-2fce-4a3c-b0e5-6321a328bc93` |
| Artifact ID | `artifact_6a5df417-1553-43d4-87f3-ef167bb5b693` |
| Walrus blob ID | `MAErwXd-VYEM-_5kKbJltHOu9RoKcKZRNmSmikaaDkY` |
| Walrus blob object ID | `0x9a993f6cde1aa6c0a590f24c42d28cbbc48596f75d4b685db37d6b6c42357399` |
| Expected SHA-256 == Actual SHA-256 | `226af3a84545053315d7715c77b7667365c8b2a1d6f9a6ff8b785f6bfe95977b` |
| Walrus verification | `verified` |
| Sui anchor tx digest | `Bj6ato28GgbfD5BDDSQdkEL52MMtck5SikCWg2pmBC3y` |
| Sui anchor object ID | `0x7b02de3ac9b2a51ee8dbddbca55e4917fd70413376dcb118ff1d74d0e7fe7878` |
| signerAddress == onChainOwnerAddress | `0xd852497c7732b882ffc3406a1186900bcdf9bcdbd82d54ab6652ea41bb1523a9` |
| anchorMode / serviceSigned / ownerMatchesWallet | `wallet-signed` / `false` / `true` |
| chainOfThoughtIncluded | `false` |

Proof Trail event sequence:

1. `run_registered`
2. `artifact_generated`
3. `artifact_uploaded`
4. `artifact_verified`
5. `artifact_anchor_submitted`
6. `artifact_anchored`

The fixture is committed for reproducibility and intentionally **excludes** model API keys, auth headers, `TRACE_LAYER_API_TOKEN`, `SUI_PRIVATE_KEY`, wallet private keys, mnemonics, and hidden chain-of-thought.

---

## Repository layout

```
TraceLayer/
├── tracelayer/                          ← pnpm monorepo root
│   ├── apps/web                         ← Next.js product UI (landing, dashboard, /demo, /proofs, /replay, /delegates)
│   ├── services/api                     ← Recorded-mode API surface
│   ├── services/live-api                ← Live BYOK + Walrus + Sui API surface
│   ├── packages/walrus                  ← Walrus upload / readback / hash boundary
│   ├── packages/sui-anchor              ← Sui anchor tx + proof metadata boundary
│   ├── packages/proof                   ← Proof event & artifact state helpers
│   ├── packages/config                  ← Demo-mode gating (live / recorded / dry-run)
│   ├── contracts/move                   ← Move package: tracelayer_anchor::artifact_anchor
│   └── fixtures/recorded                ← Non-secret testnet proof fixtures (Phase 2.5, 3.5, 5)
├── docs/                                ← Architecture, ADRs, demo script, pitch (gitignored locally)
└── README.md
```

---

## Quick start

**Prerequisites**: Node 22+ (developed on 24.11.1), pnpm 9.15+, a Sui testnet wallet with a small balance for gas.

```bash
# 1. Install workspace dependencies
pnpm --dir tracelayer install

# 2. Configure live mode (gitignored)
cp tracelayer/services/live-api/.env.example tracelayer/services/live-api/.env
# Fill in SUI_PRIVATE_KEY (for Walrus relay tips), TRACE_LAYER_API_TOKEN, etc.

# 3. Start the live API (port 3002)
pnpm --dir tracelayer dev:api:live

# 4. In another shell, start the web app (port 3000)
pnpm --dir tracelayer dev:web
```

Open:

- `http://localhost:3000/` — landing page (proof boundary cards)
- `http://localhost:3000/dashboard` — full proof packet summary
- `http://localhost:3000/settings/model` — BYOK model setup (session-only by default)
- `http://localhost:3000/demo` — live run + Walrus + Sui anchor flow
- `http://localhost:3000/proofs` — ordered Proof Trail
- `http://localhost:3000/replay/run_phase_2_5_test` — Replay Context (chain-of-thought excluded)
- `http://localhost:3000/dev/anchor-smoke` — wallet anchor smoke page (developer-only)

---

## Live demo walkthrough

1. Configure a BYOK OpenAI-compatible model at `/settings/model`. The key stays in browser storage; it never reaches the TraceLayer backend, proof events, replay, or fixtures.
2. Open `/demo` and enter a non-secret task (e.g. "review release notes for unclear language").
3. Run the model and inspect the validated structured artifact (`chainOfThoughtIncluded = false`).
4. Register the artifact → TraceLayer generates the server-side proof IDs.
5. Upload artifact bytes to Walrus through the backend boundary.
6. Verify the Walrus readback hash → status flips to `verified`.
7. Connect a Sui testnet wallet → prepare and **sign** the anchor transaction in the wallet.
8. Inspect the wallet-signed anchor: transaction digest, anchor object ID, on-chain owner == connected wallet.
9. Load Replay Context and inspect the ordered Proof Trail.

A 4-minute walkthrough is also available as `demo/tracelayer-demo-subtitled.mp4` after running the [hackathon-demo-video](.claude/skills/hackathon-demo-video) skill (the `demo/` folder is gitignored).

---

## Operating modes

TraceLayer is explicit about which mode is active, so judges always know whether a proof identifier is live, recorded, or a fallback.

| Mode | When it runs | Proof source |
| ---- | ------------ | ------------ |
| **`live`** | `TRACE_LAYER_DEMO_MODE=live` + `WALRUS_LIVE_UPLOAD=true` + `SUI_ANCHOR_LIVE=true` | Real BYOK model, Walrus testnet, Sui testnet, wallet-signed anchor. |
| **`recorded`** | Default product UI fallback | Real non-secret testnet fixtures in `tracelayer/fixtures/recorded`. Identifiers are real, not fabricated. |
| **`dry-run`** | No live env configured | UI labels state honestly as fallback. Service-signed fallback is explicitly not wallet-signed ownership. |

---

## Verification commands

```bash
pnpm --dir tracelayer typecheck
pnpm --dir tracelayer test
pnpm --dir tracelayer check:walrus-boundary   # web cannot import raw Walrus SDK
pnpm --dir tracelayer --filter @tracelayer/web build
```

---

## Scope & non-goals

TraceLayer MVP is intentionally narrow so every boundary is demoable and verifiable.

**In scope**

- Walrus testnet artifact upload + readback verification
- Wallet-signed Sui testnet anchor of compact proof metadata
- Ordered Proof Trail + Replay Context excluding chain-of-thought
- BYOK OpenAI-compatible model integration (session-only by default)
- Delegation receipts as MVP audit receipts

**Out of scope for this submission**

- Seal / MemWal / encrypted delegation access enforcement
- Browser-direct Walrus uploads
- A generic agent framework
- Production-grade provider key management
- New Move contract changes beyond Phase 6

Service-signed fallback is **not** wallet-signed ownership and is labeled accordingly. Delegation receipts are MVP audit receipts only.

---

## Roadmap

- Production-grade provider key handling beyond local demo-mode browser storage
- Stronger delegation + encryption integrations (Seal, MemWal exploration)
- Richer proof packet exports for auditors and customer trust packages
- Workspace policies for retention, review, and artifact governance
- Additional replay visualizations and verifier-friendly evidence bundles
- More AI workflow integrations that emit TraceLayer proof packets

---

## License

MIT — see project root for details.

Built for **Sui Overflow 2026** with Sui testnet + Walrus testnet. Real Walrus, real Sui, real wallet, real artifact.
