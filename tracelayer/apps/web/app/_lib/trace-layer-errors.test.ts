import { describe, expect, it } from 'vitest';
import { traceLayerErrorMessage } from './trace-layer-errors.js';

describe('traceLayerErrorMessage', () => {
  it('classifies TraceLayer 401s without exposing token values', () => {
    const message = traceLayerErrorMessage(JSON.stringify({ error: 'unauthorized' }), 401);

    expect(message).toContain('classification=trace_layer_unauthorized');
    expect(message).toContain('TraceLayer live API rejected the proxy token');
    expect(message).not.toContain('secret-token');
  });

  it('includes safe proxy diagnostics when provided', () => {
    const message = traceLayerErrorMessage(JSON.stringify({
      proxyTokenPresent: true,
      authHeaderMode: 'authorization_bearer',
      liveApiReturnedStatus: 401,
    }), 401);

    expect(message).toContain('proxyTokenPresent=true');
    expect(message).toContain('authHeaderMode=authorization_bearer');
    expect(message).toContain('liveApiReturnedStatus=401');
  });
});
