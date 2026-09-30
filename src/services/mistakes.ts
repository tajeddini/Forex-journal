import { supabase, isSupabaseConfigured } from './supabase';
import { MockStorage } from './mockStorage';
import type { Mistake, MistakeInsert, MistakeUpdate } from '../types/database';

export async function getMistakes(userId: string): Promise<Mistake[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getMistakes();
  }

  const { data, error } = await supabase
    .from('mistakes')
    .select('*')
    .eq('user_id', userId)
    .order('name');

  if (error) {
    throw new Error(`خطا در دریافت اشتباهات: ${error.message}`);
  }

  return data || [];
}

export async function createMistake(input: MistakeInsert): Promise<Mistake> {
  if (!isSupabaseConfigured || input.user_id === 'guest-demo-user') {
    return {
      id: `mistake-${Date.now()}`,
      user_id: input.user_id,
      name: input.name,
      description: input.description || null,
      is_active: input.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const { data, error } = await supabase
    .from('mistakes')
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(`خطا در ایجاد اشتباه: ${error.message}`);
  return data;
}

export async function updateMistake(id: string, userId: string, input: MistakeUpdate): Promise<Mistake> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const list = await MockStorage.getMistakes();
    const item = list.find(m => m.id === id);
    return { ...item, ...input, updated_at: new Date().toISOString() } as Mistake;
  }

  const { data, error } = await supabase
    .from('mistakes')
    .update(input)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(`خطا در بروزرسانی اشتباه: ${error.message}`);
  return data;
}

export async function deleteMistake(id: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return;
  }

  const { error } = await supabase
    .from('mistakes')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(`خطا در حذف اشتباه: ${error.message}`);
}

// Trade-Mistake relationships
export async function getTradeMistakes(tradeId: string, userId: string): Promise<{ mistake: Mistake; notes: string | null }[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const mistakes = await MockStorage.getMistakes();
    return mistakes.slice(0, 1).map(m => ({ mistake: m, notes: null }));
  }

  const { data, error } = await supabase
    .from('trade_mistakes')
    .select('notes, mistake:mistakes(*)')
    .eq('trade_id', tradeId);

  if (error) {
    throw new Error(`خطا در دریافت اشتباهات معامله: ${error.message}`);
  }

  return (data || []).map((dt: any) => ({ mistake: dt.mistake, notes: dt.notes }));
}

export async function addTradeMistake(tradeId: string, mistakeId: string, notes?: string, userId?: string): Promise<void> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') return;

  const { error } = await supabase
    .from('trade_mistakes')
    .insert({ trade_id: tradeId, mistake_id: mistakeId, notes: notes || null });

  if (error) {
    throw new Error(`خطا در ثبت اشتباه برای معامله: ${error.message}`);
  }
}

export async function removeTradeMistake(tradeId: string, mistakeId: string, userId?: string): Promise<void> {
  if (!isSupabaseConfigured || (userId && userId === 'guest-demo-user')) return;

  const { error } = await supabase
    .from('trade_mistakes')
    .delete()
    .eq('trade_id', tradeId)
    .eq('mistake_id', mistakeId);

  if (error) {
    throw new Error(`خطا در حذف اشتباه معامله: ${error.message}`);
  }
}

export async function setTradeMistakes(
  tradeId: string,
  mistakes: { id: string; notes?: string }[],
  userId?: string
): Promise<void> {
  if (!isSupabaseConfigured || (userId && userId === 'guest-demo-user')) return;

  const { error: deleteError } = await supabase
    .from('trade_mistakes')
    .delete()
    .eq('trade_id', tradeId);

  if (deleteError) {
    throw new Error(`خطا در پاکسازی اشتباهات قبلی معامله: ${deleteError.message}`);
  }

  if (mistakes.length === 0) return;

  const rows = mistakes.map(m => ({
    trade_id: tradeId,
    mistake_id: m.id,
    notes: m.notes || null,
  }));

  const { error: insertError } = await supabase
    .from('trade_mistakes')
    .insert(rows);

  if (insertError) {
    throw new Error(`خطا در ثبت اشتباهات معامله: ${insertError.message}`);
  }
}
