// ============================================================
// Equity Curve & Drawdown Calculations
// ============================================================

import type { ClassifiedTrade } from './types';
import type { EquityCurve, EquityPoint, DrawdownMetrics, DrawdownPoint } from './types';

/**
 * Calculate Equity Curve
 * 
 * Starting from startingBalance, add each trade's net P/L chronologically.
 */
export function calculateEquityCurve(
  trades: ClassifiedTrade[],
  startingBalance: number
): EquityCurve {
  // Sort trades chronologically by exit_datetime
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.exit_datetime).getTime() - new Date(b.exit_datetime).getTime()
  );
  
  const points: EquityPoint[] = [];
  let currentEquity = startingBalance;
  
  // Add starting point
  if (sortedTrades.length > 0) {
    points.push({
      date: sortedTrades[0].entry_datetime,
      equity: startingBalance,
      tradeIndex: 0,
    });
  }
  
  // Add each trade's result
  sortedTrades.forEach((trade, index) => {
    currentEquity += trade.netPnl;
    points.push({
      date: trade.exit_datetime,
      equity: currentEquity,
      tradeIndex: index + 1,
    });
  });
  
  const endingBalance = currentEquity;
  const netChange = endingBalance - startingBalance;
  const returnPercent = startingBalance > 0 ? (netChange / startingBalance) * 100 : null;
  
  return {
    points,
    startingBalance,
    endingBalance,
    netChange,
    returnPercent,
  };
}

/**
 * Calculate Drawdown Metrics
 * 
 * For each equity point:
 * - Track the peak equity
 * - Calculate drawdown = current - peak
 * - Calculate drawdown % = (current - peak) / peak × 100
 */
export function calculateDrawdown(equityCurve: EquityCurve): DrawdownMetrics {
  const points: DrawdownPoint[] = [];
  let peak = equityCurve.startingBalance;
  let maxDrawdown = 0;
  let maxDrawdownPercent: number | null = null;
  
  for (const point of equityCurve.points) {
    // Update peak if current equity is higher
    if (point.equity > peak) {
      peak = point.equity;
    }
    
    const drawdown = point.equity - peak;
    const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : null;
    
    points.push({
      date: point.date,
      drawdown,
      drawdownPercent,
      peak,
      current: point.equity,
    });
    
    // Track maximum drawdown
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPercent = drawdownPercent;
    }
  }
  
  // Current drawdown (from last point)
  const lastPoint = points[points.length - 1];
  const currentDrawdown = lastPoint?.drawdown || 0;
  const currentDrawdownPercent = lastPoint?.drawdownPercent || null;
  
  return {
    points,
    currentDrawdown,
    currentDrawdownPercent,
    maxDrawdown,
    maxDrawdownPercent,
  };
}
