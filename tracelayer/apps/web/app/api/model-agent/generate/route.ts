import { redactProviderDiagnostics } from '../../../_lib/model-client.js';
import { normalizeProviderBaseUrl } from '../../../_lib/model-provider-url.js';

type RelayRequest = {
  baseUrl: string;
  path: '/responses' | '/chat/completions';
  apiKey: string;
  body: Record<string, unknown>;
};

const allowedProviderPaths = new Set(['/responses', '/chat/completions']);

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') return Response.json({ error: 'local model relay disabled' }, { status: 404 });

  let input: RelayRequest;
  try {
    input = await readRelayRequest(request);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'invalid relay request' }, { status: 400 });
  }

  const targetUrl = new URL(input.baseUrl);
  targetUrl.pathname = `${targetUrl.pathname.replace(/\/$/, '')}${input.path}`;
  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(input.body),
    });
  } catch {
    return Response.json({ error: 'provider is unreachable or blocked by CORS', classification: 'cors_or_unreachable' }, { status: 502 });
  }

  const responseText = await response.text();
  if (!response.ok) {
    return Response.json({ error: redactProviderDiagnostics(responseText, input.apiKey) }, { status: response.status });
  }

  return new Response(responseText, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
  });
}

async function readRelayRequest(request: Request): Promise<RelayRequest> {
  if (request.headers.get('content-type')?.includes('application/json') !== true) throw new Error('model relay requires JSON body');
  const body = await request.json();
  if (!isRecord(body)) throw new Error('model relay request must be a JSON object');
  const baseUrl = normalizeProviderBaseUrl(requiredString(body.baseUrl, 'baseUrl')).baseUrl;
  const path = requiredString(body.path, 'path');
  if (!allowedProviderPaths.has(path)) throw new Error('provider path is not supported; expected /responses or /chat/completions');
  const apiKey = requiredString(body.apiKey, 'apiKey');
  const providerBody = body.body;
  if (!isRecord(providerBody)) throw new Error('body must be a JSON object');
  return { baseUrl, path: path as RelayRequest['path'], apiKey, body: providerBody };
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${name} is required`);
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
