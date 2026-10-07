import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGuest } from '../../contexts/GuestContext';
import { useToast } from '../../contexts/ToastContext';
import { getAccounts } from '../../services/accounts';
import {
  queryAI,
  getSavedClientAIConfig,
  saveClientAIConfig,
  type UserAIProviderSettings,
} from '../../services/ai/client';
import type { AIQueryResponse, AIProviderType } from '../../services/ai/types';
import type { TradingAccount } from '../../types/database';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
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
  Settings,
  Key,
  Eye,
  EyeOff,
  Clock,
  Calendar,
  Layers,
  ShieldCheck,
  Zap,
} from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  'در کدام ساعت بیشترین سود را داشته‌ام؟',
  'بهترین روزهای معاملاتی من کدام‌اند؟',
  'معاملات خرید (Buy) و فروش (Sell) را مقایسه کن.',
  'نرخ برد کلی معاملات من چقدر است؟',
  'عملکرد معاملات EURUSD من چطور بوده است؟',
  'بین معاملات با رعایت قوانین و نقض قوانین چه تفاوتی وجود دارد؟',
  'میانگین مدت زمان باز بودن معاملات من چقدر است؟',
  'کارنامه کلی و شاخص‌های سودآوری حساب من چیست؟',
];

const PROVIDER_OPTIONS: Array<{ value: AIProviderType; label: string; defaultModel: string; hint: string }> = [
  {
    value: 'gemini',
    label: 'Google Gemini (پیشنهادی)',
    defaultModel: 'gemini-3.8-flash',
    hint: 'مدل سریع و بهینه گوگل مناسب برای تحلیل‌های جامع داده',
  },
  {
    value: 'openai',
    label: 'OpenAI (GPT-4o / GPT-4o-mini)',
    defaultModel: 'gpt-4o-mini',
    hint: 'مدل‌های استاندارد OpenAI از طریق کلید رسمی یا پروکسی سازگار',
  },
  {
    value: 'qwen',
    label: 'Qwen / Alibaba DashScope / OpenRouter',
    defaultModel: 'qwen-plus',
    hint: 'مدل قدرتمند Qwen مناسب برای استدلال محاسباتی',
  },
  {
    value: 'claude',
    label: 'Anthropic Claude',
    defaultModel: 'claude-3-5-sonnet-latest',
    hint: 'مدل‌های Claude از طریق API رسمی Anthropic',
  },
  {
    value: 'custom',
    label: 'Custom / OpenAI-Compatible',
    defaultModel: 'custom-model',
    hint: 'هر سرویس سازگار با API استاندارد OpenAI',
  },
  {
    value: 'mock',
    label: 'شبیه‌ساز آزمایشی (آفلاین بدون کلید)',
    defaultModel: 'deterministic-mock',
    hint: 'محاسبه ریاضی قطعی داده‌ها بدون نیاز به هیچ کلید اینترنتی',
  },
];

export default function AIQueryPage() {
  const { user } = useAuth();
  const { isGuest } = useGuest();
  const toast = useToast();

  const [question, setQuestion] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // AI Provider & BYOK settings
  const [aiSettings, setAiSettings] = useState<UserAIProviderSettings>(getSavedClientAIConfig());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);

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

  const handleSaveSettings = () => {
    saveClientAIConfig(aiSettings);
    toast.success('تنظیمات ارائه‌دهنده هوش مصنوعی ذخیره شد.');
    setIsSettingsOpen(false);
  };

  const handleTestConnection = async () => {
    setTestingKey(true);
    setTestSuccess(null);
    try {
      await queryAI({
        question: 'تست اتصال و بررسی سلامت کلید',
        accountId: selectedAccountId || undefined,
        isGuest,
        providerConfig: aiSettings,
      });
      setTestSuccess('اتصال به ارائه‌دهنده هوش مصنوعی با موفقیت برقرار شد.');
      toast.success('اتصال به ارائه‌دهنده موفقیت‌آمیز بود.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در برقراری اتصال با ارائه‌دهنده';
      toast.error(msg);
      setTestSuccess(null);
    } finally {
      setTestingKey(false);
    }
  };

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
        providerConfig: aiSettings,
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

  const currentProviderInfo = PROVIDER_OPTIONS.find((p) => p.value === aiSettings.provider) || PROVIDER_OPTIONS[0];

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

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          {/* Provider badge & Settings trigger button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 text-xs py-1 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 transition-colors shadow-sm"
          >
            <Settings className="w-3.5 h-3.5 text-blue-500" />
            <span>پرووایدر: <strong>{currentProviderInfo.label.split(' ')[0]}</strong></span>
            {aiSettings.apiKey ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                کلید شخصی
              </span>
            ) : null}
          </button>

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

      {/* Settings Modal */}
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="تنظیمات ارائه‌دهنده هوش مصنوعی (AI Provider & Key)"
        size="md"
      >
        <div className="space-y-4 p-1">
          <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-300 leading-relaxed flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <span>
              <strong>امنیت کلیدها:</strong> کلید API شخصی شما فقط در حافظه همین نشست نگهداری می‌شود و هرگز در localStorage، sessionStorage، کوکی یا URL ذخیره نمی‌شود. کلید برای هر درخواست فقط از طریق HTTPS به لایه سرور ارسال می‌شود و با بارگذاری مجدد صفحه پاک خواهد شد.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              ارائه‌دهنده هوش مصنوعی (Provider):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PROVIDER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setAiSettings((prev) => ({
                      ...prev,
                      provider: opt.value,
                      model: prev.model || opt.defaultModel,
                    }));
                  }}
                  className={`p-2.5 text-right rounded-lg border text-xs transition-all ${
                    aiSettings.provider === opt.value
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 font-bold shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{opt.label}</span>
                    {aiSettings.provider === opt.value && <CheckCircle className="w-3.5 h-3.5 text-blue-500" />}
                  </div>
                  <span className="text-[10px] text-gray-400 block mt-1 font-normal">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {aiSettings.provider !== 'mock' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  کلید دسترسی شخصی (API Key):
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={aiSettings.apiKey || ''}
                    onChange={(e) => setAiSettings((prev) => ({ ...prev, apiKey: e.target.value }))}
                    placeholder={`کلید اختصاصی ${currentProviderInfo.label.split(' ')[0]} را وارد کنید (اختیاری)`}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-2.5 pl-20 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <div className="absolute left-2 top-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowApiKey((prev) => !prev)}
                      className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    {aiSettings.apiKey && (
                      <button
                        type="button"
                        onClick={() => setAiSettings((prev) => ({ ...prev, apiKey: '' }))}
                        className="text-[10px] text-red-500 px-1 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        پاک کردن
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {aiSettings.provider === 'custom' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Base URL سرویس سفارشی:
                  </label>
                  <input
                    type="url"
                    value={aiSettings.baseUrl || ''}
                    onChange={(e) => setAiSettings((prev) => ({ ...prev, baseUrl: e.target.value }))}
                    placeholder="https://example.com/v1"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-2.5 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">باید endpoint سازگار با /chat/completions ارائه کند.</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  مدل انتخابی (Model Name):
                </label>
                <input
                  type="text"
                  value={aiSettings.model || currentProviderInfo.defaultModel}
                  onChange={(e) => setAiSettings((prev) => ({ ...prev, model: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-2.5 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {['gemini-3.8-flash', 'gpt-4o-mini', 'gpt-4o', 'qwen-plus'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setAiSettings((prev) => ({ ...prev, model: m }))}
                      className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {testSuccess && (
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>{testSuccess}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testingKey}
              onClick={handleTestConnection}
              className="text-xs gap-1"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>{testingKey ? 'در حال تست...' : 'تست اتصال'}</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsSettingsOpen(false)}
                className="text-xs"
              >
                انصراف
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSaveSettings}
                className="text-xs"
              >
                ذخیره تنظیمات
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Safety Notice Banner */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 text-xs text-blue-800 dark:text-blue-300">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
        <div className="leading-relaxed">
          <strong>مرز امنیتی هوش مصنوعی:</strong> تحلیل‌ها بر مبنای موتور محاسباتی قطعی ژورنال استخراج می‌شوند. هوش مصنوعی هیچ دسترسی مستقیمی برای تغییر پایگاه‌داده یا ثبت معاملات ندارد و از ارائه‌دهنده دلخواه شما با امنیت کامل استفاده می‌کند.
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
              placeholder="سوال خود را درباره معاملاتتان بنویسید (مثلاً: در کدام ساعت بیشترین سود را داشته‌ام؟ یا معاملات خرید و فروش را مقایسه کن)..."
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
        <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-red-800 dark:text-red-300">
                خطا در پردازش درخواست
              </h3>
              <p className="text-xs text-red-700 dark:text-red-400 mt-1 leading-relaxed">
                {error}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              className="text-xs border-red-300 dark:border-red-800 text-red-700 dark:text-red-300"
            >
              <Key className="w-3.5 h-3.5 ml-1" />
              تنظیم کلید و ارائه‌دهنده
            </Button>
            {lastQuestion && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => handleSubmit(undefined, lastQuestion)}
                className="text-xs bg-red-600 hover:bg-red-700 text-white"
              >
                تلاش مجدد
              </Button>
            )}
          </div>
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
                  پاسخ و تحلیل آماری:
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

            {/* Dimensional Breakdown Visual Cards (If present in query) */}
            {result.dataSummary.breakdowns && Object.keys(result.dataSummary.breakdowns).length > 0 && (
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-blue-50/20 dark:bg-blue-950/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-500" />
                    <span>تحلیل تفکیکی ابعاد کوئری (Dimensional Breakdown)</span>
                  </span>
                </div>

                {/* Hourly breakdown table */}
                {result.dataSummary.breakdowns.hourly && result.dataSummary.breakdowns.hourly.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span>تفکیک عملکرد بر اساس ساعت‌های شبانه‌روز:</span>
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {result.dataSummary.breakdowns.hourly.map((h: any) => (
                        <div
                          key={h.hour}
                          className={`p-2 rounded-lg border text-center text-xs ${
                            h.netPnl > 0
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                              : h.netPnl < 0
                              ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300'
                              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <span className="text-[10px] text-gray-400 block font-mono">{h.label}</span>
                          <span className="font-bold block mt-0.5">
                            {h.netPnl >= 0 ? '+' : ''}{h.netPnl.toFixed(2)}$
                          </span>
                          <span className="text-[10px] opacity-80 block">
                            {h.trades} معامله ({h.winRate?.toFixed(0) || '0'}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Day of week breakdown */}
                {result.dataSummary.breakdowns.dayOfWeek && result.dataSummary.breakdowns.dayOfWeek.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      <span>تفکیک عملکرد در روزهای هفته:</span>
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                      {result.dataSummary.breakdowns.dayOfWeek.map((d: any) => (
                        <div
                          key={d.day}
                          className={`p-2 rounded-lg border text-center text-xs ${
                            d.netPnl > 0
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                              : d.netPnl < 0
                              ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300'
                              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <span className="text-[11px] font-bold block">{d.label}</span>
                          <span className="font-bold block mt-0.5">
                            {d.netPnl >= 0 ? '+' : ''}{d.netPnl.toFixed(2)}$
                          </span>
                          <span className="text-[10px] opacity-80 block">
                            {d.trades} معامله ({d.winRate?.toFixed(0) || '0'}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Side (Buy vs Sell) breakdown */}
                {result.dataSummary.breakdowns.bySide && result.dataSummary.breakdowns.bySide.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    {result.dataSummary.breakdowns.bySide.map((s: any) => (
                      <div
                        key={s.key}
                        className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-gray-900 dark:text-gray-100">
                            {s.key.toLowerCase() === 'buy' ? 'معاملات خرید (Buy / Long)' : 'معاملات فروش (Sell / Short)'}
                          </span>
                          <span className="text-[11px] text-gray-400 block mt-0.5">
                            {s.trades} معامله | فاکتور سود: {s.profitFactor.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-left">
                          <span className={`font-bold block ${s.netPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {s.netPnl >= 0 ? '+' : ''}{s.netPnl.toFixed(2)}$
                          </span>
                          <span className="text-[11px] text-blue-600 dark:text-blue-400">
                            وین ریت: {s.winRate.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Deterministic Mathematical Facts Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-850/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  <span>📊 شاخص‌های قطعی و ریاضی محاسبات (منبع موثق)</span>
                </span>
                <span className="text-[11px] text-gray-400">
                  حجم نمونه: {result.dataSummary.sampleSize} معامله
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-center">
                  <span className="text-[11px] text-gray-400 block">تعداد کل معاملات</span>
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
                <span>نمایش ساختار استخراج داده (Query Plan)</span>
                {showQueryPlan ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <span className="text-[11px] text-gray-400">تایید شده با Query DSL مجاز</span>
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
