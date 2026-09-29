import { supabase, isSupabaseConfigured } from './supabase';
import { MockStorage } from './mockStorage';
import type { Trade, TradeInsert } from '../types/database';

export async function getTrades(userId: string, accountId?: string): Promise<Trade[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getTrades({ accountId });
  }

  let query = supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('entry_datetime', { ascending: false });

  if (accountId) {
    query = query.eq('account_id', accountId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching trades:', error);
    return MockStorage.getTrades({ accountId });
  }

  return data || [];
}

export async function getTrade(tradeId: string, userId: string): Promise<Trade | null> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getTrade(tradeId);
  }

  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('id', tradeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching trade:', error);
    return MockStorage.getTrade(tradeId);
  }

  return data;
}

export async function createTrade(input: TradeInsert): Promise<Trade> {
  if (!isSupabaseConfigured || input.user_id === 'guest-demo-user') {
    return MockStorage.createTrade(input);
  }

  const { data, error } = await supabase
    .from('trades')
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error('Error creating trade:', error);
    return MockStorage.createTrade(input);
  }

  return data;
}

export async function createTradesBatch(trades: TradeInsert[]): Promise<Trade[]> {
  if (!isSupabaseConfigured || (trades[0] && trades[0].user_id === 'guest-demo-user')) {
    const created: Trade[] = [];
    for (const t of trades) {
      created.push(await MockStorage.createTrade(t));
    }
    return created;
  }

  const { data, error } = await supabase
    .from('trades')
    .insert(trades)
    .select();

  if (error) {
    console.error('Error creating trades batch:', error);
    const created: Trade[] = [];
    for (const t of trades) {
      created.push(await MockStorage.createTrade(t));
    }
    return created;
  }

  return data || [];
}

export async function getTradesByAccount(accountId: string, userId: string): Promise<Trade[]> {
  return getTrades(userId, accountId);
}

export async function getTradeCount(userId: string, accountId?: string): Promise<number> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const trades = await MockStorage.getTrades({ accountId });
    return trades.length;
  }

  let query = supabase
    .from('trades')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (accountId) {
    query = query.eq('account_id', accountId);
  }

  const { count, error } = await query;

  if (error) {
    const trades = await MockStorage.getTrades({ accountId });
    return trades.length;
  }

  return count || 0;
}

export async function checkDuplicateTrades(
  userId: string,
  accountId: string,
  tickets: string[]
): Promise<Set<string>> {
  if (tickets.length === 0) return new Set();

  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const trades = await MockStorage.getTrades({ accountId });
    const existing = new Set(trades.map((t) => t.ticket).filter(Boolean));
    return new Set(tickets.filter((ticket) => existing.has(ticket)));
  }

  const { data, error } = await supabase
    .from('trades')
    .select('ticket')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .in('ticket', tickets);

  if (error) {
    console.error('Error checking duplicates:', error);
    return new Set();
  }

  return new Set(data?.map((t) => t.ticket).filter(Boolean) || []);
}
