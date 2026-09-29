// ============================================================
// Guest Data Hook
// Provides mock data when in guest mode, real data otherwise
// ============================================================

import { useMemo } from 'react';
import { useGuest } from '../contexts/GuestContext';
import {
  MOCK_ACCOUNTS,
  MOCK_PHASES,
  MOCK_TRADES,
  MOCK_STRATEGIES,
  MOCK_SETUPS,
  MOCK_TAGS,
  MOCK_MISTAKES,
  MOCK_TRADE_JOURNALS,
} from '../data/mockData';
import type {
  TradingAccount,
  AccountPhase,
  Trade,
  Strategy,
  Setup,
  Tag,
  Mistake,
  TradeJournal,
} from '../types/database';

export function useGuestData() {
  const { isGuest } = useGuest();

  const accounts = useMemo<TradingAccount[]>(() => {
    return isGuest ? MOCK_ACCOUNTS : [];
  }, [isGuest]);

  const phases = useMemo<AccountPhase[]>(() => {
    return isGuest ? MOCK_PHASES : [];
  }, [isGuest]);

  const trades = useMemo<Trade[]>(() => {
    return isGuest ? MOCK_TRADES : [];
  }, [isGuest]);

  const strategies = useMemo<Strategy[]>(() => {
    return isGuest ? MOCK_STRATEGIES : [];
  }, [isGuest]);

  const setups = useMemo<Setup[]>(() => {
    return isGuest ? MOCK_SETUPS : [];
  }, [isGuest]);

  const tags = useMemo<Tag[]>(() => {
    return isGuest ? MOCK_TAGS : [];
  }, [isGuest]);

  const mistakes = useMemo<Mistake[]>(() => {
    return isGuest ? MOCK_MISTAKES : [];
  }, [isGuest]);

  const tradeJournals = useMemo<TradeJournal[]>(() => {
    return isGuest ? MOCK_TRADE_JOURNALS : [];
  }, [isGuest]);

  return {
    isGuest,
    accounts,
    phases,
    trades,
    strategies,
    setups,
    tags,
    mistakes,
    tradeJournals,
  };
}
