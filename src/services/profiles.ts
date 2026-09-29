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
    console.error('Error fetching profile:', error);
    return MockStorage.getProfile(userId);
  }

  return data;
}

export async function createProfile(input: ProfileInsert): Promise<Profile> {
  if (!isSupabaseConfigured || input.id === 'guest-demo-user') {
    return MockStorage.getProfile(input.id);
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error('Error creating profile:', error);
    return MockStorage.getProfile(input.id);
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
    console.error('Error updating profile:', error);
    return MockStorage.getProfile(userId);
  }

  return data;
}
