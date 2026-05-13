import { describe, expect, it } from 'vitest';
import { LOCAL_STORAGE_WARNING_ACK, maskApiKey, normalizeModelSettings, settingsStorageKey, type ModelSettingsInput } from './model-settings.js';

describe('model settings helpers', () => {
  it('defaults to session storage and normalizes base URL', () => {
    const settings = normalizeModelSettings({ baseUrl: 'https://provider.example.invalid/v1/', modelName: ' demo-model ', apiKey: 'key-value', endpointMode: 'responses' });

    expect(settings.storageMode).toBe('session');
    expect(settings.baseUrl).toBe('https://provider.example.invalid/v1');
    expect(settings.modelName).toBe('demo-model');
    expect(settings.endpointMode).toBe('responses');
  });

  it('allows local HTTP OpenAI-compatible providers', () => {
    expect(normalizeModelSettings({ baseUrl: 'http://localhost:1234/v1', modelName: 'demo', apiKey: 'key-value', endpointMode: 'auto' }).baseUrl).toBe('http://localhost:1234/v1');
    expect(normalizeModelSettings({ baseUrl: 'http://127.0.0.1:1234/v1', modelName: 'demo', apiKey: 'key-value', endpointMode: 'auto' }).baseUrl).toBe('http://127.0.0.1:1234/v1');
    expect(normalizeModelSettings({ baseUrl: 'http://[::1]:1234/v1', modelName: 'demo', apiKey: 'key-value', endpointMode: 'auto' }).baseUrl).toBe('http://[::1]:1234/v1');
  });

  it('requires explicit warning acknowledgement for local storage', () => {
    expect(() => normalizeModelSettings({ baseUrl: 'https://provider.example.invalid/v1', modelName: 'demo', apiKey: 'key-value', endpointMode: 'auto', storageMode: 'local' })).toThrow('localStorage requires explicit BYOK warning acknowledgement');

    expect(normalizeModelSettings({ baseUrl: 'https://provider.example.invalid/v1', modelName: 'demo', apiKey: 'key-value', endpointMode: 'auto', storageMode: 'local', localStorageWarningAck: LOCAL_STORAGE_WARNING_ACK }).storageMode).toBe('local');
  });

  it('rejects invalid endpoint modes and empty required fields', () => {
    expect(() => normalizeModelSettings({ baseUrl: 'not a url', modelName: 'demo', apiKey: 'key-value', endpointMode: 'auto' })).toThrow('base URL must be a valid URL');
    expect(() => normalizeModelSettings({ baseUrl: 'http://remote-host/v1', modelName: 'demo', apiKey: 'key-value', endpointMode: 'auto' })).toThrow('remote HTTP providers are blocked');
    expect(() => normalizeModelSettings({ baseUrl: 'https://provider.example.invalid/v1', modelName: '', apiKey: 'key-value', endpointMode: 'auto' })).toThrow('model name is required');
    expect(() => normalizeModelSettings({ baseUrl: 'https://provider.example.invalid/v1', modelName: 'demo', apiKey: 'key-value', endpointMode: 'legacy' } as unknown as ModelSettingsInput)).toThrow('endpoint mode is invalid');
  });

  it('masks API keys and uses distinct storage keys', () => {
    expect(maskApiKey('sk-1234567890abcdef')).toBe('sk-1...cdef');
    expect(maskApiKey('')).toBe('not configured');
    expect(settingsStorageKey('session')).not.toBe(settingsStorageKey('local'));
  });
});
