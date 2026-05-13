# ADR 0002: Use Lightweight Sui Artifact Anchor

## Status

Accepted for MVP architecture.

## Context

TraceLayer needs to prove that an agent artifact stored on Walrus is linked to a run. Sui should provide durable, public proof metadata, but storing large artifacts or full run context on-chain would be expensive, public, and unnecessary.

## Decision

Use a lightweight Sui artifact anchor. The MVP Move module creates one compact anchor object/event per important artifact with:
- Owner
- Run ID
- Walrus blob ID
- Artifact hash
- Artifact type
- Created timestamp
- Schema version

The artifact bytes remain on Walrus. Operational run metadata remains in the local database. The preferred MVP path is wallet-signed, so `owner = tx_context::sender(ctx)` is the connected wallet. Server-signed anchors are allowed only as fallback and are service-owned proofs unless a future module stores a separate `claimed_owner` app claim.

## Consequences

Positive:
- Clear Sui object/event story.
- Low on-chain storage footprint.
- Easy to explain in a 5-minute demo.
- Avoids reimplementing Walrus or an indexer inside Move.
- Keeps private content off-chain.

Negative:
- Sui is not the full query layer.
- Run details can be lost if the local DB is deleted unless manifests are later stored on Walrus.
- Public blob IDs and artifact hashes may leak metadata.
- Anchor object ownership must be labeled carefully: wallet-signed anchors are user-owned; server-signed fallback anchors are service-owned.

## Alternatives Considered

### Store full run metadata on-chain

Rejected because it increases cost, leaks metadata, and bloats the contract.

### Event-only anchors

Considered. Events are query-friendly and cheaper conceptually, but an owned object improves explorer visibility and gives a durable object reference for the demo. MVP can emit both object and event.

### Shared global registry

Rejected for MVP because shared objects add complexity and potential hot-object concerns. A local DB plus per-artifact owned anchors is simpler.

### No Sui anchor

Rejected because the Walrus track project needs a clear Sui proof model and object/event story.
