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

  if (error) return MockStorage.getTags();
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

  if (error) throw new Error('خطا در ایجاد تگ');
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

  if (error) throw new Error('خطا در بروزرسانی تگ');
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

  if (error) throw new Error('خطا در حذف تگ');
}

// Trade-Tag relationships
export async function getTradeTags(tradeId: string): Promise<Tag[]> {
  if (!isSupabaseConfigured) {
    const tags = await MockStorage.getTags();
    return tags.slice(0, 2);
  }

  const { data, error } = await supabase
    .from('trade_tags')
    .select('tag:tags(*)')
    .eq('trade_id', tradeId);

  if (error) {
    const tags = await MockStorage.getTags();
    return tags.slice(0, 2);
  }
  return (data || []).map((dt: any) => dt.tag);
}

export async function addTradeTag(tradeId: string, tagId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('trade_tags').insert({ trade_id: tradeId, tag_id: tagId });
}

export async function removeTradeTag(tradeId: string, tagId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('trade_tags').delete().eq('trade_id', tradeId).eq('tag_id', tagId);
}

export async function setTradeTags(tradeId: string, tagIds: string[]): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (!Array.isArray(tagIds)) return;

  const uniqueTagIds = [...new Set(tagIds)];
  const { data: currentTags } = await supabase
    .from('trade_tags')
    .select('tag_id')
    .eq('trade_id', tradeId);

  const currentTagIds = new Set(currentTags?.map(t => t.tag_id) || []);
  const newTagIds = new Set(uniqueTagIds);

  const toAdd = uniqueTagIds.filter(id => !currentTagIds.has(id));
  const toRemove = [...currentTagIds].filter(id => !newTagIds.has(id));

  if (toAdd.length > 0) {
    await supabase.from('trade_tags').insert(toAdd.map(tagId => ({ trade_id: tradeId, tag_id: tagId })));
  }
  if (toRemove.length > 0) {
    await supabase.from('trade_tags').delete().eq('trade_id', tradeId).in('tag_id', toRemove);
  }
}
