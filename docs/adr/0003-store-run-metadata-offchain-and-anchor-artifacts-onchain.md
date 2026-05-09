# ADR 0003: Store Run Metadata Offchain and Anchor Artifacts Onchain

## Status

Accepted for MVP architecture.

## Context

Agent runs include task summaries, input previews, memory references, artifact references, proof events, and delegation state. Some of this data is private, some can be large, and some changes as local verification or replay occurs. Sui is public and not suited for large or sensitive run metadata.

Walrus is suited for durable artifact bytes and optional manifests. The local database is suited for operational UI queries.

## Decision

Store run metadata in the local application database for MVP. Store artifact bytes on Walrus. Anchor compact artifact proof metadata on Sui.

The local DB maps:
- Run ID to run metadata.
- Artifact ID to Walrus blob ID, blob object ID, hash, type, byte length, and status.
- Proof events to local and on-chain receipts.
- Delegate events to local state and optional Sui receipts.

Sui stores only compact proof claims. Walrus stores artifact bytes and may store future proof manifests.

## Consequences

Positive:
- Keeps UI fast and simple.
- Avoids putting private or large metadata on-chain.
- Preserves a strong Walrus-native artifact story.
- Makes replay context assembly straightforward.
- Allows future encrypted manifests without changing the core model.

Negative:
- Local DB is an operational dependency.
- Full run reconstruction depends on local metadata unless exported manifests are added.
- Users must understand that Sui anchors do not contain full run state.

## Alternatives Considered

### Store everything on Walrus

Rejected because the app still needs an operational index and Sui proof receipts. Walrus is storage, not the whole control plane.

### Store everything on Sui

Rejected due to cost, privacy, and unnecessary complexity.

### Use a hosted database from day one

Rejected for MVP because SQLite is simpler for a solo developer and hackathon demo. Hosted persistence can be added after the flow works.

### Store encrypted run manifests on Walrus in MVP

Deferred. This is valuable but adds encryption/key-policy scope that would distract from the initial proof trail.
