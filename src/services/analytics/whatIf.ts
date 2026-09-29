// ============================================================
// What-If Analysis Service
// Simulate hypothetical scenarios without modifying real data
// ============================================================

import type { ClassifiedTrade } from './types';
import type { CoreMetrics, EquityCurve, DrawdownMetrics } from './types';
import { calculateCoreMetrics } from './metrics';
import { calculateEquityCurve, calculateDrawdown } from './equity';

// --- Scenario Condition Types ---

export type WhatIfConditionType = 
  | 'symbol'
  | 'side'
  | 'strategy'
  | 'day_of_week'
  | 'hour'
  | 'duration_min'
  | 'duration_max'
  | 'result'
  | 'confidence_min'
  | 'confidence_max'
  | 'rule_adherence';

export interface WhatIfCondition {
  id: string;
  type: WhatIfConditionType;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'in_range';
  value: any;
  label: string;
}

export interface WhatIfScenario {
  id: string;
  name: string;
  conditions: WhatIfCondition[];
}

export interface WhatIfResult {
  scenario: WhatIfScenario;
  originalTrades: number;
  excludedTrades: number;
  remainingTrades: number;
  actualMetrics: CoreMetrics;
  whatIfMetrics: CoreMetrics;
  actualEquity: EquityCurve;
  whatIfEquity: EquityCurve;
  actualDrawdown: DrawdownMetrics;
  whatIfDrawdown: DrawdownMetrics;
  differences: {
    totalTrades: number;
    netPnl: number;
    winRate: number | null;
    profitFactor: number | null;
    expectancy: number | null;
    maxDrawdown: number;
  };
}

// --- Filter Functions ---

function getDayOfWeek(datetime: string): number {
  const date = new Date(datetime);
  const day = date.getDay(); // 0=Sunday, 6=Saturday
  return (day + 1) % 7; // Convert to Persian (0=Saturday, 6=Friday)
}

function getHour(datetime: string): number {
  return new Date(datetime).getHours();
}

/**
 * Check if a trade matches a condition
 */
function tradeMatchesCondition(trade: ClassifiedTrade, condition: WhatIfCondition): boolean {
  const { type, operator, value } = condition;

  switch (type) {
    case 'symbol':
      return operator === 'equals' ? trade.symbol === value : trade.symbol !== value;
    
    case 'side':
      return operator === 'equals' ? trade.side === value : trade.side !== value;
    
    case 'strategy':
      const strategyId = (trade as any).journal?.strategy_id;
      return operator === 'equals' ? strategyId === value : strategyId !== value;
    
    case 'day_of_week':
      const day = getDayOfWeek(trade.entry_datetime);
      return operator === 'equals' ? day === value : day !== value;
    
    case 'hour':
      const hour = getHour(trade.entry_datetime);
      if (operator === 'in_range') {
        const [min, max] = value;
        return hour >= min && hour <= max;
      }
      return operator === 'equals' ? hour === value : hour !== value;
    
    case 'duration_min':
      const duration = trade.duration_seconds || 0;
      return operator === 'greater_than' ? duration > value : duration >= value;
    
    case 'duration_max':
      const dur = trade.duration_seconds || Infinity;
      return operator === 'less_than' ? dur < value : dur <= value;
    
    case 'result':
      return operator === 'equals' ? trade.result === value : trade.result !== value;
    
    case 'confidence_min':
      const confidence = (trade as any).journal?.confidence;
      return confidence !== null && confidence !== undefined && confidence >= value;
    
    case 'confidence_max':
      const conf = (trade as any).journal?.confidence;
      return conf !== null && conf !== undefined && conf <= value;
    
    case 'rule_adherence':
      const adherence = (trade as any).journal?.rule_adherence || 'not_set';
      return operator === 'equals' ? adherence === value : adherence !== value;
    
    default:
      return false;
  }
}

/**
 * Apply What-If scenario to filter trades
 */
export function applyWhatIfScenario(
  trades: ClassifiedTrade[],
  scenario: WhatIfScenario
): ClassifiedTrade[] {
  if (scenario.conditions.length === 0) {
    return trades;
  }

  return trades.filter(trade => {
    // Trade must match ALL conditions to be excluded
    const matchesAll = scenario.conditions.every(condition => 
      tradeMatchesCondition(trade, condition)
    );
    // Return trades that DON'T match (i.e., not excluded)
    return !matchesAll;
  });
}

/**
 * Calculate complete What-If analysis
 */
export function calculateWhatIf(
  originalTrades: ClassifiedTrade[],
  scenario: WhatIfScenario,
  startingBalance: number
): WhatIfResult {
  // Apply scenario
  const remainingTrades = applyWhatIfScenario(originalTrades, scenario);
  const excludedCount = originalTrades.length - remainingTrades.length;

  // Calculate metrics for both datasets
  const actualMetrics = calculateCoreMetrics(originalTrades);
  const whatIfMetrics = calculateCoreMetrics(remainingTrades);

  // Calculate equity curves
  const actualEquity = calculateEquityCurve(originalTrades, startingBalance);
  const whatIfEquity = calculateEquityCurve(remainingTrades, startingBalance);

  // Calculate drawdown
  const actualDrawdown = calculateDrawdown(actualEquity);
  const whatIfDrawdown = calculateDrawdown(whatIfEquity);

  // Calculate differences
  const differences = {
    totalTrades: whatIfMetrics.totalTrades - actualMetrics.totalTrades,
    netPnl: whatIfMetrics.netPnl - actualMetrics.netPnl,
    winRate: whatIfMetrics.winRate !== null && actualMetrics.winRate !== null
      ? whatIfMetrics.winRate - actualMetrics.winRate
      : null,
    profitFactor: whatIfMetrics.profitFactor !== null && actualMetrics.profitFactor !== null
      ? whatIfMetrics.profitFactor - actualMetrics.profitFactor
      : null,
    expectancy: whatIfMetrics.expectancy !== null && actualMetrics.expectancy !== null
      ? whatIfMetrics.expectancy - actualMetrics.expectancy
      : null,
    maxDrawdown: whatIfDrawdown.maxDrawdown - actualDrawdown.maxDrawdown,
  };

  return {
    scenario,
    originalTrades: originalTrades.length,
    excludedTrades: excludedCount,
    remainingTrades: remainingTrades.length,
    actualMetrics,
    whatIfMetrics,
    actualEquity,
    whatIfEquity,
    actualDrawdown,
    whatIfDrawdown,
    differences,
  };
}

// --- Preset Scenarios ---

export function createPresetScenario(name: string, conditions: WhatIfCondition[]): WhatIfScenario {
  return {
    id: Math.random().toString(36).substring(2, 9),
    name,
    conditions,
  };
}

export const PRESET_SCENARIOS = {
  excludeLosingTrades: () => createPresetScenario('حذف معاملات بازنده', [
    {
      id: '1',
      type: 'result',
      operator: 'equals',
      value: 'loss',
      label: 'نتیجه = بازنده',
    },
  ]),

  excludeWinningTrades: () => createPresetScenario('حذف معاملات برنده', [
    {
      id: '1',
      type: 'result',
      operator: 'equals',
      value: 'win',
      label: 'نتیجه = برنده',
    },
  ]),

  excludeFriday: () => createPresetScenario('حذف معاملات جمعه', [
    {
      id: '1',
      type: 'day_of_week',
      operator: 'equals',
      value: 6, // Friday in Persian calendar
      label: 'روز = جمعه',
    },
  ]),

  excludeShortTrades: () => createPresetScenario('حذف معاملات کوتاه (کمتر از ۵ دقیقه)', [
    {
      id: '1',
      type: 'duration_max',
      operator: 'less_than',
      value: 300, // 5 minutes in seconds
      label: 'مدت < ۵ دقیقه',
    },
  ]),

  excludeRuleViolations: () => createPresetScenario('حذف نقض قوانین', [
    {
      id: '1',
      type: 'rule_adherence',
      operator: 'equals',
      value: 'violated',
      label: 'پایبندی = نقض شده',
    },
  ]),
};
