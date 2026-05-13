'use client';

import { useEffect, useRef } from 'react';
import type { Wallet, WalletAccount } from '@wallet-standard/core';
import { accountOptionLabel, safeWalletIcon, walletConnectionState, walletListKey } from './wallet-modal-helpers.js';
import { Button, Identifier, StatusPill } from '../../_components/ui.js';

type WalletEntry = {
  key: string;
  wallet: Wallet;
};

type WalletConnectModalProps = {
  open: boolean;
  walletEntries: WalletEntry[];
  walletsLoaded: boolean;
  selectedWalletKey: string;
  account: WalletAccount | null;
  connectedAccounts: readonly WalletAccount[];
  onClose(): void;
  onConnect(entry: WalletEntry): void;
  onSelectAccount(account: WalletAccount): void;
  onRefreshAccounts(): void;
  onDisconnect(): void;
};

export function WalletConnectModal({ open, walletEntries, walletsLoaded, selectedWalletKey, account, connectedAccounts, onClose, onConnect, onSelectAccount, onRefreshAccounts, onDisconnect }: WalletConnectModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const firstButton = panelRef.current?.querySelector<HTMLButtonElement>('button');
    firstButton?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="wallet-modal-backdrop" onMouseDown={onClose}>
      <div className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-connect-title" ref={panelRef} onMouseDown={(event) => event.stopPropagation()}>
        <div className="wallet-modal-head">
          <div>
            <div className="kicker">Wallet-standard plugins</div>
            <h2 id="wallet-connect-title">Connect Wallet</h2>
            <p>Select the browser wallet that should sign the Sui testnet anchor.</p>
          </div>
          <button className="copy" type="button" aria-label="Close wallet connect dialog" onClick={onClose}>Close</button>
        </div>

        <div className="wallet-list" role="list" aria-label="Available wallets">
          {walletEntries.map((entry) => {
            const icon = safeWalletIcon(entry.wallet.icon);
            const state = walletConnectionState(entry.key, selectedWalletKey);
            return (
              <button key={walletListKey(entry)} className="wallet-option" type="button" aria-label={`Connect ${entry.wallet.name}`} onClick={() => onConnect(entry)}>
                <span className="wallet-option-icon" aria-hidden="true">
                  {icon ? <img src={icon} alt="" /> : <span>{entry.wallet.name.slice(0, 1).toUpperCase()}</span>}
                </span>
                <span className="wallet-option-copy">
                  <b>{entry.wallet.name}</b>
                  <span>{entry.wallet.accounts.length > 0 ? `${entry.wallet.accounts.length} exposed account${entry.wallet.accounts.length === 1 ? '' : 's'}` : 'Connect to expose accounts'}</span>
                </span>
                <StatusPill label={{ tone: state === 'Connected' ? 'green' : 'gray', text: state }} />
              </button>
            );
          })}
          {walletsLoaded && walletEntries.length === 0 ? <div className="helper">No wallet-standard Sui wallet detected. Install or unlock a Sui wallet extension, then refresh this page.</div> : null}
          {!walletsLoaded ? <div className="helper">Loading wallet-standard plugins...</div> : null}
        </div>

        {account ? (
          <div className="wallet-account-panel">
            <div className="wallet-account-head">
              <div>
                <div className="card-title">Connected account</div>
                <p className="helper-inline">Wallet-signed anchors use this address as signer and claimed owner.</p>
              </div>
              <Identifier value={account.address} />
            </div>
            {connectedAccounts.length > 1 ? (
              <div className="account-list" role="list" aria-label="Connected wallet accounts">
                {connectedAccounts.map((connectedAccount) => (
                  <button key={connectedAccount.address} className="account-option" type="button" aria-label={`Use account ${accountOptionLabel(connectedAccount.address, connectedAccount.address === account.address)}`} onClick={() => onSelectAccount(connectedAccount)}>
                    <span className="mono">{accountOptionLabel(connectedAccount.address, connectedAccount.address === account.address)}</span>
                    <span className="small">{connectedAccount.chains.join(', ') || 'chain not reported'}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="helper">To switch address, change the active account in your wallet extension, then reconnect or refresh accounts.</div>
            )}
            <div className="actions">
              <Button onClick={onRefreshAccounts}>Refresh accounts</Button>
              <Button onClick={onDisconnect}>Disconnect</Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
