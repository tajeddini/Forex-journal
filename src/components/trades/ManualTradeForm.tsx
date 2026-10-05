import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getAccounts } from '../../services/accounts';
import { getPhases } from '../../services/accountPhases';
import { createTrade } from '../../services/trades';
import type { TradingAccount, AccountPhase, TradeSide, TradeInsert, Trade, Strategy, Setup } from '../../types/database';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { MultiSelect } from '../ui/MultiSelect';
import { getStrategies } from '../../services/strategies';
import { getSetups } from '../../services/setups';
import { upsertTradeJournal } from '../../services/tradeJournals';
import {
  TIMEFRAME_OPTIONS,
  COMMON_TIMEFRAME_PRESETS,
  MARKET_BIAS_OPTIONS,
  TRADING_SESSION_OPTIONS,
  CONFLUENCE_OPTIONS,
  COMMON_CONFLUENCE_PRESETS,
  joinDelimitedString,
} from '../../constants/tradingOptions';

interface ManualTradeFormProps {
  onSuccess?: (trade: Trade, shouldOpenJournal: boolean) => void;
  onCancel?: () => void;
  defaultAccountId?: string;
}

const COMMON_SYMBOLS = [
  { name: 'EURUSD', label: 'EUR/USD' },
  { name: 'GBPUSD', label: 'GBP/USD' },
  { name: 'USDJPY', label: 'USD/JPY' },
  { name: 'XAUUSD', label: 'طلا (XAU)' },
  { name: 'US30', label: 'داوجونز (US30)' },
  { name: 'NAS100', label: 'نزدک (NAS100)' },
  { name: 'BTCUSD', label: 'بیت‌کوین (BTC)' },
  { name: 'AUDUSD', label: 'AUD/USD' },
];

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

export function ManualTradeForm({ onSuccess, onCancel, defaultAccountId }: ManualTradeFormProps) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Accounts & Phases
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [phases, setPhases] = useState<AccountPhase[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(defaultAccountId || '');
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>('');
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Trade fields
  const [symbol, setSymbol] = useState('EURUSD');
  const [side, setSide] = useState<TradeSide>('buy');
  const [volume, setVolume] = useState('0.10');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  // Times
  const now = useMemo(() => new Date(), []);
  const oneHourAgo = useMemo(() => new Date(Date.now() - 60 * 60 * 1000), []);
  const [entryDatetime, setEntryDatetime] = useState(toLocalDatetimeString(oneHourAgo));
  const [exitDatetime, setExitDatetime] = useState(toLocalDatetimeString(now));

  // Financials
  const [profit, setProfit] = useState('');
  const [commission, setCommission] = useState('0');
  const [swap, setSwap] = useState('0');

  // Metadata
  const [ticket, setTicket] = useState('');
  const [comment, setComment] = useState('');

  // Analytical & Journal fields (Timeframes, Sessions, Market Bias, Confluences, Strategy & Setup)
  const [timeframes, setTimeframes] = useState<string[]>(['15m']);
  const [sessions, setSessions] = useState<string[]>([]);
  const [marketBias, setMarketBias] = useState<string[]>([]);
  const [confluences, setConfluences] = useState<string[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [setups, setSetups] = useState<Setup[]>([]);
  const [strategyId, setStrategyId] = useState<string>('');
  const [setupId, setSetupId] = useState<string>('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [submitIntent, setSubmitIntent] = useState<'save' | 'journal'>('journal');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch accounts on mount
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    getAccounts(user.id)
      .then((data) => {
        if (!isMounted) return;
        setAccounts(data);
        if (data.length > 0 && !selectedAccountId) {
          const chosen = defaultAccountId && data.some(a => a.id === defaultAccountId)
            ? defaultAccountId
            : data[0].id;
          setSelectedAccountId(chosen);
        }
      })
      .catch((err) => {
        console.error('Failed to load accounts', err);
        toast.error('خطا در دریافت لیست حساب‌های معاملاتی');
      })
      .finally(() => {
        if (isMounted) setLoadingAccounts(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user, defaultAccountId, toast]);

  // Fetch phases when account changes
  useEffect(() => {
    if (!user || !selectedAccountId) {
      setPhases([]);
      setSelectedPhaseId('');
      return;
    }

    getPhases(selectedAccountId, user.id)
      .then((phaseList) => {
        setPhases(phaseList);
        if (phaseList.length > 0) {
          // Select active phase by default if available
          const active = phaseList.find(p => p.status === 'active') || phaseList[0];
          setSelectedPhaseId(active.id);
        } else {
          setSelectedPhaseId('');
        }
      })
      .catch(() => {
        setPhases([]);
        setSelectedPhaseId('');
      });
  }, [selectedAccountId, user]);

  // Load strategies and setups
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    Promise.all([getStrategies(user.id), getSetups(user.id)])
      .then(([sList, stpList]) => {
        if (!isMounted) return;
        setStrategies(sList);
        setSetups(stpList);
      })
      .catch((err) => {
        console.warn('Failed to load strategies/setups for manual form', err);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Smart Profit Calculation helper
  const calculatedEstimatedProfit = useMemo(() => {
    const en = parseFloat(entryPrice);
    const ex = parseFloat(exitPrice);
    const vol = parseFloat(volume);

    if (isNaN(en) || isNaN(ex) || isNaN(vol) || en <= 0 || ex <= 0 || vol <= 0) {
      return null;
    }

    const diff = side === 'buy' ? (ex - en) : (en - ex);
    const sym = symbol.toUpperCase().trim();

    let estimated = 0;
    if (sym.includes('XAU') || sym.includes('GOLD')) {
      estimated = diff * vol * 100;
    } else if (sym.includes('BTC') || sym.includes('ETH') || sym.includes('CRYPTO')) {
      estimated = diff * vol;
    } else if (sym.includes('US30') || sym.includes('NAS100') || sym.includes('SPX500')) {
      estimated = diff * vol;
    } else if (sym.includes('JPY')) {
      const rate = ex > 0 ? ex : 150;
      estimated = (diff / rate) * vol * 100000;
    } else {
      estimated = diff * vol * 100000;
    }

    return Math.round(estimated * 100) / 100;
  }, [entryPrice, exitPrice, volume, side, symbol]);

  const handleApplyCalculatedProfit = () => {
    if (calculatedEstimatedProfit !== null) {
      setProfit(calculatedEstimatedProfit.toString());
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!selectedAccountId) {
      errs.account = 'لطفاً حساب معاملاتی را انتخاب کنید';
    }
    if (!symbol.trim()) {
      errs.symbol = 'نماد معاملاتی الزامی است';
    }
    const vol = parseFloat(volume);
    if (isNaN(vol) || vol <= 0) {
      errs.volume = 'حجم معامله (لات) باید عددی بزرگتر از صفر باشد';
    }
    const enPrice = parseFloat(entryPrice);
    if (isNaN(enPrice) || enPrice <= 0) {
      errs.entryPrice = 'قیمت ورود معتبر الزامی است';
    }
    const exPrice = parseFloat(exitPrice);
    if (isNaN(exPrice) || exPrice <= 0) {
      errs.exitPrice = 'قیمت خروج معتبر الزامی است';
    }

    if (!entryDatetime) {
      errs.entryDatetime = 'زمان ورود الزامی است';
    }
    if (!exitDatetime) {
      errs.exitDatetime = 'زمان خروج الزامی است';
    }
    if (entryDatetime && exitDatetime && new Date(exitDatetime) < new Date(entryDatetime)) {
      errs.exitDatetime = 'زمان خروج نمی‌تواند قبل از زمان ورود باشد';
    }

    const prf = parseFloat(profit);
    if (isNaN(prf) && calculatedEstimatedProfit === null) {
      errs.profit = 'لطفاً مقدار سود یا زیان را وارد کنید یا دکمه محاسبه خودکار را بزنید';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('کاربر لاگین نکرده است');
      return;
    }

    if (!validate()) {
      toast.error('لطفاً خطاهای فرم را برطرف کنید');
      return;
    }

    try {
      setSubmitting(true);

      const finalProfit = profit !== '' && !isNaN(parseFloat(profit))
        ? parseFloat(profit)
        : (calculatedEstimatedProfit ?? 0);

      const finalCommission = parseFloat(commission) || 0;
      const finalSwap = parseFloat(swap) || 0;
      const finalTicket = ticket.trim() || `MAN-${Date.now().toString().slice(-6)}`;

      const tradePayload: TradeInsert = {
        user_id: user.id,
        account_id: selectedAccountId,
        phase_id: selectedPhaseId || null,
        import_batch_id: null,
        ticket: finalTicket,
        position_id: finalTicket,
        symbol: symbol.trim().toUpperCase(),
        side,
        volume: parseFloat(volume),
        entry_datetime: new Date(entryDatetime).toISOString(),
        entry_price: parseFloat(entryPrice),
        stop_loss: stopLoss ? parseFloat(stopLoss) : null,
        take_profit: takeProfit ? parseFloat(takeProfit) : null,
        exit_datetime: new Date(exitDatetime).toISOString(),
        exit_price: parseFloat(exitPrice),
        commission: finalCommission,
        swap: finalSwap,
        profit: finalProfit,
        comment: comment.trim() || 'معامله ثبت دستی',
        magic_number: null,
        source: 'manual',
        source_file: null,
      };

      const created = await createTrade(tradePayload);

      // Automatically persist analytical and journal details if provided
      const hasJournalDetails =
        timeframes.length > 0 ||
        sessions.length > 0 ||
        marketBias.length > 0 ||
        confluences.length > 0 ||
        Boolean(strategyId) ||
        Boolean(setupId);

      if (hasJournalDetails) {
        try {
          await upsertTradeJournal(created.id, user.id, {
            timeframe: timeframes.length > 0 ? joinDelimitedString(timeframes) : null,
            market_bias: marketBias.length > 0 ? joinDelimitedString(marketBias) : null,
            confluences: confluences.length > 0 ? joinDelimitedString(confluences) : null,
            market_context: sessions.length > 0 ? `نشست معاملاتی: ${joinDelimitedString(sessions)}` : null,
            strategy_id: strategyId || null,
            setup_id: setupId || null,
            status: 'in_progress',
          });
        } catch (jErr) {
          console.warn('Could not auto-save initial journal for manual trade', jErr);
        }
      }

      toast.success('معامله جدید با موفقیت ثبت شد');

      if (onSuccess) {
        onSuccess(created, submitIntent === 'journal');
      } else {
        if (submitIntent === 'journal') {
          navigate(`/app/trades/${created.id}?tab=pretrade`);
        } else {
          navigate('/app/trades');
        }
      }
    } catch (err) {
      console.error('Failed to create trade', err);
      toast.error(err instanceof Error ? err.message : 'خطا در ثبت معامله');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-right" dir="rtl">
      {/* Account and Phase selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <div>
          <Select
            label="حساب معاملاتی *"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            error={errors.account}
            disabled={loadingAccounts || accounts.length === 0}
            options={accounts.map((acc) => ({
              value: acc.id,
              label: `${acc.name} (${acc.currency} ${acc.current_balance.toLocaleString()})`,
            }))}
            placeholder={loadingAccounts ? 'در حال بارگذاری حساب‌ها...' : 'انتخاب حساب معاملاتی'}
          />
          {accounts.length === 0 && !loadingAccounts && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              هیچ حسابی یافت نشد. می‌توانید از بخش مدیریت حساب‌ها یک حساب ایجاد کنید.
            </p>
          )}
        </div>

        {phases.length > 0 && (
          <div>
            <Select
              label="فاز حساب (اختیاری)"
              value={selectedPhaseId}
              onChange={(e) => setSelectedPhaseId(e.target.value)}
              options={[
                { value: '', label: 'بدون فاز مشخص' },
                ...phases.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.status})`,
                })),
              ]}
            />
          </div>
        )}
      </div>

      {/* Symbol & Direction */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1 w-full">
            <Input
              label="نماد معاملاتی (Symbol) *"
              placeholder="مثال: EURUSD یا XAUUSD"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              error={errors.symbol}
            />
          </div>

          {/* Direction toggle */}
          <div className="w-full sm:w-auto">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              جهت معامله (Direction) *
            </label>
            <div className="grid grid-cols-2 gap-2 h-[42px]">
              <button
                type="button"
                onClick={() => setSide('buy')}
                className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm transition-all border ${
                  side === 'buy'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                }`}
              >
                <span>🟢</span>
                <span>خرید (BUY)</span>
              </button>

              <button
                type="button"
                onClick={() => setSide('sell')}
                className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm transition-all border ${
                  side === 'sell'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                }`}
              >
                <span>🔴</span>
                <span>فروش (SELL)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick symbol chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">نمادهای پرتکرار:</span>
          {COMMON_SYMBOLS.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setSymbol(item.name)}
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                symbol === item.name
                  ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-700 font-bold'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Volume, Entry & Exit prices */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Input
            label="حجم معامله (Lot) *"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="مثال: 0.10 یا 1.00"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            error={errors.volume}
          />
          <div className="flex gap-1 mt-1">
            {['0.01', '0.05', '0.10', '0.50', '1.00'].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setVolume(val)}
                className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Input
            label="قیمت ورود (Entry Price) *"
            type="number"
            step="any"
            placeholder="مثال: 1.08500"
            value={entryPrice}
            onChange={(e) => setEntryPrice(e.target.value)}
            error={errors.entryPrice}
          />
        </div>

        <div>
          <Input
            label="قیمت خروج (Exit Price) *"
            type="number"
            step="any"
            placeholder="مثال: 1.09200"
            value={exitPrice}
            onChange={(e) => setExitPrice(e.target.value)}
            error={errors.exitPrice}
          />
        </div>
      </div>

      {/* Stop Loss & Take Profit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="حد ضرر (Stop Loss - اختیاری)"
          type="number"
          step="any"
          placeholder="مثال: 1.08200"
          value={stopLoss}
          onChange={(e) => setStopLoss(e.target.value)}
        />
        <Input
          label="حد سود (Take Profit - اختیاری)"
          type="number"
          step="any"
          placeholder="مثال: 1.09500"
          value={takeProfit}
          onChange={(e) => setTakeProfit(e.target.value)}
        />
      </div>

      {/* Datetimes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Input
            label="تاریخ و زمان ورود *"
            type="datetime-local"
            value={entryDatetime}
            onChange={(e) => setEntryDatetime(e.target.value)}
            error={errors.entryDatetime}
          />
        </div>
        <div>
          <Input
            label="تاریخ و زمان خروج *"
            type="datetime-local"
            value={exitDatetime}
            onChange={(e) => setExitDatetime(e.target.value)}
            error={errors.exitDatetime}
          />
        </div>
      </div>

      {/* Profit / Loss section with auto-calculate */}
      <div className="p-4 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              سود / زیان دلاری (Profit/Loss $) *
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              مبلغ نهایی سود (مثبت) یا زیان (منفی با علامت منفی -) را وارد کنید یا از محاسبه خودکار استفاده نمایید.
            </p>
          </div>

          {calculatedEstimatedProfit !== null && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplyCalculatedProfit}
              className="text-xs shrink-0 self-start sm:self-auto border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
            >
              ⚡ استفاده از محاسبه خودکار ({calculatedEstimatedProfit >= 0 ? `+${calculatedEstimatedProfit}` : calculatedEstimatedProfit} $)
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="sm:col-span-1">
            <Input
              type="number"
              step="any"
              placeholder="مثال: 150 یا -75.5"
              value={profit}
              onChange={(e) => setProfit(e.target.value)}
              error={errors.profit}
              className="font-bold text-base"
            />
          </div>

          <div className="sm:col-span-2 flex items-center gap-3">
            {profit !== '' && !isNaN(parseFloat(profit)) ? (
              parseFloat(profit) >= 0 ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-100/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs">
                  <span className="text-base">✅</span>
                  <span>معامله سودده: <strong>+{parseFloat(profit).toLocaleString()} $</strong></span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-100/80 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs">
                  <span className="text-base">🔻</span>
                  <span>معامله زیان‌ده: <strong>{parseFloat(profit).toLocaleString()} $</strong></span>
                </div>
              )
            ) : calculatedEstimatedProfit !== null ? (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                تخمین سیستمی بر اساس پیپ: <strong className={calculatedEstimatedProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                  {calculatedEstimatedProfit >= 0 ? `+${calculatedEstimatedProfit}` : calculatedEstimatedProfit} $
                </strong>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Commission, Swap, Ticket & Comment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Input
          label="کارمزد (Commission $)"
          type="number"
          step="any"
          placeholder="0"
          value={commission}
          onChange={(e) => setCommission(e.target.value)}
        />
        <Input
          label="سوآپ (Swap $)"
          type="number"
          step="any"
          placeholder="0"
          value={swap}
          onChange={(e) => setSwap(e.target.value)}
        />
        <Input
          label="شماره تیکت/سفارش (اختیاری)"
          placeholder="خودکار یا شماره دستی"
          value={ticket}
          onChange={(e) => setTicket(e.target.value)}
        />
        <Input
          label="یادداشت یا کامنت کوتاه"
          placeholder="مثال: بریک اوت سطح مقاومت"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      {/* Analytical & Journal Details Section (Timeframes, Sessions, Market Bias, Confluences) */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-gray-200/70 dark:border-gray-700/60">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              📊 جزئیات تحلیلی و تاییده‌های معامله (ژورنال)
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              اختیاری
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            انتخاب چندگانه یا تکی از منوی کشویی و پیش‌فرض‌ها
          </p>
        </div>

        {/* Timeframes & Sessions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MultiSelect
            label="تایم‌فریم‌های تحلیل و ورود (Timeframes)"
            placeholder="انتخاب یک یا چند تایم‌فریم..."
            options={TIMEFRAME_OPTIONS}
            presets={COMMON_TIMEFRAME_PRESETS}
            selectedValues={timeframes}
            onChange={setTimeframes}
            allowCustom={true}
            customPlaceholder="تایپ تایم‌فریم دلخواه (مثلاً M2)..."
            helperText="قابلیت انتخاب همزمان چند تایم‌فریم مانند H4 و M15 برای تحلیل چندزمانه"
          />

          <MultiSelect
            label="نشست معاملاتی (Trading Session)"
            placeholder="انتخاب نشست‌های فعال..."
            options={TRADING_SESSION_OPTIONS}
            selectedValues={sessions}
            onChange={setSessions}
            allowCustom={true}
            customPlaceholder="تایپ سشن دلخواه..."
            helperText="نشست‌های فعال بازار هنگام باز شدن یا بستن معامله"
          />
        </div>

        {/* Market Bias & Confluences */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MultiSelect
            label="جهت‌گیری / بایاس بازار (Market Bias)"
            placeholder="انتخاب بایاس مارکت..."
            options={MARKET_BIAS_OPTIONS}
            selectedValues={marketBias}
            onChange={setMarketBias}
            allowCustom={true}
            customPlaceholder="تایپ یا انتخاب بایاس..."
            helperText="دیدگاه ساختاری و جهت کلی قیمت در زمان ورود"
          />

          <MultiSelect
            label="همگرایی‌ها و تاییده‌ها (Confluences)"
            placeholder="انتخاب تاییده‌های ورود (BOS، اوردربلاک، FVG و...)..."
            options={CONFLUENCE_OPTIONS}
            presets={COMMON_CONFLUENCE_PRESETS}
            selectedValues={confluences}
            onChange={setConfluences}
            allowCustom={true}
            customPlaceholder="افزودن تاییدیه دلخواه..."
            helperText="دلایل و فاکتورهای تکنیکال تاییدکننده تصمیم ورود"
          />
        </div>

        {/* Strategy & Setup */}
        {(strategies.length > 0 || setups.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <Select
              label="استراتژی معاملاتی"
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
              options={[
                { value: '', label: 'بدون استراتژی' },
                ...strategies.map(s => ({ value: s.id, label: s.name })),
              ]}
            />

            <Select
              label="ستاپ ورود"
              value={setupId}
              onChange={(e) => setSetupId(e.target.value)}
              options={[
                { value: '', label: 'بدون ستاپ' },
                ...setups.map(s => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              انصراف
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <Button
            type="submit"
            variant="secondary"
            onClick={() => setSubmitIntent('save')}
            disabled={submitting}
            className="w-full sm:w-auto"
          >
            {submitting && submitIntent === 'save' ? 'در حال ذخیره...' : 'ذخیره معامله'}
          </Button>

          <Button
            type="submit"
            onClick={() => setSubmitIntent('journal')}
            disabled={submitting}
            className="w-full sm:w-auto shadow-md"
          >
            {submitting && submitIntent === 'journal' ? (
              'در حال ذخیره و انتقال...'
            ) : (
              <span className="flex items-center gap-1.5">
                <span>ذخیره و ورود به ژورنال معامله</span>
                <span>✍️</span>
              </span>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
