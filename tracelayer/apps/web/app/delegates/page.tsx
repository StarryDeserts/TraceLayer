import { ButtonLink, Card, DataField, Identifier, KeyValue, ProductShell, StatusPill, Topbar, HeroPanel } from '../_components/ui.js';
import { buildRecordedProofModel } from '../_lib/proof-data.js';
import { anchorLabel, hashVerificationLabel, modeLabel } from '../_lib/proof-labels.js';

export default function DelegatesPage() {
  const proof = buildRecordedProofModel();
  const hash = hashVerificationLabel(proof.artifact.expectedSha256, proof.artifact.readbackSha256);
  const anchor = anchorLabel(proof.anchor);

  return (
    <ProductShell active="Delegates" selectedRunId={proof.run.runId}>
      <Topbar current="Delegates" badges={[modeLabel(proof.mode), hash, anchor]} />
      <HeroPanel
        kicker="Delegation receipts · proof access preview"
        title="Delegation receipts"
        actions={<ButtonLink primary href="/proofs">Open proof trail</ButtonLink>}
        badges={[{ tone: 'amber', text: 'Receipt preview only' }, { tone: 'gray', text: 'No delegation protocol logic' }, { tone: 'green', text: 'Proof-linked' }]}
      >
        Delegation is receipt-based in the MVP. Receipts do not enforce encrypted access control in the MVP, and this page does not implement real delegation access control.
      </HeroPanel>

      <div className="layout-grid">
        <section className="stack">
          <Card title="Receipt preview" description="This is a UI representation of proof receipt semantics, not an access-control implementation.">
            <div className="field-grid">
              <DataField label="Receipt ID" value={proof.delegation.receiptId} mono />
              <DataField label="Scope" value={proof.delegation.scope} />
              <DataField label="Status" value={<StatusPill label={{ tone: 'amber', text: proof.delegation.status }} />} />
              <DataField label="Run ID" value={proof.run.runId} mono />
              <DataField label="Artifact ID" value={proof.artifact.artifactId} mono />
              <DataField label="Correlation ID" value={proof.run.correlationId} mono />
            </div>
            <div className="helper">“Proof receipt” means a recorded proof-access artifact in the UI. Receipts do not enforce encrypted access control in the MVP.</div>
          </Card>

          <Card title="Receipt-linked proof fields" description="Public identifiers a receipt can point to for verification.">
            <div className="proof-grid">
              <DataField label="Walrus blob ID" value={<Identifier value={proof.artifact.blobId} />} />
              <DataField label="Sui anchor object" value={<Identifier value={proof.anchor.anchorObjectId} />} />
              <DataField label="Anchor tx digest" value={<Identifier value={proof.anchor.anchorTxDigest} />} />
              <DataField label="Signer address" value={<Identifier value={proof.anchor.signerAddress} />} />
            </div>
          </Card>
        </section>

        <aside className="side">
          <Card title="Non-goals enforced">
            <KeyValue label="Seal" value="not implemented" />
            <KeyValue label="MemWal" value="not implemented" />
            <KeyValue label="Browser upload" value="not implemented" />
            <KeyValue label="Delegation protocol" value="not implemented" />
            <div className="helper">Phase 4 implements the receipt surface only so reviewers can understand the planned proof semantics.</div>
          </Card>
        </aside>
      </div>
    </ProductShell>
  );
}
