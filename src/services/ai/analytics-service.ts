// ============================================================
// Phase 14 AI Analytics Service
// Pure deterministic analysis + AI interpretation for:
// 1. AI Trade Review
// 2. AI Auto-Tagging
// 3. AI Weekly/Monthly Reviews with period comparison & trends
//
// NEVER executes trades, NEVER mutates records autonomously,
// ALWAYS enforces user isolation and data sanitization.
// ============================================================

import type { Trade, TradingAccount, AccountPhase, TradeJournal, Strategy, Setup, Tag, Mistake } from '../../types/database';
import type {
  AIProvider,
  AITradeReviewResponse,
  AIAutoTagResponse,
  AIAutoTagItem,
  AIReportResponse,
  PeriodComparison,
} from './types';
import { classifyTrades, calculateCoreMetrics } from '../analytics/metrics';
import { analyzeByHour, analyzeByDay } from '../analytics/timeAnalytics';
import { analyzeByRuleAdherence } from '../analytics/psychologyAnalytics';
import { calculateDurationMetrics } from '../analytics/aggregation';
import { validateTradeReviewResponse, validateAutoTagResponse, validatePeriodicReportResponse } from './response-validation';

export interface TradeAnalysisContextData {
  trade: Trade;
  journal?: TradeJournal | null;
  account?: TradingAccount | null;
  phase?: AccountPhase | null;
  strategy?: Strategy | null;
  setup?: Setup | null;
  tags?: Tag[];
  mistakes?: Mistake[];
  historicalMetrics?: Record<string, any>;
}

export interface AutoTagReferenceData {
  trade: Trade;
  journal?: TradeJournal | null;
  strategies: Strategy[];
  setups: Setup[];
  tags: Tag[];
  mistakes: Mistake[];
}

export interface PeriodicReviewContextData {
  periodType: 'weekly' | 'monthly';
  periodTitle: string;
  startDate: string;
  endDate: string;
  currentTrades: Trade[];
  currentJournals?: TradeJournal[];
  previousTrades?: Trade[];
  account?: TradingAccount | null;
  phase?: AccountPhase | null;
  strategies?: Strategy[];
  setups?: Setup[];
  mistakes?: Mistake[];
}

/**
 * Deterministically computes objective trade review facts
 */
export function buildDeterministicTradeSummary(ctx: TradeAnalysisContextData) {
  const { trade, journal } = ctx;
  const pnl = Number(trade.profit) || 0;
  const isWin = pnl > 0;
  const isLoss = pnl < 0;
  const durationMin = trade.duration_seconds ? Math.round(trade.duration_seconds / 60) : null;

  // Risk Reward calculation if SL/TP available
  let riskRewardRatio: string | null = null;
  if (trade.stop_loss && trade.take_profit && trade.entry_price) {
    const riskDiff = Math.abs(trade.entry_price - trade.stop_loss);
    const rewardDiff = Math.abs(trade.take_profit - trade.entry_price);
    if (riskDiff > 0) {
      const rr = (rewardDiff / riskDiff).toFixed(2);
      riskRewardRatio = `1:${rr}`;
    }
  }

  const facts: string[] = [
    `نماد معاملاتی: ${trade.symbol} | جهت: ${trade.side === 'buy' ? 'خرید (BUY)' : 'فروش (SELL)'}`,
    `حجم معامله: ${trade.volume} لات | سود/زیان خالص: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}$`,
    `قیمت ورود: ${trade.entry_price} | قیمت خروج: ${trade.exit_price}`,
    `زمان ورود: ${trade.entry_datetime} | زمان خروج: ${trade.exit_datetime}`,
  ];

  if (durationMin !== null) {
    facts.push(`مدت زمان باز بودن پوزیشن: ${durationMin} دقیقه`);
  }
  if (trade.stop_loss) {
    facts.push(`حد ضرر (SL): ${trade.stop_loss}`);
  }
  if (trade.take_profit) {
    facts.push(`حد سود (TP): ${trade.take_profit}`);
  }
  if (riskRewardRatio) {
    facts.push(`نسبت ریسک به ریوارد طراحی‌شده: ${riskRewardRatio}`);
  }
  if (ctx.strategy) {
    facts.push(`استراتژی ثبت‌شده: ${ctx.strategy.name}`);
  }
  if (ctx.setup) {
    facts.push(`ستاپ ورود: ${ctx.setup.name}`);
  }

  return {
    facts,
    isWin,
    isLoss,
    pnl,
    durationMin,
    riskRewardRatio,
    ruleAdherence: journal?.rule_adherence || 'not_set',
  };
}

/**
 * Builds AI prompt for Trade Review ensuring strict evidence and zero hallucination
 */
export function buildTradeReviewPrompt(ctx: TradeAnalysisContextData): string {
  const summary = buildDeterministicTradeSummary(ctx);
  const { trade, journal } = ctx;

  const promptParts: string[] = [
    'شما یک دستیار تحلیلگر حرفه‌ای و منضبط ژورنال معاملات فارکس هستید.',
    'دستورالعمل‌های حیاتی:',
    '۱. تنها بر اساس شواهد و فکت‌های ارائه‌شده قضاوت کنید. هرگز اطلاعات ناموجود را اختراع نکنید.',
    '۲. اگر دلیلی در ژورنال ثبت نشده، بنویسید که داده‌ای ثبت نشده است و گمانه‌زنی نکنید.',
    '۳. ادعاهای قطعی روان‌شناختی یا پزشکی نکنید و فقط احساسات ثبت‌شده در ژورنال را نقل و تحلیل کنید.',
    '۴. حداکثر ۳ درس کاربردی و عملیاتی (نه کلیشه‌ای) ارائه دهید.',
    '۵. پاسخ نهایی باید ساختاریافته به فرمت JSON معتبر بدون هیچ تگ اضافی باشد.',
    '',
    '--- فکت‌های قطعی معامله ---',
    ...summary.facts,
  ];

  if (journal) {
    promptParts.push('');
    promptParts.push('--- اطلاعات ژورنال معامله ---');
    if (journal.rule_adherence) promptParts.push(`وضعیت رعایت قوانین: ${journal.rule_adherence}`);
    if (journal.execution_quality) promptParts.push(`کیفیت اجرای معامله: ${journal.execution_quality}`);
    if (journal.confidence) promptParts.push(`سطح اعتماد به نفس: ${journal.confidence}`);
    if (journal.emotion_before) promptParts.push(`احساس قبل از ورود: ${journal.emotion_before}`);
    if (journal.emotion_during) promptParts.push(`احساس حین معامله: ${journal.emotion_during}`);
    if (journal.emotion_after) promptParts.push(`احساس پس از خروج: ${journal.emotion_after}`);
    if (journal.entry_reason) promptParts.push(`علت ورود به پوزیشن: ${journal.entry_reason}`);
    if (journal.what_went_well) promptParts.push(`نقاط قوت ثبت‌شده توسط تریدر: ${journal.what_went_well}`);
    if (journal.what_went_wrong) promptParts.push(`اشتباهات یا نقاط ضعف ثبت‌شده: ${journal.what_went_wrong}`);
    if (journal.lesson_learned) promptParts.push(`درس آموخته‌شده تریدر: ${journal.lesson_learned}`);
  }

  if (ctx.mistakes && ctx.mistakes.length > 0) {
    promptParts.push(`اشتباهات الصاق‌شده: ${ctx.mistakes.map(m => m.name).join('، ')}`);
  }

  promptParts.push('');
  promptParts.push('یک شیء JSON با فیلدهای زیر تولید کنید:');
  promptParts.push('{');
  promptParts.push('  "summary": "خلاصه کوتاه عملکرد این معامله",');
  promptParts.push('  "whatWentWell": ["نقاط قوت مستند"],');
  promptParts.push('  "whatCouldBeImproved": ["نقاط ضعف و قابل بهبود"],');
  promptParts.push('  "ruleAdherenceAnalysis": { "status": "followed" | "partially_followed" | "violated" | "not_set", "explanation": "توضیح پایبندی به قوانین" },');
  promptParts.push('  "riskManagementAnalysis": { "plannedRisk": "...", "actualRisk": "...", "riskRewardRatio": "...", "assessment": "بررسی مدیریت ریسک" },');
  promptParts.push('  "psychologyAnalysis": { "observedEmotions": [...], "assessment": "بررسی روانشناسی بر اساس هیجانات ثبت‌شده" },');
  promptParts.push('  "actionableLessons": ["حداکثر ۳ درس عملیاتی"],');
  promptParts.push('  "facts": ["فکت‌های اصلی"],');
  promptParts.push('  "observations": ["مشاهدات تحلیلی"],');
  promptParts.push('  "possiblePatterns": ["الگوهای مشاهده‌شده"],');
  promptParts.push('  "questionsForTrader": ["سوالات خودارزیابی تریدر"],');
  promptParts.push('  "limitations": ["محدودیت‌های آماری این معامله تکی"]');
  promptParts.push('}');

  return promptParts.join('\n');
}

/**
 * Builds AI prompt for Auto-Tagging ensuring distinction between existing items and new proposals
 */
export function buildAutoTagPrompt(ctx: AutoTagReferenceData): string {
  const { trade, journal, strategies, setups, tags, mistakes } = ctx;

  const promptParts: string[] = [
    'شما سیستم هوشمند پیشنهاد تگ، ستاپ و خطاهای معامله در ژورنال هستید.',
    'قوانین اکید:',
    '۱. تمام پیشنهادات فقط بر اساس داده‌های این معامله باشد.',
    '۲. اگر ستاپ یا تگ یا اشتباهی در لیست موجود بود، از نام دقیق همان استفاده کنید و isExisting: true قرار دهید.',
    '۳. اگر آیتم جدیدی پیشنهاد می‌کنید، آن را به عنوان آیتم جدید علامت زده و isExisting: false قرار دهید.',
    '۴. به هیچ عنوان این تگ‌ها را خودکار ذخیره نکنید؛ کاربر حق انتخاب دارد.',
    '',
    '--- داده‌های معامله ---',
    `نماد: ${trade.symbol} | جهت: ${trade.side} | حجم: ${trade.volume} | سود/زیان: ${trade.profit}$`,
    `مدت زمان: ${trade.duration_seconds ? Math.round(trade.duration_seconds / 60) + ' دقیقه' : 'نامشخص'}`,
    `توضیحات: ${trade.comment || 'ثبت نشده'}`,
  ];

  if (journal) {
    if (journal.entry_reason) promptParts.push(`دلیل ورود: ${journal.entry_reason}`);
    if (journal.market_context) promptParts.push(`کانتکست بازار: ${journal.market_context}`);
    if (journal.what_went_well) promptParts.push(`نقاط قوت: ${journal.what_went_well}`);
    if (journal.what_went_wrong) promptParts.push(`نقاط ضعف: ${journal.what_went_wrong}`);
    if (journal.lesson_learned) promptParts.push(`درس آموخته‌شده: ${journal.lesson_learned}`);
    if (journal.emotion_before) promptParts.push(`هیجان ورود: ${journal.emotion_before}`);
  }

  promptParts.push('');
  promptParts.push('--- اقلام موجود در حساب کاربر ---');
  promptParts.push(`استراتژی‌های موجود: ${strategies.map(s => `[${s.id}] ${s.name}`).join(' | ') || 'هیچکدام'}`);
  promptParts.push(`ستاپ‌های موجود: ${setups.map(s => `[${s.id}] ${s.name}`).join(' | ') || 'هیچکدام'}`);
  promptParts.push(`تگ‌های موجود: ${tags.map(t => `[${t.id}] ${t.name}`).join(' | ') || 'هیچکدام'}`);
  promptParts.push(`اشتباهات تعریف‌شده: ${mistakes.map(m => `[${m.id}] ${m.name}`).join(' | ') || 'هیچکدام'}`);

  promptParts.push('');
  promptParts.push('یک شیء JSON با فیلد structuredSuggestions شامل آرایه‌ای از اقلام زیر تولید کنید:');
  promptParts.push('{');
  promptParts.push('  "suggestions": [');
  promptParts.push('    { "tagName": "نام آیتم", "reason": "علت پیشنهاد", "confidence": 85, "type": "tag" | "strategy" | "setup" | "mistake" | "emotion", "isExisting": true }');
  promptParts.push('  ],');
  promptParts.push('  "structuredSuggestions": [');
  promptParts.push('    { "type": "tag"|"strategy"|"setup"|"mistake"|"emotion"|"ruleAdherence", "id": "شناسه در صورت موجود بودن", "name": "نام", "isExisting": boolean, "reason": "دلیل شواهد", "confidence": number }');
  promptParts.push('  ]');
  promptParts.push('}');

  return promptParts.join('\n');
}

/**
 * Computes deterministic statistics and period comparisons for Periodic Reviews (Weekly/Monthly)
 */
export function computeDeterministicPeriodicData(ctx: PeriodicReviewContextData) {
  const currentCount = ctx.currentTrades.length;
  const currentClassified = classifyTrades(ctx.currentTrades);
  const currentMetrics = calculateCoreMetrics(currentClassified);
  const currentHourly = analyzeByHour(currentClassified);
  const currentDaily = analyzeByDay(currentClassified);
  const currentDuration = calculateDurationMetrics(currentClassified);
  const currentRuleAdherence = analyzeByRuleAdherence(currentClassified);

  // Symbol metrics
  const symbolStats: Record<string, { trades: number; profit: number; wins: number }> = {};
  for (const t of ctx.currentTrades) {
    if (!symbolStats[t.symbol]) symbolStats[t.symbol] = { trades: 0, profit: 0, wins: 0 };
    symbolStats[t.symbol].trades += 1;
    symbolStats[t.symbol].profit += Number(t.profit) || 0;
    if ((Number(t.profit) || 0) > 0) symbolStats[t.symbol].wins += 1;
  }

  const sortedSymbols = Object.entries(symbolStats)
    .map(([sym, stats]) => ({
      symbol: sym,
      ...stats,
      winRate: stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0,
    }))
    .sort((a, b) => b.profit - a.profit);

  const bestSymbol = sortedSymbols.length > 0 && sortedSymbols[0].trades >= 1 ? sortedSymbols[0] : null;
  const weakestSymbol = sortedSymbols.length > 1 && sortedSymbols[sortedSymbols.length - 1].trades >= 1
    ? sortedSymbols[sortedSymbols.length - 1]
    : null;

  // Comparison with previous period if trades exist
  const comparisons: PeriodComparison[] = [];
  if (ctx.previousTrades && ctx.previousTrades.length > 0) {
    const prevClassified = classifyTrades(ctx.previousTrades);
    const prevMetrics = calculateCoreMetrics(prevClassified);
    const prevDuration = calculateDurationMetrics(prevClassified);

    const prevCount = ctx.previousTrades.length;

    // Total Trades Comparison
    comparisons.push({
      metric: 'تعداد معاملات (Total Trades)',
      currentValue: currentCount,
      previousValue: prevCount,
      change: currentCount - prevCount,
      interpretation:
        currentCount > prevCount
          ? `افزایش ${currentCount - prevCount} معامله نسبت به دوره قبل`
          : currentCount < prevCount
          ? `کاهش ${prevCount - currentCount} معامله نسبت به دوره قبل`
          : 'تعداد معاملات بدون تغییر مانده است',
      sampleSize: { current: currentCount, previous: prevCount },
    });

    // Win Rate Comparison
    const curWr = currentMetrics.winRate ?? 0;
    const prevWr = prevMetrics.winRate ?? 0;
    const wrDiff = Number((curWr - prevWr).toFixed(1));
    comparisons.push({
      metric: 'نرخ برد (Win Rate)',
      currentValue: `${curWr.toFixed(1)}%`,
      previousValue: `${prevWr.toFixed(1)}%`,
      change: `${wrDiff > 0 ? '+' : ''}${wrDiff}%`,
      interpretation:
        wrDiff > 0
          ? `نرخ برد ${wrDiff}٪ رشد داشته است (حجم نمونه فعلی: ${currentCount})`
          : wrDiff < 0
          ? `نرخ برد ${Math.abs(wrDiff)}٪ افت داشته است (حجم نمونه فعلی: ${currentCount})`
          : 'نرخ برد بدون تغییر بوده است',
      sampleSize: { current: currentCount, previous: prevCount },
    });

    // Net PnL Comparison
    const curPnl = currentMetrics.netPnl;
    const prevPnl = prevMetrics.netPnl;
    const pnlDiff = Number((curPnl - prevPnl).toFixed(2));
    comparisons.push({
      metric: 'سود/زیان خالص (Net PnL)',
      currentValue: `${curPnl.toFixed(2)}$`,
      previousValue: `${prevPnl.toFixed(2)}$`,
      change: `${pnlDiff > 0 ? '+' : ''}${pnlDiff}$`,
      interpretation:
        pnlDiff > 0
          ? `بهبود سود خالص به میزان ${pnlDiff}$`
          : pnlDiff < 0
          ? `کاهش سودآوری به میزان ${Math.abs(pnlDiff)}$`
          : 'سود خالص در همان سطح باقی مانده است',
      sampleSize: { current: currentCount, previous: prevCount },
    });

    // Profit Factor Comparison
    const curPf = currentMetrics.profitFactor ?? 0;
    const prevPf = prevMetrics.profitFactor ?? 0;
    const pfDiff = Number((curPf - prevPf).toFixed(2));
    comparisons.push({
      metric: 'فاکتور سود (Profit Factor)',
      currentValue: curPf.toFixed(2),
      previousValue: prevPf.toFixed(2),
      change: `${pfDiff > 0 ? '+' : ''}${pfDiff}`,
      interpretation:
        pfDiff > 0
          ? `افزایش فاکتور سود از ${prevPf.toFixed(2)} به ${curPf.toFixed(2)}`
          : pfDiff < 0
          ? `کاهش فاکتور سود از ${prevPf.toFixed(2)} به ${curPf.toFixed(2)}`
          : 'فاکتور سود پایدار بوده است',
      sampleSize: { current: currentCount, previous: prevCount },
    });
  }

  return {
    sampleSize: currentCount,
    metrics: currentMetrics,
    hourly: currentHourly,
    daily: currentDaily,
    duration: currentDuration,
    ruleAdherence: currentRuleAdherence,
    bestSymbol,
    weakestSymbol,
    comparisons,
    isSufficientData: currentCount >= 3,
  };
}

/**
 * Builds AI prompt for Weekly/Monthly Review
 */
export function buildPeriodicReportPrompt(ctx: PeriodicReviewContextData): string {
  const deterministic = computeDeterministicPeriodicData(ctx);

  const promptParts: string[] = [
    `شما یک مربی و تحلیلگر مالی ارشد ژورنال معاملاتی فارکس برای دوره ${ctx.periodType === 'weekly' ? 'هفتگی' : 'ماهانه'} هستید.`,
    'قوانین تحلیلی بدون اغراق و پایبند به شواهد:',
    '۱. محاسبات ریاضی انجام شده و فکت‌های قطعی در اختیارتان قرار گرفته است. هیچ عدد ساختگی ارائه نکنید.',
    '۲. اگر تعداد معاملات کم است (کمتر از ۵ تا ۱۰ معامله)، حتماً در مشاهدات و محدودیت‌ها ذکر کنید که نمونه کوچک است و نباید نتیجه‌گیری قطعی گرفت.',
    '۳. ادعاهایی مانند "شما در سشن لندن ضعیف هستید" در صورتی که تعداد معاملات کم است، باید به شکل مشروط و توصیفی ("در میان ۳ معامله انتخاب‌شده...") بیان شود.',
    '۴. حتماً دقیقاً ۳ اولویت عملیاتی کلیدی (نه کلیشه‌ای) برای دوره آینده ارائه دهید.',
    '۵. در صورتی که مقایسه با دوره قبل داده شده است، روندها را فقط بر اساس تفاوت ارقام گزارش کنید.',
    '',
    `--- آمار قطعی دوره (${ctx.periodTitle}) ---`,
    `بازه زمانی: ${ctx.startDate} تا ${ctx.endDate}`,
    `تعداد کل معاملات: ${deterministic.sampleSize}`,
    `سود/زیان خالص: ${deterministic.metrics.netPnl.toFixed(2)}$`,
    `نرخ برد: ${deterministic.metrics.winRate?.toFixed(1) || '0'}%`,
    `فاکتور سود: ${deterministic.metrics.profitFactor?.toFixed(2) || '0'}`,
    `امید ریاضی (Expectancy): ${deterministic.metrics.expectancy?.toFixed(2) || '0'}$`,
    `میانگین سود: ${deterministic.metrics.averageWin?.toFixed(2) || '0'}$ | میانگین زیان: ${deterministic.metrics.averageLoss?.toFixed(2) || '0'}$`,
  ];

  if (deterministic.bestSymbol) {
    promptParts.push(`بهترین نماد دوره: ${deterministic.bestSymbol.symbol} با سود ${deterministic.bestSymbol.profit.toFixed(2)}$ (${deterministic.bestSymbol.trades} معامله)`);
  }
  if (deterministic.weakestSymbol) {
    promptParts.push(`ضعیف‌ترین نماد دوره: ${deterministic.weakestSymbol.symbol} با سود ${deterministic.weakestSymbol.profit.toFixed(2)}$ (${deterministic.weakestSymbol.trades} معامله)`);
  }

  if (deterministic.comparisons.length > 0) {
    promptParts.push('');
    promptParts.push('--- مقایسه قطعی با دوره ماقبل ---');
    for (const c of deterministic.comparisons) {
      promptParts.push(`- ${c.metric}: دوره فعلی (${c.currentValue}) در برابر دوره قبل (${c.previousValue}) | تغییر: ${c.change} | ${c.interpretation}`);
    }
  }

  promptParts.push('');
  promptParts.push('یک خروجی JSON با فیلدهای زیر برگردانید:');
  promptParts.push('{');
  promptParts.push('  "title": "عنوان گزارش",');
  promptParts.push('  "summary": "خلاصه مدیریتی عملکرد دوره",');
  promptParts.push('  "performanceInterpretation": "تحلیل تخصصی کارنامه و عملکرد سودآوری",');
  promptParts.push('  "strongBehaviors": ["رفتارهای مثبت و منضبط"],');
  promptParts.push('  "biggestProblems": ["اصلی‌ترین چالش‌ها و رفتارهای مخرب سودآوری"],');
  promptParts.push('  "strategyAnalysis": ["تحلیل استراتژی و ستاپ‌ها بر اساس داده‌های موجود"],');
  promptParts.push('  "psychologyAnalysis": ["تحلیل حالات روحی و هیجانات ثبت‌شده"],');
  promptParts.push('  "riskManagementAnalysis": ["تحلیل رعایت قوانین مدیریت ریسک و سرمایه"],');
  promptParts.push('  "repeatedMistakes": ["اشتباهات مکرر بر اساس شواهد"],');
  promptParts.push('  "topPriorities": ["دقیقاً ۳ اولویت راهبردی مشخص برای دوره بعد"],');
  promptParts.push('  "observations": ["مشاهدات تحلیلی"],');
  promptParts.push('  "recommendations": ["توصیه‌های کاربردی"],');
  promptParts.push('  "limitations": ["محدودیت‌های آماری و حجم داده"]');
  promptParts.push('}');

  return promptParts.join('\n');
}

/**
 * Execute AI Trade Review via the provided AI provider
 */
export async function executeAITradeReview(
  ctx: TradeAnalysisContextData,
  provider: AIProvider
): Promise<AITradeReviewResponse> {
  const prompt = buildTradeReviewPrompt(ctx);
  const response = await provider.generateStructured<AITradeReviewResponse>(prompt);
  const validated = validateTradeReviewResponse(response.data);

  const deterministic = buildDeterministicTradeSummary(ctx);

  // Merge and guarantee deterministic safety
  const data = validated;
  return {
    summary: data.summary || `بررسی معامله ${ctx.trade.symbol} با سود خالص ${ctx.trade.profit}$`,
    whatWentWell: Array.isArray(data.whatWentWell) ? data.whatWentWell : ['ورود با حد ضرر معین'],
    whatCouldBeImproved: Array.isArray(data.whatCouldBeImproved) ? data.whatCouldBeImproved : [],
    ruleAdherenceAnalysis: data.ruleAdherenceAnalysis || {
      status: (deterministic.ruleAdherence as any) || 'not_set',
      explanation: 'تحلیل بر اساس وضعیت ثبت‌شده در ژورنال انجام شد.',
    },
    riskManagementAnalysis: data.riskManagementAnalysis || {
      plannedRisk: null,
      actualRisk: null,
      riskRewardRatio: deterministic.riskRewardRatio,
      assessment: 'مدیریت ریسک ارزیابی شد.',
    },
    psychologyAnalysis: data.psychologyAnalysis || {
      observedEmotions: ctx.journal?.emotion_before ? [ctx.journal.emotion_before] : [],
      assessment: 'ارزیابی روانشناسی بر مبنای یادداشت‌های ثبت‌شده',
    },
    actionableLessons: (Array.isArray(data.actionableLessons) ? data.actionableLessons.slice(0, 3) : [
      'پایبندی بدون تغییر به حد ضرر تعیین‌شده قبل از ورود',
    ]),
    facts: deterministic.facts,
    observations: Array.isArray(data.observations) ? data.observations : [],
    possiblePatterns: Array.isArray(data.possiblePatterns) ? data.possiblePatterns : [],
    questionsForTrader: Array.isArray(data.questionsForTrader) ? data.questionsForTrader : [],
    limitations: Array.isArray(data.limitations) && data.limitations.length > 0 ? data.limitations : [
      'این ارزیابی مربوط به یک تک معامله است و برای تشخیص قطعی الگوها، بررسی نمونه‌های بیشتر در ژورنال ضروری است.',
    ],
  };
}

/**
 * Execute AI Auto-Tagging via the provided AI provider
 */
export async function executeAIAutoTagging(
  ctx: AutoTagReferenceData,
  provider: AIProvider
): Promise<AIAutoTagResponse> {
  const prompt = buildAutoTagPrompt(ctx);
  const response = await provider.generateStructured<AIAutoTagResponse>(prompt);
  const validated = validateAutoTagResponse(response.data);

  const raw = validated || { suggestions: [] };
  const suggestions = Array.isArray(raw.suggestions) ? raw.suggestions : [];

  // Match suggestions against existing items to strictly ensure isExisting flag
  const structuredSuggestions: AIAutoTagItem[] = [];

  for (const item of suggestions) {
    const name = item.tagName || item.name || '';
    if (!name) continue;

    let matchedType: AIAutoTagItem['type'] = item.type || 'tag';
    let matchedId: string | undefined = item.tagId;
    let isExisting = false;

    // Check existing strategies
    const existingStrat = ctx.strategies.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (existingStrat) {
      matchedType = 'strategy';
      matchedId = existingStrat.id;
      isExisting = true;
    }

    // Check existing setups
    const existingSetup = ctx.setups.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (existingSetup) {
      matchedType = 'setup';
      matchedId = existingSetup.id;
      isExisting = true;
    }

    // Check existing tags
    const existingTag = ctx.tags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existingTag) {
      matchedType = 'tag';
      matchedId = existingTag.id;
      isExisting = true;
    }

    // Check existing mistakes
    const existingMistake = ctx.mistakes.find(m => m.name.toLowerCase() === name.toLowerCase());
    if (existingMistake) {
      matchedType = 'mistake';
      matchedId = existingMistake.id;
      isExisting = true;
    }

    structuredSuggestions.push({
      type: matchedType,
      id: matchedId,
      name,
      isExisting,
      reason: item.reason || 'پیشنهاد متناسب با ویژگی‌های این معامله',
      confidence: item.confidence || 80,
    });
  }

  return {
    suggestions,
    structuredSuggestions,
  };
}

/**
 * Execute AI Weekly/Monthly Report via the provided AI provider
 */
export async function executeAIPeriodicReport(
  ctx: PeriodicReviewContextData,
  provider: AIProvider
): Promise<AIReportResponse> {
  const deterministic = computeDeterministicPeriodicData(ctx);

  if (!deterministic.isSufficientData) {
    // Insufficient data fallback
    return {
      title: `گزارش ${ctx.periodType === 'weekly' ? 'هفتگی' : 'ماهانه'}: ${ctx.periodTitle}`,
      period: `${ctx.startDate} الی ${ctx.endDate}`,
      sampleSize: deterministic.sampleSize,
      summary: `تعداد معاملات ثبت‌شده در این بازه (${deterministic.sampleSize} معامله) برای ارائه تحلیل آماری و رفتارشناسی موثق کافی نیست.`,
      keyMetrics: {
        totalTrades: deterministic.sampleSize,
        netPnl: deterministic.metrics.netPnl,
        winRate: deterministic.metrics.winRate,
        profitFactor: deterministic.metrics.profitFactor,
      },
      performanceInterpretation: 'حجم نمونه معاملاتی بسیار اندک است. توصیه می‌شود پس از ثبت حداقل ۵ معامله کامل، مجدداً گزارش تحلیلی دریافت شود.',
      observations: [
        `در این بازه تنها ${deterministic.sampleSize} معامله انجام شده است.`,
        `سود خالص ثبت‌شده: ${deterministic.metrics.netPnl.toFixed(2)}$`,
      ],
      recommendations: [
        'معاملات خود را به طور منظم در ژورنال ثبت فرمایید.',
        'برای دستیابی به استنتاج‌های آماری پایدار، به حجم نمونه بزرگتر نیاز است.',
      ],
      limitations: [
        'حجم نمونه کمتر از حد استاندارد برای الگوشناسی است؛ از هرگونه نتیجه‌گیری شتابزده خودداری کنید.',
      ],
      topPriorities: [
        'ثبت دقیق تمام پارامترهای معاملات بعدی در ژورنال',
        'رعایت انضباط ورود و خروج بر اساس استراتژی شخصی',
        'تکمیل بازبینی تک‌معاملات بلافاصله پس از بسته شدن پوزیشن',
      ],
    };
  }

  const prompt = buildPeriodicReportPrompt(ctx);
  const response = await provider.generateStructured<AIReportResponse>(prompt);
  const data = validatePeriodicReportResponse(response.data);

  return {
    title: data.title || `گزارش تحلیلی ${ctx.periodType === 'weekly' ? 'هفتگی' : 'ماهانه'} (${ctx.periodTitle})`,
    period: `${ctx.startDate} الی ${ctx.endDate}`,
    sampleSize: deterministic.sampleSize,
    summary: data.summary || 'خلاصه عملکرد دوره بر اساس آمار قطعی ثبت‌شده.',
    keyMetrics: {
      totalTrades: deterministic.sampleSize,
      netPnl: deterministic.metrics.netPnl,
      winRate: deterministic.metrics.winRate,
      profitFactor: deterministic.metrics.profitFactor,
      expectancy: deterministic.metrics.expectancy,
      averageWin: deterministic.metrics.averageWin,
      averageLoss: deterministic.metrics.averageLoss,
    },
    performanceInterpretation: data.performanceInterpretation || 'عملکرد این دوره بر مبنای داده‌های موجود ارزیابی شده است.',
    strongBehaviors: Array.isArray(data.strongBehaviors) ? data.strongBehaviors : [],
    biggestProblems: Array.isArray(data.biggestProblems) ? data.biggestProblems : [],
    strategyAnalysis: Array.isArray(data.strategyAnalysis) ? data.strategyAnalysis : [],
    psychologyAnalysis: Array.isArray(data.psychologyAnalysis) ? data.psychologyAnalysis : [],
    riskManagementAnalysis: Array.isArray(data.riskManagementAnalysis) ? data.riskManagementAnalysis : [],
    repeatedMistakes: Array.isArray(data.repeatedMistakes) ? data.repeatedMistakes : [],
    topPriorities: (Array.isArray(data.topPriorities) ? data.topPriorities.slice(0, 3) : [
      'پایبندی بدون چون‌وچرا به استاپ‌لاس در کلیه پوزیشن‌ها',
      'پرهیز از معاملات خارج از تایم سشن اختصاصی استراتژی',
      'مرور ژورنال پیش از آغاز معاملات روزانه',
    ]),
    comparisonWithPrevious: deterministic.comparisons,
    observations: Array.isArray(data.observations) ? data.observations : [],
    recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
    limitations: (Array.isArray(data.limitations) && data.limitations.length > 0 ? data.limitations : [
      `تعداد ${deterministic.sampleSize} معامله بررسی شده است؛ این نمونه برای ارزیابی کوتاه‌مدت مناسب بوده اما برای الگوهای بلندمدت نیازمند تداوم است.`,
    ]),
  };
}
