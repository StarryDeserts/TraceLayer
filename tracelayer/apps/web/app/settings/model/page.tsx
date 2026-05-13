'use client';

import { useEffect, useState } from 'react';
import { Button, Card, DataField, HeroPanel, KeyValue, ProductShell, StatusPill, Topbar } from '../../_components/ui.js';
import { browserModelSettingsStorage, loadStoredModelSettings, saveStoredModelSettings } from '../../_lib/model-settings-storage.js';
import { isLocalProviderBaseUrl, normalizeProviderBaseUrl } from '../../_lib/model-provider-url.js';
import { LOCAL_STORAGE_WARNING_ACK, maskApiKey, normalizeModelSettings, type EndpointMode, type StorageMode } from '../../_lib/model-settings.js';

type FormState = {
  baseUrl: string;
  modelName: string;
  apiKey: string;
  endpointMode: EndpointMode;
  storageMode: StorageMode;
  localStorageWarningAck: string;
  useLocalRelay: boolean;
};

const defaultForm: FormState = {
  baseUrl: 'https://api.openai.com/v1',
  modelName: '',
  apiKey: '',
  endpointMode: 'responses',
  storageMode: 'session',
  localStorageWarningAck: '',
  useLocalRelay: false,
};

function localProviderWarning(baseUrl: string): string | undefined {
  try {
    return isLocalProviderBaseUrl(baseUrl) ? normalizeProviderBaseUrl(baseUrl).warning : undefined;
  } catch {
    return undefined;
  }
}

export default function ModelSettingsPage() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [savedSummary, setSavedSummary] = useState('No model settings saved in this browser profile.');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storage = browserModelSettingsStorage();
    if (storage === undefined) return;
    const saved = loadStoredModelSettings(storage);
    if (saved === undefined) return;
    setForm({
      baseUrl: saved.baseUrl,
      modelName: saved.modelName,
      apiKey: saved.apiKey,
      endpointMode: saved.endpointMode,
      storageMode: saved.storageMode,
      localStorageWarningAck: saved.localStorageWarningAck ?? '',
      useLocalRelay: saved.useLocalRelay,
    });
    setSavedSummary(`${saved.storageMode === 'local' ? 'Local persistence' : 'Session-only'} saved for ${saved.modelName} with key ${maskApiKey(saved.apiKey)}.`);
  }, []);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function saveSettings() {
    setError(null);
    const storage = browserModelSettingsStorage();
    if (storage === undefined) {
      setError('Model settings can only be saved in a browser session.');
      return;
    }
    try {
      const normalized = normalizeModelSettings(form);
      saveStoredModelSettings(normalized, storage);
      setSavedSummary(`${normalized.storageMode === 'local' ? 'Local persistence' : 'Session-only'} saved for ${normalized.modelName} with key ${maskApiKey(normalized.apiKey)}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'model settings are invalid');
    }
  }

  const localStorageArmed = form.storageMode === 'local' && form.localStorageWarningAck === LOCAL_STORAGE_WARNING_ACK;
  const localHttpWarning = localProviderWarning(form.baseUrl);

  return (
    <ProductShell active="Settings">
      <Topbar current="Model Settings" badges={[{ tone: 'cyan', text: 'BYOK local demo' }, { tone: form.storageMode === 'local' ? 'amber' : 'green', text: form.storageMode === 'local' ? 'Local opt-in' : 'Session default' }]} />
      <HeroPanel
        kicker="Phase 5 · BYOK model configuration"
        title="Configure an OpenAI-compatible model without sending provider keys to TraceLayer."
        badges={[{ tone: 'green', text: 'sessionStorage default' }, { tone: 'amber', text: 'localStorage requires acknowledgement' }, { tone: 'purple', text: 'dev relay optional' }]}
      >
        This page stores a browser-local BYOK provider key for the live demo flow. The TraceLayer API receives validated artifacts only; provider keys must not enter proof events, replay context, backend storage, or screenshots.
      </HeroPanel>

      <div className="layout-grid">
        <section className="stack">
          <Card title="Provider settings" description="Use an OpenAI-compatible Responses or Chat Completions endpoint. HTTPS is required for remote providers. Local HTTP is allowed for localhost in dev/demo mode.">
            <form className="form-stack" onSubmit={(event) => { event.preventDefault(); saveSettings(); }}>
              <label className="form-field" htmlFor="baseUrl">
                <span>Base URL</span>
                <input id="baseUrl" value={form.baseUrl} onChange={(event) => updateForm('baseUrl', event.target.value)} placeholder="https://api.openai.com/v1" />
                <small>Examples: OpenAI https://api.openai.com/v1 · Local OpenAI-compatible http://localhost:1234/v1 · Ollama OpenAI-compatible http://localhost:11434/v1 if configured.</small>
              </label>
              {localHttpWarning ? <div className="diagnostic tone-amber">{localHttpWarning}</div> : null}
              <label className="form-field" htmlFor="modelName">
                <span>Model name</span>
                <input id="modelName" value={form.modelName} onChange={(event) => updateForm('modelName', event.target.value)} placeholder="gpt-4.1-mini or compatible model" />
              </label>
              <label className="form-field" htmlFor="apiKey">
                <span>Provider API key</span>
                <input id="apiKey" type="password" value={form.apiKey} onChange={(event) => updateForm('apiKey', event.target.value)} autoComplete="off" placeholder="Stored only in the selected browser storage mode" />
              </label>
              <div className="form-grid">
                <label className="form-field" htmlFor="endpointMode">
                  <span>Endpoint mode</span>
                  <select id="endpointMode" value={form.endpointMode} onChange={(event) => updateForm('endpointMode', event.target.value as EndpointMode)}>
                    <option value="responses">Responses</option>
                    <option value="chat_completions">Chat Completions</option>
                    <option value="auto">Auto fallback</option>
                  </select>
                </label>
                <label className="form-field" htmlFor="storageMode">
                  <span>Storage mode</span>
                  <select id="storageMode" value={form.storageMode} onChange={(event) => updateForm('storageMode', event.target.value as StorageMode)}>
                    <option value="session">Session-only</option>
                    <option value="local">Local persistence</option>
                  </select>
                </label>
              </div>
              <label className="check-row" htmlFor="useLocalRelay">
                <input id="useLocalRelay" type="checkbox" checked={form.useLocalRelay} onChange={(event) => updateForm('useLocalRelay', event.target.checked)} />
                <span>Use development local relay when browser-direct provider calls are blocked by CORS.</span>
              </label>
              {form.storageMode === 'local' ? (
                <label className="form-field warning-field" htmlFor="localAck">
                  <span>Local persistence acknowledgement</span>
                  <input id="localAck" value={form.localStorageWarningAck} onChange={(event) => updateForm('localStorageWarningAck', event.target.value)} placeholder={LOCAL_STORAGE_WARNING_ACK} />
                  <small>Type the acknowledgement exactly to store the BYOK provider key in localStorage for this browser profile.</small>
                </label>
              ) : null}
              <div className="actions">
                <Button primary type="submit" disabled={form.storageMode === 'local' && !localStorageArmed}>Save model settings</Button>
                <a className="btn" href="/demo">Open live demo</a>
              </div>
              {error ? <div className="diagnostic tone-red" role="alert">{error}</div> : null}
            </form>
          </Card>
        </section>

        <aside className="side">
          <Card title="Current browser state" description="Raw API keys are only shown by the password field while editing.">
            <div className="stack compact">
              <DataField label="Saved settings" value={savedSummary} />
              <KeyValue label="Masked key" value={maskApiKey(form.apiKey)} />
              <KeyValue label="Storage target" value={form.storageMode === 'local' ? 'localStorage' : 'sessionStorage'} />
              <KeyValue label="Local opt-in" value={form.storageMode === 'local' ? (localStorageArmed ? 'acknowledged' : 'missing acknowledgement') : 'not requested'} />
              <KeyValue label="Relay mode" value={form.useLocalRelay ? 'development relay enabled' : 'browser direct'} />
              <StatusPill label={{ tone: form.storageMode === 'local' ? 'amber' : 'green', text: form.storageMode === 'local' ? 'Persistent key risk' : 'Session-scoped key' }} />
            </div>
            <div className="helper">Do not enter secrets in task prompts. TraceLayer validates model output and rejects proof identifiers, provider keys, and secret-like fields before registration.</div>
          </Card>
        </aside>
      </div>
    </ProductShell>
  );
}
