'use client';

import { useEffect, useState } from 'react';
import { getWallets, type Wallet, type WalletAccount } from '@wallet-standard/core';
import { isWalletWithRequiredFeatureSet, signAndExecuteTransaction, type SuiSignAndExecuteTransactionFeature } from '@mysten/wallet-standard';
import { recordedWalrusFixture } from './recorded-walrus-fixture.js';

type SeedResponse = {
  artifact: { artifactId: string; runId: string; verificationStatus: string; blobId: string };
};

type PrepareResponse = {
  artifact: { artifactId: string; state: string; anchorMode?: string };
  preparedAnchor: { anchorMode: 'wallet-signed'; transactionJson: string; transactionBytesBase64?: string; target: string };
  proofEvent: { correlationId: string; type: string };
};

type RecordResponse = {
  artifact: {
    anchorMode?: string;
    serviceSigned?: boolean;
    signerAddress?: string;
    onChainOwnerAddress?: string;
    anchorTxDigest?: string;
    anchorObjectId?: string;
  };
  anchor?: {
    txDigest: string;
    anchorObjectId?: string;
    onChainOwnerAddress?: string;
    event?: unknown;
  };
  proofEvent?: { type: string; correlationId: string };
};

type SmokeResult = {
  connectedWalletAddress: string;
  correlationId: string;
  txDigest: string;
  record: RecordResponse;
  ownerMatchesWallet: boolean;
};

type HealthResponse = {
  ok: boolean;
  service: string;
};

type ConnectFeature = {
  connect(): Promise<{ accounts: WalletAccount[] }>;
};

type WalletEntry = {
  key: string;
  wallet: Wallet;
};

type RequestClassification = 'ok' | 'network_failed' | 'cors_or_unreachable' | 'unauthorized' | 'api_error';

type RequestDiagnostic = {
  label: string;
  requestUrl: string;
  classification: RequestClassification;
  requestedAt: string;
  requestBody?: string;
  status?: number;
  responseBody?: string;
  message?: string;
};

const apiBaseUrl = '/api/trace-layer';

export default function AnchorSmokePage() {
  const [walletEntries, setWalletEntries] = useState<WalletEntry[]>([]);
  const [walletsLoaded, setWalletsLoaded] = useState(false);
  const [selectedWalletKey, setSelectedWalletKey] = useState('');
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [result, setResult] = useState<SmokeResult | null>(null);
  const [healthResult, setHealthResult] = useState<HealthResponse | null>(null);
  const [diagnostics, setDiagnostics] = useState<RequestDiagnostic[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [healthBusy, setHealthBusy] = useState(false);
  const selectedEntry = walletEntries.find((entry) => entry.key === selectedWalletKey) ?? null;
  const selectedWallet = selectedEntry?.wallet ?? null;

  useEffect(() => {
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

  async function connectWallet(entry: WalletEntry) {
    try {
      const connect = entry.wallet.features['standard:connect'] as ConnectFeature | undefined;
      if (connect === undefined) throw new Error('selected wallet does not support standard:connect');
      const connected = await connect.connect();
      const firstAccount = connected.accounts[0] ?? entry.wallet.accounts[0];
      if (firstAccount === undefined) throw new Error('wallet did not expose a Sui account');
      setSelectedWalletKey(entry.key);
      setAccount(firstAccount);
      setResult(null);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'wallet connection failed');
    }
  }

  async function checkHealth() {
    setHealthBusy(true);
    setHealthResult(null);
    setError(null);
    try {
      const health = await requestJson<HealthResponse>({ label: 'health', path: '/health', method: 'GET', auth: false });
      setHealthResult(health);
    } catch (caught) {
      setError(errorMessage(caught, 'health check failed'));
    } finally {
      setHealthBusy(false);
    }
  }

  async function runSmoke() {
    if (selectedWallet === null || account === null) throw new Error('connect a wallet first');
    if (!isWalletWithRequiredFeatureSet<SuiSignAndExecuteTransactionFeature>(selectedWallet, ['sui:signAndExecuteTransaction'])) {
      throw new Error('connected wallet does not support sui:signAndExecuteTransaction');
    }
    setBusy(true);
    setError(null);
    setResult(null);
    setDiagnostics([]);
    try {
      const correlationId = `corr_wallet_smoke_${Date.now()}`;
      const seed = await requestJson<SeedResponse>({
        label: 'seed recorded Walrus fixture',
        path: '/api/dev/recorded-walrus-artifact',
        method: 'POST',
        body: { ...recordedWalrusFixture, correlationId },
      });
      const prepared = await requestJson<PrepareResponse>({
        label: 'prepare wallet anchor',
        path: `/api/artifacts/${seed.artifact.artifactId}/anchor`,
        method: 'POST',
        body: {
          anchorMode: 'wallet-signed',
          correlationId,
          signerAddress: account.address,
          claimedOwnerAddress: account.address,
        },
      });
      const execution = await signAndExecuteTransaction(selectedWallet, {
        account,
        chain: 'sui:testnet',
        transaction: transactionInput(prepared.preparedAnchor),
      });
      const txDigest = extractDigest(execution);
      const record = await requestJson<RecordResponse>({
        label: 'record wallet anchor',
        path: `/api/artifacts/${seed.artifact.artifactId}/anchor`,
        method: 'POST',
        body: {
          anchorMode: 'wallet-signed',
          correlationId,
          anchorTxDigest: txDigest,
          signerAddress: account.address,
        },
      });
      const onChainOwnerAddress = record.artifact.onChainOwnerAddress ?? record.anchor?.onChainOwnerAddress;
      setResult({
        connectedWalletAddress: account.address,
        correlationId,
        txDigest,
        record,
        ownerMatchesWallet: normalizeAddress(onChainOwnerAddress) === normalizeAddress(account.address),
      });
    } catch (caught) {
      setError(errorMessage(caught, 'wallet smoke failed'));
    } finally {
      setBusy(false);
    }
  }

  async function requestJson<T>(input: { label: string; path: string; method: 'GET' | 'POST'; body?: unknown; auth?: boolean }): Promise<T> {
    const requestUrl = `${apiBaseUrl}${input.path}`;
    const requestBody = input.body === undefined ? undefined : JSON.stringify(input.body);
    try {
      const response = await fetch(requestUrl, {
        method: input.method,
        headers: {
          ...(requestBody === undefined ? {} : { 'content-type': 'application/json' }),
          ...(input.auth === false ? {} : { 'x-tracelayer-dev-proxy': 'true' }),
        },
        ...(requestBody === undefined ? {} : { body: requestBody }),
      });
      const responseBody = await response.text();
      const classification = response.ok ? 'ok' : response.status === 401 ? 'unauthorized' : 'api_error';
      const diagnostic: RequestDiagnostic = {
        label: input.label,
        requestUrl,
        classification,
        requestedAt: new Date().toISOString(),
        ...(requestBody ? { requestBody: trimResponseBody(requestBody) } : {}),
        status: response.status,
        responseBody: trimResponseBody(responseBody),
        message: response.ok ? 'ok' : responseErrorMessage(responseBody, response.status),
      };
      recordDiagnostic(diagnostic);
      if (!response.ok) throw new SmokeRequestError(diagnostic);
      return parseJsonResponse<T>(responseBody, requestUrl);
    } catch (caught) {
      if (caught instanceof SmokeRequestError) throw caught;
      const classification = classifyFetchFailure(caught, requestUrl);
      const diagnostic: RequestDiagnostic = {
        label: input.label,
        requestUrl,
        classification,
        requestedAt: new Date().toISOString(),
        ...(requestBody ? { requestBody: trimResponseBody(requestBody) } : {}),
        message: caught instanceof Error ? caught.message : 'fetch failed',
      };
      recordDiagnostic(diagnostic);
      throw new SmokeRequestError(diagnostic);
    }
  }

  function recordDiagnostic(diagnostic: RequestDiagnostic) {
    setDiagnostics((current) => [...current, diagnostic].slice(-8));
  }

  return (
    <main style={{ fontFamily: 'monospace', padding: 24, maxWidth: 960 }}>
      <h1>TraceLayer Phase 3.5 Wallet Anchor Smoke</h1>
      <p>This is a developer-only smoke page, not final UIUX.</p>
      <section>
        <h2>API</h2>
        <p>API URL: {apiBaseUrl}</p>
        <p>API auth: server-side proxy uses TRACE_LAYER_API_TOKEN when configured.</p>
        <button type="button" onClick={() => void checkHealth()} disabled={healthBusy}>
          {healthBusy ? 'Checking API health...' : 'Check API health'}
        </button>
        {healthResult ? <pre>{JSON.stringify(healthResult, null, 2)}</pre> : null}
      </section>
      <section>
        <h2>Wallet</h2>
        {!walletsLoaded ? <p>Loading wallet-standard wallets...</p> : null}
        {walletsLoaded && walletEntries.length === 0 ? <p>No wallet-standard Sui wallet detected.</p> : null}
        {walletEntries.map((entry) => (
          <button key={entry.key} type="button" onClick={() => void connectWallet(entry)} style={{ marginRight: 8 }}>
            Connect {entry.wallet.name}
          </button>
        ))}
        <p>Connected wallet: {selectedEntry?.wallet.name ?? 'none'}</p>
        <p>Connected address: {account?.address ?? 'none'}</p>
        <p>Transaction sender for prepare: {account?.address ?? 'connect wallet first'}</p>
      </section>
      <section>
        <h2>Recorded fixture</h2>
        <pre>{JSON.stringify(recordedWalrusFixture, null, 2)}</pre>
      </section>
      <button type="button" onClick={() => void runSmoke()} disabled={busy || selectedWallet === null || account === null}>
        {busy ? 'Running wallet smoke...' : 'Prepare, sign, execute, and record anchor'}
      </button>
      {error ? <pre style={{ color: 'crimson' }}>{error}</pre> : null}
      {diagnostics.length > 0 ? (
        <section>
          <h2>Request diagnostics</h2>
          {diagnostics.map((diagnostic) => (
            <article key={`${diagnostic.requestedAt}-${diagnostic.label}-${diagnostic.requestUrl}`} style={{ borderTop: '1px solid #ddd', paddingTop: 8 }}>
              <dl>
                <dt>label</dt>
                <dd>{diagnostic.label}</dd>
                <dt>classification</dt>
                <dd>{diagnostic.classification}</dd>
                <dt>requestUrl</dt>
                <dd>{diagnostic.requestUrl}</dd>
                <dt>status</dt>
                <dd>{diagnostic.status ?? 'no HTTP response'}</dd>
                <dt>requestBody</dt>
                <dd>
                  <pre>{diagnostic.requestBody || 'none'}</pre>
                </dd>
                <dt>message</dt>
                <dd>{diagnostic.message ?? 'none'}</dd>
                <dt>responseBody</dt>
                <dd>
                  <pre>{diagnostic.responseBody || 'none'}</pre>
                </dd>
              </dl>
            </article>
          ))}
        </section>
      ) : null}
      {result ? (
        <section>
          <h2>Result</h2>
          <dl>
            <dt>anchorMode</dt>
            <dd>{result.record.artifact.anchorMode}</dd>
            <dt>serviceSigned</dt>
            <dd>{String(result.record.artifact.serviceSigned)}</dd>
            <dt>signerAddress</dt>
            <dd>{result.record.artifact.signerAddress}</dd>
            <dt>connectedWalletAddress</dt>
            <dd>{result.connectedWalletAddress}</dd>
            <dt>onChainOwnerAddress</dt>
            <dd>{result.record.artifact.onChainOwnerAddress ?? result.record.anchor?.onChainOwnerAddress}</dd>
            <dt>ownerMatchesWallet</dt>
            <dd>{String(result.ownerMatchesWallet)}</dd>
            <dt>txDigest</dt>
            <dd>{result.txDigest}</dd>
            <dt>anchorObjectId</dt>
            <dd>{result.record.artifact.anchorObjectId ?? result.record.anchor?.anchorObjectId ?? 'not parsed'}</dd>
            <dt>proofEvent</dt>
            <dd>
              {result.record.proofEvent?.type ?? 'missing'} / {result.record.proofEvent?.correlationId ?? 'missing'}
            </dd>
          </dl>
          <h3>Anchor event / raw result</h3>
          <pre>{JSON.stringify(result.record.anchor?.event ?? result.record, null, 2)}</pre>
        </section>
      ) : null}
    </main>
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

function transactionInput(preparedAnchor: PrepareResponse['preparedAnchor']) {
  return { toJSON: async () => preparedAnchor.transactionJson };
}

function extractDigest(output: unknown): string {
  const value = output as { digest?: unknown; Transaction?: { digest?: unknown }; transactionDigest?: unknown };
  if (typeof value.digest === 'string') return value.digest;
  if (typeof value.Transaction?.digest === 'string') return value.Transaction.digest;
  if (typeof value.transactionDigest === 'string') return value.transactionDigest;
  throw new Error('wallet execution did not return a transaction digest');
}

function parseJsonResponse<T>(responseBody: string, requestUrl: string): T {
  if (!responseBody) return undefined as T;
  try {
    return JSON.parse(responseBody) as T;
  } catch {
    throw new Error(`invalid JSON response from ${requestUrl}`);
  }
}

function classifyFetchFailure(caught: unknown, requestUrl: string): RequestClassification {
  if (caught instanceof TypeError && isCrossOrigin(requestUrl)) return 'cors_or_unreachable';
  return 'network_failed';
}

function isCrossOrigin(requestUrl: string): boolean {
  if (typeof window === 'undefined') return false;
  return new URL(requestUrl).origin !== window.location.origin;
}

function responseErrorMessage(responseBody: string, status: number): string {
  try {
    const json = JSON.parse(responseBody) as { error?: unknown };
    if (typeof json.error === 'string') return json.error;
  } catch {
  }
  return `HTTP ${status}`;
}

function trimResponseBody(responseBody: string): string {
  return responseBody.length > 2_000 ? `${responseBody.slice(0, 2_000)}...` : responseBody;
}

function errorMessage(caught: unknown, fallback: string): string {
  if (caught instanceof SmokeRequestError) return `${caught.diagnostic.classification}: ${caught.diagnostic.message ?? fallback}`;
  return caught instanceof Error ? caught.message : fallback;
}

function normalizeAddress(address: string | undefined): string | undefined {
  return address?.toLowerCase();
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

class SmokeRequestError extends Error {
  constructor(readonly diagnostic: RequestDiagnostic) {
    super(`${diagnostic.classification}: ${diagnostic.message ?? diagnostic.requestUrl}`);
  }
}
