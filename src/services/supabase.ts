import { createClient } from '@supabase/supabase-js';

const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
const envPublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = Boolean(
  envUrl &&
  envPublishableKey &&
  !envUrl.includes('placeholder') &&
  envUrl.startsWith('http')
);

const supabaseUrl = isSupabaseConfigured ? envUrl : 'https://placeholder.supabase.co';
const supabaseKey = isSupabaseConfigured ? envPublishableKey : 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: isSupabaseConfigured,
    persistSession: true,
    detectSessionInUrl: isSupabaseConfigured,
  },
});
