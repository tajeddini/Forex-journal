import type { NormalizedTrade } from './trade-normalizer';
import type { Trade } from '../types/database';

// ============================================================
// Duplicate Detection
// ============================================================

/**
 * Generate a fingerprint for a trade
 * Used to detect duplicate imports
 */
export function generateTradeFingerprint(trade: NormalizedTrade | Trade): string {
  // Use strong identifiers if available
  if (trade.ticket) {
    return `ticket:${trade.ticket}:${trade.symbol}:${trade.entry_datetime}`;
  }

  // Fallback to composite fingerprint
  const parts = [
    trade.symbol,
    trade.side,
    trade.volume,
    trade.entry_datetime,
    trade.entry_price,
    trade.exit_datetime,
    trade.exit_price,
    trade.profit,
  ].map(p => String(p).toLowerCase().trim());

  return parts.join('|');
}

/**
 * Check if a trade is a duplicate of existing trades
 */
export function findDuplicates(
  newTrades: NormalizedTrade[],
  existingTrades: Trade[]
): Map<number, Trade> {
  const duplicates = new Map<number, Trade>();
  
  // Create fingerprint map of existing trades
  const existingMap = new Map<string, Trade>();
  for (const existing of existingTrades) {
    const fingerprint = generateTradeFingerprint(existing);
    existingMap.set(fingerprint, existing);
  }

  // Check each new trade
  for (let i = 0; i < newTrades.length; i++) {
    const fingerprint = generateTradeFingerprint(newTrades[i]);
    const existing = existingMap.get(fingerprint);
    if (existing) {
      duplicates.set(i, existing);
    }
  }

  return duplicates;
}

/**
 * Find duplicates within the new trades themselves
 */
export function findInternalDuplicates(trades: NormalizedTrade[]): Map<number, number[]> {
  const duplicates = new Map<number, number[]>();
  const fingerprintMap = new Map<string, number[]>();

  for (let i = 0; i < trades.length; i++) {
    const fingerprint = generateTradeFingerprint(trades[i]);
    const existing = fingerprintMap.get(fingerprint);
    
    if (existing) {
      existing.push(i);
    } else {
      fingerprintMap.set(fingerprint, [i]);
    }
  }

  // Map each duplicate to its first occurrence
  for (const indices of fingerprintMap.values()) {
    if (indices.length > 1) {
      const first = indices[0];
      for (let i = 1; i < indices.length; i++) {
        duplicates.set(indices[i], [first]);
      }
    }
  }

  return duplicates;
}
