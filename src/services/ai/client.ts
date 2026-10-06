// ============================================================
// Client AI Service
// Client-side adapter communicating with server API boundary
// Never contains AI API keys; uses Supabase Bearer authentication
// ============================================================

import { supabase, isSupabaseConfigured } from '../supabase';
import type { AIQueryResponse } from './types';
import { AIError } from './types';
import { getMockAIProvider } from './mock-provider';
import { MockStorage } from '../mockStorage';
import { calculateCoreMetrics, classifyTrades } from '../analytics/metrics';

export interface ClientAIQueryOptions {
  question: string;
  accountId?: string;
  phaseId?: string;
  isGuest?: boolean;
}

/**
 * Send an analytical question to the secure server AI endpoint
 */
export async function queryAI(options: ClientAIQueryOptions): Promise<AIQueryResponse> {
  const { question, accountId, phaseId, isGuest = false } = options;

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
