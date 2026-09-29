import { supabase, isSupabaseConfigured } from './supabase';
import { MockStorage } from './mockStorage';
import type { Strategy, StrategyInsert, StrategyUpdate } from '../types/database';

export async function getStrategies(userId: string): Promise<Strategy[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getStrategies();
  }

  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .eq('user_id', userId)
    .order('name');

  if (error) return MockStorage.getStrategies();
  return data || [];
}

export async function createStrategy(input: StrategyInsert): Promise<Strategy> {
  if (!isSupabaseConfigured || input.user_id === 'guest-demo-user') {
    return {
      id: `strat-${Date.now()}`,
      user_id: input.user_id,
      name: input.name,
      description: input.description || null,
      is_active: input.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const { data, error } = await supabase
    .from('strategies')
    .insert(input)
    .select()
    .single();

  if (error) throw new Error('خطا در ایجاد استراتژی');
  return data;
}

export async function updateStrategy(id: string, userId: string, input: StrategyUpdate): Promise<Strategy> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const list = await MockStorage.getStrategies();
    const item = list.find(s => s.id === id);
    return { ...item, ...input, updated_at: new Date().toISOString() } as Strategy;
  }

  const { data, error } = await supabase
    .from('strategies')
    .update(input)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error('خطا در بروزرسانی استراتژی');
  return data;
}

export async function deleteStrategy(id: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return;
  }

  const { error } = await supabase
    .from('strategies')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error('خطا در حذف استراتژی');
}
