import { describe, it, expect } from 'vitest';
import { generateTradeFingerprint, findDuplicates, findInternalDuplicates } from './duplicate-detector';
import type { NormalizedTrade } from './trade-normalizer';
import type { Trade } from '../types/database';

describe('Duplicate Detector', () => {
  describe('generateTradeFingerprint', () => {
    it('generates fingerprint from ticket', () => {
      const trade = { ticket: '12345', symbol: 'EURUSD', entry_datetime: '2024-01-15' } as any;
      const fp = generateTradeFingerprint(trade);
      expect(fp).toContain('ticket:12345');
      expect(fp).toContain('EURUSD');
    });

    it('generates composite fingerprint without ticket', () => {
      const trade = {
        ticket: null,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.1,
        entry_datetime: '2024-01-15',
        entry_price: 1.1,
        exit_datetime: '2024-01-16',
        exit_price: 1.2,
        profit: 100,
      } as NormalizedTrade;
      const fp = generateTradeFingerprint(trade);
      expect(fp).toContain('eurusd');
      expect(fp).toContain('buy');
    });
  });

  describe('findDuplicates', () => {
    it('finds exact duplicates', () => {
      const newTrades: NormalizedTrade[] = [
        { ticket: '12345', symbol: 'EURUSD', entry_datetime: '2024-01-15' } as any,
      ];
      const existingTrades: Trade[] = [
        { ticket: '12345', symbol: 'EURUSD', entry_datetime: '2024-01-15' } as any,
      ];
      const duplicates = findDuplicates(newTrades, existingTrades);
      expect(duplicates.size).toBe(1);
    });

    it('does not flag different trades', () => {
      const newTrades: NormalizedTrade[] = [
        { ticket: '12345', symbol: 'EURUSD', entry_datetime: '2024-01-15' } as any,
      ];
      const existingTrades: Trade[] = [
        { ticket: '67890', symbol: 'GBPUSD', entry_datetime: '2024-01-16' } as any,
      ];
      const duplicates = findDuplicates(newTrades, existingTrades);
      expect(duplicates.size).toBe(0);
    });
  });

  describe('findInternalDuplicates', () => {
    it('finds duplicates within same batch', () => {
      const trades: NormalizedTrade[] = [
        { ticket: '12345', symbol: 'EURUSD', entry_datetime: '2024-01-15' } as any,
        { ticket: '12345', symbol: 'EURUSD', entry_datetime: '2024-01-15' } as any,
      ];
      const duplicates = findInternalDuplicates(trades);
      expect(duplicates.size).toBe(1);
    });
  });
});
