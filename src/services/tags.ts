import { supabase, isSupabaseConfigured } from './supabase';
import { MockStorage } from './mockStorage';
import type { Tag, TagInsert, TagUpdate } from '../types/database';

export async function getTags(userId: string): Promise<Tag[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getTags();
  }

  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', userId)
    .order('name');

  if (error) {
    throw new Error(`خطا در دریافت تگ‌ها: ${error.message}`);
  }

  return data || [];
}

export async function createTag(input: TagInsert): Promise<Tag> {
  if (!isSupabaseConfigured || input.user_id === 'guest-demo-user') {
    return {
      id: `tag-${Date.now()}`,
      user_id: input.user_id,
      name: input.name,
      color: input.color || '#3B82F6',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const { data, error } = await supabase
    .from('tags')
    .insert(input)
    .select()
    .single();

  if (error) {
    throw new Error(`خطا در ایجاد تگ: ${error.message}`);
  }

  return data;
}

export async function updateTag(id: string, userId: string, input: TagUpdate): Promise<Tag> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const list = await MockStorage.getTags();
    const item = list.find(t => t.id === id);
    return { ...item, ...input, updated_at: new Date().toISOString() } as Tag;
  }

  const { data, error } = await supabase
    .from('tags')
    .update(input)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`خطا در بروزرسانی تگ: ${error.message}`);
  }

  return data;
}

export async function deleteTag(id: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return;
  }

  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`خطا در حذف تگ: ${error.message}`);
  }
}

// Trade-Tag relationships
export async function getTradeTags(tradeId: string, userId: string): Promise<Tag[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const tags = await MockStorage.getTags();
    return tags.slice(0, 2);
  }

  const { data, error } = await supabase
    .from('trade_tags')
    .select('tag:tags(*)')
    .eq('trade_id', tradeId);

  if (error) {
    throw new Error(`خطا در دریافت تگ‌های معامله: ${error.message}`);
  }

  return (data || []).map((dt: any) => dt.tag);
}

export async function addTradeTag(tradeId: string, tagId: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') return;

  const { error } = await supabase
    .from('trade_tags')
    .insert({ trade_id: tradeId, tag_id: tagId });

  if (error) {
    throw new Error(`خطا در افزودن تگ به معامله: ${error.message}`);
  }
}

export async function removeTradeTag(tradeId: string, tagId: string, userId?: string): Promise<void> {
  if (!isSupabaseConfigured || (userId && userId === 'guest-demo-user')) return;

  const { error } = await supabase
    .from('trade_tags')
    .delete()
    .eq('trade_id', tradeId)
    .eq('tag_id', tagId);

  if (error) {
    throw new Error(`خطا در حذف تگ معامله: ${error.message}`);
  }
}

export async function setTradeTags(tradeId: string, tagIds: string[], userId?: string): Promise<void> {
  if (!isSupabaseConfigured || (userId && userId === 'guest-demo-user')) return;

  const { error: deleteError } = await supabase
    .from('trade_tags')
    .delete()
    .eq('trade_id', tradeId);

  if (deleteError) {
    throw new Error(`خطا در پاکسازی تگ‌های قبلی معامله: ${deleteError.message}`);
  }

  if (tagIds.length === 0) return;

  const rows = tagIds.map(tagId => ({ trade_id: tradeId, tag_id: tagId }));
  const { error: insertError } = await supabase
    .from('trade_tags')
    .insert(rows);

  if (insertError) {
    throw new Error(`خطا در ذخیره تگ‌های معامله: ${insertError.message}`);
  }
}
