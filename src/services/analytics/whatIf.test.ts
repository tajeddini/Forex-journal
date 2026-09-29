// ============================================================
// What-If Analysis Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { applyWhatIfScenario, calculateWhatIf, type WhatIfScenario, type WhatIfCondition } from './whatIf';
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
    entry_datetime: '2024-01-01T10:00:00Z',
    entry_price: 1.1,
    stop_loss: null,
    take_profit: null,
    exit_datetime: '2024-01-01T11:00:00Z',
    exit_price: 1.2,
    commission: 0,
    swap: 0,
    profit: 100,
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

describe('What-If Analysis', () => {
  describe('applyWhatIfScenario', () => {
    it('excludes trades by symbol', () => {
      const trades = classifyTrades([
        mockTrade({ symbol: 'EURUSD', profit: 100 }),
        mockTrade({ symbol: 'GBPUSD', profit: 50 }),
        mockTrade({ symbol: 'EURUSD', profit: -30 }),
      ]);

      const scenario: WhatIfScenario = {
        id: 'test',
        name: 'Exclude EURUSD',
        conditions: [
          { id: '1', type: 'symbol', operator: 'equals', value: 'EURUSD', label: '' },
        ],
      };

      const result = applyWhatIfScenario(trades, scenario);
      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('GBPUSD');
    });

    it('excludes trades by side', () => {
      const trades = classifyTrades([
        mockTrade({ side: 'buy', profit: 100 }),
        mockTrade({ side: 'sell', profit: 50 }),
        mockTrade({ side: 'buy', profit: -30 }),
      ]);

      const scenario: WhatIfScenario = {
        id: 'test',
        name: 'Exclude Buy',
        conditions: [
          { id: '1', type: 'side', operator: 'equals', value: 'buy', label: '' },
        ],
      };

      const result = applyWhatIfScenario(trades, scenario);
      expect(result).toHaveLength(1);
      expect(result[0].side).toBe('sell');
    });

    it('excludes losing trades', () => {
      const trades = classifyTrades([
        mockTrade({ profit: 100 }),
        mockTrade({ profit: -50 }),
        mockTrade({ profit: 75 }),
      ]);

      const scenario: WhatIfScenario = {
        id: 'test',
        name: 'Exclude Losses',
        conditions: [
          { id: '1', type: 'result', operator: 'equals', value: 'loss', label: '' },
        ],
      };

      const result = applyWhatIfScenario(trades, scenario);
      expect(result).toHaveLength(2);
      expect(result.every(t => t.result !== 'loss')).toBe(true);
    });

    it('handles combined conditions', () => {
      const trades = classifyTrades([
        mockTrade({ symbol: 'EURUSD', side: 'buy', profit: 100 }),
        mockTrade({ symbol: 'EURUSD', side: 'sell', profit: 50 }),
        mockTrade({ symbol: 'GBPUSD', side: 'buy', profit: -30 }),
      ]);

      const scenario: WhatIfScenario = {
        id: 'test',
        name: 'Exclude EURUSD Buy',
        conditions: [
          { id: '1', type: 'symbol', operator: 'equals', value: 'EURUSD', label: '' },
          { id: '2', type: 'side', operator: 'equals', value: 'buy', label: '' },
        ],
      };

      const result = applyWhatIfScenario(trades, scenario);
      expect(result).toHaveLength(2);
    });

    it('returns all trades when no conditions', () => {
      const trades = classifyTrades([
        mockTrade({ profit: 100 }),
        mockTrade({ profit: 50 }),
      ]);

      const scenario: WhatIfScenario = {
        id: 'test',
        name: 'Empty',
        conditions: [],
      };

      const result = applyWhatIfScenario(trades, scenario);
      expect(result).toHaveLength(2);
    });
  });

  describe('calculateWhatIf', () => {
    it('calculates differences correctly', () => {
      const trades = classifyTrades([
        mockTrade({ profit: 100 }),
        mockTrade({ profit: 50 }),
        mockTrade({ profit: -80 }),
        mockTrade({ profit: -20 }),
      ]);

      const scenario: WhatIfScenario = {
        id: 'test',
        name: 'Exclude Losses',
        conditions: [
          { id: '1', type: 'result', operator: 'equals', value: 'loss', label: '' },
        ],
      };

      const result = calculateWhatIf(trades, scenario, 10000);

      expect(result.originalTrades).toBe(4);
      expect(result.excludedTrades).toBe(2);
      expect(result.remainingTrades).toBe(2);
      expect(result.actualMetrics.netPnl).toBe(50); // 100 + 50 - 80 - 20
      expect(result.whatIfMetrics.netPnl).toBe(150); // 100 + 50
      expect(result.differences.netPnl).toBe(100); // 150 - 50
    });

    it('does not modify original trades', () => {
      const originalTrades = classifyTrades([
        mockTrade({ profit: 100 }),
        mockTrade({ profit: -50 }),
      ]);

      const originalLength = originalTrades.length;
      const originalNetPnl = originalTrades.reduce((sum, t) => sum + t.netPnl, 0);

      const scenario: WhatIfScenario = {
        id: 'test',
        name: 'Exclude Losses',
        conditions: [
          { id: '1', type: 'result', operator: 'equals', value: 'loss', label: '' },
        ],
      };

      calculateWhatIf(originalTrades, scenario, 10000);

      // Verify original trades are unchanged
      expect(originalTrades).toHaveLength(originalLength);
      expect(originalTrades.reduce((sum, t) => sum + t.netPnl, 0)).toBe(originalNetPnl);
    });

    it('recalculates equity curve', () => {
      const trades = classifyTrades([
        mockTrade({ profit: 100, exit_datetime: '2024-01-01T10:00:00Z' }),
        mockTrade({ profit: -50, exit_datetime: '2024-01-02T10:00:00Z' }),
        mockTrade({ profit: 75, exit_datetime: '2024-01-03T10:00:00Z' }),
      ]);

      const scenario: WhatIfScenario = {
        id: 'test',
        name: 'Exclude Losses',
        conditions: [
          { id: '1', type: 'result', operator: 'equals', value: 'loss', label: '' },
        ],
      };

      const result = calculateWhatIf(trades, scenario, 10000);

      // Actual equity: 10000 → 10100 → 10050 → 10125
      // What-If equity: 10000 → 10100 → 10175
      expect(result.actualEquity.endingBalance).toBe(10125);
      expect(result.whatIfEquity.endingBalance).toBe(10175);
    });

    it('recalculates drawdown', () => {
      const trades = classifyTrades([
        mockTrade({ profit: 100, exit_datetime: '2024-01-01T10:00:00Z' }),
        mockTrade({ profit: -200, exit_datetime: '2024-01-02T10:00:00Z' }),
        mockTrade({ profit: 300, exit_datetime: '2024-01-03T10:00:00Z' }),
      ]);

      const scenario: WhatIfScenario = {
        id: 'test',
        name: 'Exclude Losses',
        conditions: [
          { id: '1', type: 'result', operator: 'equals', value: 'loss', label: '' },
        ],
      };

      const result = calculateWhatIf(trades, scenario, 10000);

      // Actual: 10000 → 10100 → 9900 → 10200, max drawdown = -200
      // What-If: 10000 → 10100 → 10400, max drawdown = 0
      expect(result.actualDrawdown.maxDrawdown).toBe(-200);
      expect(result.whatIfDrawdown.maxDrawdown).toBe(0);
    });
  });
});
