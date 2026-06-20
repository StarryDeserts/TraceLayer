const defaultWebOrigins: readonly string[] = ['http://localhost:3000'];
const corsAllowMethods = 'GET, POST, OPTIONS';
const corsAllowHeaders = 'Content-Type, Authorization, X-API-Token, x-api-token';

export type ApiRequestHandler = (request: Request) => Response | Promise<Response>;

export type LiveHttpOptions = {
  webOrigins?: readonly string[];
};

export async function handleLiveHttpRequest(
  request: Request,
  apiHandler: ApiRequestHandler,
  options: LiveHttpOptions = {},
): Promise<Response> {
  const webOrigins = options.webOrigins ?? defaultWebOrigins;
  const allowedOrigin = resolveAllowedOrigin(request, webOrigins);

  if (request.method === 'OPTIONS') return corsResponse(new Response(null, { status: 204 }), allowedOrigin);

  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/health') {
    return corsJsonResponse({ ok: true, service: 'tracelayer-live-api' }, allowedOrigin);
  }

  return corsResponse(await apiHandler(request), allowedOrigin);
}

function resolveAllowedOrigin(request: Request, webOrigins: readonly string[]): string | undefined {
  const origin = request.headers.get('origin');
  if (origin === null) return undefined;
  return webOrigins.includes(origin) ? origin : undefined;
}

function corsJsonResponse(body: unknown, allowedOrigin: string | undefined, status = 200): Response {
  return corsResponse(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }),
    allowedOrigin,
  );
}

function corsResponse(response: Response, allowedOrigin: string | undefined): Response {
  const headers = new Headers(response.headers);
  if (allowedOrigin !== undefined) {
    headers.set('access-control-allow-origin', allowedOrigin);
    headers.set('access-control-allow-methods', corsAllowMethods);
    headers.set('access-control-allow-headers', corsAllowHeaders);
  }
  headers.set('vary', 'Origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
