import { describe, expect, it } from 'vitest';
import { assertLiveWalrusReady, sanitizeWalrusResponse, sha256Hex, verifyWalrusBytes } from './index.js';

describe('walrus package guards', () => {
  it('rejects non-live modes before network operations', () => {
    expect(() => assertLiveWalrusReady({ demoMode: 'dry-run', liveWalrusUpload: false })).toThrow(/live mode/);
    expect(() => assertLiveWalrusReady({ demoMode: 'recorded', liveWalrusUpload: false })).toThrow(/live mode/);
  });

  it('requires WALRUS_LIVE_UPLOAD=true', () => {
    expect(() => assertLiveWalrusReady({ demoMode: 'live', liveWalrusUpload: false })).toThrow(/WALRUS_LIVE_UPLOAD/);
  });

  it('hashes and verifies exact bytes', () => {
    const bytes = new TextEncoder().encode('TraceLayer Phase 2');
    const expectedSha256 = sha256Hex(bytes);
    expect(verifyWalrusBytes(bytes, expectedSha256)).toEqual({ ok: true, actualSha256: expectedSha256 });
  });

  it('sanitizes SDK response shape', () => {
    const summary = sanitizeWalrusResponse({ blobId: 'abc', blobObject: { id: '0x1' }, secret: 'must-not-be-preserved' });
    expect(summary.blobId).toBe('abc');
    expect(summary.blobObjectId).toBe('0x1');
    expect(summary.secret).toBeUndefined();
  });
});
