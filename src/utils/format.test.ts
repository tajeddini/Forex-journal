import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatNumber,
  formatDate,
  getAccountStatusLabel,
  getPhaseStatusLabel,
  getPhaseTypeLabel,
  isValidNumber,
  isNonNegativeNumber,
  parseNumber,
  sortPhasesByType,
} from './format';
import type { PhaseType } from '../types/database';

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    const result = formatCurrency(1000, 'USD');
    expect(result).toContain('1,000');
    expect(result).toContain('$');
  });

  it('formats EUR correctly', () => {
    const result = formatCurrency(500.5, 'EUR');
    expect(result).toContain('500.50');
  });

  it('handles zero', () => {
    const result = formatCurrency(0, 'USD');
    expect(result).toContain('0.00');
  });

  it('handles large numbers', () => {
    const result = formatCurrency(1000000, 'USD');
    expect(result).toContain('1,000,000');
  });
});

describe('formatNumber', () => {
  it('formats with default decimals', () => {
    const result = formatNumber(1234.5);
    expect(result).toContain('1,234.50');
  });

  it('formats with custom decimals', () => {
    const result = formatNumber(1234.5678, 3);
    expect(result).toContain('1,234.568');
  });
});

describe('formatDate', () => {
  it('returns dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('returns dash for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  it('formats valid date', () => {
    const result = formatDate('2024-01-15T00:00:00Z');
    expect(result).not.toBe('—');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getAccountStatusLabel', () => {
  it('returns correct label for active', () => {
    expect(getAccountStatusLabel('active')).toBe('فعال');
  });

  it('returns correct label for passed', () => {
    expect(getAccountStatusLabel('passed')).toBe('قبول شده');
  });

  it('returns correct label for failed', () => {
    expect(getAccountStatusLabel('failed')).toBe('ناموفق');
  });

  it('returns correct label for funded', () => {
    expect(getAccountStatusLabel('funded')).toBe('تأمین سرمایه');
  });

  it('returns correct label for archived', () => {
    expect(getAccountStatusLabel('archived')).toBe('آرشیو شده');
  });
});

describe('getPhaseStatusLabel', () => {
  it('returns correct label for active', () => {
    expect(getPhaseStatusLabel('active')).toBe('فعال');
  });

  it('returns correct label for completed', () => {
    expect(getPhaseStatusLabel('completed')).toBe('تکمیل شده');
  });

  it('returns correct label for failed', () => {
    expect(getPhaseStatusLabel('failed')).toBe('ناموفق');
  });

  it('returns correct label for skipped', () => {
    expect(getPhaseStatusLabel('skipped')).toBe('رد شده');
  });
});

describe('getPhaseTypeLabel', () => {
  it('returns correct label for challenge', () => {
    expect(getPhaseTypeLabel('challenge')).toBe('چالش');
  });

  it('returns correct label for phase1', () => {
    expect(getPhaseTypeLabel('phase1')).toBe('فاز ۱');
  });

  it('returns correct label for funded', () => {
    expect(getPhaseTypeLabel('funded')).toBe('تأمین سرمایه');
  });
});

describe('isValidNumber', () => {
  it('returns true for valid number string', () => {
    expect(isValidNumber('123')).toBe(true);
    expect(isValidNumber('123.45')).toBe(true);
    expect(isValidNumber('0')).toBe(true);
    expect(isValidNumber('-5')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isValidNumber('')).toBe(false);
    expect(isValidNumber('abc')).toBe(false);
    expect(isValidNumber('  ')).toBe(false);
  });
});

describe('isNonNegativeNumber', () => {
  it('returns true for non-negative numbers', () => {
    expect(isNonNegativeNumber('0')).toBe(true);
    expect(isNonNegativeNumber('100')).toBe(true);
    expect(isNonNegativeNumber('50.5')).toBe(true);
  });

  it('returns false for negative numbers', () => {
    expect(isNonNegativeNumber('-1')).toBe(false);
    expect(isNonNegativeNumber('-0.5')).toBe(false);
  });

  it('returns false for invalid values', () => {
    expect(isNonNegativeNumber('')).toBe(false);
    expect(isNonNegativeNumber('abc')).toBe(false);
  });
});

describe('parseNumber', () => {
  it('parses valid numbers', () => {
    expect(parseNumber('123')).toBe(123);
    expect(parseNumber('123.45')).toBe(123.45);
    expect(parseNumber('0')).toBe(0);
  });

  it('returns null for invalid values', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });
});

describe('sortPhasesByType', () => {
  it('sorts phases in correct order', () => {
    const phases = [
      { phase_type: 'funded' as PhaseType, created_at: '2024-01-01' },
      { phase_type: 'challenge' as PhaseType, created_at: '2024-01-01' },
      { phase_type: 'phase1' as PhaseType, created_at: '2024-01-01' },
    ];

    const sorted = sortPhasesByType(phases);
    expect(sorted[0].phase_type).toBe('challenge');
    expect(sorted[1].phase_type).toBe('phase1');
    expect(sorted[2].phase_type).toBe('funded');
  });

  it('sorts by created_at for same phase type', () => {
    const phases = [
      { phase_type: 'phase1' as PhaseType, created_at: '2024-01-02' },
      { phase_type: 'phase1' as PhaseType, created_at: '2024-01-01' },
    ];

    const sorted = sortPhasesByType(phases);
    expect(sorted[0].created_at).toBe('2024-01-01');
    expect(sorted[1].created_at).toBe('2024-01-02');
  });
});
