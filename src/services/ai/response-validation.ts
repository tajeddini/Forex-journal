// Strict validation for structured Phase 14 AI responses.
import { AIError, type AITradeReviewResponse, type AIAutoTagResponse, type AIReportResponse } from './types';

const MAX_STRING = 4000;
const MAX_LIST = 50;
const isString = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_STRING;
const isStringArray = (v: unknown, max = MAX_LIST): v is string[] => Array.isArray(v) && v.length <= max && v.every(isString);
function assertObject(v: unknown, name: string): asserts v is Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new AIError('ساختار پاسخ هوش مصنوعی برای ' + name + ' معتبر نیست.', 'INVALID_RESPONSE'); }

export function validateTradeReviewResponse(value: unknown): AITradeReviewResponse {
 assertObject(value, 'Trade Review');
 for (const key of ['actionableLessons','facts','observations','possiblePatterns','questionsForTrader','limitations']) if (!isStringArray(value[key])) throw new AIError('فیلد ' + key + ' در پاسخ Trade Review معتبر نیست.', 'INVALID_RESPONSE');
 if ((value.actionableLessons as string[]).length > 3) throw new AIError('تعداد درس‌های عملیاتی Trade Review نباید بیشتر از ۳ مورد باشد.', 'INVALID_RESPONSE');
 for (const key of ['summary']) if (value[key] !== undefined && !isString(value[key])) throw new AIError('فیلد ' + key + ' در Trade Review معتبر نیست.', 'INVALID_RESPONSE');
 if (value.whatWentWell !== undefined && !isStringArray(value.whatWentWell)) throw new AIError('whatWentWell در Trade Review معتبر نیست.', 'INVALID_RESPONSE');
 if (value.whatCouldBeImproved !== undefined && !isStringArray(value.whatCouldBeImproved)) throw new AIError('whatCouldBeImproved در Trade Review معتبر نیست.', 'INVALID_RESPONSE');
 const rule = value.ruleAdherenceAnalysis;
 if (rule !== undefined) { assertObject(rule, 'ruleAdherenceAnalysis'); if (!['followed','partially_followed','violated','not_set'].includes(String(rule.status)) || !isString(rule.explanation)) throw new AIError('ساختار ruleAdherenceAnalysis معتبر نیست.', 'INVALID_RESPONSE'); }
 const risk = value.riskManagementAnalysis;
 if (risk !== undefined) { assertObject(risk, 'riskManagementAnalysis'); if (!isString(risk.assessment)) throw new AIError('ساختار riskManagementAnalysis معتبر نیست.', 'INVALID_RESPONSE'); for (const key of ['plannedRisk','actualRisk','riskRewardRatio']) if (risk[key] !== undefined && risk[key] !== null && !isString(risk[key])) throw new AIError('فیلد ' + key + ' در riskManagementAnalysis معتبر نیست.', 'INVALID_RESPONSE'); }
 const psychology = value.psychologyAnalysis;
 if (psychology !== undefined) { assertObject(psychology, 'psychologyAnalysis'); if (!isStringArray(psychology.observedEmotions) || !isString(psychology.assessment)) throw new AIError('ساختار psychologyAnalysis معتبر نیست.', 'INVALID_RESPONSE'); }
 return value as unknown as AITradeReviewResponse;
}

export function validateAutoTagResponse(value: unknown): AIAutoTagResponse {
 assertObject(value, 'Auto-Tag');
 if (!Array.isArray(value.suggestions) || value.suggestions.length > MAX_LIST) throw new AIError('لیست پیشنهادات Auto-Tag معتبر نیست.', 'INVALID_RESPONSE');
 for (const item of value.suggestions) { assertObject(item, 'Auto-Tag item'); if (!isString(item.tagName) || !isString(item.reason)) throw new AIError('ساختار یک پیشنهاد Auto-Tag معتبر نیست.', 'INVALID_RESPONSE'); if (item.confidence !== undefined && (typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 100)) throw new AIError('confidence در Auto-Tag باید بین ۰ تا ۱۰۰ باشد.', 'INVALID_RESPONSE'); if (item.type !== undefined && !['strategy','setup','tag','mistake','emotion','ruleAdherence'].includes(String(item.type))) throw new AIError('type در Auto-Tag نامعتبر است.', 'INVALID_RESPONSE'); if (item.isExisting !== undefined && typeof item.isExisting !== 'boolean') throw new AIError('isExisting در Auto-Tag نامعتبر است.', 'INVALID_RESPONSE'); }
 return value as unknown as AIAutoTagResponse;
}

export function validatePeriodicReportResponse(value: unknown): AIReportResponse {
 assertObject(value, 'Periodic Review');
 for (const key of ['title','period','summary']) if (!isString(value[key])) throw new AIError('فیلد ' + key + ' در گزارش دوره‌ای معتبر نیست.', 'INVALID_RESPONSE');
 if (!isStringArray(value.observations) || !isStringArray(value.recommendations) || !isStringArray(value.limitations)) throw new AIError('آرایه‌های اصلی گزارش دوره‌ای معتبر نیستند.', 'INVALID_RESPONSE');
 if (value.topPriorities !== undefined && (!isStringArray(value.topPriorities, 3) || value.topPriorities.length !== 3)) throw new AIError('گزارش دوره‌ای باید دقیقاً ۳ اولویت راهبردی داشته باشد.', 'INVALID_RESPONSE');
 for (const key of ['strongBehaviors','biggestProblems','strategyAnalysis','psychologyAnalysis','riskManagementAnalysis','repeatedMistakes']) if (value[key] !== undefined && !isStringArray(value[key])) throw new AIError('فیلد ' + key + ' در گزارش دوره‌ای معتبر نیست.', 'INVALID_RESPONSE');
 if (!Number.isInteger(value.sampleSize) || value.sampleSize < 0) throw new AIError('sampleSize در گزارش دوره‌ای معتبر نیست.', 'INVALID_RESPONSE');
 if (!value.keyMetrics || typeof value.keyMetrics !== 'object' || Array.isArray(value.keyMetrics)) throw new AIError('keyMetrics در گزارش دوره‌ای معتبر نیست.', 'INVALID_RESPONSE');
 return value as unknown as AIReportResponse;
}