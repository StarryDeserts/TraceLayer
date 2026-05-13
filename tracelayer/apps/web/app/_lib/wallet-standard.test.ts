import { describe, expect, it } from 'vitest';
import { anchorDisabledReasons, extractDigest, normalizeAddress, transactionInput } from './wallet-standard.js';

describe('wallet-standard helpers', () => {
  it('extracts transaction digests from wallet result shapes', () => {
    expect(extractDigest({ digest: 'abc' })).toBe('abc');
    expect(extractDigest({ Transaction: { digest: 'def' } })).toBe('def');
    expect(extractDigest({ transactionDigest: 'ghi' })).toBe('ghi');
    expect(() => extractDigest({})).toThrow('wallet execution did not return a transaction digest');
  });

  it('normalizes Sui addresses for ownership comparison', () => {
    expect(normalizeAddress(' 0xABC ')).toBe('0xabc');
    expect(normalizeAddress(undefined)).toBeUndefined();
  });

  it('wraps prepared transaction JSON for wallet-standard signing', async () => {
    const input = transactionInput({ transactionJson: '{"sender":"0x1"}' });

    await expect(input.toJSON()).resolves.toBe('{"sender":"0x1"}');
  });

  it('reports anchor disabled reasons for missing prerequisites', () => {
    expect(anchorDisabledReasons({ artifactVerified: false, walletConnected: false, walletAddress: undefined, walletCanSign: false, suiAnchorPackageConfigured: false, suiNetwork: 'devnet' })).toEqual([
      'Verify artifact readback before anchoring.',
      'Connect a Sui wallet.',
      'Wallet address is unavailable.',
      'Connected wallet does not support sui:signAndExecuteTransaction.',
      'Configure SUI_ANCHOR_PACKAGE_ID on the TraceLayer API.',
      'Switch TraceLayer Sui network to testnet.',
    ]);
  });

  it('reports wrong wallet network when it is available', () => {
    expect(anchorDisabledReasons({ artifactVerified: true, walletConnected: true, walletAddress: '0xabc', walletCanSign: true, suiAnchorPackageConfigured: true, suiNetwork: 'testnet', walletNetwork: 'sui:mainnet' })).toEqual([
      'Switch wallet to Sui testnet before anchoring.',
    ]);
  });

  it('enables anchoring only when every prerequisite is present', () => {
    expect(anchorDisabledReasons({ artifactVerified: true, walletConnected: true, walletAddress: '0xabc', walletCanSign: true, suiAnchorPackageConfigured: true, suiNetwork: 'testnet', walletNetwork: 'sui:testnet' })).toEqual([]);
  });
});
