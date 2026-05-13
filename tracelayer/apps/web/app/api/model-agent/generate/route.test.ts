import { describe, expect, it, vi } from 'vitest';
import { POST } from './route.js';

const validBody = {
  baseUrl: 'https://provider.example.invalid',
  path: '/responses',
  apiKey: 'sk-test-secret-value',
  body: { model: 'demo-model', input: 'Return JSON only.' },
};

describe('model agent local relay route', () => {
  it('is disabled in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const response = await POST(jsonRequest(validBody));

    expect(response.status).toBe(404);
    vi.unstubAllEnvs();
  });

  it('proxies only OpenAI-compatible paths with transient authorization', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe('Bearer sk-test-secret-value');
      expect(headers.has('cookie')).toBe(false);
      expect(headers.get('content-type')).toBe('application/json');
      return Response.json({ output_text: '{"ok":true}' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(jsonRequest(validBody, { cookie: 'session=should-not-forward' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(new URL('https://provider.example.invalid/responses'), expect.any(Object));
    expect(body).toEqual({ output_text: '{"ok":true}' });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('accepts local HTTP /v1 base URLs and endpoint suffixes', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const fetchMock = vi.fn(async () => Response.json({ choices: [{ message: { content: '{"ok":true}' } }] }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(jsonRequest({ ...validBody, baseUrl: 'http://localhost:1234/v1', path: '/chat/completions' }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(new URL('http://localhost:1234/v1/chat/completions'), expect.any(Object));
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('rejects unsupported provider paths and non-HTTPS remote base URLs', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const unsupportedPath = await POST(jsonRequest({ ...validBody, path: '/v1/embeddings' }));
    const insecureRemote = await POST(jsonRequest({ ...validBody, baseUrl: 'http://provider.example.invalid' }));

    expect(unsupportedPath.status).toBe(400);
    await expect(unsupportedPath.json()).resolves.toMatchObject({ error: 'provider path is not supported; expected /responses or /chat/completions' });
    expect(insecureRemote.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it('redacts provider credentials from relay error diagnostics', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Bearer sk-test-secret-value token leak', { status: 401 })));

    const response = await POST(jsonRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(JSON.stringify(body)).not.toContain('sk-test-secret-value');
    expect(body.error).toContain('[redacted]');
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});

function jsonRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/model-agent/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
