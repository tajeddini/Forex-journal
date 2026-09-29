import { createClient } from '@supabase/supabase-js';

// Check environment variables or local storage for user-provided credentials
const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('custom_supabase_url') : null;
const storedKey = typeof window !== 'undefined' ? localStorage.getItem('custom_supabase_anon_key') : null;

const envUrl = import.meta.env.VITE_SUPABASE_URL || storedUrl || '';
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || storedKey || '';

export const isSupabaseConfigured = Boolean(
  envUrl &&
  envAnonKey &&
  !envUrl.includes('placeholder') &&
  !envUrl.includes('your-project') &&
  envUrl.startsWith('http')
);

// Fallback dummy URL and anon key to prevent createClient crashes when unconfigured
const supabaseUrl = isSupabaseConfigured ? envUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey = isSupabaseConfigured ? envAnonKey : 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: isSupabaseConfigured,
    persistSession: true,
    detectSessionInUrl: isSupabaseConfigured,
  },
});
