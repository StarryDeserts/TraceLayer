import { allowedTraceLayerProxyPath, hasSafeTraceLayerProxySegments } from '../route-guard.js';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

async function proxyRequest(request: Request, context: RouteContext): Promise<Response> {
  if (process.env.NODE_ENV === 'production') return Response.json({ error: 'dev proxy disabled' }, { status: 404 });
  const { path } = await context.params;
  if (!hasSafeTraceLayerProxySegments(path)) {
    return Response.json({ error: 'invalid proxy path' }, { status: 400 });
  }

  const sourceUrl = new URL(request.url);
  const allowedPath = allowedTraceLayerProxyPath(request.method, path);
  if (allowedPath === undefined) return Response.json({ error: 'proxy path not allowed' }, { status: 404 });

  const token = process.env.TRACE_LAYER_API_TOKEN ?? '';
  const baseUrl = new URL(process.env.TRACE_LAYER_API_URL ?? 'http://localhost:3001');
  if (request.method === 'GET' && allowedPath === '/api/proxy-diagnostics') return proxyDiagnosticsResponse(baseUrl, token);
  const targetUrl = new URL(`${allowedPath}${sourceUrl.search}`, baseUrl);
  if (targetUrl.origin !== baseUrl.origin) return Response.json({ error: 'invalid proxy target' }, { status: 400 });

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  if (token) headers.set('authorization', `Bearer ${token}`);

  const requestInit: RequestInit = {
    method: request.method,
    headers,
    ...(request.method === 'GET' || request.method === 'HEAD' ? {} : { body: await request.arrayBuffer() }),
  };
  const response = await fetch(targetUrl, requestInit);

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

async function proxyDiagnosticsResponse(baseUrl: URL, token: string): Promise<Response> {
  let healthStatus: number | undefined;
  let capabilitiesStatus: number | undefined;
  let capabilities: Record<string, unknown> = {};
  try {
    const health = await fetch(new URL('/health', baseUrl));
    healthStatus = health.status;
    const headers = new Headers();
    if (token) headers.set('authorization', `Bearer ${token}`);
    const response = await fetch(new URL('/api/live-demo/capabilities', baseUrl), { headers });
    capabilitiesStatus = response.status;
    if (response.ok) capabilities = (await response.json()) as Record<string, unknown>;
  } catch {
  }

  return Response.json({
    proxyTokenPresent: token.length > 0,
    apiReachable: healthStatus === 200,
    authHeaderMode: token.length > 0 ? 'authorization_bearer' : 'unknown',
    liveApiReturnedStatus: capabilitiesStatus ?? healthStatus ?? 0,
    demoMode: typeof capabilities.demoMode === 'string' ? capabilities.demoMode : 'unknown',
    walrusLiveUploadEnabled: capabilities.walrusLiveUpload === true,
    suiAnchorLiveEnabled: capabilities.suiAnchorLive === true,
  });
}
