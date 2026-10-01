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
 * Fully supports:
 * - single entry + full exit
 * - multiple entries + one exit (scaling in)
 * - multiple entries + multiple exits (scaling in and out)
 * - partial closes and multiple partial closes
 * - INOUT without reversal (position reduction or complete close)
 * - INOUT with reversal (closing existing position + opening opposite position)
 * - distinct position IDs and symbols segregation
 * - weighted entry and exit prices
 * - deal deduplication
 */
export function aggregateMT5DealsDetailed(deals: MT5Deal[]): MT5AggregationResult {
  const positionGroups = groupDealsByPosition(deals);
  const closedPositions: AggregatedPosition[] = [];
  const openPositions: AggregatedPosition[] = [];

  for (const [positionKey, rawPositionDeals] of positionGroups.entries()) {
    if (rawPositionDeals.length === 0) continue;

    // Deduplicate deals within the same position stream
    const seenDeals = new Set<string>();
    const uniqueDeals: MT5Deal[] = [];
    for (const d of rawPositionDeals) {
      const dealKey = d.deal_id
        ? `deal-${d.deal_id}`
        : `${d.ticket || ''}-${d.datetime}-${d.price}-${d.volume}-${d.type}-${d.side}`;
      if (!seenDeals.has(dealKey)) {
        seenDeals.add(dealKey);
        uniqueDeals.push(d);
      }
    }

    // Sort chronologically by datetime
    const sortedDeals = [...uniqueDeals].sort(
      (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
    );

    // Active position state machine
    interface ActivePosState {
      ticket: string;
      position_id: string;
      symbol: string;
      side: 'buy' | 'sell';
      inDeals: MT5Deal[];
      outDeals: MT5Deal[];
      openVolume: number;
    }

    let activePos: ActivePosState | null = null;

    const finalizePos = (state: ActivePosState, isStillOpen: boolean): AggregatedPosition => {
      const inVols = state.inDeals.reduce((sum, d) => sum + d.volume, 0);
      const outVols = state.outDeals.reduce((sum, d) => sum + d.volume, 0);
      const totalVolume = inVols > 0 ? inVols : outVols;
      const closedVolume = isStillOpen ? 0 : (outVols > 0 ? Math.min(totalVolume, outVols) : 0);
      const remainingOpen = isStillOpen ? totalVolume : Math.max(0, totalVolume - outVols);

      const weightedEntry =
        inVols > 0
          ? state.inDeals.reduce((sum, d) => sum + d.price * d.volume, 0) / inVols
          : (state.inDeals[0]?.price || state.outDeals[0]?.price || 0);

      const weightedExit =
        outVols > 0
          ? state.outDeals.reduce((sum, d) => sum + d.price * d.volume, 0) / outVols
          : (isStillOpen ? 0 : weightedEntry);

      const allDeals = [...state.inDeals, ...state.outDeals];
      const totalCommission = allDeals.reduce((sum, d) => sum + (d.commission || 0), 0);
      const totalSwap = allDeals.reduce((sum, d) => sum + (d.swap || 0), 0);
      const totalProfit = allDeals.reduce((sum, d) => sum + (d.profit || 0), 0);

      const inTimes = state.inDeals.map(d => new Date(d.datetime).getTime());
      const outTimes = state.outDeals.map(d => new Date(d.datetime).getTime());

      const entryTime = inTimes.length > 0 ? new Date(Math.min(...inTimes)).toISOString() : (outTimes.length > 0 ? new Date(Math.min(...outTimes)).toISOString() : allDeals[0]?.datetime || '');
      const exitTime = outTimes.length > 0 ? new Date(Math.max(...outTimes)).toISOString() : '';

      return {
        ticket: state.ticket,
        position_id: state.position_id,
        symbol: state.symbol,
        side: state.side,
        total_volume: totalVolume,
        closed_volume: closedVolume,
        remaining_open_volume: remainingOpen,
        entry_datetime: entryTime,
        exit_datetime: exitTime,
        weighted_entry_price: weightedEntry,
        weighted_exit_price: weightedExit,
        total_commission: totalCommission,
        total_swap: totalSwap,
        total_profit: totalProfit,
        deals: allDeals,
        is_partial_close: !isStillOpen && remainingOpen > 0.000001,
        is_still_open: isStillOpen,
      };
    };

    for (let i = 0; i < sortedDeals.length; i++) {
      const deal = sortedDeals[i];
      const semantic = classifyDealDirection(deal);

      if (semantic === 'in') {
        if (!activePos || activePos.openVolume <= 0.000001) {
          activePos = {
            ticket: deal.ticket || deal.position_id || positionKey,
            position_id: deal.position_id || positionKey,
            symbol: deal.symbol,
            side: deal.side,
            inDeals: [deal],
            outDeals: [],
            openVolume: deal.volume,
          };
        } else {
          // Scaling into existing position
          activePos.inDeals.push(deal);
          activePos.openVolume += deal.volume;
        }
      } else if (semantic === 'out') {
        if (!activePos || activePos.openVolume <= 0.000001) {
          // Out deal without preceding in deal in export range
          const syntheticIn: MT5Deal = {
            ...deal,
            entry: 'in',
            type: 'in',
            profit: 0,
            side: deal.side === 'buy' ? 'sell' : 'buy', // opposite side was open
          };
          activePos = {
            ticket: deal.ticket || deal.position_id || positionKey,
            position_id: deal.position_id || positionKey,
            symbol: deal.symbol,
            side: syntheticIn.side,
            inDeals: [syntheticIn],
            outDeals: [deal],
            openVolume: 0,
          };
          closedPositions.push(finalizePos(activePos, false));
          activePos = null;
        } else {
          activePos.outDeals.push(deal);
          activePos.openVolume -= deal.volume;

          if (activePos.openVolume <= 0.000001) {
            // Fully closed
            closedPositions.push(finalizePos(activePos, false));
            activePos = null;
          }
        }
      } else {
        // INOUT semantic handling: reduction, full close, or reversal
        if (!activePos || activePos.openVolume <= 0.000001) {
          // No active position: starts an entry
          activePos = {
            ticket: deal.ticket || deal.position_id || positionKey,
            position_id: deal.position_id || positionKey,
            symbol: deal.symbol,
            side: deal.side,
            inDeals: [deal],
            outDeals: [],
            openVolume: deal.volume,
          };
        } else if (deal.volume <= activePos.openVolume + 0.000001) {
          // Reduction or full close without reversal
          activePos.outDeals.push(deal);
          activePos.openVolume -= deal.volume;

          if (activePos.openVolume <= 0.000001) {
            closedPositions.push(finalizePos(activePos, false));
            activePos = null;
          }
        } else {
          // REVERSAL: deal volume exceeds currently open volume
          const closedVol: number = activePos.openVolume;
          const remainingNewVol: number = deal.volume - closedVol;
          const closeRatio: number = closedVol / deal.volume;
          const openRatio: number = remainingNewVol / deal.volume;

          // 1. Portion that closes the current active position
          const closingDealPart: MT5Deal = {
            ...deal,
            volume: closedVol,
            profit: deal.profit,
            commission: (deal.commission || 0) * closeRatio,
            swap: deal.swap || 0,
            entry: 'out',
            type: 'out',
          };
          activePos.outDeals.push(closingDealPart);
          activePos.openVolume = 0;
          closedPositions.push(finalizePos(activePos, false));

          // 2. Remaining portion opens a new opposite position
          const openingDealPart: MT5Deal = {
            ...deal,
            volume: remainingNewVol,
            profit: 0,
            commission: (deal.commission || 0) * openRatio,
            swap: 0,
            entry: 'in',
            type: 'in',
            side: deal.side,
          };

          activePos = {
            ticket: deal.ticket || deal.position_id || positionKey,
            position_id: deal.position_id || positionKey,
            symbol: deal.symbol,
            side: deal.side,
            inDeals: [openingDealPart],
            outDeals: [],
            openVolume: remainingNewVol,
          };
        }
      }
    }

    // After processing all deals in this position group
    if (activePos && activePos.openVolume > 0.000001) {
      if (activePos.outDeals.length > 0) {
        // Partially closed position:
        // Record the closed portion in closedPositions, and the remaining in openPositions
        closedPositions.push(finalizePos(activePos, false));
        openPositions.push(finalizePos(activePos, true));
      } else {
        // Completely open position (no exit deals)
        openPositions.push(finalizePos(activePos, true));
      }
    }
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
