import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { getProfile, createProfile } from '../services/profiles';
import type { Profile } from '../types/database';
import { getAuthErrorMessage } from '../utils/auth-errors';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const DEMO_USER: User = {
  id: 'guest-demo-user',
  app_metadata: {},
  user_metadata: { display_name: 'کاربر مهمان' },
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00Z',
  email: 'guest@demo.local',
  role: 'authenticated',
  updated_at: '2024-01-01T00:00:00Z',
} as User;

const DEMO_PROFILE: Profile = {
  id: 'guest-demo-user',
  display_name: 'کاربر مهمان',
  avatar_url: null,
  timezone: 'Asia/Tehran',
  default_currency: 'USD',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(!isSupabaseConfigured ? DEMO_USER : null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(!isSupabaseConfigured ? DEMO_PROFILE : null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  // Load profile for the current user
  const loadProfile = useCallback(async (userId: string) => {
    try {
      const existing = await getProfile(userId);
      if (existing) {
        setProfile(existing);
      } else {
        const newProfile = await createProfile({
          id: userId,
          display_name: user?.email?.split('@')[0] || 'کاربر',
        });
        setProfile(newProfile);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  }, [user]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          loadProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      // Local demo sign in
      const localUser: User = {
        ...DEMO_USER,
        id: `user-${Date.now()}`,
        email,
        user_metadata: { display_name: email.split('@')[0] },
      };
      setUser(localUser);
      setProfile({
        id: localUser.id,
        display_name: email.split('@')[0],
        avatar_url: null,
        timezone: 'Asia/Tehran',
        default_currency: 'USD',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { error: null };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: getAuthErrorMessage(error.message) };
    }
    return { error: null };
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    if (!isSupabaseConfigured) {
      const localUser: User = {
        ...DEMO_USER,
        id: `user-${Date.now()}`,
        email,
        user_metadata: { display_name: displayName || email.split('@')[0] },
      };
      setUser(localUser);
      setProfile({
        id: localUser.id,
        display_name: displayName || email.split('@')[0],
        avatar_url: null,
        timezone: 'Asia/Tehran',
        default_currency: 'USD',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { error: null };
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });
    if (error) {
      return { error: getAuthErrorMessage(error.message) };
    }
    return { error: null };
  };

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
