// ============================================================
// Database Types — Forex Trading Journal
// These types mirror the PostgreSQL schema
// ============================================================

// --- Enums ---

export type AccountStatus = 'active' | 'passed' | 'failed' | 'funded' | 'archived';
export type PhaseStatus = 'active' | 'completed' | 'failed' | 'skipped';
export type PhaseType = 'challenge' | 'phase1' | 'phase2' | 'funded' | 'evaluation';

// --- Profile ---

export interface Profile {
  id: string; // matches auth.users.id
  display_name: string | null;
  avatar_url: string | null;
  timezone: string;
  default_currency: string;
  created_at: string;
  updated_at: string;
}

// --- Trading Account ---

export interface TradingAccount {
  id: string;
  user_id: string;
  name: string;
  broker: string | null;
  platform: string | null;
  account_number_label: string | null;
  currency: string;
  initial_balance: number;
  current_balance: number;
  status: AccountStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// --- Account Phase ---

export interface AccountPhase {
  id: string;
  account_id: string;
  name: string;
  phase_type: PhaseType;
  status: PhaseStatus;
  starting_balance: number;
  target_balance: number | null;
  maximum_drawdown: number | null;
  daily_drawdown_limit: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

// --- Trade Side ---
export type TradeSide = 'buy' | 'sell';

// --- Trade Source ---
export type TradeSource = 'mt4' | 'mt5' | 'manual';

// --- Import Batch Status ---
export type ImportBatchStatus = 'processing' | 'completed' | 'completed_with_warnings' | 'failed';

// --- Journal Types ---
export type RuleAdherence = 'followed' | 'partially_followed' | 'violated' | 'not_set';
export type JournalStatus = 'not_started' | 'in_progress' | 'completed';

// --- Strategy ---
export interface Strategy {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- Setup ---
export interface Setup {
  id: string;
  user_id: string;
  strategy_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- Tag ---
export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
}

// --- Mistake ---
export interface Mistake {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- Trade Journal ---
export interface TradeJournal {
  id: string;
  trade_id: string;
  user_id: string;
  
  // References
  strategy_id: string | null;
  setup_id: string | null;
  
  // Pre-Trade Plan
  market_context: string | null;
  market_bias: string | null;
  timeframe: string | null;
  important_levels: string | null;
  confluences: string | null;
  entry_reason: string | null;
  expected_scenario: string | null;
  invalidating_condition: string | null;
  planned_risk_amount: number | null;
  planned_risk_percentage: number | null;
  planned_rr: number | null;
  confidence: number | null;
  checklist: Record<string, boolean> | null;
  
  // Psychology
  emotion_before: string | null;
  emotion_during: string | null;
  emotion_after: string | null;
  
  // Execution
  execution_quality: number | null;
  rule_adherence: RuleAdherence;
  rule_adherence_notes: string | null;
  
  // Post-Trade Review
  what_went_well: string | null;
  what_went_wrong: string | null;
  lesson_learned: string | null;
  post_trade_notes: string | null;
  
  // Status
  status: JournalStatus;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// --- Trade with Journal ---
export interface TradeWithJournal extends Trade {
  journal?: TradeJournal | null;
  tags?: Tag[];
  mistakes?: { mistake: Mistake; notes: string | null }[];
}

// --- Trade Image ---
export interface TradeImage {
  id: string;
  trade_id: string;
  user_id: string;
  
  // Storage metadata
  storage_provider: string;
  storage_bucket: string;
  storage_path: string;
  
  // File metadata
  original_filename: string;
  original_size_bytes: number;
  processed_size_bytes: number;
  mime_type: string;
  width: number | null;
  height: number | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export type TradeImageInsert = Omit<TradeImage, 'id' | 'created_at' | 'updated_at'>;

// --- Trade ---
export interface Trade {
  id: string;
  user_id: string;
  account_id: string;
  phase_id: string | null;
  import_batch_id: string | null;
  
  // Identification
  ticket: string | null;
  position_id: string | null;
  
  // Trade details
  symbol: string;
  side: TradeSide;
  volume: number;
  
  // Entry
  entry_datetime: string;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  
  // Exit
  exit_datetime: string;
  exit_price: number;
  
  // Financial
  commission: number;
  swap: number;
  profit: number;
  
  // Metadata
  comment: string | null;
  magic_number: number | null;
  
  // Source
  source: TradeSource;
  source_file: string | null;
  
  // Duration
  duration_seconds: number | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// --- Import Batch ---
export interface ImportBatch {
  id: string;
  user_id: string;
  account_id: string;
  phase_id: string | null;
  source: TradeSource;
  file_name: string;
  file_size: number | null;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  imported_rows: number;
  status: ImportBatchStatus;
  error_message: string | null;
  parser_version: string | null;
  created_at: string;
  completed_at: string | null;
}

// --- Insert/Update types ---

export type ProfileInsert = Pick<Profile, 'id'> & Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;

export type TradingAccountInsert = Omit<TradingAccount, 'id' | 'created_at' | 'updated_at'>;
export type TradingAccountUpdate = Partial<Omit<TradingAccount, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export type AccountPhaseInsert = Omit<AccountPhase, 'id' | 'created_at' | 'updated_at'>;
export type AccountPhaseUpdate = Partial<Omit<AccountPhase, 'id' | 'account_id' | 'created_at' | 'updated_at'>>;

export type TradeInsert = Omit<Trade, 'id' | 'created_at' | 'updated_at' | 'duration_seconds'>;
export type TradeUpdate = Partial<Omit<Trade, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export interface ImportBatchInsert {
  user_id: string;
  account_id: string;
  phase_id: string | null;
  source: TradeSource;
  file_name: string;
  file_size: number | null;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  imported_rows: number;
  status: ImportBatchStatus;
  error_message?: string | null;
  parser_version?: string | null;
}
export type ImportBatchUpdate = Partial<Omit<ImportBatch, 'id' | 'user_id' | 'created_at'>>;

export type StrategyInsert = Omit<Strategy, 'id' | 'created_at' | 'updated_at'>;
export type StrategyUpdate = Partial<Omit<Strategy, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export type SetupInsert = Omit<Setup, 'id' | 'created_at' | 'updated_at'>;
export type SetupUpdate = Partial<Omit<Setup, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export type TagInsert = Omit<Tag, 'id' | 'created_at' | 'updated_at'>;
export type TagUpdate = Partial<Omit<Tag, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export type MistakeInsert = Omit<Mistake, 'id' | 'created_at' | 'updated_at'>;
export type MistakeUpdate = Partial<Omit<Mistake, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export type TradeJournalInsert = Omit<TradeJournal, 'id' | 'created_at' | 'updated_at'>;
export type TradeJournalUpdate = Partial<Omit<TradeJournal, 'id' | 'trade_id' | 'user_id' | 'created_at' | 'updated_at'>>;

// --- Constants ---

export const ACCOUNT_STATUSES: { value: AccountStatus; label: string }[] = [
  { value: 'active', label: 'فعال' },
  { value: 'passed', label: 'قبول شده' },
  { value: 'failed', label: 'ناموفق' },
  { value: 'funded', label: 'تأمین سرمایه' },
  { value: 'archived', label: 'آرشیو شده' },
];

export const PHASE_STATUSES: { value: PhaseStatus; label: string }[] = [
  { value: 'active', label: 'فعال' },
  { value: 'completed', label: 'تکمیل شده' },
  { value: 'failed', label: 'ناموفق' },
  { value: 'skipped', label: 'رد شده' },
];

export const PHASE_TYPES: { value: PhaseType; label: string }[] = [
  { value: 'challenge', label: 'چالش' },
  { value: 'phase1', label: 'فاز ۱' },
  { value: 'phase2', label: 'فاز ۲' },
  { value: 'funded', label: 'تأمین سرمایه' },
  { value: 'evaluation', label: 'ارزیابی' },
];

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];

export const TIMEZONES = [
  'Asia/Tehran',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'UTC',
];

export const TRADE_SIDES: { value: TradeSide; label: string }[] = [
  { value: 'buy', label: 'خرید' },
  { value: 'sell', label: 'فروش' },
];

export const TRADE_SOURCES: { value: TradeSource; label: string }[] = [
  { value: 'mt4', label: 'MT4' },
  { value: 'mt5', label: 'MT5' },
  { value: 'manual', label: 'دستی' },
];

export const IMPORT_BATCH_STATUSES: { value: ImportBatchStatus; label: string }[] = [
  { value: 'processing', label: 'در حال پردازش' },
  { value: 'completed', label: 'تکمیل شده' },
  { value: 'completed_with_warnings', label: 'تکمیل شده با هشدار' },
  { value: 'failed', label: 'ناموفق' },
];

export const RULE_ADHERENCE_OPTIONS: { value: RuleAdherence; label: string }[] = [
  { value: 'not_set', label: 'تنظیم نشده' },
  { value: 'followed', label: 'رعایت شده' },
  { value: 'partially_followed', label: 'تا حدی رعایت شده' },
  { value: 'violated', label: 'نقض شده' },
];

export const JOURNAL_STATUSES: { value: JournalStatus; label: string }[] = [
  { value: 'not_started', label: 'شروع نشده' },
  { value: 'in_progress', label: 'در حال تکمیل' },
  { value: 'completed', label: 'تکمیل شده' },
];

export const EMOTIONS = [
  'آرام',
  'مطمئن',
  'ترسیده',
  'طمع‌کار',
  'مضطرب',
  'کلافه',
  'هیجان‌زده',
  'FOMO',
  'انتقام‌جو',
  'خنثی',
];

export const DEFAULT_CHECKLIST = [
  { key: 'strategy_valid', label: 'استراتژی معتبر است؟' },
  { key: 'setup_confirmed', label: 'ستاپ تأیید شده؟' },
  { key: 'market_context_checked', label: 'کانتکست بازار بررسی شده؟' },
  { key: 'risk_within_limit', label: 'ریسک در محدوده مجاز؟' },
  { key: 'stop_loss_defined', label: 'حد ضرر مشخص شده؟' },
  { key: 'take_profit_defined', label: 'حد سود مشخص شده؟' },
  { key: 'entry_confirmed', label: 'شرط ورود تأیید شده؟' },
  { key: 'emotional_state_ok', label: 'وضعیت روحی مناسب؟' },
];

// --- Review Types ---
export type ReviewType = 'daily' | 'weekly' | 'monthly';

export interface TradingReview {
  id: string;
  user_id: string;
  review_type: ReviewType;
  review_date: string;
  period_start: string;
  period_end: string;
  account_id: string | null;
  phase_id: string | null;
  
  // Auto-calculated statistics
  total_trades: number;
  net_pnl: number;
  win_rate: number | null;
  profit_factor: number | null;
  expectancy: number | null;
  max_drawdown: number | null;
  avg_duration: number | null;
  
  // Review content
  summary: string | null;
  what_went_well: string | null;
  what_went_wrong: string | null;
  main_lesson: string | null;
  main_mistake: string | null;
  psychology_notes: string | null;
  rule_adherence_notes: string | null;
  improvement_plan: string | null;
  next_period_plan: string | null;
  
  created_at: string;
  updated_at: string;
}

export type TradingReviewInsert = Omit<TradingReview, 'id' | 'created_at' | 'updated_at'>;
export type TradingReviewUpdate = Partial<Omit<TradingReview, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export const REVIEW_TYPES: { value: ReviewType; label: string }[] = [
  { value: 'daily', label: 'روزانه' },
  { value: 'weekly', label: 'هفتگی' },
  { value: 'monthly', label: 'ماهانه' },
];

// --- Dashboard Layout Types ---
export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
}

export interface DashboardLayout {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  layout_config: DashboardWidget[];
  created_at: string;
  updated_at: string;
}

export type DashboardLayoutInsert = Omit<DashboardLayout, 'id' | 'created_at' | 'updated_at'>;
export type DashboardLayoutUpdate = Partial<Omit<DashboardLayout, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
