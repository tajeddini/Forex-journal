import { describe, it, expect } from 'vitest';
import {
  buildPatternInsightsPrompt,
  executeAIPatternInsights,
  PATTERN_INSIGHTS_SCHEMA,
} from './pattern-service';
import { getMockAIProvider } from './mock-provider';
import { detectTradingPatterns } from '../analytics/patterns';
import type { Trade } from '../../types/database';

function createMockTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 't-' + Math.random().toString(36).substring(2, 9),
    user_id: 'u1',
    account_id: 'a1',
    phase_id: 'p1',
    import_batch_id: null,
    ticket: '1001',
    position_id: '1001',
    symbol: 'EURUSD',
    side: 'buy',
    volume: 1.0,
    entry_datetime: '2026-10-05T08:30:00Z',
    entry_price: 1.1000,
    exit_datetime: '2026-10-05T09:30:00Z',
    exit_price: 1.1050,
    stop_loss: 1.0950,
    take_profit: 1.1100,
    profit: 60.0,
    commission: 0,
    swap: 0,
    duration_seconds: 3600,
    created_at: '2026-10-05T09:30:00Z',
    updated_at: '2026-10-05T09:30:00Z',
    ...overrides,
  };
}

describe('Phase 15 — AI Pattern Insights Service', () => {
  it('builds prompt grounded in deterministic pattern metrics', () => {
    const trades = [
      createMockTrade({ profit: 100 }),
      createMockTrade({ profit: 120 }),
      createMockTrade({ profit: -40 }),
    ];
    const detectionResult = detectTradingPatterns(trades.map(t => ({ trade: t })));
    const prompt = buildPatternInsightsPrompt({
      detectionResult,
      accountName: 'حساب دمو پراپ',
      periodLabel: 'ماه جاری',
    });

    expect(prompt).toContain('Forex Journal Analytics');
    expect(prompt).toContain('تعداد کل معاملات: 3');
    expect(prompt).toContain('حساب: حساب دمو پراپ');
    expect(prompt).toContain('نقاط قوت و مزیت‌های شناسایی‌شده');
    expect(prompt).toContain('نقاط ضعف و نشتی‌های سود');
  });

  it('handles empty trades gracefully without calling AI provider', async () => {
    const detectionResult = detectTradingPatterns([]);
    const provider = getMockAIProvider();
    const result = await executeAIPatternInsights(
      { detectionResult },
      provider
    );

    expect(result.summary).toContain('هیچ معامله‌ای');
    expect(result.confirmedEdges.length).toBe(0);
    expect(result.actionablePriorities.length).toBeGreaterThan(0);
  });

  it('executes AI pattern insights with mock provider and returns validated response', async () => {
    const trades = [
      createMockTrade({ profit: 150, symbol: 'EURUSD' }),
      createMockTrade({ profit: 120, symbol: 'EURUSD' }),
      createMockTrade({ profit: -50, symbol: 'EURUSD' }),
      createMockTrade({ profit: 80, symbol: 'GBPUSD' }),
      createMockTrade({ profit: -90, symbol: 'GBPUSD' }),
    ];
    const detectionResult = detectTradingPatterns(trades.map(t => ({ trade: t })));
    const provider = getMockAIProvider();

    const result = await executeAIPatternInsights(
      { detectionResult, accountName: 'Main Live' },
      provider
    );

    expect(result.summary).toBeDefined();
    expect(result.confirmedEdges.length).toBeGreaterThan(0);
    expect(result.performanceLeaks.length).toBeGreaterThan(0);
    expect(result.actionablePriorities.length).toBeGreaterThan(0);
    expect(result.limitations.length).toBeGreaterThan(0);
  });
});
