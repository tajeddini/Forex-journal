// ============================================================
// Phase 15 — Trading Pattern Card Component
// Displays statistical evidence, reliability indicators, and
// objective observations in Persian RTL.
// ============================================================

import { useState } from 'react';
import type { TradingPattern } from '../../services/analytics/patterns';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { formatCurrency, formatNumber } from '../../utils/format';

interface PatternCardProps {
  pattern: TradingPattern;
  currency?: string;
}

export function PatternCard({ pattern, currency = 'USD' }: PatternCardProps) {
  const [showTrades, setShowTrades] = useState(false);

  const getImpactBadge = () => {
    switch (pattern.impact) {
      case 'strength':
        return <Badge variant="success">مزیت معاملاتی (Edge)</Badge>;
      case 'weakness':
        return <Badge variant="danger">نقطه ضعف / نشت سود</Badge>;
      default:
        return <Badge variant="default">مشاهده آماری</Badge>;
    }
  };

  const getReliabilityBadge = () => {
    switch (pattern.reliability) {
      case 'high_confidence':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <span>●</span> اطمینان آماری معتبر ({pattern.sampleSize} معامله)
          </span>
        );
      case 'moderate_confidence':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <span>◐</span> نمونه متوسط ({pattern.sampleSize} معامله)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <span>⚠️</span> نمونه کم ({pattern.sampleSize} معامله - غیرقطعی)
          </span>
        );
    }
  };

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${
      pattern.impact === 'strength'
        ? 'border-r-4 border-r-emerald-500'
        : pattern.impact === 'weakness'
        ? 'border-r-4 border-r-red-500'
        : 'border-r-4 border-r-blue-400'
    }`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            {pattern.categoryLabel}
          </span>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {pattern.title}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {getImpactBadge()}
          {getReliabilityBadge()}
        </div>
      </div>

      {/* Description & Observation */}
      <div className="py-3 space-y-2">
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          {pattern.description}
        </p>
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/60 text-sm font-medium text-gray-800 dark:text-gray-200">
          💡 {pattern.analyticalObservation}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-t border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 -mx-6 px-6">
        <div>
          <span className="text-xs text-gray-500 dark:text-gray-400 block">حجم نمونه / سهم</span>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100" dir="ltr">
            {pattern.sampleSize} ({pattern.samplePercentage}%)
          </span>
        </div>

        <div>
          <span className="text-xs text-gray-500 dark:text-gray-400 block">نرخ برد و انحراف</span>
          <div className="flex items-baseline gap-1" dir="ltr">
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {pattern.winRate !== null ? `${pattern.winRate}%` : 'N/A'}
            </span>
            {pattern.winRateDelta !== null && (
              <span className={`text-xs font-semibold ${
                pattern.winRateDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              }`}>
                ({pattern.winRateDelta >= 0 ? '+' : ''}{pattern.winRateDelta}%)
              </span>
            )}
          </div>
        </div>

        <div>
          <span className="text-xs text-gray-500 dark:text-gray-400 block">سود/زیان خالص کل</span>
          <span className={`text-sm font-bold ${
            pattern.totalPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
          }`} dir="ltr">
            {formatCurrency(pattern.totalPnl, currency)}
          </span>
        </div>

        <div>
          <span className="text-xs text-gray-500 dark:text-gray-400 block">ضریب سود / نسبت R</span>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100" dir="ltr">
            {pattern.profitFactor !== null ? `PF: ${pattern.profitFactor}` : ''}
            {pattern.profitFactor !== null && pattern.averageR !== null ? ' | ' : ''}
            {pattern.averageR !== null ? `R: ${pattern.averageR}` : (!pattern.profitFactor ? 'N/A' : '')}
          </span>
        </div>
      </div>

      {/* Statistical Caveat & Disclaimer */}
      <div className="pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-gray-500 dark:text-gray-400 italic flex-1">
          🛡️ {pattern.disclaimer}
        </p>

        {pattern.tradeIds.length > 0 && (
          <button
            onClick={() => setShowTrades(!showTrades)}
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-xs whitespace-nowrap"
          >
            {showTrades ? 'بستن لیست شناسه معاملات' : `مشاهده ${pattern.tradeIds.length} معامله زیرمجموعه`}
          </button>
        )}
      </div>

      {/* Expanded Trade IDs */}
      {showTrades && pattern.tradeIds.length > 0 && (
        <div className="mt-3 p-2.5 rounded bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400 max-h-28 overflow-y-auto font-mono">
          <div className="font-sans font-medium text-gray-700 dark:text-gray-300 mb-1">
            شناسه‌های معامله در این نمونه:
          </div>
          <div className="flex flex-wrap gap-1.5" dir="ltr">
            {pattern.tradeIds.map(id => (
              <span key={id} className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-[10px]">
                {id}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
