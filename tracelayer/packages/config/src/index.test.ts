import { describe, expect, it } from 'vitest';
import { assertLiveSuiAnchorConfig, createTraceLayerConfig, parseDemoMode } from './index.js';

describe('config', () => {
  it('defaults demo mode to dry-run', () => {
    expect(parseDemoMode(undefined)).toBe('dry-run');
  });

  it('accepts allowed demo modes', () => {
    expect(parseDemoMode('live')).toBe('live');
    expect(parseDemoMode('recorded')).toBe('recorded');
    expect(parseDemoMode('dry-run')).toBe('dry-run');
  });

  it('rejects unsupported demo modes', () => {
    expect(() => parseDemoMode('fake')).toThrow(/TRACE_LAYER_DEMO_MODE/);
  });

  it('rejects dry-run public proof identifiers', () => {
    expect(() =>
      createTraceLayerConfig({
        TRACE_LAYER_DEMO_MODE: 'dry-run',
        TRACE_LAYER_RECORDED_BLOB_ID: 'fake-blob-id',
      }),
    ).toThrow(/dry-run config/);
  });

  it('requires real-looking recorded identifiers', () => {
    expect(() =>
      createTraceLayerConfig({
        TRACE_LAYER_DEMO_MODE: 'recorded',
        TRACE_LAYER_RECORDED_BLOB_ID: 'example-blob-id',
        TRACE_LAYER_RECORDED_TX_DIGEST: 'fake-tx-digest',
      }),
    ).toThrow(/recorded mode requires/);
  });

  it('requires a recorded artifact hash', () => {
    expect(() =>
      createTraceLayerConfig({
        TRACE_LAYER_DEMO_MODE: 'recorded',
        TRACE_LAYER_RECORDED_BLOB_ID: '0x1234567890abcdef1234567890abcdef',
        TRACE_LAYER_RECORDED_TX_DIGEST: '4f4XSYqgMZMKVvVm8xWKDLV9ZyTqZ6XVBhQCbPrf5D4Z',
      }),
    ).toThrow(/TRACE_LAYER_RECORDED_ARTIFACT_SHA256/);
  });

  it('accepts real-looking recorded identifiers and artifact hash', () => {
    const config = createTraceLayerConfig({
      TRACE_LAYER_DEMO_MODE: 'recorded',
      TRACE_LAYER_RECORDED_BLOB_ID: '0x1234567890abcdef1234567890abcdef',
      TRACE_LAYER_RECORDED_TX_DIGEST: '4f4XSYqgMZMKVvVm8xWKDLV9ZyTqZ6XVBhQCbPrf5D4Z',
      TRACE_LAYER_RECORDED_ARTIFACT_SHA256: 'a'.repeat(64),
    });

    expect(config.demoMode).toBe('recorded');
    expect(config.recordedArtifactSha256).toBe('a'.repeat(64));
  });

  it('requires explicit live Walrus upload gate', () => {
    expect(() =>
      createTraceLayerConfig({
        TRACE_LAYER_DEMO_MODE: 'live',
        WALRUS_LIVE_UPLOAD: 'false',
        SUI_PRIVATE_KEY: 'suiprivkey-placeholder',
        SUI_RPC_URL: 'https://sui.example.invalid',
        WALRUS_RELAY_URL: 'https://relay.example.invalid',
      }),
    ).toThrow(/WALRUS_LIVE_UPLOAD/);
  });

  it('requires live signer and endpoint env vars', () => {
    expect(() =>
      createTraceLayerConfig({
        TRACE_LAYER_DEMO_MODE: 'live',
        WALRUS_LIVE_UPLOAD: 'true',
      }),
    ).toThrow(/SUI_PRIVATE_KEY/);
  });

  it('rejects malformed positive integer settings', () => {
    expect(() =>
      createTraceLayerConfig({
        TRACE_LAYER_DEMO_MODE: 'live',
        WALRUS_LIVE_UPLOAD: 'true',
        SUI_PRIVATE_KEY: 'suiprivkey1examplebutnotusedinunittests',
        SUI_RPC_URL: 'https://sui.example.invalid',
        WALRUS_RELAY_URL: 'https://relay.example.invalid',
        WALRUS_EPOCHS: '2.5',
      }),
    ).toThrow(/WALRUS_EPOCHS/);
  });

  it('requires explicit live Sui anchor settings when anchor config is asserted', () => {
    const config = createTraceLayerConfig({
      TRACE_LAYER_DEMO_MODE: 'live',
      WALRUS_LIVE_UPLOAD: 'true',
      SUI_PRIVATE_KEY: 'suiprivkey1examplebutnotusedinunittests',
      SUI_RPC_URL: 'https://sui.example.invalid',
      WALRUS_RELAY_URL: 'https://relay.example.invalid',
    });

    expect(() => assertLiveSuiAnchorConfig(config)).toThrow(/SUI_ANCHOR_LIVE/);
  });

  it('parses live Sui anchor settings when all gates are present', () => {
    const config = createTraceLayerConfig({
      TRACE_LAYER_DEMO_MODE: 'live',
      WALRUS_LIVE_UPLOAD: 'true',
      SUI_PRIVATE_KEY: 'suiprivkey1examplebutnotusedinunittests',
      SUI_RPC_URL: 'https://sui.example.invalid',
      WALRUS_RELAY_URL: 'https://relay.example.invalid',
      SUI_ANCHOR_LIVE: 'true',
      SUI_ANCHOR_PACKAGE_ID: `0x${'1'.repeat(64)}`,
      SUI_ANCHOR_SERVER_FALLBACK: 'true',
    });

    expect(config.liveSuiAnchor).toBe(true);
    expect(config.suiAnchorPackageId).toBe(`0x${'1'.repeat(64)}`);
    expect(config.allowSuiAnchorServerFallback).toBe(true);
    expect(() => assertLiveSuiAnchorConfig(config)).not.toThrow();
  });

  it('rejects placeholder live Sui anchor package IDs', () => {
    const config = createTraceLayerConfig({
      TRACE_LAYER_DEMO_MODE: 'live',
      WALRUS_LIVE_UPLOAD: 'true',
      SUI_PRIVATE_KEY: 'suiprivkey1examplebutnotusedinunittests',
      SUI_RPC_URL: 'https://sui.example.invalid',
      WALRUS_RELAY_URL: 'https://relay.example.invalid',
      SUI_ANCHOR_LIVE: 'true',
      SUI_ANCHOR_PACKAGE_ID: '0x0',
    });

    expect(() => assertLiveSuiAnchorConfig(config)).toThrow(/SUI_ANCHOR_PACKAGE_ID/);
  });

  it('parses live Walrus settings when all gates are present', () => {
    const config = createTraceLayerConfig({
      TRACE_LAYER_DEMO_MODE: 'live',
      WALRUS_LIVE_UPLOAD: 'true',
      SUI_PRIVATE_KEY: 'suiprivkey1examplebutnotusedinunittests',
      SUI_RPC_URL: 'https://sui.example.invalid',
      WALRUS_RELAY_URL: 'https://relay.example.invalid',
      SUI_NETWORK: 'testnet',
      WALRUS_EPOCHS: '2',
      WALRUS_DELETABLE: 'false',
    });

    expect(config.demoMode).toBe('live');
    expect(config.liveWalrusUpload).toBe(true);
    expect(config.suiNetwork).toBe('testnet');
    expect(config.walrusEpochs).toBe(2);
    expect(config.walrusDeletable).toBe(false);
  });
});
