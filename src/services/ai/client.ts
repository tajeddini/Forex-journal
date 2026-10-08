// ============================================================
// Client AI Service
// Client-side adapter communicating with server API boundary
// Supports user-selected provider & Bring Your Own Key (BYOK)
// Uses Supabase Bearer authentication; proxies requests to /api/ai/query
// ============================================================

import { supabase, isSupabaseConfigured } from '../supabase';
import type {
  AIQueryResponse,
  AIProviderType,
  AITradeReviewResponse,
  AIAutoTagResponse,
  AIReportResponse,
} from './types';
import { AIError } from './types';
import { getMockAIProvider } from './mock-provider';
import { MockStorage } from '../mockStorage';
import { calculateCoreMetrics, classifyTrades } from '../analytics/metrics';
import {
  executeAITradeReview,
  executeAIAutoTagging,
  executeAIPeriodicReport,
} from './analytics-service';

export interface UserAIProviderSettings {
  provider: AIProviderType;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface ClientAIQueryOptions {
  question: string;
  accountId?: string;
  phaseId?: string;
  isGuest?: boolean;
  providerConfig?: UserAIProviderSettings;
}

let inMemoryAIConfig: UserAIProviderSettings = { provider: 'gemini' };

/**
 * API keys are intentionally kept in memory only.
 * They are never written to localStorage/sessionStorage, IndexedDB, cookies, or URLs.
 * Reloading the page clears the key and requires the user to enter it again.
 */
export function getSavedClientAIConfig(): UserAIProviderSettings {
  return { ...inMemoryAIConfig };
}

/** Keep settings only for the current page session; never persist secrets client-side. */
export function saveClientAIConfig(settings: UserAIProviderSettings): void {
  inMemoryAIConfig = { ...settings };
}

/** Clear the in-memory provider configuration. */
export function clearSavedClientAIConfig(): void {
  inMemoryAIConfig = { provider: 'gemini' };
}

/**
 * Send an analytical question to the secure server AI endpoint
 */
export async function queryAI(options: ClientAIQueryOptions): Promise<AIQueryResponse> {
  const { question, accountId, phaseId, isGuest = false, providerConfig } = options;

  if (!question || question.trim().length === 0) {
    throw new AIError('لطفاً سوال خود را وارد کنید.', 'QUERY_VALIDATION_FAILED');
  }

  // 1. Guest Demo Mode: Execute locally via Mock Provider without backend request
  if (isGuest || !isSupabaseConfigured) {
    const mockTrades = await MockStorage.getTrades({ accountId: accountId || undefined });
    const classified = classifyTrades(mockTrades);
    const metrics = calculateCoreMetrics(classified);
    const mockProvider = getMockAIProvider();
    const mockText = await mockProvider.generateText(question);

    return {
      answer: `${mockText.data}\n\n**آمار آزمایشی (مهمان):** بر اساس ${mockTrades.length} معامله فرضی با نرخ برد ${metrics.winRate?.toFixed(1) || '۰'}٪ و سود خالص ${metrics.netPnl.toFixed(2)}$`,
      queryPlan: {
        metrics: ['winRate', 'totalTrades', 'netPnl'],
      },
      dataSummary: {
        sampleSize: mockTrades.length,
        period: 'داده‌های نمونه مهمان',
        metrics: {
          totalTrades: mockTrades.length,
          winRate: metrics.winRate,
          netPnl: metrics.netPnl,
          profitFactor: metrics.profitFactor,
          expectancy: metrics.expectancy,
        },
      },
      confidenceNote: 'حالت پیش‌نمایش مهمان (داده‌های شبیه‌سازی‌شده)',
    };
  }

  // 2. Production Authenticated Mode: Secure server-side call
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    throw new AIError(
      'برای استفاده از دستیار هوشمند، لطفاً ابتدا وارد حساب کاربری خود شوید.',
      'PERMISSION_DENIED'
    );
  }

  try {
    const response = await fetch('/api/ai/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        question: question.trim(),
        accountId: accountId || undefined,
        phaseId: phaseId || undefined,
        providerConfig: providerConfig || undefined,
      }),
    });

    if (!response.ok) {
      let errBody: { error?: string; code?: string } = {};
      try {
        errBody = await response.json();
      } catch {
        // Response was not JSON
      }

      const errorMessage =
        errBody.error || `خطا در ارتباط با سرور هوش مصنوعی (کد وضعیت ${response.status})`;

      throw new AIError(
        errorMessage,
        (errBody.code as any) || 'PROVIDER_EXECUTION_ERROR'
      );
    }

    const data: AIQueryResponse = await response.json();
    return data;
  } catch (err: unknown) {
    if (err instanceof AIError) throw err;

    const message = err instanceof Error ? err.message : String(err);
    throw new AIError(
      `عدم برقراری ارتباط با سرویس تحلیل هوشمند: ${message}`,
      'PROVIDER_UNAVAILABLE',
      undefined,
      err instanceof Error ? err : undefined
    );
  }
}

/**
 * Request AI Trade Review for an individual trade
 */
export async function requestTradeReview(options: {
  tradeId: string;
  isGuest?: boolean;
  providerConfig?: UserAIProviderSettings;
}): Promise<AITradeReviewResponse> {
  const { tradeId, isGuest = false, providerConfig } = options;

  if (!tradeId) throw new AIError('شناسه معامله الزامی است', 'QUERY_VALIDATION_FAILED');

  if (isGuest || !isSupabaseConfigured) {
    const trade = await MockStorage.getTrade(tradeId);
    if (!trade) throw new AIError('معامله یافت نشد', 'PERMISSION_DENIED');
    const journals = await MockStorage.getTradeJournals();
    const journal = journals.find(j => j.trade_id === tradeId) || null;
    const strats = await MockStorage.getStrategies();
    const setups = await MockStorage.getSetups();
    const mistakes = await MockStorage.getMistakes();

    return executeAITradeReview({
      trade,
      journal,
      strategy: journal?.strategy_id ? strats.find(s => s.id === journal.strategy_id) || null : null,
      setup: journal?.setup_id ? setups.find(s => s.id === journal.setup_id) || null : null,
      mistakes,
    }, getMockAIProvider());
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new AIError('احراز هویت الزامی است', 'PERMISSION_DENIED');

  const response = await fetch('/api/ai/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: 'trade-review',
      tradeId,
      providerConfig: providerConfig || getSavedClientAIConfig(),
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new AIError(
      errBody.error || `خطا در دریافت بازبینی هوشمند معامله (${response.status})`,
      errBody.code || 'PROVIDER_EXECUTION_ERROR'
    );
  }

  return response.json();
}

/**
 * Request AI Auto-Tagging recommendations for a trade
 */
export async function requestAutoTagging(options: {
  tradeId: string;
  isGuest?: boolean;
  providerConfig?: UserAIProviderSettings;
}): Promise<AIAutoTagResponse> {
  const { tradeId, isGuest = false, providerConfig } = options;

  if (!tradeId) throw new AIError('شناسه معامله الزامی است', 'QUERY_VALIDATION_FAILED');

  if (isGuest || !isSupabaseConfigured) {
    const trade = await MockStorage.getTrade(tradeId);
    if (!trade) throw new AIError('معامله یافت نشد', 'PERMISSION_DENIED');
    const journals = await MockStorage.getTradeJournals();
    const journal = journals.find(j => j.trade_id === tradeId) || null;
    const strategies = await MockStorage.getStrategies();
    const setups = await MockStorage.getSetups();
    const tags = await MockStorage.getTags();
    const mistakes = await MockStorage.getMistakes();

    return executeAIAutoTagging({
      trade,
      journal,
      strategies,
      setups,
      tags,
      mistakes,
    }, getMockAIProvider());
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new AIError('احراز هویت الزامی است', 'PERMISSION_DENIED');

  const response = await fetch('/api/ai/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: 'auto-tag',
      tradeId,
      providerConfig: providerConfig || getSavedClientAIConfig(),
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new AIError(
      errBody.error || `خطا در دریافت پیشنهادات تگ هوشمند (${response.status})`,
      errBody.code || 'PROVIDER_EXECUTION_ERROR'
    );
  }

  return response.json();
}

/**
 * Request AI Periodic Report (Weekly / Monthly)
 */
export async function requestPeriodicReview(options: {
  periodType: 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  periodTitle?: string;
  accountId?: string;
  phaseId?: string;
  isGuest?: boolean;
  providerConfig?: UserAIProviderSettings;
}): Promise<AIReportResponse> {
  const { periodType, startDate, endDate, periodTitle, accountId, phaseId, isGuest = false, providerConfig } = options;

  if (!startDate || !endDate) throw new AIError('بازه زمانی الزامی است', 'QUERY_VALIDATION_FAILED');

  if (isGuest || !isSupabaseConfigured) {
    const allTrades = await MockStorage.getTrades({ accountId });
    const currentTrades = allTrades.filter(t => {
      return t.entry_datetime >= startDate && t.entry_datetime <= endDate;
    });

    const curStart = new Date(startDate);
    const curEnd = new Date(endDate);
    const durationMs = curEnd.getTime() - curStart.getTime();
    const prevEnd = new Date(curStart.getTime() - 1000);
    const prevStart = new Date(prevEnd.getTime() - durationMs);

    const previousTrades = allTrades.filter(t => {
      return t.entry_datetime >= prevStart.toISOString() && t.entry_datetime <= prevEnd.toISOString();
    });

    return executeAIPeriodicReport({
      periodType,
      periodTitle: periodTitle || `${periodType === 'weekly' ? 'هفته' : 'ماه'} انتخابی`,
      startDate,
      endDate,
      currentTrades,
      previousTrades,
    }, getMockAIProvider());
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new AIError('احراز هویت الزامی است', 'PERMISSION_DENIED');

  const response = await fetch('/api/ai/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: 'periodic-review',
      periodType,
      startDate,
      endDate,
      periodTitle,
      accountId: accountId || undefined,
      phaseId: phaseId || undefined,
      providerConfig: providerConfig || getSavedClientAIConfig(),
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new AIError(
      errBody.error || `خطا در دریافت گزارش هوشمند دوره (${response.status})`,
      errBody.code || 'PROVIDER_EXECUTION_ERROR'
    );
  }

  return response.json();
}

