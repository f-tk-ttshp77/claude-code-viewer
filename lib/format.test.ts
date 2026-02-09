import { describe, it, expect } from 'vitest';
import { formatDate, formatTime, formatTokenCount } from './format';

describe('formatDate', () => {
  it('formats an ISO date string in ja-JP with Asia/Tokyo timezone', () => {
    // 2025-01-15T10:00:00Z = 2025-01-15T19:00 JST
    const result = formatDate('2025-01-15T10:00:00Z');
    expect(result).toContain('2025');
    expect(result).toContain('01');
    expect(result).toContain('15');
    expect(result).toContain('19');
    expect(result).toContain('00');
  });

  it('formats a different date correctly', () => {
    // 2024-12-31T23:30:00Z = 2025-01-01T08:30 JST
    const result = formatDate('2024-12-31T23:30:00Z');
    expect(result).toContain('2025');
    expect(result).toContain('01');
    expect(result).toContain('08');
    expect(result).toContain('30');
  });
});

describe('formatTime', () => {
  it('returns HH:MM when includeDate is not set', () => {
    // 2025-01-15T10:00:00Z = 19:00 JST
    const result = formatTime('2025-01-15T10:00:00Z');
    expect(result).toContain('19');
    expect(result).toContain('00');
  });

  it('returns MM/DD HH:MM when includeDate is true', () => {
    // 2025-01-15T10:00:00Z = 01/15 19:00 JST
    const result = formatTime('2025-01-15T10:00:00Z', { includeDate: true });
    expect(result).toContain('01');
    expect(result).toContain('15');
    expect(result).toContain('19');
    expect(result).toContain('00');
  });
});

describe('formatTokenCount', () => {
  it('formats counts >= 1,000,000 as M', () => {
    expect(formatTokenCount(1_000_000)).toBe('1.0M');
    expect(formatTokenCount(2_500_000)).toBe('2.5M');
    expect(formatTokenCount(10_000_000)).toBe('10.0M');
  });

  it('formats counts >= 1,000 as K', () => {
    expect(formatTokenCount(1_000)).toBe('1.0K');
    expect(formatTokenCount(1_500)).toBe('1.5K');
    expect(formatTokenCount(999_999)).toBe('1000.0K');
  });

  it('formats counts < 1,000 with locale string', () => {
    expect(formatTokenCount(999)).toBe('999');
    expect(formatTokenCount(100)).toBe('100');
    expect(formatTokenCount(1)).toBe('1');
  });

  it('formats 0', () => {
    expect(formatTokenCount(0)).toBe('0');
  });
});
