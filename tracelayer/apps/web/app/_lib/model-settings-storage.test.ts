import { describe, expect, it } from 'vitest';
import { loadStoredModelSettings, saveStoredModelSettings } from './model-settings-storage.js';
import { LOCAL_STORAGE_WARNING_ACK, settingsStorageKey, type ModelSettings } from './model-settings.js';

const settings: ModelSettings = {
  baseUrl: 'https://provider.example.invalid',
  modelName: 'demo-model',
  apiKey: 'sk-test-placeholder',
  endpointMode: 'responses',
  storageMode: 'session',
  useLocalRelay: false,
};

describe('model settings storage', () => {
  it('saves session settings only to sessionStorage', () => {
    const storage = memoryStorage();

    saveStoredModelSettings(settings, storage);

    expect(storage.session.getItem(settingsStorageKey('session'))).toContain('demo-model');
    expect(storage.local.getItem(settingsStorageKey('local'))).toBeNull();
  });

  it('saves local settings only after opt-in acknowledgment', () => {
    const storage = memoryStorage();
    const localSettings = { ...settings, storageMode: 'local' as const, localStorageWarningAck: LOCAL_STORAGE_WARNING_ACK };

    saveStoredModelSettings(localSettings, storage);

    expect(storage.local.getItem(settingsStorageKey('local'))).toContain(LOCAL_STORAGE_WARNING_ACK);
    expect(storage.session.getItem(settingsStorageKey('session'))).toBeNull();
  });

  it('loads local settings before session settings when both exist', () => {
    const storage = memoryStorage();
    saveStoredModelSettings(settings, storage);
    saveStoredModelSettings({ ...settings, modelName: 'local-model', storageMode: 'local', localStorageWarningAck: LOCAL_STORAGE_WARNING_ACK }, storage);

    expect(loadStoredModelSettings(storage)?.modelName).toBe('local-model');
  });
});

function memoryStorage() {
  return { session: new MemoryStorage(), local: new MemoryStorage() };
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
