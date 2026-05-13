import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './[...path]/route.js';

const secretToken = 'test-secret-token';

vi.stubEnv('NODE_ENV', 'development');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.stubEnv('NODE_ENV', 'development');
});

describe('TraceLayer dev proxy auth', () => {
  it('forwards model artifact registration to the live API path with Authorization Bearer from current server env', async () => {
    vi.stubEnv('TRACE_LAYER_API_TOKEN', secretToken);
    vi.stubEnv('TRACE_LAYER_API_URL', 'http://localhost:3001');
    const fetchMock = vi.fn(async (_url: URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe(`Bearer ${secretToken}`);
      return Response.json({ ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(jsonRequest('http://localhost:3000/api/trace-layer/api/live-demo/model-artifact-run', {}), routeContext(['api', 'live-demo', 'model-artifact-run']));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(new URL('http://localhost:3001/api/live-demo/model-artifact-run'), expect.any(Object));
    await expect(response.text()).resolves.not.toContain(secretToken);
  });

  it('omits authorization when TRACE_LAYER_API_TOKEN is missing from the web server process', async () => {
    vi.stubEnv('TRACE_LAYER_API_URL', 'http://localhost:3001');
    const fetchMock = vi.fn(async (_url: URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.has('authorization')).toBe(false);
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(jsonRequest('http://localhost:3000/api/trace-layer/api/live-demo/model-artifact-run', {}), routeContext(['api', 'live-demo', 'model-artifact-run']));

    expect(response.status).toBe(401);
    await expect(response.text()).resolves.not.toContain(secretToken);
  });

  it('returns proxy diagnostics without exposing token values', async () => {
    vi.stubEnv('TRACE_LAYER_API_TOKEN', secretToken);
    vi.stubEnv('TRACE_LAYER_API_URL', 'http://localhost:3001');
    vi.stubGlobal('fetch', vi.fn(async (url: URL) => {
      if (url.pathname === '/health') return Response.json({ ok: true });
      return Response.json({ demoMode: 'live', walrusLiveUpload: true, suiAnchorLive: false });
    }));

    const response = await GET(new Request('http://localhost:3000/api/trace-layer/api/proxy-diagnostics'), routeContext(['api', 'proxy-diagnostics']));
    const text = await response.text();
    const body = JSON.parse(text) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      proxyTokenPresent: true,
      apiReachable: true,
      authHeaderMode: 'authorization_bearer',
      liveApiReturnedStatus: 200,
      demoMode: 'live',
      walrusLiveUploadEnabled: true,
      suiAnchorLiveEnabled: false,
    });
    expect(text).not.toContain(secretToken);
  });
});

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function routeContext(path: string[]) {
  return { params: Promise.resolve({ path }) };
}
