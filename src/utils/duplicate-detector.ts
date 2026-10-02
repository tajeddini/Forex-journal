import type { NormalizedTrade } from './trade-normalizer';
import type { Trade } from '../types/database';

// ============================================================
// Duplicate Detection
// Source-aware and broker-identity-aware fingerprinting
// ============================================================

export interface DuplicateTradeInfo {
  trade: Trade | NormalizedTrade;
  reason: string;
}

/**
 * Generate a robust fingerprint for a trade.
 * For MT5 / MT4: uses broker identifiers (position_id / ticket) combined with account and symbol.
 * For manual trades: uses full composite attributes including comments to prevent false collision
 * between legitimate trades with identical entry prices.
 */
export function generateTradeFingerprint(
  trade: NormalizedTrade | Trade,
  defaultAccountId?: string
): string {
  const accountId =
    'account_id' in trade && trade.account_id
      ? trade.account_id
      : defaultAccountId || '';
  const source = 'source' in trade ? trade.source : undefined;

  // 1. MT5: Position ID is the definitive broker position identifier
  if (trade.position_id) {
    return `mt5:pos:${accountId}:${trade.symbol.toUpperCase()}:${trade.position_id}`;
  }

  // 2. MT4 / Deal Ticket: Ticket is the broker order/deal identifier
  if (trade.ticket) {
    return `ticket:${accountId}:${trade.symbol.toUpperCase()}:${trade.ticket}`;
  }

  // 3. Fallback for manual or identifier-less trades:
  // Use high-precision composite key: symbol, side, volume, entry, exit, prices, profit, comment
  const comment = trade.comment?.trim() || '';
  const parts = [
    source || 'manual',
    accountId,
    trade.symbol.toUpperCase(),
    trade.side,
    Number(trade.volume).toFixed(4),
    trade.entry_datetime,
    Number(trade.entry_price).toFixed(5),
    trade.exit_datetime,
    Number(trade.exit_price).toFixed(5),
    Number(trade.profit).toFixed(2),
    comment,
  ];

  return parts.join('|');
}

/**
 * Check if newly imported trades collide with existing database trades
 */
export function findDuplicates(
  newTrades: NormalizedTrade[],
  existingTrades: Trade[],
  targetAccountId?: string
): Map<number, Trade> {
  const accountId = targetAccountId || existingTrades[0]?.account_id || '';
  const duplicates = new Map<number, Trade>();
  
  // Create fingerprint map of existing trades
  const existingMap = new Map<string, Trade>();
  for (const existing of existingTrades) {
    const fingerprint = generateTradeFingerprint(existing, accountId);
    existingMap.set(fingerprint, existing);
  }

  // Check each new trade
  for (let i = 0; i < newTrades.length; i++) {
    const fingerprint = generateTradeFingerprint(newTrades[i], accountId);
    const existing = existingMap.get(fingerprint);
    if (existing) {
      duplicates.set(i, existing);
    }
  }

  return duplicates;
}

/**
 * Find duplicates within the new trades file itself
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
