// ============================================================
// Advanced Time Analytics
// Hour of day, day of week, calendar analysis
// Fully timezone-aware using unified timezone utility layer
// ============================================================

import type { ClassifiedTrade } from './types';
import type { HourPerformance, DayPerformance, CalendarDay } from './types';
import {
  getZonedHour,
  getZonedPersianDayOfWeek,
  getZonedDateStr,
  DEFAULT_TIMEZONE,
} from '../../utils/timezone';

const PERSIAN_DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

/**
 * Calculate performance metrics for a group of trades
 */
function calculateGroupMetrics(trades: ClassifiedTrade[]) {
  const wins = trades.filter(t => t.result === 'win').length;
  const losses = trades.filter(t => t.result === 'loss').length;
  const breakeven = trades.filter(t => t.result === 'breakeven').length;
  const netPnl = trades.reduce((sum, t) => sum + t.netPnl, 0);
  const avgPnl = trades.length > 0 ? netPnl / trades.length : null;
  const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : null;

  const durations = trades
    .map(t => t.duration_seconds)
    .filter((d): d is number => d !== null && d !== undefined);
  const avgDuration =
    durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : null;

  return { wins, losses, breakeven, netPnl, averagePnl: avgPnl, winRate, averageDuration: avgDuration };
}

/**
 * Analyze performance by hour of day in configured timezone
 */
export function analyzeByHour(
  trades: ClassifiedTrade[],
  timeZone: string = DEFAULT_TIMEZONE
): HourPerformance[] {
  const hourGroups = new Map<number, ClassifiedTrade[]>();

  // Initialize all hours 0-23
  for (let i = 0; i < 24; i++) {
    hourGroups.set(i, []);
  }

  // Group trades by zoned hour
  for (const trade of trades) {
    const hour = getZonedHour(trade.entry_datetime, timeZone);
    hourGroups.get(hour)!.push(trade);
  }

  // Calculate metrics for each hour
  return Array.from(hourGroups.entries())
    .map(([hour, hourTrades]) => {
      const metrics = calculateGroupMetrics(hourTrades);
      return {
        hour,
        label: `${hour.toString().padStart(2, '0')}:00-${hour.toString().padStart(2, '0')}:59`,
        trades: hourTrades.length,
        ...metrics,
      };
    })
    .sort((a, b) => a.hour - b.hour);
}

/**
 * Analyze performance by day of week in configured timezone
 */
export function analyzeByDay(
  trades: ClassifiedTrade[],
  timeZone: string = DEFAULT_TIMEZONE
): DayPerformance[] {
  const dayGroups = new Map<number, ClassifiedTrade[]>();

  // Initialize all days 0-6 (0=Sat, 6=Fri)
  for (let i = 0; i < 7; i++) {
    dayGroups.set(i, []);
  }

  // Group trades by zoned day of week
  for (const trade of trades) {
    const day = getZonedPersianDayOfWeek(trade.entry_datetime, timeZone);
    dayGroups.get(day)!.push(trade);
  }

  // Calculate metrics for each day
  return Array.from(dayGroups.entries())
    .map(([day, dayTrades]) => {
      const metrics = calculateGroupMetrics(dayTrades);
      return {
        day,
        label: PERSIAN_DAYS[day],
        trades: dayTrades.length,
        ...metrics,
      };
    })
    .sort((a, b) => a.day - b.day);
}

/**
 * Generate calendar data for a date range in configured timezone
 */
export function generateCalendarData(
  trades: ClassifiedTrade[],
  startDate: Date,
  endDate: Date,
  timeZone: string = DEFAULT_TIMEZONE
): CalendarDay[] {
  const calendarMap = new Map<string, ClassifiedTrade[]>();

  // Group trades by zoned date string
  for (const trade of trades) {
    const dateStr = getZonedDateStr(trade.exit_datetime, timeZone);
    const existing = calendarMap.get(dateStr);
    if (existing) {
      existing.push(trade);
    } else {
      calendarMap.set(dateStr, [trade]);
    }
  }

  // Generate calendar days
  const calendarDays: CalendarDay[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = getZonedDateStr(currentDate, timeZone);
    const dayTrades = calendarMap.get(dateStr) || [];
    const metrics = calculateGroupMetrics(dayTrades);

    const totalDuration = dayTrades
      .map(t => t.duration_seconds || 0)
      .reduce((sum, d) => sum + d, 0);

    calendarDays.push({
      date: dateStr,
      trades: dayTrades.length,
      wins: metrics.wins,
      losses: metrics.losses,
      breakeven: metrics.breakeven,
      netPnl: metrics.netPnl,
      winRate: metrics.winRate,
      totalDuration,
      averageDuration: metrics.averageDuration,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return calendarDays;
}
