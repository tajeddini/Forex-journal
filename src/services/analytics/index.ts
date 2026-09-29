// ============================================================
// Analytics Service
// Main service that orchestrates all analytics calculations
// ============================================================

import { supabase, isSupabaseConfigured } from '../supabase';
import { MockStorage } from '../mockStorage';
import type { Trade, TradingAccount } from '../../types/database';
import type { AnalyticsFilters, AnalyticsResult } from './types';
import { classifyTrades, calculateCoreMetrics } from './metrics';
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
    console.error('Error fetching trades for analytics:', error);
    return MockStorage.getTrades({
      accountId: filters.accountId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });
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
    console.error('Error fetching accounts:', error);
    return MockStorage.getAccounts(userId);
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
  
  // Get starting balance from account
  let startingBalance = 0;
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const accs = await MockStorage.getAccounts(userId);
    if (filters.accountId) {
      const acc = accs.find(a => a.id === filters.accountId);
      startingBalance = acc?.initial_balance || 10000;
    } else {
      startingBalance = accs.reduce((sum, a) => sum + (a.initial_balance || 0), 0) || 100000;
    }
  } else if (filters.accountId) {
    const { data: account } = await supabase
      .from('trading_accounts')
      .select('initial_balance')
      .eq('id', filters.accountId)
      .eq('user_id', userId)
      .single();
    
    startingBalance = account?.initial_balance || 0;
  } else if (trades.length > 0) {
    const accountIds = [...new Set(trades.map(t => t.account_id))];
    const { data: accounts } = await supabase
      .from('trading_accounts')
      .select('id, initial_balance')
      .in('id', accountIds)
      .eq('user_id', userId);
    
    startingBalance = accounts?.reduce((sum: number, acc: any) => sum + acc.initial_balance, 0) || 0;
  }
  
  // Calculate equity curve
  const equity = calculateEquityCurve(classifiedTrades, startingBalance);
  
  // Calculate drawdown
  const drawdown = calculateDrawdown(equity);
  
  // Time aggregations
  const dailyPnl = aggregateByTime(classifiedTrades, 'daily');
  const weeklyPnl = aggregateByTime(classifiedTrades, 'weekly');
  const monthlyPnl = aggregateByTime(classifiedTrades, 'monthly');
  
  // Fetch journal data for strategy analysis
  const tradeIds = classifiedTrades.map(t => t.id);
  let tradesWithJournal = classifiedTrades;
  let strategyMap = new Map<string, string>();
  
  if (tradeIds.length > 0 && isSupabaseConfigured && userId !== 'guest-demo-user') {
    const { data: journals } = await supabase
      .from('trade_journals')
      .select('trade_id, strategy_id')
      .in('trade_id', tradeIds);
    
    if (journals && journals.length > 0) {
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
    }
  } else {
    const mockJournals = await MockStorage.getTradeJournals();
    const mockStrats = await MockStorage.getStrategies();
    strategyMap = new Map(mockStrats.map(s => [s.id, s.name]));
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
      return strategyMap.get(key) || 'استراتژی نمونه';
    }
  );
  
  let setupMap = new Map<string, string>();
  const mockSetups = await MockStorage.getSetups();
  setupMap = new Map(mockSetups.map(s => [s.id, s.name]));
  
  const setupPerformance = calculatePerformanceBreakdown(
    tradesWithJournal,
    t => (t as any).journal?.setup_id || 'no_setup',
    key => {
      if (key === 'no_setup') return 'بدون ستاپ';
      return setupMap.get(key) || 'ستاپ نمونه';
    }
  );
  
  const sidePerformance = calculatePerformanceBreakdown(
    classifiedTrades,
    t => t.side,
    key => key === 'buy' ? 'خرید' : 'فروش'
  );
  
  const accountPerformance = calculatePerformanceBreakdown(
    classifiedTrades,
    t => t.account_id
  );
  
  const phasePerformance = calculatePerformanceBreakdown(
    classifiedTrades.filter(t => t.phase_id),
    t => t.phase_id || 'no_phase',
    key => key === 'no_phase' ? 'بدون فاز' : key
  );
  
  const duration = calculateDurationMetrics(classifiedTrades);
  
  let currency = 'USD';
  
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
