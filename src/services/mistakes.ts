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

  if (error) return MockStorage.getMistakes();
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

  if (error) throw new Error('خطا در ایجاد اشتباه');
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

  if (error) throw new Error('خطا در بروزرسانی اشتباه');
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

  if (error) throw new Error('خطا در حذف اشتباه');
}

// Trade-Mistake relationships
export async function getTradeMistakes(tradeId: string): Promise<{ mistake: Mistake; notes: string | null }[]> {
  if (!isSupabaseConfigured) {
    const mistakes = await MockStorage.getMistakes();
    return mistakes.slice(0, 1).map(m => ({ mistake: m, notes: null }));
  }

  const { data, error } = await supabase
    .from('trade_mistakes')
    .select('notes, mistake:mistakes(*)')
    .eq('trade_id', tradeId);

  if (error) {
    const mistakes = await MockStorage.getMistakes();
    return mistakes.slice(0, 1).map(m => ({ mistake: m, notes: null }));
  }
  return (data || []).map((dt: any) => ({ mistake: dt.mistake, notes: dt.notes }));
}

export async function addTradeMistake(tradeId: string, mistakeId: string, notes?: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('trade_mistakes').insert({ trade_id: tradeId, mistake_id: mistakeId, notes: notes || null });
}

export async function removeTradeMistake(tradeId: string, mistakeId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('trade_mistakes').delete().eq('trade_id', tradeId).eq('mistake_id', mistakeId);
}

export async function setTradeMistakes(tradeId: string, mistakeIds: { id: string; notes?: string }[]): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (!Array.isArray(mistakeIds)) return;

  const uniqueMistakes = mistakeIds.reduce((acc, m) => {
    if (!acc.find(x => x.id === m.id)) {
      acc.push(m);
    }
    return acc;
  }, [] as { id: string; notes?: string }[]);

  const { data: currentMistakes } = await supabase
    .from('trade_mistakes')
    .select('mistake_id')
    .eq('trade_id', tradeId);

  const currentMistakeIds = new Set(currentMistakes?.map(m => m.mistake_id) || []);
  const newMistakeIds = new Set(uniqueMistakes.map(m => m.id));

  const toAdd = uniqueMistakes.filter(m => !currentMistakeIds.has(m.id));
  const toRemove = [...currentMistakeIds].filter(id => !newMistakeIds.has(id));

  if (toAdd.length > 0) {
    await supabase.from('trade_mistakes').insert(toAdd.map(m => ({ trade_id: tradeId, mistake_id: m.id, notes: m.notes || null })));
  }
  if (toRemove.length > 0) {
    await supabase.from('trade_mistakes').delete().eq('trade_id', tradeId).in('mistake_id', toRemove);
  }
}
