import { Brand, ButtonLink, Card, DataField, HashComparison, Identifier, ProofPathRibbon, StatusPill } from './_components/ui.js';
import { buildRecordedProofModel } from './_lib/proof-data.js';
import { anchorLabel, hashVerificationLabel, modeLabel } from './_lib/proof-labels.js';

export default function Page() {
  const proof = buildRecordedProofModel();
  const hash = hashVerificationLabel(proof.artifact.expectedSha256, proof.artifact.readbackSha256);
  const anchor = anchorLabel(proof.anchor);

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <Brand href="/" />
        <nav className="landing-links" aria-label="Landing">
          <a href="#storage">Storage</a>
          <a href="#anchor">Sui Anchor</a>
          <a href="/proofs">Proof Trail</a>
          <a href="/replay/run_phase_2_5_test">Replay Context</a>
          <a href="/delegates">Delegation Receipts</a>
          <ButtonLink href="/dashboard" primary>Open dashboard</ButtonLink>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div>
            <div className="kicker">Proof control plane for agent runs</div>
            <h1>TraceLayer</h1>
            <p className="landing-sub">TraceLayer is an Agent Observability &amp; Control Plane on Walrus. It tracks an agent run from local execution state to Walrus artifact storage, SHA-256 readback verification, wallet-signed Sui proof anchoring, Proof Trail, Replay Context, and Delegation Receipts.</p>
            <div className="actions" style={{ marginTop: 28 }}>
              <ButtonLink href="/dashboard" primary>Open proof dashboard</ButtonLink>
              <ButtonLink href={`/runs/${proof.run.runId}`}>Inspect recorded run</ButtonLink>
            </div>
            <div className="badges" style={{ marginTop: 18 }}>
              <StatusPill label={modeLabel(proof.mode)} />
              <StatusPill label={hash} />
              <StatusPill label={anchor} />
              <StatusPill label={{ tone: 'cyan', text: 'Replay ready' }} />
            </div>
          </div>

          <aside className="card" aria-label="Proof chain preview">
            <div className="card-body">
              <div className="card-head" style={{ padding: 0, borderBottom: 0, marginBottom: 14 }}>
                <div>
                  <div className="card-title">Selected proof chain</div>
                  <p>Recorded testnet proof data, not fabricated demo IDs.</p>
                </div>
                <StatusPill label={{ tone: 'green', text: 'Complete' }} />
              </div>
              <ProofPathRibbon
                steps={[
                  { title: 'Agent', subtitle: 'artifact', tone: 'gray' },
                  { title: 'Walrus', subtitle: 'blob', tone: 'cyan' },
                  { title: 'Readback', subtitle: 'hash', tone: 'green' },
                  { title: 'Sui', subtitle: 'anchor', tone: 'purple' },
                  { title: 'Proof', subtitle: 'event', tone: 'green' },
                  { title: 'Replay', subtitle: 'context', tone: 'cyan' },
                  { title: 'Receipt', subtitle: 'scope', tone: 'amber' },
                ]}
              />
              <div className="proof-grid" style={{ marginTop: 14 }}>
                <DataField label="Walrus blob ID" value={<Identifier value={proof.artifact.blobId} />} />
                <DataField label="Sui tx digest" value={<Identifier value={proof.anchor.anchorTxDigest} />} />
                <DataField label="Signer" value={<Identifier value={proof.anchor.signerAddress} />} />
                <DataField label="Owner match" value={String(proof.anchor.ownerMatchesWallet)} />
              </div>
            </div>
          </aside>
        </section>

        <ProofSection
          id="storage"
          kicker="Walrus artifact storage"
          title="Public artifact bytes with verified readback."
          points={["Walrus blob ID is shown explicitly, not renamed as a generic file ID.", "The artifact hash is compared against readback bytes before the UI says Verified hash.", "Walrus blob object ID stays distinct from the TraceLayer Sui anchor object."]}
        >
          <Card title="Walrus proof" description="Recorded Phase 2.5 live Walrus smoke fixture.">
            <DataField label="Walrus blob ID" value={<Identifier value={proof.artifact.blobId} />} />
            <div style={{ height: 10 }} />
            <DataField label="Walrus blob object ID" value={<Identifier value={proof.artifact.blobObjectId} />} />
            <div style={{ height: 10 }} />
            <HashComparison expected={proof.artifact.expectedSha256} readback={proof.artifact.readbackSha256} label={hash} />
          </Card>
        </ProofSection>

        <ProofSection
          id="anchor"
          kicker="Wallet-signed Sui anchor"
          title="Ownership semantics stay visible."
          points={["Wallet-signed proof is labeled only when serviceSigned is false.", "Sui stores compact proof metadata only, not artifact bytes.", "The on-chain owner address is displayed separately from the connected wallet address.", "Server-signed fallback copy is reserved for fallback data and never implies user ownership."]}
        >
          <Card title="Sui anchor" description="Recorded Phase 3.5 wallet-signed anchor fixture." action={<StatusPill label={anchor} />}>
            <div className="proof-grid">
              <DataField label="Package ID" value={<Identifier value={proof.anchor.packageId} />} />
              <DataField label="Anchor object ID" value={<Identifier value={proof.anchor.anchorObjectId} />} />
              <DataField label="Anchor tx digest" value={<Identifier value={proof.anchor.anchorTxDigest} />} />
              <DataField label="On-chain owner" value={<Identifier value={proof.anchor.onChainOwnerAddress} />} />
            </div>
          </Card>
        </ProofSection>

        <ProofSection
          id="replay"
          kicker="Replay context"
          title="Reconstruct runs without exposing private reasoning."
          points={["Replay Context shows observable inputs, references, outputs, and proof events.", "Private chain-of-thought is not included.", "The replay surface uses the existing replay API boundary."]}
        >
          <Card title="Replay packet" description="Verifier-oriented run reconstruction context.">
            <div className="field-grid">
              <DataField label="Replay endpoint" value={proof.replay.endpoint} mono />
              <DataField label="Packet ID" value={proof.replay.packetId} mono />
              <DataField label="Private reasoning included" value={String(proof.replay.includesPrivateReasoning)} mono />
            </div>
            <div className="helper">Private chain-of-thought is not included; Replay Context shows observable proof state only.</div>
          </Card>
        </ProofSection>

        <ProofSection
          id="delegation"
          kicker="Delegation receipts"
          title="Receipt semantics without Phase 4 protocol scope creep."
          points={["Phase 4 displays receipt copy and proof references only.", "No Seal, MemWal, browser Walrus upload, or delegation protocol logic is implemented.", "Receipts point back to proof trail identifiers for review."]}
        >
          <Card title="Proof receipt" description="Receipt preview linked to the recorded proof chain." action={<StatusPill label={{ tone: 'amber', text: 'Preview only' }} />}>
            <div className="proof-grid">
              <DataField label="Receipt ID" value={proof.delegation.receiptId} mono />
              <DataField label="Scope" value={proof.delegation.scope} />
              <DataField label="Status" value={proof.delegation.status} />
              <DataField label="Correlation ID" value={proof.run.correlationId} mono />
            </div>
          </Card>
        </ProofSection>

        <section className="cta">
          <div>
            <h2>Inspect the verified proof chain.</h2>
            <p>Open the dashboard to review the recorded testnet Walrus proof, wallet-signed Sui anchor, proof trail, replay context, and receipt surface.</p>
          </div>
          <div className="actions">
            <ButtonLink primary href="/dashboard">Open dashboard</ButtonLink>
            <ButtonLink href="/dev/anchor-smoke">Developer smoke page</ButtonLink>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>TraceLayer · Agent Observability & Control Plane on Walrus</span>
        <span>Recorded testnet proof data</span>
      </footer>
    </div>
  );
}

function ProofSection({ id, kicker, title, points, children }: { id: string; kicker: string; title: string; points: string[]; children: React.ReactNode }) {
  return (
    <section id={id} className="landing-section">
      <div className="section-copy">
        <div className="eyebrow">{kicker}</div>
        <h2>{title}</h2>
        <div className="points">
          {points.map((point) => (
            <div key={point} className="point">{point}</div>
          ))}
        </div>
      </div>
      {children}
    </section>
  );
}
