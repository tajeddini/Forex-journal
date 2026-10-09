// ============================================================
// Phase 15 — AI Pattern Insights Service
// Interprets deterministic trading patterns with AI
// Strictly enforces evidence-based reasoning, sample size caveats,
// and user isolation.
// ============================================================

import type { AIProvider, AIPatternInsightsResponse, AISchemaDefinition } from './types';
import type { PatternDetectionResult, TradingPattern } from '../analytics/patterns';
import { validatePatternInsightsResponse } from './response-validation';

export interface PatternInsightsContext {
  detectionResult: PatternDetectionResult;
  periodLabel?: string;
  accountName?: string;
  phaseName?: string;
}

export const PATTERN_INSIGHTS_SCHEMA: AISchemaDefinition = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'خلاصه اجرایی از الگوها و برتری‌های آماری' },
    confirmedEdges: {
      type: 'array',
      items: { type: 'string' },
      description: 'مزیت‌های معاملاتی اثبات‌شده با شواهد آماری و حجم نمونه کافی',
    },
    performanceLeaks: {
      type: 'array',
      items: { type: 'string' },
      description: 'نقاط ضعف و نشتی‌های سود (اشتباهات مکرر، ستاپ‌های ناموفق یا زمان‌های نامناسب)',
    },
    behavioralTendencies: {
      type: 'array',
      items: { type: 'string' },
      description: 'تمایلات رفتاری، روانشناسی و میزان پایبندی به قوانین',
    },
    actionablePriorities: {
      type: 'array',
      items: { type: 'string' },
      description: 'حداکثر ۳ اولویت مشخص برای اصلاح و بازبینی توسط معامله‌گر',
    },
    limitations: {
      type: 'array',
      items: { type: 'string' },
      description: 'محدودیت‌های آماری و حجم نمونه (یادآوری عدم ارائه توصیه مالی قطعی)',
    },
  },
  required: [
    'summary',
    'confirmedEdges',
    'performanceLeaks',
    'behavioralTendencies',
    'actionablePriorities',
    'limitations',
  ],
};

/**
 * Builds evidence-based prompt containing ONLY deterministic pattern facts
 */
export function buildPatternInsightsPrompt(ctx: PatternInsightsContext): string {
  const { detectionResult, periodLabel, accountName, phaseName } = ctx;
  const { baseline, patterns, reliablePatternsCount, lowSamplePatternsCount } = detectionResult;

  const strengths = patterns.filter(p => p.impact === 'strength');
  const weaknesses = patterns.filter(p => p.impact === 'weakness');
  const observations = patterns.filter(p => p.impact === 'neutral_observation');

  const lines: string[] = [
    'نقش شما: تحلیل‌گر ارشد ژورنال معاملاتی فارکس (Forex Journal Analytics).',
    'دستورالعمل حیاتی:',
    '۱. داده‌های آماری زیر کاملاً قطعی و استخراج‌شده از دیتابیس هستند. هیچ عدد یا آماری اختراع نکنید.',
    '۲. از ادبیات محتاطانه و مبتنی بر شواهد استفاده کنید («در میان نمونه معاملات انتخاب‌شده...»، «بر اساس آمار ثبت‌شده...»).',
    '۳. الگوهایی که حجم نمونه آن‌ها کمتر از ۵ معامله است را صراحتاً به عنوان «مشاهده اولیه و فاقد قابلیت اتکای آماری قطعی» طبقه‌بندی کنید.',
    '۴. به هیچ عنوان توصیه قطعی خرید، فروش یا سرمایه‌گذاری ارائه ندهید. این تحلیل صرفاً بازبینی داده‌های ژورنال است.',
    '۵. دقیقاً بین ۱ تا ۳ اولویت راهبردی (actionablePriorities) ارائه دهید.',
    '۶. پاسخ را کاملاً به زبان فارسی روان و فنی ارائه دهید.',
    '',
    '=== مشخصات نمونه معاملاتی ===',
    `تعداد کل معاملات: ${baseline.totalTrades}`,
    `نرخ برد میانگین حساب: ${baseline.winRate !== null ? `${baseline.winRate}٪` : 'نامشخص'}`,
    `سود/زیان خالص کل: ${baseline.netPnl}$`,
    `میانگین سود/زیان هر معامله: ${baseline.averagePnl !== null ? `${baseline.averagePnl}$` : 'نامشخص'}`,
    `ضریب سود (Profit Factor): ${baseline.profitFactor ?? 'نامشخص'}`,
    accountName ? `حساب: ${accountName}` : '',
    phaseName ? `فاز حساب: ${phaseName}` : '',
    periodLabel ? `بازه زمانی: ${periodLabel}` : '',
    `الگوهای با اعتبار آماری: ${reliablePatternsCount} مورد | مشاهدات با حجم نمونه کم: ${lowSamplePatternsCount} مورد`,
    '',
    '=== نقاط قوت و مزیت‌های شناسایی‌شده (Strengths & Edges) ===',
  ];

  if (strengths.length === 0) {
    lines.push('- در این نمونه، الگوی برتری قطعی با حجم نمونه معتبر ثبت نشده است.');
  } else {
    for (const s of strengths) {
      lines.push(
        `- [${s.categoryLabel}] ${s.title}: تعداد معامله=${s.sampleSize} (${s.reliabilityLabel}) | نرخ برد=${s.winRate ?? 0}٪ (تغییر نسبت به میانگین: ${s.winRateDelta && s.winRateDelta >= 0 ? '+' : ''}${s.winRateDelta ?? 0}٪) | سود کل=${s.totalPnl}$ | تحلیل: ${s.analyticalObservation}`
      );
    }
  }

  lines.push('');
  lines.push('=== نقاط ضعف و نشتی‌های سود (Weaknesses & Leaks) ===');
  if (weaknesses.length === 0) {
    lines.push('- در این نمونه، نشتی سود بارزی ثبت نشده است.');
  } else {
    for (const w of weaknesses) {
      lines.push(
        `- [${w.categoryLabel}] ${w.title}: تعداد معامله=${w.sampleSize} (${w.reliabilityLabel}) | نرخ برد=${w.winRate ?? 0}٪ | سود/زیان کل=${w.totalPnl}$ | تحلیل: ${w.analyticalObservation}`
      );
    }
  }

  lines.push('');
  lines.push('=== مشاهدات رفتاری و زمانی (Observations) ===');
  if (observations.length === 0) {
    lines.push('- مشاهده خنثی دیگری وجود ندارد.');
  } else {
    for (const o of observations.slice(0, 5)) {
      lines.push(
        `- [${o.categoryLabel}] ${o.title}: تعداد=${o.sampleSize} | سود کل=${o.totalPnl}$ | ${o.analyticalObservation}`
      );
    }
  }

  lines.push('');
  lines.push('اکنون خروجی ساختاریافته JSON شامل summary، confirmedEdges، performanceLeaks، behavioralTendencies، actionablePriorities و limitations را تولید کنید.');

  return lines.filter(Boolean).join('\n');
}

/**
 * Executes AI Pattern Insights with pure deterministic grounding
 */
export async function executeAIPatternInsights(
  ctx: PatternInsightsContext,
  provider: AIProvider
): Promise<AIPatternInsightsResponse> {
  // If no trades or baseline is empty, return graceful early response
  if (ctx.detectionResult.baseline.totalTrades === 0) {
    return {
      summary: 'هیچ معامله‌ای در فیلتر انتخابی برای شناسایی الگوها یافت نشد.',
      confirmedEdges: [],
      performanceLeaks: [],
      behavioralTendencies: [],
      actionablePriorities: [
        'معاملات جدید خود را در بخش ثبت معامله یا ورود اطلاعات وارد نمایید.',
      ],
      limitations: [
        'به حداقل ۵ الی ۱۰ معامله برای شروع تحلیل آماری الگوها نیاز است.',
      ],
    };
  }

  const prompt = buildPatternInsightsPrompt(ctx);
  const response = await provider.generateStructured<AIPatternInsightsResponse>(
    prompt,
    PATTERN_INSIGHTS_SCHEMA
  );

  return validatePatternInsightsResponse(response.data);
}
