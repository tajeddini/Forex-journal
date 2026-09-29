// ============================================================
// AI Context Builder
// Builds sanitized, minimal context for AI processing
// ============================================================

import type { AIContext } from './types';
import type { Trade, TradingAccount, AccountPhase } from '../../types/database';

interface ContextBuilderOptions {
  userId: string;
  accountId?: string;
  phaseId?: string;
  includeTrades?: boolean;
  maxTrades?: number;
  dateRange?: { start: string; end: string };
}

/**
 * Build AI context from trading data
 * Respects privacy and minimizes data exposure
 */
export async function buildAIContext(
  options: ContextBuilderOptions,
  trades: Trade[],
  accounts: TradingAccount[],
  phases: AccountPhase[],
  metrics: Record<string, any>
): Promise<AIContext> {
  const {
    userId,
    accountId,
    phaseId,
    includeTrades = false,
    maxTrades = 50,
    dateRange,
  } = options;

  // Filter trades by account/phase if specified
  let filteredTrades = trades.filter(t => t.user_id === userId);
  
  if (accountId) {
    filteredTrades = filteredTrades.filter(t => t.account_id === accountId);
  }
  
  if (phaseId) {
    filteredTrades = filteredTrades.filter(t => t.phase_id === phaseId);
  }

  if (dateRange) {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    filteredTrades = filteredTrades.filter(t => {
      const tradeDate = new Date(t.entry_datetime);
      return tradeDate >= start && tradeDate <= end;
    });
  }

  // Build sanitized trade data (only if requested)
  const sanitizedTrades = includeTrades
    ? filteredTrades.slice(0, maxTrades).map(sanitizeTrade)
    : undefined;

  // Build context
  const context: AIContext = {
    userId,
    accountId,
    phaseId,
    period: dateRange,
    sampleSize: filteredTrades.length,
    metrics,
    trades: sanitizedTrades,
  };

  // Add breakdowns if available
  if (metrics.breakdowns) {
    context.breakdowns = metrics.breakdowns;
  }

  return context;
}

/**
 * Sanitize trade data for AI consumption
 * Removes sensitive/internal fields
 */
function sanitizeTrade(trade: Trade): Record<string, any> {
  return {
    // Keep only essential fields
    symbol: trade.symbol,
    side: trade.side,
    volume: trade.volume,
    entry_datetime: trade.entry_datetime,
    exit_datetime: trade.exit_datetime,
    entry_price: trade.entry_price,
    exit_price: trade.exit_price,
    profit: trade.profit,
    commission: trade.commission,
    swap: trade.swap,
    duration_seconds: trade.duration_seconds,
    
    // Include journal fields if available (sanitized)
    // Note: These should be treated as untrusted user data
    comment: trade.comment ? sanitizeUserText(trade.comment) : null,
  };
}

/**
 * Sanitize user-generated text to prevent prompt injection
 * This is a basic sanitization - more advanced techniques may be needed
 */
function sanitizeUserText(text: string): string {
  // Remove common prompt injection patterns
  const sanitized = text
    .replace(/ignore previous instructions/gi, '[FILTERED]')
    .replace(/you are now/gi, '[FILTERED]')
    .replace(/system prompt/gi, '[FILTERED]')
    .replace(/act as/gi, '[FILTERED]')
    .replace(/reveal.*database/gi, '[FILTERED]')
    .replace(/show.*sql/gi, '[FILTERED]');

  return sanitized;
}

/**
 * Build minimal context for query operations
 */
export function buildQueryContext(
  userId: string,
  metrics: Record<string, any>,
  sampleSize: number,
  period?: { start: string; end: string }
): AIContext {
  return {
    userId,
    sampleSize,
    metrics,
    period,
  };
}

/**
 * Build context for trade review
 */
export function buildTradeReviewContext(
  trade: Trade,
  journal?: any,
  historicalMetrics?: Record<string, any>
): AIContext {
  const sanitizedTrade = sanitizeTrade(trade);
  
  return {
    userId: trade.user_id,
    sampleSize: 1,
    metrics: {
      trade: sanitizedTrade,
      journal: journal ? sanitizeJournalData(journal) : null,
      historical: historicalMetrics || {},
    },
  };
}

/**
 * Sanitize journal data for AI
 */
function sanitizeJournalData(journal: any): Record<string, any> {
  const sanitized: Record<string, any> = {};

  // Keep structured fields
  if (journal.strategy_id) sanitized.strategy_id = journal.strategy_id;
  if (journal.setup_id) sanitized.setup_id = journal.setup_id;
  if (journal.confidence) sanitized.confidence = journal.confidence;
  if (journal.execution_quality) sanitized.execution_quality = journal.execution_quality;
  if (journal.rule_adherence) sanitized.rule_adherence = journal.rule_adherence;
  if (journal.emotion_before) sanitized.emotion_before = journal.emotion_before;
  if (journal.emotion_during) sanitized.emotion_during = journal.emotion_during;
  if (journal.emotion_after) sanitized.emotion_after = journal.emotion_after;

  // Sanitize text fields
  const textFields = [
    'market_context',
    'entry_reason',
    'expected_scenario',
    'what_went_well',
    'what_went_wrong',
    'lesson_learned',
    'post_trade_notes',
  ];

  for (const field of textFields) {
    if (journal[field]) {
      sanitized[field] = sanitizeUserText(journal[field]);
    }
  }

  return sanitized;
}

/**
 * Estimate context size (rough token count)
 */
export function estimateContextSize(context: AIContext): number {
  const jsonStr = JSON.stringify(context);
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(jsonStr.length / 4);
}

/**
 * Check if context is within size limits
 */
export function isContextWithinLimits(context: AIContext, maxTokens: number = 4000): boolean {
  const estimatedTokens = estimateContextSize(context);
  return estimatedTokens <= maxTokens;
}

/**
 * Truncate context to fit within limits
 */
export function truncateContext(context: AIContext, maxTokens: number = 4000): AIContext {
  const estimatedTokens = estimateContextSize(context);
  
  if (estimatedTokens <= maxTokens) {
    return context;
  }

  // Create a copy to avoid mutating original
  const truncated = { ...context };

  // Remove trades first (largest data)
  if (truncated.trades && truncated.trades.length > 0) {
    truncated.trades = truncated.trades.slice(0, 10);
    
    if (estimateContextSize(truncated) <= maxTokens) {
      return truncated;
    }
  }

  // Remove breakdowns if still too large
  if (truncated.breakdowns) {
    delete truncated.breakdowns;
    
    if (estimateContextSize(truncated) <= maxTokens) {
      return truncated;
    }
  }

  // Simplify metrics if still too large
  if (truncated.metrics) {
    const essentialMetrics = ['totalTrades', 'winRate', 'netPnl', 'profitFactor'];
    const simplifiedMetrics: Record<string, any> = {};
    
    for (const key of essentialMetrics) {
      if (truncated.metrics[key] !== undefined) {
        simplifiedMetrics[key] = truncated.metrics[key];
      }
    }
    
    truncated.metrics = simplifiedMetrics;
  }

  return truncated;
}
