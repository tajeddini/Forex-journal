import { describe, it, expect } from 'vitest';
import { mapColumns, normalizeSide, normalizeNumber, normalizeDatetime, normalizeTradeRow, detectTradeSource } from './trade-normalizer';

describe('Trade Normalizer', () => {
  describe('mapColumns', () => {
    it('maps standard MT4 headers', () => {
      const headers = ['Ticket', 'Symbol', 'Type', 'Volume', 'Open Time', 'Open Price', 'Close Time', 'Close Price', 'Profit'];
      const mapping = mapColumns(headers);
      expect(mapping['Ticket']).toBe('ticket');
      expect(mapping['Symbol']).toBe('symbol');
      expect(mapping['Type']).toBe('side');
      expect(mapping['Volume']).toBe('volume');
      expect(mapping['Open Time']).toBe('entry_datetime');
      expect(mapping['Open Price']).toBe('entry_price');
      expect(mapping['Close Time']).toBe('exit_datetime');
      expect(mapping['Close Price']).toBe('exit_price');
      expect(mapping['Profit']).toBe('profit');
    });

    it('maps alternate headers', () => {
      const headers = ['Order', 'Instrument', 'Direction', 'Lots', 'Entry Time', 'Price', 'Exit Time', 'P/L'];
      const mapping = mapColumns(headers);
      expect(mapping['Order']).toBe('ticket');
      expect(mapping['Instrument']).toBe('symbol');
      expect(mapping['Direction']).toBe('side');
      expect(mapping['Lots']).toBe('volume');
    });
  });

  describe('normalizeSide', () => {
    it('normalizes buy variants', () => {
      expect(normalizeSide('buy')).toBe('buy');
      expect(normalizeSide('Buy')).toBe('buy');
      expect(normalizeSide('BUY')).toBe('buy');
      expect(normalizeSide('long')).toBe('buy');
      expect(normalizeSide('LONG')).toBe('buy');
    });

    it('normalizes sell variants', () => {
      expect(normalizeSide('sell')).toBe('sell');
      expect(normalizeSide('Sell')).toBe('sell');
      expect(normalizeSide('SELL')).toBe('sell');
      expect(normalizeSide('short')).toBe('sell');
      expect(normalizeSide('SHORT')).toBe('sell');
    });

    it('returns null for unknown values', () => {
      expect(normalizeSide('unknown')).toBeNull();
      expect(normalizeSide('')).toBeNull();
    });
  });

  describe('normalizeNumber', () => {
    it('parses standard numbers', () => {
      expect(normalizeNumber('123')).toBe(123);
      expect(normalizeNumber('123.45')).toBe(123.45);
      expect(normalizeNumber('0')).toBe(0);
      expect(normalizeNumber('-45.60')).toBe(-45.60);
    });

    it('handles empty values', () => {
      expect(normalizeNumber('')).toBeNull();
      expect(normalizeNumber('-')).toBeNull();
      expect(normalizeNumber('  ')).toBeNull();
    });

    it('handles invalid values', () => {
      expect(normalizeNumber('abc')).toBeNull();
    });
  });

  describe('normalizeDatetime', () => {
    it('parses MT4 format', () => {
      const result = normalizeDatetime('2024.01.15 14:30:00');
      expect(result).not.toBeNull();
      expect(result).toContain('2024-01-15');
    });

    it('parses ISO format', () => {
      const result = normalizeDatetime('2024-01-15 14:30:00');
      expect(result).not.toBeNull();
    });

    it('handles empty values', () => {
      expect(normalizeDatetime('')).toBeNull();
      expect(normalizeDatetime('  ')).toBeNull();
    });

    it('handles invalid values', () => {
      expect(normalizeDatetime('not a date')).toBeNull();
    });
  });

  describe('normalizeTradeRow', () => {
    it('normalizes a valid trade row', () => {
      const row = {
        'Ticket': '12345',
        'Symbol': 'EURUSD',
        'Type': 'buy',
        'Volume': '0.1',
        'Open Time': '2024.01.15 10:00:00',
        'Open Price': '1.1000',
        'Close Time': '2024.01.15 14:00:00',
        'Close Price': '1.1050',
        'Profit': '50.00',
      };
      const mapping = mapColumns(Object.keys(row));
      const { trade, errors } = normalizeTradeRow(row, mapping, 1);
      expect(errors).toHaveLength(0);
      expect(trade).not.toBeNull();
      expect(trade!.symbol).toBe('EURUSD');
      expect(trade!.side).toBe('buy');
      expect(trade!.volume).toBe(0.1);
      expect(trade!.profit).toBe(50);
    });

    it('reports errors for missing required fields', () => {
      const row = { 'Symbol': '', 'Type': 'buy' };
      const mapping = mapColumns(Object.keys(row));
      const { trade, errors } = normalizeTradeRow(row, mapping, 1);
      expect(trade).toBeNull();
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('detectTradeSource', () => {
    it('detects MT4 from filename', () => {
      expect(detectTradeSource('mt4_history.csv', [])).toBe('mt4');
      expect(detectTradeSource('metatrader4_export.csv', [])).toBe('mt4');
    });

    it('detects MT5 from filename', () => {
      expect(detectTradeSource('mt5_deals.csv', [])).toBe('mt5');
      expect(detectTradeSource('metatrader5_export.csv', [])).toBe('mt5');
    });

    it('detects MT5 from headers', () => {
      expect(detectTradeSource('export.csv', ['Deal', 'Position'])).toBe('mt5');
    });

    it('defaults to MT4', () => {
      expect(detectTradeSource('trades.csv', ['Ticket', 'Symbol'])).toBe('mt4');
    });
  });
});
