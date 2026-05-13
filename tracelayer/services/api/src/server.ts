import { createDefaultApiState, handleApiRequest } from './index.js';

const state = createDefaultApiState();
const port = Number.parseInt(process.env.PORT ?? '3001', 10);
const BunMaybe = globalThis as typeof globalThis & {
  serve?: (options: { port: number; fetch: (request: Request) => Response | Promise<Response> }) => unknown;
};

const server = BunMaybe.serve?.({
  port,
  fetch: (request: Request) => handleApiRequest(request, state),
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
    const webResponse = await handleApiRequest(webRequest, state);
    response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()));
    response.end(Buffer.from(await webResponse.arrayBuffer()));
  }).listen(port);
}
