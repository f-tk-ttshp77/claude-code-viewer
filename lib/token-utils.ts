import type { TokenUsage } from './types';

export const TOKEN_PRICES = {
  input: 3 / 1_000_000,
  output: 15 / 1_000_000,
  cacheWrite: 3.75 / 1_000_000,
  cacheRead: 0.3 / 1_000_000,
} as const;

export function calculateTokenCost(usage: TokenUsage): number {
  const inputCost = usage.inputTokens * TOKEN_PRICES.input;
  const outputCost = usage.outputTokens * TOKEN_PRICES.output;
  const cacheCreationCost = usage.cacheCreationInputTokens * TOKEN_PRICES.cacheWrite;
  const cacheReadCost = usage.cacheReadInputTokens * TOKEN_PRICES.cacheRead;
  return inputCost + outputCost + cacheCreationCost + cacheReadCost;
}
