import type { Wallet } from '@wallet-standard/core';
import { isWalletWithRequiredFeatureSet, type SuiSignAndExecuteTransactionFeature } from '@mysten/wallet-standard';

export type PreparedTransactionJson = {
  transactionJson: string;
};

export type AnchorPrerequisites = {
  artifactVerified: boolean;
  walletConnected: boolean;
  walletAddress: string | undefined;
  walletCanSign: boolean;
  suiAnchorPackageConfigured: boolean;
  suiNetwork: string;
  walletNetwork?: string | undefined;
};

export function walletCanSignSuiTransaction(wallet: Wallet | null | undefined): boolean {
  return wallet !== null && wallet !== undefined && isWalletWithRequiredFeatureSet<SuiSignAndExecuteTransactionFeature>(wallet, ['sui:signAndExecuteTransaction']);
}

export function transactionInput(preparedAnchor: PreparedTransactionJson) {
  return { toJSON: async () => preparedAnchor.transactionJson };
}

export function extractDigest(output: unknown): string {
  const value = output as { digest?: unknown; Transaction?: { digest?: unknown }; transactionDigest?: unknown };
  if (typeof value.digest === 'string') return value.digest;
  if (typeof value.Transaction?.digest === 'string') return value.Transaction.digest;
  if (typeof value.transactionDigest === 'string') return value.transactionDigest;
  throw new Error('wallet execution did not return a transaction digest');
}

export function normalizeAddress(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase();
}

export function anchorDisabledReasons(input: AnchorPrerequisites): string[] {
  const reasons: string[] = [];
  if (!input.artifactVerified) reasons.push('Verify artifact readback before anchoring.');
  if (!input.walletConnected) reasons.push('Connect a Sui wallet.');
  if (input.walletAddress === undefined || input.walletAddress.trim().length === 0) reasons.push('Wallet address is unavailable.');
  if (!input.walletCanSign) reasons.push('Connected wallet does not support sui:signAndExecuteTransaction.');
  if (input.walletNetwork !== undefined && input.walletNetwork !== 'sui:testnet' && input.walletNetwork !== 'testnet') reasons.push('Switch wallet to Sui testnet before anchoring.');
  if (!input.suiAnchorPackageConfigured) reasons.push('Configure SUI_ANCHOR_PACKAGE_ID on the TraceLayer API.');
  if (input.suiNetwork !== 'testnet') reasons.push('Switch TraceLayer Sui network to testnet.');
  return reasons;
}
