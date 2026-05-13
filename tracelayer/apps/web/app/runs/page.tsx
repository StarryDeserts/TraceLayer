import { ButtonLink, Card, DataField, Identifier, ProductShell, ProofPathRibbon, StatusPill, Topbar, HeroPanel } from '../_components/ui.js';
import { formatDateTime, shortMiddle } from '../_lib/format.js';
import { buildRecordedProofModel } from '../_lib/proof-data.js';
import { anchorLabel, hashVerificationLabel, modeLabel } from '../_lib/proof-labels.js';

export default function RunsPage() {
  const proof = buildRecordedProofModel();
  const hash = hashVerificationLabel(proof.artifact.expectedSha256, proof.artifact.readbackSha256);
  const anchor = anchorLabel(proof.anchor);

  return (
    <ProductShell active="Runs" selectedRunId={proof.run.runId}>
      <Topbar current="Runs" badges={[modeLabel(proof.mode), hash, anchor]} />
      <HeroPanel
        kicker="Runs · artifact lineage index"
        title="Agent runs"
        actions={<ButtonLink primary href={`/runs/${proof.run.runId}`}>Open recorded run</ButtonLink>}
        badges={[modeLabel(proof.mode), { tone: 'green', text: '1 verified run' }, { tone: 'purple', text: '1 wallet-signed Sui anchor' }]}
      >
        Browse TraceLayer runs by proof readiness, artifact verification, Walrus blob, Sui anchor, replay context, and receipt state.
      </HeroPanel>

      <div className="layout-grid">
        <section className="stack">
          <Card title="Run inventory" description="Recorded proof data is shown as a single verified run. Live API data can be normalized into the same shape later.">
            <div className="field-grid">
              <DataField label="Run ID" value={proof.run.runId} mono />
              <DataField label="Status" value={<StatusPill label={{ tone: 'green', text: 'Complete' }} />} />
              <DataField label="Mode" value={<StatusPill label={modeLabel(proof.mode)} />} />
              <DataField label="Artifact" value={proof.artifact.artifactId} mono />
              <DataField label="Started" value={formatDateTime(proof.run.startedAtMs)} mono />
              <DataField label="Completed" value={formatDateTime(proof.run.completedAtMs)} mono />
            </div>
            <div className="helper">
              <strong>{proof.run.taskSummary}</strong> {proof.run.outputSummary}
            </div>
            <ProofPathRibbon
              steps={[
                { title: 'Artifact', subtitle: shortMiddle(proof.artifact.artifactId, 8, 4), tone: 'gray' },
                { title: 'Walrus', subtitle: 'blob ID', tone: 'cyan' },
                { title: 'Hash', subtitle: 'verified', tone: 'green' },
                { title: 'Sui', subtitle: 'anchored', tone: 'purple' },
                { title: 'Proof', subtitle: 'event', tone: 'green' },
                { title: 'Replay', subtitle: 'ready', tone: 'cyan' },
                { title: 'Receipt', subtitle: 'preview', tone: 'amber' },
              ]}
            />
            <div className="actions" style={{ marginTop: 14 }}>
              <ButtonLink primary href={`/runs/${proof.run.runId}`}>Run detail</ButtonLink>
              <ButtonLink href={`/artifacts/${proof.artifact.artifactId}`}>Artifact detail</ButtonLink>
              <ButtonLink href="/proofs">Proof trail</ButtonLink>
            </div>
          </Card>
        </section>

        <aside className="side">
          <Card title="Index facets">
            <DataField label="Walrus blob ID" value={<Identifier value={proof.artifact.blobId} />} />
            <div style={{ height: 10 }} />
            <DataField label="Sui tx digest" value={<Identifier value={proof.anchor.anchorTxDigest} />} />
            <div style={{ height: 10 }} />
            <DataField label="Correlation ID" value={<Identifier value={proof.run.correlationId} />} />
          </Card>
        </aside>
      </div>
    </ProductShell>
  );
}
