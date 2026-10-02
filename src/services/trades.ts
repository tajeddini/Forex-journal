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
    throw new Error(`خطا در دریافت معاملات از پایگاه داده: ${error.message}`);
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
    throw new Error(`خطا در دریافت معامله: ${error.message}`);
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
    throw new Error(`خطا در ذخیره معامله: ${error.message}`);
  }

  return data;
}

export async function createTradesBatch(trades: TradeInsert[]): Promise<Trade[]> {
  if (trades.length === 0) return [];

  if (!isSupabaseConfigured || trades[0].user_id === 'guest-demo-user') {
    const created: Trade[] = [];
    for (const t of trades) {
      created.push(await MockStorage.createTrade(t));
    }
    return created;
  }

  // Attempt transactional RPC import if batch metadata is consistent
  const batchId = trades[0].import_batch_id;
  const userId = trades[0].user_id;
  const accountId = trades[0].account_id;
  const sameBatch = batchId && trades.every(t => t.import_batch_id === batchId && t.user_id === userId && t.account_id === accountId);

  if (sameBatch) {
    const { error: rpcError } = await supabase.rpc('import_trades_transactional', {
      p_batch_id: batchId,
      p_user_id: userId,
      p_account_id: accountId,
      p_trades: trades,
    });

    if (!rpcError) {
      const { data: inserted, error: fetchErr } = await supabase
        .from('trades')
        .select('*')
        .eq('import_batch_id', batchId)
        .eq('user_id', userId);

      if (!fetchErr && inserted) {
        return inserted;
      }
    } else if (!rpcError.message.includes('function') && !rpcError.message.includes('not found')) {
      throw new Error(`خطا در ذخیره تراکنشی معاملات: ${rpcError.message}`);
    }
  }

  const { data, error } = await supabase
    .from('trades')
    .insert(trades)
    .select();

  if (error) {
    throw new Error(`خطا در ذخیره گروهی معاملات: ${error.message}`);
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
    throw new Error(`خطا در شمارش معاملات: ${error.message}`);
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
    throw new Error(`خطا در بررسی معاملات تکراری: ${error.message}`);
  }

  const existingTickets = new Set(
    (data || [])
      .map((t: { ticket: string | null }) => t.ticket)
      .filter((t): t is string => Boolean(t))
  );

  return existingTickets;
}

/**
 * Delete all trades associated with an import batch (rollback on failure)
 */
export async function deleteTradesByBatchId(batchId: string, userId: string): Promise<number> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.deleteTradesByBatchId(batchId);
  }

  const { data, error } = await supabase
    .from('trades')
    .delete()
    .eq('import_batch_id', batchId)
    .eq('user_id', userId)
    .select('id');

  if (error) {
    throw new Error(`خطا در پاکسازی معاملات دسته ورود: ${error.message}`);
  }

  return data ? data.length : 0;
}
