import { describe, it, expect, beforeEach } from 'vitest';
import { createTrade, getTrade, getTrades } from './trades';
import { MockStorage } from './mockStorage';
import type { TradeInsert } from '../types/database';

describe('Manual Trade Service', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('creates a manual trade with complete fields and calculated duration', async () => {
    const entryTime = new Date('2026-10-03T10:00:00Z').toISOString();
    const exitTime = new Date('2026-10-03T11:30:00Z').toISOString(); // 90 mins = 5400s

    const input: TradeInsert = {
      user_id: 'guest-demo-user',
      account_id: 'mock-account-1',
      symbol: 'EURUSD',
      side: 'buy',
      volume: 0.5,
      entry_datetime: entryTime,
      exit_datetime: exitTime,
      entry_price: 1.0850,
      exit_price: 1.0920,
      stop_loss: 1.0820,
      take_profit: 1.0950,
      profit: 350.00,
      commission: -3.5,
      swap: -0.8,
      ticket: 'MAN-99881',
      comment: 'Manual breakout trade',
      source: 'manual',
    };

    const created = await createTrade(input);

    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    expect(created.symbol).toBe('EURUSD');
    expect(created.side).toBe('buy');
    expect(created.volume).toBe(0.5);
    expect(created.profit).toBe(350.00);
    expect(created.source).toBe('manual');
    expect(created.duration_seconds).toBe(5400);

    // Retrieve single trade
    const fetched = await getTrade(created.id, 'guest-demo-user');
    expect(fetched).toBeDefined();
    expect(fetched?.ticket).toBe('MAN-99881');
    expect(fetched?.profit).toBe(350.00);

    // Retrieve list of trades
    const all = await getTrades('guest-demo-user', 'mock-account-1');
    expect(all.some(t => t.id === created.id)).toBe(true);
  });

  it('correctly handles zero profit (breakeven) and negative profit', async () => {
    const breakevenTrade = await createTrade({
      user_id: 'guest-demo-user',
      account_id: 'mock-account-1',
      symbol: 'XAUUSD',
      side: 'sell',
      volume: 1.0,
      entry_datetime: new Date().toISOString(),
      exit_datetime: new Date().toISOString(),
      entry_price: 2650.0,
      exit_price: 2650.0,
      profit: 0,
      commission: 0,
      swap: 0,
      source: 'manual',
    });

    expect(breakevenTrade.profit).toBe(0);

    const lossTrade = await createTrade({
      user_id: 'guest-demo-user',
      account_id: 'mock-account-1',
      symbol: 'GBPUSD',
      side: 'buy',
      volume: 0.2,
      entry_datetime: new Date().toISOString(),
      exit_datetime: new Date().toISOString(),
      entry_price: 1.3000,
      exit_price: 1.2950,
      profit: -100.0,
      commission: -2.0,
      swap: 0,
      source: 'manual',
    });

    expect(lossTrade.profit).toBe(-100.0);
  });
});
