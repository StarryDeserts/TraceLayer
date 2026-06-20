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

  it('serves unauthenticated health response with CORS headers when origin is allowed', async () => {
    const response = await handleLiveHttpRequest(
      new Request('http://localhost:3001/health', { headers: { origin: 'http://localhost:3000' } }),
      () => new Response(null, { status: 500 }),
    );
    const body = (await response.json()) as { ok: boolean; service: string };

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, service: 'tracelayer-live-api' });
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(response.headers.get('vary')).toBe('Origin');
  });

  it('adds CORS headers to routed API responses when origin is allowed', async () => {
    const response = await handleLiveHttpRequest(
      new Request('http://localhost:3001/api/example', { method: 'POST', headers: { origin: 'http://localhost:3000' } }),
      () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });

  it('echoes the matching origin from a multi-origin allowlist', async () => {
    const webOrigins = ['http://localhost:3000', 'https://app.example.test'];
    const productionResponse = await handleLiveHttpRequest(
      new Request('http://localhost:3001/health', { headers: { origin: 'https://app.example.test' } }),
      () => new Response(null, { status: 500 }),
      { webOrigins },
    );
    expect(productionResponse.headers.get('access-control-allow-origin')).toBe('https://app.example.test');

    const localResponse = await handleLiveHttpRequest(
      new Request('http://localhost:3001/health', { headers: { origin: 'http://localhost:3000' } }),
      () => new Response(null, { status: 500 }),
      { webOrigins },
    );
    expect(localResponse.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });

  it('omits Access-Control-Allow-Origin for disallowed origins but keeps Vary', async () => {
    const response = await handleLiveHttpRequest(
      new Request('http://localhost:3001/health', { headers: { origin: 'https://evil.example.invalid' } }),
      () => new Response(null, { status: 500 }),
      { webOrigins: ['http://localhost:3000'] },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(response.headers.get('access-control-allow-methods')).toBeNull();
    expect(response.headers.get('vary')).toBe('Origin');
  });

  it('omits Access-Control-Allow-Origin entirely when no Origin header is present', async () => {
    const response = await handleLiveHttpRequest(
      new Request('http://localhost:3001/health'),
      () => new Response(null, { status: 500 }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(response.headers.get('vary')).toBe('Origin');
  });
});
