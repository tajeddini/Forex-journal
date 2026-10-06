import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGuest } from '../../contexts/GuestContext';
import { useToast } from '../../contexts/ToastContext';
import { getAccounts } from '../../services/accounts';
import { queryAI } from '../../services/ai/client';
import type { AIQueryResponse } from '../../services/ai/types';
import type { TradingAccount } from '../../types/database';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { VoiceInput } from '../../components/journal/VoiceInput';
import {
  Sparkles,
  Send,
  RotateCcw,
  AlertTriangle,
  Info,
  CheckCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  History,
  ShieldAlert,
} from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  'نرخ برد کلی معاملات من چقدر است؟',
  'در کدام ساعت بیشترین سود را داشته‌ام؟',
  'عملکرد معاملات EURUSD من چطور بوده است؟',
  'معاملات خرید (Buy) و فروش (Sell) را مقایسه کن.',
  'بهترین روزهای معاملاتی من کدام‌اند؟',
  'بین معاملات با رعایت قوانین و نقض قوانین چه تفاوتی وجود دارد؟',
  'میانگین مدت زمان باز بودن معاملات من چقدر است؟',
  'کارنامه کلی و شاخص‌های سودآوری حساب من چیست؟',
];

export default function AIQueryPage() {
  const { user } = useAuth();
  const { isGuest } = useGuest();
  const toast = useToast();

  const [question, setQuestion] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Query Execution State
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIQueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState('');
  const [showQueryPlan, setShowQueryPlan] = useState(false);
  const [history, setHistory] = useState<Array<{ q: string; timestamp: Date }>>([]);

  // Fetch accounts on mount
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    setLoadingAccounts(true);
    getAccounts(user.id)
      .then((accs) => {
        if (isMounted) {
          setAccounts(accs);
          if (accs.length > 0 && !selectedAccountId) {
            setSelectedAccountId(accs[0].id);
          }
        }
      })
      .catch((err) => {
        console.warn('Could not load accounts for AI query page', err);
      })
      .finally(() => {
        if (isMounted) setLoadingAccounts(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user, selectedAccountId]);

  const handleSubmit = async (e?: FormEvent, overrideQuestion?: string) => {
    if (e) e.preventDefault();
    const queryText = (overrideQuestion ?? question).trim();

    if (!queryText) {
      toast.warning('لطفاً سوال خود را درباره معاملات وارد فرمایید.');
      return;
    }

    setLoading(true);
    setError(null);
    setLastQuestion(queryText);

    try {
      const res = await queryAI({
        question: queryText,
        accountId: selectedAccountId || undefined,
        isGuest,
      });

      setResult(res);
      // Append to recent history
      setHistory((prev) => [
        { q: queryText, timestamp: new Date() },
        ...prev.filter((item) => item.q !== queryText).slice(0, 5),
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در دریافت پاسخ هوش مصنوعی';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePickSuggestion = (q: string) => {
    setQuestion(q);
    handleSubmit(undefined, q);
  };

  const handleClear = () => {
    setQuestion('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                دستیار هوشمند و تحلیل‌گر معاملات
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                پرسش و پاسخ تحلیلی بر پایه داده‌های واقعی و قطعی ژورنال معاملات
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge variant="success" className="text-xs gap-1.5 py-1 px-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>آماده پاسخگویی</span>
          </Badge>
          {isGuest && (
            <Badge variant="warning" className="text-xs py-1 px-2.5">
              حالت مهمان
            </Badge>
          )}
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 text-xs text-blue-800 dark:text-blue-300">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
        <div className="leading-relaxed">
          <strong>مرز امنیتی هوش مصنوعی:</strong> این سیستم صرفاً به منظور تحلیل آماری، ریشه‌یابی خطاها و تفسیر داده‌ها طراحی شده است. هوش مصنوعی هیچ دسترسی مستقیمی به اجرای معاملات یا تغییر اطلاعات ندارد و پایگاه‌داده معاملات شما همواره محفوظ و غیرقابل‌تغییر باقی می‌ماند.
        </div>
      </div>

      {/* Main Input Form */}
      <Card className="shadow-sm border-gray-200 dark:border-gray-800">
        <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span>طرح پرسش آماری یا تحلیلی</span>
            </CardTitle>

            {/* Account scope filter */}
            {accounts.length > 0 && (
              <div className="w-full sm:w-64">
                <Select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  disabled={loadingAccounts || loading}
                  options={[
                    { value: '', label: 'تمام حساب‌های معاملاتی' },
                    ...accounts.map((acc) => ({
                      value: acc.id,
                      label: `${acc.name} (${acc.currency})`,
                    })),
                  ]}
                />
              </div>
            )}
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          <div className="relative">
            <textarea
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="سوال خود را درباره معاملاتتان بنویسید (مثلاً: در کدام ساعت بیشترین سود را داشته‌ام؟ یا عملکرد EURUSD چطور بوده؟)..."
              disabled={loading}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-3.5 pl-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none leading-relaxed transition-colors"
            />

            {/* Voice Input Integration */}
            <div className="absolute left-3 bottom-3">
              <VoiceInput onResult={(txt) => setQuestion((prev) => (prev ? `${prev} ${txt}` : txt))} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="text-[11px] text-gray-400">
              کلید <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">Enter</kbd> برای ارسال، <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">Shift + Enter</kbd> برای خط بعد
            </div>

            <div className="flex items-center gap-2">
              {(question || result || error) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  disabled={loading}
                  className="text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 ml-1" />
                  پاک کردن
                </Button>
              )}

              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={loading || !question.trim()}
                className="gap-1.5 text-xs px-4"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>در حال تحلیل و استخراج...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 rotate-180" />
                    <span>ارسال و تحلیل</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Suggested Questions */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800/80 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
              <span>نمونه سوالات پیشنهادی برای تحلیل:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => handlePickSuggestion(sug)}
                  disabled={loading}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-700 dark:hover:text-blue-300 transition-all text-right"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        </form>
      </Card>

      {/* Loading Skeleton */}
      {loading && (
        <Card className="p-6 border-blue-200 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/10 space-y-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-blue-400/50" />
            <div className="h-4 w-48 bg-blue-200 dark:bg-blue-800 rounded" />
          </div>
          <div className="space-y-2 pt-2">
            <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-5/6 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-4/6 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          </div>
        </Card>
      )}

      {/* Error Notice */}
      {error && !loading && (
        <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-red-800 dark:text-red-300">
                خطا در اجرای درخواست
              </h3>
              <p className="text-xs text-red-700 dark:text-red-400 mt-1 leading-relaxed">
                {error}
              </p>
            </div>
          </div>
          {lastQuestion && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSubmit(undefined, lastQuestion)}
              className="text-xs shrink-0 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40"
            >
              تلاش مجدد
            </Button>
          )}
        </div>
      )}

      {/* Results View */}
      {result && !loading && (
        <div className="space-y-4">
          <Card className="border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            {/* Header of Result */}
            <div className="p-4 bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  پاسخ و تحلیل تحلیلی:
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                  «{lastQuestion}»
                </span>
              </div>
              {result.confidenceNote && (
                <span className="text-[11px] text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 self-start sm:self-auto">
                  {result.confidenceNote}
                </span>
              )}
            </div>

            {/* AI Text Interpretation */}
            <div className="p-5 space-y-4">
              <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap font-sans">
                {result.answer}
              </div>

              {/* Sample Size Warning / Limitations if any */}
              {result.limitations && result.limitations.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>ملاحظات و محدودیت‌های آماری:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 pr-2">
                    {result.limitations.map((lim, idx) => (
                      <li key={idx}>{lim}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Deterministic Mathematical Facts Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-850/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  <span>📊 حقایق محاسباتی قطعی سیستم (منبع حقیقت)</span>
                </span>
                <span className="text-[11px] text-gray-400">
                  حجم نمونه: {result.dataSummary.sampleSize} معامله
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-center">
                  <span className="text-[11px] text-gray-400 block">تعداد معاملات</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {result.dataSummary.sampleSize}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-center">
                  <span className="text-[11px] text-gray-400 block">نرخ برد (Win Rate)</span>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {result.dataSummary.metrics.winRate !== null && result.dataSummary.metrics.winRate !== undefined
                      ? `${result.dataSummary.metrics.winRate.toFixed(1)}%`
                      : '—'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-center">
                  <span className="text-[11px] text-gray-400 block">سود خالص (Net PnL)</span>
                  <span
                    className={`text-sm font-bold ${
                      (result.dataSummary.metrics.netPnl ?? 0) >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {result.dataSummary.metrics.netPnl !== null && result.dataSummary.metrics.netPnl !== undefined
                      ? `${result.dataSummary.metrics.netPnl >= 0 ? '+' : ''}${result.dataSummary.metrics.netPnl.toLocaleString()} $`
                      : '—'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-center">
                  <span className="text-[11px] text-gray-400 block">فاکتور سود (PF)</span>
                  <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                    {result.dataSummary.metrics.profitFactor !== null && result.dataSummary.metrics.profitFactor !== undefined
                      ? result.dataSummary.metrics.profitFactor.toFixed(2)
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Query Plan Transparency Toggle */}
            <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between text-xs text-gray-500">
              <button
                type="button"
                onClick={() => setShowQueryPlan((prev) => !prev)}
                className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <span>نمایش برنامه استخراج داده (Query Plan)</span>
                {showQueryPlan ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <span className="text-[11px] text-gray-400">تایید شده بر اساس Query DSL مجاز</span>
            </div>

            {showQueryPlan && (
              <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-900 text-gray-200 text-xs font-mono overflow-x-auto ltr text-left" dir="ltr">
                <pre>{JSON.stringify(result.queryPlan, null, 2)}</pre>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Recent Queries History */}
      {history.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
            <History className="w-3.5 h-3.5" />
            <span>پرسش‌های اخیر در این جلسه:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handlePickSuggestion(item.q)}
                disabled={loading}
                className="text-xs px-3 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                {item.q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
