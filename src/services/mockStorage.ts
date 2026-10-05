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
  TradingReview,
  TradingReviewInsert,
  TradingReviewUpdate,
  ReviewType,
  ImportBatch,
  ImportBatchInsert,
  ImportBatchUpdate,
  TradeJournalInsert,
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
let reviews: TradingReview[] = loadFromStorage('reviews', [
  {
    id: 'mock-review-1',
    user_id: 'guest-demo-user',
    review_type: 'weekly',
    review_date: new Date().toISOString().split('T')[0],
    period_start: new Date(Date.now() - 7 * 86400000).toISOString(),
    period_end: new Date().toISOString(),
    account_id: 'mock-account-1',
    phase_id: null,
    total_trades: 4,
    net_pnl: 1100,
    win_rate: 75,
    profit_factor: 2.4,
    expectancy: 275,
    max_drawdown: 350,
    avg_duration: 3600,
    summary: 'هفته معاملاتی بسیار منظم با پایبندی به استراتژی ICT',
    what_went_well: 'صبر برای تاییدیه FVG و مدیریت ریسک ۱ درصدی',
    what_went_wrong: 'ورود زودهنگام در روز سه‌شنبه پیش از سشن لندن',
    main_lesson: 'همیشه منتظر شکل‌گیری نقدینگی در سشن نیویورک بمانید',
    main_mistake: 'FOMO ورود سریع در طلا',
    psychology_notes: 'آرامش و تمرکز در طول هفته حفظ شد',
    rule_adherence_notes: '۹۰ درصد پایبندی به برنامه معاملاتی',
    improvement_plan: 'اجتناب از ورود در تایم فریم‌های پایین قبل از اخبار مهم',
    next_period_plan: 'تمرکز بر روی سشن نیویورک و جفت‌ارزهای ماژور',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
]);
let importBatches: ImportBatch[] = loadFromStorage('import_batches', []);

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
      volume: typeof input.volume === 'number' ? input.volume : 1.0,
      entry_datetime: input.entry_datetime || new Date().toISOString(),
      exit_datetime: input.exit_datetime || new Date().toISOString(),
      entry_price: typeof input.entry_price === 'number' ? input.entry_price : 1.085,
      exit_price: typeof input.exit_price === 'number' ? input.exit_price : 1.09,
      stop_loss: input.stop_loss !== undefined ? input.stop_loss : null,
      take_profit: input.take_profit !== undefined ? input.take_profit : null,
      profit: typeof input.profit === 'number' ? input.profit : 0,
      commission: typeof input.commission === 'number' ? input.commission : 0,
      swap: typeof input.swap === 'number' ? input.swap : 0,
      comment: input.comment ?? null,
      magic_number: input.magic_number ?? null,
      source: input.source || 'manual',
      source_file: input.source_file ?? null,
      duration_seconds: (input as any).duration_seconds ?? (
        input.entry_datetime && input.exit_datetime
          ? Math.max(0, Math.floor((new Date(input.exit_datetime).getTime() - new Date(input.entry_datetime).getTime()) / 1000))
          : 3600
      ),
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
  deleteTradesByBatchId: async (batchId: string): Promise<number> => {
    const initialLen = trades.length;
    trades = trades.filter((t) => t.import_batch_id !== batchId);
    saveToStorage('trades', trades);
    return initialLen - trades.length;
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
  saveTradeJournal: async (input: TradeJournalInsert): Promise<TradeJournal> => {
    const existingIndex = tradeJournals.findIndex((j) => j.trade_id === input.trade_id);
    let saved: TradeJournal;
    if (existingIndex >= 0) {
      saved = {
        ...tradeJournals[existingIndex],
        ...input,
        updated_at: new Date().toISOString(),
      };
      tradeJournals[existingIndex] = saved;
    } else {
      saved = {
        id: `journal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        trade_id: input.trade_id,
        user_id: input.user_id || 'guest-demo-user',
        strategy_id: input.strategy_id || null,
        setup_id: input.setup_id || null,
        market_context: input.market_context || null,
        market_bias: input.market_bias || null,
        timeframe: input.timeframe || null,
        important_levels: input.important_levels || null,
        confluences: input.confluences || null,
        entry_reason: input.entry_reason || null,
        expected_scenario: input.expected_scenario || null,
        invalidating_condition: input.invalidating_condition || null,
        planned_risk_amount: input.planned_risk_amount ?? null,
        planned_risk_percentage: input.planned_risk_percentage ?? null,
        planned_rr: input.planned_rr ?? null,
        confidence: input.confidence ?? null,
        checklist: input.checklist || null,
        emotion_before: input.emotion_before || null,
        emotion_during: input.emotion_during || null,
        emotion_after: input.emotion_after || null,
        execution_quality: input.execution_quality ?? null,
        rule_adherence: input.rule_adherence || 'not_set',
        rule_adherence_notes: input.rule_adherence_notes || null,
        what_went_well: input.what_went_well || null,
        what_went_wrong: input.what_went_wrong || null,
        lesson_learned: input.lesson_learned || null,
        post_trade_notes: input.post_trade_notes || null,
        status: input.status || 'not_started',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      tradeJournals.push(saved);
    }
    saveToStorage('trade_journals', tradeJournals);
    return saved;
  },

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

  // Reviews
  getReviews: async (userId: string, type?: ReviewType): Promise<TradingReview[]> => {
    let result = reviews.filter((r) => r.user_id === userId || userId === 'guest-demo-user');
    if (type) {
      result = result.filter((r) => r.review_type === type);
    }
    return result.sort((a, b) => new Date(b.review_date).getTime() - new Date(a.review_date).getTime());
  },
  getReview: async (reviewId: string, userId: string): Promise<TradingReview | null> => {
    return reviews.find((r) => r.id === reviewId && (r.user_id === userId || userId === 'guest-demo-user')) || null;
  },
  createReview: async (input: TradingReviewInsert): Promise<TradingReview> => {
    const newReview: TradingReview = {
      id: `rev-${Date.now()}`,
      user_id: input.user_id || 'guest-demo-user',
      review_type: input.review_type || 'daily',
      review_date: input.review_date || new Date().toISOString().split('T')[0],
      period_start: input.period_start || new Date().toISOString(),
      period_end: input.period_end || new Date().toISOString(),
      account_id: input.account_id || null,
      phase_id: input.phase_id || null,
      total_trades: input.total_trades || 0,
      net_pnl: input.net_pnl || 0,
      win_rate: input.win_rate ?? null,
      profit_factor: input.profit_factor ?? null,
      expectancy: input.expectancy ?? null,
      max_drawdown: input.max_drawdown ?? null,
      avg_duration: input.avg_duration ?? null,
      summary: input.summary ?? null,
      what_went_well: input.what_went_well ?? null,
      what_went_wrong: input.what_went_wrong ?? null,
      main_lesson: input.main_lesson ?? null,
      main_mistake: input.main_mistake ?? null,
      psychology_notes: input.psychology_notes ?? null,
      rule_adherence_notes: input.rule_adherence_notes ?? null,
      improvement_plan: input.improvement_plan ?? null,
      next_period_plan: input.next_period_plan ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    reviews = [newReview, ...reviews];
    saveToStorage('reviews', reviews);
    return newReview;
  },
  updateReview: async (reviewId: string, updates: TradingReviewUpdate): Promise<TradingReview> => {
    reviews = reviews.map((r) => (r.id === reviewId ? { ...r, ...updates, updated_at: new Date().toISOString() } : r));
    saveToStorage('reviews', reviews);
    const updated = reviews.find((r) => r.id === reviewId);
    if (!updated) throw new Error('Review not found');
    return updated;
  },
  deleteReview: async (reviewId: string): Promise<void> => {
    reviews = reviews.filter((r) => r.id !== reviewId);
    saveToStorage('reviews', reviews);
  },

  // Import Batches
  getImportBatches: async (userId: string): Promise<ImportBatch[]> => {
    return importBatches.filter((b) => b.user_id === userId || userId === 'guest-demo-user');
  },
  getImportBatch: async (batchId: string, userId: string): Promise<ImportBatch | null> => {
    return importBatches.find((b) => b.id === batchId && (b.user_id === userId || userId === 'guest-demo-user')) || null;
  },
  createImportBatch: async (input: ImportBatchInsert): Promise<ImportBatch> => {
    const newBatch: ImportBatch = {
      id: `batch-${Date.now()}`,
      user_id: input.user_id || 'guest-demo-user',
      account_id: input.account_id,
      phase_id: input.phase_id || null,
      source: input.source || 'csv',
      file_name: input.file_name,
      file_size: input.file_size || null,
      total_rows: input.total_rows || 0,
      valid_rows: input.valid_rows || 0,
      invalid_rows: input.invalid_rows || 0,
      duplicate_rows: input.duplicate_rows || 0,
      imported_rows: input.imported_rows || 0,
      status: input.status || 'completed',
      error_message: input.error_message || null,
      parser_version: input.parser_version || null,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };
    importBatches = [newBatch, ...importBatches];
    saveToStorage('import_batches', importBatches);
    return newBatch;
  },
  updateImportBatch: async (batchId: string, updates: ImportBatchUpdate): Promise<ImportBatch> => {
    importBatches = importBatches.map((b) => (b.id === batchId ? { ...b, ...updates } : b));
    saveToStorage('import_batches', importBatches);
    const updated = importBatches.find((b) => b.id === batchId);
    if (!updated) throw new Error('Import batch not found');
    return updated;
  },

  executeAtomicTradeImport: async ({
    batchId,
    userId,
    accountId,
    phaseId,
    trades: newTrades,
    finalStatus = 'completed',
  }: {
    batchId: string;
    userId: string;
    accountId: string;
    phaseId?: string | null;
    trades: Partial<Trade>[];
    finalStatus?: 'completed' | 'completed_with_warnings';
  }): Promise<{ insertedCount: number; batchId: string }> => {
    // 1. Validate Batch
    const batch = importBatches.find(b => b.id === batchId && (b.user_id === userId || userId === 'guest-demo-user'));
    if (!batch) {
      throw new Error('دسته ورود معتبر نیست یا متعلق به شما نمی‌باشد');
    }
    if (batch.status !== 'processing') {
      throw new Error(`دسته ورود در وضعیت معتبر برای ثبت اطلاعات نیست (وضعیت فعلی: ${batch.status})`);
    }

    // 2. Validate Account
    const account = accounts.find(a => a.id === accountId && (a.user_id === userId || userId === 'guest-demo-user'));
    if (!account) {
      throw new Error('حساب معاملاتی معتبر نیست یا متعلق به شما نمی‌باشد');
    }

    // 3. Validate Phase ownership
    if (phaseId) {
      const phase = phases.find(p => p.id === phaseId && p.account_id === accountId);
      if (!phase) {
        throw new Error('فاز معاملاتی انتخاب شده متعلق به حساب معاملاتی مورد نظر نیست');
      }
    }

    // 4. Validate trades & idempotency against existing trades in this account
    const existingAccountTrades = trades.filter(t => t.account_id === accountId);
    const existingMT4Tickets = new Set(existingAccountTrades.filter(t => t.source === 'mt4' && t.ticket).map(t => t.ticket!));
    const existingMT5Positions = new Set(existingAccountTrades.filter(t => t.source === 'mt5' && t.position_id).map(t => t.position_id!));

    const inserted: Trade[] = [];
    for (const t of newTrades) {
      if (!t.symbol || !t.symbol.trim()) {
        throw new Error('نماد معامله نمی‌تواند خالی باشد');
      }
      if (!t.side || !['buy', 'sell'].includes(t.side)) {
        throw new Error('جهت معامله الزامی است');
      }
      if (!t.volume || t.volume <= 0) {
        throw new Error('حجم معامله باید مقداری مثبت باشد');
      }
      if (!t.entry_datetime) {
        throw new Error('زمان ورود معامله الزامی است');
      }

      // Check trade-level phase
      if (t.phase_id) {
        const ph = phases.find(p => p.id === t.phase_id && p.account_id === accountId);
        if (!ph) {
          throw new Error(`فاز معاملاتی انتخاب شده (${t.phase_id}) متعلق به حساب معاملاتی مورد نظر نیست`);
        }
      }

      // Check unique constraint violation
      if (t.source === 'mt4' && t.ticket && existingMT4Tickets.has(t.ticket)) {
        throw new Error(`معامله تکراری MT4 با شماره تیکت ${t.ticket} در این حساب وجود دارد`);
      }
      if (t.source === 'mt5' && t.position_id && existingMT5Positions.has(t.position_id)) {
        throw new Error(`معامله تکراری MT5 با شناسه پوزیشن ${t.position_id} در این حساب وجود دارد`);
      }

      if (t.source === 'mt4' && t.ticket) existingMT4Tickets.add(t.ticket);
      if (t.source === 'mt5' && t.position_id) existingMT5Positions.add(t.position_id);

      const durSec = t.entry_datetime && t.exit_datetime
        ? Math.max(0, Math.round((new Date(t.exit_datetime).getTime() - new Date(t.entry_datetime).getTime()) / 1000))
        : 0;

      inserted.push({
        id: `trade-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        user_id: userId,
        account_id: accountId,
        phase_id: t.phase_id || phaseId || null,
        import_batch_id: batchId,
        ticket: t.ticket || null,
        position_id: t.position_id || null,
        symbol: t.symbol.trim(),
        side: t.side,
        volume: t.volume,
        entry_datetime: t.entry_datetime,
        entry_price: t.entry_price || 0,
        stop_loss: t.stop_loss || null,
        take_profit: t.take_profit || null,
        exit_datetime: t.exit_datetime || t.entry_datetime,
        exit_price: t.exit_price || 0,
        commission: t.commission || 0,
        swap: t.swap || 0,
        profit: t.profit || 0,
        comment: t.comment || null,
        magic_number: t.magic_number || null,
        source: t.source || 'mt5',
        source_file: t.source_file || null,
        duration_seconds: durSec,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Atomic commit: only commit trades and update batch if ALL trades passed
    trades = [...trades, ...inserted];
    saveToStorage('trades', trades);

    importBatches = importBatches.map(b =>
      b.id === batchId
        ? {
            ...b,
            imported_rows: inserted.length,
            status: finalStatus,
            completed_at: new Date().toISOString(),
          }
        : b
    );
    saveToStorage('import_batches', importBatches);

    return { insertedCount: inserted.length, batchId };
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
