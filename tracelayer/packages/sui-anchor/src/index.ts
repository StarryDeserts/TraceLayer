import { Buffer } from 'node:buffer';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { assertLiveSuiAnchorConfig, looksLikeSuiObjectId, type TraceLayerConfig } from '@tracelayer/config';
import type { AnchorMode, JsonMetadata } from '@tracelayer/types';

export type AnchorArtifactTransactionInput = {
  packageId: string;
  runId: string;
  blobId: string;
  artifactHash: string;
  artifactType: string;
  createdAtMs: number | bigint | string;
  signerAddress?: string;
};

export type PreparedAnchorArtifactTransaction = {
  anchorMode: 'wallet-signed';
  packageId: string;
  target: string;
  transactionJson: string;
  transactionBytesBase64?: string;
  runId: string;
  blobId: string;
  artifactHash: string;
  artifactType: string;
  createdAtMs: string;
};

export type ArtifactAnchoredEvent = {
  anchorObjectId: string;
  ownerAddress: string;
  runId: string;
  blobId: string;
  artifactHash: string;
  artifactType: string;
  createdAtMs: string;
  schemaVersion: number;
};

export type AnchorTransactionResult = {
  txDigest: string;
  anchorObjectId?: string;
  onChainOwnerAddress?: string;
  event?: ArtifactAnchoredEvent;
  rawSuiResponse: JsonMetadata;
};

export type ServerSignedAnchorResult = AnchorTransactionResult & {
  anchorMode: 'server-signed-fallback';
  signerAddress: string;
  onChainOwnerAddress: string;
  serviceSigned: true;
};

export type SuiAnchorClient = {
  waitForTransaction(input: {
    digest: string;
    options?: Record<string, boolean>;
    timeout?: number;
    pollInterval?: number;
  }): Promise<unknown>;
  signAndExecuteTransaction(input: {
    transaction: Transaction;
    signer: Ed25519Keypair;
    options?: Record<string, boolean>;
  }): Promise<unknown>;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const moduleName = 'artifact_anchor';
const functionName = 'anchor_artifact';
const artifactAnchorStruct = 'ArtifactAnchor';
const artifactAnchoredEvent = 'ArtifactAnchored';
const maxRunIdBytes = 64;
const maxBlobIdBytes = 256;
const artifactHashBytes = 32;
const maxArtifactTypeBytes = 32;

export function buildAnchorArtifactTransaction(input: AnchorArtifactTransactionInput): Transaction {
  validateAnchorInput(input);
  const transaction = new Transaction();
  if (input.signerAddress !== undefined) transaction.setSender(input.signerAddress);
  transaction.moveCall({
    target: anchorTarget(input.packageId),
    arguments: [
      transaction.pure.vector('u8', utf8Bytes(input.runId)),
      transaction.pure.vector('u8', utf8Bytes(input.blobId)),
      transaction.pure.vector('u8', hexToBytes(input.artifactHash)),
      transaction.pure.vector('u8', utf8Bytes(input.artifactType)),
      transaction.pure.u64(normalizeCreatedAtMs(input.createdAtMs)),
    ],
  });
  return transaction;
}

export async function prepareAnchorArtifactTransaction(input: AnchorArtifactTransactionInput & { client?: SuiAnchorClient }): Promise<PreparedAnchorArtifactTransaction> {
  const transaction = buildAnchorArtifactTransaction(input);
  const transactionJson = await transaction.toJSON();
  const transactionBytesBase64 = input.client === undefined ? undefined : Buffer.from(await transaction.build({ client: input.client as never })).toString('base64');
  return {
    anchorMode: 'wallet-signed',
    packageId: input.packageId,
    target: anchorTarget(input.packageId),
    transactionJson,
    ...(transactionBytesBase64 ? { transactionBytesBase64 } : {}),
    runId: input.runId,
    blobId: input.blobId,
    artifactHash: normalizeHex(input.artifactHash),
    artifactType: input.artifactType,
    createdAtMs: normalizeCreatedAtMs(input.createdAtMs).toString(),
  };
}

export function parseArtifactAnchoredEvent(input: { event: unknown; packageId?: string }): ArtifactAnchoredEvent | undefined {
  const event = asObject(input.event);
  const eventType = stringValue(event.type);
  if (eventType === undefined || !eventType.endsWith(`::${moduleName}::${artifactAnchoredEvent}`)) return undefined;
  if (input.packageId !== undefined && !eventType.startsWith(`${input.packageId}::`)) return undefined;
  const parsedJson = asObject(event.parsedJson);
  const anchorObjectId = stringValue(parsedJson.anchor_id);
  const ownerAddress = stringValue(parsedJson.owner);
  const runId = bytesToUtf8(parsedJson.run_id);
  const blobId = bytesToUtf8(parsedJson.blob_id);
  const artifactHash = bytesToHex(parsedJson.artifact_hash);
  const artifactType = bytesToUtf8(parsedJson.artifact_type);
  const createdAtMs = integerString(parsedJson.created_at_ms);
  const schemaVersion = integerNumber(parsedJson.schema_version);

  if (
    anchorObjectId === undefined ||
    ownerAddress === undefined ||
    runId === undefined ||
    blobId === undefined ||
    artifactHash === undefined ||
    artifactType === undefined ||
    createdAtMs === undefined ||
    schemaVersion === undefined
  ) {
    return undefined;
  }

  return { anchorObjectId, ownerAddress, runId, blobId, artifactHash, artifactType, createdAtMs, schemaVersion };
}

export async function waitForAnchorTransaction(input: { client: SuiAnchorClient; txDigest: string; packageId?: string; timeoutMs?: number }): Promise<AnchorTransactionResult> {
  const result = await input.client.waitForTransaction({
    digest: input.txDigest,
    options: { showEffects: true, showEvents: true, showObjectChanges: true },
    timeout: input.timeoutMs ?? 60_000,
    pollInterval: 2_000,
  });
  return anchorTransactionResult(result, input.packageId, input.txDigest);
}

export async function executeServerSignedAnchor(input: {
  config: TraceLayerConfig;
  runId: string;
  blobId: string;
  artifactHash: string;
  artifactType: string;
  createdAtMs: number | bigint | string;
  client?: SuiAnchorClient;
  signer?: Ed25519Keypair;
}): Promise<ServerSignedAnchorResult> {
  assertLiveSuiAnchorReady(input.config);
  if (!input.config.allowSuiAnchorServerFallback) throw new Error('server-signed Sui anchor fallback requires SUI_ANCHOR_SERVER_FALLBACK=true');
  if (!input.config.suiAnchorPackageId) throw new Error('server-signed Sui anchor requires SUI_ANCHOR_PACKAGE_ID');

  const client = input.client ?? createSuiAnchorClient(input.config);
  const signer = input.signer ?? createSuiAnchorSigner(input.config);
  const signerAddress = signer.toSuiAddress();
  const transaction = buildAnchorArtifactTransaction({
    packageId: input.config.suiAnchorPackageId,
    runId: input.runId,
    blobId: input.blobId,
    artifactHash: input.artifactHash,
    artifactType: input.artifactType,
    createdAtMs: input.createdAtMs,
    signerAddress: signerAddress,
  });
  const executed = await client.signAndExecuteTransaction({
    transaction,
    signer,
    options: { showEffects: true, showEvents: true, showObjectChanges: true },
  });
  const digest = transactionDigest(executed);
  if (digest === undefined) throw new Error('Sui anchor transaction did not return a digest');
  const result = anchorTransactionResult(executed, input.config.suiAnchorPackageId, digest);
  return {
    ...result,
    anchorMode: 'server-signed-fallback',
    signerAddress,
    onChainOwnerAddress: result.onChainOwnerAddress ?? signerAddress,
    serviceSigned: true,
  };
}

export function createSuiAnchorClient(config: TraceLayerConfig): SuiAnchorClient {
  assertLiveSuiAnchorReady(config);
  if (!config.suiRpcUrl) throw new Error('Sui anchor client requires SUI_RPC_URL');
  return new SuiJsonRpcClient({ network: config.suiNetwork as never, url: config.suiRpcUrl }) as unknown as SuiAnchorClient;
}

export function createSuiAnchorSigner(config: TraceLayerConfig): Ed25519Keypair {
  assertLiveSuiAnchorReady(config);
  if (!config.suiPrivateKey) throw new Error('Sui anchor signer requires SUI_PRIVATE_KEY');
  const parsed = decodeSuiPrivateKey(config.suiPrivateKey);
  if (parsed.scheme !== 'ED25519') throw new Error(`Only ED25519 SUI_PRIVATE_KEY is supported, received ${parsed.scheme}.`);
  return Ed25519Keypair.fromSecretKey(parsed.secretKey);
}

export function assertLiveSuiAnchorReady(config: TraceLayerConfig): void {
  assertLiveSuiAnchorConfig(config);
}

export function anchorTarget(packageId: string): string {
  if (!looksLikeSuiObjectId(packageId)) throw new Error('SUI_ANCHOR_PACKAGE_ID must be a real Sui package ID');
  return `${packageId}::${moduleName}::${functionName}`;
}

export function utf8Bytes(value: string): number[] {
  return Array.from(textEncoder.encode(value));
}

export function hexToBytes(value: string): number[] {
  const normalized = normalizeHex(value);
  return Array.from(Buffer.from(normalized, 'hex'));
}

export function normalizeHex(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{64}$/.test(normalized)) throw new Error('artifact hash must be a 32-byte SHA-256 hex string');
  return normalized;
}

function validateAnchorInput(input: AnchorArtifactTransactionInput): void {
  anchorTarget(input.packageId);
  if (utf8Bytes(input.runId).length > maxRunIdBytes) throw new Error('runId must be <= 64 UTF-8 bytes');
  if (utf8Bytes(input.blobId).length > maxBlobIdBytes) throw new Error('blobId must be <= 256 UTF-8 bytes');
  if (hexToBytes(input.artifactHash).length !== artifactHashBytes) throw new Error('artifactHash must be exactly 32 bytes');
  if (utf8Bytes(input.artifactType).length > maxArtifactTypeBytes) throw new Error('artifactType must be <= 32 UTF-8 bytes');
  normalizeCreatedAtMs(input.createdAtMs);
}

function normalizeCreatedAtMs(value: number | bigint | string): bigint {
  const parsed = typeof value === 'bigint' ? value : BigInt(value);
  if (parsed < 0n) throw new Error('createdAtMs must be non-negative');
  return parsed;
}

function anchorTransactionResult(result: unknown, packageId: string | undefined, fallbackDigest: string): AnchorTransactionResult {
  const failure = transactionFailure(result);
  if (failure !== undefined) throw new Error(`Sui anchor transaction failed: ${failure}`);
  const event = transactionEvents(result)
    .map((candidate) => parseArtifactAnchoredEvent({ event: candidate, ...(packageId ? { packageId } : {}) }))
    .find((candidate) => candidate !== undefined);
  const anchorObjectId = event?.anchorObjectId ?? createdAnchorObjectId(result, packageId);
  const txDigest = transactionDigest(result) ?? fallbackDigest;
  return {
    txDigest,
    ...(anchorObjectId ? { anchorObjectId } : {}),
    ...(event?.ownerAddress ? { onChainOwnerAddress: event.ownerAddress } : {}),
    ...(event ? { event } : {}),
    rawSuiResponse: sanitizeSuiResponse(result, anchorObjectId, event),
  };
}

function sanitizeSuiResponse(result: unknown, anchorObjectId: string | undefined, event: ArtifactAnchoredEvent | undefined): JsonMetadata {
  return {
    kind: 'anchorArtifact',
    txDigest: transactionDigest(result) ?? null,
    anchorObjectId: anchorObjectId ?? null,
    hasArtifactAnchoredEvent: event !== undefined,
    eventSchemaVersion: event?.schemaVersion ?? null,
  };
}

function transactionFailure(result: unknown): string | undefined {
  const effects = asObject(asObject(result).effects);
  const status = asObject(effects.status);
  const statusText = stringValue(status.status);
  if (statusText !== 'failure') return undefined;
  return stringValue(status.error) ?? 'unknown failure';
}

function transactionDigest(result: unknown): string | undefined {
  const response = asObject(result);
  const directDigest = stringValue(response.digest);
  if (directDigest !== undefined) return directDigest;
  return stringValue(asObject(response.Transaction).digest);
}

function transactionEvents(result: unknown): unknown[] {
  const events = asObject(result).events;
  return Array.isArray(events) ? events : [];
}

function createdAnchorObjectId(result: unknown, packageId: string | undefined): string | undefined {
  const objectChanges = asObject(result).objectChanges;
  if (!Array.isArray(objectChanges)) return undefined;
  for (const change of objectChanges) {
    const objectChange = asObject(change);
    if (stringValue(objectChange.type) !== 'created') continue;
    const objectType = stringValue(objectChange.objectType);
    if (objectType === undefined || !objectType.endsWith(`::${moduleName}::${artifactAnchorStruct}`)) continue;
    if (packageId !== undefined && !objectType.startsWith(`${packageId}::`)) continue;
    const objectId = stringValue(objectChange.objectId);
    if (objectId !== undefined) return objectId;
  }
  return undefined;
}

function bytesToUtf8(value: unknown): string | undefined {
  const bytes = byteArray(value);
  return bytes === undefined ? undefined : textDecoder.decode(Uint8Array.from(bytes));
}

function bytesToHex(value: unknown): string | undefined {
  const bytes = byteArray(value);
  return bytes === undefined ? undefined : Buffer.from(bytes).toString('hex');
}

function byteArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value) || !value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)) return undefined;
  return value as number[];
}

function integerString(value: unknown): string | undefined {
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  return undefined;
}

function integerNumber(value: unknown): number | undefined {
  const parsed = integerString(value);
  if (parsed === undefined) return undefined;
  const asNumber = Number(parsed);
  return Number.isSafeInteger(asNumber) ? asNumber : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
