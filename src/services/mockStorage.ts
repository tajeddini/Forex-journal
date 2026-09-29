// ============================================================
// Local / Mock Storage Provider
// Used when Supabase is unconfigured or in Guest Demo mode
// ============================================================

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
import { DEFAULT_DASHBOARD_WIDGETS } from './dashboard';
import type {
  TradingAccount,
  AccountPhase,
  Trade,
  Strategy,
  Setup,
  Tag,
  Mistake,
  TradeJournal,
  DashboardLayout,
  Profile,
  TradeImage,
} from '../types/database';

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(`forex_app_${key}`);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`forex_app_${key}`, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

// In-memory or persisted collections
let accounts: TradingAccount[] = loadFromStorage('accounts', [...MOCK_ACCOUNTS]);
let phases: AccountPhase[] = loadFromStorage('phases', [...MOCK_PHASES]);
let trades: Trade[] = loadFromStorage('trades', [...MOCK_TRADES]);
let strategies: Strategy[] = loadFromStorage('strategies', [...MOCK_STRATEGIES]);
let setups: Setup[] = loadFromStorage('setups', [...MOCK_SETUPS]);
let tags: Tag[] = loadFromStorage('tags', [...MOCK_TAGS]);
let mistakes: Mistake[] = loadFromStorage('mistakes', [...MOCK_MISTAKES]);
let tradeJournals: TradeJournal[] = loadFromStorage('trade_journals', [...MOCK_TRADE_JOURNALS]);
let tradeImages: TradeImage[] = loadFromStorage('trade_images', []);

export const MockStorage = {
  // Profiles
  getProfile: (userId: string): Profile => ({
    id: userId,
    display_name: 'کاربر مهمان',
    avatar_url: null,
    timezone: 'Asia/Tehran',
    default_currency: 'USD',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }),

  // Accounts
  getAccounts: async (_userId: string): Promise<TradingAccount[]> => {
    return [...accounts];
  },
  getAccount: async (id: string, _userId: string): Promise<TradingAccount | null> => {
    return accounts.find((a) => a.id === id) || null;
  },
  createAccount: async (input: Partial<TradingAccount>): Promise<TradingAccount> => {
    const newAccount: TradingAccount = {
      id: `acc-${Date.now()}`,
      user_id: input.user_id || 'guest-demo-user',
      name: input.name || 'حساب جدید',
      broker: input.broker || null,
      platform: input.platform || null,
      account_number_label: input.account_number_label || null,
      currency: input.currency || 'USD',
      initial_balance: input.initial_balance || 10000,
      current_balance: input.current_balance || input.initial_balance || 10000,
      status: input.status || 'active',
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    accounts = [newAccount, ...accounts];
    saveToStorage('accounts', accounts);
    return newAccount;
  },
  updateAccount: async (id: string, updates: Partial<TradingAccount>): Promise<TradingAccount> => {
    accounts = accounts.map((a) => (a.id === id ? { ...a, ...updates, updated_at: new Date().toISOString() } : a));
    saveToStorage('accounts', accounts);
    const updated = accounts.find((a) => a.id === id);
    if (!updated) throw new Error('Account not found');
    return updated;
  },
  deleteAccount: async (id: string): Promise<void> => {
    accounts = accounts.filter((a) => a.id !== id);
    saveToStorage('accounts', accounts);
  },

  // Trades
  getTrades: async (filters?: { accountId?: string | null; dateFrom?: string | null; dateTo?: string | null }): Promise<Trade[]> => {
    let result = [...trades];
    if (filters?.accountId) {
      result = result.filter((t) => t.account_id === filters.accountId);
    }
    if (filters?.dateFrom) {
      result = result.filter((t) => new Date(t.exit_datetime) >= new Date(filters.dateFrom!));
    }
    if (filters?.dateTo) {
      result = result.filter((t) => new Date(t.exit_datetime) <= new Date(filters.dateTo!));
    }
    return result.sort((a, b) => new Date(a.exit_datetime).getTime() - new Date(b.exit_datetime).getTime());
  },
  getTrade: async (id: string): Promise<Trade | null> => {
    return trades.find((t) => t.id === id) || null;
  },
  createTrade: async (input: Partial<Trade>): Promise<Trade> => {
    const newTrade: Trade = {
      id: `trade-${Date.now()}`,
      account_id: input.account_id || accounts[0]?.id || 'mock-account-1',
      phase_id: input.phase_id || null,
      import_batch_id: input.import_batch_id || null,
      user_id: input.user_id || 'guest-demo-user',
      ticket: input.ticket || null,
      position_id: input.position_id || null,
      symbol: input.symbol || 'EURUSD',
      side: input.side || 'buy',
      volume: input.volume || 1.0,
      entry_datetime: input.entry_datetime || new Date().toISOString(),
      exit_datetime: input.exit_datetime || new Date().toISOString(),
      entry_price: input.entry_price || 1.085,
      exit_price: input.exit_price || 1.09,
      stop_loss: input.stop_loss || null,
      take_profit: input.take_profit || null,
      profit: input.profit || 500,
      commission: input.commission || 0,
      swap: input.swap || 0,
      comment: input.comment || null,
      magic_number: input.magic_number || null,
      source: input.source || 'manual',
      source_file: input.source_file || null,
      duration_seconds: input.duration_seconds || 3600,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    trades = [newTrade, ...trades];
    saveToStorage('trades', trades);
    return newTrade;
  },
  updateTrade: async (id: string, updates: Partial<Trade>): Promise<Trade> => {
    trades = trades.map((t) => (t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t));
    saveToStorage('trades', trades);
    const updated = trades.find((t) => t.id === id);
    if (!updated) throw new Error('Trade not found');
    return updated;
  },
  deleteTrade: async (id: string): Promise<void> => {
    trades = trades.filter((t) => t.id !== id);
    saveToStorage('trades', trades);
  },

  // Phases
  getPhases: async (accountId?: string): Promise<AccountPhase[]> => {
    if (accountId) return phases.filter((p) => p.account_id === accountId);
    return [...phases];
  },

  // Strategies, Setups, Tags, Mistakes
  getStrategies: async (): Promise<Strategy[]> => [...strategies],
  getSetups: async (): Promise<Setup[]> => [...setups],
  getTags: async (): Promise<Tag[]> => [...tags],
  getMistakes: async (): Promise<Mistake[]> => [...mistakes],

  // Trade Journals
  getTradeJournals: async (): Promise<TradeJournal[]> => [...tradeJournals],

  // Trade Images
  getTradeImages: async (tradeId: string): Promise<TradeImage[]> => {
    return tradeImages.filter((img) => img.trade_id === tradeId);
  },
  saveTradeImage: async (image: TradeImage): Promise<TradeImage> => {
    tradeImages = [image, ...tradeImages];
    saveToStorage('trade_images', tradeImages);
    return image;
  },
  deleteTradeImage: async (imageId: string): Promise<void> => {
    tradeImages = tradeImages.filter((img) => img.id !== imageId);
    saveToStorage('trade_images', tradeImages);
  },

  // Dashboard Layout
  getDefaultDashboardLayout: async (userId: string): Promise<DashboardLayout> => {
    const saved = loadFromStorage<DashboardLayout | null>('dashboard_layout', null);
    if (saved) return saved;
    return {
      id: 'default-mock-layout',
      user_id: userId,
      name: 'پیش‌فرض',
      is_default: true,
      layout_config: DEFAULT_DASHBOARD_WIDGETS,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  },
  updateDashboardLayout: async (layout: DashboardLayout): Promise<DashboardLayout> => {
    saveToStorage('dashboard_layout', layout);
    return layout;
  },
};
