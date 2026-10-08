import { describe, expect, it } from 'vitest';
import { validateTradeReviewResponse, validateAutoTagResponse, validatePeriodicReportResponse } from './response-validation';

const tradeReview = {
  actionableLessons: ['one', 'two', 'three'],
  facts: ['fact'],
  observations: [],
  possiblePatterns: [],
  questionsForTrader: [],
  limitations: ['limited'],
};

describe('Strict Phase 14 AI response validation', () => {
  it('accepts a valid Trade Review with at most three lessons', () => {
    expect(validateTradeReviewResponse(tradeReview).actionableLessons).toHaveLength(3);
  });

  it('rejects Trade Review with more than three lessons', () => {
    expect(() => validateTradeReviewResponse({ ...tradeReview, actionableLessons: ['1','2','3','4'] })).toThrow('۳');
  });

  it('rejects malformed nested rule adherence data', () => {
    expect(() => validateTradeReviewResponse({ ...tradeReview, ruleAdherenceAnalysis: { status: 'unknown', explanation: 'x' } })).toThrow();
  });

  it('accepts valid Auto-Tag suggestions', () => {
    expect(validateAutoTagResponse({ suggestions: [{ tagName: 'London', reason: 'evidence', confidence: 90, type: 'tag' }] }).suggestions).toHaveLength(1);
  });

  it('rejects Auto-Tag confidence outside 0..100', () => {
    expect(() => validateAutoTagResponse({ suggestions: [{ tagName: 'x', reason: 'y', confidence: 101 }] })).toThrow();
  });

  it('accepts exactly three periodic priorities', () => {
    const result = validatePeriodicReportResponse({
      title: 'Weekly',
      period: '2026-10-01 to 2026-10-07',
      sampleSize: 5,
      summary: 'summary',
      keyMetrics: { totalTrades: 5 },
      observations: [],
      recommendations: [],
      limitations: [],
      topPriorities: ['a','b','c'],
    });
    expect(result.topPriorities).toHaveLength(3);
  });

  it('rejects periodic reports without exactly three priorities when supplied', () => {
    expect(() => validatePeriodicReportResponse({
      title: 'Weekly',
      period: 'x',
      sampleSize: 5,
      summary: 'x',
      keyMetrics: {},
      observations: [],
      recommendations: [],
      limitations: [],
      topPriorities: ['a','b'],
    })).toThrow();
  });
});
