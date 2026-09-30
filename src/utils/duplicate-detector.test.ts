import { describe, it, expect } from 'vitest';
import { generateTradeFingerprint, findDuplicates, findInternalDuplicates } from './duplicate-detector';
import type { NormalizedTrade } from './trade-normalizer';
import type { Trade } from '../types/database';

describe('Duplicate Detector', () => {
  describe('generateTradeFingerprint', () => {
    it('generates fingerprint for MT5 using position_id', () => {
      const trade = {
        position_id: 'POS_999',
        symbol: 'EURUSD',
        ticket: '12345',
        account_id: 'acc-1',
      } as any;
      const fp = generateTradeFingerprint(trade);
      expect(fp).toBe('mt5:pos:acc-1:EURUSD:POS_999');
    });

    it('generates fingerprint for MT4 using ticket and symbol', () => {
      const trade = {
        ticket: '12345',
        symbol: 'EURUSD',
        account_id: 'acc-1',
      } as any;
      const fp = generateTradeFingerprint(trade);
      expect(fp).toBe('ticket:acc-1:EURUSD:12345');
    });

    it('generates composite fingerprint for manual trade without colliding different trades', () => {
      const trade1: NormalizedTrade = {
        ticket: null,
        position_id: null,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.1,
        entry_datetime: '2024-01-15T10:00:00Z',
        entry_price: 1.1000,
        stop_loss: null,
        take_profit: null,
        exit_datetime: '2024-01-15T11:00:00Z',
        exit_price: 1.1050,
        commission: 0,
        swap: 0,
        profit: 50,
        comment: 'first scalp',
        magic_number: null,
      };

      const trade2: NormalizedTrade = {
        ...trade1,
        comment: 'second scalp',
      };

      const fp1 = generateTradeFingerprint(trade1);
      const fp2 = generateTradeFingerprint(trade2);
      expect(fp1).not.toBe(fp2);
    });
  });

  describe('findDuplicates', () => {
    it('finds exact duplicates across existing trades', () => {
      const newTrades: NormalizedTrade[] = [
        { ticket: '12345', position_id: null, symbol: 'EURUSD' } as any,
      ];
      const existingTrades: Trade[] = [
        { ticket: '12345', position_id: null, symbol: 'EURUSD' } as any,
      ];
      const duplicates = findDuplicates(newTrades, existingTrades);
      expect(duplicates.size).toBe(1);
    });

    it('does not flag different trades as duplicates', () => {
      const newTrades: NormalizedTrade[] = [
        { ticket: '12345', position_id: null, symbol: 'EURUSD' } as any,
      ];
      const existingTrades: Trade[] = [
        { ticket: '67890', position_id: null, symbol: 'GBPUSD' } as any,
      ];
      const duplicates = findDuplicates(newTrades, existingTrades);
      expect(duplicates.size).toBe(0);
    });
  });

  describe('findInternalDuplicates', () => {
    it('finds duplicates within the new trade list', () => {
      const trades: NormalizedTrade[] = [
        { ticket: '12345', position_id: null, symbol: 'EURUSD' } as any,
        { ticket: '12345', position_id: null, symbol: 'EURUSD' } as any,
      ];
      const duplicates = findInternalDuplicates(trades);
      expect(duplicates.size).toBe(1);
      expect(duplicates.get(1)).toEqual([0]);
    });
  });
});
