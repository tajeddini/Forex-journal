import { createClient } from '@supabase/supabase-js';

const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
const envPublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = Boolean(
  import.meta.env.MODE !== 'test' &&
  envUrl &&
  envPublishableKey &&
  !envUrl.includes('placeholder') &&
  envUrl.startsWith('http')
);

const supabaseUrl = isSupabaseConfigured ? envUrl : 'https://placeholder.supabase.co';
const supabaseKey = isSupabaseConfigured ? envPublishableKey : 'placeholder-anon-key';

// Provide safe WebSocket stub in Node.js test environments lacking native WebSocket
if (typeof globalThis !== 'undefined' && typeof (globalThis as any).WebSocket === 'undefined') {
  class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;
    readyState = 3;
    addEventListener() {}
    removeEventListener() {}
    close() {}
    send() {}
  }
  (globalThis as any).WebSocket = MockWebSocket;
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: isSupabaseConfigured,
    persistSession: true,
    detectSessionInUrl: isSupabaseConfigured,
  },
});
