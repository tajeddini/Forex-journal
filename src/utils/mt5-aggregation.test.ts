import { describe, it, expect } from 'vitest';
import {
  aggregateMT5Positions,
  aggregateMT5DealsDetailed,
  positionToNormalizedTrade,
  classifyDealDirection,
  type MT5Deal,
} from './mt5-aggregation';
import { parseMT5DealRow } from './trade-normalizer';

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

    it('1. BUY -> INOUT smaller volume (BUY 1.00, INOUT SELL 0.40)', () => {
      // Position: BUY 1.00 lot @ 1.1000
      // Deal 2: INOUT SELL 0.40 lot @ 1.1050
      // Expected:
      // - Closes 0.40 of BUY (entry: 1.1000, exit: 1.1050, closed_volume: 0.40, profit: 200)
      // - Keeps remaining 0.60 of BUY open
      // - Opens new SELL 0.40 position @ 1.1050
      const deals: MT5Deal[] = [
        {
          position_id: 'POS_BUY_SMALL_REV',
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
          position_id: 'POS_BUY_SMALL_REV',
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
      ];

      const result = aggregateMT5DealsDetailed(deals);
      // Closed position: 0.40 BUY closed
      expect(result.closedPositions).toHaveLength(1);
      const closedPos = result.closedPositions[0];
      expect(closedPos.side).toBe('buy');
      expect(closedPos.closed_volume).toBe(0.4);
      expect(closedPos.weighted_entry_price).toBe(1.1000);
      expect(closedPos.weighted_exit_price).toBe(1.1050);
      expect(closedPos.total_profit).toBe(200);

      // Open positions: remaining 0.60 BUY and new 0.40 SELL
      expect(result.openPositions).toHaveLength(2);
      const remBuy = result.openPositions.find(p => p.side === 'buy')!;
      const newSell = result.openPositions.find(p => p.side === 'sell')!;

      expect(remBuy.remaining_open_volume).toBe(0.6);
      expect(remBuy.weighted_entry_price).toBe(1.1000);

      expect(newSell.remaining_open_volume).toBe(0.4);
      expect(newSell.weighted_entry_price).toBe(1.1050);
      expect(newSell.entry_datetime).toBe('2024-01-01T11:00:00.000Z');
      expect(newSell.position_id).not.toBe('POS_BUY_SMALL_REV'); // Distinct position identity!
    });

    it('2. BUY -> INOUT equal volume (BUY 1.00, INOUT SELL 1.00)', () => {
      const deals: MT5Deal[] = [
        {
          position_id: 'POS_BUY_EQ',
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
          position_id: 'POS_BUY_EQ',
          symbol: 'EURUSD',
          side: 'sell',
          volume: 1.0,
          price: 1.1060,
          datetime: '2024-01-01T12:00:00Z',
          commission: -5,
          swap: -1,
          profit: 600,
          type: 'inout',
          entry: 'inout',
        },
      ];

      const result = aggregateMT5DealsDetailed(deals);
      expect(result.closedPositions).toHaveLength(1);
      expect(result.openPositions).toHaveLength(1);

      const pos = result.closedPositions[0];
      expect(pos.side).toBe('buy');
      expect(pos.closed_volume).toBe(1.0);
      expect(pos.remaining_open_volume).toBe(0);
      expect(pos.weighted_entry_price).toBe(1.1000);
      expect(pos.weighted_exit_price).toBe(1.1060);
      expect(pos.total_profit).toBe(600);

      const openPos = result.openPositions[0];
      expect(openPos.side).toBe('sell');
      expect(openPos.total_volume).toBe(1.0);
      expect(openPos.remaining_open_volume).toBe(1.0);
      expect(openPos.weighted_entry_price).toBe(1.1060);
      expect(openPos.is_still_open).toBe(true);
      expect(openPos.position_id).not.toBe('POS_BUY_EQ');
    });

    it('3. BUY -> INOUT larger volume (BUY 1.00, INOUT SELL 1.50)', () => {
      const deals: MT5Deal[] = [
        {
          position_id: 'POS_BUY_LARGE',
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
          position_id: 'POS_BUY_LARGE',
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
      expect(result.closedPositions).toHaveLength(1);
      const closedPos = result.closedPositions[0];
      expect(closedPos.side).toBe('buy');
      expect(closedPos.closed_volume).toBe(1.0);
      expect(closedPos.weighted_entry_price).toBe(1.1000);
      expect(closedPos.weighted_exit_price).toBe(1.1080);
      expect(closedPos.total_profit).toBe(800);

      expect(result.openPositions).toHaveLength(1);
      const openPos = result.openPositions[0];
      expect(openPos.side).toBe('sell');
      expect(openPos.total_volume).toBe(0.5);
      expect(openPos.remaining_open_volume).toBe(0.5);
      expect(openPos.weighted_entry_price).toBe(1.1080);
      expect(openPos.entry_datetime).toBe('2024-01-05T14:00:00.000Z');
      expect(openPos.position_id).not.toBe('POS_BUY_LARGE'); // Unique ID
    });

    it('4. SELL -> INOUT smaller volume (SELL 1.00, INOUT BUY 0.40)', () => {
      const deals: MT5Deal[] = [
        {
          position_id: 'POS_SELL_SMALL',
          symbol: 'GBPUSD',
          side: 'sell',
          volume: 1.0,
          price: 1.3000,
          datetime: '2024-01-02T10:00:00Z',
          commission: -5,
          swap: 0,
          profit: 0,
          type: 'in',
          entry: 'in',
        },
        {
          position_id: 'POS_SELL_SMALL',
          symbol: 'GBPUSD',
          side: 'buy',
          volume: 0.4,
          price: 1.2950,
          datetime: '2024-01-02T11:00:00Z',
          commission: -2,
          swap: 0,
          profit: 200,
          type: 'inout',
          entry: 'inout',
        },
      ];

      const result = aggregateMT5DealsDetailed(deals);
      expect(result.closedPositions).toHaveLength(1);
      const closedPos = result.closedPositions[0];
      expect(closedPos.side).toBe('sell');
      expect(closedPos.closed_volume).toBe(0.4);
      expect(closedPos.weighted_entry_price).toBe(1.3000);
      expect(closedPos.weighted_exit_price).toBe(1.2950);
      expect(closedPos.total_profit).toBe(200);

      expect(result.openPositions).toHaveLength(2);
      const remSell = result.openPositions.find(p => p.side === 'sell')!;
      const newBuy = result.openPositions.find(p => p.side === 'buy')!;
      expect(remSell.remaining_open_volume).toBe(0.6);
      expect(newBuy.remaining_open_volume).toBe(0.4);
      expect(newBuy.weighted_entry_price).toBe(1.2950);
      expect(newBuy.side).toBe('buy');
    });

    it('5. SELL -> INOUT equal volume (SELL 1.00, INOUT BUY 1.00)', () => {
      const deals: MT5Deal[] = [
        {
          position_id: 'POS_SELL_EQ',
          symbol: 'GBPUSD',
          side: 'sell',
          volume: 1.0,
          price: 1.3000,
          datetime: '2024-01-02T10:00:00Z',
          commission: -5,
          swap: 0,
          profit: 0,
          type: 'in',
          entry: 'in',
        },
        {
          position_id: 'POS_SELL_EQ',
          symbol: 'GBPUSD',
          side: 'buy',
          volume: 1.0,
          price: 1.2900,
          datetime: '2024-01-02T12:00:00Z',
          commission: -5,
          swap: 0,
          profit: 1000,
          type: 'inout',
          entry: 'inout',
        },
      ];

      const result = aggregateMT5DealsDetailed(deals);
      expect(result.closedPositions).toHaveLength(1);
      expect(result.openPositions).toHaveLength(1);
      const closedPos = result.closedPositions[0];
      expect(closedPos.side).toBe('sell');
      expect(closedPos.closed_volume).toBe(1.0);
      expect(closedPos.total_profit).toBe(1000);

      const openPos = result.openPositions[0];
      expect(openPos.side).toBe('buy');
      expect(openPos.total_volume).toBe(1.0);
      expect(openPos.remaining_open_volume).toBe(1.0);
      expect(openPos.weighted_entry_price).toBe(1.2900);
      expect(openPos.is_still_open).toBe(true);
      expect(openPos.position_id).not.toBe('POS_SELL_EQ');
    });

    it('6. SELL -> INOUT larger volume (SELL 1.00, INOUT BUY 1.50)', () => {
      const deals: MT5Deal[] = [
        {
          position_id: 'POS_SELL_LARGE',
          symbol: 'GBPUSD',
          side: 'sell',
          volume: 1.0,
          price: 1.3000,
          datetime: '2024-01-02T10:00:00Z',
          commission: -5,
          swap: 0,
          profit: 0,
          type: 'in',
          entry: 'in',
        },
        {
          position_id: 'POS_SELL_LARGE',
          symbol: 'GBPUSD',
          side: 'buy',
          volume: 1.5,
          price: 1.2900,
          datetime: '2024-01-02T12:00:00Z',
          commission: -7.5,
          swap: 0,
          profit: 1000,
          type: 'inout',
          entry: 'inout',
        },
      ];

      const result = aggregateMT5DealsDetailed(deals);
      expect(result.closedPositions).toHaveLength(1);
      const closed = result.closedPositions[0];
      expect(closed.side).toBe('sell');
      expect(closed.closed_volume).toBe(1.0);
      expect(closed.total_profit).toBe(1000);

      expect(result.openPositions).toHaveLength(1);
      const opened = result.openPositions[0];
      expect(opened.side).toBe('buy');
      expect(opened.total_volume).toBe(0.5);
      expect(opened.weighted_entry_price).toBe(1.2900);
      expect(opened.position_id).not.toBe('POS_SELL_LARGE');
    });

    it('7 & 8. handles multiple sequential INOUT events and tracks independent price/time/duration', () => {
      // 1. BUY 1.00 @ 1.1000 at 10:00
      // 2. INOUT SELL 1.50 @ 1.1050 at 11:00 (Closes BUY 1.00, opens SELL 0.50)
      // 3. OUT BUY 0.50 @ 1.1020 at 13:00 (Closes SELL 0.50)
      const deals: MT5Deal[] = [
        { position_id: 'POS_CHAIN', symbol: 'EURUSD', side: 'buy', volume: 1.0, price: 1.1000, datetime: '2024-01-01T10:00:00.000Z', commission: -5, swap: 0, profit: 0, type: 'in', entry: 'in' },
        { position_id: 'POS_CHAIN', symbol: 'EURUSD', side: 'sell', volume: 1.5, price: 1.1050, datetime: '2024-01-01T11:00:00.000Z', commission: -7.5, swap: 0, profit: 500, type: 'inout', entry: 'inout' },
        { position_id: 'POS_CHAIN', symbol: 'EURUSD', side: 'buy', volume: 0.5, price: 1.1020, datetime: '2024-01-01T13:00:00.000Z', commission: -2.5, swap: -1, profit: 150, type: 'out', entry: 'out' },
      ];

      const result = aggregateMT5DealsDetailed(deals);
      expect(result.closedPositions).toHaveLength(2);

      const buyPos = result.closedPositions[0];
      expect(buyPos.side).toBe('buy');
      expect(buyPos.weighted_entry_price).toBe(1.1000);
      expect(buyPos.weighted_exit_price).toBe(1.1050);
      expect(buyPos.entry_datetime).toBe('2024-01-01T10:00:00.000Z');
      expect(buyPos.exit_datetime).toBe('2024-01-01T11:00:00.000Z');
      // Duration of BUY position = exactly 1 hour (3600 seconds)
      const buyDuration = (new Date(buyPos.exit_datetime).getTime() - new Date(buyPos.entry_datetime).getTime()) / 1000;
      expect(buyDuration).toBe(3600);

      const sellPos = result.closedPositions[1];
      expect(sellPos.side).toBe('sell');
      expect(sellPos.weighted_entry_price).toBe(1.1050);
      expect(sellPos.weighted_exit_price).toBe(1.1020);
      expect(sellPos.entry_datetime).toBe('2024-01-01T11:00:00.000Z');
      expect(sellPos.exit_datetime).toBe('2024-01-01T13:00:00.000Z');
      // Duration of reversed SELL position = exactly 2 hours (7200 seconds), NOT 3 hours!
      const sellDuration = (new Date(sellPos.exit_datetime).getTime() - new Date(sellPos.entry_datetime).getTime()) / 1000;
      expect(sellDuration).toBe(7200);
      expect(sellPos.total_profit).toBe(150);
    });

    it('9. properly attributes commission, swap, and profit on reversals', () => {
      const deals: MT5Deal[] = [
        { position_id: 'POS_FIN', symbol: 'EURUSD', side: 'buy', volume: 1.0, price: 1.1000, datetime: '2024-01-01T10:00:00Z', commission: -5, swap: -2, profit: 0, type: 'in', entry: 'in' },
        { position_id: 'POS_FIN', symbol: 'EURUSD', side: 'sell', volume: 2.0, price: 1.1080, datetime: '2024-01-01T12:00:00Z', commission: -10, swap: -1, profit: 800, type: 'inout', entry: 'inout' },
      ];

      const result = aggregateMT5DealsDetailed(deals);
      const closedBuy = result.closedPositions[0];
      // Closed BUY gets: -5 (entry) + -10 * (1.0/2.0) = -10 total commission
      expect(closedBuy.total_commission).toBe(-10);
      expect(closedBuy.total_swap).toBe(-3);
      expect(closedBuy.total_profit).toBe(800);

      const openSell = result.openPositions[0];
      // Open SELL gets remaining -10 * (1.0/2.0) = -5 commission
      expect(openSell.total_commission).toBe(-5);
      expect(openSell.total_swap).toBe(0);
      expect(openSell.total_profit).toBe(0);
    });

    it('handles mandatory 4-step reversal sequence (BUY 1.00 -> INOUT SELL 1.50 -> INOUT BUY 0.70 -> INOUT SELL 1.20)', () => {
      const deals: MT5Deal[] = [
        {
          position_id: 'POS_MULTIREV',
          symbol: 'EURUSD',
          side: 'buy',
          volume: 1.0,
          price: 1.1000,
          datetime: '2024-01-01T10:00:00.000Z',
          commission: -5,
          swap: 0,
          profit: 0,
          type: 'in',
          entry: 'in',
        },
        {
          position_id: 'POS_MULTIREV',
          symbol: 'EURUSD',
          side: 'sell',
          volume: 1.5,
          price: 1.1050,
          datetime: '2024-01-01T11:00:00.000Z',
          commission: -15,
          swap: 0,
          profit: 500,
          type: 'inout',
          entry: 'inout',
        },
        {
          position_id: 'POS_MULTIREV',
          symbol: 'EURUSD',
          side: 'buy',
          volume: 0.7,
          price: 1.1020,
          datetime: '2024-01-01T12:30:00.000Z',
          commission: -7,
          swap: -1,
          profit: 150,
          type: 'inout',
          entry: 'inout',
        },
        {
          position_id: 'POS_MULTIREV',
          symbol: 'EURUSD',
          side: 'sell',
          volume: 1.2,
          price: 1.1080,
          datetime: '2024-01-01T14:00:00.000Z',
          commission: -12,
          swap: 0,
          profit: 120,
          type: 'inout',
          entry: 'inout',
        },
      ];

      const result = aggregateMT5DealsDetailed(deals);

      // 3 closed positions created chronologically
      expect(result.closedPositions).toHaveLength(3);

      // Pos 1: Initial BUY 1.00 lot closed by first INOUT
      const pos1 = result.closedPositions[0];
      expect(pos1.side).toBe('buy');
      expect(pos1.closed_volume).toBe(1.0);
      expect(pos1.remaining_open_volume).toBe(0);
      expect(pos1.weighted_entry_price).toBe(1.1000);
      expect(pos1.weighted_exit_price).toBe(1.1050);
      expect(pos1.entry_datetime).toBe('2024-01-01T10:00:00.000Z');
      expect(pos1.exit_datetime).toBe('2024-01-01T11:00:00.000Z');
      const dur1 = (new Date(pos1.exit_datetime).getTime() - new Date(pos1.entry_datetime).getTime()) / 1000;
      expect(dur1).toBe(3600); // 1 hour
      expect(pos1.total_profit).toBe(500);

      // Pos 2: Reversed SELL 0.50 lot closed by second INOUT
      const pos2 = result.closedPositions[1];
      expect(pos2.side).toBe('sell');
      expect(pos2.closed_volume).toBe(0.5);
      expect(pos2.remaining_open_volume).toBe(0);
      expect(pos2.weighted_entry_price).toBe(1.1050);
      expect(pos2.weighted_exit_price).toBe(1.1020);
      expect(pos2.entry_datetime).toBe('2024-01-01T11:00:00.000Z');
      expect(pos2.exit_datetime).toBe('2024-01-01T12:30:00.000Z');
      const dur2 = (new Date(pos2.exit_datetime).getTime() - new Date(pos2.entry_datetime).getTime()) / 1000;
      expect(dur2).toBe(5400); // 1.5 hours
      expect(pos2.total_profit).toBe(150);

      // Pos 3: Reversed BUY 0.20 lot closed by third INOUT
      const pos3 = result.closedPositions[2];
      expect(pos3.side).toBe('buy');
      expect(pos3.closed_volume).toBe(0.2);
      expect(pos3.remaining_open_volume).toBe(0);
      expect(pos3.weighted_entry_price).toBe(1.1020);
      expect(pos3.weighted_exit_price).toBe(1.1080);
      expect(pos3.entry_datetime).toBe('2024-01-01T12:30:00.000Z');
      expect(pos3.exit_datetime).toBe('2024-01-01T14:00:00.000Z');
      const dur3 = (new Date(pos3.exit_datetime).getTime() - new Date(pos3.entry_datetime).getTime()) / 1000;
      expect(dur3).toBe(5400); // 1.5 hours
      expect(pos3.total_profit).toBe(120);

      // 1 open position remaining: SELL 1.00 lot
      expect(result.openPositions).toHaveLength(1);
      const openPos = result.openPositions[0];
      expect(openPos.side).toBe('sell');
      expect(openPos.total_volume).toBe(1.0);
      expect(openPos.remaining_open_volume).toBe(1.0);
      expect(openPos.weighted_entry_price).toBe(1.1080);
      expect(openPos.entry_datetime).toBe('2024-01-01T14:00:00.000Z');
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

    it('supports DEAL_ENTRY_OUT_BY closing a position by an opposite position (Close By)', () => {
      // Position 1: BUY 1.00 lot @ 1.1000
      // Position 2: SELL 1.00 lot @ 1.1080 (held in hedging)
      // Close By executed: OUT_BY deal closes Position 1 against Position 2 with authoritative position_by_id
      const deals: MT5Deal[] = [
        {
          position_id: 'POS_CLOSE_BY_1',
          symbol: 'EURUSD',
          side: 'buy',
          volume: 1.0,
          price: 1.1000,
          datetime: '2024-01-08T10:00:00Z',
          commission: -5,
          swap: 0,
          profit: 0,
          type: 'in',
          entry: 'in',
        },
        {
          position_id: 'POS_8888',
          symbol: 'EURUSD',
          side: 'sell',
          volume: 1.0,
          price: 1.1050,
          datetime: '2024-01-08T10:00:00Z',
          commission: -5,
          swap: 0,
          profit: 0,
          type: 'in',
          entry: 'in',
        },
        {
          position_id: 'POS_CLOSE_BY_1',
          position_by_id: 'POS_8888',
          symbol: 'EURUSD',
          side: 'sell',
          volume: 1.0,
          price: 1.1050,
          datetime: '2024-01-08T12:00:00Z',
          commission: 0,
          swap: 0,
          profit: 500,
          type: 'out_by',
          entry: 'out_by',
          comment: 'close by #8888',
        },
      ];

      const result = aggregateMT5DealsDetailed(deals);
      expect(result.closedPositions.length).toBeGreaterThanOrEqual(1);
      const pos = result.closedPositions.find(p => p.position_id === 'POS_CLOSE_BY_1')!;
      expect(pos).toBeDefined();
      expect(pos.closed_volume).toBe(1.0);
      expect(pos.weighted_entry_price).toBe(1.1000);
      expect(pos.weighted_exit_price).toBe(1.1050);
      expect(pos.total_profit).toBe(500);
      expect(pos.close_by_position_id).toBe('POS_8888');

      const normalized = positionToNormalizedTrade(pos);
      expect(normalized.position_by_id).toBe('POS_8888');
      expect(normalized.comment).toContain('8888');
    });

    it('supports partial OUT_BY and duplicate OUT_BY deals without double-counting', () => {
      const deals: MT5Deal[] = [
        {
          deal_id: 'DEAL_IN_1',
          position_id: 'POS_PART_OUT_BY',
          symbol: 'EURUSD',
          side: 'buy',
          volume: 2.0,
          price: 1.1000,
          datetime: '2024-01-09T08:00:00Z',
          commission: -10,
          swap: 0,
          profit: 0,
          type: 'in',
          entry: 'in',
        },
        {
          deal_id: 'DEAL_CP_1',
          position_id: 'POS_CP_1234',
          symbol: 'EURUSD',
          side: 'sell',
          volume: 1.0,
          price: 1.1040,
          datetime: '2024-01-09T08:00:00Z',
          commission: -5,
          swap: 0,
          profit: 0,
          type: 'in',
          entry: 'in',
        },
        {
          deal_id: 'DEAL_OUT_BY_1',
          position_id: 'POS_PART_OUT_BY',
          position_by_id: 'POS_CP_1234',
          symbol: 'EURUSD',
          side: 'sell',
          volume: 1.0,
          price: 1.1040,
          datetime: '2024-01-09T10:00:00Z',
          commission: 0,
          swap: 0,
          profit: 400,
          type: 'out_by',
          entry: 'out_by',
          comment: 'close by #1234',
        },
        // Duplicate of DEAL_OUT_BY_1 in stream
        {
          deal_id: 'DEAL_OUT_BY_1',
          position_id: 'POS_PART_OUT_BY',
          position_by_id: 'POS_CP_1234',
          symbol: 'EURUSD',
          side: 'sell',
          volume: 1.0,
          price: 1.1040,
          datetime: '2024-01-09T10:00:00Z',
          commission: 0,
          swap: 0,
          profit: 400,
          type: 'out_by',
          entry: 'out_by',
          comment: 'close by #1234',
        },
      ];

      const result = aggregateMT5DealsDetailed(deals);
      const pos = result.closedPositions.find(p => p.position_id === 'POS_PART_OUT_BY')!;
      expect(pos).toBeDefined();
      expect(pos.total_volume).toBe(2.0);
      expect(pos.closed_volume).toBe(1.0);
      expect(pos.remaining_open_volume).toBe(1.0);
      expect(pos.is_partial_close).toBe(true);
      expect(pos.total_profit).toBe(400); // Duplicate was deduplicated
      expect(pos.close_by_position_id).toBe('POS_CP_1234');
    });

    it('realistic Close By between opposite positions (Position A: BUY 2.00, Position B: SELL 1.00)', () => {
      // Position A: BUY 2.00 lots EURUSD @ 1.1000 at 09:00 (Position ID = POS_A)
      // Position B: SELL 1.00 lot EURUSD @ 1.1080 at 10:00 (Position ID = POS_B)
      // Close By at 11:00:
      // Position B is fully closed (1.00 lot) against Position A
      // Position A is partially closed by 1.00 lot against Position B, leaving 1.00 lot BUY open!
      const deals: MT5Deal[] = [
        // Entry for Position A
        {
          position_id: 'POS_A',
          symbol: 'EURUSD',
          side: 'buy',
          volume: 2.0,
          price: 1.1000,
          datetime: '2024-01-10T09:00:00.000Z',
          commission: -10,
          swap: 0,
          profit: 0,
          type: 'in',
          entry: 'in',
        },
        // Entry for Position B
        {
          position_id: 'POS_B',
          symbol: 'EURUSD',
          side: 'sell',
          volume: 1.0,
          price: 1.1080,
          datetime: '2024-01-10T10:00:00.000Z',
          commission: -5,
          swap: 0,
          profit: 0,
          type: 'in',
          entry: 'in',
        },
        // Close By deal on Position A referencing POS_B via structured position_by_id
        {
          position_id: 'POS_A',
          position_by_id: 'POS_B',
          symbol: 'EURUSD',
          side: 'sell',
          volume: 1.0,
          price: 1.1080,
          datetime: '2024-01-10T11:00:00.000Z',
          commission: 0,
          swap: 0,
          profit: 800,
          type: 'out_by',
          entry: 'out_by',
        },
        // Close By deal on Position B referencing POS_A via structured position_by_id
        {
          position_id: 'POS_B',
          position_by_id: 'POS_A',
          symbol: 'EURUSD',
          side: 'buy',
          volume: 1.0,
          price: 1.1000,
          datetime: '2024-01-10T11:00:00.000Z',
          commission: 0,
          swap: 0,
          profit: 0,
          type: 'out_by',
          entry: 'out_by',
        },
      ];

      const result = aggregateMT5DealsDetailed(deals);

      // Verify closed positions:
      // Position A: partially closed portion (1.00 lot)
      // Position B: fully closed (1.00 lot)
      const closedA = result.closedPositions.find(p => p.position_id === 'POS_A')!;
      const closedB = result.closedPositions.find(p => p.position_id === 'POS_B')!;

      expect(closedA).toBeDefined();
      expect(closedB).toBeDefined();

      // Position A verification:
      expect(closedA.side).toBe('buy');
      expect(closedA.closed_volume).toBe(1.0);
      expect(closedA.remaining_open_volume).toBe(1.0);
      expect(closedA.is_partial_close).toBe(true);
      expect(closedA.weighted_entry_price).toBe(1.1000);
      expect(closedA.weighted_exit_price).toBe(1.1080);
      expect(closedA.total_profit).toBe(800);
      expect(closedA.close_by_position_id).toBe('POS_B');
      const durA = (new Date(closedA.exit_datetime).getTime() - new Date(closedA.entry_datetime).getTime()) / 1000;
      expect(durA).toBe(7200); // 09:00 to 11:00 = 2 hours

      // Position B verification:
      expect(closedB.side).toBe('sell');
      expect(closedB.closed_volume).toBe(1.0);
      expect(closedB.remaining_open_volume).toBe(0);
      expect(closedB.is_partial_close).toBe(false);
      expect(closedB.weighted_entry_price).toBe(1.1080);
      expect(closedB.weighted_exit_price).toBe(1.1000);
      expect(closedB.close_by_position_id).toBe('POS_A');
      const durB = (new Date(closedB.exit_datetime).getTime() - new Date(closedB.entry_datetime).getTime()) / 1000;
      expect(durB).toBe(3600); // 10:00 to 11:00 = 1 hour

      // Remaining open position: Position A still has 1.00 lot open!
      expect(result.openPositions).toHaveLength(1);
      const openA = result.openPositions[0];
      expect(openA.position_id).toBe('POS_A');
      expect(openA.remaining_open_volume).toBe(1.0);
      expect(openA.is_still_open).toBe(true);
    });

    it('realistic Close By across multiple opposite positions (Position A: BUY 3.00 closed by POS_B: SELL 1.00 and POS_C: SELL 1.00)', () => {
      const deals: MT5Deal[] = [
        { position_id: 'POS_MAIN', symbol: 'EURUSD', side: 'buy', volume: 3.0, price: 1.1000, datetime: '2024-01-11T08:00:00Z', commission: -15, swap: 0, profit: 0, type: 'in', entry: 'in' },
        { position_id: 'POS_LEG1', symbol: 'EURUSD', side: 'sell', volume: 1.0, price: 1.1050, datetime: '2024-01-11T09:00:00Z', commission: -5, swap: 0, profit: 0, type: 'in', entry: 'in' },
        { position_id: 'POS_LEG2', symbol: 'EURUSD', side: 'sell', volume: 1.0, price: 1.1070, datetime: '2024-01-11T09:30:00Z', commission: -5, swap: 0, profit: 0, type: 'in', entry: 'in' },

        // Close By leg 1
        { position_id: 'POS_MAIN', position_by_id: 'POS_LEG1', symbol: 'EURUSD', side: 'sell', volume: 1.0, price: 1.1050, datetime: '2024-01-11T10:00:00Z', commission: 0, swap: 0, profit: 500, type: 'out_by', entry: 'out_by' },
        { position_id: 'POS_LEG1', position_by_id: 'POS_MAIN', symbol: 'EURUSD', side: 'buy', volume: 1.0, price: 1.1000, datetime: '2024-01-11T10:00:00Z', commission: 0, swap: 0, profit: 0, type: 'out_by', entry: 'out_by' },

        // Close By leg 2
        { position_id: 'POS_MAIN', position_by_id: 'POS_LEG2', symbol: 'EURUSD', side: 'sell', volume: 1.0, price: 1.1070, datetime: '2024-01-11T10:30:00Z', commission: 0, swap: 0, profit: 700, type: 'out_by', entry: 'out_by' },
        { position_id: 'POS_LEG2', position_by_id: 'POS_MAIN', symbol: 'EURUSD', side: 'buy', volume: 1.0, price: 1.1000, datetime: '2024-01-11T10:30:00Z', commission: 0, swap: 0, profit: 0, type: 'out_by', entry: 'out_by' },
      ];

      const result = aggregateMT5DealsDetailed(deals);

      const mainPos = result.closedPositions.find(p => p.position_id === 'POS_MAIN')!;
      expect(mainPos).toBeDefined();
      expect(mainPos.total_volume).toBe(3.0);
      expect(mainPos.closed_volume).toBe(2.0); // 1.0 + 1.0 closed
      expect(mainPos.remaining_open_volume).toBe(1.0); // 1.0 lot remains open!
      expect(mainPos.total_profit).toBe(1200); // 500 + 700

      // Both leg 1 and leg 2 are fully closed
      const leg1 = result.closedPositions.find(p => p.position_id === 'POS_LEG1')!;
      const leg2 = result.closedPositions.find(p => p.position_id === 'POS_LEG2')!;
      expect(leg1.closed_volume).toBe(1.0);
      expect(leg1.remaining_open_volume).toBe(0);
      expect(leg2.closed_volume).toBe(1.0);
      expect(leg2.remaining_open_volume).toBe(0);
    });

    it('rejects OUT_BY deal when position_by_id is missing', () => {
      const deals: MT5Deal[] = [
        { position_id: 'POS_1', symbol: 'EURUSD', side: 'buy', volume: 1.0, price: 1.1000, datetime: '2024-01-11T08:00:00Z', commission: -5, swap: 0, profit: 0, type: 'in', entry: 'in' },
        { position_id: 'POS_1', symbol: 'EURUSD', side: 'sell', volume: 1.0, price: 1.1050, datetime: '2024-01-11T10:00:00Z', commission: 0, swap: 0, profit: 50, type: 'out_by', entry: 'out_by' },
      ];

      expect(() => aggregateMT5DealsDetailed(deals)).toThrow('فاقد شناسه ساختاریافته پوزیشن مقابل');
    });

    it('rejects OUT_BY deal when counterpart position does not exist in the import dataset', () => {
      const deals: MT5Deal[] = [
        { position_id: 'POS_1', symbol: 'EURUSD', side: 'buy', volume: 1.0, price: 1.1000, datetime: '2024-01-11T08:00:00Z', commission: -5, swap: 0, profit: 0, type: 'in', entry: 'in' },
        { position_id: 'POS_1', position_by_id: 'POS_NON_EXISTENT', symbol: 'EURUSD', side: 'sell', volume: 1.0, price: 1.1050, datetime: '2024-01-11T10:00:00Z', commission: 0, swap: 0, profit: 50, type: 'out_by', entry: 'out_by' },
      ];

      expect(() => aggregateMT5DealsDetailed(deals)).toThrow('در داده‌های ورودی یافت نشد');
    });

    it('rejects OUT_BY deal when counterpart position has mismatched symbol', () => {
      const deals: MT5Deal[] = [
        { position_id: 'POS_1', symbol: 'EURUSD', side: 'buy', volume: 1.0, price: 1.1000, datetime: '2024-01-11T08:00:00Z', commission: -5, swap: 0, profit: 0, type: 'in', entry: 'in' },
        { position_id: 'POS_2', symbol: 'GBPUSD', side: 'sell', volume: 1.0, price: 1.2500, datetime: '2024-01-11T08:00:00Z', commission: -5, swap: 0, profit: 0, type: 'in', entry: 'in' },
        { position_id: 'POS_1', position_by_id: 'POS_2', symbol: 'EURUSD', side: 'sell', volume: 1.0, price: 1.1050, datetime: '2024-01-11T10:00:00Z', commission: 0, swap: 0, profit: 50, type: 'out_by', entry: 'out_by' },
      ];

      expect(() => aggregateMT5DealsDetailed(deals)).toThrow('عدم تطابق نماد در معامله Close By');
    });

    it('integration: parses real MT5 CSV with Position By column and aggregates Close By trades accurately', () => {
      const csvContent = [
        'Time,Deal,Order,Position,Position By,Symbol,Type,Entry,Volume,Price,Commission,Swap,Profit,Comment',
        '2024.01.12 10:00:00,101,1001,2001,,EURUSD,buy,in,2.00,1.1000,-10.00,0.00,0.00,',
        '2024.01.12 10:30:00,102,1002,2002,,EURUSD,sell,in,1.00,1.1080,-5.00,0.00,0.00,',
        '2024.01.12 11:00:00,103,1003,2001,2002,EURUSD,sell,out_by,1.00,1.1080,0.00,0.00,800.00,',
        '2024.01.12 11:00:00,104,1004,2002,2001,EURUSD,buy,out_by,1.00,1.1000,0.00,0.00,0.00,',
      ].join('\\n');

      const lines = csvContent.split('\\n');
      const headers = lines[0].split(',');
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',');
        return headers.reduce((acc, h, i) => {
          acc[h] = vals[i] || '';
          return acc;
        }, {} as Record<string, string>);
      });

      const deals: MT5Deal[] = [];
      rows.forEach((r, idx) => {
        const { deal, errors } = parseMT5DealRow(r, idx + 1);
        expect(errors).toHaveLength(0);
        expect(deal).not.toBeNull();
        deals.push(deal!);
      });

      // Verify that deals[2] and deals[3] preserved structured position_by_id
      expect(deals[2].position_by_id).toBe('2002');
      expect(deals[3].position_by_id).toBe('2001');

      const result = aggregateMT5DealsDetailed(deals);
      expect(result.closedPositions).toHaveLength(2);

      const pos1 = result.closedPositions.find(p => p.position_id === '2001')!;
      const pos2 = result.closedPositions.find(p => p.position_id === '2002')!;

      expect(pos1.closed_volume).toBe(1.0);
      expect(pos1.remaining_open_volume).toBe(1.0);
      expect(pos1.is_partial_close).toBe(true);
      expect(pos1.close_by_position_id).toBe('2002');
      expect(pos1.total_profit).toBe(800);

      expect(pos2.closed_volume).toBe(1.0);
      expect(pos2.remaining_open_volume).toBe(0);
      expect(pos2.is_partial_close).toBe(false);
      expect(pos2.close_by_position_id).toBe('2001');

      const trade1 = positionToNormalizedTrade(pos1);
      expect(trade1.position_by_id).toBe('2002');
      expect(trade1.volume).toBe(1.0);
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
