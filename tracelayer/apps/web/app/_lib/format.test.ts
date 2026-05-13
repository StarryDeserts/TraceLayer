import { describe, expect, it } from 'vitest';
import { formatDateTime, shortMiddle } from './format.js';

describe('format helpers', () => {
  it('shortens long proof identifiers without changing the source value', () => {
    const value = '0xd852497c7732b882ffc3406a1186900bcdf9bcdbd82d54ab6652ea41bb1523a9';

    expect(shortMiddle(value, 8, 6)).toBe('0xd85249...1523a9');
    expect(value).toBe('0xd852497c7732b882ffc3406a1186900bcdf9bcdbd82d54ab6652ea41bb1523a9');
  });

  it('keeps short identifiers intact', () => {
    expect(shortMiddle('run_phase_2_5_test', 8, 6)).toBe('run_phase_2_5_test');
  });

  it('formats recorded fixture timestamps deterministically', () => {
    expect(formatDateTime(1778409222585)).toBe('2026-05-10 10:33:42 UTC');
  });
});
