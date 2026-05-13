import { normalizeProviderBaseUrl } from './model-provider-url.js';

export type EndpointMode = 'responses' | 'chat_completions' | 'auto';
export type StorageMode = 'session' | 'local';

export type ModelSettings = {
  baseUrl: string;
  modelName: string;
  apiKey: string;
  endpointMode: EndpointMode;
  storageMode: StorageMode;
  localStorageWarningAck?: string;
  useLocalRelay: boolean;
};

export type ModelSettingsInput = Partial<ModelSettings> & Pick<ModelSettings, 'baseUrl' | 'modelName' | 'apiKey'> & { endpointMode: string };

export const LOCAL_STORAGE_WARNING_ACK = 'I understand this stores my BYOK provider key in this browser profile.';

const endpointModes = new Set(['responses', 'chat_completions', 'auto']);

export function normalizeModelSettings(input: ModelSettingsInput): ModelSettings {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const modelName = requiredTrimmed(input.modelName, 'model name');
  const apiKey = requiredTrimmed(input.apiKey, 'API key');
  const endpointMode = normalizeEndpointMode(input.endpointMode);
  const storageMode = input.storageMode ?? 'session';
  if (storageMode !== 'session' && storageMode !== 'local') throw new Error('storage mode is invalid');
  if (storageMode === 'local' && input.localStorageWarningAck !== LOCAL_STORAGE_WARNING_ACK) {
    throw new Error('localStorage requires explicit BYOK warning acknowledgement');
  }
  return {
    baseUrl,
    modelName,
    apiKey,
    endpointMode,
    storageMode,
    ...(input.localStorageWarningAck ? { localStorageWarningAck: input.localStorageWarningAck } : {}),
    useLocalRelay: input.useLocalRelay ?? false,
  };
}

export function normalizeBaseUrl(value: string): string {
  return normalizeProviderBaseUrl(value).baseUrl;
}

export function normalizeEndpointMode(value: string): EndpointMode {
  if (!endpointModes.has(value)) throw new Error('endpoint mode is invalid');
  return value as EndpointMode;
}

export function maskApiKey(value: string): string {
  if (value.length === 0) return 'not configured';
  if (value.length <= 8) return 'configured';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function settingsStorageKey(mode: StorageMode): string {
  return mode === 'session' ? 'tracelayer.modelSettings.session' : 'tracelayer.modelSettings.local';
}

function requiredTrimmed(value: string, name: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error(`${name} is required`);
  return trimmed;
}
