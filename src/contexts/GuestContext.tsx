// ============================================================
// Guest Mode Context
// Manages guest/demo mode without database authentication
// ============================================================

import { createContext, useContext, useState, type ReactNode } from 'react';
import { isSupabaseConfigured } from '../services/supabase';

interface GuestContextType {
  isGuest: boolean;
  guestUser: {
    id: string;
    email: string;
    display_name: string;
  } | null;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
}

const GuestContext = createContext<GuestContextType | undefined>(undefined);

export function GuestProvider({ children }: { children: ReactNode }) {
  // If Supabase is unconfigured, automatically default to guest demo mode
  const [isGuest, setIsGuest] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('forex_is_guest') : null;
    if (saved !== null) return saved === 'true';
    return !isSupabaseConfigured;
  });

  const [guestUser, setGuestUser] = useState<GuestContextType['guestUser']>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('forex_is_guest') : null;
    const shouldBeGuest = saved !== null ? saved === 'true' : !isSupabaseConfigured;
    return shouldBeGuest
      ? {
          id: 'guest-demo-user',
          email: 'guest@demo.local',
          display_name: 'کاربر مهمان',
        }
      : null;
  });

  const enterGuestMode = () => {
    setIsGuest(true);
    setGuestUser({
      id: 'guest-demo-user',
      email: 'guest@demo.local',
      display_name: 'کاربر مهمان',
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem('forex_is_guest', 'true');
    }
  };

  const exitGuestMode = () => {
    setIsGuest(false);
    setGuestUser(null);
    if (typeof window !== 'undefined') {
      localStorage.setItem('forex_is_guest', 'false');
    }
  };

  return (
    <GuestContext.Provider value={{ isGuest, guestUser, enterGuestMode, exitGuestMode }}>
      {children}
    </GuestContext.Provider>
  );
}

export function useGuest() {
  const context = useContext(GuestContext);
  if (context === undefined) {
    throw new Error('useGuest must be used within a GuestProvider');
  }
  return context;
}
