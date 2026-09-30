// ============================================================
// AI Validation Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { validateQueryPlan, isAllowedMetric, isAllowedDimension, validateQueryPlanOwnership } from './validation';
import type { AIQueryPlan } from './types';

describe('AI Query Validation', () => {
  describe('validateQueryPlan', () => {
    it('should accept valid query plan', () => {
      const query: AIQueryPlan = {
        metrics: ['totalTrades', 'winRate'],
        dimensions: ['symbol'],
        filters: [
          { field: 'symbol', operator: 'equals', value: 'EURUSD' }
        ],
        dateRange: {
          start: '2024-01-01',
          end: '2024-12-31'
        },
        limit: 100
      };

      const result = validateQueryPlan(query);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject query with no metrics', () => {
      const query: AIQueryPlan = {
        metrics: []
      };

      const result = validateQueryPlan(query);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('حداقل یک metric باید مشخص شود');
    });

    it('should reject invalid metric', () => {
      const query: AIQueryPlan = {
        metrics: ['invalidMetric' as any]
      };

      const result = validateQueryPlan(query);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Metric نامعتبر'))).toBe(true);
    });

    it('should reject invalid dimension', () => {
      const query: AIQueryPlan = {
        metrics: ['totalTrades'],
        dimensions: ['invalidDimension' as any]
      };

      const result = validateQueryPlan(query);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Dimension نامعتبر'))).toBe(true);
    });

    it('should reject invalid filter operator', () => {
      const query: AIQueryPlan = {
        metrics: ['totalTrades'],
        filters: [
          { field: 'symbol', operator: 'INVALID' as any, value: 'EURUSD' }
        ]
      };

      const result = validateQueryPlan(query);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('عملگر فیلتر نامعتبر'))).toBe(true);
    });

    it('should reject invalid date range', () => {
      const query: AIQueryPlan = {
        metrics: ['totalTrades'],
        dateRange: {
          start: '2024-12-31',
          end: '2024-01-01' // End before start
        }
      };

      const result = validateQueryPlan(query);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('تاریخ شروع نباید بعد از تاریخ پایان'))).toBe(true);
    });

    it('should reject SQL injection attempts', () => {
      const query: AIQueryPlan = {
        metrics: ['totalTrades'],
        filters: [
          { field: 'symbol', operator: 'equals', value: 'EURUSD; DROP TABLE trades' }
        ]
      };

      const result = validateQueryPlan(query);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('الگوی نامعتبر'))).toBe(true);
    });

    it('should reject excessive limit', () => {
      const query: AIQueryPlan = {
        metrics: ['totalTrades'],
        limit: 10000
      };

      const result = validateQueryPlan(query);
      expect(result.valid).toBe(true); // Valid but with warning
      expect(result.warnings.some(w => w.includes('Limit بسیار بزرگ'))).toBe(true);
    });

    it('should reject too many filters', () => {
      const query: AIQueryPlan = {
        metrics: ['totalTrades'],
        filters: Array(15).fill(null).map(() => ({
          field: 'symbol' as const,
          operator: 'equals' as const,
          value: 'EURUSD'
        }))
      };

      const result = validateQueryPlan(query);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('حداکثر'))).toBe(true);
    });

    it('should accept valid between filter', () => {
      const query: AIQueryPlan = {
        metrics: ['totalTrades'],
        filters: [
          { field: 'date', operator: 'between', value: ['2024-01-01', '2024-12-31'] }
        ]
      };

      const result = validateQueryPlan(query);
      expect(result.valid).toBe(true);
    });

    it('should reject between filter with wrong value type', () => {
      const query: AIQueryPlan = {
        metrics: ['totalTrades'],
        filters: [
          { field: 'date', operator: 'between', value: '2024-01-01' as any }
        ]
      };

      const result = validateQueryPlan(query);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('between نیاز به آرایه'))).toBe(true);
    });
  });

  describe('isAllowedMetric', () => {
    it('should accept valid metrics', () => {
      expect(isAllowedMetric('totalTrades')).toBe(true);
      expect(isAllowedMetric('winRate')).toBe(true);
      expect(isAllowedMetric('netPnl')).toBe(true);
    });

    it('should reject invalid metrics', () => {
      expect(isAllowedMetric('invalidMetric')).toBe(false);
      expect(isAllowedMetric('DROP TABLE')).toBe(false);
    });
  });

  describe('validateQueryPlanOwnership', () => {
    it('verifies that account and phase IDs belong to the user', () => {
      const query: AIQueryPlan = {
        metrics: ['totalTrades'],
        filters: [
          { field: 'account', operator: 'equals', value: 'acc-1' },
          { field: 'phase', operator: 'equals', value: 'phase-1' },
        ],
      };

      const userAccounts = ['acc-1', 'acc-2'];
      const userPhases = ['phase-1'];

      const errors = validateQueryPlanOwnership(query, userAccounts, userPhases);
      expect(errors).toHaveLength(0);
    });

    it('rejects cross-user account and phase identifiers', () => {
      const query: AIQueryPlan = {
        metrics: ['totalTrades'],
        filters: [
          { field: 'account', operator: 'equals', value: 'victim-account-id' },
          { field: 'phase', operator: 'equals', value: 'victim-phase-id' },
        ],
      };

      const userAccounts = ['my-account-1'];
      const userPhases = ['my-phase-1'];

      const errors = validateQueryPlanOwnership(query, userAccounts, userPhases);
      expect(errors.length).toBe(2);
      expect(errors[0]).toContain('شناسه حساب غیرمجاز');
      expect(errors[1]).toContain('شناسه فاز غیرمجاز');
    });
  });
});
