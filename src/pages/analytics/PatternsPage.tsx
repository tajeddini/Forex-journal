// ============================================================
// Phase 15 — Patterns & Advanced Trading Insights Page
// Discovers evidence-based statistical patterns, edge vs leaks,
// session behaviors, and AI-powered analytical insights.
// ============================================================

import { useEffect, useState, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useGuest } from '../../contexts/GuestContext';
import { supabase, isSupabaseConfigured } from '../../services/supabase';
import { MockStorage } from '../../services/mockStorage';
import {
  detectTradingPatterns,
  type PatternDetectionResult,
  type PatternTradeContext,
  type PatternCategory,
  type PatternImpact,
} from '../../services/analytics/patterns';
import { requestPatternInsights } from '../../services/ai/client';
import type { AIPatternInsightsResponse } from '../../services/ai/types';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { PatternCard } from '../../components/analytics/PatternCard';
import { AIPatternInsightsModal } from '../../components/ai/AIPatternInsightsModal';
import { formatCurrency } from '../../utils/format';
import { useToast } from '../../contexts/ToastContext';
import type { TradingAccount, AccountPhase, Trade, TradeJournal, Strategy, Setup, Tag, Mistake } from '../../types/database';

export default function PatternsPage() {
  const { user } = useAuth();
  const { isGuest } = useGuest();
  const toast = useToast();

  // Filter state
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [phases, setPhases] = useState<AccountPhase[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>('');
  const [dateRange, setDateRange] = useState<'all' | '30d' | '90d' | '180d'>('all');

  // Pattern category & impact tabs
  const [activeTab, setActiveTab] = useState<'all' | 'strengths' | 'weaknesses' | 'strategy_setup' | 'session_time' | 'behavior'>('all');
  const [onlyReliable, setOnlyReliable] = useState(false);

  // Data & loading state
  const [loading, setLoading] = useState(true);
  const [detectionResult, setDetectionResult] = useState<PatternDetectionResult | null>(null);

  // AI Modal state
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiInsights, setAiInsights] = useState<AIPatternInsightsResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Load accounts
  useEffect(() => {
    async function loadAccounts() {
      if (isGuest || !isSupabaseConfigured) {
        const accs = await MockStorage.getAccounts(user?.id || 'guest-demo-user');
        setAccounts(accs);
      } else if (user) {
        const { data } = await supabase
          .from('trading_accounts')
          .select('*')
          .eq('user_id', user.id);
        if (data) setAccounts(data);
      }
    }
    loadAccounts();
  }, [user, isGuest]);

  // Load phases when account changes
  useEffect(() => {
    async function loadPhases() {
      if (!selectedAccountId) {
        setPhases([]);
        setSelectedPhaseId('');
        return;
      }

      if (isGuest || !isSupabaseConfigured) {
        const p = await MockStorage.getPhases(selectedAccountId);
        setPhases(p);
      } else if (user) {
        const { data } = await supabase
          .from('account_phases')
          .select('*')
          .eq('account_id', selectedAccountId);
        if (data) setPhases(data);
      }
    }
    loadPhases();
  }, [selectedAccountId, user, isGuest]);

  // Fetch data and run pattern detection
  useEffect(() => {
    async function runDetection() {
      setLoading(true);
      try {
        let trades: Trade[] = [];
        let journals: TradeJournal[] = [];
        let strategies: Strategy[] = [];
        let setups: Setup[] = [];
        let mistakes: Mistake[] = [];

        if (isGuest || !isSupabaseConfigured) {
          trades = await MockStorage.getTrades();
          journals = await MockStorage.getTradeJournals();
          strategies = await MockStorage.getStrategies();
          setups = await MockStorage.getSetups();
          mistakes = await MockStorage.getMistakes();
        } else if (user) {
          let tradesQuery = supabase.from('trades').select('*').eq('user_id', user.id);
          if (selectedAccountId) tradesQuery = tradesQuery.eq('account_id', selectedAccountId);
          if (selectedPhaseId) tradesQuery = tradesQuery.eq('phase_id', selectedPhaseId);

          const [tradesRes, journalsRes, stratsRes, setupsRes, mistakesRes] = await Promise.all([
            tradesQuery,
            supabase.from('trade_journals').select('*').eq('user_id', user.id),
            supabase.from('strategies').select('*').eq('user_id', user.id),
            supabase.from('setups').select('*').eq('user_id', user.id),
            supabase.from('mistakes').select('*').eq('user_id', user.id),
          ]);

          trades = tradesRes.data || [];
          journals = journalsRes.data || [];
          strategies = stratsRes.data || [];
          setups = setupsRes.data || [];
          mistakes = mistakesRes.data || [];
        }

        // Apply date range filter
        if (dateRange !== 'all') {
          const now = new Date();
          const days = dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 180;
          const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
          trades = trades.filter(t => new Date(t.entry_datetime) >= cutoff);
        }

        // Filter by account/phase if in guest mode
        if (isGuest || !isSupabaseConfigured) {
          if (selectedAccountId) trades = trades.filter(t => t.account_id === selectedAccountId);
          if (selectedPhaseId) trades = trades.filter(t => t.phase_id === selectedPhaseId);
        }

        // Build pattern trade contexts
        const journalMap = new Map<string, TradeJournal>();
        for (const j of journals) journalMap.set(j.trade_id, j);

        const stratMap = new Map<string, Strategy>();
        for (const s of strategies) stratMap.set(s.id, s);

        const setupMap = new Map<string, Setup>();
        for (const s of setups) setupMap.set(s.id, s);

        const contexts: PatternTradeContext[] = trades.map(trade => {
          const journal = journalMap.get(trade.id);
          return {
            trade,
            journal,
            strategy: journal?.strategy_id ? stratMap.get(journal.strategy_id) : null,
            setup: journal?.setup_id ? setupMap.get(journal.setup_id) : null,
          };
        });

        const result = detectTradingPatterns(contexts);
        setDetectionResult(result);
      } catch (err: any) {
        console.error('Error running pattern detection:', err);
        toast.error('خطا در تحلیل و شناسایی الگوهای معاملاتی');
      } finally {
        setLoading(false);
      }
    }

    runDetection();
  }, [user, isGuest, selectedAccountId, selectedPhaseId, dateRange]);

  // Request AI Pattern Insights
  const handleGenerateAIInsights = async () => {
    if (!detectionResult) return;
    setIsAIModalOpen(true);
    setAiLoading(true);

    try {
      const selectedAccount = accounts.find(a => a.id === selectedAccountId);
      const selectedPhase = phases.find(p => p.id === selectedPhaseId);
      const dateLabel =
        dateRange === '30d' ? '۳۰ روز گذشته' :
        dateRange === '90d' ? '۹۰ روز گذشته' :
        dateRange === '180d' ? '۶ ماه گذشته' : 'همه زمان‌ها';

      const response = await requestPatternInsights({
        detectionResult,
        accountName: selectedAccount?.name,
        phaseName: selectedPhase?.name,
        accountId: selectedAccountId || undefined,
        phaseId: selectedPhaseId || undefined,
        periodLabel: dateLabel,
        dateRange,
        isGuest,
      });

      setAiInsights(response);
    } catch (err: any) {
      console.error('AI Insights error:', err);
      toast.error(err.message || 'خطا در تولید بینش‌های هوشمند الگوها');
      setIsAIModalOpen(false);
    } finally {
      setAiLoading(false);
    }
  };

  // Filtered patterns based on active tab and reliability filter
  const displayedPatterns = useMemo(() => {
    if (!detectionResult) return [];

    let list = detectionResult.patterns;

    if (activeTab === 'strengths') {
      list = list.filter(p => p.impact === 'strength');
    } else if (activeTab === 'weaknesses') {
      list = list.filter(p => p.impact === 'weakness');
    } else if (activeTab === 'strategy_setup') {
      list = list.filter(p => p.category === 'strategy_setup');
    } else if (activeTab === 'session_time') {
      list = list.filter(p => p.category === 'session_time');
    } else if (activeTab === 'behavior') {
      list = list.filter(p => ['behavioral_rule', 'psychology_emotion', 'mistake_leak'].includes(p.category));
    }

    if (onlyReliable) {
      list = list.filter(p => p.reliability !== 'low_sample_observation');
    }

    return list;
  }, [detectionResult, activeTab, onlyReliable]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header & Analytics Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            الگوها و بینش‌های پیشرفته (Patterns & Insights)
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            کشف مزیت‌های آماری، نشت‌های سرمایه، زمان‌بندی بهینه و بینش‌های مبتنی بر شواهد
          </p>
        </div>

        {/* Sub-nav switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          <NavLink
            to="/app/analytics"
            end
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`
            }
          >
            آنالیتیکس کلی
          </NavLink>
          <NavLink
            to="/app/analytics/patterns"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`
            }
          >
            الگوها و بینش‌ها
          </NavLink>
          <NavLink
            to="/app/analytics/what-if"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`
            }
          >
            شبیه‌ساز فرضی (What-If)
          </NavLink>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select
            label="حساب معاملاتی"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            options={[
              { value: '', label: 'همه حساب‌ها' },
              ...accounts.map(a => ({ value: a.id, label: a.name })),
            ]}
          />

          <Select
            label="فاز حساب"
            value={selectedPhaseId}
            disabled={!selectedAccountId || phases.length === 0}
            onChange={(e) => setSelectedPhaseId(e.target.value)}
            options={[
              { value: '', label: 'همه فازها' },
              ...phases.map(p => ({ value: p.id, label: p.name })),
            ]}
          />

          <Select
            label="بازه زمانی نمونه"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            options={[
              { value: 'all', label: 'کل سابقه معاملات' },
              { value: '30d', label: '۳۰ روز اخیر' },
              { value: '90d', label: '۹۰ روز اخیر' },
              { value: '180d', label: '۶ ماه اخیر' },
            ]}
          />

          <div className="flex items-end">
            <button
              onClick={handleGenerateAIInsights}
              disabled={loading || !detectionResult || detectionResult.baseline.totalTrades === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium text-sm shadow-sm transition-all disabled:opacity-50"
            >
              <span>✨</span>
              <span>تحلیل هوشمند با AI</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      {loading ? (
        <Loading message="در حال کاوش و استخراج الگوهای آماری معاملات..." />
      ) : !detectionResult || detectionResult.baseline.totalTrades === 0 ? (
        <EmptyState
          title="معامله‌ای برای شناسایی الگو یافت نشد"
          description="برای تحلیل الگوها و همپوشانی شرایط، ابتدا معاملات خود را وارد کرده یا فیلترهای بالا را تغییر دهید."
        />
      ) : (
        <div className="space-y-6">
          {/* Baseline Summary KPI Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">تعداد کل معاملات</span>
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100" dir="ltr">
                {detectionResult.baseline.totalTrades}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">میانگین نرخ برد (Baseline)</span>
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100" dir="ltr">
                {detectionResult.baseline.winRate !== null ? `${detectionResult.baseline.winRate}%` : 'N/A'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">سود/زیان خالص کل</span>
              <span className={`text-xl font-bold ${
                detectionResult.baseline.netPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              }`} dir="ltr">
                {formatCurrency(detectionResult.baseline.netPnl)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">ضریب سود کل (PF)</span>
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100" dir="ltr">
                {detectionResult.baseline.profitFactor ?? 'N/A'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">الگوهای شناسایی‌شده</span>
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="text-emerald-600 dark:text-emerald-400">
                  {detectionResult.reliablePatternsCount} معتبر
                </span>
                <span className="text-gray-400">|</span>
                <span className="text-amber-600 dark:text-amber-400">
                  {detectionResult.lowSamplePatternsCount} مشاهده اولیه
                </span>
              </div>
            </div>
          </div>

          {/* Tab Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-gray-200 dark:border-gray-800">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                همه الگوها ({detectionResult.patterns.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('strengths')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'strengths'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                }`}
              >
                💎 مزیت‌ها ({detectionResult.strengths.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('weaknesses')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'weaknesses'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100'
                }`}
              >
                🛑 نقاط ضعف ({detectionResult.weaknesses.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('strategy_setup')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'strategy_setup'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                ستاپ و استراتژی
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('session_time')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'session_time'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                سشن و زمان
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('behavior')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'behavior'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                انضباط و روانشناسی
              </button>
            </div>

            {/* Toggle Only Statistically Reliable */}
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300 select-none">
              <input
                type="checkbox"
                checked={onlyReliable}
                onChange={(e) => setOnlyReliable(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>فقط الگوهای با حجم نمونه کافی (۵+ معامله)</span>
            </label>
          </div>

          {/* Patterns Grid */}
          {displayedPatterns.length === 0 ? (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              الگویی منطبق بر فیلتر انتخابی یافت نشد.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedPatterns.map((pattern) => (
                <PatternCard key={pattern.id} pattern={pattern} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Pattern Insights Modal */}
      <AIPatternInsightsModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        insights={aiInsights}
        isLoading={aiLoading}
        onRefresh={handleGenerateAIInsights}
      />
    </div>
  );
}
