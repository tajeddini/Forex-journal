// ============================================================
// MT5 Position Aggregation Engine
// Handles complex MT5 netting & hedging deal structures:
// - single entry + full exit
// - multiple entries + one exit (scaling in)
// - multiple entries + multiple exits (scaling in & out)
// - partial close and multiple partial closes
// - remaining open volume
// - separation of direction (buy/sell) vs entry/exit semantic (in/out/inout)
// ============================================================

import type { NormalizedTrade } from './trade-normalizer';

export type MT5DealType = 'in' | 'out' | 'inout' | 'entry' | 'exit' | 'deal';

export interface MT5Deal {
  ticket?: string;
  position_id?: string;
  order_id?: string;
  deal_id?: string;
  symbol: string;
  side: 'buy' | 'sell';
  volume: number;
  price: number;
  datetime: string;
  commission: number;
  swap: number;
  profit: number;
  type: MT5DealType | string;
  entry?: string; // MT5 standard column: 'in', 'out', 'inout'
  comment?: string;
  magic_number?: number;
}

export interface AggregatedPosition {
  ticket: string;
  position_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  total_volume: number;
  closed_volume: number;
  remaining_open_volume: number;
  entry_datetime: string;
  exit_datetime: string;
  weighted_entry_price: number;
  weighted_exit_price: number;
  total_commission: number;
  total_swap: number;
  total_profit: number;
  deals: MT5Deal[];
  is_partial_close: boolean;
  is_still_open: boolean;
}

export interface MT5AggregationResult {
  closedPositions: AggregatedPosition[];
  openPositions: AggregatedPosition[];
}

/**
 * Classify whether a deal is an entry ('in'), exit ('out'), or reversal ('inout')
 * IMPORTANT: Direction ('buy'/'sell') does NOT equal entry/exit!
 * Closing a short position is deal side 'buy' with entry 'out'!
 */
export function classifyDealDirection(deal: MT5Deal): 'in' | 'out' | 'inout' {
  const rawEntry = (deal.entry || deal.type || '').toLowerCase().trim();

  // Explicit MT5 Entry field ('in', 'out', 'inout')
  if (rawEntry === 'in' || rawEntry === 'entry') {
    return 'in';
  }
  if (rawEntry === 'out' || rawEntry === 'exit') {
    return 'out';
  }
  if (rawEntry === 'inout' || rawEntry === 'in/out') {
    return 'inout';
  }

  // If no explicit Entry field is present (fallback inference from profit and comment)
  if (deal.profit !== 0) {
    // Only exit deals in MT5 realize profit/loss
    return 'out';
  }

  if (deal.comment && /close|tp|sl|out/i.test(deal.comment)) {
    return 'out';
  }

  return 'in';
}

/**
 * Group deals by position identifier
 */
function groupDealsByPosition(deals: MT5Deal[]): Map<string, MT5Deal[]> {
  const groups = new Map<string, MT5Deal[]>();

  for (const deal of deals) {
    const key = deal.position_id || deal.order_id || deal.ticket || `pos-${deal.symbol}-${deal.datetime}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(deal);
  }

  return groups;
}

/**
 * Aggregate MT5 deals into logical positions
 */
export function aggregateMT5DealsDetailed(deals: MT5Deal[]): MT5AggregationResult {
  const positionGroups = groupDealsByPosition(deals);
  const closedPositions: AggregatedPosition[] = [];
  const openPositions: AggregatedPosition[] = [];

  for (const [positionKey, positionDeals] of positionGroups.entries()) {
    if (positionDeals.length === 0) continue;

    // Sort chronologically by datetime
    const sortedDeals = [...positionDeals].sort(
      (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
    );

    const inDeals: MT5Deal[] = [];
    const outDeals: MT5Deal[] = [];

    for (const deal of sortedDeals) {
      const classification = classifyDealDirection(deal);
      if (classification === 'in') {
        inDeals.push(deal);
      } else if (classification === 'out') {
        outDeals.push(deal);
      } else {
        // inout (reversal)
        outDeals.push(deal);
      }
    }

    // Fallback: If no explicit 'in' detected, earliest deal is entry
    if (inDeals.length === 0 && sortedDeals.length > 0) {
      inDeals.push(sortedDeals[0]);
      outDeals.push(...sortedDeals.slice(1));
    }

    const totalEntryVolume = inDeals.reduce((sum, d) => sum + d.volume, 0);
    const totalExitVolume = outDeals.reduce((sum, d) => sum + d.volume, 0);

    // If totalExitVolume === 0, this position has NOT been closed at all!
    if (totalExitVolume === 0) {
      const weightedEntryPrice =
        totalEntryVolume > 0
          ? inDeals.reduce((sum, d) => sum + d.price * d.volume, 0) / totalEntryVolume
          : inDeals[0]?.price || 0;

      const openPos: AggregatedPosition = {
        ticket: sortedDeals[0].ticket || positionKey,
        position_id: positionKey,
        symbol: sortedDeals[0].symbol,
        side: inDeals[0]?.side || sortedDeals[0].side,
        total_volume: totalEntryVolume,
        closed_volume: 0,
        remaining_open_volume: totalEntryVolume,
        entry_datetime: inDeals[0]?.datetime || sortedDeals[0].datetime,
        exit_datetime: '',
        weighted_entry_price: weightedEntryPrice,
        weighted_exit_price: 0,
        total_commission: sortedDeals.reduce((sum, d) => sum + (d.commission || 0), 0),
        total_swap: sortedDeals.reduce((sum, d) => sum + (d.swap || 0), 0),
        total_profit: sortedDeals.reduce((sum, d) => sum + (d.profit || 0), 0),
        deals: sortedDeals,
        is_partial_close: false,
        is_still_open: true,
      };
      openPositions.push(openPos);
      continue;
    }

    // Weighted average entry price across all 'in' deals
    const weightedEntryPrice =
      totalEntryVolume > 0
        ? inDeals.reduce((sum, d) => sum + d.price * d.volume, 0) / totalEntryVolume
        : inDeals[0]?.price || outDeals[0]?.price || 0;

    // Weighted average exit price across all 'out' deals
    const weightedExitPrice =
      totalExitVolume > 0
        ? outDeals.reduce((sum, d) => sum + d.price * d.volume, 0) / totalExitVolume
        : weightedEntryPrice;

    // Financial sums
    const totalCommission = sortedDeals.reduce((sum, d) => sum + (d.commission || 0), 0);
    const totalSwap = sortedDeals.reduce((sum, d) => sum + (d.swap || 0), 0);
    const totalProfit = sortedDeals.reduce((sum, d) => sum + (d.profit || 0), 0);

    // Timestamps
    const entryDatetimes = inDeals.map(d => new Date(d.datetime).getTime());
    const exitDatetimes = outDeals.map(d => new Date(d.datetime).getTime());
    const entryDatetime = new Date(Math.min(...entryDatetimes)).toISOString();
    const exitDatetime = new Date(Math.max(...exitDatetimes)).toISOString();

    // Position side is established by the entry deal
    const side = inDeals[0]?.side || (outDeals[0]?.side === 'buy' ? 'sell' : 'buy');

    // Partial close detection: closed volume is less than entered volume
    const isPartialClose = totalExitVolume < totalEntryVolume;
    const remainingOpenVolume = Math.max(0, totalEntryVolume - totalExitVolume);
    const closedVolume = Math.min(totalEntryVolume, totalExitVolume);

    const position: AggregatedPosition = {
      ticket: sortedDeals[0].ticket || positionKey,
      position_id: positionKey,
      symbol: sortedDeals[0].symbol,
      side,
      total_volume: totalEntryVolume > 0 ? totalEntryVolume : closedVolume,
      closed_volume: closedVolume,
      remaining_open_volume: remainingOpenVolume,
      entry_datetime: entryDatetime,
      exit_datetime: exitDatetime,
      weighted_entry_price: weightedEntryPrice,
      weighted_exit_price: weightedExitPrice,
      total_commission: totalCommission,
      total_swap: totalSwap,
      total_profit: totalProfit,
      deals: sortedDeals,
      is_partial_close: isPartialClose,
      is_still_open: false,
    };

    closedPositions.push(position);
  }

  return { closedPositions, openPositions };
}

/**
 * Backward compatible aggregateMT5Positions
 */
export function aggregateMT5Positions(deals: MT5Deal[]): AggregatedPosition[] {
  const result = aggregateMT5DealsDetailed(deals);
  return result.closedPositions;
}

/**
 * Convert aggregated position to NormalizedTrade format
 */
export function positionToNormalizedTrade(position: AggregatedPosition): NormalizedTrade {
  return {
    ticket: position.ticket,
    position_id: position.position_id,
    symbol: position.symbol,
    side: position.side,
    volume: position.closed_volume || position.total_volume,
    entry_datetime: position.entry_datetime,
    entry_price: position.weighted_entry_price,
    stop_loss: null,
    take_profit: null,
    exit_datetime: position.exit_datetime,
    exit_price: position.weighted_exit_price,
    commission: position.total_commission,
    swap: position.total_swap,
    profit: position.total_profit,
    comment: position.deals.find(d => d.comment)?.comment || null,
    magic_number: position.deals.find(d => d.magic_number !== undefined)?.magic_number || null,
  };
}

/**
 * Process MT5 deals and return normalized trades for closed positions
 */
export function processMT5Deals(deals: MT5Deal[]): NormalizedTrade[] {
  const positions = aggregateMT5Positions(deals);
  return positions.map(positionToNormalizedTrade);
}

/**
 * Alias for processMT5Deals - used in import pipeline
 */
export function aggregateMT5Deals(deals: MT5Deal[]): AggregatedPosition[] {
  return aggregateMT5Positions(deals);
}
