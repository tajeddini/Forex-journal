// ============================================================
// Core Financial Metrics Calculations
// Single source of truth for all financial formulas
// ============================================================

import type { Trade } from '../../types/database';
import type { ClassifiedTrade, TradeResult, CoreMetrics } from './types';

/**
 * Calculate Net P/L for a trade
 * 
 * Formula: Net P/L = Profit + Commission + Swap
 * 
 * Note: In MT4/MT5 exports:
 * - profit: the broker's reported P/L (may or may not include commission/swap)
 * - commission: separate commission field
 * - swap: separate swap field
 * 
 * We add all three to get the true net P/L.
 */
export function calculateNetPnl(trade: Trade): number {
  return (trade.profit || 0) + (trade.commission || 0) + (trade.swap || 0);
}

/**
 * Classify a trade as win/loss/breakeven based on net P/L
 */
export function classifyTradeResult(netPnl: number): TradeResult {
  if (netPnl > 0) return 'win';
  if (netPnl < 0) return 'loss';
  return 'breakeven';
}

/**
 * Classify all trades with net P/L and result
 */
export function classifyTrades(trades: Trade[]): ClassifiedTrade[] {
  return trades.map(trade => {
    const netPnl = calculateNetPnl(trade);
    return {
      ...trade,
      netPnl,
      result: classifyTradeResult(netPnl),
    };
  });
}

/**
 * Calculate Win Rate
 * 
 * Formula: Win Rate = Wins / (Wins + Losses) × 100
 * 
 * Note: Breakeven trades are NOT included in the denominator.
 * Returns null if there are no closed trades (wins + losses = 0).
 */
export function calculateWinRate(wins: number, losses: number): number | null {
  const total = wins + losses;
  if (total === 0) return null;
  return (wins / total) * 100;
}

/**
 * Calculate Profit Factor
 * 
 * Formula: Profit Factor = Gross Profit / |Gross Loss|
 * 
 * Returns null if gross loss is 0 (no losing trades).
 * Returns Infinity if there are profits but no losses.
 */
export function calculateProfitFactor(grossProfit: number, grossLoss: number): number | null {
  const absLoss = Math.abs(grossLoss);
  if (absLoss === 0) {
    return grossProfit > 0 ? Infinity : null;
  }
  return grossProfit / absLoss;
}

/**
 * Calculate Average Win
 * 
 * Formula: Average Win = Gross Profit / Number of Wins
 * 
 * Returns null if no winning trades.
 */
export function calculateAverageWin(grossProfit: number, wins: number): number | null {
  if (wins === 0) return null;
  return grossProfit / wins;
}

/**
 * Calculate Average Loss
 * 
 * Formula: Average Loss = Gross Loss / Number of Losses
 * 
 * Note: Returns a negative number (actual loss value).
 * Returns null if no losing trades.
 */
export function calculateAverageLoss(grossLoss: number, losses: number): number | null {
  if (losses === 0) return null;
  return grossLoss / losses;
}

/**
 * Calculate Expectancy
 * 
 * Formula: Expectancy = (WinRate × AvgWin) + (LossRate × AvgLoss)
 * 
 * Where:
 * - WinRate = Wins / (Wins + Losses)
 * - LossRate = Losses / (Wins + Losses)
 * - AvgLoss is negative
 * 
 * Returns null if no closed trades.
 */
export function calculateExpectancy(
  wins: number,
  losses: number,
  avgWin: number | null,
  avgLoss: number | null
): number | null {
  const total = wins + losses;
  if (total === 0 || avgWin === null || avgLoss === null) return null;
  
  const winRate = wins / total;
  const lossRate = losses / total;
  
  return (winRate * avgWin) + (lossRate * avgLoss);
}

/**
 * Calculate all core metrics from classified trades
 */
export function calculateCoreMetrics(trades: ClassifiedTrade[]): CoreMetrics {
  const totalTrades = trades.length;
  
  const winningTrades = trades.filter(t => t.result === 'win').length;
  const losingTrades = trades.filter(t => t.result === 'loss').length;
  const breakevenTrades = trades.filter(t => t.result === 'breakeven').length;
  
  const grossProfit = trades
    .filter(t => t.result === 'win')
    .reduce((sum, t) => sum + t.netPnl, 0);
  
  const grossLoss = trades
    .filter(t => t.result === 'loss')
    .reduce((sum, t) => sum + t.netPnl, 0);
  
  const netPnl = grossProfit + grossLoss;
  
  const winRate = calculateWinRate(winningTrades, losingTrades);
  const profitFactor = calculateProfitFactor(grossProfit, grossLoss);
  const averageWin = calculateAverageWin(grossProfit, winningTrades);
  const averageLoss = calculateAverageLoss(grossLoss, losingTrades);
  const expectancy = calculateExpectancy(winningTrades, losingTrades, averageWin, averageLoss);
  
  return {
    totalTrades,
    winningTrades,
    losingTrades,
    breakevenTrades,
    winRate,
    netPnl,
    grossProfit,
    grossLoss,
    profitFactor,
    averageWin,
    averageLoss,
    expectancy,
  };
}
