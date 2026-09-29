// ============================================================
// Time Aggregation & Performance Breakdown
// ============================================================

import type { ClassifiedTrade } from './types';
import type { TimeAggregatedPnl, TimeGrouping, PerformanceBreakdown } from './types';

/**
 * Get the start of a period (day/week/month) for a date
 */
function getPeriodStart(date: Date, grouping: TimeGrouping): Date {
  const d = new Date(date);
  
  switch (grouping) {
    case 'daily':
      d.setHours(0, 0, 0, 0);
      return d;
    case 'weekly':
      // Start of week (Saturday for Persian calendar, but we use Monday for simplicity)
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      return d;
    case 'monthly':
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
  }
}

/**
 * Format period label based on grouping
 */
function formatPeriodLabel(date: Date, grouping: TimeGrouping): string {
  switch (grouping) {
    case 'daily':
      return date.toLocaleDateString('fa-IR');
    case 'weekly':
      return `هفته ${getWeekNumber(date)}`;
    case 'monthly':
      return date.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long' });
  }
}

/**
 * Get week number from date
 */
function getWeekNumber(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.ceil(diff / oneWeek);
}

/**
 * Aggregate P/L by time period
 */
export function aggregateByTime(
  trades: ClassifiedTrade[],
  grouping: TimeGrouping
): TimeAggregatedPnl[] {
  const groups = new Map<string, { date: Date; netPnl: number; tradeCount: number }>();
  
  for (const trade of trades) {
    const exitDate = new Date(trade.exit_datetime);
    const periodStart = getPeriodStart(exitDate, grouping);
    const key = periodStart.toISOString();
    
    const existing = groups.get(key);
    if (existing) {
      existing.netPnl += trade.netPnl;
      existing.tradeCount += 1;
    } else {
      groups.set(key, {
        date: periodStart,
        netPnl: trade.netPnl,
        tradeCount: 1,
      });
    }
  }
  
  // Convert to array and sort by date
  return Array.from(groups.entries())
    .map(([period, data]) => ({
      period: formatPeriodLabel(data.date, grouping),
      date: data.date,
      netPnl: data.netPnl,
      tradeCount: data.tradeCount,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Calculate performance breakdown by a specific field
 */
export function calculatePerformanceBreakdown(
  trades: ClassifiedTrade[],
  keyExtractor: (trade: ClassifiedTrade) => string,
  labelExtractor?: (key: string) => string
): PerformanceBreakdown[] {
  const groups = new Map<string, ClassifiedTrade[]>();
  
  for (const trade of trades) {
    const key = keyExtractor(trade);
    const existing = groups.get(key);
    if (existing) {
      existing.push(trade);
    } else {
      groups.set(key, [trade]);
    }
  }
  
  return Array.from(groups.entries()).map(([key, groupTrades]) => {
    const wins = groupTrades.filter(t => t.result === 'win').length;
    const losses = groupTrades.filter(t => t.result === 'loss').length;
    const breakeven = groupTrades.filter(t => t.result === 'breakeven').length;
    const netPnl = groupTrades.reduce((sum, t) => sum + t.netPnl, 0);
    const avgPnl = groupTrades.length > 0 ? netPnl / groupTrades.length : null;
    
    const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : null;
    
    return {
      key,
      label: labelExtractor ? labelExtractor(key) : key,
      trades: groupTrades.length,
      wins,
      losses,
      breakeven,
      winRate,
      netPnl,
      averagePnl: avgPnl,
    };
  });
}

/**
 * Calculate duration metrics from trades
 */
export function calculateDurationMetrics(trades: ClassifiedTrade[]) {
  const durations = trades
    .map(t => t.duration_seconds)
    .filter((d): d is number => d !== null && d !== undefined);
  
  if (durations.length === 0) {
    return {
      average: null,
      median: null,
      min: null,
      max: null,
      winningAverage: null,
      losingAverage: null,
    };
  }
  
  const sorted = [...durations].sort((a, b) => a - b);
  const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  
  const winningDurations = trades
    .filter(t => t.result === 'win' && t.duration_seconds !== null)
    .map(t => t.duration_seconds as number);
  
  const losingDurations = trades
    .filter(t => t.result === 'loss' && t.duration_seconds !== null)
    .map(t => t.duration_seconds as number);
  
  const winningAverage = winningDurations.length > 0
    ? winningDurations.reduce((sum, d) => sum + d, 0) / winningDurations.length
    : null;
  
  const losingAverage = losingDurations.length > 0
    ? losingDurations.reduce((sum, d) => sum + d, 0) / losingDurations.length
    : null;
  
  return {
    average,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    winningAverage,
    losingAverage,
  };
}
