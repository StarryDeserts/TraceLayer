import { buildRecordedProofModel } from '../_lib/proof-data.js';
import { anchorLabel, hashVerificationLabel, modeLabel } from '../_lib/proof-labels.js';
import { formatDateTime, shortMiddle } from '../_lib/format.js';
import { ButtonLink, Card, DataField, HashComparison, Identifier, KeyValue, ProductShell, ProofPathRibbon, ProofTimeline, StatusPill, Topbar, HeroPanel } from '../_components/ui.js';

export default function DashboardPage() {
  const proof = buildRecordedProofModel();
  const anchor = anchorLabel(proof.anchor);
  const hash = hashVerificationLabel(proof.artifact.expectedSha256, proof.artifact.readbackSha256);
  const badges = [modeLabel(proof.mode), hash, anchor, { tone: 'cyan' as const, text: 'Replay context ready' }, { tone: 'amber' as const, text: 'Delegation receipt preview' }];

  return (
    <ProductShell active="Dashboard" selectedRunId={proof.run.runId}>
      <Topbar current="Dashboard" badges={badges.slice(0, 3)} />
      <HeroPanel
        kicker="Proof control plane · demo command center"
        title="TraceLayer Dashboard"
        actions={
          <>
            <ButtonLink primary href={`/runs/${proof.run.runId}`}>Open latest run</ButtonLink>
            <ButtonLink href="/proofs">Open proof trail</ButtonLink>
            <ButtonLink href={proof.replay.endpoint.replace('/api/replay', '/replay')}>Open replay context</ButtonLink>
          </>
        }
        badges={badges}
      >
        Track agent artifacts from local run state to Walrus verification, wallet-signed Sui anchor, replay context, and delegation receipts.
      </HeroPanel>

      <div className="layout-grid">
        <section className="stack">
          <Card title="Latest proof run" description="Recorded testnet proof state across artifact storage, readback verification, Sui metadata anchoring, replay context, and receipt previews." action={<StatusPill label={{ tone: 'green', text: 'Complete' }} />}>
            <div className="overview-grid">
              <DataField label="Run ID" value={proof.run.runId} mono />
              <DataField label="Agent ID" value={proof.run.agentId} mono />
              <DataField label="Artifact" value={proof.artifact.name} mono />
              <DataField label="Artifact ID" value={proof.artifact.artifactId} mono />
              <DataField label="Correlation ID" value={shortMiddle(proof.run.correlationId, 14, 8)} mono />
              <DataField label="Mode" value={<StatusPill label={modeLabel(proof.mode)} />} />
              <DataField label="Verification" value={<StatusPill label={hash} />} />
              <DataField label="Walrus" value={<StatusPill label={{ tone: 'cyan', text: 'Walrus blob ID recorded' }} />} />
              <DataField label="Sui" value={<StatusPill label={anchor} />} />
              <DataField label="Delegation" value={<StatusPill label={{ tone: 'amber', text: 'Receipt preview' }} />} />
            </div>
            <ProofPathRibbon
              steps={[
                { title: 'Agent', subtitle: 'artifact', tone: 'gray' },
                { title: 'Walrus', subtitle: 'blob ID', tone: 'cyan' },
                { title: 'Readback', subtitle: 'verified', tone: 'green' },
                { title: 'Sui', subtitle: 'anchor', tone: 'purple' },
                { title: 'Proof', subtitle: 'event', tone: 'green' },
                { title: 'Replay', subtitle: 'context', tone: 'cyan' },
                { title: 'Receipt', subtitle: 'preview', tone: 'amber' },
              ]}
            />
          </Card>

          <Card title="Proof readiness" description="Each tile represents a public proof boundary that can be inspected without exposing private prompts or hidden reasoning.">
            <div className="readiness-grid">
              <article className="value-box tone-cyan">
                <StatusPill label={{ tone: 'cyan', text: 'Walrus' }} />
                <h3>Walrus blob ID</h3>
                <p className="small">Artifact bytes are addressable by a recorded real testnet Walrus blob ID.</p>
                <div className="helper"><Identifier value={proof.artifact.blobId} /></div>
              </article>
              <article className="value-box tone-green">
                <StatusPill label={hash} />
                <h3>Readback verification</h3>
                <p className="small">The expected SHA-256 and readback SHA-256 match exactly.</p>
                <div className="helper"><Identifier value={proof.artifact.expectedSha256} /></div>
              </article>
              <article className="value-box tone-purple">
                <StatusPill label={anchor} />
                <h3>Sui anchor</h3>
                <p className="small">The anchor is wallet-signed and owned by the connected testnet wallet.</p>
                <div className="helper"><Identifier value={proof.anchor.anchorTxDigest} /></div>
              </article>
              <article className="value-box tone-amber">
                <StatusPill label={{ tone: 'amber', text: 'Receipt preview' }} />
                <h3>Delegation receipt</h3>
                <p className="small">Phase 4 shows receipt semantics only; no delegation protocol logic is implemented.</p>
                <div className="helper mono">{proof.delegation.receiptId}</div>
              </article>
            </div>
          </Card>

          <Card title="Recent proof events" description="Proof trail ordered by TraceLayer’s artifact lineage path.">
            <ProofTimeline events={proof.timeline.slice(1, 5)} />
          </Card>
        </section>

        <aside className="side">
          <Card title="Selected proof" action={<StatusPill label={{ tone: 'green', text: 'Recorded testnet' }} />}>
            <KeyValue label="Network" value={proof.network} />
            <KeyValue label="Captured" value={formatDateTime(proof.run.completedAtMs)} mono />
            <KeyValue label="Wallet" value={<Identifier value={proof.anchor.connectedWalletAddress} head={10} tail={8} />} />
            <KeyValue label="On-chain owner" value={<Identifier value={proof.anchor.onChainOwnerAddress} head={10} tail={8} />} />
            <KeyValue label="Owner matches wallet" value={String(proof.anchor.ownerMatchesWallet)} />
            <div className="helper">Recorded mode uses non-secret proof IDs from the Phase 3.5 wallet-signed smoke. No fake public proof identifiers are generated.</div>
          </Card>
          <Card title="Next actions">
            <div className="stack">
              <ButtonLink primary href={`/runs/${proof.run.runId}`}>Inspect run detail</ButtonLink>
              <ButtonLink href={`/artifacts/${proof.artifact.artifactId}`}>Inspect artifact proof</ButtonLink>
              <ButtonLink href="/dev/anchor-smoke">Open developer wallet smoke</ButtonLink>
            </div>
          </Card>
          <HashComparison expected={proof.artifact.expectedSha256} readback={proof.artifact.readbackSha256} label={hash} />
        </aside>
      </div>
    </ProductShell>
  );
}
