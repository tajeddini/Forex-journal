import { describe, it, expect } from 'vitest';
import { mapColumns, normalizeSide, normalizeNumber, normalizeDatetime, normalizeTradeRow, detectTradeSource, parseMT5DealRow } from './trade-normalizer';

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

  describe('parseMT5DealRow entry validation', () => {
    const baseRow = {
      Symbol: 'EURUSD',
      Type: 'buy',
      Volume: '1.0',
      Price: '1.1000',
      Time: '2024-01-01 10:00:00',
      Deal: '100',
      Position: '200',
    };

    it('parses in, out, inout, and out_by correctly', () => {
      const inRes = parseMT5DealRow({ ...baseRow, Entry: 'in' }, 1);
      expect(inRes?.deal?.entry).toBe('in');

      const outRes = parseMT5DealRow({ ...baseRow, Entry: 'out' }, 1);
      expect(outRes.deal?.entry).toBe('out');

      const inoutRes = parseMT5DealRow({ ...baseRow, Entry: 'inout' }, 1);
      expect(inoutRes.deal?.entry).toBe('inout');

      // OUT_BY with structured Position By column
      const outByRes = parseMT5DealRow({ ...baseRow, Entry: 'out_by', 'Position By': '300' }, 1);
      expect(outByRes.deal?.entry).toBe('out_by');
      expect(outByRes.deal?.position_by_id).toBe('300');

      const closeByRes = parseMT5DealRow({ ...baseRow, Entry: 'close by', position_by_id: '400' }, 1);
      expect(closeByRes.deal?.entry).toBe('out_by');
      expect(closeByRes.deal?.position_by_id).toBe('400');
    });

    it('rejects out_by deals that lack an authoritative position_by_id column', () => {
      const res = parseMT5DealRow({ ...baseRow, Entry: 'out_by' }, 1);
      expect(res.deal).toBeNull();
      expect(res.errors.length).toBeGreaterThan(0);
      expect(res.errors[0].field).toBe('position_by_id');
      expect(res.errors[0].message).toContain('فاقد ستون ساختاریافته شناسه پوزیشن مقابل');
    });

    it('rejects unknown entry values with an explicit validation error', () => {
      const res = parseMT5DealRow({ ...baseRow, Entry: 'unrecognized_entry_type' }, 1);
      expect(res.deal).toBeNull();
      expect(res.errors.length).toBeGreaterThan(0);
      expect(res.errors[0].field).toBe('entry');
      expect(res.errors[0].message).toContain('نوع ورود/خروج ناشناخته است');
    });
  });
});
