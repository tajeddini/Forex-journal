import { describe, it, expect } from 'vitest';
import { formatDuration, getJournalStatusLabel, getRuleAdherenceLabel } from './format';

describe('formatDuration', () => {
  it('returns dash for null/undefined', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
  });

  it('formats seconds', () => {
    expect(formatDuration(30)).toBe('30 ثانیه');
    expect(formatDuration(0)).toBe('0 ثانیه');
  });

  it('formats minutes', () => {
    expect(formatDuration(90)).toBe('1د 30ث');
    expect(formatDuration(120)).toBe('2 دقیقه');
  });

  it('formats hours', () => {
    expect(formatDuration(3600)).toBe('1 ساعت');
    expect(formatDuration(5400)).toBe('1س 30د');
  });

  it('formats days', () => {
    expect(formatDuration(86400)).toBe('1 روز');
    expect(formatDuration(90000)).toBe('1ر 1س');
  });
});

describe('getJournalStatusLabel', () => {
  it('returns correct Persian labels', () => {
    expect(getJournalStatusLabel('not_started')).toBe('شروع نشده');
    expect(getJournalStatusLabel('in_progress')).toBe('در حال تکمیل');
    expect(getJournalStatusLabel('completed')).toBe('تکمیل شده');
  });

  it('returns raw value for unknown status', () => {
    expect(getJournalStatusLabel('unknown')).toBe('unknown');
  });
});

describe('getRuleAdherenceLabel', () => {
  it('returns correct Persian labels', () => {
    expect(getRuleAdherenceLabel('not_set')).toBe('تنظیم نشده');
    expect(getRuleAdherenceLabel('followed')).toBe('رعایت شده');
    expect(getRuleAdherenceLabel('partially_followed')).toBe('تا حدی رعایت شده');
    expect(getRuleAdherenceLabel('violated')).toBe('نقض شده');
  });
});
