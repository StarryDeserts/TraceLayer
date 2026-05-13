# Security and Privacy

## Security Posture

TraceLayer should be honest about what it proves. The MVP proves artifact byte integrity and compact proof receipts. It does not provide full encrypted access control, legal-grade audit guarantees, or private reasoning replay.

## Walrus Public Data Model

Walrus blobs may be public or discoverable by default. Treat uploaded bytes as visible to others unless they are encrypted before upload.

MVP rule:
- Upload only non-sensitive demo artifacts in plaintext.
- Do not upload private memory plaintext.
- Do not upload private prompts, secrets, credentials, or private chain-of-thought.

## Sensitive Artifact Handling

Before upload, classify artifacts:

| Artifact | MVP Handling | Future Handling |
| --- | --- | --- |
| Demo markdown report | Plaintext allowed | Optional encryption |
| Private prompt bundle | Do not upload plaintext | Encrypt before upload |
| Memory reference manifest | Store refs only | Encrypt manifest |
| Tool output | Redact before upload | Encrypt and policy-gate |
| Screenshots | Avoid sensitive screenshots | Encrypt if private |

## Hash Verification

Hash verification is required for proof trails:
- Hash exact uploaded bytes.
- Store SHA-256 with artifact metadata.
- Read back bytes from Walrus.
- Recompute SHA-256.
- Compare expected vs actual before marking verified.
- Decode after verification when integrity matters.

Hash verification does not protect confidentiality. Encryption is separate.

## Server-Signed Walrus Upload and Sui Anchor Risks

Server-side Walrus upload is chosen for MVP reliability, but it carries risks:
- Server signer pays fees and uploads bytes to Walrus.
- Private key custody is centralized.
- Backend compromise could upload incorrect records.
- Environment variables can be leaked if misconfigured.

Server-signed Sui anchors are different from server-signed Walrus uploads. If the Move module stores `owner = tx_context::sender(ctx)`, a server-signed Sui anchor is owned by the service signer, not by the user's wallet. It is allowed only as a service-signed fallback proof.

MVP safeguards:
- Keep signer loading server-only.
- Never expose private keys to browser bundles.
- Never put private keys in `NEXT_PUBLIC_*` variables.
- Log only non-secret identifiers.
- Show when a proof was server-signed.
- Prefer wallet-signed Sui anchors so the on-chain owner is the connected wallet.
- Require human review of signer custody before real deployment.

## Frontend Key Handling

The frontend may connect to a normal Sui wallet for identity and wallet-signed Sui anchors. It must not receive server private keys.

Allowed in frontend:
- Public package IDs
- Public network names
- Public blob IDs
- Public transaction digests
- Connected wallet address

Not allowed in frontend:
- Server private key
- Mnemonic
- Raw secret key bytes
- Upload relay private credentials
- Hidden API admin tokens

## Wallet-Signed Browser Upload Future Path

Future browser upload should use wallet signing and Walrus flow APIs. This path improves user custody but adds UX and reliability challenges:
- Popup blockers
- Multi-step register/upload/certify UX
- WASM bundling
- Relay CORS and limits
- Mobile memory constraints
- Resume after failure

It should be added only after the server-side MVP is working.

## Sui Public Metadata Risks

Everything stored in Sui objects/events is public. Do not put sensitive text on-chain.

Safe MVP fields:
- Owner address
- Run ID if non-sensitive
- Blob ID
- Artifact hash
- Artifact type
- Created timestamp
- Policy hash

Review carefully:
- Human-readable task summaries
- Memory labels
- Delegate relationships
- Artifact types that reveal sensitive business context

## Replay Privacy

Replay must reconstruct context without revealing private model internals.

Replay may show:
- Sanitized input preview
- Hashes
- Memory ref labels
- Artifact refs
- Blob IDs
- Verification status
- Previous dependency IDs

Replay must not show:
- Private chain-of-thought
- Hidden model reasoning
- Private memory plaintext
- Secrets from tool output
- Unredacted prompt bundles

## Delegation and Revoke Semantics

MVP delegation/revoke is receipt-based.

A grant receipt means:
- The app recorded an intent to delegate a scope.
- The proof trail can show the grant.
- Sui can mirror the receipt publicly if configured.

A revoke receipt means:
- The app recorded an intent to revoke a prior grant.
- The proof trail can show the revoke.
- Sui can mirror the receipt publicly if configured.

Neither receipt means:
- The delegate cryptographically gained access.
- The delegate cryptographically lost access.
- Already viewed plaintext became inaccessible.

Actual access control requires encrypted artifacts and key management, likely through Seal or a similar policy layer.

## Proof Receipt vs Actual Access Control

| Concept | MVP | Future |
| --- | --- | --- |
| Proof receipt | Local DB + optional Sui event | Same, with richer policies |
| Data access | App-level UI filtering | Cryptographic access to encrypted blobs |
| Revoke | Product-state receipt | Key rotation or policy update |
| Private artifact | Avoid plaintext upload | Encrypt before Walrus upload |

## Deployment Safety

Before public deployment:
- Re-check official Walrus and Sui SDK docs.
- Confirm relay/RPC endpoints and costs.
- Confirm Move package IDs and upgrade policy.
- Use secret manager or local `.env` excluded from git.
- Add size limits to upload endpoints.
- Add redaction checks for demo artifacts.
- Review all public metadata fields.

## Human Review Required

A human must review:
- Private key and signer loading.
- Wallet transaction UX.
- Move authorization and object ownership.
- Hash canonicalization.
- Public/private data classification.
- Seal/MemWal future integration design.
- Any deployment using real user data.
