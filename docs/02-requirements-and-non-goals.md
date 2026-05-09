# Requirements and Non-Goals

## MVP Flow

```text
agent run
  -> artifact generated
  -> sha256 calculated
  -> artifact uploaded to Walrus
  -> blob id returned
  -> run metadata saved locally
  -> artifact anchor transaction prepared/executed on Sui
  -> proof trail displayed in UI
  -> replay context can be reconstructed
```

## Required MVP Features

### 1. Demo Agent Runner

The demo runner simulates or runs a simple research task and produces one markdown artifact per run.

Each run records:
- Run ID
- Agent ID
- Owner
- Task summary
- Input preview
- Output summary
- Memory refs
- Artifact refs
- Status and timestamps

### 2. Walrus Artifact Upload

The MVP must:
- Convert the generated artifact into deterministic bytes.
- Calculate SHA-256 over the exact bytes uploaded.
- Upload the artifact to Walrus server-side.
- Store the Walrus blob ID.
- Store the Sui blob object ID when returned by the SDK.
- Support readback.
- Recompute SHA-256 after readback and compare it to the stored hash.
- Keep browser wallet upload as future work.

### 3. Sui Artifact Anchor

The MVP uses a lightweight Move object/event for anchoring artifact metadata.

Store only:
- Owner
- Run ID
- Blob ID
- Artifact hash
- Artifact type
- Created timestamp

Do not store large artifacts, private prompts, private memory contents, raw chain-of-thought, or full run logs on-chain.

### 4. Run Timeline UI

The UI must show:
- List of agent runs
- One run detail page
- Memory refs
- Artifacts
- Proof refs
- Current upload, verification, anchor, and replay status

### 5. Proof Trail UI

The proof trail must show:
- Run registered
- Artifact uploaded
- Artifact verified
- Artifact anchored
- Replay requested
- Delegate granted
- Delegate revoked

### 6. Replay Context

Replay means context reconstruction, not model-internal reasoning replay.

The MVP reconstructs:
- Task input
- Memory refs
- Artifact refs
- Blob IDs
- Hash verification state
- Previous run dependencies

It must explicitly avoid exposing private chain-of-thought.

### 7. Delegation and Revoke

The first architecture includes delegation/revoke, but the MVP keeps it lightweight:
- Local delegate records for product state.
- Sui receipt events or objects for proof trail visibility.
- Clear separation between proof receipt, actual data access, and encrypted private artifacts.

Seal and MemWal-style access control are future enhancements.

## Preferred Stack

| Layer | MVP Choice |
| --- | --- |
| Monorepo | pnpm workspace |
| Frontend | Next.js, TypeScript, Tailwind |
| Backend | Node.js, TypeScript |
| Database | SQLite, optionally Drizzle or Prisma |
| Storage | Walrus TypeScript SDK |
| Chain | Sui Move |
| Sui SDK | `@mysten/sui` |
| Walrus SDK | `@mysten/walrus` |
| Identity | Normal Sui wallet first |
| Encryption | Future Seal integration |
| Indexing | Simple event polling first |

## Explicit Non-Goals

TraceLayer must not become:
- A new AI agent framework.
- A wallet.
- A generalized storage app.
- A decentralized Dropbox.
- A generic file uploader.
- A generic dashboard.
- A generic AI chatbot.
- A full MemWal replacement.
- A full Seal encryption product.
- A general observability platform like Datadog.
- A trading or DeFi agent.
- A social app.
- A fully autonomous agent executor.
- A generic document signing app.
- A generic email or messaging app.
- A generic Walrus site builder.

## Hackathon Scope Guardrails

The MVP should optimize for:
- Working software in 2-4 weeks by a solo developer.
- Strong Walrus-native artifact story.
- Clear Sui object/event model.
- Demo clarity within five minutes.
- Minimal moving parts.
- Product language centered on Replay + Delegation + Proof Trail.

## Out of Scope Until After MVP

- Browser wallet upload as primary flow.
- User-paid Walrus storage flow.
- Full encryption UX.
- Seal access policies.
- MemWal deep integration.
- Dedicated checkpoint indexer.
- zkLogin.
- Multi-tenant hosted deployment.
- Real-time distributed tracing.
- Arbitrary agent framework plugins.
