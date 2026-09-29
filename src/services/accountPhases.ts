import { supabase, isSupabaseConfigured } from './supabase';
import { MockStorage } from './mockStorage';
import type { AccountPhase, AccountPhaseInsert, AccountPhaseUpdate } from '../types/database';

export async function getPhases(accountId: string, userId: string): Promise<AccountPhase[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getPhases(accountId);
  }

  // First verify the account belongs to the user
  const { data: account, error: accountError } = await supabase
    .from('trading_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (accountError || !account) {
    return MockStorage.getPhases(accountId);
  }

  const { data, error } = await supabase
    .from('account_phases')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching phases:', error);
    return MockStorage.getPhases(accountId);
  }

  return data || [];
}

export async function getPhase(phaseId: string, userId: string): Promise<AccountPhase | null> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const all = await MockStorage.getPhases();
    return all.find(p => p.id === phaseId) || null;
  }

  const { data, error } = await supabase
    .from('account_phases')
    .select('*, trading_accounts!inner(user_id)')
    .eq('id', phaseId)
    .eq('trading_accounts.user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching phase:', error);
    const all = await MockStorage.getPhases();
    return all.find(p => p.id === phaseId) || null;
  }

  return data;
}

export async function createPhase(input: AccountPhaseInsert, userId: string): Promise<AccountPhase> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const newPhase: AccountPhase = {
      id: `phase-${Date.now()}`,
      account_id: input.account_id,
      name: input.name,
      phase_type: input.phase_type,
      status: input.status,
      starting_balance: input.starting_balance,
      target_balance: input.target_balance || null,
      maximum_drawdown: input.maximum_drawdown || null,
      daily_drawdown_limit: input.daily_drawdown_limit || null,
      start_date: input.start_date || new Date().toISOString(),
      end_date: input.end_date || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return newPhase;
  }

  const { data, error } = await supabase
    .from('account_phases')
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error('Error creating phase:', error);
    throw new Error('خطا در ایجاد فاز');
  }

  return data;
}

export async function updatePhase(
  phaseId: string,
  userId: string,
  input: AccountPhaseUpdate
): Promise<AccountPhase> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const all = await MockStorage.getPhases();
    const p = all.find(x => x.id === phaseId);
    return { ...p, ...input, updated_at: new Date().toISOString() } as AccountPhase;
  }

  const { data, error } = await supabase
    .from('account_phases')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', phaseId)
    .select()
    .single();

  if (error) {
    console.error('Error updating phase:', error);
    throw new Error('خطا در بروزرسانی فاز');
  }

  return data;
}

export async function deletePhase(phaseId: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return;
  }

  const { error } = await supabase
    .from('account_phases')
    .delete()
    .eq('id', phaseId);

  if (error) {
    console.error('Error deleting phase:', error);
  }
}
