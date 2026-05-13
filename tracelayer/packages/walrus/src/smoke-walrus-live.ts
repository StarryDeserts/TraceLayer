import { createTraceLayerConfig } from '@tracelayer/config';
import { uploadArtifactToWalrus, verifyWalrusArtifact } from './index.js';

const text = 'TraceLayer Phase 2 live Walrus smoke: non-sensitive artifact.';
const bytes = new TextEncoder().encode(text);
const contentType = 'text/plain; charset=utf-8';

const config = createTraceLayerConfig(process.env);
const upload = await uploadArtifactToWalrus({ bytes, contentType, config });
const verification = await verifyWalrusArtifact({ blobId: upload.blobId, expectedSha256: upload.sha256, config });

console.log(
  JSON.stringify(
    {
      blobId: upload.blobId,
      blobObjectId: upload.blobObjectId ?? null,
      byteLength: upload.byteLength,
      sha256: upload.sha256,
      verification: {
        ok: verification.ok,
        actualSha256: verification.actualSha256,
      },
      rawWalrusResponse: upload.rawWalrusResponse,
    },
    null,
    2,
  ),
);
