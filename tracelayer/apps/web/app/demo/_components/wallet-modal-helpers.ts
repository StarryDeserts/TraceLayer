export type WalletListEntryLike = {
  key: string;
  wallet: {
    name: string;
  };
};

export function walletListKey(entry: WalletListEntryLike): string {
  return entry.key;
}

export function walletConnectionState(entryKey: string, selectedWalletKey: string): 'Connected' | 'Available' {
  return entryKey === selectedWalletKey ? 'Connected' : 'Available';
}

export function accountOptionLabel(address: string, active: boolean): string {
  const label = shortAddress(address);
  return active ? `${label} · active` : label;
}

export function safeWalletIcon(icon: string | undefined): string | undefined {
  return icon?.startsWith('data:image/') ? icon : undefined;
}

function shortAddress(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`;
}
