import { supabase, isSupabaseConfigured } from './supabase';
import { MockStorage } from './mockStorage';
import type { TradingAccount, TradingAccountInsert, TradingAccountUpdate } from '../types/database';

export async function getAccounts(userId: string): Promise<TradingAccount[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getAccounts(userId);
  }

  const { data, error } = await supabase
    .from('trading_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`خطا در دریافت حساب‌های معاملاتی: ${error.message}`);
  }

  return data || [];
}

export async function getAccount(accountId: string, userId: string): Promise<TradingAccount | null> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getAccount(accountId, userId);
  }

  const { data, error } = await supabase
    .from('trading_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`خطا در دریافت اطلاعات حساب: ${error.message}`);
  }

  return data;
}

export async function createAccount(input: TradingAccountInsert): Promise<TradingAccount> {
  if (!isSupabaseConfigured || input.user_id === 'guest-demo-user') {
    return MockStorage.createAccount(input);
  }

  const { data, error } = await supabase
    .from('trading_accounts')
    .insert(input)
    .select()
    .single();

  if (error) {
    throw new Error(`خطا در ایجاد حساب معاملاتی: ${error.message}`);
  }

  return data;
}

export async function updateAccount(
  accountId: string,
  userId: string,
  input: TradingAccountUpdate
): Promise<TradingAccount> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.updateAccount(accountId, input);
  }

  const { data, error } = await supabase
    .from('trading_accounts')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', accountId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`خطا در به‌روزرسانی حساب: ${error.message}`);
  }

  return data;
}

export async function deleteAccount(accountId: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.deleteAccount(accountId);
  }

  const { error } = await supabase
    .from('trading_accounts')
    .delete()
    .eq('id', accountId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`خطا در حذف حساب معاملاتی: ${error.message}`);
  }
}

export async function getAccountCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const list = await MockStorage.getAccounts(userId);
    return list.length;
  }

  const { count, error } = await supabase
    .from('trading_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    throw new Error(`خطا در شمارش حساب‌ها: ${error.message}`);
  }

  return count || 0;
}
