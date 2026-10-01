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

    it('handles INOUT deal without reversal (full and partial reduction)', () => {
      // Position: BUY 1.00 lot @ 1.1000
      // Deal 2: INOUT SELL 0.40 lot @ 1.1050 (reduction of 0.40 lot, leaving 0.60 open)
      // Deal 3: INOUT SELL 0.60 lot @ 1.1060 (closes remaining 0.60 lot fully)
      const deals: MT5Deal[] = [
        {
          position_id: 'POS_INOUT_NO_REV',
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
          position_id: 'POS_INOUT_NO_REV',
          symbol: 'EURUSD',
          side: 'sell',
          volume: 0.4,
          price: 1.1050,
          datetime: '2024-01-01T11:00:00Z',
          commission: -2,
          swap: 0,
          profit: 200,
          type: 'inout',
          entry: 'inout',
        },
        {
          position_id: 'POS_INOUT_NO_REV',
          symbol: 'EURUSD',
          side: 'sell',
          volume: 0.6,
          price: 1.1060,
          datetime: '2024-01-01T12:00:00Z',
          commission: -3,
          swap: -1,
          profit: 360,
          type: 'inout',
          entry: 'inout',
        },
      ];

      const result = aggregateMT5DealsDetailed(deals);
      expect(result.closedPositions).toHaveLength(1);
      expect(result.openPositions).toHaveLength(0);

      const pos = result.closedPositions[0];
      expect(pos.position_id).toBe('POS_INOUT_NO_REV');
      expect(pos.side).toBe('buy');
      expect(pos.total_volume).toBe(1.0);
      expect(pos.closed_volume).toBe(1.0);
      expect(pos.remaining_open_volume).toBe(0);
      expect(pos.weighted_entry_price).toBe(1.1000);
      // Weighted exit: (0.4 * 1.1050 + 0.6 * 1.1060) / 1.0 = (0.442 + 0.6636) = 1.1056
      expect(pos.weighted_exit_price).toBeCloseTo(1.1056, 4);
      expect(pos.total_profit).toBe(560);
      expect(pos.total_commission).toBe(-10);
      expect(pos.total_swap).toBe(-1);
    });

    it('handles INOUT deal WITH reversal (closes existing position and opens opposite position)', () => {
      // Existing position: BUY 1.00 lot @ 1.1000 (commission -5)
      // INOUT deal: SELL 1.50 lots @ 1.1080 (profit 800, commission -7.5)
      // Semantic result:
      // - Closes BUY 1.00 lot completely (commission -5 + -7.5*(1/1.5) = -10, profit 800)
      // - Opens new SELL 0.50 lot @ 1.1080 (commission -7.5*(0.5/1.5) = -2.5, profit 0)
      const deals: MT5Deal[] = [
        {
          position_id: 'POS_REV',
          symbol: 'EURUSD',
          side: 'buy',
          volume: 1.0,
          price: 1.1000,
          datetime: '2024-01-05T09:00:00Z',
          commission: -5,
          swap: 0,
          profit: 0,
          type: 'in',
          entry: 'in',
        },
        {
          position_id: 'POS_REV',
          symbol: 'EURUSD',
          side: 'sell',
          volume: 1.5,
          price: 1.1080,
          datetime: '2024-01-05T14:00:00Z',
          commission: -7.5,
          swap: 0,
          profit: 800,
          type: 'inout',
          entry: 'inout',
        },
      ];

      const result = aggregateMT5DealsDetailed(deals);

      // The closed BUY position
      expect(result.closedPositions).toHaveLength(1);
      const closedPos = result.closedPositions[0];
      expect(closedPos.side).toBe('buy');
      expect(closedPos.total_volume).toBe(1.0);
      expect(closedPos.closed_volume).toBe(1.0);
      expect(closedPos.weighted_entry_price).toBe(1.1000);
      expect(closedPos.weighted_exit_price).toBe(1.1080);
      expect(closedPos.total_profit).toBe(800);
      expect(closedPos.total_commission).toBe(-10);

      // The remaining newly opened SELL position
      expect(result.openPositions).toHaveLength(1);
      const openPos = result.openPositions[0];
      expect(openPos.side).toBe('sell');
      expect(openPos.total_volume).toBe(0.5);
      expect(openPos.remaining_open_volume).toBe(0.5);
      expect(openPos.weighted_entry_price).toBe(1.1080);
      expect(openPos.total_commission).toBe(-2.5);
      expect(openPos.is_still_open).toBe(true);
    });

    it('segregates different position IDs cleanly without leakage', () => {
      const deals: MT5Deal[] = [
        { position_id: 'P_1', symbol: 'EURUSD', side: 'buy', volume: 1.0, price: 1.10, datetime: '2024-01-01T10:00:00Z', commission: -5, swap: 0, profit: 0, type: 'in', entry: 'in' },
        { position_id: 'P_2', symbol: 'EURUSD', side: 'buy', volume: 2.0, price: 1.12, datetime: '2024-01-01T10:00:00Z', commission: -10, swap: 0, profit: 0, type: 'in', entry: 'in' },
        { position_id: 'P_1', symbol: 'EURUSD', side: 'sell', volume: 1.0, price: 1.15, datetime: '2024-01-01T12:00:00Z', commission: -5, swap: 0, profit: 500, type: 'out', entry: 'out' },
        { position_id: 'P_2', symbol: 'EURUSD', side: 'sell', volume: 2.0, price: 1.13, datetime: '2024-01-01T13:00:00Z', commission: -10, swap: 0, profit: 200, type: 'out', entry: 'out' },
      ];

      const result = aggregateMT5DealsDetailed(deals);
      expect(result.closedPositions).toHaveLength(2);

      const p1 = result.closedPositions.find(p => p.position_id === 'P_1')!;
      const p2 = result.closedPositions.find(p => p.position_id === 'P_2')!;

      expect(p1.closed_volume).toBe(1.0);
      expect(p1.weighted_entry_price).toBe(1.10);
      expect(p1.weighted_exit_price).toBe(1.15);
      expect(p1.total_profit).toBe(500);

      expect(p2.closed_volume).toBe(2.0);
      expect(p2.weighted_entry_price).toBe(1.12);
      expect(p2.weighted_exit_price).toBe(1.13);
      expect(p2.total_profit).toBe(200);
    });

    it('segregates different symbols cleanly without collision', () => {
      const deals: MT5Deal[] = [
        { position_id: 'P_EUR', symbol: 'EURUSD', side: 'buy', volume: 1.0, price: 1.10, datetime: '2024-01-01T10:00:00Z', commission: -5, swap: 0, profit: 0, type: 'in', entry: 'in' },
        { position_id: 'P_GBP', symbol: 'GBPUSD', side: 'buy', volume: 1.0, price: 1.25, datetime: '2024-01-01T10:00:00Z', commission: -5, swap: 0, profit: 0, type: 'in', entry: 'in' },
        { position_id: 'P_EUR', symbol: 'EURUSD', side: 'sell', volume: 1.0, price: 1.11, datetime: '2024-01-01T12:00:00Z', commission: -5, swap: 0, profit: 100, type: 'out', entry: 'out' },
        { position_id: 'P_GBP', symbol: 'GBPUSD', side: 'sell', volume: 1.0, price: 1.26, datetime: '2024-01-01T12:00:00Z', commission: -5, swap: 0, profit: 100, type: 'out', entry: 'out' },
      ];

      const result = aggregateMT5DealsDetailed(deals);
      expect(result.closedPositions).toHaveLength(2);
      expect(result.closedPositions.some(p => p.symbol === 'EURUSD')).toBe(true);
      expect(result.closedPositions.some(p => p.symbol === 'GBPUSD')).toBe(true);
    });

    it('correctly calculates position duration', () => {
      const deals: MT5Deal[] = [
        { position_id: 'P_DUR', symbol: 'EURUSD', side: 'buy', volume: 1.0, price: 1.10, datetime: '2024-01-01T10:00:00.000Z', commission: -5, swap: 0, profit: 0, type: 'in', entry: 'in' },
        { position_id: 'P_DUR', symbol: 'EURUSD', side: 'sell', volume: 1.0, price: 1.11, datetime: '2024-01-01T12:30:00.000Z', commission: -5, swap: 0, profit: 100, type: 'out', entry: 'out' },
      ];

      const result = aggregateMT5DealsDetailed(deals);
      const pos = result.closedPositions[0];
      const durationSeconds = (new Date(pos.exit_datetime).getTime() - new Date(pos.entry_datetime).getTime()) / 1000;
      expect(durationSeconds).toBe(2.5 * 3600); // 2 hours 30 mins = 9000 seconds
    });

    it('deduplicates identical MT5 deals in stream', () => {
      const deal: MT5Deal = {
        deal_id: 'DEAL_999',
        position_id: 'P_DEDUP',
        symbol: 'EURUSD',
        side: 'buy',
        volume: 1.0,
        price: 1.10,
        datetime: '2024-01-01T10:00:00Z',
        commission: -5,
        swap: 0,
        profit: 0,
        type: 'in',
        entry: 'in',
      };
      const exitDeal: MT5Deal = {
        deal_id: 'DEAL_1000',
        position_id: 'P_DEDUP',
        symbol: 'EURUSD',
        side: 'sell',
        volume: 1.0,
        price: 1.11,
        datetime: '2024-01-01T11:00:00Z',
        commission: -5,
        swap: 0,
        profit: 100,
        type: 'out',
        entry: 'out',
      };

      // Feed duplicate of entry and duplicate of exit
      const result = aggregateMT5DealsDetailed([deal, deal, exitDeal, exitDeal]);
      expect(result.closedPositions).toHaveLength(1);
      const pos = result.closedPositions[0];
      expect(pos.total_volume).toBe(1.0); // Not 2.0
      expect(pos.closed_volume).toBe(1.0);
      expect(pos.total_profit).toBe(100); // Not 200
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
