import { ButtonLink, Card, DataField, Identifier, ProductShell, ProofTimeline, StatusPill, Topbar, HeroPanel } from '../_components/ui.js';
import { formatDateTime } from '../_lib/format.js';
import { buildRecordedProofModel } from '../_lib/proof-data.js';
import { anchorLabel, hashVerificationLabel, modeLabel } from '../_lib/proof-labels.js';

export default function ProofsPage() {
  const proof = buildRecordedProofModel();
  const hash = hashVerificationLabel(proof.artifact.expectedSha256, proof.artifact.readbackSha256);
  const anchor = anchorLabel(proof.anchor);

  return (
    <ProductShell active="Proofs" selectedRunId={proof.run.runId}>
      <Topbar current="Proofs" badges={[modeLabel(proof.mode), hash, anchor]} />
      <HeroPanel
        kicker="Proof trail · audit surface"
        title="Proof trail"
        actions={<ButtonLink primary href={`/runs/${proof.run.runId}`}>Open source run</ButtonLink>}
        badges={[{ tone: 'green', text: 'Artifact lineage complete' }, { tone: 'cyan', text: 'Walrus verified' }, { tone: 'purple', text: 'Sui anchor recorded' }]}
      >
        Follow the public proof sequence from generated artifact through Walrus readback verification, Sui anchor, proof event, replay context, and receipt preview.
      </HeroPanel>

      <div className="layout-grid">
        <section className="stack">
          <Card title="Proof events" description="A compact event timeline for verifier review and run reconstruction.">
            <ProofTimeline events={proof.timeline} />
          </Card>
        </section>

        <aside className="side">
          <Card title="Selected proof event" action={<StatusPill label={{ tone: 'green', text: 'artifact_anchored' }} />}>
            <DataField label="Correlation ID" value={proof.run.correlationId} mono />
            <div style={{ height: 10 }} />
            <DataField label="Sui tx digest" value={<Identifier value={proof.anchor.anchorTxDigest} />} />
            <div style={{ height: 10 }} />
            <DataField label="Anchor object ID" value={<Identifier value={proof.anchor.anchorObjectId} />} />
            <div className="helper">Proof events link public identifiers and status transitions; they do not contain private chain-of-thought.</div>
          </Card>
          <Card title="Audit facts">
            <DataField label="Captured" value={formatDateTime(proof.run.completedAtMs)} mono />
            <div style={{ height: 10 }} />
            <DataField label="Run ID" value={proof.run.runId} mono />
            <div style={{ height: 10 }} />
            <DataField label="Artifact ID" value={proof.artifact.artifactId} mono />
          </Card>
        </aside>
      </div>
    </ProductShell>
  );
}
