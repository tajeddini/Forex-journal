import { supabase, isSupabaseConfigured } from './supabase';
import { MockStorage } from './mockStorage';
import type { TradeWithJournal, TradeJournal, TradeJournalInsert, TradeJournalUpdate, TradeSide } from '../types/database';

export async function getTradeJournals(userId?: string): Promise<TradeJournal[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getTradeJournals();
  }

  let query = supabase.from('trade_journals').select('*');
  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`خطا در دریافت یادداشت‌های ژورنال: ${error.message}`);
  }
  return data || [];
}

export async function getTradeJournal(tradeId: string, userId: string): Promise<TradeJournal | null> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const list = await MockStorage.getTradeJournals();
    return list.find(j => j.trade_id === tradeId) || null;
  }

  const { data, error } = await supabase
    .from('trade_journals')
    .select('*')
    .eq('trade_id', tradeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`خطا در دریافت ژورنال معامله: ${error.message}`);
  }
  return data;
}

export async function saveTradeJournal(input: TradeJournalInsert): Promise<TradeJournal> {
  if (!isSupabaseConfigured || input.user_id === 'guest-demo-user') {
    return MockStorage.saveTradeJournal(input);
  }

  // Verify trade ownership
  const { data: trade } = await supabase
    .from('trades')
    .select('id')
    .eq('id', input.trade_id)
    .eq('user_id', input.user_id)
    .maybeSingle();

  if (!trade) {
    throw new Error('معامله مورد نظر یافت نشد یا متعلق به شما نیست');
  }

  // Sanitize input payload
  const sanitizedStrategyId = input.strategy_id ? input.strategy_id.trim() || null : null;
  const sanitizedSetupId = input.setup_id ? input.setup_id.trim() || null : null;

  // Verify strategy ownership if supplied
  if (sanitizedStrategyId) {
    const { data: strat } = await supabase
      .from('strategies')
      .select('id')
      .eq('id', sanitizedStrategyId)
      .eq('user_id', input.user_id)
      .maybeSingle();
    if (!strat) {
      throw new Error('استراتژی انتخابی متعلق به کاربر نیست');
    }
  }

  // Verify setup ownership if supplied
  if (sanitizedSetupId) {
    const { data: st } = await supabase
      .from('setups')
      .select('id')
      .eq('id', sanitizedSetupId)
      .eq('user_id', input.user_id)
      .maybeSingle();
    if (!st) {
      throw new Error('ستاپ انتخابی متعلق به کاربر نیست');
    }
  }

  const payload: TradeJournalInsert = {
    ...input,
    strategy_id: sanitizedStrategyId,
    setup_id: sanitizedSetupId,
    planned_risk_amount: typeof input.planned_risk_amount === 'number' && !isNaN(input.planned_risk_amount) ? input.planned_risk_amount : null,
    planned_risk_percentage: typeof input.planned_risk_percentage === 'number' && !isNaN(input.planned_risk_percentage) ? input.planned_risk_percentage : null,
    planned_rr: typeof input.planned_rr === 'number' && !isNaN(input.planned_rr) ? input.planned_rr : null,
    confidence: typeof input.confidence === 'number' && !isNaN(input.confidence) ? Math.min(10, Math.max(1, Math.round(input.confidence))) : null,
    execution_quality: typeof input.execution_quality === 'number' && !isNaN(input.execution_quality) ? Math.min(10, Math.max(1, Math.round(input.execution_quality))) : null,
    rule_adherence: input.rule_adherence || 'not_set',
    status: input.status || 'not_started',
    checklist: input.checklist || {},
  };

  const { data, error } = await supabase
    .from('trade_journals')
    .upsert(payload, { onConflict: 'trade_id' })
    .select()
    .single();

  if (error) throw new Error(`خطا در ذخیره ژورنال: ${error.message}`);
  return data;
}

export async function upsertTradeJournal(
  tradeId: string,
  userId: string,
  input: TradeJournalUpdate
): Promise<TradeJournal> {
  return saveTradeJournal({
    trade_id: tradeId,
    user_id: userId,
    strategy_id: null,
    setup_id: null,
    market_context: null,
    market_bias: null,
    timeframe: null,
    important_levels: null,
    confluences: null,
    entry_reason: null,
    expected_scenario: null,
    invalidating_condition: null,
    planned_risk_amount: null,
    planned_risk_percentage: null,
    planned_rr: null,
    confidence: null,
    checklist: null,
    emotion_before: null,
    emotion_during: null,
    emotion_after: null,
    execution_quality: null,
    rule_adherence: 'not_set',
    rule_adherence_notes: null,
    what_went_well: null,
    what_went_wrong: null,
    lesson_learned: null,
    post_trade_notes: null,
    status: 'not_started',
    ...input,
  });
}

export interface JournalFilters {
  accountId?: string;
  phaseId?: string;
  journalStatus?: string;
  strategyId?: string;
  symbol?: string;
  side?: TradeSide;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Filter mock trades in guest mode with exact same semantics
 */
async function filterMockTrades(filters: JournalFilters): Promise<TradeWithJournal[]> {
  const mockTrades = await MockStorage.getTrades({ accountId: filters.accountId });
  const mockJournals = await MockStorage.getTradeJournals();
  const mockTags = await MockStorage.getTags();
  const mockMistakes = await MockStorage.getMistakes();

  const journalMap = new Map(mockJournals.map(j => [j.trade_id, j]));
  let result: TradeWithJournal[] = mockTrades.map(trade => ({
    ...trade,
    journal: journalMap.get(trade.id) || null,
    tags: mockTags.slice(0, 2),
    mistakes: mockMistakes.slice(0, 1).map(m => ({ mistake: m, notes: null })),
  }));

  if (filters.phaseId) {
    result = result.filter(t => t.phase_id === filters.phaseId);
  }
  if (filters.symbol) {
    result = result.filter(t => t.symbol.toLowerCase() === filters.symbol!.toLowerCase());
  }
  if (filters.side) {
    result = result.filter(t => t.side === filters.side);
  }
  if (filters.journalStatus) {
    result = result.filter(t => t.journal?.status === filters.journalStatus);
  }
  if (filters.strategyId) {
    if (filters.strategyId === 'no_strategy') {
      result = result.filter(t => !t.journal || !t.journal.strategy_id);
    } else {
      result = result.filter(t => t.journal?.strategy_id === filters.strategyId);
    }
  }
  if (filters.dateFrom) {
    result = result.filter(t => new Date(t.entry_datetime) >= new Date(filters.dateFrom!));
  }
  if (filters.dateTo) {
    result = result.filter(t => new Date(t.entry_datetime) <= new Date(filters.dateTo!));
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(t =>
      t.symbol.toLowerCase().includes(q) ||
      (t.ticket && t.ticket.toLowerCase().includes(q)) ||
      (t.comment && t.comment.toLowerCase().includes(q))
    );
  }

  return result;
}

export async function getTradesWithJournal(
  userId: string,
  filters: JournalFilters = {},
  page: number = 1,
  limit: number = 50
): Promise<TradeWithJournal[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const filtered = await filterMockTrades(filters);
    const start = (page - 1) * limit;
    return filtered.slice(start, start + limit);
  }

  // First handle journal-specific filters if present
  let matchingTradeIds: string[] | null = null;
  if (filters.journalStatus || filters.strategyId) {
    let tradeIdsQuery = supabase
      .from('trade_journals')
      .select('trade_id')
      .eq('user_id', userId);

    if (filters.journalStatus) {
      tradeIdsQuery = tradeIdsQuery.eq('status', filters.journalStatus);
    }

    if (filters.strategyId) {
      if (filters.strategyId === 'no_strategy') {
        tradeIdsQuery = tradeIdsQuery.is('strategy_id', null);
      } else {
        tradeIdsQuery = tradeIdsQuery.eq('strategy_id', filters.strategyId);
      }
    }

    const { data: tradeIdsResult, error: tradeIdsError } = await tradeIdsQuery;
    if (tradeIdsError) {
      throw new Error(`خطا در فیلتر وضعیت ژورنال: ${tradeIdsError.message}`);
    }

    if (!tradeIdsResult || tradeIdsResult.length === 0) {
      return [];
    }
    matchingTradeIds = tradeIdsResult.map(t => t.trade_id);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('trades')
    .select(`
      *,
      journal:trade_journals(*),
      tags:trade_tags(tag:tags(*)),
      mistakes:trade_mistakes(notes, mistake:mistakes(*))
    `)
    .eq('user_id', userId)
    .order('entry_datetime', { ascending: false })
    .range(from, to);

  if (filters.accountId) {
    query = query.eq('account_id', filters.accountId);
  }
  if (filters.phaseId) {
    query = query.eq('phase_id', filters.phaseId);
  }
  if (filters.symbol) {
    query = query.eq('symbol', filters.symbol);
  }
  if (filters.side) {
    query = query.eq('side', filters.side);
  }
  if (filters.dateFrom) {
    query = query.gte('entry_datetime', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('entry_datetime', filters.dateTo);
  }
  if (filters.search) {
    query = query.or(`symbol.ilike.%${filters.search}%,ticket.ilike.%${filters.search}%,comment.ilike.%${filters.search}%`);
  }
  if (matchingTradeIds) {
    query = query.in('id', matchingTradeIds);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`خطا در دریافت لیست معاملات ژورنال: ${error.message}`);
  }

  return (data || []).map((trade: any) => ({
    ...trade,
    journal: Array.isArray(trade.journal)
      ? (trade.journal[0] || null)
      : (trade.journal || null),
    tags: (trade.tags || []).map((t: any) => t.tag).filter(Boolean),
    mistakes: (trade.mistakes || []).map((m: any) => ({
      mistake: m.mistake,
      notes: m.notes,
    })).filter((m: any) => Boolean(m.mistake)),
  }));
}

export async function getTradeWithJournal(tradeId: string, userId: string): Promise<TradeWithJournal | null> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const trade = await MockStorage.getTrade(tradeId);
    if (!trade) return null;
    const journals = await MockStorage.getTradeJournals();
    const tags = await MockStorage.getTags();
    const mistakes = await MockStorage.getMistakes();
    return {
      ...trade,
      journal: journals.find(j => j.trade_id === tradeId) || null,
      tags: tags.slice(0, 2),
      mistakes: mistakes.slice(0, 1).map(m => ({ mistake: m, notes: null })),
    };
  }

  const { data, error } = await supabase
    .from('trades')
    .select(`
      *,
      journal:trade_journals(*),
      tags:trade_tags(tag:tags(*)),
      mistakes:trade_mistakes(notes, mistake:mistakes(*))
    `)
    .eq('id', tradeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`خطا در دریافت جزئیات ژورنال معامله: ${error.message}`);
  }

  if (!data) return null;

  return {
    ...data,
    journal: Array.isArray(data.journal)
      ? (data.journal[0] || null)
      : (data.journal || null),
    tags: (data.tags || []).map((t: any) => t.tag).filter(Boolean),
    mistakes: (data.mistakes || []).map((m: any) => ({
      mistake: m.mistake,
      notes: m.notes,
    })).filter((m: any) => Boolean(m.mistake)),
  };
}

export async function getTradeCount(userId: string, filters: JournalFilters = {}): Promise<number> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const filtered = await filterMockTrades(filters);
    return filtered.length;
  }

  let matchingTradeIds: string[] | null = null;
  if (filters.journalStatus || filters.strategyId) {
    let tradeIdsQuery = supabase
      .from('trade_journals')
      .select('trade_id')
      .eq('user_id', userId);

    if (filters.journalStatus) {
      tradeIdsQuery = tradeIdsQuery.eq('status', filters.journalStatus);
    }

    if (filters.strategyId) {
      if (filters.strategyId === 'no_strategy') {
        tradeIdsQuery = tradeIdsQuery.is('strategy_id', null);
      } else {
        tradeIdsQuery = tradeIdsQuery.eq('strategy_id', filters.strategyId);
      }
    }

    const { data: tradeIdsResult, error: tradeIdsError } = await tradeIdsQuery;
    if (tradeIdsError) {
      throw new Error(`خطا در شمارش فیلتر وضعیت ژورنال: ${tradeIdsError.message}`);
    }

    if (!tradeIdsResult || tradeIdsResult.length === 0) {
      return 0;
    }
    matchingTradeIds = tradeIdsResult.map((t: any) => t.trade_id);
  }

  let query = supabase
    .from('trades')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (filters.accountId) {
    query = query.eq('account_id', filters.accountId);
  }
  if (filters.phaseId) {
    query = query.eq('phase_id', filters.phaseId);
  }
  if (filters.symbol) {
    query = query.eq('symbol', filters.symbol);
  }
  if (filters.side) {
    query = query.eq('side', filters.side);
  }
  if (filters.dateFrom) {
    query = query.gte('entry_datetime', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('entry_datetime', filters.dateTo);
  }
  if (filters.search) {
    query = query.or(`symbol.ilike.%${filters.search}%,ticket.ilike.%${filters.search}%,comment.ilike.%${filters.search}%`);
  }
  if (matchingTradeIds) {
    query = query.in('id', matchingTradeIds);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(`خطا در شمارش معاملات: ${error.message}`);
  }

  return count || 0;
}
