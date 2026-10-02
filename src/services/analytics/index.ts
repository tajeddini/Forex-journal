// ============================================================
// Analytics Service
// Main service that orchestrates all analytics calculations
// Strictly surfaces real database errors, enforces currency integrity,
// calculates mathematically sound period equity, and resolves real setups/strategies.
// ============================================================

import { supabase, isSupabaseConfigured } from '../supabase';
import { MockStorage } from '../mockStorage';
import type { Trade, TradingAccount } from '../../types/database';
import type { AnalyticsFilters, AnalyticsResult } from './types';
import { classifyTrades, calculateCoreMetrics, calculateNetPnl } from './metrics';
import { calculateEquityCurve, calculateDrawdown } from './equity';
import { aggregateByTime, calculatePerformanceBreakdown, calculateDurationMetrics } from './aggregation';

/**
 * Fetch trades for analytics with filters applied
 */
export async function fetchAnalyticsTrades(
  userId: string,
  filters: AnalyticsFilters
): Promise<Trade[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getTrades({
      accountId: filters.accountId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });
  }

  let query = supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('exit_datetime', { ascending: true });

  if (filters.accountId) {
    query = query.eq('account_id', filters.accountId);
  }

  if (filters.phaseId) {
    query = query.eq('phase_id', filters.phaseId);
  }

  if (filters.dateFrom) {
    query = query.gte('exit_datetime', filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte('exit_datetime', filters.dateTo);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`خطا در دریافت معاملات برای تحلیل: ${error.message}`);
  }

  return data || [];
}


/**
 * Fetch only the trade columns required by the dashboard.
 * Keeping this payload narrow avoids transferring unused MT4/MT5 fields.
 */
export async function fetchDashboardTrades(
  userId: string,
  filters: AnalyticsFilters
): Promise<Trade[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getTrades({
      accountId: filters.accountId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });
  }

  let query = supabase
    .from('trades')
    .select('id, account_id, phase_id, symbol, side, entry_datetime, exit_datetime, profit, commission, swap, duration_seconds')
    .eq('user_id', userId)
    .order('exit_datetime', { ascending: true });

  if (filters.accountId) query = query.eq('account_id', filters.accountId);
  if (filters.phaseId) query = query.eq('phase_id', filters.phaseId);
  if (filters.dateFrom) query = query.gte('exit_datetime', filters.dateFrom);
  if (filters.dateTo) query = query.lte('exit_datetime', filters.dateTo);

  const { data, error } = await query;
  if (error) {
    throw new Error(`خطا در دریافت معاملات داشبورد: ${error.message}`);
  }

  return data || [];
}

/**
 * Fetch accounts for filter options
 */
export async function fetchAccounts(userId: string): Promise<TradingAccount[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getAccounts(userId);
  }

  const { data, error } = await supabase
    .from('trading_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('name');

  if (error) {
    throw new Error(`خطا در دریافت حساب‌ها برای تحلیل: ${error.message}`);
  }

  return data || [];
}

/**
 * Calculate complete analytics result
 */
export async function calculateAnalytics(
  userId: string,
  filters: AnalyticsFilters
): Promise<AnalyticsResult> {
  // Fetch trades
  const trades = await fetchAnalyticsTrades(userId, filters);

  // Classify trades
  const classifiedTrades = classifyTrades(trades);

  // Calculate core metrics
  const metrics = calculateCoreMetrics(classifiedTrades);

  // Determine accounts and currency
  let startingBalance = 0;
  let currency = 'USD';
  let hasMixedCurrencies = false;

  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const accs = await MockStorage.getAccounts(userId);
    if (filters.accountId) {
      const acc = accs.find(a => a.id === filters.accountId);
      startingBalance = acc?.initial_balance || 10000;
      currency = acc?.currency || 'USD';
    } else {
      startingBalance = accs.reduce((sum, a) => sum + (a.initial_balance || 0), 0) || 100000;
      const currencies = new Set(accs.map(a => a.currency));
      if (currencies.size === 1) {
        currency = Array.from(currencies)[0];
      } else if (currencies.size > 1) {
        hasMixedCurrencies = true;
        currency = 'ارزهای چندگانه (مستقل)';
      }
    }
  } else if (filters.accountId) {
    const { data: account, error: accError } = await supabase
      .from('trading_accounts')
      .select('initial_balance, currency')
      .eq('id', filters.accountId)
      .eq('user_id', userId)
      .single();

    if (accError) {
      throw new Error(`خطا در دریافت اطلاعات حساب: ${accError.message}`);
    }

    startingBalance = Number(account?.initial_balance) || 0;
    currency = account?.currency || 'USD';

    // Date range starting equity adjustment:
    // If dateFrom is provided, add PnL of prior trades to obtain the period's starting balance
    if (filters.dateFrom) {
      const { data: priorTrades, error: priorError } = await supabase
        .from('trades')
        .select('profit, commission, swap')
        .eq('account_id', filters.accountId)
        .eq('user_id', userId)
        .lt('exit_datetime', filters.dateFrom);

      if (!priorError && priorTrades) {
        const priorPnl = priorTrades.reduce(
          (sum: number, t: any) => sum + ((t.profit || 0) + (t.commission || 0) + (t.swap || 0)),
          0
        );
        startingBalance += priorPnl;
      }
    }
  } else {
    // Multiple accounts
    const { data: accounts, error: accsError } = await supabase
      .from('trading_accounts')
      .select('id, initial_balance, currency')
      .eq('user_id', userId);

    if (accsError) {
      throw new Error(`خطا در دریافت حساب‌ها: ${accsError.message}`);
    }

    const currencies = new Set((accounts || []).map(a => a.currency));
    if (currencies.size === 1) {
      currency = Array.from(currencies)[0];
      startingBalance = (accounts || []).reduce((sum, a) => sum + Number(a.initial_balance || 0), 0);
    } else if (currencies.size > 1) {
      hasMixedCurrencies = true;
      currency = 'ارزهای چندگانه (مستقل)';
      // Do not sum cross-currency balances without exchange rate conversion
      startingBalance = 0;
    }
  }

  // Calculate equity curve
  const equity = calculateEquityCurve(classifiedTrades, startingBalance);

  // Calculate drawdown
  const drawdown = calculateDrawdown(equity);

  // Time aggregations
  const dailyPnl = aggregateByTime(classifiedTrades, 'daily');
  const weeklyPnl = aggregateByTime(classifiedTrades, 'weekly');
  const monthlyPnl = aggregateByTime(classifiedTrades, 'monthly');

  // Fetch journal data for strategy & setup analysis
  const tradeIds = classifiedTrades.map(t => t.id);
  let tradesWithJournal = classifiedTrades;
  let strategyMap = new Map<string, string>();
  let setupMap = new Map<string, string>();

  if (tradeIds.length > 0 && isSupabaseConfigured && userId !== 'guest-demo-user') {
    const { data: journals, error: jError } = await supabase
      .from('trade_journals')
      .select('trade_id, strategy_id, setup_id')
      .in('trade_id', tradeIds);

    if (!jError && journals && journals.length > 0) {
      const journalMap = new Map(journals.map((j: any) => [j.trade_id, j]));
      tradesWithJournal = classifiedTrades.map(t => ({
        ...t,
        journal: journalMap.get(t.id) || null,
      }));

      const strategyIds = [...new Set(journals.map((j: any) => j.strategy_id).filter(Boolean))];
      if (strategyIds.length > 0) {
        const { data: strategies } = await supabase
          .from('strategies')
          .select('id, name')
          .in('id', strategyIds as string[]);

        if (strategies) {
          strategyMap = new Map(strategies.map((s: any) => [s.id, s.name]));
        }
      }

      const setupIds = [...new Set(journals.map((j: any) => j.setup_id).filter(Boolean))];
      if (setupIds.length > 0) {
        const { data: setups } = await supabase
          .from('setups')
          .select('id, name')
          .in('id', setupIds as string[]);

        if (setups) {
          setupMap = new Map(setups.map((s: any) => [s.id, s.name]));
        }
      }
    }
  } else if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const mockJournals = await MockStorage.getTradeJournals();
    const mockStrats = await MockStorage.getStrategies();
    const mockSetups = await MockStorage.getSetups();

    strategyMap = new Map(mockStrats.map(s => [s.id, s.name]));
    setupMap = new Map(mockSetups.map(s => [s.id, s.name]));

    const journalMap = new Map(mockJournals.map(j => [j.trade_id, j]));
    tradesWithJournal = classifiedTrades.map(t => ({
      ...t,
      journal: journalMap.get(t.id) || null,
    }));
  }

  // Performance breakdowns
  const symbolPerformance = calculatePerformanceBreakdown(
    classifiedTrades,
    t => t.symbol
  );

  const strategyPerformance = calculatePerformanceBreakdown(
    tradesWithJournal,
    t => (t as any).journal?.strategy_id || 'no_strategy',
    key => {
      if (key === 'no_strategy') return 'بدون استراتژی';
      return strategyMap.get(key) || 'بدون استراتژی';
    }
  );

  const setupPerformance = calculatePerformanceBreakdown(
    tradesWithJournal,
    t => (t as any).journal?.setup_id || 'no_setup',
    key => {
      if (key === 'no_setup') return 'بدون ستاپ';
      return setupMap.get(key) || 'بدون ستاپ';
    }
  );

  const sidePerformance = calculatePerformanceBreakdown(
    classifiedTrades,
    t => t.side,
    key => (key === 'buy' ? 'خرید' : 'فروش')
  );

  const accountPerformance = calculatePerformanceBreakdown(
    classifiedTrades,
    t => t.account_id
  );

  const phasePerformance = calculatePerformanceBreakdown(
    classifiedTrades.filter(t => t.phase_id),
    t => t.phase_id || 'no_phase',
    key => (key === 'no_phase' ? 'بدون فاز' : key)
  );

  const duration = calculateDurationMetrics(classifiedTrades);

  return {
    filters,
    trades: classifiedTrades,
    metrics,
    equity,
    drawdown,
    dailyPnl,
    weeklyPnl,
    monthlyPnl,
    symbolPerformance,
    strategyPerformance,
    setupPerformance,
    sidePerformance,
    accountPerformance,
    phasePerformance,
    duration,
    currency,
  };
}
