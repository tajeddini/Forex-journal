// ============================================================
// Standard Trading Options & Presets
// Constants for fixed dropdown and multi-select trading fields
// ============================================================

import type { MultiSelectOption } from '../components/ui/MultiSelect';

// --- Timeframes ---
export const TIMEFRAME_OPTIONS: MultiSelectOption[] = [
  // Lower Timeframes (LTF)
  { value: '1m', label: '۱ دقیقه (M1)', badge: 'LTF', group: 'تایم‌فریم‌های ورود (LTF)' },
  { value: '3m', label: '۳ دقیقه (M3)', badge: 'LTF', group: 'تایم‌فریم‌های ورود (LTF)' },
  { value: '5m', label: '۵ دقیقه (M5)', badge: 'LTF', group: 'تایم‌فریم‌های ورود (LTF)' },
  { value: '15m', label: '۱۵ دقیقه (M15)', badge: 'MTF', group: 'تایم‌فریم‌های میانی (MTF)' },
  { value: '30m', label: '۳۰ دقیقه (M30)', badge: 'MTF', group: 'تایم‌فریم‌های میانی (MTF)' },
  // Higher Timeframes (HTF)
  { value: '1h', label: '۱ ساعت (H1)', badge: 'HTF', group: 'تایم‌فریم‌های ساختار (HTF)' },
  { value: '2h', label: '۲ ساعت (H2)', badge: 'HTF', group: 'تایم‌فریم‌های ساختار (HTF)' },
  { value: '4h', label: '۴ ساعت (H4)', badge: 'HTF', group: 'تایم‌فریم‌های ساختار (HTF)' },
  { value: 'Daily', label: 'روزانه (D1)', badge: 'HTF', group: 'تایم‌فریم‌های کلان (Macro)' },
  { value: 'Weekly', label: 'هفتگی (W1)', badge: 'Macro', group: 'تایم‌فریم‌های کلان (Macro)' },
  { value: 'Monthly', label: 'ماهانه (MN)', badge: 'Macro', group: 'تایم‌فریم‌های کلان (Macro)' },
];

export const COMMON_TIMEFRAME_PRESETS: MultiSelectOption[] = [
  { value: '5m', label: 'M5' },
  { value: '15m', label: 'M15' },
  { value: '1h', label: 'H1' },
  { value: '4h', label: 'H4' },
  { value: 'Daily', label: 'D1' },
];

// --- Market Bias ---
export const MARKET_BIAS_OPTIONS: MultiSelectOption[] = [
  { value: 'صعودی (Bullish)', label: 'صعودی (Bullish 🐂)', color: 'emerald' },
  { value: 'صعودی قوی (Strong Bullish)', label: 'صعودی قوی (Strong Bullish 🚀)', color: 'emerald' },
  { value: 'نزولی (Bearish)', label: 'نزولی (Bearish 🐻)', color: 'rose' },
  { value: 'نزولی قوی (Strong Bearish)', label: 'نزولی قوی (Strong Bearish 📉)', color: 'rose' },
  { value: 'رنج / خنثی (Range)', label: 'رنج / خنثی (Range ↔️)', color: 'amber' },
  { value: 'شکست ساختار (Breakout)', label: 'شکست ساختار (Breakout ⚡)', color: 'blue' },
  { value: 'برگشت روند (Reversal)', label: 'برگشت روند (Reversal 🔄)', color: 'purple' },
];

// --- Trading Sessions ---
export const TRADING_SESSION_OPTIONS: MultiSelectOption[] = [
  { value: 'لندن (London)', label: 'نشست لندن (London 🇬🇧)', badge: '08:00 - 16:30' },
  { value: 'نیویورک (New York)', label: 'نشست نیویورک (New York 🇺🇸)', badge: '13:00 - 22:00' },
  { value: 'هم‌پوشانی لندن-نیویورک', label: 'هم‌پوشانی لندن و نیویورک (Overlap ⚡)', badge: '13:00 - 16:30' },
  { value: 'توکیو / آسیا (Asian)', label: 'نشست توکیو / آسیا (Asian 🇯🇵)', badge: '00:00 - 09:00' },
  { value: 'سیدنی (Sydney)', label: 'نشست سیدنی (Sydney 🇦🇺)', badge: '22:00 - 07:00' },
];

// --- Confluences / Setup Triggers ---
export const CONFLUENCE_OPTIONS: MultiSelectOption[] = [
  { value: 'شکست ساختار (BOS)', label: 'شکست ساختار (BOS - Break of Structure)', group: 'اسمارت مانی (SMC)' },
  { value: 'تغییر ماهیت روند (CHoCH)', label: 'تغییر ماهیت روند (CHoCH)', group: 'اسمارت مانی (SMC)' },
  { value: 'اوردربلاک (Order Block)', label: 'اوردربلاک تایید شده (OB)', group: 'اسمارت مانی (SMC)' },
  { value: 'گپ ارزش منصفانه (FVG)', label: 'گپ ارزش منصفانه (FVG - Imbalance)', group: 'اسمارت مانی (SMC)' },
  { value: 'جاروی نقدینگی (Liquidity Sweep)', label: 'جاروی نقدینگی سقف/کف (Liquidity Sweep)', group: 'اسمارت مانی (SMC)' },
  { value: 'سطح طلایی فیبوناچی (0.618)', label: 'نسبت طلایی فیبوناچی (0.618 - 0.786)', group: 'پرایس اکشن و هندسی' },
  { value: 'سطح کلیدی حمایت / مقاومت', label: 'سطح کلیدی افقی (Key Support / Resistance)', group: 'پرایس اکشن و هندسی' },
  { value: 'برخورد به خط روند (Trendline)', label: 'برخورد / واکنش به خط روند', group: 'پرایس اکشن و هندسی' },
  { value: 'شکست و پولبک خط روند', label: 'شکست و پولبک به خط روند (Break & Retest)', group: 'پرایس اکشن و هندسی' },
  { value: 'الگوی کندل برگشتی (Pin Bar / Engulfing)', label: 'کندل تاییدیه پین‌بار یا انگلفینگ', group: 'کندل‌استیک' },
  { value: 'سقف / کف روز قبل (PDH / PDL)', label: 'واکنش به سقف یا کف روز قبل (PDH / PDL)', group: 'سطوح نشست‌ها' },
  { value: 'واگرایی اندیکاتور (RSI/MACD)', label: 'واگرایی مثبت / منفی RSI یا MACD', group: 'اندیکاتورها' },
  { value: 'تقاطع یا پولبک میانگین متحرک (EMA)', label: 'پولبک به میانگین متحرک (20 / 50 / 200 EMA)', group: 'اندیکاتورها' },
  { value: 'اسپایک حجم معاملات (Volume Spike)', label: 'افزایش غیرعادی حجم معاملات', group: 'حجم' },
];

export const COMMON_CONFLUENCE_PRESETS: MultiSelectOption[] = [
  { value: 'شکست ساختار (BOS)', label: 'BOS' },
  { value: 'اوردربلاک (Order Block)', label: 'Order Block' },
  { value: 'گپ ارزش منصفانه (FVG)', label: 'FVG' },
  { value: 'جاروی نقدینگی (Liquidity Sweep)', label: 'Liquidity' },
  { value: 'سطح طلایی فیبوناچی (0.618)', label: 'Fib 0.618' },
  { value: 'واگرایی اندیکاتور (RSI/MACD)', label: 'Divergence' },
];

// --- Market Context / Market Conditions ---
export const MARKET_CONTEXT_OPTIONS: MultiSelectOption[] = [
  { value: 'روند صعودی پرقدرت', label: 'روند صعودی پرقدرت (Strong Uptrend)' },
  { value: 'روند نزولی پرقدرت', label: 'روند نزولی پرقدرت (Strong Downtrend)' },
  { value: 'کانال رنج فشرده', label: 'کانال رنج فشرده (Tight Consolidation)' },
  { value: 'نزدیک به سقف تاریخی (ATH)', label: 'نزدیک به سقف تاریخی (All-Time High)' },
  { value: 'نزدیک به کف تاریخی (ATL)', label: 'نزدیک به کف تاریخی (All-Time Low)' },
  { value: 'نوسانات ناشی از اخبار اقتصادی', label: 'نوسانات ناشی از خبر مهم (CPI / NFP / FOMC)' },
  { value: 'نقدینگی پایین / قبل از بازگشایی سشن', label: 'نقدینگی پایین / پیش‌گشایش بازار' },
  { value: 'انتهای هفته معاملاتی', label: 'انتهای روز جمعه / کلوز هفتگی' },
];

// --- Exit Reasons ---
export const EXIT_REASON_OPTIONS: MultiSelectOption[] = [
  { value: 'برخورد با حد سود (TP Hit)', label: 'برخورد با حد سود کامل (Take Profit 🎯)' },
  { value: 'برخورد با حد ضرر (SL Hit)', label: 'برخورد با حد ضرر (Stop Loss 🛑)' },
  { value: 'خروج سر‌به‌سر (Breakeven)', label: 'خروج در نقطه ورود / سر‌به‌سر (Breakeven 🛡️)' },
  { value: 'ابطال تحلیل تکنیکال', label: 'ابطال ساختار تکنیکال و سناریو (Invalidation ❌)' },
  { value: 'خروج دستی به دلیل سود کافی', label: 'خروج دستی با سود مناسب قبل از تارگت (Manual TP 💰)' },
  { value: 'خروج قبل از انتشار اخبار مهم', label: 'خروج محافظه‌کارانه قبل از خبر (News Pre-Exit 📰)' },
  { value: 'خروج در پایان سشن معاملاتی', label: 'خروج قبل از بسته شدن سشن روزانه (Session Close ⏱️)' },
  { value: 'خروج احساسی / ترس از معامله', label: 'خروج شتاب‌زده یا احساسی (Fear / FOMO Exit 😰)' },
];

// Helper to convert comma-separated string to string array
export function parseDelimitedString(val: string | null | undefined, delimiter: string = ','): string[] {
  if (!val || typeof val !== 'string') return [];
  return val
    .split(delimiter)
    .map(s => s.trim())
    .filter(Boolean);
}

// Helper to convert string array to comma-separated string
export function joinDelimitedString(items: string[], delimiter: string = ', '): string {
  if (!items || items.length === 0) return '';
  return items.map(s => s.trim()).filter(Boolean).join(delimiter);
}
