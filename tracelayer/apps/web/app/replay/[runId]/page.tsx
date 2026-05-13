import { RecordedProofNotFound } from '../../_components/not-found-panel.js';
import { ButtonLink, Card, DataField, Identifier, KeyValue, ProductShell, StatusPill, Topbar, HeroPanel } from '../../_components/ui.js';
import { buildRecordedProofModel } from '../../_lib/proof-data.js';
import { anchorLabel, hashVerificationLabel, modeLabel } from '../../_lib/proof-labels.js';

export default async function ReplayPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const proof = buildRecordedProofModel();
  if (runId !== proof.run.runId) {
    return <RecordedProofNotFound active="Replay" requestedId={runId} canonicalHref={`/replay/${proof.run.runId}`} canonicalLabel="Open recorded replay" />;
  }
  const hash = hashVerificationLabel(proof.artifact.expectedSha256, proof.artifact.readbackSha256);
  const anchor = anchorLabel(proof.anchor);

  return (
    <ProductShell active="Replay" selectedRunId={runId}>
      <Topbar current="Replay" badges={[modeLabel(proof.mode), hash, anchor]} />
      <HeroPanel
        kicker="Replay context · observable reconstruction"
        title={<><span>Replay </span><span className="mono">{runId}</span></>}
        actions={
          <>
            <ButtonLink primary href={`/runs/${proof.run.runId}`}>Open run</ButtonLink>
            <ButtonLink href="/proofs">Open proof trail</ButtonLink>
          </>
        }
        badges={[{ tone: 'cyan', text: 'Replay context ready' }, { tone: 'gray', text: 'No private chain-of-thought' }, { tone: 'green', text: 'Proof-linked' }]}
      >
        Reconstruct the observable inputs, references, outputs, artifact proof, and verification state for a run without exposing hidden model reasoning.
      </HeroPanel>

      <div className="layout-grid">
        <section className="stack">
          <Card title="Replay packet" description="A verifier-oriented packet assembled from run metadata, artifact proof, and proof events.">
            <div className="field-grid">
              <DataField label="Packet ID" value={proof.replay.packetId} mono />
              <DataField label="Run ID" value={runId} mono />
              <DataField label="Replay API" value={proof.replay.endpoint} mono />
              <DataField label="Input preview" value={proof.run.inputPreview} />
              <DataField label="Output summary" value={proof.run.outputSummary} />
              <DataField label="chainOfThoughtIncluded" value={String(proof.replay.includesPrivateReasoning)} mono />
              <DataField label="Private chain-of-thought is not included" value={String(!proof.replay.includesPrivateReasoning)} mono />
            </div>
            <div className="helper"><strong>Private chain-of-thought is not included.</strong> <span className="mono">chainOfThoughtIncluded=false</span>. Replay Context is an observable reconstruction packet grounded in proof events and artifact metadata.</div>
          </Card>

          <Card title="Context references" description="The references a verifier can use to reconstruct the run path.">
            <div className="readiness-grid">
              {proof.replay.contextRefs.map((ref) => (
                <div key={ref} className="value-box">
                  <StatusPill label={{ tone: ref.includes('Walrus') ? 'cyan' : ref.includes('Sui') ? 'purple' : ref.includes('proof') ? 'green' : 'gray', text: ref }} />
                </div>
              ))}
            </div>
          </Card>
        </section>

        <aside className="side">
          <Card title="Replay proof anchors">
            <KeyValue label="Walrus blob ID" value={<Identifier value={proof.artifact.blobId} />} />
            <KeyValue label="Artifact hash" value={<Identifier value={proof.artifact.expectedSha256} />} />
            <KeyValue label="Sui tx digest" value={<Identifier value={proof.anchor.anchorTxDigest} />} />
            <KeyValue label="Proof correlation" value={<Identifier value={proof.run.correlationId} />} />
            <div className="helper">The frontend displays replay state only. It uses the existing replay API path and does not introduce a new agent framework.</div>
          </Card>
        </aside>
      </div>
    </ProductShell>
  );
}
