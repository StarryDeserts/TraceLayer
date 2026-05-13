const localDevWebOrigin = 'http://localhost:3000';
const corsAllowMethods = 'GET, POST, OPTIONS';
const corsAllowHeaders = 'Content-Type, Authorization, X-API-Token, x-api-token';

export type ApiRequestHandler = (request: Request) => Response | Promise<Response>;

export async function handleLiveHttpRequest(request: Request, apiHandler: ApiRequestHandler): Promise<Response> {
  if (request.method === 'OPTIONS') return corsResponse(new Response(null, { status: 204 }));

  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/health') {
    return corsJsonResponse({ ok: true, service: 'tracelayer-live-api' });
  }

  return corsResponse(await apiHandler(request));
}

function corsJsonResponse(body: unknown, status = 200): Response {
  return corsResponse(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }),
  );
}

function corsResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', localDevWebOrigin);
  headers.set('access-control-allow-methods', corsAllowMethods);
  headers.set('access-control-allow-headers', corsAllowHeaders);
  headers.set('vary', 'Origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
