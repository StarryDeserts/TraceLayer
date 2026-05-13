import { describe, expect, it } from 'vitest';
import { buildProviderEndpoint, normalizeProviderBaseUrl, preferredInitialEndpointMode } from './model-provider-url.js';

describe('model provider URL helpers', () => {
  it('accepts HTTPS remote provider base URLs', () => {
    expect(normalizeProviderBaseUrl('https://api.openai.com/v1/').baseUrl).toBe('https://api.openai.com/v1');
  });

  it('accepts local HTTP provider base URLs for demo mode', () => {
    expect(normalizeProviderBaseUrl('http://localhost:1234/v1').baseUrl).toBe('http://localhost:1234/v1');
    expect(normalizeProviderBaseUrl('http://127.0.0.1:1234/v1').baseUrl).toBe('http://127.0.0.1:1234/v1');
    expect(normalizeProviderBaseUrl('http://[::1]:1234/v1').baseUrl).toBe('http://[::1]:1234/v1');
  });

  it('rejects remote HTTP and credentialed provider URLs', () => {
    expect(() => normalizeProviderBaseUrl('http://provider.example.invalid/v1')).toThrow('remote HTTP providers are blocked');
    expect(() => normalizeProviderBaseUrl('https://user:pass@provider.example.invalid/v1')).toThrow('base URL must not include username or password');
    expect(() => normalizeProviderBaseUrl('https://provider.example.invalid/v1?debug=true')).toThrow('base URL must not include query string or fragment');
    expect(() => normalizeProviderBaseUrl('https://provider.example.invalid/v1#frag')).toThrow('base URL must not include query string or fragment');
  });

  it('accepts /v1 base paths and rejects full endpoint paths with clear copy', () => {
    expect(normalizeProviderBaseUrl('http://localhost:1234/v1').baseUrl).toBe('http://localhost:1234/v1');
    expect(() => normalizeProviderBaseUrl('http://localhost:1234/v1/chat/completions')).toThrow('Enter the provider base URL');
    expect(() => normalizeProviderBaseUrl('http://localhost:1234/v1/responses')).toThrow('Enter the provider base URL');
  });

  it('builds endpoint suffixes from normalized base URLs', () => {
    expect(buildProviderEndpoint('http://localhost:1234/v1', 'chat_completions')).toMatchObject({
      url: 'http://localhost:1234/v1/chat/completions',
      path: '/chat/completions',
      mode: 'chat_completions',
    });
    expect(buildProviderEndpoint('https://api.openai.com/v1', 'responses')).toMatchObject({
      url: 'https://api.openai.com/v1/responses',
      path: '/responses',
      mode: 'responses',
    });
  });

  it('prefers chat completions for local HTTP auto mode and responses for remote HTTPS auto mode', () => {
    expect(preferredInitialEndpointMode('http://localhost:1234/v1', 'auto')).toBe('chat_completions');
    expect(preferredInitialEndpointMode('https://api.openai.com/v1', 'auto')).toBe('responses');
  });
});
