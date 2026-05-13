import type { EndpointMode } from './model-settings.js';

export type ModelEndpointMode = Exclude<EndpointMode, 'auto'>;

export type NormalizedProviderBase = {
  baseUrl: string;
  isLocalHttp: boolean;
  warning?: string;
};

export type BuiltProviderEndpoint = {
  url: string;
  path: '/responses' | '/chat/completions';
  mode: ModelEndpointMode;
};

export type ModelDiagnosticClassification =
  | 'unsupported_provider_path'
  | 'local_http_allowed'
  | 'local_http_blocked'
  | 'remote_http_blocked'
  | 'cors_or_unreachable'
  | 'unauthorized'
  | 'provider_error'
  | 'invalid_json'
  | 'schema_validation_failed';

const localHttpWarning = 'Local HTTP provider allowed for demo mode. Do not use this as production key storage.';
const fullEndpointError = 'Enter the provider base URL, e.g. http://localhost:1234/v1, not the full endpoint path.';
const endpointPaths = ['/responses', '/chat/completions'];

export function normalizeProviderBaseUrl(value: string): NormalizedProviderBase {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('base URL must be a valid URL');
  }

  if (url.username.length > 0 || url.password.length > 0) throw new Error('base URL must not include username or password');
  if (url.search.length > 0 || url.hash.length > 0) throw new Error('base URL must not include query string or fragment');

  const isLocal = isLocalProviderHost(url.hostname);
  const isLocalHttp = url.protocol === 'http:' && isLocal;
  if (url.protocol === 'http:' && !isLocal) throw new Error('remote HTTP providers are blocked; use HTTPS for remote providers');
  if (url.protocol !== 'https:' && !isLocalHttp) throw new Error('base URL protocol is not supported');

  const normalizedPath = normalizeBasePath(url.pathname);
  url.pathname = normalizedPath;
  url.search = '';
  url.hash = '';

  const normalized = url.toString().replace(/\/$/, '');
  return {
    baseUrl: normalized,
    isLocalHttp,
    ...(isLocalHttp ? { warning: localHttpWarning } : {}),
  };
}

export function buildProviderEndpoint(baseUrl: string, mode: ModelEndpointMode): BuiltProviderEndpoint {
  const normalized = normalizeProviderBaseUrl(baseUrl);
  const url = new URL(normalized.baseUrl);
  const endpointPath = mode === 'responses' ? '/responses' : '/chat/completions';
  url.pathname = `${url.pathname.replace(/\/$/, '')}${endpointPath}`;
  return { url: url.toString(), path: endpointPath, mode };
}

export function preferredInitialEndpointMode(baseUrl: string, endpointMode: EndpointMode): ModelEndpointMode {
  if (endpointMode !== 'auto') return endpointMode;
  try {
    const normalized = normalizeProviderBaseUrl(baseUrl);
    return normalized.isLocalHttp ? 'chat_completions' : 'responses';
  } catch {
    return 'responses';
  }
}

export function sanitizeProviderUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return 'invalid provider URL';
  }
}

export function classifyProviderError(status: number, message: string): ModelDiagnosticClassification {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 404 || status === 405) return 'unsupported_provider_path';
  if (/failed to fetch|network|cors|econnrefused|unreachable/i.test(message)) return 'cors_or_unreachable';
  return 'provider_error';
}

export function isLocalProviderBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && isLocalProviderHost(url.hostname);
  } catch {
    return false;
  }
}

function normalizeBasePath(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  for (const endpointPath of endpointPaths) {
    if (path.endsWith(endpointPath)) throw new Error(fullEndpointError);
  }
  return path;
}

function isLocalProviderHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]' || normalized === '::1';
}
