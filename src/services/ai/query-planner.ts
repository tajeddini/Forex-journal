// ============================================================
// AI Query Planner
// Converts natural language questions into validated AIQueryPlan
// Uses allowlists and prompt injection filtering
// ============================================================

import type { AIQueryPlan, AIMetric, AIDimension, AIFilter } from './types.js';
import { validateQueryPlan, sanitizeUserInput, detectPromptInjection } from './validation.js';
import type { AIProvider } from './types.js';
import { AIError } from './types.js';

export interface QueryPlannerResult {
  plan: AIQueryPlan;
  inferredIntent: string;
  isDeterministicFallback: boolean;
}

/**
 * Deterministic fast pattern-matcher for common Persian and English financial queries.
 * Provides instant, zero-cost, guaranteed valid query plans.
 */
export function matchDeterministicQueryPlan(rawQuestion: string): QueryPlannerResult | null {
  const q = rawQuestion.toLowerCase().trim();

  // 1. Symbol queries (e.g., EURUSD, XAUUSD, BTCUSD, طلا, داوجونز)
  const symbolMatch = q.match(/\b(eurusd|gbpusd|usdjpy|xauusd|audusd|us30|nas100|btcusd|gold)\b/i);
  const persianGold = q.includes('طلا');
  const targetSymbol = symbolMatch
    ? symbolMatch[1].toUpperCase() === 'GOLD'
      ? 'XAUUSD'
      : symbolMatch[1].toUpperCase()
    : persianGold
    ? 'XAUUSD'
    : null;

  if (targetSymbol) {
    const filters: AIFilter[] = [{ field: 'symbol', operator: 'equals', value: targetSymbol }];
    return {
      plan: {
        metrics: ['totalTrades', 'winRate', 'netPnl', 'profitFactor', 'averageWin', 'averageLoss'],
        filters,
        dimensions: ['symbol'],
      },
      inferredIntent: `بررسی عملکرد نماد ${targetSymbol}`,
      isDeterministicFallback: true,
    };
  }

  // 2. Buy vs Sell comparison (مقایسه خرید و فروش / پوزیشن لانگ و شورت)
  if (
    (q.includes('buy') && q.includes('sell')) ||
    (q.includes('خرید') && q.includes('فروش')) ||
    q.includes('جهت معامله')
  ) {
    return {
      plan: {
        metrics: ['totalTrades', 'winRate', 'netPnl', 'profitFactor'],
        dimensions: ['side'],
        groupBy: 'side',
      },
      inferredIntent: 'مقایسه آماری معاملات خرید (Buy) و فروش (Sell)',
      isDeterministicFallback: true,
    };
  }

  // 3. Hourly performance (بهترین ساعت / سودده‌ترین زمان / ساعت)
  if (q.includes('ساعت') || q.includes('hour') || q.includes('زمان روز')) {
    return {
      plan: {
        metrics: ['totalTrades', 'winRate', 'netPnl'],
        dimensions: ['hour'],
        groupBy: 'hour',
        sortBy: { field: 'netPnl', order: 'desc' },
      },
      inferredIntent: 'تحلیل بازدهی و عملکرد بر اساس ساعات مختلف شبانه‌روز',
      isDeterministicFallback: true,
    };
  }

  // 4. Day of week performance (روزهای هفته / بهترین روز)
  if (q.includes('روز') || q.includes('day') || q.includes('دوشنبه') || q.includes('جمعه')) {
    return {
      plan: {
        metrics: ['totalTrades', 'winRate', 'netPnl'],
        dimensions: ['dayOfWeek'],
        groupBy: 'dayOfWeek',
        sortBy: { field: 'netPnl', order: 'desc' },
      },
      inferredIntent: 'تحلیل سودآوری و نرخ برد در روزهای مختلف هفته',
      isDeterministicFallback: true,
    };
  }

  // 5. Rule adherence (رعایت قوانین / نقض قوانین / دیسیپلین)
  if (q.includes('قوانین') || q.includes('رعایت') || q.includes('نقض') || q.includes('adherence')) {
    return {
      plan: {
        metrics: ['totalTrades', 'winRate', 'netPnl', 'profitFactor'],
        dimensions: ['ruleAdherence'],
        groupBy: 'ruleAdherence',
      },
      inferredIntent: 'مقایسه عملکرد معاملات بر اساس میزان پایبندی به قوانین معاملاتی',
      isDeterministicFallback: true,
    };
  }

  // 6. Win Rate queries (نرخ برد / وین ریت / چند درصد سود)
  if (q.includes('نرخ برد') || q.includes('win rate') || q.includes('وین ریت') || q.includes('چند درصد')) {
    return {
      plan: {
        metrics: ['winRate', 'totalTrades', 'netPnl'],
      },
      inferredIntent: 'محاسبه نرخ برد کلی معاملات و تعداد کل پوزیشن‌ها',
      isDeterministicFallback: true,
    };
  }

  // 7. Trade duration (میانگین مدت معامله / زمان پوزیشن / نگهداری معامله)
  if (q.includes('مدت') || q.includes('duration') || q.includes('چقدر باز') || q.includes('طول معامله')) {
    return {
      plan: {
        metrics: ['averageDuration', 'medianDuration', 'totalTrades'],
        dimensions: ['durationBucket'],
        groupBy: 'durationBucket',
      },
      inferredIntent: 'محاسبه میانگین و میانه مدت زمان باز بودن معاملات',
      isDeterministicFallback: true,
    };
  }

  // 8. Monthly performance (عملکرد ماهانه / ماه گذشته / این ماه)
  if (q.includes('ماه') || q.includes('month')) {
    return {
      plan: {
        metrics: ['totalTrades', 'winRate', 'netPnl', 'profitFactor', 'maxDrawdown'],
        dimensions: ['month'],
        groupBy: 'month',
        sortBy: { field: 'month', order: 'desc' },
      },
      inferredIntent: 'ارزیابی روند عملکرد معاملات در ماه‌های مختلف',
      isDeterministicFallback: true,
    };
  }

  // 9. Overall profit, drawdown and performance (سود کل / وضعیت حساب / دروداون)
  if (
    q.includes('سود') ||
    q.includes('زیان') ||
    q.includes('عملکرد') ||
    q.includes('دروداون') ||
    q.includes('کارنامه') ||
    q.includes('profit')
  ) {
    return {
      plan: {
        metrics: ['totalTrades', 'winRate', 'netPnl', 'profitFactor', 'expectancy', 'maxDrawdown'],
      },
      inferredIntent: 'گزارش جامع شاخص‌های سودآوری و ریسک حساب',
      isDeterministicFallback: true,
    };
  }

  return null;
}

/**
 * Generate a validated AIQueryPlan from a natural language question.
 */
export async function planAIQuery(
  question: string,
  provider?: AIProvider
): Promise<QueryPlannerResult> {
  // 1. Sanitize user input and defend against prompt injections
  const sanitized = sanitizeUserInput(question);
  if (detectPromptInjection(question)) {
    throw new AIError(
      'درخواست حاوی عبارات غیرمجاز یا ساختار مشکوک به تزریق دستورات بود. لطفاً صرفاً سوالی درباره معاملات خود بپرسید.',
      'QUERY_VALIDATION_FAILED'
    );
  }

  if (!sanitized || sanitized.length < 2) {
    throw new AIError('لطفاً سوال مشخصی درباره معاملات خود وارد کنید.', 'QUERY_VALIDATION_FAILED');
  }

  // 2. Check deterministic fast patterns
  const deterministicMatch = matchDeterministicQueryPlan(sanitized);
  if (deterministicMatch) {
    const val = validateQueryPlan(deterministicMatch.plan);
    if (val.valid) {
      return deterministicMatch;
    }
  }

  // 3. If real provider is available, use structured generation
  if (provider && provider.type !== 'mock' && provider.isAvailable()) {
    const planningPrompt = `Given the user trading question: "${sanitized}"
Translate this question into a structured JSON query plan adhering to this schema:
{
  "metrics": ["totalTrades" | "winRate" | "netPnl" | "grossProfit" | "grossLoss" | "profitFactor" | "expectancy" | "averageWin" | "averageLoss" | "maxDrawdown" | "averageDuration" | "medianDuration"],
  "dimensions": ["symbol" | "side" | "strategy" | "setup" | "account" | "phase" | "hour" | "dayOfWeek" | "month" | "ruleAdherence" | "result" | "durationBucket"],
  "filters": [],
  "groupBy": optional dimension from list above,
  "sortBy": optional { "field": metric or dimension, "order": "asc" | "desc" }
}
Return only valid JSON.`;

    try {
      const response = await provider.generateStructured<AIQueryPlan>(planningPrompt);
      const plan = response.data;
      const validation = validateQueryPlan(plan);

      if (validation.valid) {
        return {
          plan,
          inferredIntent: sanitized,
          isDeterministicFallback: false,
        };
      }
    } catch {
      // Fall through to default safe plan if model call failed
    }
  }

  // 4. Default safe fallback plan covering key health metrics
  const fallbackPlan: AIQueryPlan = {
    metrics: ['totalTrades', 'winRate', 'netPnl', 'profitFactor', 'expectancy'],
  };

  return {
    plan: fallbackPlan,
    inferredIntent: 'بررسی آمار کلی و شاخص‌های کلیدی معاملات',
    isDeterministicFallback: true,
  };
}
