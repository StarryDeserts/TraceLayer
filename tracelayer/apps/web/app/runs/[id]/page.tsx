import { RecordedProofNotFound } from '../../_components/not-found-panel.js';
import { ButtonLink, Card, DataField, HashComparison, Identifier, KeyValue, ProductShell, ProofTimeline, StatusPill, Topbar, HeroPanel } from '../../_components/ui.js';
import { formatDateTime } from '../../_lib/format.js';
import { buildRecordedProofModel } from '../../_lib/proof-data.js';
import { anchorLabel, hashVerificationLabel, modeLabel } from '../../_lib/proof-labels.js';

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proof = buildRecordedProofModel();
  if (id !== proof.run.runId) {
    return <RecordedProofNotFound active="Runs" requestedId={id} canonicalHref={`/runs/${proof.run.runId}`} canonicalLabel="Open recorded run" />;
  }
  const hash = hashVerificationLabel(proof.artifact.expectedSha256, proof.artifact.readbackSha256);
  const anchor = anchorLabel(proof.anchor);

  return (
    <ProductShell active="Runs" selectedRunId={id}>
      <Topbar current="Runs" badges={[modeLabel(proof.mode), hash, anchor]} />
      <HeroPanel
        kicker="Run detail · proof inspection"
        title={<><span>Run </span><span className="mono">{id}</span></>}
        actions={
          <>
            <ButtonLink primary href={`/artifacts/${proof.artifact.artifactId}`}>Inspect artifact</ButtonLink>
            <ButtonLink href={`/replay/${proof.run.runId}`}>Reconstruct replay</ButtonLink>
          </>
        }
        badges={[modeLabel(proof.mode), hash, { tone: 'cyan', text: 'Uploaded to Walrus' }, anchor]}
      >
        Agent demo produced a markdown artifact and completed Walrus verification plus a wallet-signed Sui anchor.
      </HeroPanel>

      <div className="layout-grid">
        <section className="stack">
          <Card title="Run context" description="Observable run inputs, references, output summary, and execution metadata.">
            <div className="field-grid">
              <DataField label="Run ID" value={proof.run.runId} mono />
              <DataField label="Agent ID" value={proof.run.agentId} mono />
              <DataField label="Owner wallet" value={<Identifier value={proof.run.ownerAddress} head={10} tail={8} />} />
              <DataField label="Mode" value={proof.mode} />
              <DataField label="Started" value={formatDateTime(proof.run.startedAtMs)} mono />
              <DataField label="Completed" value={formatDateTime(proof.run.completedAtMs)} mono />
              <DataField label="Status" value={<StatusPill label={{ tone: 'green', text: 'Complete' }} />} />
              <DataField label="Correlation ID" value={proof.run.correlationId} mono />
              <DataField label="Previous dependencies" value="none" />
            </div>
            <div className="field-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginTop: 10 }}>
              <DataField label="Task summary" value={proof.run.taskSummary} />
              <DataField label="Input preview" value={proof.run.inputPreview} />
              <DataField label="Output summary" value={proof.run.outputSummary} />
              <DataField label="Context refs" value={proof.replay.contextRefs.join(', ')} />
            </div>
            <div className="helper"><strong>Private chain-of-thought is not included.</strong> Run context shows observable inputs, refs, outputs, and metadata — not hidden model reasoning.</div>
          </Card>

          <Card title="Artifact verification" description="Walrus readback result and expected artifact digest.">
            <HashComparison expected={proof.artifact.expectedSha256} readback={proof.artifact.readbackSha256} label={hash} />
            <div className="proof-grid">
              <DataField label="Walrus blob ID" value={<Identifier value={proof.artifact.blobId} />} />
              <DataField label="Walrus blob object ID" value={<Identifier value={proof.artifact.blobObjectId} />} />
              <DataField label="Content type" value={proof.artifact.contentType} />
              <DataField label="Byte length" value={String(proof.artifact.byteLength)} mono />
            </div>
          </Card>

          <Card title="Proof timeline" description="TraceLayer proof events for this run.">
            <ProofTimeline events={proof.timeline} />
          </Card>
        </section>

        <aside className="side">
          <Card title="Sui anchor inspector" action={<StatusPill label={anchor} />}>
            <KeyValue label="Package ID" value={<Identifier value={proof.anchor.packageId} />} />
            <KeyValue label="Tx digest" value={<Identifier value={proof.anchor.anchorTxDigest} />} />
            <KeyValue label="Anchor object" value={<Identifier value={proof.anchor.anchorObjectId} />} />
            <KeyValue label="Signer" value={<Identifier value={proof.anchor.signerAddress} />} />
            <KeyValue label="On-chain owner" value={<Identifier value={proof.anchor.onChainOwnerAddress} />} />
            <KeyValue label="Schema version" value={proof.anchor.schemaVersion} mono />
            <div className="helper">Wallet-signed mode means the connected wallet signed the anchor transaction and owns the resulting Sui anchor object.</div>
          </Card>
          <Card title="Next surfaces">
            <div className="stack">
              <ButtonLink href={`/artifacts/${proof.artifact.artifactId}`}>Artifact detail</ButtonLink>
              <ButtonLink href="/proofs">Proof trail</ButtonLink>
              <ButtonLink href={`/replay/${proof.run.runId}`}>Replay context</ButtonLink>
            </div>
          </Card>
        </aside>
      </div>
    </ProductShell>
  );
}
