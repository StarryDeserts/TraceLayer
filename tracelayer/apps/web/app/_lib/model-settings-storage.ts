import { normalizeEndpointMode, normalizeModelSettings, settingsStorageKey, type ModelSettings } from './model-settings.js';

export type ModelSettingsStorage = {
  session: Storage;
  local: Storage;
};

export function browserModelSettingsStorage(): ModelSettingsStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  return { session: window.sessionStorage, local: window.localStorage };
}

export function saveStoredModelSettings(settings: ModelSettings, storage: ModelSettingsStorage): void {
  const normalized = normalizeModelSettings(settings);
  const serialized = JSON.stringify(normalized);
  if (normalized.storageMode === 'local') {
    storage.local.setItem(settingsStorageKey('local'), serialized);
    storage.session.removeItem(settingsStorageKey('session'));
    return;
  }
  storage.session.setItem(settingsStorageKey('session'), serialized);
  storage.local.removeItem(settingsStorageKey('local'));
}

export function loadStoredModelSettings(storage: ModelSettingsStorage): ModelSettings | undefined {
  return readStoredSettings(storage.local, settingsStorageKey('local')) ?? readStoredSettings(storage.session, settingsStorageKey('session'));
}

function readStoredSettings(storage: Storage, key: string): ModelSettings | undefined {
  const value = storage.getItem(key);
  if (value === null) return undefined;
  try {
    const parsed = JSON.parse(value) as Partial<ModelSettings> & { endpointMode?: unknown };
    return normalizeModelSettings({
      baseUrl: stringValue(parsed.baseUrl),
      modelName: stringValue(parsed.modelName),
      apiKey: stringValue(parsed.apiKey),
      endpointMode: normalizeEndpointMode(stringValue(parsed.endpointMode)),
      ...(parsed.storageMode ? { storageMode: parsed.storageMode } : {}),
      ...(parsed.localStorageWarningAck ? { localStorageWarningAck: parsed.localStorageWarningAck } : {}),
      ...(parsed.useLocalRelay !== undefined ? { useLocalRelay: parsed.useLocalRelay } : {}),
    });
  } catch {
    return undefined;
  }
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
