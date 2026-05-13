import { buildProviderEndpoint, preferredInitialEndpointMode } from './model-provider-url.js';
import type { EndpointMode } from './model-settings.js';

export type BuildModelRequestInput = {
  baseUrl: string;
  modelName: string;
  endpointMode: EndpointMode;
  task: string;
};

export type BuiltModelRequest = {
  url: string;
  path: '/responses' | '/chat/completions';
  mode: Exclude<EndpointMode, 'auto'>;
  body: Record<string, unknown>;
};

const systemPrompt = [
  'You generate one TraceLayer artifact as strict JSON only.',
  'Do not include private chain-of-thought.',
  'Set chainOfThoughtIncluded to false.',
  'Do not include Walrus blob IDs, Sui digests, anchor object IDs, proof event IDs, run IDs, API keys, tokens, or secrets.',
].join(' ');

export function buildModelRequest(input: BuildModelRequestInput): BuiltModelRequest {
  const mode = preferredInitialEndpointMode(input.baseUrl, input.endpointMode);
  const endpoint = buildProviderEndpoint(input.baseUrl, mode);
  if (mode === 'responses') {
    return {
      url: endpoint.url,
      path: endpoint.path,
      mode,
      body: {
        model: input.modelName,
        instructions: systemPrompt,
        input: modelUserPrompt(input.task),
        text: { format: { type: 'json_object' } },
      },
    };
  }
  return {
    url: endpoint.url,
    path: endpoint.path,
    mode,
    body: {
      model: input.modelName,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: modelUserPrompt(input.task) },
      ],
    },
  };
}

export function extractModelOutputText(value: unknown): string {
  if (isRecord(value)) {
    if (typeof value.output_text === 'string') return value.output_text;
    const choices = value.choices;
    if (Array.isArray(choices)) {
      const first = choices[0];
      if (isRecord(first) && isRecord(first.message) && typeof first.message.content === 'string') return first.message.content;
    }
    const output = value.output;
    if (Array.isArray(output)) {
      for (const entry of output) {
        if (!isRecord(entry) || !Array.isArray(entry.content)) continue;
        for (const content of entry.content) {
          if (isRecord(content) && typeof content.text === 'string') return content.text;
        }
      }
    }
  }
  throw new Error('model response did not include output text');
}

export function shouldTryFallbackEndpoint(status: number): boolean {
  return status === 404 || status === 405;
}

export function redactProviderDiagnostics(value: string, apiKey?: string): string {
  let redacted = value.replace(/Bearer\s+[^\s"'}]+/gi, 'Bearer [redacted]');
  redacted = redacted.replace(/("(?:apiKey|authorization|token|providerKey)"\s*:\s*")[^"]+/gi, '$1[redacted]');
  if (apiKey && apiKey.length > 0) redacted = redacted.split(apiKey).join('[redacted]');
  return redacted;
}

function modelUserPrompt(task: string): string {
  return `Task: ${task}\n\nReturn JSON with title, summary, taskUnderstanding, artifactType=markdown_report, artifactMarkdown, memoryRefs, replayNotes, riskNotes, chainOfThoughtIncluded=false.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
