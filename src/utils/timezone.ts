// ============================================================
// Timezone Utilities
// Unified timezone handling for financial analytics & trading
// ============================================================

export const DEFAULT_TIMEZONE = 'Asia/Tehran';

/**
 * Validates whether a timezone identifier is a supported IANA time zone
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns formatted date parts in the given target timezone
 */
export function getZonedDateParts(
  datetime: string | Date,
  timeZone: string = DEFAULT_TIMEZONE
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
} {
  const date = typeof datetime === 'string' ? new Date(datetime) : datetime;
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date provided: ${datetime}`);
  }

  const effectiveTz = isValidTimezone(timeZone) ? timeZone : DEFAULT_TIMEZONE;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: effectiveTz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  return {
    year: parseInt(partMap.year, 10),
    month: parseInt(partMap.month, 10),
    day: parseInt(partMap.day, 10),
    hour: parseInt(partMap.hour, 10),
    minute: parseInt(partMap.minute, 10),
    second: parseInt(partMap.second, 10),
    weekday: partMap.weekday || '',
  };
}

/**
 * Returns the hour of the day (0-23) in the target timezone
 */
export function getZonedHour(
  datetime: string | Date,
  timeZone: string = DEFAULT_TIMEZONE
): number {
  return getZonedDateParts(datetime, timeZone).hour;
}

/**
 * Returns the day of week index for the Persian calendar (0=Saturday, 1=Sunday, ..., 6=Friday)
 * in the target timezone.
 */
export function getZonedPersianDayOfWeek(
  datetime: string | Date,
  timeZone: string = DEFAULT_TIMEZONE
): number {
  const { weekday } = getZonedDateParts(datetime, timeZone);
  // Map English short weekdays to Persian index:
  // Sat -> 0, Sun -> 1, Mon -> 2, Tue -> 3, Wed -> 4, Thu -> 5, Fri -> 6
  const map: Record<string, number> = {
    Sat: 0,
    Sun: 1,
    Mon: 2,
    Tue: 3,
    Wed: 4,
    Thu: 5,
    Fri: 6,
  };
  return map[weekday] ?? 0;
}

/**
 * Returns a date string in YYYY-MM-DD format according to the target timezone
 */
export function getZonedDateStr(
  datetime: string | Date,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const { year, month, day } = getZonedDateParts(datetime, timeZone);
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Format a date in a friendly format in the target timezone
 */
export function formatZonedDatetime(
  datetime: string | Date,
  timeZone: string = DEFAULT_TIMEZONE,
  includeTime: boolean = true
): string {
  const date = typeof datetime === 'string' ? new Date(datetime) : datetime;
  const effectiveTz = isValidTimezone(timeZone) ? timeZone : DEFAULT_TIMEZONE;

  const options: Intl.DateTimeFormatOptions = {
    timeZone: effectiveTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };

  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = false;
  }

  return new Intl.DateTimeFormat('fa-IR', options).format(date);
}

/**
 * Create a UTC Date object representing a specific local date and time in a target timezone.
 * Handles DST transitions and offsets accurately via iterative refinement.
 */
export function createZonedDate(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0,
  millisecond: number = 0,
  timeZone: string = DEFAULT_TIMEZONE
): Date {
  const effectiveTz = isValidTimezone(timeZone) ? timeZone : DEFAULT_TIMEZONE;
  let utcTime = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);

  for (let iter = 0; iter < 4; iter++) {
    const parts = getZonedDateParts(new Date(utcTime), effectiveTz);
    const targetUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    const currentZonedUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const diff = targetUtc - currentZonedUtc;
    if (diff === 0) break;
    utcTime += diff;
  }
  return new Date(utcTime);
}

/**
 * Get period boundaries (start, end) for a review type calculated strictly in the configured timezone.
 * Fully supports: daily, weekly (Saturday to Friday in Persian trading), and monthly.
 */
export function getZonedReviewPeriod(
  type: 'daily' | 'weekly' | 'monthly',
  date: Date | string,
  timeZone: string = DEFAULT_TIMEZONE
): { start: Date; end: Date; startStr: string; endStr: string } {
  const effectiveTz = isValidTimezone(timeZone) ? timeZone : DEFAULT_TIMEZONE;
  const parts = getZonedDateParts(date, effectiveTz);

  let start: Date;
  let end: Date;

  if (type === 'daily') {
    start = createZonedDate(parts.year, parts.month, parts.day, 0, 0, 0, 0, effectiveTz);
    end = createZonedDate(parts.year, parts.month, parts.day, 23, 59, 59, 999, effectiveTz);
  } else if (type === 'weekly') {
    // Week starts on Saturday (Persian trading calendar)
    // Persian day of week: Sat=0, Sun=1, ..., Fri=6
    const dayOfWeek = getZonedPersianDayOfWeek(date, effectiveTz);
    
    // Find Saturday by subtracting dayOfWeek days
    const satDateAnchor = createZonedDate(parts.year, parts.month, parts.day, 12, 0, 0, 0, effectiveTz);
    const satTimestamp = satDateAnchor.getTime() - dayOfWeek * 86400000;
    const satParts = getZonedDateParts(new Date(satTimestamp), effectiveTz);

    // Saturday 00:00:00
    start = createZonedDate(satParts.year, satParts.month, satParts.day, 0, 0, 0, 0, effectiveTz);
    
    // Friday (6 days later) 23:59:59
    const friTimestamp = satTimestamp + 6 * 86400000;
    const friParts = getZonedDateParts(new Date(friTimestamp), effectiveTz);
    end = createZonedDate(friParts.year, friParts.month, friParts.day, 23, 59, 59, 999, effectiveTz);
  } else {
    // monthly
    start = createZonedDate(parts.year, parts.month, 1, 0, 0, 0, 0, effectiveTz);
    // Find last day of month
    const daysInMonth = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
    end = createZonedDate(parts.year, parts.month, daysInMonth, 23, 59, 59, 999, effectiveTz);
  }

  const startStr = getZonedDateStr(start, effectiveTz);
  const endStr = getZonedDateStr(end, effectiveTz);

  return { start, end, startStr, endStr };
}
