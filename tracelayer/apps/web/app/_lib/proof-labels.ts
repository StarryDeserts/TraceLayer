import { shortMiddle } from './format.js';

export type Tone = 'cyan' | 'green' | 'purple' | 'amber' | 'red' | 'gray';

export type Label = {
  tone: Tone;
  text: string;
};

export type AnchorLabelInput = {
  anchorMode?: string;
  serviceSigned?: boolean;
  signerAddress?: string;
  onChainOwnerAddress?: string;
};

export function anchorLabel(input: AnchorLabelInput): Label {
  if (input.anchorMode === 'wallet-signed' && input.serviceSigned === false) {
    const signer = normalizeAddress(input.signerAddress);
    const owner = normalizeAddress(input.onChainOwnerAddress);
    if (signer === undefined || owner === undefined) return { tone: 'amber', text: 'Sui anchor ownership unverified' };
    if (signer !== owner) return { tone: 'red', text: 'Sui anchor owner mismatch' };
    return { tone: 'purple', text: `Wallet-signed Sui anchor by ${shortMiddle(input.signerAddress, 8, 6)}` };
  }
  if (input.anchorMode === 'server-signed-fallback' || input.serviceSigned === true) {
    return { tone: 'amber', text: 'Service-signed fallback proof' };
  }
  return { tone: 'gray', text: 'Sui anchor pending' };
}

function normalizeAddress(address: string | undefined): string | undefined {
  return address?.toLowerCase();
}

export function hashVerificationLabel(expectedSha256: string | undefined, readbackSha256: string | undefined): Label {
  if (expectedSha256 === undefined || readbackSha256 === undefined) return { tone: 'gray', text: 'Readback hash pending' };
  return expectedSha256.toLowerCase() === readbackSha256.toLowerCase() ? { tone: 'green', text: 'Verified hash' } : { tone: 'red', text: 'Hash mismatch' };
}

export function modeLabel(mode: string): Label {
  if (mode === 'live') return { tone: 'green', text: 'Live proof data' };
  if (mode === 'recorded') return { tone: 'cyan', text: 'Recorded testnet proof data' };
  return { tone: 'gray', text: 'Dry-run local data' };
}
