# TraceLayer Architecture Index

**Positioning:** Agent Observability & Control Plane on Walrus

TraceLayer helps AI agent developers inspect, replay, verify, and control agent runs, generated artifacts, memory references, and permission events using Walrus and Sui. It is a developer tool for verifiable artifact lineage and run reconstruction, not an agent platform or generic storage dashboard.

## Architecture Design Mode

Detected Skills:
- Superpowers: `superpowers:brainstorming`, `superpowers:writing-plans`, `superpowers:executing-plans`, `superpowers:subagent-driven-development`
- Walrus: `walrus-ts-sdk-dev`
- Sui: `sui-dev-skills`, `sui-client`, `sui-transaction-building`
- Current docs references: Context7 `/websites/sdk_mystenlabs_walrus` and `/websites/sdk_mystenlabs`

No implementation, scaffolding, package installation, Move publishing, Walrus upload, or Sui transaction execution is part of this architecture pass.

## MVP Summary

The MVP starts with a demo agent run that produces one markdown artifact. TraceLayer hashes the exact artifact bytes, uploads them to Walrus, stores local run and artifact metadata, anchors compact artifact proof metadata on Sui, displays a proof trail, and reconstructs a replay context from task input, memory refs, artifact refs, blob IDs, hash verification state, and prior run dependencies.

## Non-Goal Summary

TraceLayer must not be framed as an AI memory dashboard. It is also not a new AI agent framework, wallet, generalized storage app, decentralized Dropbox, MemWal replacement, Seal encryption product, Datadog clone, social app, trading agent, or fully autonomous executor. The MVP stays narrow: Replay + Delegation + Proof Trail for verifiable agent artifacts on Walrus.

## Document Reading Order

1. [Product Context](01-product-context.md)
2. [Requirements and Non-Goals](02-requirements-and-non-goals.md)
3. [System Architecture](03-system-architecture.md)
4. [Data Model](04-data-model.md)
5. [Walrus Integration](05-walrus-integration.md)
6. [Sui Move Architecture](06-sui-move-architecture.md)
7. [API Design](07-api-design.md)
8. [Frontend UX Architecture](08-frontend-ux-architecture.md)
9. [Proof Trail and Replay](09-proof-trail-and-replay.md)
10. [Security and Privacy](10-security-and-privacy.md)
11. [MVP Implementation Plan](11-mvp-implementation-plan.md)
12. [Demo Script](12-demo-script.md)

## Architecture Decision Records

- [ADR 0001: Use server-side Walrus upload for MVP](adr/0001-use-server-side-walrus-upload-for-mvp.md)
- [ADR 0002: Use lightweight Sui artifact anchor](adr/0002-use-lightweight-sui-artifact-anchor.md)
- [ADR 0003: Store run metadata offchain and anchor artifacts onchain](adr/0003-store-run-metadata-offchain-and-anchor-artifacts-onchain.md)
- [ADR 0004: Delay Seal and MemWal deep integration](adr/0004-delay-seal-and-memwal-deep-integration.md)

## MVP vs Future Boundary

| Capability | MVP | Future |
| --- | --- | --- |
| Agent execution | Demo research runner that generates one markdown artifact | External agent SDK integrations and imported run traces |
| Walrus upload | Server-side upload from Node runtime | Browser wallet upload with `writeBlobFlow` / `writeFilesFlow` |
| Artifact privacy | Non-sensitive demo artifacts only | Client-side encryption and Seal-backed access flows |
| Sui usage | Lightweight artifact anchor and receipt events | Richer package, upgraded registry, custom indexer |
| Run metadata | SQLite/local app database | Multi-project hosted database and sync |
| Indexing | Simple event polling | Dedicated checkpoint/event indexer |
| Identity | Local demo identity plus normal Sui wallet ownership | zkLogin and team accounts |
| Delegation | Local records plus Sui receipt events | Enforced encrypted access control through Seal/MemWal-like policies |
| Replay | Context reconstruction without chain-of-thought | Dependency graph replay, imported traces, evaluator replay |

## SDK Verification Note

The docs use the current planning assumption that Walrus integrates through `new SuiGrpcClient({ network, baseUrl }).$extend(walrus(...))`, with raw blob upload/read via `client.walrus.writeBlob(...)` and `client.walrus.readBlob({ blobId })`. Version-sensitive details must be re-checked before implementation.

Mark these with `TODO verify against official docs before use` in implementation tasks:
- Exact `@mysten/walrus` and `@mysten/sui` versions
- `SuiGrpcClient` constructor options and network strings
- `walrus()` options such as `uploadRelay`, `storageNodeClientOptions`, `wasmUrl`, and `packageConfig`
- `writeBlob`, `writeFiles`, `writeBlobFlow`, and `writeFilesFlow` return fields
- Upload relay host, `/v1/tip-config`, tip shape, auth, and limits
- Public publisher/aggregator URLs and CORS behavior
- Walrus object/package IDs, storage epochs, and cost fields
- Sui package IDs, event query APIs, transaction response shape, and indexing behavior

## Open Questions Summary

Detailed open questions are tracked in [MVP Implementation Plan](11-mvp-implementation-plan.md#open-questions). Highest-priority items before implementation:
- Confirm current Walrus TypeScript SDK upload/read/relay syntax.
- Confirm current Sui SDK transaction execution and event query syntax.
- Decide whether the demo must execute real testnet Sui/Walrus calls live or can use pre-recorded fallback records.
- Confirm hackathon submission requirements for deployed app, repo, video, and testnet proof artifacts.
