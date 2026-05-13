'use client';

import { useEffect, useMemo, useState } from 'react';
import { getWallets, type Wallet, type WalletAccount } from '@wallet-standard/core';
import { signAndExecuteTransaction } from '@mysten/wallet-standard';
import { JsonCodeBlock } from '../_components/JsonCodeBlock.js';
import { Button, ButtonLink, Card, DataField, HashComparison, HeroPanel, Identifier, KeyValue, ProductShell, ProofPathRibbon, ProofTimeline, StatusPill, Topbar } from '../_components/ui.js';
import { buildModelRequest, extractModelOutputText, redactProviderDiagnostics, shouldTryFallbackEndpoint, type BuiltModelRequest } from '../_lib/model-client.js';
import { parseModelArtifactOutput, type ModelArtifact } from '../_lib/model-artifact.js';
import { classifyProviderError, isLocalProviderBaseUrl, sanitizeProviderUrl } from '../_lib/model-provider-url.js';
import { browserModelSettingsStorage, loadStoredModelSettings } from '../_lib/model-settings-storage.js';
import { maskApiKey, type EndpointMode, type ModelSettings } from '../_lib/model-settings.js';
import { traceLayerErrorMessage, type TraceLayerProxyDiagnostics } from '../_lib/trace-layer-errors.js';
import { anchorDisabledReasons, extractDigest, normalizeAddress, transactionInput, walletCanSignSuiTransaction } from '../_lib/wallet-standard.js';
import { WalletConnectModal } from './_components/WalletConnectModal.js';

type WalletEntry = {
  key: string;
  wallet: Wallet;
};

type ConnectFeature = {
  connect(): Promise<{ accounts: WalletAccount[] }>;
};

type Capabilities = {
  demoMode: string;
  walrusLiveUpload: boolean;
  suiAnchorLive: boolean;
  suiNetwork: string;
  suiAnchorPackageConfigured: boolean;
  suiAnchorPackageId?: string;
};

type ArtifactRef = {
  artifactId: string;
  runId: string;
  state: string;
  sha256: string;
  blobId?: string;
  blobObjectId?: string;
  verificationStatus: string;
  anchorMode?: string;
  anchorTxDigest?: string;
  anchorObjectId?: string;
  signerAddress?: string;
  onChainOwnerAddress?: string;
  serviceSigned?: boolean;
};

type ProofEvent = {
  type: string;
  summary: string;
  proofEventId?: string;
  walrusBlobId?: string;
  suiTxDigest?: string;
  anchorMode?: string;
};

type RegistrationResponse = {
  run: { runId: string; status: string; taskSummary: string };
  artifact: ArtifactRef;
  proofEvents: ProofEvent[];
};

type UploadResponse = { artifact: ArtifactRef };
type VerifyResponse = { artifact: ArtifactRef; expectedSha256?: string; actualSha256?: string; verificationStatus: string };
type PrepareAnchorResponse = { artifact: ArtifactRef; preparedAnchor: { anchorMode: 'wallet-signed'; transactionJson: string; transactionBytesBase64?: string; target: string }; proofEvent: ProofEvent };
type RecordAnchorResponse = { artifact: ArtifactRef; anchor?: { txDigest: string; anchorObjectId?: string; onChainOwnerAddress?: string }; proofEvent?: ProofEvent };
type ReplayResponse = { replayContext: { runId: string; chainOfThoughtIncluded: false; proofEvents?: ProofEvent[]; artifacts?: ArtifactRef[] } };

type FlowStage = 'idle' | 'model_running' | 'artifact_ready' | 'registered' | 'uploading' | 'uploaded' | 'verifying' | 'verified' | 'anchor_prepared' | 'signing' | 'anchored' | 'replay_ready' | 'failed';

type ProviderError = Error & { status?: number | undefined; endpoint?: BuiltModelRequest | undefined };

type TraceLayerRequestInput = {
  path: string;
  method: 'GET' | 'POST';
  body?: unknown;
};

const apiBaseUrl = '/api/trace-layer';
const defaultTask = 'Review the user-provided release notes and produce a concise TraceLayer markdown report with observable risks, replay notes, and no private chain-of-thought.';

export default function LiveDemoPage() {
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<ModelSettings | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [walletEntries, setWalletEntries] = useState<WalletEntry[]>([]);
  const [walletsLoaded, setWalletsLoaded] = useState(false);
  const [selectedWalletKey, setSelectedWalletKey] = useState('');
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<WalletAccount[]>([]);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [task, setTask] = useState(defaultTask);
  const [stage, setStage] = useState<FlowStage>('idle');
  const [artifact, setArtifact] = useState<ModelArtifact | null>(null);
  const [artifactJsonText, setArtifactJsonText] = useState('');
  const [registered, setRegistered] = useState<RegistrationResponse | null>(null);
  const [artifactState, setArtifactState] = useState<ArtifactRef | null>(null);
  const [expectedSha256, setExpectedSha256] = useState('');
  const [actualSha256, setActualSha256] = useState('');
  const [preparedAnchor, setPreparedAnchor] = useState<PrepareAnchorResponse | null>(null);
  const [anchorRecord, setAnchorRecord] = useState<RecordAnchorResponse | null>(null);
  const [replay, setReplay] = useState<ReplayResponse | null>(null);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedWallet = walletEntries.find((entry) => entry.key === selectedWalletKey)?.wallet ?? null;
  const walletNetwork = account?.chains.find((chain) => chain === 'sui:testnet' || chain.startsWith('sui:'));
  const walletCanSign = walletCanSignSuiTransaction(selectedWallet);
  const disabledReasons = anchorDisabledReasons({
    artifactVerified: artifactState?.verificationStatus === 'verified',
    walletConnected: account !== null,
    walletAddress: account?.address,
    walletCanSign,
    suiAnchorPackageConfigured: capabilities?.suiAnchorPackageConfigured === true,
    suiNetwork: capabilities?.suiNetwork ?? 'unknown',
    walletNetwork,
  });
  const proofEvents = useMemo(() => [...(registered?.proofEvents ?? []), ...(preparedAnchor ? [preparedAnchor.proofEvent] : []), ...(anchorRecord?.proofEvent ? [anchorRecord.proofEvent] : [])], [anchorRecord, preparedAnchor, registered]);

  useEffect(() => {
    setMounted(true);
    const storage = browserModelSettingsStorage();
    if (storage !== undefined) setSettings(loadStoredModelSettings(storage) ?? null);
    void refreshCapabilities();

    const registry = getWallets();
    const updateWallets = () => setWalletEntries(dedupeWallets(registry.get()));
    updateWallets();
    setWalletsLoaded(true);
    const offRegister = registry.on('register', updateWallets);
    const offUnregister = registry.on('unregister', updateWallets);
    return () => {
      offRegister();
      offUnregister();
    };
  }, []);

  async function refreshCapabilities() {
    try {
      await traceLayerRequest({ path: '/health', method: 'GET' });
      const nextCapabilities = await traceLayerRequest<Capabilities>({ path: '/api/live-demo/capabilities', method: 'GET' });
      setCapabilities(nextCapabilities);
    } catch (caught) {
      setError(messageFromUnknown(caught, 'TraceLayer API is not reachable.'));
    }
  }

  async function connectWallet(entry: WalletEntry) {
    try {
      const connect = entry.wallet.features['standard:connect'] as ConnectFeature | undefined;
      if (connect === undefined) throw new Error('selected wallet does not support standard:connect');
      const connected = await connect.connect();
      const accounts = connected.accounts.length > 0 ? connected.accounts : entry.wallet.accounts;
      const firstAccount = accounts[0];
      if (firstAccount === undefined) throw new Error('wallet did not expose a Sui account');
      setSelectedWalletKey(entry.key);
      setConnectedAccounts([...accounts]);
      setAccount(firstAccount);
      setWalletModalOpen(accounts.length > 1);
      setError(null);
    } catch (caught) {
      setError(messageFromUnknown(caught, 'wallet connection failed'));
    }
  }

  function refreshWalletAccounts() {
    if (selectedWallet === null) return;
    setConnectedAccounts([...selectedWallet.accounts]);
    const refreshedAccount = selectedWallet.accounts.find((walletAccount) => walletAccount.address === account?.address) ?? selectedWallet.accounts[0] ?? null;
    setAccount(refreshedAccount);
  }

  async function disconnectWallet() {
    const disconnect = selectedWallet?.features['standard:disconnect'] as { disconnect(): Promise<void> } | undefined;
    try {
      await disconnect?.disconnect();
    } catch (caught) {
      setError(messageFromUnknown(caught, 'wallet disconnect failed'));
    }
    setSelectedWalletKey('');
    setConnectedAccounts([]);
    setAccount(null);
    setPreparedAnchor(null);
  }

  async function runModel() {
    if (settings === null) {
      setError('Save BYOK model settings before running the live demo.');
      return;
    }
    setStage('model_running');
    setError(null);
    setDiagnostics([]);
    setArtifact(null);
    setArtifactJsonText('');
    setRegistered(null);
    setArtifactState(null);
    setExpectedSha256('');
    setActualSha256('');
    setPreparedAnchor(null);
    setAnchorRecord(null);
    setReplay(null);
    try {
      const outputText = await callModelProvider(settings, task);
      const parsed = parseModelArtifactOutput(outputText);
      setArtifact(parsed.artifact);
      setArtifactJsonText(parsed.artifactJsonText);
      setStage('artifact_ready');
      recordDiagnostic('Model returned a validated artifact with chainOfThoughtIncluded=false.');
    } catch (caught) {
      setStage('failed');
      recordModelFailureDiagnostic(caught, settings);
      setError(messageFromUnknown(caught, 'model artifact validation failed'));
    }
  }

  async function registerArtifact() {
    if (settings === null || artifactJsonText.length === 0) return;
    setError(null);
    try {
      const registration = await traceLayerRequest<RegistrationResponse>({
        path: '/api/live-demo/model-artifact-run',
        method: 'POST',
        body: {
          artifactJsonText,
          taskInputPreview: task.slice(0, 1_000),
          modelName: settings.modelName,
          endpointMode: settings.endpointMode,
          providerOrigin: new URL(settings.baseUrl).origin,
          ...(account?.address ? { ownerAddress: account.address } : {}),
        },
      });
      setRegistered(registration);
      setArtifactState(registration.artifact);
      setExpectedSha256(registration.artifact.sha256);
      setStage('registered');
      recordDiagnostic(`Registered run ${registration.run.runId} and artifact ${registration.artifact.artifactId}.`);
    } catch (caught) {
      setStage('failed');
      setError(messageFromUnknown(caught, 'artifact registration failed'));
    }
  }

  async function uploadArtifact() {
    if (artifactState === null) return;
    setStage('uploading');
    setError(null);
    try {
      const upload = await traceLayerRequest<UploadResponse>({ path: `/api/artifacts/${artifactState.artifactId}/upload`, method: 'POST', body: {} });
      setArtifactState(upload.artifact);
      setStage('uploaded');
      recordDiagnostic('Walrus upload completed; blob identifiers are now safe to display.');
    } catch (caught) {
      setStage('failed');
      setError(messageFromUnknown(caught, 'Walrus upload failed'));
    }
  }

  async function verifyArtifact() {
    if (artifactState === null) return;
    setStage('verifying');
    setError(null);
    try {
      const verification = await traceLayerRequest<VerifyResponse>({ path: `/api/artifacts/${artifactState.artifactId}/verify`, method: 'POST', body: {} });
      setArtifactState(verification.artifact);
      setExpectedSha256(verification.expectedSha256 ?? verification.artifact.sha256);
      setActualSha256(verification.actualSha256 ?? '');
      setStage(verification.verificationStatus === 'verified' ? 'verified' : 'failed');
      recordDiagnostic(`Readback verification status: ${verification.verificationStatus}.`);
    } catch (caught) {
      setStage('failed');
      setError(messageFromUnknown(caught, 'Walrus readback verification failed'));
    }
  }

  async function prepareAnchor() {
    if (artifactState === null || account === null || disabledReasons.length > 0) return;
    setError(null);
    try {
      const prepared = await traceLayerRequest<PrepareAnchorResponse>({
        path: `/api/artifacts/${artifactState.artifactId}/anchor`,
        method: 'POST',
        body: {
          anchorMode: 'wallet-signed',
          signerAddress: account.address,
          claimedOwnerAddress: account.address,
        },
      });
      setPreparedAnchor(prepared);
      setArtifactState(prepared.artifact);
      setStage('anchor_prepared');
      recordDiagnostic('Wallet-signed Sui anchor transaction prepared for sui:testnet.');
    } catch (caught) {
      setStage('failed');
      setError(messageFromUnknown(caught, 'anchor preparation failed'));
    }
  }

  async function signAndRecordAnchor() {
    if (selectedWallet === null || account === null || preparedAnchor === null) return;
    setStage('signing');
    setError(null);
    try {
      const execution = await signAndExecuteTransaction(selectedWallet, {
        account,
        chain: 'sui:testnet',
        transaction: transactionInput(preparedAnchor.preparedAnchor),
      });
      const txDigest = extractDigest(execution);
      const record = await traceLayerRequest<RecordAnchorResponse>({
        path: `/api/artifacts/${preparedAnchor.artifact.artifactId}/anchor`,
        method: 'POST',
        body: {
          anchorMode: 'wallet-signed',
          anchorTxDigest: txDigest,
          signerAddress: account.address,
          claimedOwnerAddress: account.address,
        },
      });
      setAnchorRecord(record);
      setArtifactState(record.artifact);
      setStage('anchored');
      recordDiagnostic(`Wallet-signed anchor recorded with digest ${txDigest}.`);
    } catch (caught) {
      setStage('failed');
      setError(messageFromUnknown(caught, 'wallet signing or anchor recording failed'));
    }
  }

  async function loadReplay() {
    const runId = registered?.run.runId;
    if (runId === undefined) return;
    setError(null);
    try {
      const nextReplay = await traceLayerRequest<ReplayResponse>({ path: `/api/replay/${runId}`, method: 'POST', body: {} });
      setReplay(nextReplay);
      setStage('replay_ready');
      recordDiagnostic('Replay Context loaded with chainOfThoughtIncluded=false.');
    } catch (caught) {
      setStage('failed');
      setError(messageFromUnknown(caught, 'replay request failed'));
    }
  }

  async function callModelProvider(modelSettings: ModelSettings, taskInput: string): Promise<string> {
    const first = buildModelRequest({ baseUrl: modelSettings.baseUrl, modelName: modelSettings.modelName, endpointMode: modelSettings.endpointMode, task: taskInput });
    const response = await executeModelRequest(modelSettings, first);
    if (!response.ok && modelSettings.endpointMode === 'auto' && shouldTryFallbackEndpoint(response.status)) {
      const fallbackMode: EndpointMode = first.mode === 'responses' ? 'chat_completions' : 'responses';
      const fallback = buildModelRequest({ baseUrl: modelSettings.baseUrl, modelName: modelSettings.modelName, endpointMode: fallbackMode, task: taskInput });
      const fallbackResponse = await executeModelRequest(modelSettings, fallback);
      return modelResponseText(fallbackResponse, modelSettings.apiKey, fallback);
    }
    return modelResponseText(response, modelSettings.apiKey, first);
  }

  async function executeModelRequest(modelSettings: ModelSettings, request: BuiltModelRequest): Promise<Response> {
    try {
      if (modelSettings.useLocalRelay) {
        return await fetch('/api/model-agent/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            baseUrl: modelSettings.baseUrl,
            path: request.path,
            apiKey: modelSettings.apiKey,
            body: request.body,
          }),
        });
      }
      return await fetch(request.url, {
        method: 'POST',
        headers: { authorization: `Bearer ${modelSettings.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(request.body),
      });
    } catch (caught) {
      const error = new Error(messageFromUnknown(caught, 'provider is unreachable or blocked by CORS')) as ProviderError;
      error.endpoint = request;
      throw error;
    }
  }

  async function modelResponseText(response: Response, apiKey: string, endpoint?: BuiltModelRequest): Promise<string> {
    const responseText = await response.text();
    if (!response.ok) {
      const providerMessage = providerErrorMessage(responseText, response.status);
      const error = new Error(redactProviderDiagnostics(providerMessage, apiKey)) as ProviderError;
      error.status = response.status;
      error.endpoint = endpoint;
      throw error;
    }
    try {
      return extractModelOutputText(JSON.parse(responseText));
    } catch (caught) {
      const error = new Error(messageFromUnknown(caught, 'invalid model JSON response')) as ProviderError;
      error.status = response.status;
      error.endpoint = endpoint;
      throw error;
    }
  }

  async function traceLayerRequest<T = unknown>(input: TraceLayerRequestInput): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${input.path}`, {
      method: input.method,
      ...(input.body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(input.body) }),
    });
    const responseText = await response.text();
    if (!response.ok) {
      const diagnostics = response.status === 401 ? await loadTraceLayerProxyDiagnostics() : undefined;
      throw new Error(traceLayerErrorMessage(responseText, response.status, { apiUrl: apiBaseUrl, diagnostics }));
    }
    return responseText.length === 0 ? undefined as T : JSON.parse(responseText) as T;
  }

  async function loadTraceLayerProxyDiagnostics(): Promise<TraceLayerProxyDiagnostics | undefined> {
    try {
      const response = await fetch(`${apiBaseUrl}/api/proxy-diagnostics`);
      if (!response.ok) return undefined;
      return await response.json() as TraceLayerProxyDiagnostics;
    } catch {
      return undefined;
    }
  }

  function recordDiagnostic(message: string) {
    setDiagnostics((current) => [message, ...current].slice(0, 8));
  }

  function recordModelFailureDiagnostic(caught: unknown, modelSettings: ModelSettings) {
    const providerError = caught as ProviderError;
    const endpoint = providerError.endpoint;
    const message = messageFromUnknown(caught, 'model provider failed');
    const classification = providerError.status !== undefined ? classifyProviderError(providerError.status, message) : classifyProviderError(0, message);
    const localHttpState = isLocalProviderBaseUrl(modelSettings.baseUrl) ? 'local_http_allowed' : 'remote_https_required';
    recordDiagnostic([
      `classification=${classification}`,
      `baseUrl=${sanitizeProviderUrl(modelSettings.baseUrl)}`,
      `endpointMode=${modelSettings.endpointMode}`,
      `finalPath=${endpoint?.path ?? 'not built'}`,
      `transport=${localHttpState}`,
    ].join(' · '));
  }

  const readyForReplay = artifactState?.state === 'anchored' || stage === 'anchored' || stage === 'replay_ready';

  return (
    <ProductShell active="Demo" {...(registered ? { selectedRunId: registered.run.runId } : {})}>
      <Topbar current="Live Demo" badges={[{ tone: mounted && settings ? 'green' : 'amber', text: mounted && settings ? 'Model configured' : mounted ? 'Settings missing' : 'Loading settings' }, { tone: capabilities?.suiNetwork === 'testnet' ? 'green' : 'amber', text: capabilities?.suiNetwork ?? 'API unknown' }]} />
      <HeroPanel
        kicker="Phase 5 · live model agent run"
        title="Generate one model artifact, then prove it through Walrus, Sui, and Replay Context."
        actions={<ButtonLink href="/settings/model">Model settings</ButtonLink>}
        badges={[{ tone: 'cyan', text: 'BYOK browser call' }, { tone: 'green', text: 'chainOfThoughtIncluded=false' }, { tone: 'purple', text: 'wallet-signed testnet anchor' }]}
      >
        TraceLayer is the proof layer after the model acts. The model returns strict JSON, TraceLayer validates it, the backend uploads and verifies exact bytes on Walrus, and the connected wallet signs the Sui testnet anchor.
      </HeroPanel>

      <ProofPathRibbon steps={[
        { title: 'Settings', subtitle: mounted ? (settings ? 'ready' : 'missing') : 'loading', tone: mounted && settings ? 'green' : 'amber' },
        { title: 'Model', subtitle: stage === 'model_running' ? 'running' : artifact ? 'validated' : 'pending', tone: artifact ? 'green' : stage === 'model_running' ? 'cyan' : 'gray' },
        { title: 'Register', subtitle: registered ? 'server IDs' : 'pending', tone: registered ? 'green' : 'gray' },
        { title: 'Walrus', subtitle: artifactState?.blobId ? 'uploaded' : 'pending', tone: artifactState?.blobId ? 'green' : 'gray' },
        { title: 'Readback', subtitle: artifactState?.verificationStatus ?? 'pending', tone: artifactState?.verificationStatus === 'verified' ? 'green' : 'gray' },
        { title: 'Sui', subtitle: artifactState?.anchorTxDigest ? 'anchored' : 'wallet sign', tone: artifactState?.anchorTxDigest ? 'green' : 'gray' },
        { title: 'Replay', subtitle: replay ? 'ready' : 'pending', tone: replay ? 'green' : 'gray' },
      ]} />

      <div className="layout-grid" style={{ marginTop: 18 }}>
        <section className="stack">
          <Card title="1. Model task" description="Do not include secrets. The model must return the strict TraceLayer artifact JSON schema.">
            <div className="form-stack">
              <label className="form-field" htmlFor="task">
                <span>Task prompt</span>
                <textarea id="task" value={task} onChange={(event) => setTask(event.target.value)} />
              </label>
              <div className="actions">
                <Button primary onClick={() => void runModel()} disabled={!mounted || settings === null || stage === 'model_running'}>{stage === 'model_running' ? 'Calling model...' : 'Run model and validate artifact'}</Button>
                {mounted && settings === null ? <ButtonLink href="/settings/model">Configure BYOK settings</ButtonLink> : null}
              </div>
              {!mounted ? <div className="helper">Loading browser-local model settings...</div> : settings ? <div className="helper">Using {settings.modelName} via {settings.useLocalRelay ? 'development local relay' : 'browser-direct request'} with key {maskApiKey(settings.apiKey)}.</div> : <div className="diagnostic tone-red">No model settings are saved. The live demo is blocked until `/settings/model` is configured.</div>}
            </div>
          </Card>

          {artifact ? (
            <Card title="2. Validated artifact" description="Model output is accepted only after schema validation and forbidden-key checks.">
              <div className="field-grid">
                <DataField label="Title" value={artifact.title} />
                <DataField label="Artifact type" value={artifact.artifactType} />
                <DataField label="chainOfThoughtIncluded" value={String(artifact.chainOfThoughtIncluded)} />
              </div>
              <JsonCodeBlock label="Validated artifact" value={artifactJsonText} />
              <div className="actions" style={{ marginTop: 12 }}>
                <Button primary onClick={() => void registerArtifact()} disabled={registered !== null}>Register artifact with TraceLayer</Button>
              </div>
            </Card>
          ) : null}

          {registered ? (
            <Card title="3. Walrus upload and readback" description="Blob identifiers appear only after backend upload; verified hash appears only after readback matches.">
              <div className="field-grid">
                <DataField label="Run ID" value={<Identifier value={registered.run.runId} />} />
                <DataField label="Artifact ID" value={<Identifier value={registered.artifact.artifactId} />} />
                <DataField label="Walrus blob ID" value={artifactState?.blobId ? <Identifier value={artifactState.blobId} /> : 'Not uploaded yet'} />
              </div>
              {actualSha256 && expectedSha256 ? <HashComparison expected={expectedSha256} readback={actualSha256} label={{ tone: artifactState?.verificationStatus === 'verified' ? 'green' : 'red', text: artifactState?.verificationStatus ?? 'unchecked' }} /> : <div className="helper mono">Expected SHA-256: {expectedSha256}</div>}
              <div className="actions">
                <Button onClick={() => void uploadArtifact()} disabled={artifactState?.blobId !== undefined || stage === 'uploading'}>{stage === 'uploading' ? 'Uploading...' : 'Upload to Walrus'}</Button>
                <Button primary onClick={() => void verifyArtifact()} disabled={!artifactState?.blobId || artifactState.verificationStatus === 'verified' || stage === 'verifying'}>{stage === 'verifying' ? 'Verifying...' : 'Verify readback hash'}</Button>
              </div>
            </Card>
          ) : null}

          <Card title="4. Wallet-signed Sui anchor" description="The connected wallet is the transaction sender and claimed owner on sui:testnet.">
            <div className="field-grid">
              <DataField label="Connected wallet" value={selectedWallet?.name ?? 'none'} />
              <DataField label="Wallet address" value={account?.address ? <Identifier value={shortAddress(account.address)} /> : 'none'} />
              <DataField label="Wallet network" value={walletNetwork ?? 'not reported'} />
              <DataField label="Sui package" value={capabilities?.suiAnchorPackageConfigured ? <Identifier value={capabilities.suiAnchorPackageId} /> : 'not configured'} />
            </div>
            <div className="actions" style={{ marginTop: 12 }}>
              <Button primary={account === null} onClick={() => setWalletModalOpen(true)}>{account === null ? 'Connect Wallet' : 'Change wallet'}</Button>
              {account !== null ? <Button onClick={() => refreshWalletAccounts()}>Refresh accounts</Button> : null}
              {account !== null ? <Button onClick={() => void disconnectWallet()}>Disconnect</Button> : null}
            </div>
            {account === null ? <div className="helper">Connect wallet to create a wallet-signed Sui anchor.</div> : <div className="helper">Wallet-signed anchor will use {shortAddress(account.address)} as transaction sender. {connectedAccounts.length > 1 ? 'Use Change wallet to pick another exposed account.' : 'To switch address, change the active account in your wallet extension, then reconnect or refresh accounts.'}</div>}
            {walletNetwork !== undefined && walletNetwork !== 'sui:testnet' ? <div className="diagnostic tone-amber">Switch wallet to Sui testnet before anchoring.</div> : null}
            {disabledReasons.length > 0 ? <div className="helper">Anchor disabled: {disabledReasons.join(' ')}</div> : <div className="helper">Anchor enabled for wallet-signed ownership on testnet.</div>}
            <div className="actions" style={{ marginTop: 12 }}>
              <Button onClick={() => void prepareAnchor()} disabled={registered === null || disabledReasons.length > 0 || preparedAnchor !== null}>Prepare wallet anchor</Button>
              <Button primary onClick={() => void signAndRecordAnchor()} disabled={preparedAnchor === null || selectedWallet === null || account === null || stage === 'signing'}>{stage === 'signing' ? 'Signing...' : 'Sign and record anchor'}</Button>
            </div>
            {artifactState?.anchorTxDigest ? (
              <div className="helper">Wallet-signed anchor recorded with serviceSigned={String(artifactState.serviceSigned)}. Signer {artifactState.signerAddress ? <Identifier value={artifactState.signerAddress} /> : 'unknown'} owns on-chain address {artifactState.onChainOwnerAddress ? <Identifier value={artifactState.onChainOwnerAddress} /> : 'pending'}.</div>
            ) : null}
          </Card>

          {registered ? (
            <Card title="5. Replay Context" description="Replay shows observable proof state only and excludes private chain-of-thought.">
              <div className="actions">
                <Button primary onClick={() => void loadReplay()} disabled={!readyForReplay}>Load Replay Context</Button>
              </div>
              {replay ? <JsonCodeBlock label="Replay Context" value={replay.replayContext} /> : <div className="helper">Replay is available after the proof flow reaches an anchored state.</div>}
            </Card>
          ) : null}
        </section>

        <aside className="side">
          <Card title="Readiness" description="Every external boundary must be ready before the live proof chain can complete.">
            <KeyValue label="TraceLayer API" value={capabilities ? 'reachable' : 'unknown'} />
            <KeyValue label="Demo mode" value={capabilities?.demoMode ?? 'unknown'} />
            <KeyValue label="Walrus live upload" value={String(capabilities?.walrusLiveUpload ?? false)} />
            <KeyValue label="Sui live anchor" value={String(capabilities?.suiAnchorLive ?? false)} />
            <KeyValue label="Sui network" value={capabilities?.suiNetwork ?? 'unknown'} />
            <KeyValue label="Wallet support" value={walletCanSign ? 'sui:signAndExecuteTransaction' : 'not ready'} />
            {error ? <div className="diagnostic tone-red" role="alert">{error}</div> : null}
          </Card>

          <Card title="Proof timeline" description="Only server-generated proof identifiers are displayed.">
            {proofEvents.length > 0 ? (
              <ProofTimeline events={proofEvents.map((event) => {
                const reference = event.proofEventId ?? event.walrusBlobId ?? event.suiTxDigest;
                return {
                  title: event.type,
                  description: event.summary,
                  tone: event.type.includes('failed') ? 'red' : event.type.includes('submitted') ? 'amber' : 'green',
                  ...(reference ? { reference } : {}),
                };
              })} />
            ) : <div className="helper">No proof events yet.</div>}
          </Card>

          <Card title="Diagnostics" description="Provider diagnostics are redacted before display.">
            {diagnostics.length > 0 ? diagnostics.map((entry) => <div className="helper" key={entry}>{entry}</div>) : <div className="helper">No diagnostics yet.</div>}
          </Card>
        </aside>
      </div>
      <WalletConnectModal
        open={walletModalOpen}
        walletEntries={walletEntries}
        walletsLoaded={walletsLoaded}
        selectedWalletKey={selectedWalletKey}
        account={account}
        connectedAccounts={connectedAccounts}
        onClose={() => setWalletModalOpen(false)}
        onConnect={(entry) => void connectWallet(entry)}
        onSelectAccount={(nextAccount) => {
          setAccount(nextAccount);
          setPreparedAnchor(null);
          setWalletModalOpen(false);
        }}
        onRefreshAccounts={() => refreshWalletAccounts()}
        onDisconnect={() => void disconnectWallet()}
      />
    </ProductShell>
  );
}

function dedupeWallets(wallets: readonly Wallet[]): WalletEntry[] {
  const entries = new Map<string, WalletEntry>();
  for (const wallet of wallets) {
    const key = `${wallet.name}:${walletProviderId(wallet)}`;
    if (!entries.has(key)) entries.set(key, { key, wallet });
  }
  return [...entries.values()];
}

function walletProviderId(wallet: Wallet): string {
  const metadata = wallet as Wallet & { id?: unknown; provider?: { id?: unknown } };
  return stringValue(metadata.id) ?? stringValue(metadata.provider?.id) ?? wallet.icon ?? 'wallet-standard';
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function shortAddress(value: string): string {
  const normalized = normalizeAddress(value) ?? value;
  return normalized.length <= 12 ? normalized : `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

function providerErrorMessage(responseBody: string, status: number): string {
  try {
    const json = JSON.parse(responseBody) as { error?: unknown; classification?: unknown };
    const error = typeof json.error === 'string' ? json.error : isRecord(json.error) && typeof json.error.message === 'string' ? json.error.message : undefined;
    const classification = typeof json.classification === 'string' ? json.classification : undefined;
    return [error, classification ? `classification=${classification}` : undefined].filter(Boolean).join(' · ') || `HTTP ${status}`;
  } catch {
    return responseBody || `HTTP ${status}`;
  }
}

function messageFromUnknown(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
