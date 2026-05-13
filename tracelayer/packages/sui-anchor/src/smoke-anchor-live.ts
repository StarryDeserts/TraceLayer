import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTraceLayerConfig } from '@tracelayer/config';
import { executeServerSignedAnchor } from './index.js';

type RecordedWalrusFixture = {
  blobId: string;
  sha256: string;
};

const fixturePath = resolve(process.cwd(), '..', '..', 'fixtures', 'recorded', 'walrus-proof.testnet.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as RecordedWalrusFixture;
const config = createTraceLayerConfig(process.env);
const result = await executeServerSignedAnchor({
  config,
  runId: 'run_phase_2_5_test',
  blobId: fixture.blobId,
  artifactHash: fixture.sha256,
  artifactType: 'markdown_report',
  createdAtMs: Date.now(),
});

console.log(JSON.stringify({
  smoke: 'phase-3-sui-anchor-live',
  anchorMode: result.anchorMode,
  serviceSigned: result.serviceSigned,
  txDigest: result.txDigest,
  anchorObjectId: result.anchorObjectId ?? null,
  onChainOwnerAddress: result.onChainOwnerAddress,
  event: result.event ?? null,
}, null, 2));
