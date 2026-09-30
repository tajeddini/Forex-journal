import { describe, it, expect } from 'vitest';
import {
  isValidTimezone,
  getZonedHour,
  getZonedPersianDayOfWeek,
  getZonedDateStr,
} from './timezone';

describe('Timezone Utility', () => {
  it('validates timezone identifiers', () => {
    expect(isValidTimezone('Asia/Tehran')).toBe(true);
    expect(isValidTimezone('Asia/Dubai')).toBe(true);
    expect(isValidTimezone('Europe/London')).toBe(true);
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('Invalid/Zone')).toBe(false);
  });

  // Reference time: 2024-03-15T12:00:00Z (UTC Noon)
  // Tehran (+03:30 standard time in winter or +03:30): 15:30 -> hour 15
  // Dubai (+04:00): 16:00 -> hour 16
  // London (GMT in March before daylight saving): 12:00 -> hour 12
  // New York (EDT -04:00 in March 2024): 08:00 -> hour 8
  // UTC: 12:00 -> hour 12
  const utcNoon = '2024-03-15T12:00:00Z';

  it('correctly calculates hour across target timezones', () => {
    expect(getZonedHour(utcNoon, 'UTC')).toBe(12);
    expect(getZonedHour(utcNoon, 'Asia/Dubai')).toBe(16);
    expect(getZonedHour(utcNoon, 'Asia/Tehran')).toBe(15);
    expect(getZonedHour(utcNoon, 'Europe/London')).toBe(12);
    expect(getZonedHour(utcNoon, 'America/New_York')).toBe(8);
  });

  it('correctly handles date transition across timezones', () => {
    // 2024-03-15T22:30:00Z
    // In Tehran (+03:30): 2024-03-16 02:00:00 (Next day, Saturday!)
    // In New York (-04:00): 2024-03-15 18:30:00 (Same day, Friday)
    const lateUtc = '2024-03-15T22:30:00Z';

    expect(getZonedDateStr(lateUtc, 'UTC')).toBe('2024-03-15');
    expect(getZonedDateStr(lateUtc, 'Asia/Tehran')).toBe('2024-03-16');
    expect(getZonedDateStr(lateUtc, 'America/New_York')).toBe('2024-03-15');

    // Persian day of week (0=Saturday, 6=Friday)
    // 2024-03-15 is Friday -> 6
    // 2024-03-16 in Tehran is Saturday -> 0
    expect(getZonedPersianDayOfWeek(lateUtc, 'America/New_York')).toBe(6);
    expect(getZonedPersianDayOfWeek(lateUtc, 'Asia/Tehran')).toBe(0);
  });
});
