import { createHash, timingSafeEqual } from 'node:crypto';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { walrus } from '@mysten/walrus';
import type { TraceLayerConfig } from '@tracelayer/config';

export type LiveWalrusConfig = Pick<
  TraceLayerConfig,
  | 'demoMode'
  | 'liveWalrusUpload'
  | 'suiNetwork'
  | 'suiRpcUrl'
  | 'walrusRelayUrl'
  | 'walrusRelayMaxTipMist'
  | 'walrusEpochs'
  | 'walrusDeletable'
  | 'suiPrivateKey'
>;

export type WalrusClient = ReturnType<typeof createWalrusClient>;
export type WalrusSigner = ReturnType<typeof createWalrusSigner>;

export type UploadArtifactToWalrusInput = {
  bytes: Uint8Array;
  contentType: string;
  config: LiveWalrusConfig;
  client?: WalrusClient;
  signer?: WalrusSigner;
};

export type UploadArtifactToWalrusResult = {
  blobId: string;
  blobObjectId?: string;
  sha256: string;
  byteLength: number;
  contentType: string;
  epochs: number;
  deletable: boolean;
  walrusNetwork: string;
  rawWalrusResponse: Record<string, string | number | boolean | null>;
};

export type VerifyWalrusArtifactInput = {
  blobId: string;
  expectedSha256: string;
  config: LiveWalrusConfig;
  client?: WalrusClient;
};

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function verifyWalrusBytes(bytes: Uint8Array, expectedSha256: string): { ok: boolean; actualSha256: string } {
  const actualSha256 = sha256Hex(bytes);
  const expected = Buffer.from(expectedSha256, 'hex');
  const actual = Buffer.from(actualSha256, 'hex');
  return {
    ok: expected.length === actual.length && timingSafeEqual(expected, actual),
    actualSha256,
  };
}

export function assertLiveWalrusReady(config: Pick<LiveWalrusConfig, 'demoMode' | 'liveWalrusUpload'>): void {
  if (config.demoMode !== 'live') throw new Error('Walrus network operations require live mode');
  if (!config.liveWalrusUpload) throw new Error('Walrus network operations require WALRUS_LIVE_UPLOAD=true');
}

export function createWalrusClient(config: LiveWalrusConfig) {
  assertLiveWalrusReady(config);
  if (!config.suiRpcUrl) throw new Error('Walrus client requires SUI_RPC_URL');
  if (!config.walrusRelayUrl) throw new Error('Walrus client requires WALRUS_RELAY_URL');

  return new SuiGrpcClient({
    network: config.suiNetwork,
    baseUrl: config.suiRpcUrl,
  }).$extend(
    walrus({
      uploadRelay: {
        host: config.walrusRelayUrl,
        sendTip: { max: config.walrusRelayMaxTipMist },
      },
      storageNodeClientOptions: { timeout: 60_000 },
      // TODO verify against official docs before use: packageConfig fields for non-default networks.
    }),
  );
}

export function createWalrusSigner(config: LiveWalrusConfig) {
  assertLiveWalrusReady(config);
  if (!config.suiPrivateKey) throw new Error('Walrus signer requires SUI_PRIVATE_KEY');
  const parsed = decodeSuiPrivateKey(config.suiPrivateKey);
  if (parsed.scheme !== 'ED25519') throw new Error(`Only ED25519 SUI_PRIVATE_KEY is supported, received ${parsed.scheme}.`);
  return Ed25519Keypair.fromSecretKey(parsed.secretKey);
}

export async function uploadArtifactToWalrus(input: UploadArtifactToWalrusInput): Promise<UploadArtifactToWalrusResult> {
  assertLiveWalrusReady(input.config);
  const client = input.client ?? createWalrusClient(input.config);
  const signer = input.signer ?? createWalrusSigner(input.config);
  const sha256 = sha256Hex(input.bytes);

  const result = await client.walrus.writeBlob({
    // TODO verify against official docs before use: raw blob field name for installed SDK version.
    blob: input.bytes,
    epochs: input.config.walrusEpochs,
    deletable: input.config.walrusDeletable,
    signer,
  });

  const summary = sanitizeWalrusResponse(result);
  if (typeof summary.blobId !== 'string' || summary.blobId.length === 0) {
    throw new Error('writeBlob did not return blobId; no fake blob ID will be emitted');
  }

  return {
    blobId: summary.blobId,
    ...(typeof summary.blobObjectId === 'string' ? { blobObjectId: summary.blobObjectId } : {}),
    sha256,
    byteLength: input.bytes.byteLength,
    contentType: input.contentType,
    epochs: input.config.walrusEpochs,
    deletable: input.config.walrusDeletable,
    walrusNetwork: input.config.suiNetwork,
    rawWalrusResponse: summary,
  };
}

export async function readArtifactFromWalrus(input: { blobId: string; config: LiveWalrusConfig; client?: WalrusClient }): Promise<Uint8Array> {
  assertLiveWalrusReady(input.config);
  const client = input.client ?? createWalrusClient(input.config);
  return client.walrus.readBlob({ blobId: input.blobId });
}

export async function verifyWalrusArtifact(input: VerifyWalrusArtifactInput): Promise<{ ok: boolean; actualSha256: string; bytes: Uint8Array }> {
  const bytes = await readArtifactFromWalrus({ blobId: input.blobId, config: input.config, ...(input.client ? { client: input.client } : {}) });
  return { ...verifyWalrusBytes(bytes, input.expectedSha256), bytes };
}

export function sanitizeWalrusResponse(value: unknown): Record<string, string | number | boolean | null> {
  const response = isObject(value) ? value : {};
  const blobObject = isObject(response.blobObject) ? response.blobObject : undefined;
  const blobId = typeof response.blobId === 'string' ? response.blobId : null;
  const blobObjectId = typeof blobObject?.id === 'string' ? blobObject.id : null;
  return {
    kind: 'writeBlob',
    blobId,
    blobObjectId,
    hasBlobObject: blobObject !== undefined,
    topLevelKeys: Object.keys(response).sort().join(','),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
