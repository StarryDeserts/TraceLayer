export type TraceLayerProxyDiagnostics = {
  proxyTokenPresent?: unknown;
  apiReachable?: unknown;
  authHeaderMode?: unknown;
  liveApiReturnedStatus?: unknown;
  demoMode?: unknown;
  walrusLiveUploadEnabled?: unknown;
  suiAnchorLiveEnabled?: unknown;
};

export type TraceLayerErrorContext = {
  apiUrl?: string;
  diagnostics?: TraceLayerProxyDiagnostics | undefined;
};

export function traceLayerErrorMessage(responseBody: string, status: number, context: TraceLayerErrorContext = {}): string {
  if (status === 401) {
    const diagnostics = context.diagnostics ?? proxyDiagnosticsFromJson(parseJson(responseBody));
    return [
      'TraceLayer live API rejected the proxy token. Restart API and Web with the same TRACE_LAYER_API_TOKEN, or check proxy auth header mode.',
      'classification=trace_layer_unauthorized',
      `apiUrl=${context.apiUrl ?? '/api/trace-layer'}`,
      ...safeDiagnosticParts(diagnostics),
    ].join(' · ');
  }

  const json = parseJson(responseBody);
  const error = errorMessageFromJson(json);
  return error ?? (responseBody.length > 0 ? responseBody : `HTTP ${status}`);
}

function safeDiagnosticParts(diagnostics: TraceLayerProxyDiagnostics | undefined): string[] {
  if (diagnostics === undefined) return [];
  return [
    safePart('proxyTokenPresent', diagnostics.proxyTokenPresent),
    safePart('apiReachable', diagnostics.apiReachable),
    safePart('authHeaderMode', diagnostics.authHeaderMode),
    safePart('liveApiReturnedStatus', diagnostics.liveApiReturnedStatus),
    safePart('demoMode', diagnostics.demoMode),
    safePart('walrusLiveUploadEnabled', diagnostics.walrusLiveUploadEnabled),
    safePart('suiAnchorLiveEnabled', diagnostics.suiAnchorLiveEnabled),
  ].filter((part): part is string => part !== undefined);
}

function safePart(label: string, value: unknown): string | undefined {
  if (typeof value === 'boolean' || typeof value === 'number') return `${label}=${String(value)}`;
  if (typeof value === 'string' && /^[a-z0-9_-]+$/i.test(value)) return `${label}=${value}`;
  return undefined;
}

function proxyDiagnosticsFromJson(json: unknown): TraceLayerProxyDiagnostics | undefined {
  if (!isRecord(json)) return undefined;
  if (!('proxyTokenPresent' in json) && !('authHeaderMode' in json) && !('liveApiReturnedStatus' in json)) return undefined;
  return json;
}

function errorMessageFromJson(json: unknown): string | undefined {
  if (!isRecord(json)) return undefined;
  if (typeof json.error === 'string') return json.error;
  if (isRecord(json.error) && typeof json.error.message === 'string') return json.error.message;
  return undefined;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
