import { supabase, isSupabaseConfigured } from './supabase';
import { MockStorage } from './mockStorage';
import type { Setup, SetupInsert, SetupUpdate } from '../types/database';

export async function getSetups(userId: string, strategyId?: string): Promise<Setup[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const list = await MockStorage.getSetups();
    if (strategyId) return list.filter(s => s.strategy_id === strategyId);
    return list;
  }

  let query = supabase
    .from('setups')
    .select('*')
    .eq('user_id', userId)
    .order('name');

  if (strategyId) {
    query = query.eq('strategy_id', strategyId);
  }

  const { data, error } = await query;
  if (error) {
    const list = await MockStorage.getSetups();
    return list;
  }
  return data || [];
}

export async function createSetup(input: SetupInsert): Promise<Setup> {
  if (!isSupabaseConfigured || input.user_id === 'guest-demo-user') {
    return {
      id: `setup-${Date.now()}`,
      user_id: input.user_id,
      strategy_id: input.strategy_id,
      name: input.name,
      description: input.description || null,
      is_active: input.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const { data, error } = await supabase
    .from('setups')
    .insert(input)
    .select()
    .single();

  if (error) throw new Error('خطا در ایجاد ستاپ');
  return data;
}

export async function updateSetup(id: string, userId: string, input: SetupUpdate): Promise<Setup> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const list = await MockStorage.getSetups();
    const item = list.find(s => s.id === id);
    return { ...item, ...input, updated_at: new Date().toISOString() } as Setup;
  }

  const { data, error } = await supabase
    .from('setups')
    .update(input)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error('خطا در بروزرسانی ستاپ');
  return data;
}

export async function deleteSetup(id: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return;
  }

  const { error } = await supabase
    .from('setups')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error('خطا در حذف ستاپ');
}
