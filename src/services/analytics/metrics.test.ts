// ============================================================
// Financial Calculation Tests
// Exact expected values for every core metric
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  calculateNetPnl,
  classifyTradeResult,
  classifyTrades,
  calculateWinRate,
  calculateProfitFactor,
  calculateAverageWin,
  calculateAverageLoss,
  calculateExpectancy,
  calculateCoreMetrics,
} from './metrics';
import type { Trade } from '../../types/database';

// Helper to create a mock trade
function mockTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 'test-id',
    user_id: 'user-id',
    account_id: 'account-id',
    phase_id: null,
    import_batch_id: null,
    ticket: null,
    position_id: null,
    symbol: 'EURUSD',
    side: 'buy',
    volume: 0.1,
    entry_datetime: '2024-01-01T00:00:00Z',
    entry_price: 1.1,
    stop_loss: null,
    take_profit: null,
    exit_datetime: '2024-01-01T01:00:00Z',
    exit_price: 1.2,
    commission: 0,
    swap: 0,
    profit: 0,
    comment: null,
    magic_number: null,
    source: 'mt4',
    source_file: null,
    duration_seconds: 3600,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('calculateNetPnl', () => {
  it('calculates net P/L with profit only', () => {
    const trade = mockTrade({ profit: 100, commission: 0, swap: 0 });
    expect(calculateNetPnl(trade)).toBe(100);
  });

  it('calculates net P/L with commission', () => {
    const trade = mockTrade({ profit: 100, commission: -10, swap: 0 });
    expect(calculateNetPnl(trade)).toBe(90);
  });

  it('calculates net P/L with swap', () => {
    const trade = mockTrade({ profit: 100, commission: 0, swap: -5 });
    expect(calculateNetPnl(trade)).toBe(95);
  });

  it('calculates net P/L with all components', () => {
    const trade = mockTrade({ profit: 100, commission: -10, swap: -5 });
    expect(calculateNetPnl(trade)).toBe(85);
  });

  it('handles negative profit (loss)', () => {
    const trade = mockTrade({ profit: -50, commission: -5, swap: -2 });
    expect(calculateNetPnl(trade)).toBe(-57);
  });

  it('handles zero values', () => {
    const trade = mockTrade({ profit: 0, commission: 0, swap: 0 });
    expect(calculateNetPnl(trade)).toBe(0);
  });
});

describe('classifyTradeResult', () => {
  it('classifies positive P/L as win', () => {
    expect(classifyTradeResult(100)).toBe('win');
    expect(classifyTradeResult(0.01)).toBe('win');
  });

  it('classifies negative P/L as loss', () => {
    expect(classifyTradeResult(-100)).toBe('loss');
    expect(classifyTradeResult(-0.01)).toBe('loss');
  });

  it('classifies zero P/L as breakeven', () => {
    expect(classifyTradeResult(0)).toBe('breakeven');
  });
});

describe('calculateWinRate', () => {
  it('calculates win rate for mixed results', () => {
    expect(calculateWinRate(5, 5)).toBe(50);
  });

  it('calculates 100% win rate', () => {
    expect(calculateWinRate(10, 0)).toBe(100);
  });

  it('calculates 0% win rate', () => {
    expect(calculateWinRate(0, 10)).toBe(0);
  });

  it('returns null for no closed trades', () => {
    expect(calculateWinRate(0, 0)).toBeNull();
  });

  it('does not include breakeven in denominator', () => {
    // 5 wins, 5 losses, 3 breakeven → win rate = 50%
    expect(calculateWinRate(5, 5)).toBe(50);
  });
});

describe('calculateProfitFactor', () => {
  it('calculates profit factor normally', () => {
    // Gross profit: 150, Gross loss: -100
    expect(calculateProfitFactor(150, -100)).toBe(1.5);
  });

  it('returns Infinity when no losses', () => {
    expect(calculateProfitFactor(100, 0)).toBe(Infinity);
  });

  it('returns null when no profits and no losses', () => {
    expect(calculateProfitFactor(0, 0)).toBeNull();
  });

  it('handles exact values from audit scenario', () => {
    // Trade 1: +100, Trade 2: +50, Trade 3: -80, Trade 4: -20
    // Gross profit = 150, Gross loss = -100
    expect(calculateProfitFactor(150, -100)).toBe(1.5);
  });
});

describe('calculateAverageWin', () => {
  it('calculates average win normally', () => {
    expect(calculateAverageWin(150, 2)).toBe(75);
  });

  it('returns null for no wins', () => {
    expect(calculateAverageWin(0, 0)).toBeNull();
  });

  it('handles single win', () => {
    expect(calculateAverageWin(100, 1)).toBe(100);
  });
});

describe('calculateAverageLoss', () => {
  it('calculates average loss (negative)', () => {
    expect(calculateAverageLoss(-100, 2)).toBe(-50);
  });

  it('returns null for no losses', () => {
    expect(calculateAverageLoss(0, 0)).toBeNull();
  });
});

describe('calculateExpectancy', () => {
  it('calculates expectancy for mixed results', () => {
    // 5 wins, 5 losses, avg win: 30, avg loss: -20
    // Expectancy = (0.5 × 30) + (0.5 × -20) = 15 - 10 = 5
    expect(calculateExpectancy(5, 5, 30, -20)).toBe(5);
  });

  it('calculates expectancy for all wins', () => {
    // 10 wins, 0 losses, avg win: 50
    // Expectancy = (1.0 × 50) + (0 × null) = 50
    // But since avgLoss is null, we return null
    expect(calculateExpectancy(10, 0, 50, null)).toBeNull();
  });

  it('returns null for no trades', () => {
    expect(calculateExpectancy(0, 0, null, null)).toBeNull();
  });

  it('calculates expectancy for audit scenario', () => {
    // Trades: +100, +50, -80, -20
    // Wins: 2, Losses: 2
    // Avg Win: 75, Avg Loss: -50
    // Win Rate: 50%, Loss Rate: 50%
    // Expectancy = (0.5 × 75) + (0.5 × -50) = 37.5 - 25 = 12.5
    expect(calculateExpectancy(2, 2, 75, -50)).toBe(12.5);
  });
});

describe('calculateCoreMetrics — Full Audit Scenario', () => {
  it('produces correct metrics for audit scenario', () => {
    // Trade 1: +100, Trade 2: +50, Trade 3: -80, Trade 4: -20
    const trades = classifyTrades([
      mockTrade({ profit: 100, commission: 0, swap: 0 }),
      mockTrade({ profit: 50, commission: 0, swap: 0 }),
      mockTrade({ profit: -80, commission: 0, swap: 0 }),
      mockTrade({ profit: -20, commission: 0, swap: 0 }),
    ]);

    const metrics = calculateCoreMetrics(trades);

    expect(metrics.totalTrades).toBe(4);
    expect(metrics.winningTrades).toBe(2);
    expect(metrics.losingTrades).toBe(2);
    expect(metrics.breakevenTrades).toBe(0);
    expect(metrics.winRate).toBe(50);
    expect(metrics.grossProfit).toBe(150);
    expect(metrics.grossLoss).toBe(-100);
    expect(metrics.netPnl).toBe(50);
    expect(metrics.profitFactor).toBe(1.5);
    expect(metrics.averageWin).toBe(75);
    expect(metrics.averageLoss).toBe(-50);
    expect(metrics.expectancy).toBe(12.5);
  });

  it('handles commission and swap correctly', () => {
    const trades = classifyTrades([
      mockTrade({ profit: 100, commission: -10, swap: -5 }), // Net: 85
      mockTrade({ profit: -50, commission: -5, swap: -2 }), // Net: -57
    ]);

    const metrics = calculateCoreMetrics(trades);

    expect(metrics.grossProfit).toBe(85);
    expect(metrics.grossLoss).toBe(-57);
    expect(metrics.netPnl).toBe(28);
  });

  it('handles breakeven trades', () => {
    const trades = classifyTrades([
      mockTrade({ profit: 100 }),
      mockTrade({ profit: 0 }), // breakeven
      mockTrade({ profit: -50 }),
    ]);

    const metrics = calculateCoreMetrics(trades);

    expect(metrics.totalTrades).toBe(3);
    expect(metrics.winningTrades).toBe(1);
    expect(metrics.losingTrades).toBe(1);
    expect(metrics.breakevenTrades).toBe(1);
    // Win rate should be 50% (1 win / (1 win + 1 loss))
    expect(metrics.winRate).toBe(50);
  });

  it('returns correct values for empty trades', () => {
    const metrics = calculateCoreMetrics([]);

    expect(metrics.totalTrades).toBe(0);
    expect(metrics.winningTrades).toBe(0);
    expect(metrics.losingTrades).toBe(0);
    expect(metrics.winRate).toBeNull();
    expect(metrics.profitFactor).toBeNull();
    expect(metrics.averageWin).toBeNull();
    expect(metrics.averageLoss).toBeNull();
    expect(metrics.expectancy).toBeNull();
  });
});
