import { describe, expect, it } from 'vitest';
import { handleLiveHttpRequest } from './http.js';

describe('live-api http wrapper', () => {
  it('handles OPTIONS preflight before API routing', async () => {
    let routed = false;
    const response = await handleLiveHttpRequest(
      new Request('http://localhost:3001/api/dev/recorded-walrus-artifact', {
        method: 'OPTIONS',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type,authorization',
        },
      }),
      () => {
        routed = true;
        return new Response(null, { status: 500 });
      },
    );

    expect(response.status).toBe(204);
    expect(routed).toBe(false);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS');
    expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type, Authorization, X-API-Token, x-api-token');
  });

  it('serves unauthenticated health response with CORS headers', async () => {
    const response = await handleLiveHttpRequest(new Request('http://localhost:3001/health'), () => new Response(null, { status: 500 }));
    const body = (await response.json()) as { ok: boolean; service: string };

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, service: 'tracelayer-live-api' });
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });

  it('adds CORS headers to routed API responses', async () => {
    const response = await handleLiveHttpRequest(
      new Request('http://localhost:3001/api/example', { method: 'POST' }),
      () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });
});
