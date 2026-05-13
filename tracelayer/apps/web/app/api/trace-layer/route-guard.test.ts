import { describe, expect, it } from 'vitest';
import { allowedTraceLayerProxyPath, hasSafeTraceLayerProxySegments } from './route-guard.js';

describe('TraceLayer proxy route guard', () => {
  it('allows existing and Phase 5 static TraceLayer API paths', () => {
    expect(allowedTraceLayerProxyPath('GET', ['health'])).toBe('/health');
    expect(allowedTraceLayerProxyPath('GET', ['api', 'live-demo', 'capabilities'])).toBe('/api/live-demo/capabilities');
    expect(allowedTraceLayerProxyPath('GET', ['api', 'proxy-diagnostics'])).toBe('/api/proxy-diagnostics');
    expect(allowedTraceLayerProxyPath('POST', ['api', 'live-demo', 'model-artifact-run'])).toBe('/api/live-demo/model-artifact-run');
    expect(allowedTraceLayerProxyPath('POST', ['api', 'dev', 'recorded-walrus-artifact'])).toBe('/api/dev/recorded-walrus-artifact');
  });

  it('allows only constrained artifact and replay actions', () => {
    expect(allowedTraceLayerProxyPath('POST', ['api', 'artifacts', 'artifact_abc-123_DEF', 'upload'])).toBe('/api/artifacts/artifact_abc-123_DEF/upload');
    expect(allowedTraceLayerProxyPath('POST', ['api', 'artifacts', 'artifact_abc-123_DEF', 'verify'])).toBe('/api/artifacts/artifact_abc-123_DEF/verify');
    expect(allowedTraceLayerProxyPath('POST', ['api', 'artifacts', 'artifact_abc-123_DEF', 'anchor'])).toBe('/api/artifacts/artifact_abc-123_DEF/anchor');
    expect(allowedTraceLayerProxyPath('POST', ['api', 'replay', 'run_abc-123_DEF'])).toBe('/api/replay/run_abc-123_DEF');
  });

  it('rejects unsafe segments and unknown paths', () => {
    expect(hasSafeTraceLayerProxySegments([])).toBe(false);
    expect(hasSafeTraceLayerProxySegments(['api', '..', 'health'])).toBe(false);
    expect(hasSafeTraceLayerProxySegments(['api', '', 'health'])).toBe(false);
    expect(allowedTraceLayerProxyPath('POST', ['api', 'model-agent', 'generate'])).toBeUndefined();
    expect(allowedTraceLayerProxyPath('GET', ['api', 'live-demo', 'model-artifact-run'])).toBeUndefined();
  });

  it('rejects unconstrained artifact and run identifiers', () => {
    expect(allowedTraceLayerProxyPath('POST', ['api', 'artifacts', 'bad_123', 'upload'])).toBeUndefined();
    expect(allowedTraceLayerProxyPath('POST', ['api', 'artifacts', 'artifact_../x', 'upload'])).toBeUndefined();
    expect(allowedTraceLayerProxyPath('POST', ['api', 'artifacts', 'artifact_ok', 'delete'])).toBeUndefined();
    expect(allowedTraceLayerProxyPath('POST', ['api', 'replay', 'bad_123'])).toBeUndefined();
  });
});
