import { supabase, isSupabaseConfigured } from './supabase';
import { MockStorage } from './mockStorage';
import type { Profile, ProfileInsert, ProfileUpdate } from '../types/database';

export async function getProfile(userId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getProfile(userId);
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`خطا در دریافت پروفایل کاربری: ${error.message}`);
  }

  return data;
}

export async function createProfile(input: ProfileInsert): Promise<Profile> {
  if (!isSupabaseConfigured || input.id === 'guest-demo-user') {
    return MockStorage.getProfile(input.id);
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(input, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    throw new Error(`خطا در ایجاد پروفایل کاربری: ${error.message}`);
  }

  return data;
}

export async function updateProfile(userId: string, input: ProfileUpdate): Promise<Profile> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getProfile(userId);
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`خطا در به‌روزرسانی پروفایل کاربری: ${error.message}`);
  }

  return data;
}
