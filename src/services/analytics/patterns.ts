// ============================================================
// Phase 15 — Deterministic Pattern Detection & Advanced Insights Engine
//
// Detects statistical patterns and behavioral tendencies across:
// 1. Setup & Strategy edge vs drag
// 2. Forex Sessions & Time-of-day clusters
// 3. Symbol & Side asymmetries
// 4. Trade Duration & Holding behaviors
// 5. Rule Adherence & Discipline impact
// 6. Psychological Emotions & Confidence correlations
// 7. Recurring Mistakes & Capital leaks
// 8. Multi-condition Confluences & Anti-patterns
//
// CORE PRINCIPLE: EVIDENCE BEFORE CONCLUSIONS
// - Always includes sample size, win rate, P/L, profit factor, and baseline comparison.
// - Strictly flags patterns with small sample size (< 5) as observations only.
// - Phrasing uses objective, non-advisory language ("در نمونه منتخب...").
// ============================================================

import type { Trade, TradeJournal, Strategy, Setup, Tag, Mistake } from '../../types/database';
import type { ClassifiedTrade } from './types';
import { classifyTrades, calculateCoreMetrics } from './metrics';
import { getZonedHour, getZonedPersianDayOfWeek, DEFAULT_TIMEZONE } from '../../utils/timezone';

export type PatternCategory =
  | 'strategy_setup'
  | 'session_time'
  | 'symbol_side'
  | 'duration'
  | 'behavioral_rule'
  | 'psychology_emotion'
  | 'mistake_leak'
  | 'confluence_combo';

export type PatternImpact = 'strength' | 'weakness' | 'neutral_observation';

export type StatisticalReliability = 'high_confidence' | 'moderate_confidence' | 'low_sample_observation';

export interface TradingPattern {
  id: string;
  category: PatternCategory;
  categoryLabel: string;
  title: string;
  description: string;
  impact: PatternImpact;
  reliability: StatisticalReliability;
  reliabilityLabel: string;
  
  // Statistical Evidence
  sampleSize: number;
  totalTradesInSample: number;
  samplePercentage: number;
  winRate: number | null;
  baselineWinRate: number | null;
  winRateDelta: number | null; // e.g. +14.5% or -22.0%
  totalPnl: number;
  averagePnl: number | null;
  baselineAveragePnl: number | null;
  averagePnlDelta: number | null;
  profitFactor: number | null;
  averageR: number | null;
  
  // Objective Phrasing & Caveats
  analyticalObservation: string;
  disclaimer: string;
  tradeIds: string[];
}

export interface PatternBaseline {
  totalTrades: number;
  winRate: number | null;
  netPnl: number;
  averagePnl: number | null;
  profitFactor: number | null;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
}

export interface PatternDetectionResult {
  baseline: PatternBaseline;
  patterns: TradingPattern[];
  strengths: TradingPattern[];
  weaknesses: TradingPattern[];
  observations: TradingPattern[];
  reliablePatternsCount: number;
  lowSamplePatternsCount: number;
}

export interface PatternTradeContext {
  trade: Trade;
  journal?: TradeJournal | null;
  tags?: Tag[];
  mistakes?: Mistake[];
  strategy?: Strategy | null;
  setup?: Setup | null;
}

// Session hours in UTC
export type ForexSession = 'asian' | 'london' | 'new_york' | 'london_ny_overlap';

export function getForexSession(utcDate: Date): ForexSession {
  const hour = utcDate.getUTCHours();
  if (hour >= 12 && hour < 16) {
    return 'london_ny_overlap';
  }
  if (hour >= 7 && hour < 16) {
    return 'london';
  }
  if (hour >= 12 && hour < 21) {
    return 'new_york';
  }
  return 'asian';
}

export function getForexSessionLabel(session: ForexSession): string {
  switch (session) {
    case 'asian':
      return 'سشن آسیا / توکیو (Asian Session)';
    case 'london':
      return 'سشن لندن (London Session)';
    case 'new_york':
      return 'سشن نیویورک (New York Session)';
    case 'london_ny_overlap':
      return 'همپوشانی لندن و نیویورک (Overlap)';
  }
}

const PERSIAN_DAY_NAMES = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

/**
 * Helper to compute sample metrics against baseline
 */
function computeGroupMetrics(
  items: ClassifiedTrade[],
  baseline: PatternBaseline
) {
  const sampleSize = items.length;
  if (sampleSize === 0) {
    return {
      sampleSize: 0,
      totalTradesInSample: baseline.totalTrades,
      samplePercentage: 0,
      winRate: null,
      baselineWinRate: baseline.winRate,
      winRateDelta: null,
      totalPnl: 0,
      averagePnl: null,
      baselineAveragePnl: baseline.averagePnl,
      averagePnlDelta: null,
      profitFactor: null,
      averageR: null,
      reliability: 'low_sample_observation' as StatisticalReliability,
      reliabilityLabel: 'مشاهده اولیه (نیاز به نمونه بیشتر)',
      tradeIds: [],
    };
  }

  const wins = items.filter(t => t.result === 'win').length;
  const losses = items.filter(t => t.result === 'loss').length;
  const decidedTrades = wins + losses;
  const winRate = decidedTrades > 0 ? (wins / decidedTrades) * 100 : null;
  const winRateDelta = (winRate !== null && baseline.winRate !== null)
    ? Number((winRate - baseline.winRate).toFixed(1))
    : null;

  const totalPnl = Number(items.reduce((sum, t) => sum + t.netPnl, 0).toFixed(2));
  const averagePnl = Number((totalPnl / sampleSize).toFixed(2));
  const averagePnlDelta = baseline.averagePnl !== null
    ? Number((averagePnl - baseline.averagePnl).toFixed(2))
    : null;

  const grossProfit = items.filter(t => t.netPnl > 0).reduce((s, t) => s + t.netPnl, 0);
  const grossLoss = Math.abs(items.filter(t => t.netPnl < 0).reduce((s, t) => s + t.netPnl, 0));
  const profitFactor = grossLoss > 0
    ? Number((grossProfit / grossLoss).toFixed(2))
    : (grossProfit > 0 ? 99.99 : null);

  const samplePercentage = baseline.totalTrades > 0
    ? Number(((sampleSize / baseline.totalTrades) * 100).toFixed(1))
    : 0;

  // Average R (if Stop Loss & Entry are present)
  let rMultiples: number[] = [];
  for (const t of items) {
    if (t.stop_loss && t.entry_price && t.exit_price) {
      const riskPerUnit = Math.abs(t.entry_price - t.stop_loss);
      if (riskPerUnit > 0) {
        const rewardPerUnit = t.side === 'buy'
          ? (t.exit_price - t.entry_price)
          : (t.entry_price - t.exit_price);
        rMultiples.push(rewardPerUnit / riskPerUnit);
      }
    }
  }
  const averageR = rMultiples.length > 0
    ? Number((rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length).toFixed(2))
    : null;

  let reliability: StatisticalReliability = 'low_sample_observation';
  let reliabilityLabel = 'مشاهده با نمونه کم (< ۵ معامله)';

  if (sampleSize >= 10) {
    reliability = 'high_confidence';
    reliabilityLabel = 'اطمینان آماری بالا (نمونه ۱۰+)';
  } else if (sampleSize >= 5) {
    reliability = 'moderate_confidence';
    reliabilityLabel = 'اطمینان آماری متوسط (نمونه ۵ تا ۹)';
  }

  const tradeIds = items.map(t => t.id);

  return {
    sampleSize,
    totalTradesInSample: baseline.totalTrades,
    samplePercentage,
    winRate: winRate !== null ? Number(winRate.toFixed(1)) : null,
    baselineWinRate: baseline.winRate,
    winRateDelta,
    totalPnl,
    averagePnl,
    baselineAveragePnl: baseline.averagePnl,
    averagePnlDelta,
    profitFactor,
    averageR,
    reliability,
    reliabilityLabel,
    tradeIds,
  };
}

/**
 * Generates Persian disclaimer according to sample size
 */
function getReliabilityDisclaimer(sampleSize: number): string {
  if (sampleSize >= 10) {
    return `حجم نمونه (${sampleSize} معامله) از حداقل آستانه آماری برخوردار است و الگو را پایدارتر نشان می‌دهد؛ با این حال شرایط آینده بازار ممکن است متفاوت باشد.`;
  }
  if (sampleSize >= 5) {
    return `این الگو بر اساس ${sampleSize} معامله شناسایی شده است؛ برای اتکای قطعی، به افزایش حجم نمونه در ژورنال نیاز است.`;
  }
  return `هشدار: حجم نمونه بسیار کم (${sampleSize} معامله) است. این مورد صرفاً یک مشاهده اولیه است و به هیچ وجه نباید به عنوان الگوی قطعی یا مبنای تصمیم‌گیری در نظر گرفته شود.`;
}

/**
 * Main Pattern Detection Function
 */
export function detectTradingPatterns(
  tradesWithContext: PatternTradeContext[],
  timeZone: string = DEFAULT_TIMEZONE
): PatternDetectionResult {
  const trades = tradesWithContext.map(tc => tc.trade);
  const classifiedTrades = classifyTrades(trades);
  const coreMetrics = calculateCoreMetrics(classifiedTrades);

  const baseline: PatternBaseline = {
    totalTrades: coreMetrics.totalTrades,
    winRate: coreMetrics.winRate !== null ? Number(coreMetrics.winRate.toFixed(1)) : null,
    netPnl: Number(coreMetrics.netPnl.toFixed(2)),
    averagePnl: coreMetrics.totalTrades > 0
      ? Number((coreMetrics.netPnl / coreMetrics.totalTrades).toFixed(2))
      : null,
    profitFactor: coreMetrics.profitFactor,
    winningTrades: coreMetrics.winningTrades,
    losingTrades: coreMetrics.losingTrades,
    breakevenTrades: coreMetrics.breakevenTrades,
  };

  const patterns: TradingPattern[] = [];

  if (classifiedTrades.length === 0) {
    return {
      baseline,
      patterns: [],
      strengths: [],
      weaknesses: [],
      observations: [],
      reliablePatternsCount: 0,
      lowSamplePatternsCount: 0,
    };
  }

  // Create lookup for fast trade -> context
  const contextMap = new Map<string, PatternTradeContext>();
  for (const tc of tradesWithContext) {
    contextMap.set(tc.trade.id, tc);
  }

  // -------------------------------------------------------------
  // 1. Setup & Strategy Patterns
  // -------------------------------------------------------------
  const setupGroups = new Map<string, { setupName: string; trades: ClassifiedTrade[] }>();
  const strategyGroups = new Map<string, { strategyName: string; trades: ClassifiedTrade[] }>();

  for (const trade of classifiedTrades) {
    const ctx = contextMap.get(trade.id);
    const setupName = ctx?.setup?.name || (ctx?.journal as any)?.setup_name;
    const strategyName = ctx?.strategy?.name || (ctx?.journal as any)?.strategy_name;

    if (setupName) {
      if (!setupGroups.has(setupName)) {
        setupGroups.set(setupName, { setupName, trades: [] });
      }
      setupGroups.get(setupName)!.trades.push(trade);
    }

    if (strategyName) {
      if (!strategyGroups.has(strategyName)) {
        strategyGroups.set(strategyName, { strategyName, trades: [] });
      }
      strategyGroups.get(strategyName)!.trades.push(trade);
    }
  }

  // Evaluate Setups
  for (const [name, group] of setupGroups.entries()) {
    const m = computeGroupMetrics(group.trades, baseline);
    if (m.sampleSize < 2) continue; // Skip singletons

    const isHighWin = m.winRate !== null && baseline.winRate !== null && m.winRate >= baseline.winRate + 10 && m.totalPnl > 0;
    const isLossDrag = (m.winRate !== null && baseline.winRate !== null && m.winRate <= baseline.winRate - 12) || (m.totalPnl < 0 && m.sampleSize >= 3);

    let impact: PatternImpact = 'neutral_observation';
    if (isHighWin) impact = 'strength';
    else if (isLossDrag) impact = 'weakness';

    patterns.push({
      id: `setup-${name}`,
      category: 'strategy_setup',
      categoryLabel: 'ستاپ و استراتژی',
      title: `عملکرد ستاپ: ${name}`,
      description: `در نمونه منتخب، ${m.sampleSize} معامله با ستاپ «${name}» انجام شده است (${m.samplePercentage}٪ از کل معاملات).`,
      impact,
      ...m,
      analyticalObservation: impact === 'strength'
        ? `ستاپ «${name}» با نرخ برد ${m.winRate}٪ (${m.winRateDelta && m.winRateDelta >= 0 ? '+' : ''}${m.winRateDelta}٪ نسبت به میانگین حساب) و سود ناخالص ${m.totalPnl}$ به عنوان یکی از مزیت‌های کلیدی عمل کرده است.`
        : impact === 'weakness'
        ? `ستاپ «${name}» با بازدهی منفی (${m.totalPnl}$) و نرخ برد ${m.winRate ?? 0}٪ نسبت به میانگین کلی حساب عقب مانده است.`
        : `ستاپ «${name}» با نرخ برد ${m.winRate ?? 'نامشخص'}٪ و سود خالص ${m.totalPnl}$ عملکردی متعادل داشته است.`,
      disclaimer: getReliabilityDisclaimer(m.sampleSize),
    });
  }

  // Evaluate Strategies
  for (const [name, group] of strategyGroups.entries()) {
    const m = computeGroupMetrics(group.trades, baseline);
    if (m.sampleSize < 3) continue;

    const isHighWin = m.winRate !== null && baseline.winRate !== null && m.winRate >= baseline.winRate + 8 && m.totalPnl > 0;
    const isLossDrag = (m.winRate !== null && baseline.winRate !== null && m.winRate <= baseline.winRate - 10) || m.totalPnl < 0;

    let impact: PatternImpact = 'neutral_observation';
    if (isHighWin) impact = 'strength';
    else if (isLossDrag) impact = 'weakness';

    patterns.push({
      id: `strategy-${name}`,
      category: 'strategy_setup',
      categoryLabel: 'ستاپ و استراتژی',
      title: `استراتژی معاملاتی: ${name}`,
      description: `در میان معاملات انتخاب‌شده، تعداد ${m.sampleSize} معامله بر مبنای استراتژی «${name}» ثبت شده است.`,
      impact,
      ...m,
      analyticalObservation: impact === 'strength'
        ? `استراتژی «${name}» بازدهی قابل‌توجه با مجموع سود ${m.totalPnl}$ و نرخ برد ${m.winRate}٪ به همراه داشته است.`
        : impact === 'weakness'
        ? `استراتژی «${name}» با ثبت بازدهی کل ${m.totalPnl}$ نیاز به بازنگری پارامترهای ورود یا فیلترهای تکمیلی دارد.`
        : `استراتژی «${name}» عملکرد پایداری در سطح میانگین کلی حساب ارائه داده است.`,
      disclaimer: getReliabilityDisclaimer(m.sampleSize),
    });
  }

  // -------------------------------------------------------------
  // 2. Forex Sessions & Time Clusters
  // -------------------------------------------------------------
  const sessionGroups: Record<ForexSession, ClassifiedTrade[]> = {
    asian: [],
    london: [],
    new_york: [],
    london_ny_overlap: [],
  };

  for (const trade of classifiedTrades) {
    const entryDate = new Date(trade.entry_datetime);
    if (!isNaN(entryDate.getTime())) {
      const session = getForexSession(entryDate);
      sessionGroups[session].push(trade);
    }
  }

  for (const [sKey, sTrades] of Object.entries(sessionGroups) as [ForexSession, ClassifiedTrade[]][]) {
    if (sTrades.length < 2) continue;
    const m = computeGroupMetrics(sTrades, baseline);
    const sessionLabel = getForexSessionLabel(sKey);

    let impact: PatternImpact = 'neutral_observation';
    if (m.winRate !== null && baseline.winRate !== null && m.winRate >= baseline.winRate + 10 && m.totalPnl > 0) {
      impact = 'strength';
    } else if (m.totalPnl < 0 && (m.winRate !== null && baseline.winRate !== null && m.winRate < baseline.winRate - 8)) {
      impact = 'weakness';
    }

    patterns.push({
      id: `session-${sKey}`,
      category: 'session_time',
      categoryLabel: 'سشن و زمان',
      title: `عملکرد در ${sessionLabel}`,
      description: `تعداد ${m.sampleSize} معامله در ${sessionLabel} ثبت شده است (${m.samplePercentage}٪ از معاملات).`,
      impact,
      ...m,
      analyticalObservation: impact === 'strength'
        ? `سشن ${sessionLabel} با ثبت نرخ برد ${m.winRate}٪ و سود خالص ${m.totalPnl}$ پربازده‌ترین بازه زمانی برای معاملات شما بوده است.`
        : impact === 'weakness'
        ? `معاملات در ${sessionLabel} منجر به زیان خالص ${m.totalPnl}$ گردیده و نرخ برد (${m.winRate}٪) کمتر از میانگین ثبت شده است.`
        : `عملکرد در ${sessionLabel} همسو با میانگین نرخ برد کلی حساب بوده است.`,
      disclaimer: getReliabilityDisclaimer(m.sampleSize),
    });
  }

  // Weekday Patterns
  const weekdayGroups = new Map<number, ClassifiedTrade[]>();
  for (let i = 0; i < 7; i++) weekdayGroups.set(i, []);

  for (const trade of classifiedTrades) {
    const day = getZonedPersianDayOfWeek(trade.entry_datetime, timeZone);
    weekdayGroups.get(day)?.push(trade);
  }

  for (const [dayIdx, dTrades] of weekdayGroups.entries()) {
    if (dTrades.length < 3) continue;
    const m = computeGroupMetrics(dTrades, baseline);
    const dayName = PERSIAN_DAY_NAMES[dayIdx];

    if (m.winRate !== null && baseline.winRate !== null && Math.abs(m.winRate - baseline.winRate) >= 15) {
      const isPositive = m.winRate > baseline.winRate && m.totalPnl > 0;
      patterns.push({
        id: `weekday-${dayIdx}`,
        category: 'session_time',
        categoryLabel: 'سشن و زمان',
        title: `الگوی روزهای ${dayName}`,
        description: `در نمونه بررسی‌شده، ${m.sampleSize} معامله در روزهای ${dayName} انجام شده است.`,
        impact: isPositive ? 'strength' : 'weakness',
        ...m,
        analyticalObservation: isPositive
          ? `روزهای ${dayName} با نرخ برد ${m.winRate}٪ و سود کل ${m.totalPnl}$ بالاترین نرخ موفقیت روزهای هفته را ثبت کرده‌اند.`
          : `روزهای ${dayName} با نرخ برد ${m.winRate}٪ و سود/زیان ${m.totalPnl}$ عملکرد ضعیف‌تری نسبت به سایر روزهای کاری نشان می‌دهند.`,
        disclaimer: getReliabilityDisclaimer(m.sampleSize),
      });
    }
  }

  // -------------------------------------------------------------
  // 3. Symbol & Side Asymmetries
  // -------------------------------------------------------------
  const symbolGroups = new Map<string, ClassifiedTrade[]>();
  for (const trade of classifiedTrades) {
    if (!symbolGroups.has(trade.symbol)) {
      symbolGroups.set(trade.symbol, []);
    }
    symbolGroups.get(trade.symbol)!.push(trade);
  }

  for (const [symbol, sTrades] of symbolGroups.entries()) {
    if (sTrades.length < 3) continue;
    const m = computeGroupMetrics(sTrades, baseline);

    const isTopSymbol = m.winRate !== null && baseline.winRate !== null && m.winRate >= baseline.winRate + 8 && m.totalPnl > 0;
    const isWeakSymbol = (m.winRate !== null && baseline.winRate !== null && m.winRate <= baseline.winRate - 12) || (m.totalPnl < 0 && m.sampleSize >= 4);

    let impact: PatternImpact = 'neutral_observation';
    if (isTopSymbol) impact = 'strength';
    else if (isWeakSymbol) impact = 'weakness';

    patterns.push({
      id: `symbol-${symbol}`,
      category: 'symbol_side',
      categoryLabel: 'نماد و جهت معامله',
      title: `تحلیل نماد: ${symbol}`,
      description: `در میان معاملات بررسی‌شده، ${m.sampleSize} معامله روی نماد ${symbol} قرار داشته است.`,
      impact,
      ...m,
      analyticalObservation: impact === 'strength'
        ? `نماد ${symbol} قوی‌ترین ابزار معاملاتی شما بوده و سود خالص ${m.totalPnl}$ به همراه ضریب سود ${m.profitFactor ?? 'N/A'} ایجاد کرده است.`
        : impact === 'weakness'
        ? `نماد ${symbol} به عنوان نشتی سود با مجموع زیان ${m.totalPnl}$ و نرخ برد ${m.winRate}٪ شناسایی شده است.`
        : `نماد ${symbol} با بازدهی متعادل ${m.totalPnl}$ همراه بوده است.`,
      disclaimer: getReliabilityDisclaimer(m.sampleSize),
    });

    // Check Side Asymmetry within Symbol (BUY vs SELL)
    const buys = sTrades.filter(t => t.side === 'buy');
    const sells = sTrades.filter(t => t.side === 'sell');

    if (buys.length >= 3 && sells.length >= 3) {
      const buyM = computeGroupMetrics(buys, baseline);
      const sellM = computeGroupMetrics(sells, baseline);

      if (buyM.winRate !== null && sellM.winRate !== null && Math.abs(buyM.winRate - sellM.winRate) >= 25) {
        const preferredSide = buyM.winRate > sellM.winRate ? 'خرید (BUY)' : 'فروش (SELL)';
        const weakerSide = buyM.winRate > sellM.winRate ? 'فروش (SELL)' : 'خرید (BUY)';
        const diffPnl = Math.abs(buyM.totalPnl - sellM.totalPnl);

        patterns.push({
          id: `symbol-side-bias-${symbol}`,
          category: 'symbol_side',
          categoryLabel: 'نماد و جهت معامله',
          title: `عدم تقارن جهت در نماد ${symbol}`,
          description: `در معاملات ${symbol}، تفاوت چشمگیری میان پوزیشن‌های خرید (${buys.length} معامله) و فروش (${sells.length} معامله) مشاهده می‌شود.`,
          impact: 'neutral_observation',
          ...m,
          analyticalObservation: `در نماد ${symbol}، پوزیشن‌های ${preferredSide} نرخ برد به مراتب بالاتری نسبت به پوزیشن‌های ${weakerSide} داشته‌اند (اختلاف نرخ برد: ${Math.abs(buyM.winRate - sellM.winRate).toFixed(1)}٪).`,
          disclaimer: getReliabilityDisclaimer(Math.min(buys.length, sells.length)),
        });
      }
    }
  }

  // -------------------------------------------------------------
  // 4. Trade Duration & Holding Behaviors
  // -------------------------------------------------------------
  const quickScalps = classifiedTrades.filter(t => t.duration_seconds !== null && t.duration_seconds < 180); // < 3 mins
  const intradayTrades = classifiedTrades.filter(t => t.duration_seconds !== null && t.duration_seconds >= 180 && t.duration_seconds <= 14400); // 3m to 4h
  const swingTrades = classifiedTrades.filter(t => t.duration_seconds !== null && t.duration_seconds > 14400); // > 4h

  if (quickScalps.length >= 3) {
    const scalpM = computeGroupMetrics(quickScalps, baseline);
    const isDamaging = scalpM.totalPnl < 0 && (scalpM.winRate !== null && baseline.winRate !== null && scalpM.winRate < baseline.winRate - 8);

    patterns.push({
      id: 'duration-quick-scalps',
      category: 'duration',
      categoryLabel: 'مدت زمان معامله',
      title: 'معاملات بسیار کوتاه (زیر ۳ دقیقه)',
      description: `تعداد ${scalpM.sampleSize} معامله بسیار سریع با ماندگاری کمتر از ۳ دقیقه در ژورنال ثبت شده است.`,
      impact: isDamaging ? 'weakness' : (scalpM.totalPnl > 0 ? 'strength' : 'neutral_observation'),
      ...scalpM,
      analyticalObservation: isDamaging
        ? `معاملات با ماندگاری زیر ۳ دقیقه با زیان انباشته ${scalpM.totalPnl}$ و نرخ برد ضعیف ${scalpM.winRate}٪، نشان‌دهنده ورودهای شتاب‌زده یا خروج‌های هیجانی پیش از موعد هستند.`
        : `معاملات سریع زیر ۳ دقیقه با مجموع سود ${scalpM.totalPnl}$ و نرخ برد ${scalpM.winRate}٪ اجرا شده‌اند.`,
      disclaimer: getReliabilityDisclaimer(scalpM.sampleSize),
    });
  }

  // -------------------------------------------------------------
  // 5. Rule Adherence & Discipline Impact
  // -------------------------------------------------------------
  const followedTrades: ClassifiedTrade[] = [];
  const violatedTrades: ClassifiedTrade[] = [];

  for (const trade of classifiedTrades) {
    const ctx = contextMap.get(trade.id);
    const adherence = ctx?.journal?.rule_adherence;
    if (adherence === 'followed') {
      followedTrades.push(trade);
    } else if (adherence === 'violated' || adherence === 'partially_followed') {
      violatedTrades.push(trade);
    }
  }

  if (followedTrades.length >= 3) {
    const fM = computeGroupMetrics(followedTrades, baseline);
    patterns.push({
      id: 'discipline-followed',
      category: 'behavioral_rule',
      categoryLabel: 'انضباط و پایبندی به قوانین',
      title: 'پایبندی کامل به قوانین معاملاتی',
      description: `در ${fM.sampleSize} معامله، ثبت گردیده که پلن و چک‌لیست استراتژی بدون تخطی اجرا شده است.`,
      impact: fM.totalPnl > 0 ? 'strength' : 'neutral_observation',
      ...fM,
      analyticalObservation: `در معاملاتی که قوانین کاملاً رعایت شده، نرخ برد ${fM.winRate}٪ (${fM.winRateDelta && fM.winRateDelta >= 0 ? '+' : ''}${fM.winRateDelta}٪ بالاتر از میانگین) و سود خالص ${fM.totalPnl}$ به ثبت رسیده است. این مقایسه برتری قطعی انضباط را تایید می‌کند.`,
      disclaimer: getReliabilityDisclaimer(fM.sampleSize),
    });
  }

  if (violatedTrades.length >= 2) {
    const vM = computeGroupMetrics(violatedTrades, baseline);
    patterns.push({
      id: 'discipline-violated',
      category: 'behavioral_rule',
      categoryLabel: 'انضباط و پایبندی به قوانین',
      title: 'نقض یا رعایت ناقص قوانین استراتژی',
      description: `در ${vM.sampleSize} معامله، عدم رعایت کامل قوانین و خروج از پلن معاملاتی گزارش شده است.`,
      impact: 'weakness',
      ...vM,
      analyticalObservation: `تخطی از قوانین منجر به برآیند منفی ${vM.totalPnl}$ با نرخ برد پایین ${vM.winRate ?? 0}٪ گردیده است که هزینه عدم انضباط را به وضوح نشان می‌دهد.`,
      disclaimer: getReliabilityDisclaimer(vM.sampleSize),
    });
  }

  // -------------------------------------------------------------
  // 6. Mistakes Impact & Capital Leaks
  // -------------------------------------------------------------
  const mistakeGroups = new Map<string, { mistakeName: string; trades: ClassifiedTrade[] }>();

  for (const trade of classifiedTrades) {
    const ctx = contextMap.get(trade.id);
    if (ctx?.mistakes && ctx.mistakes.length > 0) {
      for (const mObj of ctx.mistakes) {
        const mName = mObj.name;
        if (!mistakeGroups.has(mName)) {
          mistakeGroups.set(mName, { mistakeName: mName, trades: [] });
        }
        mistakeGroups.get(mName)!.trades.push(trade);
      }
    }
  }

  for (const [mName, group] of mistakeGroups.entries()) {
    if (group.trades.length < 2) continue;
    const mM = computeGroupMetrics(group.trades, baseline);

    patterns.push({
      id: `mistake-${mName}`,
      category: 'mistake_leak',
      categoryLabel: 'اشتباهات مکرر و نشت سرمایه',
      title: `خطای تکرارشونده: ${mName}`,
      description: `اشتباه «${mName}» در ${mM.sampleSize} معامله تکرار شده و زیان‌های محسوسی بر جا گذاشته است.`,
      impact: 'weakness',
      ...mM,
      analyticalObservation: `تکرار اشتباه «${mName}» در ${mM.sampleSize} معامله، منجر به زیان مستقیم یا کاهش سود به میزان ${mM.totalPnl}$ شده است. حذف این خطا مستقیماً به بهبود کارایی حساب می‌انجامد.`,
      disclaimer: getReliabilityDisclaimer(mM.sampleSize),
    });
  }

  // -------------------------------------------------------------
  // 7. Psychology & Emotional State Correlations
  // -------------------------------------------------------------
  const emotionGroups = new Map<string, ClassifiedTrade[]>();

  for (const trade of classifiedTrades) {
    const ctx = contextMap.get(trade.id);
    const emotion = ctx?.journal?.emotion_before || ctx?.journal?.emotion_during;
    if (emotion && emotion.trim().length > 0) {
      const eClean = emotion.trim();
      if (!emotionGroups.has(eClean)) {
        emotionGroups.set(eClean, []);
      }
      emotionGroups.get(eClean)!.push(trade);
    }
  }

  for (const [emotion, eTrades] of emotionGroups.entries()) {
    if (eTrades.length < 2) continue;
    const eM = computeGroupMetrics(eTrades, baseline);

    const isDistressed = emotion.includes('ترس') || emotion.includes('طمع') || emotion.includes('انتقام') || emotion.includes('عجله') || emotion.includes('خشم');
    const isCalm = emotion.includes('آرام') || emotion.includes('مطمئن') || emotion.includes('انضباط') || emotion.includes('متمرکز');

    let impact: PatternImpact = 'neutral_observation';
    if (isCalm && eM.totalPnl > 0) impact = 'strength';
    else if (isDistressed || eM.totalPnl < 0) impact = 'weakness';

    patterns.push({
      id: `emotion-${emotion}`,
      category: 'psychology_emotion',
      categoryLabel: 'روانشناسی و احساسات',
      title: `حالت روحی هنگام ورود: ${emotion}`,
      description: `در ${eM.sampleSize} معامله، حس «${emotion}» در ژورنال ثبت گردیده است.`,
      impact,
      ...eM,
      analyticalObservation: impact === 'strength'
        ? `احساس «${emotion}» با بیشترین آرامش ذهنی و نتایج مثبت (${eM.totalPnl}$ سود) همراه بوده است.`
        : impact === 'weakness'
        ? `حالت هیجانی «${emotion}» با افت کارایی (${eM.totalPnl}$ سود/زیان) و تصمیم‌گیری شتاب‌زده همبستگی دارد.`
        : `عملکرد با حس «${emotion}» ثبت گردیده است.`,
      disclaimer: getReliabilityDisclaimer(eM.sampleSize),
    });
  }

  // -------------------------------------------------------------
  // 8. Multi-condition Confluence & Anti-patterns
  // -------------------------------------------------------------
  // Evaluate: Top Setup + Top Session
  for (const [setupName, sGroup] of setupGroups.entries()) {
    if (sGroup.trades.length < 3) continue;

    for (const [sessKey, sessTrades] of Object.entries(sessionGroups) as [ForexSession, ClassifiedTrade[]][]) {
      const comboTrades = sGroup.trades.filter(t => sessTrades.some(st => st.id === t.id));
      if (comboTrades.length >= 3) {
        const cM = computeGroupMetrics(comboTrades, baseline);
        if (cM.winRate !== null && baseline.winRate !== null && Math.abs(cM.winRate - baseline.winRate) >= 15) {
          const sessLabel = getForexSessionLabel(sessKey);
          const isEdge = cM.winRate > baseline.winRate && cM.totalPnl > 0;

          patterns.push({
            id: `confluence-${setupName}-${sessKey}`,
            category: 'confluence_combo',
            categoryLabel: 'ترکیب همپوشانی شرایط',
            title: `همپوشانی ستاپ «${setupName}» در ${sessLabel}`,
            description: `در ${cM.sampleSize} معامله، ترکیب ستاپ «${setupName}» با زمان ${sessLabel} بررسی شده است.`,
            impact: isEdge ? 'strength' : 'weakness',
            ...cM,
            analyticalObservation: isEdge
              ? `ترکیب ستاپ «${setupName}» با ${sessLabel} با نرخ برد فوق‌العاده ${cM.winRate}٪ (${cM.winRateDelta && cM.winRateDelta >= 0 ? '+' : ''}${cM.winRateDelta}٪ بالاتر از میانگین) یک همپوشانی قوی برای شما نشان می‌دهد.`
              : `اجرای ستاپ «${setupName}» در ${sessLabel} با افت چشمگیر نرخ برد (${cM.winRate}٪) همراه بوده و پیشنهاد می‌شود از ورود در این ساعات خودداری شود.`,
            disclaimer: getReliabilityDisclaimer(cM.sampleSize),
          });
        }
      }
    }
  }

  // Sort patterns: High confidence first, then by absolute win rate delta / PnL impact
  patterns.sort((a, b) => {
    const reliabilityScore = (r: StatisticalReliability) => (r === 'high_confidence' ? 3 : r === 'moderate_confidence' ? 2 : 1);
    const scoreDiff = reliabilityScore(b.reliability) - reliabilityScore(a.reliability);
    if (scoreDiff !== 0) return scoreDiff;

    const deltaA = Math.abs(a.winRateDelta ?? 0);
    const deltaB = Math.abs(b.winRateDelta ?? 0);
    return deltaB - deltaA;
  });

  const strengths = patterns.filter(p => p.impact === 'strength');
  const weaknesses = patterns.filter(p => p.impact === 'weakness');
  const observations = patterns.filter(p => p.impact === 'neutral_observation');

  const reliablePatternsCount = patterns.filter(p => p.reliability !== 'low_sample_observation').length;
  const lowSamplePatternsCount = patterns.filter(p => p.reliability === 'low_sample_observation').length;

  return {
    baseline,
    patterns,
    strengths,
    weaknesses,
    observations,
    reliablePatternsCount,
    lowSamplePatternsCount,
  };
}
