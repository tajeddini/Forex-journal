import { describe, it, expect } from 'vitest';
import { getZonedReviewPeriod, createZonedDate, getZonedDateParts, getZonedDateStr } from './timezone';

describe('Review Timezone Engine — Strict Boundary & Offset Verification', () => {
  it('calculates daily review boundaries accurately in UTC', () => {
    const { start, end, startStr, endStr } = getZonedReviewPeriod('daily', '2024-06-15T12:00:00Z', 'UTC');

    expect(startStr).toBe('2024-06-15');
    expect(endStr).toBe('2024-06-15');

    // In UTC, start is 00:00:00 and end is 23:59:59
    expect(start.toISOString()).toBe('2024-06-15T00:00:00.000Z');
    expect(end.toISOString()).toBe('2024-06-15T23:59:59.999Z');
  });

  it('calculates daily review boundaries accurately in Asia/Tehran (UTC+03:30)', () => {
    // Noon in Tehran on 2024-06-15
    const { start, end, startStr, endStr } = getZonedReviewPeriod('daily', '2024-06-15T12:00:00+03:30', 'Asia/Tehran');

    expect(startStr).toBe('2024-06-15');
    expect(endStr).toBe('2024-06-15');

    // Tehran day starts at 2024-06-14 20:30:00 UTC and ends at 2024-06-15 20:29:59.999 UTC
    expect(start.toISOString()).toBe('2024-06-14T20:30:00.000Z');
    expect(end.toISOString()).toBe('2024-06-15T20:29:59.999Z');

    // Confirm that start and end in Tehran timezone are exactly 00:00:00 and 23:59:59
    const startParts = getZonedDateParts(start, 'Asia/Tehran');
    expect(startParts.hour).toBe(0);
    expect(startParts.minute).toBe(0);
    expect(startParts.day).toBe(15);

    const endParts = getZonedDateParts(end, 'Asia/Tehran');
    expect(endParts.hour).toBe(23);
    expect(endParts.minute).toBe(59);
    expect(endParts.day).toBe(15);
  });

  it('calculates daily review boundaries across midnight in America/New_York (UTC-4 in summer)', () => {
    // 00:15 AM in New York on 2024-07-01 (EDT is UTC-4)
    const { start, end, startStr } = getZonedReviewPeriod('daily', '2024-07-01T00:15:00-04:00', 'America/New_York');

    expect(startStr).toBe('2024-07-01');
    // Start of July 1 in NY is July 1 04:00:00 UTC
    expect(start.toISOString()).toBe('2024-07-01T04:00:00.000Z');
    // End of July 1 in NY is July 2 03:59:59.999 UTC
    expect(end.toISOString()).toBe('2024-07-02T03:59:59.999Z');
  });

  it('calculates daily review boundaries in Europe/London across winter (GMT) and summer (BST)', () => {
    // Winter (GMT, UTC+0)
    const winterPeriod = getZonedReviewPeriod('daily', '2024-01-15T10:00:00Z', 'Europe/London');
    expect(winterPeriod.start.toISOString()).toBe('2024-01-15T00:00:00.000Z');

    // Summer (BST, UTC+1)
    const summerPeriod = getZonedReviewPeriod('daily', '2024-07-15T10:00:00+01:00', 'Europe/London');
    expect(summerPeriod.start.toISOString()).toBe('2024-07-14T23:00:00.000Z');
    expect(summerPeriod.end.toISOString()).toBe('2024-07-15T22:59:59.999Z');
  });

  it('calculates weekly review boundaries for Persian trading week (Saturday to Friday)', () => {
    // 2024-01-10 is Wednesday
    // Current week started on Saturday 2024-01-06 and ends on Friday 2024-01-12
    const { start, end, startStr, endStr } = getZonedReviewPeriod('weekly', '2024-01-10T12:00:00Z', 'UTC');

    expect(startStr).toBe('2024-01-06'); // Saturday
    expect(endStr).toBe('2024-01-12');   // Friday
    expect(start.toISOString()).toBe('2024-01-06T00:00:00.000Z');
    expect(end.toISOString()).toBe('2024-01-12T23:59:59.999Z');
  });

  it('calculates monthly review boundaries for Jan, Feb leap, Feb non-leap, and Dec', () => {
    // January (31 days)
    const jan = getZonedReviewPeriod('monthly', '2024-01-15T12:00:00Z', 'UTC');
    expect(jan.startStr).toBe('2024-01-01');
    expect(jan.endStr).toBe('2024-01-31');

    // February in leap year 2024 (29 days)
    const febLeap = getZonedReviewPeriod('monthly', '2024-02-14T10:00:00Z', 'UTC');
    expect(febLeap.startStr).toBe('2024-02-01');
    expect(febLeap.endStr).toBe('2024-02-29');

    // February in non-leap year 2023 (28 days)
    const febNonLeap = getZonedReviewPeriod('monthly', '2023-02-14T10:00:00Z', 'UTC');
    expect(febNonLeap.startStr).toBe('2023-02-01');
    expect(febNonLeap.endStr).toBe('2023-02-28');

    // December (31 days)
    const dec = getZonedReviewPeriod('monthly', '2024-12-25T12:00:00Z', 'UTC');
    expect(dec.startStr).toBe('2024-12-01');
    expect(dec.endStr).toBe('2024-12-31');
  });

  it('handles DST spring-forward and fall-back in America/New_York and Europe/London', () => {
    // NY Spring Forward: March 10, 2024
    const nySpring = createZonedDate(2024, 3, 10, 14, 0, 0, 0, 'America/New_York');
    const nySpringParts = getZonedDateParts(nySpring, 'America/New_York');
    expect(nySpringParts.hour).toBe(14);

    // NY Fall Back: November 3, 2024
    const nyFall = createZonedDate(2024, 11, 3, 14, 0, 0, 0, 'America/New_York');
    const nyFallParts = getZonedDateParts(nyFall, 'America/New_York');
    expect(nyFallParts.hour).toBe(14);

    // London Spring Forward: March 31, 2024 (clocks jump forward at 1am)
    const lonSpring = createZonedDate(2024, 3, 31, 14, 0, 0, 0, 'Europe/London');
    const lonSpringParts = getZonedDateParts(lonSpring, 'Europe/London');
    expect(lonSpringParts.hour).toBe(14);

    // London Fall Back: October 27, 2024 (clocks fall back at 2am)
    const lonFall = createZonedDate(2024, 10, 27, 14, 0, 0, 0, 'Europe/London');
    const lonFallParts = getZonedDateParts(lonFall, 'Europe/London');
    expect(lonFallParts.hour).toBe(14);
  });

  it('handles exact boundary timestamps: 00:00:00, 00:00:00.001, 23:59:59, 23:59:59.999', () => {
    const d00 = createZonedDate(2024, 5, 20, 0, 0, 0, 0, 'Asia/Tehran');
    expect(getZonedDateParts(d00, 'Asia/Tehran').hour).toBe(0);
    expect(getZonedDateParts(d00, 'Asia/Tehran').minute).toBe(0);

    const d00_ms = createZonedDate(2024, 5, 20, 0, 0, 0, 1, 'Asia/Tehran');
    expect(getZonedDateParts(d00_ms, 'Asia/Tehran').hour).toBe(0);

    const d23_59 = createZonedDate(2024, 5, 20, 23, 59, 59, 0, 'Asia/Tehran');
    expect(getZonedDateParts(d23_59, 'Asia/Tehran').hour).toBe(23);
    expect(getZonedDateParts(d23_59, 'Asia/Tehran').minute).toBe(59);

    const d23_59_999 = createZonedDate(2024, 5, 20, 23, 59, 59, 999, 'Asia/Tehran');
    expect(getZonedDateParts(d23_59_999, 'Asia/Tehran').hour).toBe(23);
    expect(getZonedDateParts(d23_59_999, 'Asia/Tehran').minute).toBe(59);
  });
});
