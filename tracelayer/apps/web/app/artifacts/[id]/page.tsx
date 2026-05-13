import { RecordedProofNotFound } from '../../_components/not-found-panel.js';
import { ButtonLink, Card, DataField, HashComparison, Identifier, KeyValue, ProductShell, StatusPill, Topbar, HeroPanel } from '../../_components/ui.js';
import { buildRecordedProofModel } from '../../_lib/proof-data.js';
import { anchorLabel, hashVerificationLabel, modeLabel } from '../../_lib/proof-labels.js';

export default async function ArtifactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proof = buildRecordedProofModel();
  if (id !== proof.artifact.artifactId) {
    return <RecordedProofNotFound active="Artifacts" requestedId={id} canonicalHref={`/artifacts/${proof.artifact.artifactId}`} canonicalLabel="Open recorded artifact" />;
  }
  const hash = hashVerificationLabel(proof.artifact.expectedSha256, proof.artifact.readbackSha256);
  const anchor = anchorLabel(proof.anchor);

  return (
    <ProductShell active="Artifacts" selectedRunId={proof.run.runId}>
      <Topbar current="Artifacts" badges={[modeLabel(proof.mode), hash, anchor]} />
      <HeroPanel
        kicker="Artifact detail · Walrus and Sui proof"
        title={<><span>Artifact </span><span className="mono">{id}</span></>}
        actions={
          <>
            <ButtonLink primary href={`/runs/${proof.run.runId}`}>Open parent run</ButtonLink>
            <ButtonLink href="/proofs">Open proof trail</ButtonLink>
          </>
        }
        badges={[{ tone: 'cyan', text: 'Walrus blob ID' }, hash, anchor]}
      >
        Inspect the public artifact lineage fields: Walrus blob ID, readback SHA-256, wallet-signed Sui anchor, and proof event correlation.
      </HeroPanel>

      <div className="layout-grid">
        <section className="stack">
          <Card title="Artifact record" description="The artifact is represented by non-sensitive metadata and a public Walrus blob reference.">
            <div className="field-grid">
              <DataField label="Artifact ID" value={proof.artifact.artifactId} mono />
              <DataField label="Artifact type" value={proof.artifact.artifactType} mono />
              <DataField label="Name" value={proof.artifact.name} mono />
              <DataField label="Content type" value={proof.artifact.contentType} />
              <DataField label="Byte length" value={String(proof.artifact.byteLength)} mono />
              <DataField label="Preview" value={proof.artifact.preview} />
            </div>
          </Card>

          <Card title="Walrus verification" description="TraceLayer treats the Walrus blob ID and blob object ID as distinct public identifiers.">
            <HashComparison expected={proof.artifact.expectedSha256} readback={proof.artifact.readbackSha256} label={hash} />
            <div className="proof-grid">
              <DataField label="Walrus blob ID" value={proof.artifact.blobId} mono />
              <DataField label="Walrus blob object ID" value={proof.artifact.blobObjectId} mono />
            </div>
            <div className="helper">“Verified hash” is shown only because the expected artifact hash and readback hash match exactly.</div>
          </Card>

          <Card title="Sui anchor" description="Sui stores compact proof metadata only, not artifact bytes. The anchor references the artifact hash, Walrus blob ID, artifact type, run ID, and signer-derived owner.">
            <div className="proof-grid">
              <DataField label="Anchor mode" value={<StatusPill label={anchor} />} />
              <DataField label="Anchor mode" value={proof.anchor.anchorMode} mono />
              <DataField label="serviceSigned" value={String(proof.anchor.serviceSigned)} mono />
              <DataField label="Anchor tx digest" value={proof.anchor.anchorTxDigest} mono />
              <DataField label="Anchor object ID" value={proof.anchor.anchorObjectId} mono />
              <DataField label="Signer address" value={proof.anchor.signerAddress} mono />
              <DataField label="On-chain owner address" value={proof.anchor.onChainOwnerAddress} mono />
            </div>
          </Card>
        </section>

        <aside className="side">
          <Card title="Proof receipt summary">
            <KeyValue label="Run ID" value={proof.run.runId} mono />
            <KeyValue label="Correlation ID" value={proof.run.correlationId} mono />
            <KeyValue label="Network" value={proof.network} />
            <KeyValue label="Owner match" value={String(proof.anchor.ownerMatchesWallet)} />
            <div className="helper">This page does not upload from the browser. Walrus operations remain in the existing backend/package boundary.</div>
          </Card>
        </aside>
      </div>
    </ProductShell>
  );
}
