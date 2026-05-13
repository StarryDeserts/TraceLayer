# TraceLayer

TraceLayer is the verifiable delivery layer for AI agent work. Every important AI artifact should ship with a verifiable proof packet: artifact bytes stored by Walrus, SHA-256 readback verification, compact proof metadata anchored by Sui, an ordered Proof Trail, Replay Context, and receipt-based delegation previews.

## Problem solved

Agent systems can produce useful artifacts, but demos and audits often rely on screenshots, logs, or unverifiable claims. TraceLayer gives each non-sensitive artifact a verifiable proof packet:

1. A BYOK model run creates a structured, observable artifact.
2. TraceLayer validates the artifact and rejects private chain-of-thought or model-supplied proof IDs.
3. Walrus stores artifact bytes through the backend boundary.
4. TraceLayer reads the Walrus blob back and verifies the SHA-256 hash.
5. A connected wallet signs a Sui testnet anchor transaction for compact proof metadata only.
6. The UI shows the ordered proof trail and replay context without exposing provider keys or private chain-of-thought.

## Architecture

- `tracelayer/apps/web` — Next.js product UI, BYOK model settings, live `/demo`, recorded proof viewer, and developer wallet smoke page.
- `tracelayer/services/api` and `tracelayer/services/live-api` — API surfaces for recorded and live proof workflows.
- `tracelayer/packages/walrus` — Walrus upload/readback/hash verification boundary.
- `tracelayer/packages/sui-anchor` — Sui anchor transaction and proof metadata boundary.
- `tracelayer/packages/proof` — proof event and artifact state helpers.
- `tracelayer/fixtures/recorded` — non-secret recorded testnet proof fixtures used for demo fallback.

The frontend renders proof state and calls API routes. It does not import raw Walrus or Sui protocol SDKs directly.

## Successful Phase 5 live evidence

The successful Phase 5 BYOK live model run is preserved as non-secret recorded evidence:

- Fixture: `tracelayer/fixtures/recorded/phase5-live-model-run.testnet.json`
- Run ID: `run_16614eb4-2fce-4a3c-b0e5-6321a328bc93`
- Artifact ID: `artifact_6a5df417-1553-43d4-87f3-ef167bb5b693`
- Walrus blob ID: `MAErwXd-VYEM-_5kKbJltHOu9RoKcKZRNmSmikaaDkY`
- Blob object ID: `0x9a993f6cde1aa6c0a590f24c42d28cbbc48596f75d4b685db37d6b6c42357399`
- SHA-256: `226af3a84545053315d7715c77b7667365c8b2a1d6f9a6ff8b785f6bfe95977b`
- Wallet-signed Sui tx digest: `Bj6ato28GgbfD5BDDSQdkEL52MMtck5SikCWg2pmBC3y`
- Anchor object ID: `0x7b02de3ac9b2a51ee8dbddbca55e4917fd70413376dcb118ff1d74d0e7fe7878`
- signerAddress / onChainOwnerAddress: `0xd852497c7732b882ffc3406a1186900bcdf9bcdbd82d54ab6652ea41bb1523a9`
- anchorMode: `wallet-signed`
- serviceSigned: `false`
- ownerMatchesWallet: `true`
- chainOfThoughtIncluded: `false`

This fixture intentionally omits model API keys, auth headers, `TRACE_LAYER_API_TOKEN`, `SUI_PRIVATE_KEY`, `.env.local` values, wallet private keys, mnemonics, and hidden chain-of-thought.

## Walrus usage

Walrus stores artifact bytes and TraceLayer displays both identifiers clearly. “Verified hash” appears only after the backend reads the blob back and confirms the expected SHA-256 equals the actual readback hash.

The Phase 5 live evidence fixture records a verified testnet Walrus artifact:

- Walrus blob ID: `MAErwXd-VYEM-_5kKbJltHOu9RoKcKZRNmSmikaaDkY`
- Blob object ID: `0x9a993f6cde1aa6c0a590f24c42d28cbbc48596f75d4b685db37d6b6c42357399`
- Expected/actual SHA-256: `226af3a84545053315d7715c77b7667365c8b2a1d6f9a6ff8b785f6bfe95977b`

## Sui usage

Sui anchors compact proof metadata only, not artifact bytes. The wallet-signed anchor records the artifact hash, Walrus blob ID, artifact type, run ID, and signer-derived owner semantics. Wallet-signed anchor means `signerAddress` and `onChainOwnerAddress` match the connected wallet.

- Sui package ID: `0x97dd4dbe2ab37affdf9521ba4062a8c363bdacb4d2feb91e4920129a6c4de0ab`
- Phase 5 wallet-signed anchor tx digest: `Bj6ato28GgbfD5BDDSQdkEL52MMtck5SikCWg2pmBC3y`
- Phase 5 anchor object ID: `0x7b02de3ac9b2a51ee8dbddbca55e4917fd70413376dcb118ff1d74d0e7fe7878`
- signerAddress / onChainOwnerAddress: `0xd852497c7732b882ffc3406a1186900bcdf9bcdbd82d54ab6652ea41bb1523a9`
- anchorMode: `wallet-signed`
- serviceSigned: `false`

## Modes

- Recorded mode: product UI uses real non-secret testnet fixtures in `tracelayer/fixtures/recorded`.
- Live mode: `/demo` uses a configured BYOK OpenAI-compatible model provider, live API, Walrus testnet, and Sui testnet wallet signing.
- Dry-run/demo fallback mode: fallback state is labeled honestly; service-signed fallback is not wallet-signed ownership.

## Configure BYOK model provider

Open `http://localhost:3000/settings/model` and configure:

- Base URL, such as `https://api.openai.com/v1` or local demo-only `http://localhost:1234/v1`.
- Model name.
- Endpoint mode: Responses, Chat Completions, or Auto.
- API key.
- Storage mode: session-only by default; local persistence requires explicit opt-in.
- Optional development local relay if browser-direct provider calls are blocked.

Provider API keys stay in browser storage for the local demo flow only; this is not production-grade key storage. Keys are not sent to the TraceLayer backend, proof events, Replay Context, or recorded fixture.

## Run locally

Install dependencies:

```bash
pnpm --dir tracelayer install
```

Start the live API with your local environment configured outside version control:

```bash
pnpm --dir tracelayer dev:api:live
```

Start the web app:

```bash
pnpm --dir tracelayer dev:web
```

Open:

- `http://localhost:3000/`
- `http://localhost:3000/dashboard`
- `http://localhost:3000/settings/model`
- `http://localhost:3000/demo`
- `http://localhost:3000/runs`
- `http://localhost:3000/artifacts/artifact_run_phase_2_5_test`
- `http://localhost:3000/proofs`
- `http://localhost:3000/replay/run_phase_2_5_test`
- `http://localhost:3000/delegates`
- `http://localhost:3000/dev/anchor-smoke`

## Live demo flow

1. Configure BYOK model settings at `/settings/model`.
2. Open `/demo`.
3. Enter a non-secret task.
4. Run the model and validate the structured artifact.
5. Register the artifact with TraceLayer.
6. Upload to Walrus.
7. Verify Walrus readback hash.
8. Connect a Sui testnet wallet.
9. Prepare, sign, and record the wallet-signed Sui anchor.
10. Load Replay Context and inspect the proof trail.

## Recorded proof fallback

If live model, Walrus, Sui, or wallet services are unavailable during judging, use:

- `tracelayer/fixtures/recorded/phase5-live-model-run.testnet.json` for the successful Phase 5 live BYOK run evidence.
- Existing recorded routes for the product proof viewer and delegation receipt boundaries.

## Validate

```bash
pnpm --dir tracelayer typecheck
pnpm --dir tracelayer test
pnpm --dir tracelayer check:walrus-boundary
pnpm --dir tracelayer --filter @tracelayer/web build
```

## MVP boundaries and known limitations

TraceLayer MVP does not implement Seal, MemWal, browser Walrus upload, a generic agent framework, or encrypted delegation access enforcement. Delegation receipts are MVP audit receipts, not encrypted access enforcement. Private chain-of-thought is not requested, stored, replayed, or displayed in Replay Context. Local HTTP provider support is demo-only for loopback hosts.

## Future work

- Production-grade provider key handling.
- Richer recorded/live evidence import surfaces.
- Stronger delegation and encryption integrations.
- Additional replay visualizations and verifier export formats.
