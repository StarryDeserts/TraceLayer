# ADR 0004: Delay Seal and MemWal Deep Integration

## Status

Accepted for MVP architecture.

## Context

TraceLayer should eventually support encrypted private artifacts and richer memory references. Seal and MemWal-style integrations are natural future directions. However, adding encrypted access control and memory-policy semantics in the first version would expand the scope beyond a solo-developer 2-4 week hackathon MVP.

The MVP needs to demonstrate Replay + Delegation + Proof Trail clearly before adding cryptographic access enforcement.

## Decision

Delay Seal and full MemWal integration until after the MVP. The MVP uses:
- Non-sensitive demo artifacts.
- Memory references without private memory plaintext.
- Local delegation records.
- Optional Sui grant/revoke receipt events.
- Clear UI language distinguishing proof receipts from actual access control.

Future versions can encrypt artifacts before Walrus upload and enforce access through Seal or a MemWal-like policy layer.

## Consequences

Positive:
- Keeps MVP buildable and demoable.
- Avoids misleading half-built encryption.
- Lets the product first prove artifact lineage and replay context.
- Keeps security claims honest.

Negative:
- MVP delegation is receipt-only.
- MVP revoke does not cryptographically remove access.
- Private artifacts cannot be safely uploaded in plaintext.
- Some judges may ask about actual access enforcement.

Mitigation:
- Make the receipt vs access-control distinction explicit in docs and UI.
- Use only synthetic non-sensitive artifacts in the demo.
- Present Seal/MemWal integration as a clear future roadmap.

## Alternatives Considered

### Integrate Seal in MVP

Rejected because encryption UX, key management, and revoke semantics would add significant risk.

### Integrate MemWal deeply in MVP

Rejected because TraceLayer must not become an AI memory product or MemWal replacement.

### Omit delegation entirely

Rejected because delegation/revoke is part of the differentiator. The MVP keeps it lightweight as proof receipts.

### Claim access control without encryption

Rejected because it would be misleading and unsafe.
