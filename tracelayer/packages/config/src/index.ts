import type { ProofMode } from '@tracelayer/types';

export type TraceLayerConfig = {
  demoMode: ProofMode;
  recordedBlobId?: string;
  recordedTxDigest?: string;
  recordedArtifactSha256?: string;
  liveWalrusUpload: boolean;
  liveSuiAnchor: boolean;
  allowSuiAnchorServerFallback: boolean;
  apiToken?: string;
  suiNetwork: string;
  suiRpcUrl?: string;
  suiAnchorPackageId?: string;
  walrusRelayUrl?: string;
  walrusRelayMaxTipMist: number;
  walrusEpochs: number;
  walrusDeletable: boolean;
  suiPrivateKey?: string;
  webOrigins: string[];
};

const demoModes = ['live', 'recorded', 'dry-run'] as const;
const placeholderPattern = /placeholder|fake|example|demo|sample|todo|test|dry.?run/i;
const hexPattern = /^(0x)?[0-9a-f]{32,}$/i;
const sha256HexPattern = /^[0-9a-f]{64}$/i;
const base64UrlPattern = /^[A-Za-z0-9_-]{32,}$/;

export function parseDemoMode(value: string | undefined = process.env.TRACE_LAYER_DEMO_MODE): ProofMode {
  if (value === undefined || value === '') return 'dry-run';
  if ((demoModes as readonly string[]).includes(value)) return value as ProofMode;
  throw new Error(`TRACE_LAYER_DEMO_MODE must be one of ${demoModes.join(', ')}`);
}

export function isPlaceholderPublicProofId(value: string | undefined): boolean {
  if (value === undefined) return false;
  const trimmed = value.trim();
  return trimmed.length === 0 || placeholderPattern.test(trimmed);
}

export function looksLikeRecordedBlobId(value: string | undefined): value is string {
  if (value === undefined || isPlaceholderPublicProofId(value)) return false;
  const trimmed = value.trim();
  return base64UrlPattern.test(trimmed) || hexPattern.test(trimmed);
}

export function looksLikeSuiTxDigest(value: string | undefined): value is string {
  if (value === undefined || isPlaceholderPublicProofId(value)) return false;
  return /^[1-9A-HJ-NP-Za-km-z]{43,88}$/.test(value.trim()) || /^0x[0-9a-f]{64}$/i.test(value.trim());
}

export function looksLikeSuiObjectId(value: string | undefined): value is string {
  if (value === undefined || isPlaceholderPublicProofId(value)) return false;
  return /^0x[0-9a-f]{64}$/i.test(value.trim());
}

export function parseBooleanEnv(name: string, value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be "true" or "false"`);
}

export function parsePositiveIntegerEnv(name: string, value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  if (!/^[1-9]\d*$/.test(value)) throw new Error(`${name} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${name} must be a safe positive integer`);
  return parsed;
}

export function looksLikeSha256Hex(value: string | undefined): value is string {
  return value !== undefined && sha256HexPattern.test(value.trim());
}

export function parseWebOrigins(value: string | undefined): string[] {
  if (value === undefined || value.trim() === '') return ['http://localhost:3000'];
  const entries = value.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  if (entries.length === 0) throw new Error('TRACE_LAYER_WEB_ORIGINS must contain at least one origin');
  return entries.map(canonicalizeWebOrigin);
}

function canonicalizeWebOrigin(entry: string): string {
  let url: URL;
  try {
    url = new URL(entry);
  } catch {
    throw new Error(`TRACE_LAYER_WEB_ORIGINS entry "${entry}" is not a valid URL`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`TRACE_LAYER_WEB_ORIGINS entry "${entry}" must use http or https`);
  }
  if (url.username !== '' || url.password !== '') {
    throw new Error(`TRACE_LAYER_WEB_ORIGINS entry "${entry}" must not include credentials`);
  }
  if (url.pathname !== '' && url.pathname !== '/') {
    throw new Error(`TRACE_LAYER_WEB_ORIGINS entry "${entry}" must be an origin (no path)`);
  }
  if (url.search !== '' || url.hash !== '') {
    throw new Error(`TRACE_LAYER_WEB_ORIGINS entry "${entry}" must be an origin (no query or fragment)`);
  }
  return url.origin;
}

export function assertNoDryRunPublicProofIds(
  config: Pick<TraceLayerConfig, 'demoMode' | 'recordedBlobId' | 'recordedTxDigest' | 'recordedArtifactSha256'>,
): void {
  if (config.demoMode !== 'dry-run') return;
  if (config.recordedBlobId !== undefined || config.recordedTxDigest !== undefined || config.recordedArtifactSha256 !== undefined) {
    throw new Error('dry-run config must not include blob IDs, tx digests, or recorded artifact hashes');
  }
}

export function assertRecordedPublicProofIds(config: TraceLayerConfig): void {
  if (config.demoMode !== 'recorded') return;
  if (!looksLikeRecordedBlobId(config.recordedBlobId)) {
    throw new Error('recorded mode requires a real-looking recorded blob ID');
  }
  if (!looksLikeSuiTxDigest(config.recordedTxDigest)) {
    throw new Error('recorded mode requires a real-looking recorded tx digest');
  }
  if (!looksLikeSha256Hex(config.recordedArtifactSha256)) {
    throw new Error('recorded mode requires TRACE_LAYER_RECORDED_ARTIFACT_SHA256');
  }
}

export function assertLiveWalrusConfig(config: TraceLayerConfig): void {
  if (config.demoMode !== 'live') return;
  if (!config.liveWalrusUpload) throw new Error('live Walrus upload requires WALRUS_LIVE_UPLOAD=true');
  if (!config.suiPrivateKey) throw new Error('live Walrus upload requires SUI_PRIVATE_KEY');
  if (!config.suiRpcUrl) throw new Error('live Walrus upload requires SUI_RPC_URL');
  if (!config.walrusRelayUrl) throw new Error('live Walrus upload requires WALRUS_RELAY_URL');
}

export function assertLiveSuiAnchorConfig(config: TraceLayerConfig): void {
  if (config.demoMode !== 'live') return;
  if (!config.liveSuiAnchor) throw new Error('live Sui anchor requires SUI_ANCHOR_LIVE=true');
  if (!config.suiPrivateKey && config.allowSuiAnchorServerFallback) throw new Error('server-signed Sui anchor fallback requires SUI_PRIVATE_KEY');
  if (!config.suiRpcUrl) throw new Error('live Sui anchor requires SUI_RPC_URL');
  if (!looksLikeSuiObjectId(config.suiAnchorPackageId)) throw new Error('live Sui anchor requires SUI_ANCHOR_PACKAGE_ID');
}

export function createTraceLayerConfig(env: NodeJS.ProcessEnv = process.env): TraceLayerConfig {
  const config: TraceLayerConfig = {
    demoMode: parseDemoMode(env.TRACE_LAYER_DEMO_MODE),
    liveWalrusUpload: parseBooleanEnv('WALRUS_LIVE_UPLOAD', env.WALRUS_LIVE_UPLOAD, false),
    liveSuiAnchor: parseBooleanEnv('SUI_ANCHOR_LIVE', env.SUI_ANCHOR_LIVE, false),
    allowSuiAnchorServerFallback: parseBooleanEnv('SUI_ANCHOR_SERVER_FALLBACK', env.SUI_ANCHOR_SERVER_FALLBACK, false),
    suiNetwork: env.SUI_NETWORK ?? 'testnet',
    ...(env.SUI_RPC_URL ? { suiRpcUrl: env.SUI_RPC_URL } : {}),
    ...(env.SUI_ANCHOR_PACKAGE_ID ? { suiAnchorPackageId: env.SUI_ANCHOR_PACKAGE_ID } : {}),
    ...(env.WALRUS_RELAY_URL ? { walrusRelayUrl: env.WALRUS_RELAY_URL } : {}),
    walrusRelayMaxTipMist: parsePositiveIntegerEnv('WALRUS_UPLOAD_RELAY_MAX_TIP_MIST', env.WALRUS_UPLOAD_RELAY_MAX_TIP_MIST, 1),
    walrusEpochs: parsePositiveIntegerEnv('WALRUS_EPOCHS', env.WALRUS_EPOCHS, 1),
    walrusDeletable: parseBooleanEnv('WALRUS_DELETABLE', env.WALRUS_DELETABLE, true),
    webOrigins: parseWebOrigins(env.TRACE_LAYER_WEB_ORIGINS),
    ...(env.TRACE_LAYER_API_TOKEN ? { apiToken: env.TRACE_LAYER_API_TOKEN } : {}),
    ...(env.SUI_PRIVATE_KEY ? { suiPrivateKey: env.SUI_PRIVATE_KEY } : {}),
    ...(env.TRACE_LAYER_RECORDED_BLOB_ID ? { recordedBlobId: env.TRACE_LAYER_RECORDED_BLOB_ID } : {}),
    ...(env.TRACE_LAYER_RECORDED_TX_DIGEST ? { recordedTxDigest: env.TRACE_LAYER_RECORDED_TX_DIGEST } : {}),
    ...(env.TRACE_LAYER_RECORDED_ARTIFACT_SHA256 ? { recordedArtifactSha256: env.TRACE_LAYER_RECORDED_ARTIFACT_SHA256 } : {}),
  };

  assertNoDryRunPublicProofIds(config);
  assertRecordedPublicProofIds(config);
  assertLiveWalrusConfig(config);
  return config;
}
