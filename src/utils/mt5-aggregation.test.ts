import { describe, it, expect } from 'vitest';
import {
  aggregateMT5Positions,
  aggregateMT5DealsDetailed,
  positionToNormalizedTrade,
  classifyDealDirection,
  type MT5Deal,
} from './mt5-aggregation';

describe('MT5 Aggregation Engine', () => {
  describe('classifyDealDirection', () => {
    it('correctly classifies explicit MT5 entry column values', () => {
      expect(classifyDealDirection({ symbol: 'EURUSD', side: 'buy', volume: 1, price: 1.1, datetime: '', commission: 0, swap: 0, profit: 0, type: 'in', entry: 'in' })).toBe('in');
      expect(classifyDealDirection({ symbol: 'EURUSD', side: 'sell', volume: 1, price: 1.1, datetime: '', commission: 0, swap: 0, profit: 0, type: 'out', entry: 'out' })).toBe('out');
      // Closing a short position has side=buy and entry=out
      expect(classifyDealDirection({ symbol: 'EURUSD', side: 'buy', volume: 1, price: 1.1, datetime: '', commission: 0, swap: 0, profit: 50, type: 'out', entry: 'out' })).toBe('out');
    });
  });

  describe('aggregateMT5DealsDetailed', () => {
    it('aggregates single entry and full exit', () => {
      const deals: MT5Deal[] = [
        {
          position_id: 'POS100',
          symbol: 'EURUSD',
          side: 'buy',
          volume: 1.0,
          price: 1.1000,
          datetime: '2024-01-01T10:00:00Z',
          commission: -5,
          swap: 0,
          profit: 0,
          type: 'in',
          entry: 'in',
        },
        {
          position_id: 'POS100',
          symbol: 'EURUSD',
          side: 'sell',
          volume: 1.0,
          price: 1.1050,
          datetime: '2024-01-01T12:00:00Z',
          commission: -5,
          swap: -1,
          profit: 500,
          type: 'out',
          entry: 'out',
        },
      ];

      const result = aggregateMT5DealsDetailed(deals);
      expect(result.closedPositions).toHaveLength(1);
      expect(result.openPositions).toHaveLength(0);

      const pos = result.closedPositions[0];
      expect(pos.position_id).toBe('POS100');
      expect(pos.side).toBe('buy');
      expect(pos.closed_volume).toBe(1.0);
      expect(pos.remaining_open_volume).toBe(0);
      expect(pos.weighted_entry_price).toBe(1.1000);
      expect(pos.weighted_exit_price).toBe(1.1050);
      expect(pos.total_profit).toBe(500);
      expect(pos.total_commission).toBe(-10);
      expect(pos.total_swap).toBe(-1);
    });

    it('correctly handles Short positions where exit is Buy with entry=out', () => {
      const deals: MT5Deal[] = [
        {
          position_id: 'POS_SHORT',
          symbol: 'GBPUSD',
          side: 'sell',
          volume: 2.0,
          price: 1.3000,
          datetime: '2024-01-02T08:00:00Z',
          commission: -10,
          swap: 0,
          profit: 0,
          type: 'in',
          entry: 'in',
        },
        {
          position_id: 'POS_SHORT',
          symbol: 'GBPUSD',
          side: 'buy',
          volume: 2.0,
          price: 1.2900,
          datetime: '2024-01-02T16:00:00Z',
          commission: -10,
          swap: 5,
          profit: 2000,
          type: 'out',
          entry: 'out',
        },
      ];

      const result = aggregateMT5DealsDetailed(deals);
      expect(result.closedPositions).toHaveLength(1);

      const pos = result.closedPositions[0];
      expect(pos.side).toBe('sell');
      expect(pos.weighted_entry_price).toBe(1.3000);
      expect(pos.weighted_exit_price).toBe(1.2900);
      expect(pos.total_profit).toBe(2000);
    });

    it('supports multiple entries and multiple partial closes with remaining open volume', () => {
      const deals: MT5Deal[] = [
        // Entry 1: 1.0 lot @ 100
        {
          position_id: 'POS_SCALE',
          symbol: 'XAUUSD',
          side: 'buy',
          volume: 1.0,
          price: 2000,
          datetime: '2024-01-03T10:00:00Z',
          commission: -7,
          swap: 0,
          profit: 0,
          type: 'in',
          entry: 'in',
        },
        // Entry 2: 1.0 lot @ 2010 (weighted entry = 2005)
        {
          position_id: 'POS_SCALE',
          symbol: 'XAUUSD',
          side: 'buy',
          volume: 1.0,
          price: 2010,
          datetime: '2024-01-03T11:00:00Z',
          commission: -7,
          swap: 0,
          profit: 0,
          type: 'in',
          entry: 'in',
        },
        // Partial exit 1: 0.5 lot @ 2020
        {
          position_id: 'POS_SCALE',
          symbol: 'XAUUSD',
          side: 'sell',
          volume: 0.5,
          price: 2020,
          datetime: '2024-01-03T12:00:00Z',
          commission: -3.5,
          swap: 0,
          profit: 750,
          type: 'out',
          entry: 'out',
        },
        // Partial exit 2: 0.5 lot @ 2030 (weighted exit = 2025)
        {
          position_id: 'POS_SCALE',
          symbol: 'XAUUSD',
          side: 'sell',
          volume: 0.5,
          price: 2030,
          datetime: '2024-01-03T13:00:00Z',
          commission: -3.5,
          swap: 0,
          profit: 1250,
          type: 'out',
          entry: 'out',
        },
      ];

      const result = aggregateMT5DealsDetailed(deals);
      expect(result.closedPositions).toHaveLength(1);

      const pos = result.closedPositions[0];
      expect(pos.total_volume).toBe(2.0); // Total entered
      expect(pos.closed_volume).toBe(1.0); // Total exited so far
      expect(pos.remaining_open_volume).toBe(1.0); // Remaining open volume!
      expect(pos.is_partial_close).toBe(true);
      expect(pos.weighted_entry_price).toBe(2005);
      expect(pos.weighted_exit_price).toBe(2025);
      expect(pos.total_profit).toBe(2000);
    });

    it('detects still-open positions and does NOT fabricate exit datetime or price', () => {
      const deals: MT5Deal[] = [
        {
          position_id: 'POS_OPEN_ONLY',
          symbol: 'USDJPY',
          side: 'buy',
          volume: 1.5,
          price: 150.0,
          datetime: '2024-01-04T09:00:00Z',
          commission: -5,
          swap: 0,
          profit: 0,
          type: 'in',
          entry: 'in',
        },
      ];

      const result = aggregateMT5DealsDetailed(deals);
      expect(result.closedPositions).toHaveLength(0); // Not closed!
      expect(result.openPositions).toHaveLength(1);

      const openPos = result.openPositions[0];
      expect(openPos.position_id).toBe('POS_OPEN_ONLY');
      expect(openPos.remaining_open_volume).toBe(1.5);
      expect(openPos.is_still_open).toBe(true);
      expect(openPos.exit_datetime).toBe(''); // No fake exit
      expect(openPos.weighted_exit_price).toBe(0);
    });
  });

  describe('positionToNormalizedTrade', () => {
    it('converts aggregated position into valid normalized trade', () => {
      const position = {
        ticket: 'T123',
        position_id: 'P123',
        symbol: 'EURUSD',
        side: 'buy' as const,
        total_volume: 1.0,
        closed_volume: 1.0,
        remaining_open_volume: 0,
        entry_datetime: '2024-01-01T10:00:00Z',
        exit_datetime: '2024-01-01T12:00:00Z',
        weighted_entry_price: 1.1000,
        weighted_exit_price: 1.1050,
        total_commission: -10,
        total_swap: -2,
        total_profit: 500,
        deals: [{ symbol: 'EURUSD', side: 'buy' as const, volume: 1, price: 1.1, datetime: '', commission: 0, swap: 0, profit: 0, type: 'in', comment: 'trend entry', magic_number: 12345 }],
        is_partial_close: false,
        is_still_open: false,
      };

      const trade = positionToNormalizedTrade(position);
      expect(trade.ticket).toBe('T123');
      expect(trade.position_id).toBe('P123');
      expect(trade.comment).toBe('trend entry');
      expect(trade.magic_number).toBe(12345);
      expect(trade.profit).toBe(500);
    });
  });
});
