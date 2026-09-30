import { describe, it, expect } from 'vitest';
import {
  calculateNetPnl,
  classifyTradeResult,
  calculateWinRate,
  calculateProfitFactor,
  calculateExpectancy,
  calculateAverageWin,
  calculateAverageLoss,
  calculateCoreMetrics,
  classifyTrades,
} from './metrics';
import { calculateEquityCurve, calculateDrawdown } from './equity';
import type { Trade } from '../../types/database';

describe('Financial Analytics Core Audit', () => {
  it('correctly calculates net P/L with commission and swap', () => {
    const trade: Trade = {
      id: 't1',
      user_id: 'u1',
      account_id: 'a1',
      phase_id: null,
      import_batch_id: null,
      ticket: '100',
      position_id: null,
      symbol: 'EURUSD',
      side: 'buy',
      volume: 1.0,
      entry_datetime: '2024-01-01T10:00:00Z',
      entry_price: 1.1000,
      stop_loss: null,
      take_profit: null,
      exit_datetime: '2024-01-01T12:00:00Z',
      exit_price: 1.1050,
      commission: -10,
      swap: -2.5,
      profit: 100,
      comment: null,
      magic_number: null,
      source: 'mt5',
      source_file: null,
      duration_seconds: 7200,
      created_at: '',
      updated_at: '',
    };

    // Net PnL = 100 + (-10) + (-2.5) = 87.5
    expect(calculateNetPnl(trade)).toBe(87.5);
    expect(classifyTradeResult(calculateNetPnl(trade))).toBe('win');
  });

  it('determines win rate, profit factor, average win/loss, and expectancy deterministically', () => {
    // 3 wins: +100, +200, +300 (Gross = 600)
    // 2 losses: -150, -50 (Gross = -200)
    // 1 breakeven: 0
    const testTrades: Trade[] = [
      { id: '1', profit: 100, commission: 0, swap: 0 } as any,
      { id: '2', profit: 200, commission: 0, swap: 0 } as any,
      { id: '3', profit: 300, commission: 0, swap: 0 } as any,
      { id: '4', profit: -150, commission: 0, swap: 0 } as any,
      { id: '5', profit: -50, commission: 0, swap: 0 } as any,
      { id: '6', profit: 0, commission: 0, swap: 0 } as any,
    ];

    const classified = classifyTrades(testTrades);
    const metrics = calculateCoreMetrics(classified);

    expect(metrics.totalTrades).toBe(6);
    expect(metrics.winningTrades).toBe(3);
    expect(metrics.losingTrades).toBe(2);
    expect(metrics.breakevenTrades).toBe(1);

    // Win rate = 3 / (3 + 2) * 100 = 60%
    expect(metrics.winRate).toBe(60);

    // Gross profit = 600, Gross loss = -200, Net = 400
    expect(metrics.grossProfit).toBe(600);
    expect(metrics.grossLoss).toBe(-200);
    expect(metrics.netPnl).toBe(400);

    // Profit Factor = 600 / 200 = 3.0
    expect(metrics.profitFactor).toBe(3.0);

    // Average Win = 600 / 3 = 200
    expect(metrics.averageWin).toBe(200);

    // Average Loss = -200 / 2 = -100
    expect(metrics.averageLoss).toBe(-100);

    // Expectancy = (0.6 * 200) + (0.4 * -100) = 120 - 40 = 80
    expect(metrics.expectancy).toBe(80);
  });

  it('calculates period equity curve and drawdown baseline accurately', () => {
    const periodStartBalance = 15000;
    const trades = [
      { exit_datetime: '2024-02-01T10:00:00Z', netPnl: 1000 },
      { exit_datetime: '2024-02-02T10:00:00Z', netPnl: -2000 },
      { exit_datetime: '2024-02-03T10:00:00Z', netPnl: 3000 },
    ] as any;

    const equity = calculateEquityCurve(trades, periodStartBalance);
    expect(equity.startingBalance).toBe(15000);
    expect(equity.endingBalance).toBe(17000);
    expect(equity.netChange).toBe(2000);
    // Return % = (2000 / 15000) * 100 = 13.333%
    expect(equity.returnPercent).toBeCloseTo(13.333, 2);

    const drawdown = calculateDrawdown(equity);
    // Peak after first trade is 16000. Second trade drops to 14000 (drawdown = -2000, -12.5%)
    expect(drawdown.maxDrawdown).toBe(-2000);
    expect(drawdown.maxDrawdownPercent).toBeCloseTo(-12.5, 2);
  });
});
