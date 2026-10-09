import { describe, it, expect } from 'vitest';
import {
  detectTradingPatterns,
  getForexSession,
  getForexSessionLabel,
  type PatternTradeContext,
} from './patterns';
import type { Trade, TradeJournal, Setup, Strategy, Mistake } from '../../types/database';

function createMockTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 't-' + Math.random().toString(36).substring(2, 9),
    user_id: 'u1',
    account_id: 'a1',
    phase_id: 'p1',
    import_batch_id: null,
    ticket: '1001',
    position_id: '1001',
    symbol: 'EURUSD',
    side: 'buy',
    volume: 1.0,
    entry_datetime: '2026-10-05T13:30:00Z', // 13:30 UTC -> London/NY Overlap
    entry_price: 1.1000,
    exit_datetime: '2026-10-05T14:30:00Z',
    exit_price: 1.1050,
    stop_loss: 1.0950,
    take_profit: 1.1100,
    profit: 50.0,
    commission: 0,
    swap: 0,
    duration_seconds: 3600,
    created_at: '2026-10-05T14:30:00Z',
    updated_at: '2026-10-05T14:30:00Z',
    ...overrides,
  };
}

describe('Phase 15 — Deterministic Pattern Detection Engine', () => {
  it('identifies Forex trading sessions correctly by UTC hours', () => {
    // 03:00 UTC -> Asian
    expect(getForexSession(new Date('2026-10-05T03:00:00Z'))).toBe('asian');
    // 08:30 UTC -> London
    expect(getForexSession(new Date('2026-10-05T08:30:00Z'))).toBe('london');
    // 13:15 UTC -> London/NY Overlap
    expect(getForexSession(new Date('2026-10-05T13:15:00Z'))).toBe('london_ny_overlap');
    // 18:00 UTC -> New York
    expect(getForexSession(new Date('2026-10-05T18:00:00Z'))).toBe('new_york');

    expect(getForexSessionLabel('asian')).toContain('آسیا');
    expect(getForexSessionLabel('london')).toContain('لندن');
  });

  it('handles empty trades gracefully', () => {
    const result = detectTradingPatterns([]);
    expect(result.baseline.totalTrades).toBe(0);
    expect(result.baseline.winRate).toBeNull();
    expect(result.patterns.length).toBe(0);
    expect(result.strengths.length).toBe(0);
    expect(result.weaknesses.length).toBe(0);
  });

  it('calculates accurate baseline metrics across sample trades', () => {
    const contexts: PatternTradeContext[] = [
      { trade: createMockTrade({ profit: 100 }) },
      { trade: createMockTrade({ profit: 50 }) },
      { trade: createMockTrade({ profit: -50 }) },
      { trade: createMockTrade({ profit: -100 }) },
    ];

    const result = detectTradingPatterns(contexts);
    expect(result.baseline.totalTrades).toBe(4);
    expect(result.baseline.winRate).toBe(50);
    expect(result.baseline.netPnl).toBe(0);
    expect(result.baseline.profitFactor).toBe(1);
  });

  it('detects high-performing setups with reliable sample size and flags as strength', () => {
    const setup: Setup = {
      id: 's-breakout',
      name: 'شکست خط روند',
      user_id: 'u1',
      strategy_id: 'strat-1',
      description: null,
      is_active: true,
      created_at: '',
      updated_at: '',
    };

    const contexts: PatternTradeContext[] = [];
    // 10 trades with setup: 8 wins, 2 losses -> 80% win rate
    for (let i = 0; i < 10; i++) {
      const isWin = i < 8;
      contexts.push({
        trade: createMockTrade({ profit: isWin ? 100 : -50 }),
        setup,
      });
    }
    // 10 random other trades: 2 wins, 8 losses -> overall baseline ~50%
    for (let i = 0; i < 10; i++) {
      contexts.push({
        trade: createMockTrade({ profit: i < 2 ? 100 : -100 }),
      });
    }

    const result = detectTradingPatterns(contexts);
    const setupPattern = result.patterns.find(p => p.id === 'setup-شکست خط روند');

    expect(setupPattern).toBeDefined();
    expect(setupPattern?.impact).toBe('strength');
    expect(setupPattern?.sampleSize).toBe(10);
    expect(setupPattern?.reliability).toBe('high_confidence');
    expect(setupPattern?.winRate).toBe(80);
    expect(setupPattern?.winRateDelta).toBeGreaterThan(0);
    expect(setupPattern?.disclaimer).toContain('حداقل آستانه آماری');
    expect(setupPattern?.analyticalObservation).toContain('شکست خط روند');
  });

  it('flags small sample size (< 5 trades) with low_sample_observation and warning disclaimer', () => {
    const setup: Setup = {
      id: 's-rare',
      name: 'ستاپ کم‌تکرار',
      user_id: 'u1',
      strategy_id: null,
      description: null,
      is_active: true,
      created_at: '',
      updated_at: '',
    };

    const contexts: PatternTradeContext[] = [
      { trade: createMockTrade({ profit: 150 }), setup },
      { trade: createMockTrade({ profit: 200 }), setup },
      { trade: createMockTrade({ profit: -50 }), setup },
      // Other trades to establish baseline
      { trade: createMockTrade({ profit: 50 }) },
      { trade: createMockTrade({ profit: -50 }) },
    ];

    const result = detectTradingPatterns(contexts);
    const pattern = result.patterns.find(p => p.id === 'setup-ستاپ کم‌تکرار');

    expect(pattern).toBeDefined();
    expect(pattern?.sampleSize).toBe(3);
    expect(pattern?.reliability).toBe('low_sample_observation');
    expect(pattern?.disclaimer).toContain('هشدار: حجم نمونه بسیار کم');
  });

  it('detects rule adherence discipline impact vs rule violation leaks', () => {
    const contexts: PatternTradeContext[] = [
      // 5 followed rules trades -> All Wins
      ...Array.from({ length: 5 }, () => ({
        trade: createMockTrade({ profit: 120 }),
        journal: { rule_adherence: 'followed' } as TradeJournal,
      })),
      // 4 violated rules trades -> Losses
      ...Array.from({ length: 4 }, () => ({
        trade: createMockTrade({ profit: -80 }),
        journal: { rule_adherence: 'violated' } as TradeJournal,
      })),
    ];

    const result = detectTradingPatterns(contexts);
    const followedPattern = result.patterns.find(p => p.id === 'discipline-followed');
    const violatedPattern = result.patterns.find(p => p.id === 'discipline-violated');

    expect(followedPattern).toBeDefined();
    expect(followedPattern?.impact).toBe('strength');
    expect(followedPattern?.winRate).toBe(100);

    expect(violatedPattern).toBeDefined();
    expect(violatedPattern?.impact).toBe('weakness');
    expect(violatedPattern?.totalPnl).toBeLessThan(0);
    expect(violatedPattern?.analyticalObservation).toContain('تخطی از قوانین');
  });

  it('detects recurring mistakes and calculates exact cumulative leak cost', () => {
    const mistake: Mistake = {
      id: 'm-chase',
      name: 'تعقیب قیمت (FOMO)',
      user_id: 'u1',
      description: null,
      is_active: true,
      created_at: '',
      updated_at: '',
    };

    const contexts: PatternTradeContext[] = [
      { trade: createMockTrade({ profit: -120 }), mistakes: [mistake] },
      { trade: createMockTrade({ profit: -80 }), mistakes: [mistake] },
      { trade: createMockTrade({ profit: -150 }), mistakes: [mistake] },
      { trade: createMockTrade({ profit: 100 }) },
      { trade: createMockTrade({ profit: 150 }) },
    ];

    const result = detectTradingPatterns(contexts);
    const mistakePattern = result.patterns.find(p => p.id === 'mistake-تعقیب قیمت (FOMO)');

    expect(mistakePattern).toBeDefined();
    expect(mistakePattern?.impact).toBe('weakness');
    expect(mistakePattern?.sampleSize).toBe(3);
    expect(mistakePattern?.totalPnl).toBe(-350);
    expect(mistakePattern?.analyticalObservation).toContain('-350$');
  });

  it('detects symbol asymmetry and session performance differences', () => {
    const contexts: PatternTradeContext[] = [
      // 4 profitable trades in London session
      ...Array.from({ length: 4 }, () => ({
        trade: createMockTrade({
          symbol: 'GBPUSD',
          entry_datetime: '2026-10-06T09:00:00Z', // London
          profit: 90,
        }),
      })),
      // 4 losing trades in Asian session
      ...Array.from({ length: 4 }, () => ({
        trade: createMockTrade({
          symbol: 'GBPUSD',
          entry_datetime: '2026-10-06T02:00:00Z', // Asian
          profit: -70,
        }),
      })),
    ];

    const result = detectTradingPatterns(contexts);
    const londonPattern = result.patterns.find(p => p.id === 'session-london');
    const asianPattern = result.patterns.find(p => p.id === 'session-asian');

    expect(londonPattern).toBeDefined();
    expect(londonPattern?.impact).toBe('strength');
    expect(londonPattern?.winRate).toBe(100);

    expect(asianPattern).toBeDefined();
    expect(asianPattern?.impact).toBe('weakness');
    expect(asianPattern?.winRate).toBe(0);
  });
});
