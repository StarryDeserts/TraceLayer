# ADR 0001: Use Server-Side Walrus Upload for MVP

## Status

Accepted for MVP architecture.

## Context

TraceLayer needs a reliable hackathon demo where a generated agent artifact is uploaded to Walrus, read back, verified, and shown in a proof trail. Browser direct upload is possible but introduces multi-step wallet UX, popup blockers, WASM bundling, relay configuration, CORS, mobile resource limits, and resume-state complexity.

The MVP is built by a solo developer in 2-4 weeks. The fastest path to a stable demo is a server-side Node upload flow.

## Decision

Use server-side Walrus upload for the MVP. The API runs in a Node runtime, loads signer material only on the server, computes SHA-256 over exact artifact bytes, uploads with the Walrus TypeScript SDK, stores blob references locally, and supports readback verification.

Browser wallet upload remains future work using `writeBlobFlow` or `writeFilesFlow`.

## Consequences

Positive:
- Simpler and more reliable demo.
- Avoids browser WASM and popup issues in MVP.
- Keeps upload and verification code centralized.
- Makes dry-run and fallback modes easier.

Negative:
- Server signer custody must be reviewed.
- Server may pay storage/write fees.
- User-paid, user-signed upload is not demonstrated in MVP.
- Backend compromise could upload or anchor incorrect records.

Required safeguards:
- No private keys in frontend.
- No private keys in `NEXT_PUBLIC_*`.
- Node runtime only for upload routes.
- Human review of signer loading before real deployment.

## Alternatives Considered

### Browser wallet upload first

Rejected for MVP because it increases UX and infrastructure risk. It remains the preferred future custody model.

### HTTP publisher/aggregator only

Rejected as the primary architecture because the project should demonstrate direct Walrus SDK concepts and proof linkage. It may be used as a fallback only after official endpoint behavior is verified.

### Local-only fake uploads

Rejected because the Walrus track story depends on real Walrus artifact storage. Dry-run is allowed for development, but the demo should include at least one real blob proof.
