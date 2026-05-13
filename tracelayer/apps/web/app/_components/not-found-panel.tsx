import { ButtonLink, Card, ProductShell, StatusPill, Topbar, HeroPanel } from './ui.js';

export function RecordedProofNotFound({ active, requestedId, canonicalHref, canonicalLabel }: { active: string; requestedId: string; canonicalHref: string; canonicalLabel: string }) {
  return (
    <ProductShell active={active} selectedRunId="run_phase_2_5_test">
      <Topbar current={active} badges={[{ tone: 'red', text: 'Recorded proof ID not found' }]} />
      <HeroPanel
        kicker="Recorded proof guard"
        title="No recorded proof for this ID"
        actions={<ButtonLink primary href={canonicalHref}>{canonicalLabel}</ButtonLink>}
        badges={[{ tone: 'red', text: 'Unknown ID rejected' }, { tone: 'cyan', text: 'Recorded fixture only' }]}
      >
        The Phase 4 UI only has one recorded testnet proof chain. It will not mix arbitrary route parameters with real Walrus or Sui proof identifiers.
      </HeroPanel>
      <Card title="Requested identifier" description="This value was not found in the recorded proof fixture.">
        <div className="helper mono">{requestedId}</div>
        <div className="helper">Use the canonical recorded route to inspect the validated proof chain.</div>
      </Card>
    </ProductShell>
  );
}
