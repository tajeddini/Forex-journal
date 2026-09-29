// ============================================================
// Time Analytics Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { analyzeByHour, analyzeByDay, generateCalendarData } from './timeAnalytics';
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

describe('analyzeByHour', () => {
  it('groups trades by hour correctly', () => {
    const trades = classifyTrades([
      mockTrade({ entry_datetime: '2024-01-01T10:00:00Z', profit: 100 }),
      mockTrade({ entry_datetime: '2024-01-01T10:30:00Z', profit: 50 }),
      mockTrade({ entry_datetime: '2024-01-01T14:00:00Z', profit: -30 }),
    ]);

    const result = analyzeByHour(trades);

    expect(result).toHaveLength(24);
    
    const hour10 = result.find(h => h.hour === 10);
    expect(hour10?.trades).toBe(2);
    expect(hour10?.netPnl).toBe(150);
    
    const hour14 = result.find(h => h.hour === 14);
    expect(hour14?.trades).toBe(1);
    expect(hour14?.netPnl).toBe(-30);
  });

  it('handles empty trades', () => {
    const result = analyzeByHour([]);
    expect(result).toHaveLength(24);
    expect(result.every(h => h.trades === 0)).toBe(true);
  });
});

describe('analyzeByDay', () => {
  it('groups trades by day of week', () => {
    // 2024-01-06 is Saturday
    const trades = classifyTrades([
      mockTrade({ entry_datetime: '2024-01-06T10:00:00Z', profit: 100 }), // Saturday
      mockTrade({ entry_datetime: '2024-01-07T10:00:00Z', profit: 50 }),  // Sunday
      mockTrade({ entry_datetime: '2024-01-06T14:00:00Z', profit: -30 }), // Saturday
    ]);

    const result = analyzeByDay(trades);

    expect(result).toHaveLength(7);
    
    const saturday = result.find(d => d.day === 0); // Saturday = 0 in Persian
    expect(saturday?.trades).toBe(2);
    expect(saturday?.netPnl).toBe(70);
  });

  it('handles empty trades', () => {
    const result = analyzeByDay([]);
    expect(result).toHaveLength(7);
    expect(result.every(d => d.trades === 0)).toBe(true);
  });
});

describe('generateCalendarData', () => {
  it('generates calendar for date range', () => {
    const trades = classifyTrades([
      mockTrade({ exit_datetime: '2024-01-15T10:00:00Z', profit: 100 }),
      mockTrade({ exit_datetime: '2024-01-15T14:00:00Z', profit: 50 }),
      mockTrade({ exit_datetime: '2024-01-16T10:00:00Z', profit: -30 }),
    ]);

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');
    const result = generateCalendarData(trades, startDate, endDate);

    expect(result.length).toBe(31); // January has 31 days
    
    const jan15 = result.find(d => d.date === '2024-01-15');
    expect(jan15?.trades).toBe(2);
    expect(jan15?.netPnl).toBe(150);
    
    const jan16 = result.find(d => d.date === '2024-01-16');
    expect(jan16?.trades).toBe(1);
    expect(jan16?.netPnl).toBe(-30);
  });

  it('handles empty trades', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-07');
    const result = generateCalendarData([], startDate, endDate);

    expect(result.length).toBe(7);
    expect(result.every(d => d.trades === 0)).toBe(true);
  });
});
