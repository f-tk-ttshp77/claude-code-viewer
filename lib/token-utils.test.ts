import { describe, it, expect } from 'vitest';
import { calculateTokenCost, TOKEN_PRICES } from './token-utils';
import type { TokenUsage } from './types';

describe('calculateTokenCost', () => {
  it('calculates cost for a normal usage with all fields', () => {
    const usage: TokenUsage = {
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationInputTokens: 200,
      cacheReadInputTokens: 100,
    };

    const expected =
      1000 * TOKEN_PRICES.input +
      500 * TOKEN_PRICES.output +
      200 * TOKEN_PRICES.cacheWrite +
      100 * TOKEN_PRICES.cacheRead;

    expect(calculateTokenCost(usage)).toBeCloseTo(expected);
  });

  it('calculates cost when all fields are 0', () => {
    const usage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };

    expect(calculateTokenCost(usage)).toBe(0);
  });

  it('calculates cost with only input/output tokens (no cache)', () => {
    const usage: TokenUsage = {
      inputTokens: 10000,
      outputTokens: 2000,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };

    const expected = 10000 * TOKEN_PRICES.input + 2000 * TOKEN_PRICES.output;

    expect(calculateTokenCost(usage)).toBeCloseTo(expected);
  });

  it('calculates cost with large cache values', () => {
    const usage: TokenUsage = {
      inputTokens: 500,
      outputTokens: 100,
      cacheCreationInputTokens: 50000,
      cacheReadInputTokens: 100000,
    };

    const expected =
      500 * TOKEN_PRICES.input +
      100 * TOKEN_PRICES.output +
      50000 * TOKEN_PRICES.cacheWrite +
      100000 * TOKEN_PRICES.cacheRead;

    expect(calculateTokenCost(usage)).toBeCloseTo(expected);
  });
});
