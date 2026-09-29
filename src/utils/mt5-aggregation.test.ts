import { describe, it, expect } from 'vitest';
import { aggregateMT5Positions, positionToNormalizedTrade, type MT5Deal } from './mt5-aggregation';

describe('MT5 Aggregation', () => {
  describe('aggregateMT5Positions', () => {
    it('should aggregate single entry/exit deal', () => {
      const deals: MT5Deal[] = [
        {
          position_id: 'POS001',
          symbol: 'EURUSD',
          side: 'buy',
          volume: 1.0,
          price: 1.1000,
          datetime: '2024-01-01T10:00:00Z',
          commission: -5,
          swap: -2,
          profit: 100,
          type: 'entry',
        },
        {
          position_id: 'POS001',
          symbol: 'EURUSD',
          side: 'sell',
          volume: 1.0,
          price: 1.1100,
          datetime: '2024-01-01T14:00:00Z',
          commission: -5,
          swap: -1,
          profit: 100,
          type: 'exit',
        },
      ];

      const positions = aggregateMT5Positions(deals);
      
      expect(positions).toHaveLength(1);
      expect(positions[0].position_id).toBe('POS001');
      expect(positions[0].total_volume).toBe(1.0);
      expect(positions[0].weighted_entry_price).toBe(1.1000);
      expect(positions[0].weighted_exit_price).toBe(1.1100);
      expect(positions[0].total_commission).toBe(-10);
      expect(positions[0].total_swap).toBe(-3);
      expect(positions[0].total_profit).toBe(200);
    });

    it('should handle multiple entry deals', () => {
      const deals: MT5Deal[] = [
        {
          position_id: 'POS001',
          symbol: 'EURUSD',
          side: 'buy',
          volume: 0.5,
          price: 1.1000,
          datetime: '2024-01-01T10:00:00Z',
          commission: -2.5,
          swap: -1,
          profit: 50,
          type: 'entry',
        },
        {
          position_id: 'POS001',
          symbol: 'EURUSD',
          side: 'buy',
          volume: 0.5,
          price: 1.1050,
          datetime: '2024-01-01T11:00:00Z',
          commission: -2.5,
          swap: -1,
          profit: 50,
          type: 'entry',
        },
        {
          position_id: 'POS001',
          symbol: 'EURUSD',
          side: 'sell',
          volume: 1.0,
          price: 1.1100,
          datetime: '2024-01-01T14:00:00Z',
          commission: -5,
          swap: -2,
          profit: 100,
          type: 'exit',
        },
      ];

      const positions = aggregateMT5Positions(deals);
      
      expect(positions).toHaveLength(1);
      expect(positions[0].total_volume).toBe(1.0);
      // Weighted average: (0.5 * 1.1000 + 0.5 * 1.1050) / 1.0 = 1.1025
      expect(positions[0].weighted_entry_price).toBeCloseTo(1.1025, 4);
      expect(positions[0].weighted_exit_price).toBe(1.1100);
    });

    it('should handle partial close', () => {
      const deals: MT5Deal[] = [
        {
          position_id: 'POS001',
          symbol: 'EURUSD',
          side: 'buy',
          volume: 1.0,
          price: 1.1000,
          datetime: '2024-01-01T10:00:00Z',
          commission: -5,
          swap: -2,
          profit: 50,
          type: 'entry',
        },
        {
          position_id: 'POS001',
          symbol: 'EURUSD',
          side: 'sell',
          volume: 0.4,
          price: 1.1050,
          datetime: '2024-01-01T12:00:00Z',
          commission: -2,
          swap: -1,
          profit: 20,
          type: 'exit',
        },
        {
          position_id: 'POS001',
          symbol: 'EURUSD',
          side: 'sell',
          volume: 0.6,
          price: 1.1100,
          datetime: '2024-01-01T14:00:00Z',
          commission: -3,
          swap: -1,
          profit: 60,
          type: 'exit',
        },
      ];

      const positions = aggregateMT5Positions(deals);
      
      expect(positions).toHaveLength(1);
      expect(positions[0].is_partial_close).toBe(false); // Full close
      expect(positions[0].total_volume).toBe(1.0);
      // Weighted exit: (0.4 * 1.1050 + 0.6 * 1.1100) / 1.0 = 1.1080
      expect(positions[0].weighted_exit_price).toBeCloseTo(1.1080, 4);
    });

    it('should group deals by position_id', () => {
      const deals: MT5Deal[] = [
        {
          position_id: 'POS001',
          symbol: 'EURUSD',
          side: 'buy',
          volume: 1.0,
          price: 1.1000,
          datetime: '2024-01-01T10:00:00Z',
          commission: -5,
          swap: -2,
          profit: 100,
          type: 'entry',
        },
        {
          position_id: 'POS002',
          symbol: 'GBPUSD',
          side: 'sell',
          volume: 1.0,
          price: 1.3000,
          datetime: '2024-01-01T11:00:00Z',
          commission: -5,
          swap: -2,
          profit: -50,
          type: 'entry',
        },
      ];

      const positions = aggregateMT5Positions(deals);
      
      expect(positions).toHaveLength(2);
      expect(positions[0].position_id).toBe('POS001');
      expect(positions[1].position_id).toBe('POS002');
    });

    it('should handle empty deals array', () => {
      const positions = aggregateMT5Positions([]);
      expect(positions).toHaveLength(0);
    });
  });

  describe('positionToNormalizedTrade', () => {
    it('should convert position to normalized trade', () => {
      const deals: MT5Deal[] = [
        {
          position_id: 'POS001',
          ticket: '12345',
          symbol: 'EURUSD',
          side: 'buy',
          volume: 1.0,
          price: 1.1000,
          datetime: '2024-01-01T10:00:00Z',
          commission: -5,
          swap: -2,
          profit: 100,
          type: 'entry',
          comment: 'Test trade',
          magic_number: 12345,
        },
      ];

      const positions = aggregateMT5Positions(deals);
      const trade = positionToNormalizedTrade(positions[0]);

      expect(trade.ticket).toBe('12345');
      expect(trade.position_id).toBe('POS001');
      expect(trade.symbol).toBe('EURUSD');
      expect(trade.side).toBe('buy');
      expect(trade.volume).toBe(1.0);
      expect(trade.entry_price).toBe(1.1000);
      expect(trade.commission).toBe(-5);
      expect(trade.swap).toBe(-2);
      expect(trade.profit).toBe(100);
      expect(trade.comment).toBe('Test trade');
      expect(trade.magic_number).toBe(12345);
    });
  });
});
