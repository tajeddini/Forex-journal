// ============================================================
// Equity Curve & Drawdown Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { calculateEquityCurve, calculateDrawdown } from './equity';
import { classifyTrades } from './metrics';
import type { Trade } from '../../types/database';

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

describe('calculateEquityCurve', () => {
  it('calculates equity curve for positive sequence', () => {
    const trades = classifyTrades([
      mockTrade({ profit: 100, exit_datetime: '2024-01-01T10:00:00Z' }),
      mockTrade({ profit: 50, exit_datetime: '2024-01-02T10:00:00Z' }),
      mockTrade({ profit: 75, exit_datetime: '2024-01-03T10:00:00Z' }),
    ]);

    const curve = calculateEquityCurve(trades, 10000);

    expect(curve.startingBalance).toBe(10000);
    expect(curve.endingBalance).toBe(10225);
    expect(curve.netChange).toBe(225);
    expect(curve.returnPercent).toBeCloseTo(2.25);
    expect(curve.points.length).toBe(4); // start + 3 trades
  });

  it('calculates equity curve for negative sequence', () => {
    const trades = classifyTrades([
      mockTrade({ profit: -50, exit_datetime: '2024-01-01T10:00:00Z' }),
      mockTrade({ profit: -30, exit_datetime: '2024-01-02T10:00:00Z' }),
    ]);

    const curve = calculateEquityCurve(trades, 10000);

    expect(curve.endingBalance).toBe(9920);
    expect(curve.netChange).toBe(-80);
    expect(curve.returnPercent).toBeCloseTo(-0.8);
  });

  it('calculates equity curve for mixed sequence', () => {
    const trades = classifyTrades([
      mockTrade({ profit: 100, exit_datetime: '2024-01-01T10:00:00Z' }),
      mockTrade({ profit: -80, exit_datetime: '2024-01-02T10:00:00Z' }),
      mockTrade({ profit: 50, exit_datetime: '2024-01-03T10:00:00Z' }),
      mockTrade({ profit: -20, exit_datetime: '2024-01-04T10:00:00Z' }),
    ]);

    const curve = calculateEquityCurve(trades, 10000);

    expect(curve.endingBalance).toBe(10050);
    expect(curve.netChange).toBe(50);
  });

  it('handles empty trades', () => {
    const curve = calculateEquityCurve([], 10000);

    expect(curve.startingBalance).toBe(10000);
    expect(curve.endingBalance).toBe(10000);
    expect(curve.netChange).toBe(0);
    expect(curve.points.length).toBe(0);
  });
});

describe('calculateDrawdown', () => {
  it('calculates drawdown for increasing equity (no drawdown)', () => {
    const trades = classifyTrades([
      mockTrade({ profit: 100, exit_datetime: '2024-01-01T10:00:00Z' }),
      mockTrade({ profit: 50, exit_datetime: '2024-01-02T10:00:00Z' }),
      mockTrade({ profit: 75, exit_datetime: '2024-01-03T10:00:00Z' }),
    ]);

    const curve = calculateEquityCurve(trades, 10000);
    const dd = calculateDrawdown(curve);

    expect(dd.maxDrawdown).toBe(0);
    expect(dd.currentDrawdown).toBe(0);
  });

  it('calculates single drawdown', () => {
    const trades = classifyTrades([
      mockTrade({ profit: 100, exit_datetime: '2024-01-01T10:00:00Z' }), // 10100
      mockTrade({ profit: -150, exit_datetime: '2024-01-02T10:00:00Z' }), // 9950
      mockTrade({ profit: 200, exit_datetime: '2024-01-03T10:00:00Z' }), // 10150
    ]);

    const curve = calculateEquityCurve(trades, 10000);
    const dd = calculateDrawdown(curve);

    // Peak was 10100, dropped to 9950 → drawdown = -150
    expect(dd.maxDrawdown).toBe(-150);
    expect(dd.maxDrawdownPercent).toBeCloseTo(-150 / 10100 * 100, 2);
    // Current equity is 10150 (new peak), so current drawdown = 0
    expect(dd.currentDrawdown).toBe(0);
  });

  it('calculates multiple drawdowns', () => {
    const trades = classifyTrades([
      mockTrade({ profit: 100, exit_datetime: '2024-01-01T10:00:00Z' }), // 10100
      mockTrade({ profit: -200, exit_datetime: '2024-01-02T10:00:00Z' }), // 9900 (DD: -200)
      mockTrade({ profit: 300, exit_datetime: '2024-01-03T10:00:00Z' }), // 10200 (new peak)
      mockTrade({ profit: -100, exit_datetime: '2024-01-04T10:00:00Z' }), // 10100 (DD: -100)
    ]);

    const curve = calculateEquityCurve(trades, 10000);
    const dd = calculateDrawdown(curve);

    // Max drawdown was -200 (from 10100 to 9900)
    expect(dd.maxDrawdown).toBe(-200);
    // Current drawdown is -100 (from 10200 to 10100)
    expect(dd.currentDrawdown).toBe(-100);
  });

  it('handles recovery to new highs', () => {
    const trades = classifyTrades([
      mockTrade({ profit: 100, exit_datetime: '2024-01-01T10:00:00Z' }), // 10100
      mockTrade({ profit: -50, exit_datetime: '2024-01-02T10:00:00Z' }), // 10050
      mockTrade({ profit: 100, exit_datetime: '2024-01-03T10:00:00Z' }), // 10150 (new high)
    ]);

    const curve = calculateEquityCurve(trades, 10000);
    const dd = calculateDrawdown(curve);

    expect(dd.maxDrawdown).toBe(-50);
    expect(dd.currentDrawdown).toBe(0); // At new high
  });
});
