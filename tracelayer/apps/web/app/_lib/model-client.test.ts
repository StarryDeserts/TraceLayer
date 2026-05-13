import { describe, expect, it } from 'vitest';
import { buildModelRequest, extractModelOutputText, shouldTryFallbackEndpoint, redactProviderDiagnostics } from './model-client.js';

describe('model client helpers', () => {
  it('builds Responses API requests without exposing keys in the body', () => {
    const request = buildModelRequest({ baseUrl: 'https://provider.example.invalid/v1', modelName: 'demo-model', endpointMode: 'responses', task: 'Write a proof report.' });

    expect(request.url).toBe('https://provider.example.invalid/v1/responses');
    expect(request.path).toBe('/responses');
    expect(request.body.model).toBe('demo-model');
    expect(JSON.stringify(request.body)).not.toContain('apiKey');
    expect(JSON.stringify(request.body)).toContain('chainOfThoughtIncluded');
  });

  it('builds Chat Completions requests', () => {
    const request = buildModelRequest({ baseUrl: 'https://provider.example.invalid/v1', modelName: 'demo-model', endpointMode: 'chat_completions', task: 'Write a proof report.' });

    expect(request.url).toBe('https://provider.example.invalid/v1/chat/completions');
    expect(request.path).toBe('/chat/completions');
    expect(request.body.messages).toHaveLength(2);
  });

  it('prefers Chat Completions first for local HTTP auto mode', () => {
    const request = buildModelRequest({ baseUrl: 'http://localhost:1234/v1', modelName: 'demo-model', endpointMode: 'auto', task: 'Write a proof report.' });

    expect(request.mode).toBe('chat_completions');
    expect(request.url).toBe('http://localhost:1234/v1/chat/completions');
    expect(request.path).toBe('/chat/completions');
  });

  it('extracts output text from Responses and Chat Completions payloads', () => {
    expect(extractModelOutputText({ output_text: '{"ok":true}' })).toBe('{"ok":true}');
    expect(extractModelOutputText({ choices: [{ message: { content: '{"ok":true}' } }] })).toBe('{"ok":true}');
  });

  it('falls back only for unsupported endpoint failures', () => {
    expect(shouldTryFallbackEndpoint(404)).toBe(true);
    expect(shouldTryFallbackEndpoint(405)).toBe(true);
    expect(shouldTryFallbackEndpoint(401)).toBe(false);
    expect(shouldTryFallbackEndpoint(403)).toBe(false);
  });

  it('redacts provider diagnostics', () => {
    const redacted = redactProviderDiagnostics('Authorization: Bearer secret-value\n{"apiKey":"secret-value","ok":true}', 'secret-value');

    expect(redacted).not.toContain('secret-value');
    expect(redacted).toContain('[redacted]');
  });
});
