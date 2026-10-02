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

export type MT5DealType = 'in' | 'out' | 'inout' | 'out_by';

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
  entry?: MT5DealType | string; // MT5 standard column: 'in', 'out', 'inout', 'out_by'
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
  close_by_position_id?: string;
}

export interface MT5AggregationResult {
  closedPositions: AggregatedPosition[];
  openPositions: AggregatedPosition[];
}

/**
 * Classify whether a deal is an entry ('in'), exit ('out'), reversal ('inout'), or close-by ('out_by')
 * IMPORTANT: Direction ('buy'/'sell') does NOT equal entry/exit!
 * Closing a short position is deal side 'buy' with entry 'out'!
 */
export function classifyDealDirection(deal: MT5Deal): 'in' | 'out' | 'inout' | 'out_by' {
  const rawEntry = (deal.entry || deal.type || '').toLowerCase().trim();

  // Explicit MT5 Entry field ('in', 'out', 'inout', 'out_by')
  if (rawEntry === 'in' || rawEntry === 'entry' || rawEntry === 'deal_entry_in') {
    return 'in';
  }
  if (rawEntry === 'out' || rawEntry === 'exit' || rawEntry === 'deal_entry_out') {
    return 'out';
  }
  if (rawEntry === 'inout' || rawEntry === 'in/out' || rawEntry === 'deal_entry_inout') {
    return 'inout';
  }
  if (
    rawEntry === 'out_by' ||
    rawEntry === 'out by' ||
    rawEntry === 'outby' ||
    rawEntry === 'deal_entry_out_by' ||
    rawEntry === 'close by'
  ) {
    return 'out_by';
  }

  // Fallback inference from comment / profit if entry column was omitted
  if (deal.comment && /close by/i.test(deal.comment)) {
    return 'out_by';
  }

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
      close_by_position_id?: string;
    }

    let activePos: ActivePosState | null = null;

    const finalizePos = (state: ActivePosState, isStillOpen: boolean): AggregatedPosition => {
      const inVols = state.inDeals.reduce((sum, d) => sum + d.volume, 0);
      const outVols = state.outDeals.reduce((sum, d) => sum + d.volume, 0);
      const totalVolume = inVols > 0 ? inVols : outVols;
      const closedVolume = isStillOpen ? 0 : (outVols > 0 ? Math.min(totalVolume, outVols) : 0);
      const remainingOpen = Math.max(0, state.openVolume !== undefined ? state.openVolume : totalVolume - outVols);

      const weightedEntry =
        inVols > 0
          ? state.inDeals.reduce((sum, d) => sum + d.price * d.volume, 0) / inVols
          : (state.inDeals[0]?.price || state.outDeals[0]?.price || 0);

      const weightedExit =
        isStillOpen
          ? 0
          : (outVols > 0
              ? state.outDeals.reduce((sum, d) => sum + d.price * d.volume, 0) / outVols
              : weightedEntry);

      const allDeals = isStillOpen ? [...state.inDeals] : [...state.inDeals, ...state.outDeals];
      const totalCommission = isStillOpen
        ? state.inDeals.reduce((sum, d) => sum + (d.commission || 0), 0)
        : allDeals.reduce((sum, d) => sum + (d.commission || 0), 0);
      const totalSwap = isStillOpen ? 0 : allDeals.reduce((sum, d) => sum + (d.swap || 0), 0);
      const totalProfit = isStillOpen ? 0 : allDeals.reduce((sum, d) => sum + (d.profit || 0), 0);

      const inTimes = state.inDeals.map(d => new Date(d.datetime).getTime());
      const outTimes = isStillOpen ? [] : state.outDeals.map(d => new Date(d.datetime).getTime());

      const entryTime = inTimes.length > 0 ? new Date(Math.min(...inTimes)).toISOString() : (outTimes.length > 0 ? new Date(Math.min(...outTimes)).toISOString() : allDeals[0]?.datetime || '');
      const exitTime = (!isStillOpen && outTimes.length > 0) ? new Date(Math.max(...outTimes)).toISOString() : '';

      return {
        ticket: state.ticket,
        position_id: state.position_id,
        symbol: state.symbol,
        side: state.side,
        total_volume: isStillOpen ? remainingOpen : totalVolume,
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
        close_by_position_id: isStillOpen ? undefined : state.close_by_position_id,
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
      } else if (semantic === 'out' || semantic === 'out_by') {
        const closeByMatch = deal.comment?.match(/close\s+by\s+#?(\w+)/i);
        const closeByOtherId = closeByMatch ? closeByMatch[1] : undefined;

        if (semantic === 'out_by' && closeByOtherId) {
          if (activePos) {
            activePos.close_by_position_id = closeByOtherId;
          }
          // Cross-position linking: If counterpart position exists in export and has no exit deals, synthesize its exit
          if (positionGroups.has(closeByOtherId)) {
            const counterpartDeals = positionGroups.get(closeByOtherId)!;
            const hasExit = counterpartDeals.some(d => {
              const s = classifyDealDirection(d);
              return s === 'out' || s === 'out_by';
            });
            if (!hasExit && counterpartDeals.length > 0) {
              const targetEntryDeal = counterpartDeals[0];
              const syntheticCounterpart: MT5Deal = {
                position_id: closeByOtherId,
                ticket: targetEntryDeal.ticket || closeByOtherId,
                symbol: deal.symbol,
                side: targetEntryDeal.side === 'buy' ? 'sell' : 'buy',
                volume: Math.min(targetEntryDeal.volume, deal.volume),
                price: deal.price,
                datetime: deal.datetime,
                commission: 0,
                swap: 0,
                profit: 0,
                entry: 'out_by',
                type: 'out_by',
                comment: `close by #${positionKey}`,
              };
              counterpartDeals.push(syntheticCounterpart);
            }
          }
        }

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
            close_by_position_id: closeByOtherId,
          };
          closedPositions.push(finalizePos(activePos, false));
          activePos = null;
        } else {
          activePos.outDeals.push(deal);
          activePos.openVolume -= deal.volume;
          if (closeByOtherId) {
            activePos.close_by_position_id = closeByOtherId;
          }

          if (activePos.openVolume <= 0.000001) {
            // Fully closed
            closedPositions.push(finalizePos(activePos, false));
            activePos = null;
          }
        }
      } else {
        // INOUT semantic handling: reversal event
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
        } else {
          const isSmaller = deal.volume < activePos.openVolume - 0.000001;
          const isEqual = Math.abs(deal.volume - activePos.openVolume) <= 0.000001;

          if (isSmaller) {
            // Smaller volume (e.g. BUY 1.00, INOUT SELL 0.40):
            // Closes 0.40 of BUY, keeps 0.60 BUY open, and opens new SELL 0.40
            const closedVol: number = deal.volume;
            const remainingOldVol: number = activePos.openVolume - closedVol;

            const closingDealPart: MT5Deal = {
              ...deal,
              volume: closedVol,
              profit: deal.profit,
              commission: deal.commission ? deal.commission * 0.5 : 0,
              swap: deal.swap || 0,
              entry: 'out',
              type: 'out',
            };

            // Finalize the closed 0.40 portion
            closedPositions.push(finalizePos({
              ticket: activePos.ticket,
              position_id: activePos.position_id,
              symbol: activePos.symbol,
              side: activePos.side,
              inDeals: activePos.inDeals.map(d => ({ ...d, volume: closedVol })),
              outDeals: [closingDealPart],
              openVolume: 0,
            }, false));

            // Record remaining 0.60 of the original position as open
            openPositions.push(finalizePos({
              ticket: activePos.ticket,
              position_id: activePos.position_id,
              symbol: activePos.symbol,
              side: activePos.side,
              inDeals: activePos.inDeals.map(d => ({ ...d, volume: remainingOldVol })),
              outDeals: [],
              openVolume: remainingOldVol,
            }, true));

            // Open new opposite position with unique identity
            const newPosId = `${positionKey}_rev_${deal.deal_id || i}`;
            const openingDealPart: MT5Deal = {
              ...deal,
              volume: deal.volume,
              profit: 0,
              commission: deal.commission ? deal.commission * 0.5 : 0,
              swap: 0,
              entry: 'in',
              type: 'in',
              side: deal.side,
              position_id: newPosId,
              ticket: `${deal.ticket || deal.deal_id || positionKey}_rev`,
            };

            activePos = {
              ticket: openingDealPart.ticket!,
              position_id: newPosId,
              symbol: deal.symbol,
              side: deal.side,
              inDeals: [openingDealPart],
              outDeals: [],
              openVolume: deal.volume,
            };
          } else if (isEqual) {
            // Equal volume (e.g. BUY 1.00, INOUT SELL 1.00):
            // Closes existing position completely
            const closedVol: number = activePos.openVolume;
            const closingDealPart: MT5Deal = {
              ...deal,
              volume: closedVol,
              profit: deal.profit,
              commission: deal.commission || 0,
              swap: deal.swap || 0,
              entry: 'out',
              type: 'out',
            };
            activePos.outDeals.push(closingDealPart);
            activePos.openVolume = 0;
            closedPositions.push(finalizePos(activePos, false));
            activePos = null;
          } else {
            // Larger volume (e.g. BUY 1.00, INOUT SELL 1.50):
            // Closes existing BUY 1.00 completely and opens new SELL 0.50
            const closedVol: number = activePos.openVolume;
            const remainingNewVol: number = deal.volume - closedVol;
            const closeRatio: number = closedVol / deal.volume;
            const openRatio: number = remainingNewVol / deal.volume;

            // 1. Portion that closes current active position
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

            // 2. Remaining portion opens new opposite position with unique identity
            const newPosId = `${positionKey}_rev_${deal.deal_id || i}`;
            const openingDealPart: MT5Deal = {
              ...deal,
              volume: remainingNewVol,
              profit: 0,
              commission: (deal.commission || 0) * openRatio,
              swap: 0,
              entry: 'in',
              type: 'in',
              side: deal.side,
              position_id: newPosId,
              ticket: `${deal.ticket || deal.deal_id || positionKey}_rev`,
            };

            activePos = {
              ticket: openingDealPart.ticket!,
              position_id: newPosId,
              symbol: deal.symbol,
              side: deal.side,
              inDeals: [openingDealPart],
              outDeals: [],
              openVolume: remainingNewVol,
            };
          }
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
  const hasOutBy = position.deals.some(d => d.entry === 'out_by');
  const rawComment = position.deals.find(d => d.comment)?.comment || null;
  let comment = rawComment;
  if (hasOutBy) {
    if (position.close_by_position_id && (!rawComment || !rawComment.toLowerCase().includes('close by'))) {
      comment = rawComment ? `[Close By #${position.close_by_position_id}] ${rawComment}` : `[Close By #${position.close_by_position_id}]`;
    } else if (!rawComment) {
      comment = '[Close By]';
    }
  }

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
    comment,
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
