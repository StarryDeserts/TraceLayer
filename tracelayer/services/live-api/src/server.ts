import { createTraceLayerConfig } from '@tracelayer/config';
import { createDefaultApiState, handleApiRequest, type AnchorOperations, type WalrusOperations } from '@tracelayer/api';
import { executeServerSignedAnchor, prepareAnchorArtifactTransaction, waitForAnchorTransaction, createSuiAnchorClient } from '@tracelayer/sui-anchor';
import { readArtifactFromWalrus, uploadArtifactToWalrus } from '@tracelayer/walrus';
import { handleLiveHttpRequest } from './http.js';

const config = createTraceLayerConfig(process.env);
const state = createDefaultApiState();

if (config.demoMode === 'live') {
  state.walrus = createLiveWalrusOperations();
  state.anchor = createLiveAnchorOperations();
}

const port = Number.parseInt(process.env.PORT ?? '3001', 10);
const BunMaybe = globalThis as typeof globalThis & {
  serve?: (options: { port: number; fetch: (request: Request) => Response | Promise<Response> }) => unknown;
};

const server = BunMaybe.serve?.({
  port,
  fetch: (request: Request) => handleLiveHttpRequest(request, (apiRequest) => handleApiRequest(apiRequest, state)),
});

if (server === undefined) {
  const { createServer } = await import('node:http');
  createServer(async (request, response) => {
    const host = request.headers.host ?? `localhost:${port}`;
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const requestInit: RequestInit = {
      ...(request.method ? { method: request.method } : {}),
      headers: request.headers as HeadersInit,
      ...(chunks.length === 0 ? {} : { body: Buffer.concat(chunks) }),
    };
    const webRequest = new Request(`http://${host}${request.url ?? '/'}`, requestInit);
    const webResponse = await handleLiveHttpRequest(webRequest, (apiRequest) => handleApiRequest(apiRequest, state));
    response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()));
    response.end(Buffer.from(await webResponse.arrayBuffer()));
  }).listen(port);
}

function createLiveWalrusOperations(): WalrusOperations {
  return {
    async uploadArtifact(input) {
      return uploadArtifactToWalrus({ bytes: input.bytes, contentType: input.contentType, config });
    },
    async readArtifact(input) {
      return readArtifactFromWalrus({ blobId: input.blobId, config });
    },
  };
}

function createLiveAnchorOperations(): AnchorOperations {
  const client = createSuiAnchorClient(config);
  return {
    async prepareAnchorArtifact(input) {
      return prepareAnchorArtifactTransaction({
        packageId: input.packageId,
        runId: input.runId,
        blobId: input.blobId,
        artifactHash: input.artifactHash,
        artifactType: input.artifactType,
        createdAtMs: input.createdAtMs,
        signerAddress: input.signerAddress,
        client,
      });
    },
    async waitForAnchorTransaction(input) {
      return waitForAnchorTransaction({ client, txDigest: input.txDigest, packageId: input.packageId });
    },
    async executeServerSignedAnchor(input) {
      return executeServerSignedAnchor({
        config,
        client,
        runId: input.runId,
        blobId: input.blobId,
        artifactHash: input.artifactHash,
        artifactType: input.artifactType,
        createdAtMs: input.createdAtMs,
      });
    },
  };
}
