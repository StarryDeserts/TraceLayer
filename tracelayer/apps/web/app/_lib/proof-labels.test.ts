import { describe, expect, it } from 'vitest';
import { anchorLabel, hashVerificationLabel } from './proof-labels.js';

describe('proof labels', () => {
  it('labels wallet-signed anchors only when the signer owns the on-chain object', () => {
    expect(
      anchorLabel({
        anchorMode: 'wallet-signed',
        serviceSigned: false,
        signerAddress: '0xd852497c7732b882ffc3406a1186900bcdf9bcdbd82d54ab6652ea41bb1523a9',
        onChainOwnerAddress: '0xd852497c7732b882ffc3406a1186900bcdf9bcdbd82d54ab6652ea41bb1523a9',
      }),
    ).toEqual({ tone: 'purple', text: 'Wallet-signed Sui anchor by 0xd85249...1523a9' });

    expect(
      anchorLabel({
        anchorMode: 'wallet-signed',
        serviceSigned: false,
        signerAddress: '0xd852497c7732b882ffc3406a1186900bcdf9bcdbd82d54ab6652ea41bb1523a9',
        onChainOwnerAddress: '0xc558e37d20405a9751c81124ac8d167e2b2d368b834319adafa549449e0715f5',
      }),
    ).toEqual({ tone: 'red', text: 'Sui anchor owner mismatch' });
  });

  it('does not imply user ownership for service-signed fallback anchors', () => {
    expect(
      anchorLabel({
        anchorMode: 'server-signed-fallback',
        serviceSigned: true,
        signerAddress: '0xc558e37d20405a9751c81124ac8d167e2b2d368b834319adafa549449e0715f5',
        onChainOwnerAddress: '0xc558e37d20405a9751c81124ac8d167e2b2d368b834319adafa549449e0715f5',
      }),
    ).toEqual({ tone: 'amber', text: 'Service-signed fallback proof' });
  });

  it('labels matching hashes as verified only when both values are present and equal', () => {
    const hash = 'b372b678a239bbec78d2221533ae27d361fad3a4a4c232196b54f991e6177e0e';

    expect(hashVerificationLabel(hash, hash)).toEqual({ tone: 'green', text: 'Verified hash' });
    expect(hashVerificationLabel(hash, undefined)).toEqual({ tone: 'gray', text: 'Readback hash pending' });
    expect(hashVerificationLabel(hash, `${hash.slice(0, -1)}f`)).toEqual({ tone: 'red', text: 'Hash mismatch' });
  });
});
