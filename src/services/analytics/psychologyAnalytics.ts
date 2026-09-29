// ============================================================
// Psychology & Behavioral Analytics
// Emotion, confidence, execution quality, rule adherence
// ============================================================

import type { ClassifiedTrade } from './types';
import type {
  EmotionPerformance,
  ConfidencePerformance,
  ExecutionQualityPerformance,
  RuleAdherencePerformance,
} from './types';

/**
 * Calculate metrics for a group of trades
 */
function calculateGroupMetrics(trades: ClassifiedTrade[]) {
  const wins = trades.filter(t => t.result === 'win').length;
  const losses = trades.filter(t => t.result === 'loss').length;
  const netPnl = trades.reduce((sum, t) => sum + t.netPnl, 0);
  const avgPnl = trades.length > 0 ? netPnl / trades.length : null;
  const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : null;
  return { wins, losses, netPnl, averagePnl: avgPnl, winRate };
}

/**
 * Analyze performance by emotion (before/during/after)
 */
export function analyzeByEmotion(
  trades: ClassifiedTrade[],
  emotionField: 'emotion_before' | 'emotion_during' | 'emotion_after'
): EmotionPerformance[] {
  const emotionGroups = new Map<string, ClassifiedTrade[]>();
  
  for (const trade of trades) {
    const emotion = (trade as any).journal?.[emotionField];
    if (emotion) {
      const existing = emotionGroups.get(emotion);
      if (existing) {
        existing.push(trade);
      } else {
        emotionGroups.set(emotion, [trade]);
      }
    }
  }
  
  return Array.from(emotionGroups.entries())
    .map(([emotion, emotionTrades]) => {
      const metrics = calculateGroupMetrics(emotionTrades);
      return {
        emotion,
        trades: emotionTrades.length,
        ...metrics,
      };
    })
    .sort((a, b) => b.trades - a.trades);
}

/**
 * Analyze performance by confidence score (1-10)
 */
export function analyzeByConfidence(trades: ClassifiedTrade[]): ConfidencePerformance[] {
  const confidenceGroups = new Map<number, ClassifiedTrade[]>();
  
  // Initialize all scores
  for (let i = 1; i <= 10; i++) {
    confidenceGroups.set(i, []);
  }
  
  for (const trade of trades) {
    const confidence = (trade as any).journal?.confidence;
    if (confidence !== null && confidence !== undefined) {
      confidenceGroups.get(confidence)!.push(trade);
    }
  }
  
  return Array.from(confidenceGroups.entries())
    .map(([score, confidenceTrades]) => {
      const metrics = calculateGroupMetrics(confidenceTrades);
      return {
        score,
        trades: confidenceTrades.length,
        ...metrics,
      };
    })
    .filter(p => p.trades > 0)
    .sort((a, b) => a.score - b.score);
}

/**
 * Analyze performance by execution quality score (1-10)
 */
export function analyzeByExecutionQuality(trades: ClassifiedTrade[]): ExecutionQualityPerformance[] {
  const qualityGroups = new Map<number, ClassifiedTrade[]>();
  
  // Initialize all scores
  for (let i = 1; i <= 10; i++) {
    qualityGroups.set(i, []);
  }
  
  for (const trade of trades) {
    const quality = (trade as any).journal?.execution_quality;
    if (quality !== null && quality !== undefined) {
      qualityGroups.get(quality)!.push(trade);
    }
  }
  
  return Array.from(qualityGroups.entries())
    .map(([score, qualityTrades]) => {
      const metrics = calculateGroupMetrics(qualityTrades);
      return {
        score,
        trades: qualityTrades.length,
        ...metrics,
      };
    })
    .filter(p => p.trades > 0)
    .sort((a, b) => a.score - b.score);
}

/**
 * Analyze performance by rule adherence
 */
export function analyzeByRuleAdherence(trades: ClassifiedTrade[]): RuleAdherencePerformance[] {
  const adherenceGroups = new Map<string, ClassifiedTrade[]>();
  
  const adherenceLabels: Record<string, string> = {
    followed: 'رعایت شده',
    partially_followed: 'تا حدی رعایت شده',
    violated: 'نقض شده',
    not_set: 'تنظیم نشده',
  };
  
  for (const trade of trades) {
    const adherence = (trade as any).journal?.rule_adherence || 'not_set';
    const existing = adherenceGroups.get(adherence);
    if (existing) {
      existing.push(trade);
    } else {
      adherenceGroups.set(adherence, [trade]);
    }
  }
  
  return Array.from(adherenceGroups.entries())
    .map(([adherence, adherenceTrades]) => {
      const metrics = calculateGroupMetrics(adherenceTrades);
      return {
        adherence,
        label: adherenceLabels[adherence] || adherence,
        trades: adherenceTrades.length,
        ...metrics,
      };
    })
    .sort((a, b) => b.trades - a.trades);
}
