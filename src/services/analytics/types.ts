// ============================================================
// Analytics Types
// ============================================================

import type { Trade, TradeSide } from '../../types/database';

// --- Filter Types ---

export interface AnalyticsFilters {
  accountId?: string | null;
  phaseId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

// --- Trade Classification ---

export type TradeResult = 'win' | 'loss' | 'breakeven';

export interface ClassifiedTrade extends Trade {
  netPnl: number;
  result: TradeResult;
}

// --- Core Metrics ---

export interface CoreMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number | null; // null if no closed trades
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null; // null if no losses
  averageWin: number | null;
  averageLoss: number | null;
  expectancy: number | null;
}

// --- Equity ---

export interface EquityPoint {
  date: string;
  equity: number;
  tradeIndex: number;
}

export interface EquityCurve {
  points: EquityPoint[];
  startingBalance: number;
  endingBalance: number;
  netChange: number;
  returnPercent: number | null;
}

// --- Drawdown ---

export interface DrawdownPoint {
  date: string;
  drawdown: number;
  drawdownPercent: number | null;
  peak: number;
  current: number;
}

export interface DrawdownMetrics {
  points: DrawdownPoint[];
  currentDrawdown: number;
  currentDrawdownPercent: number | null;
  maxDrawdown: number;
  maxDrawdownPercent: number | null;
}

// --- Time Aggregation ---

export type TimeGrouping = 'daily' | 'weekly' | 'monthly';

export interface TimeAggregatedPnl {
  period: string;
  date: Date;
  netPnl: number;
  tradeCount: number;
}

// --- Performance Breakdown ---

export interface PerformanceBreakdown {
  key: string;
  label: string;
  trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null;
  netPnl: number;
  averagePnl: number | null;
}

// --- Duration Analytics ---

export interface DurationMetrics {
  average: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  winningAverage: number | null;
  losingAverage: number | null;
}

// --- Complete Analytics Result ---

export interface AnalyticsResult {
  filters: AnalyticsFilters;
  trades: ClassifiedTrade[];
  metrics: CoreMetrics;
  equity: EquityCurve;
  drawdown: DrawdownMetrics;
  dailyPnl: TimeAggregatedPnl[];
  weeklyPnl: TimeAggregatedPnl[];
  monthlyPnl: TimeAggregatedPnl[];
  symbolPerformance: PerformanceBreakdown[];
  strategyPerformance: PerformanceBreakdown[];
  setupPerformance: PerformanceBreakdown[];
  sidePerformance: PerformanceBreakdown[];
  accountPerformance: PerformanceBreakdown[];
  phasePerformance: PerformanceBreakdown[];
  duration: DurationMetrics;
  currency: string;
}

// --- Advanced Analytics Types ---

// Hour of Day Performance
export interface HourPerformance {
  hour: number; // 0-23
  label: string; // "00:00-00:59"
  trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null;
  netPnl: number;
  averagePnl: number | null;
  averageDuration: number | null;
}

// Day of Week Performance
export interface DayPerformance {
  day: number; // 0-6 (Saturday=0, Friday=6 for Persian calendar)
  label: string; // "شنبه", "یکشنبه", etc.
  trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null;
  netPnl: number;
  averagePnl: number | null;
  averageDuration: number | null;
}

// Calendar Day Data
export interface CalendarDay {
  date: string; // YYYY-MM-DD
  trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  netPnl: number;
  winRate: number | null;
  totalDuration: number;
  averageDuration: number | null;
}

// Duration Buckets
export interface DurationBucket {
  label: string;
  minSeconds: number;
  maxSeconds: number | null; // null for unlimited
  trades: number;
  wins: number;
  losses: number;
  netPnl: number;
  winRate: number | null;
}

// Psychology Analytics
export interface EmotionPerformance {
  emotion: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  netPnl: number;
  averagePnl: number | null;
}

export interface ConfidencePerformance {
  score: number; // 1-10
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  netPnl: number;
  averagePnl: number | null;
}

export interface ExecutionQualityPerformance {
  score: number; // 1-10
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  netPnl: number;
  averagePnl: number | null;
}

export interface RuleAdherencePerformance {
  adherence: string; // 'followed' | 'partially_followed' | 'violated' | 'not_set'
  label: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  netPnl: number;
  averagePnl: number | null;
}

// Extended Analytics Result
export interface ExtendedAnalyticsResult extends AnalyticsResult {
  hourPerformance: HourPerformance[];
  dayPerformance: DayPerformance[];
  calendarData: CalendarDay[];
  durationBuckets: DurationBucket[];
  emotionBeforePerformance: EmotionPerformance[];
  emotionDuringPerformance: EmotionPerformance[];
  emotionAfterPerformance: EmotionPerformance[];
  confidencePerformance: ConfidencePerformance[];
  executionQualityPerformance: ExecutionQualityPerformance[];
  ruleAdherencePerformance: RuleAdherencePerformance[];
}
