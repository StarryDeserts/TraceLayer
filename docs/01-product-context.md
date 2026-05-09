# Product Context

## What TraceLayer Is

TraceLayer is an agent observability and control plane for verifiable artifacts and run lineage on Walrus. It lets developers inspect what an agent run produced, where generated artifacts live, which memory references were used, whether artifact bytes match their recorded hash, whether a Sui anchor exists, and which delegation or revoke receipts were created.

TraceLayer does not execute arbitrary autonomous agents as its core product. The MVP includes a demo runner only to generate traceable artifacts for the proof trail.

## Who Uses It

Primary users:
- AI agent developers who need to debug and audit agent outputs.
- Sui/Walrus builders who want durable, verifiable artifact storage.
- Hackathon judges evaluating whether agent output provenance is clear and replayable.

Secondary users:
- Security reviewers checking whether an agent exposed sensitive context.
- Teams that need a lightweight proof trail for generated reports, patches, or research artifacts.

## Problem It Solves

Agent systems often produce useful artifacts but leave weak answers to provenance questions:
- What did this run produce?
- Which inputs and memory references shaped the output?
- Where is the generated artifact stored?
- Can the bytes be independently verified later?
- Which Walrus blob belongs to this run?
- Was the artifact anchored on Sui?
- Who received delegated visibility, and was it revoked?
- Can the run context be reconstructed without exposing private chain-of-thought?

TraceLayer solves this by separating artifact availability, proof anchoring, local run indexing, and replay context reconstruction.

## Why It Belongs in the Walrus Track

Walrus is central to the product, not an interchangeable file backend. TraceLayer uses Walrus for durable artifact availability and later audit. The proof trail starts from exact artifact bytes, computes a SHA-256 digest, stores the artifact on Walrus, records the Walrus blob ID, optionally records the Sui blob object ID, and verifies readback bytes against the stored digest.

The demo should make Walrus visible: users see the artifact, hash, blob ID, readback verification status, and Sui anchor that references the Walrus blob.

## Why It Is Not a Generic Dashboard

TraceLayer is scoped around run lineage and proof semantics. Its screens are not arbitrary charts over logs; they answer proof questions: what artifact exists, where it is stored, which run created it, how its bytes are verified, which Sui receipt anchors it, and what context can be reconstructed for replay.

The core interaction is not browsing files or metrics. The core interaction is following a verifiable proof trail from agent run to Walrus artifact to Sui anchor to replay context.

## Why It Is Realistic for a Solo Developer

The MVP avoids building an agent framework, wallet, hosted observability backend, custom indexer, encryption platform, or generalized storage product. It uses a narrow demo runner, server-side Walrus upload, SQLite/local metadata, lightweight Sui Move receipts, simple event polling, and a focused Next.js UI.

A solo developer can deliver it in 2-4 weeks because each subsystem is small and independently demoable:
- Generate one markdown artifact.
- Hash and upload it.
- Store local metadata.
- Anchor compact proof data.
- Render a proof timeline.
- Reconstruct replay context.
- Show grant/revoke receipts.

## Five-Minute Demo Promise

In five minutes, the demo should show:
1. Start a demo agent run.
2. Produce a markdown artifact.
3. Upload it to Walrus and display the blob ID.
4. Read it back and verify the SHA-256 hash.
5. Anchor compact artifact metadata on Sui.
6. Display proof events for run, upload, verification, anchor, replay, delegate grant, and delegate revoke.
7. Reconstruct replay context without exposing private chain-of-thought.

## Positioning Statement

TraceLayer is the agent observability and control plane for verifiable artifacts and run lineage on Walrus: a focused developer tool for replay, delegation, and proof trails.