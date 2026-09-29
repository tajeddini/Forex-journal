import { describe, it, expect } from 'vitest';
import {
  ACCOUNT_STATUSES,
  PHASE_STATUSES,
  PHASE_TYPES,
  CURRENCIES,
  TIMEZONES,
} from '../types/database';

describe('Database Constants', () => {
  describe('ACCOUNT_STATUSES', () => {
    it('contains all required statuses', () => {
      const statusValues = ACCOUNT_STATUSES.map((s) => s.value);
      expect(statusValues).toContain('active');
      expect(statusValues).toContain('passed');
      expect(statusValues).toContain('failed');
      expect(statusValues).toContain('funded');
      expect(statusValues).toContain('archived');
    });

    it('has Persian labels for all statuses', () => {
      ACCOUNT_STATUSES.forEach((status) => {
        expect(status.label).toBeTruthy();
        expect(typeof status.label).toBe('string');
      });
    });
  });

  describe('PHASE_STATUSES', () => {
    it('contains all required statuses', () => {
      const statusValues = PHASE_STATUSES.map((s) => s.value);
      expect(statusValues).toContain('active');
      expect(statusValues).toContain('completed');
      expect(statusValues).toContain('failed');
      expect(statusValues).toContain('skipped');
    });
  });

  describe('PHASE_TYPES', () => {
    it('contains all required phase types', () => {
      const typeValues = PHASE_TYPES.map((t) => t.value);
      expect(typeValues).toContain('challenge');
      expect(typeValues).toContain('phase1');
      expect(typeValues).toContain('phase2');
      expect(typeValues).toContain('funded');
      expect(typeValues).toContain('evaluation');
    });
  });

  describe('CURRENCIES', () => {
    it('contains major trading currencies', () => {
      expect(CURRENCIES).toContain('USD');
      expect(CURRENCIES).toContain('EUR');
      expect(CURRENCIES).toContain('GBP');
      expect(CURRENCIES).toContain('JPY');
    });

    it('has at least 5 currencies', () => {
      expect(CURRENCIES.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('TIMEZONES', () => {
    it('contains common trading timezones', () => {
      expect(TIMEZONES).toContain('Asia/Tehran');
      expect(TIMEZONES).toContain('UTC');
      expect(TIMEZONES).toContain('America/New_York');
      expect(TIMEZONES).toContain('Europe/London');
    });

    it('has at least 5 timezones', () => {
      expect(TIMEZONES.length).toBeGreaterThanOrEqual(5);
    });
  });
});
