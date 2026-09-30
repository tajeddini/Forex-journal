// ============================================================
// Trading Reviews Service
// Daily, Weekly, Monthly reviews with real period statistics
// and zero silent MockStorage fallbacks for authenticated users
// ============================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { MockStorage } from './mockStorage';
import type { TradingReview, TradingReviewInsert, TradingReviewUpdate, ReviewType, Trade } from '../types/database';
import { classifyTrades, calculateCoreMetrics } from './analytics/metrics';

/**
 * Get all reviews for a user
 */
export async function getReviews(userId: string, type?: ReviewType): Promise<TradingReview[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getReviews(userId, type);
  }

  let query = supabase
    .from('trading_reviews')
    .select('*')
    .eq('user_id', userId)
    .order('review_date', { ascending: false });

  if (type) {
    query = query.eq('review_type', type);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`خطا در دریافت بازبینی‌های معاملاتی: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a specific review
 */
export async function getReview(reviewId: string, userId: string): Promise<TradingReview | null> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getReview(reviewId, userId);
  }

  const { data, error } = await supabase
    .from('trading_reviews')
    .select('*')
    .eq('id', reviewId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`خطا در دریافت بازبینی: ${error.message}`);
  }

  return data;
}

/**
 * Compute real statistics for a review period
 */
export async function computeReviewStats(
  userId: string,
  periodStart: string,
  periodEnd: string,
  accountId?: string | null,
  phaseId?: string | null
): Promise<{
  total_trades: number;
  net_pnl: number;
  win_rate: number | null;
  profit_factor: number | null;
  expectancy: number | null;
  avg_duration: number | null;
}> {
  let trades: Trade[] = [];

  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const allTrades = await MockStorage.getTrades({ accountId: accountId || undefined });
    trades = allTrades.filter(t => {
      const exitTime = t.exit_datetime.split('T')[0];
      return exitTime >= periodStart && exitTime <= periodEnd;
    });
  } else {
    let query = supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .gte('exit_datetime', `${periodStart}T00:00:00.000Z`)
      .lte('exit_datetime', `${periodEnd}T23:59:59.999Z`);

    if (accountId) {
      query = query.eq('account_id', accountId);
    }
    if (phaseId) {
      query = query.eq('phase_id', phaseId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`خطا در محاسبه آمار بازبینی: ${error.message}`);
    }
    trades = data || [];
  }

  if (trades.length === 0) {
    return {
      total_trades: 0,
      net_pnl: 0,
      win_rate: null,
      profit_factor: null,
      expectancy: null,
      avg_duration: null,
    };
  }

  const classified = classifyTrades(trades);
  const metrics = calculateCoreMetrics(classified);

  const durations = trades
    .map(t => t.duration_seconds)
    .filter((d): d is number => d !== null && d !== undefined);
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  return {
    total_trades: metrics.totalTrades,
    net_pnl: metrics.netPnl,
    win_rate: metrics.winRate,
    profit_factor: metrics.profitFactor === Infinity ? null : metrics.profitFactor,
    expectancy: metrics.expectancy,
    avg_duration: avgDuration,
  };
}

/**
 * Create a new review
 */
export async function createReview(input: TradingReviewInsert): Promise<TradingReview> {
  if (!isSupabaseConfigured || input.user_id === 'guest-demo-user') {
    return MockStorage.createReview(input);
  }

  const { data, error } = await supabase
    .from('trading_reviews')
    .insert(input)
    .select()
    .single();

  if (error) {
    throw new Error(`خطا در ایجاد بازبینی: ${error.message}`);
  }

  return data;
}

/**
 * Update a review
 */
export async function updateReview(
  reviewId: string,
  userId: string,
  input: TradingReviewUpdate
): Promise<TradingReview> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.updateReview(reviewId, input);
  }

  const { data, error } = await supabase
    .from('trading_reviews')
    .update(input)
    .eq('id', reviewId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`خطا در به‌روزرسانی بازبینی: ${error.message}`);
  }

  return data;
}

/**
 * Delete a review
 */
export async function deleteReview(reviewId: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.deleteReview(reviewId);
  }

  const { error } = await supabase
    .from('trading_reviews')
    .delete()
    .eq('id', reviewId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`خطا در حذف بازبینی: ${error.message}`);
  }
}

/**
 * Get period dates for a review type
 */
export function getReviewPeriod(type: ReviewType, date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  let end = new Date(date);

  switch (type) {
    case 'daily':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'weekly':
      // Start of week (Saturday for Persian calendar)
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    case 'monthly':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
}
