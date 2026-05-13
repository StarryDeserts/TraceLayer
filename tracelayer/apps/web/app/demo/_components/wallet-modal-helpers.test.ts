import { describe, expect, it } from 'vitest';
import { accountOptionLabel, safeWalletIcon, walletConnectionState, walletListKey } from './wallet-modal-helpers.js';

describe('wallet modal helpers', () => {
  it('builds stable list keys without duplicate wallet-name-only keys', () => {
    expect(walletListKey({ key: 'Sui Wallet:data:image/svg+xml;base64,abc', wallet: walletWithName('Sui Wallet') })).toBe('Sui Wallet:data:image/svg+xml;base64,abc');
    expect(walletListKey({ key: 'Sui Wallet:wallet-standard', wallet: walletWithName('Sui Wallet') })).toBe('Sui Wallet:wallet-standard');
  });

  it('reports connection state for selected and unselected wallets', () => {
    expect(walletConnectionState('wallet-a', 'wallet-a')).toBe('Connected');
    expect(walletConnectionState('wallet-b', 'wallet-a')).toBe('Available');
  });

  it('labels account options with truncated addresses and active state', () => {
    expect(accountOptionLabel('0xd852497c7732b882ffc3406a1186900bcdf9bcdbd82d54ab6652ea41bb1523a9', true)).toBe('0xd852...23a9 · active');
    expect(accountOptionLabel('0xabc', false)).toBe('0xabc');
  });

  it('allows only data URI wallet icons', () => {
    expect(safeWalletIcon('data:image/svg+xml;base64,PHN2Zy8+')).toBe('data:image/svg+xml;base64,PHN2Zy8+');
    expect(safeWalletIcon('https://example.invalid/icon.svg')).toBeUndefined();
    expect(safeWalletIcon(undefined)).toBeUndefined();
  });
});

function walletWithName(name: string) {
  return { name };
}
