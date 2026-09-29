import { supabase, isSupabaseConfigured } from './supabase';
import { MockStorage } from './mockStorage';
import type { TradeJournal, TradeJournalInsert, TradeJournalUpdate, TradeWithJournal } from '../types/database';

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
    const list = await MockStorage.getTradeJournals();
    return list.find(j => j.trade_id === tradeId) || null;
  }
  return data;
}

export async function createTradeJournal(input: TradeJournalInsert): Promise<TradeJournal> {
  if (!isSupabaseConfigured || input.user_id === 'guest-demo-user') {
    return {
      id: `journal-${Date.now()}`,
      ...input,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as TradeJournal;
  }

  const { data, error } = await supabase
    .from('trade_journals')
    .insert(input)
    .select()
    .single();

  if (error) throw new Error('خطا در ایجاد ژورنال');
  return data;
}

export async function updateTradeJournal(
  tradeId: string,
  userId: string,
  input: TradeJournalUpdate
): Promise<TradeJournal> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const list = await MockStorage.getTradeJournals();
    const existing = list.find(j => j.trade_id === tradeId);
    return { ...existing, ...input, updated_at: new Date().toISOString() } as TradeJournal;
  }

  const { data, error } = await supabase
    .from('trade_journals')
    .update(input)
    .eq('trade_id', tradeId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error('خطا در بروزرسانی ژورنال');
  return data;
}

export async function upsertTradeJournal(
  tradeId: string,
  userId: string,
  input: TradeJournalUpdate
): Promise<TradeJournal> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return updateTradeJournal(tradeId, userId, input);
  }

  const { data, error } = await supabase
    .from('trade_journals')
    .upsert({ ...input, trade_id: tradeId, user_id: userId })
    .select()
    .single();

  if (error) throw new Error('خطا در ذخیره ژورنال');
  return data;
}

export interface JournalFilters {
  accountId?: string;
  journalStatus?: string;
  strategyId?: string;
  search?: string;
}

export async function getTradesWithJournal(
  userId: string,
  filters: JournalFilters = {},
  page: number = 1,
  limit: number = 50
): Promise<TradeWithJournal[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
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

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(t => t.symbol.toLowerCase().includes(q) || (t.ticket && t.ticket.includes(q)));
    }

    const start = (page - 1) * limit;
    return result.slice(start, start + limit);
  }

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
    console.error('Error filtering by journal:', tradeIdsError);
  }

  if ((filters.journalStatus || filters.strategyId) && (!tradeIdsResult || tradeIdsResult.length === 0)) {
    return [];
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

  if (filters.search) {
    query = query.or(`symbol.ilike.%${filters.search}%,ticket.ilike.%${filters.search}%,comment.ilike.%${filters.search}%`);
  }

  if ((filters.journalStatus || filters.strategyId) && tradeIdsResult) {
    const matchingTradeIds = tradeIdsResult.map(t => t.trade_id);
    query = query.in('id', matchingTradeIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching trades with journal:', error);
    return [];
  }

  return (data || []).map((trade: any) => ({
    ...trade,
    journal: trade.journal?.[0] || null,
    tags: (trade.tags || []).map((t: any) => t.tag),
    mistakes: (trade.mistakes || []).map((m: any) => ({
      mistake: m.mistake,
      notes: m.notes,
    })),
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

  if (error || !data) return null;

  return {
    ...data,
    journal: (data as any).journal?.[0] || null,
    tags: ((data as any).tags || []).map((t: any) => t.tag),
    mistakes: ((data as any).mistakes || []).map((m: any) => ({
      mistake: m.mistake,
      notes: m.notes,
    })),
  };
}

export async function getTradeCount(userId: string, filters: JournalFilters = {}): Promise<number> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const mockTrades = await MockStorage.getTrades({ accountId: filters.accountId });
    return mockTrades.length;
  }

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
    console.error('Error filtering by journal for count:', tradeIdsError);
  }

  if ((filters.journalStatus || filters.strategyId) && (!tradeIdsResult || tradeIdsResult.length === 0)) {
    return 0;
  }

  let query = supabase
    .from('trades')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (filters.accountId) {
    query = query.eq('account_id', filters.accountId);
  }

  if (filters.search) {
    query = query.or(`symbol.ilike.%${filters.search}%,ticket.ilike.%${filters.search}%,comment.ilike.%${filters.search}%`);
  }

  if ((filters.journalStatus || filters.strategyId) && tradeIdsResult) {
    const matchingTradeIds = tradeIdsResult.map((t: any) => t.trade_id);
    query = query.in('id', matchingTradeIds);
  }

  const { count, error } = await query;
  
  if (error) {
    console.error('Error counting trades:', error);
    return 0;
  }
  
  return count || 0;
}
