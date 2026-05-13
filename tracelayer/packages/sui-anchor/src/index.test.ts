import { describe, expect, it } from 'vitest';
import { anchorTarget, buildAnchorArtifactTransaction, hexToBytes, parseArtifactAnchoredEvent, prepareAnchorArtifactTransaction, utf8Bytes } from './index.js';

const packageId = `0x${'1'.repeat(64)}`;
const blobId = 'hD_YDFkdI8yTI0ZnRa_BEiEArOU8HY3SokY4T9Qg5sk';
const artifactHash = 'b372b678a239bbec78d2221533ae27d361fad3a4a4c232196b54f991e6177e0e';
const signerAddress = `0x${'7'.repeat(64)}`;

function validInput() {
  return {
    packageId,
    runId: 'run_phase_2_5_test',
    blobId,
    artifactHash,
    artifactType: 'markdown_report',
    createdAtMs: 1778333640000,
  };
}

describe('Sui anchor transaction builder', () => {
  it('builds the expected Move target', () => {
    expect(anchorTarget(packageId)).toBe(`${packageId}::artifact_anchor::anchor_artifact`);
  });

  it('rejects placeholder package IDs', () => {
    expect(() => anchorTarget('0x0')).toThrow(/package ID/);
  });

  it('converts SHA-256 hex to exactly 32 bytes', () => {
    expect(hexToBytes(artifactHash)).toHaveLength(32);
    expect(() => hexToBytes('abc')).toThrow(/SHA-256/);
  });

  it('checks UTF-8 byte limits before building', () => {
    expect(() => buildAnchorArtifactTransaction(validInput())).not.toThrow();
    expect(() => buildAnchorArtifactTransaction({ ...validInput(), runId: 'x'.repeat(65) })).toThrow(/runId/);
    expect(() => buildAnchorArtifactTransaction({ ...validInput(), blobId: 'x'.repeat(257) })).toThrow(/blobId/);
    expect(() => buildAnchorArtifactTransaction({ ...validInput(), artifactType: '类型'.repeat(17) })).toThrow(/artifactType/);
  });

  it('encodes UTF-8 bytes consistently', () => {
    expect(utf8Bytes('markdown_report')).toEqual(Array.from(new TextEncoder().encode('markdown_report')));
  });

  it('sets signerAddress as the transaction sender before serialization', async () => {
    const prepared = await prepareAnchorArtifactTransaction({ ...validInput(), signerAddress });
    const transaction = JSON.parse(prepared.transactionJson) as { sender?: string };

    expect(transaction.sender).toBe(signerAddress);
  });
});

describe('ArtifactAnchored event parser', () => {
  it('parses expected event fields', () => {
    const event = parseArtifactAnchoredEvent({
      packageId,
      event: {
        type: `${packageId}::artifact_anchor::ArtifactAnchored`,
        parsedJson: {
          anchor_id: `0x${'2'.repeat(64)}`,
          owner: `0x${'3'.repeat(64)}`,
          run_id: utf8Bytes('run_phase_2_5_test'),
          blob_id: utf8Bytes(blobId),
          artifact_hash: hexToBytes(artifactHash),
          artifact_type: utf8Bytes('markdown_report'),
          created_at_ms: '1778333640000',
          schema_version: '1',
        },
      },
    });

    expect(event).toEqual({
      anchorObjectId: `0x${'2'.repeat(64)}`,
      ownerAddress: `0x${'3'.repeat(64)}`,
      runId: 'run_phase_2_5_test',
      blobId,
      artifactHash,
      artifactType: 'markdown_report',
      createdAtMs: '1778333640000',
      schemaVersion: 1,
    });
  });

  it('ignores unrelated events and package IDs', () => {
    expect(parseArtifactAnchoredEvent({ event: { type: `${packageId}::other::Event`, parsedJson: {} } })).toBeUndefined();
    expect(parseArtifactAnchoredEvent({ packageId: `0x${'4'.repeat(64)}`, event: { type: `${packageId}::artifact_anchor::ArtifactAnchored`, parsedJson: {} } })).toBeUndefined();
  });
});
