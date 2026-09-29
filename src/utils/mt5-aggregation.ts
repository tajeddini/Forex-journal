// ============================================================
// MT5 Position Aggregation Engine
// Handles multiple deals belonging to one logical position
// ============================================================

import type { NormalizedTrade } from './trade-normalizer';

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
  type: 'entry' | 'exit' | 'in' | 'out' | 'buy' | 'sell' | 'deal';
  comment?: string;
  magic_number?: number;
}

export interface AggregatedPosition {
  ticket: string;
  position_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  total_volume: number;
  entry_datetime: string;
  exit_datetime: string;
  weighted_entry_price: number;
  weighted_exit_price: number;
  total_commission: number;
  total_swap: number;
  total_profit: number;
  deals: MT5Deal[];
  is_partial_close: boolean;
}

/**
 * Group deals by position_id or ticket
 */
function groupDealsByPosition(deals: MT5Deal[]): Map<string, MT5Deal[]> {
  const groups = new Map<string, MT5Deal[]>();

  for (const deal of deals) {
    // Use position_id if available, otherwise use ticket
    const key = deal.position_id || deal.ticket || `unknown-${Math.random()}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(deal);
  }

  return groups;
}

/**
 * Classify a deal as entry or exit
 */
function classifyDeal(deal: MT5Deal): 'entry' | 'exit' {
  const type = deal.type.toLowerCase();
  
  // Explicit entry types
  if (type === 'entry' || type === 'in' || type === 'buy') {
    return 'entry';
  }
  
  // Explicit exit types
  if (type === 'exit' || type === 'out' || type === 'sell') {
    return 'exit';
  }
  
  // For generic 'deal' type, we need to infer from context
  // This will be handled in aggregation logic
  return 'entry'; // Default
}

/**
 * Aggregate MT5 deals into logical positions
 */
export function aggregateMT5Positions(deals: MT5Deal[]): AggregatedPosition[] {
  const positionGroups = groupDealsByPosition(deals);
  const positions: AggregatedPosition[] = [];

  for (const [positionKey, positionDeals] of positionGroups.entries()) {
    if (positionDeals.length === 0) continue;

    // Separate entry and exit deals
    const entryDeals: MT5Deal[] = [];
    const exitDeals: MT5Deal[] = [];

    for (const deal of positionDeals) {
      const dealType = classifyDeal(deal);
      if (dealType === 'entry') {
        entryDeals.push(deal);
      } else {
        exitDeals.push(deal);
      }
    }

    // If no explicit classification, use first deal as entry, rest as exits
    if (entryDeals.length === 0 && positionDeals.length > 0) {
      entryDeals.push(positionDeals[0]);
      exitDeals.push(...positionDeals.slice(1));
    }

    if (entryDeals.length === 0) {
      // No entry deals - skip this position
      console.warn(`Position ${positionKey} has no entry deals`);
      continue;
    }

    // Calculate aggregated values
    const totalEntryVolume = entryDeals.reduce((sum, d) => sum + d.volume, 0);
    const totalExitVolume = exitDeals.reduce((sum, d) => sum + d.volume, 0);
    const totalVolume = Math.max(totalEntryVolume, totalExitVolume);

    // Weighted average entry price
    const weightedEntryPrice = entryDeals.reduce((sum, d) => sum + (d.price * d.volume), 0) / totalEntryVolume;
    
    // Weighted average exit price (if exits exist)
    const weightedExitPrice = exitDeals.length > 0
      ? exitDeals.reduce((sum, d) => sum + (d.price * d.volume), 0) / totalExitVolume
      : weightedEntryPrice; // If no exits, use entry price

    // Total commission, swap, profit
    const totalCommission = positionDeals.reduce((sum, d) => sum + d.commission, 0);
    const totalSwap = positionDeals.reduce((sum, d) => sum + d.swap, 0);
    const totalProfit = positionDeals.reduce((sum, d) => sum + d.profit, 0);

    // Entry and exit datetimes
    const entryDatetimes = entryDeals.map(d => new Date(d.datetime).getTime());
    const exitDatetimes = exitDeals.map(d => new Date(d.datetime).getTime());
    
    const entryDatetime = new Date(Math.min(...entryDatetimes)).toISOString();
    const exitDatetime = exitDatetimes.length > 0
      ? new Date(Math.max(...exitDatetimes)).toISOString()
      : entryDatetime;

    // Determine position side from first entry deal
    const side = entryDeals[0].side;

    // Check if this is a partial close
    const isPartialClose = totalExitVolume > 0 && totalExitVolume < totalEntryVolume;

    positions.push({
      ticket: positionDeals[0].ticket || positionKey,
      position_id: positionKey,
      symbol: positionDeals[0].symbol,
      side,
      total_volume: totalVolume,
      entry_datetime: entryDatetime,
      exit_datetime: exitDatetime,
      weighted_entry_price: weightedEntryPrice,
      weighted_exit_price: weightedExitPrice,
      total_commission: totalCommission,
      total_swap: totalSwap,
      total_profit: totalProfit,
      deals: positionDeals,
      is_partial_close: isPartialClose,
    });
  }

  return positions;
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
    volume: position.total_volume,
    entry_datetime: position.entry_datetime,
    entry_price: position.weighted_entry_price,
    stop_loss: null, // Not available in MT5 deals
    take_profit: null, // Not available in MT5 deals
    exit_datetime: position.exit_datetime,
    exit_price: position.weighted_exit_price,
    commission: position.total_commission,
    swap: position.total_swap,
    profit: position.total_profit,
    comment: position.deals[0]?.comment || null,
    magic_number: position.deals[0]?.magic_number || null,
  };
}

/**
 * Process MT5 deals and return normalized trades
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
