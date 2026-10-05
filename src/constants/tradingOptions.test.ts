import { describe, it, expect } from 'vitest';
import {
  parseDelimitedString,
  joinDelimitedString,
  TIMEFRAME_OPTIONS,
  COMMON_TIMEFRAME_PRESETS,
  MARKET_BIAS_OPTIONS,
  TRADING_SESSION_OPTIONS,
  CONFLUENCE_OPTIONS,
} from './tradingOptions';

describe('tradingOptions helpers', () => {
  describe('parseDelimitedString', () => {
    it('handles null, undefined and empty strings', () => {
      expect(parseDelimitedString(null)).toEqual([]);
      expect(parseDelimitedString(undefined)).toEqual([]);
      expect(parseDelimitedString('')).toEqual([]);
      expect(parseDelimitedString('   ')).toEqual([]);
    });

    it('splits comma-separated strings cleanly', () => {
      expect(parseDelimitedString('H4, M15, M5')).toEqual(['H4', 'M15', 'M5']);
      expect(parseDelimitedString('1m,5m, 15m ')).toEqual(['1m', '5m', '15m']);
    });

    it('handles single item without delimiter', () => {
      expect(parseDelimitedString('H1')).toEqual(['H1']);
    });
  });

  describe('joinDelimitedString', () => {
    it('joins string array with standard comma-space delimiter', () => {
      expect(joinDelimitedString(['H4', 'M15', 'M5'])).toBe('H4, M15, M5');
      expect(joinDelimitedString(['H1'])).toBe('H1');
      expect(joinDelimitedString([])).toBe('');
    });

    it('filters out empty or whitespace-only items', () => {
      expect(joinDelimitedString(['H4', '', '  ', 'M15'])).toBe('H4, M15');
    });
  });

  describe('options integrity', () => {
    it('contains standard timeframes and presets', () => {
      expect(TIMEFRAME_OPTIONS.length).toBeGreaterThan(5);
      expect(COMMON_TIMEFRAME_PRESETS.length).toBeGreaterThan(2);
      expect(MARKET_BIAS_OPTIONS.length).toBeGreaterThan(3);
      expect(TRADING_SESSION_OPTIONS.length).toBeGreaterThan(2);
      expect(CONFLUENCE_OPTIONS.length).toBeGreaterThan(5);
    });
  });
});
