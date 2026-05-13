import { describe, expect, it } from 'vitest';
import { buildRecordedProofModel, replayEndpoint } from './proof-data.js';

describe('proof data normalization', () => {
  it('preserves recorded Walrus and Sui proof identifiers without fabricating public IDs', () => {
    const proof = buildRecordedProofModel();

    expect(proof.mode).toBe('recorded');
    expect(proof.run.runId).toBe('run_phase_2_5_test');
    expect(proof.artifact.blobId).toBe('hD_YDFkdI8yTI0ZnRa_BEiEArOU8HY3SokY4T9Qg5sk');
    expect(proof.artifact.blobObjectId).toBe('0x852f689742895aedb92353fb40f8c4aef4846ec3f71c041d070d9615d2ba8efd');
    expect(proof.anchor.anchorTxDigest).toBe('8saULAKLqh3nixQFm8aszUyQA5LW1XiYQCWdaav6oLWJ');
    expect(proof.anchor.anchorObjectId).toBe('0xc9370b022ed2918fade1e5a2a6ad1bb437e864a0408e0947c39b96c7c045ad82');
    expect(proof.anchor.ownerMatchesWallet).toBe(true);
    expect(proof.artifact.expectedSha256).toBe(proof.artifact.readbackSha256);
  });

  it('models the core proof chain in product order with visible event kinds', () => {
    const proof = buildRecordedProofModel();

    expect(proof.timeline.map((event) => event.kind)).toEqual([
      'artifact_generated',
      'walrus_uploaded',
      'walrus_readback_verified',
      'sui_anchor_wallet_signed',
      'proof_event_recorded',
      'replay_context_ready',
      'delegation_receipt_recorded',
    ]);
    expect(proof.timeline.map((event) => event.title)).toEqual([
      'artifact_generated',
      'walrus_uploaded',
      'walrus_readback_verified',
      'sui_anchor_wallet_signed',
      'proof_event_recorded',
      'replay_context_ready',
      'delegation_receipt_recorded',
    ]);
  });

  it('keeps replay calls scoped to the existing replay API endpoint', () => {
    expect(replayEndpoint('run_phase_2_5_test')).toBe('/api/replay/run_phase_2_5_test');
  });
});
