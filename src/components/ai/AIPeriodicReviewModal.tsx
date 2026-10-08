// ============================================================
// Phase 14 AI Periodic Review Modal (Weekly / Monthly)
// Computes deterministic facts, displays comparisons with previous
// periods, trend detections, actionable priorities, and allows saving to
// existing trading_reviews table with explicit user confirmation.
// ============================================================

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Loading } from '../ui/Loading';
import { requestPeriodicReview } from '../../services/ai/client';
import type { AIReportResponse } from '../../services/ai/types';
import { Sparkles, Calendar, TrendingUp, AlertTriangle, CheckCircle, Shield, Brain, ListChecks, Info } from 'lucide-react';

interface AIPeriodicReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodType: 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  periodTitle?: string;
  accountId?: string;
  phaseId?: string;
  isGuest?: boolean;
  onSaveToTradingReviews?: (report: AIReportResponse) => Promise<void>;
}

export const AIPeriodicReviewModal: React.FC<AIPeriodicReviewModalProps> = ({
  isOpen,
  onClose,
  periodType,
  startDate,
  endDate,
  periodTitle,
  accountId,
  phaseId,
  isGuest = false,
  onSaveToTradingReviews,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<AIReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && startDate && endDate) {
      loadReport();
    } else {
      setReport(null);
      setError(null);
    }
  }, [isOpen, startDate, endDate, periodType, accountId, phaseId]);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await requestPeriodicReview({
        periodType,
        startDate,
        endDate,
        periodTitle,
        accountId,
        phaseId,
        isGuest,
      });
      setReport(data);
    } catch (err: any) {
      setError(err?.message || 'خطا در دریافت گزارش هوشمند دوره');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!report || !onSaveToTradingReviews) return;
    setSaving(true);
    try {
      await onSaveToTradingReviews(report);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'خطا در ذخیره گزارش در بازبینی‌های معاملاتی');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`تحلیل و گزارش هوشمند ${periodType === 'weekly' ? 'هفتگی' : 'ماهانه'} (AI Periodic Review)`}
      size="xl"
    >
      <div className="space-y-6 dir-rtl text-right">
        {loading && (
          <div className="py-6">
            <Loading message="در حال تجمیع آمار قطعی معاملات دوره و مقایسه با دوره قبل..." />
          </div>
        )}

        {error && (
          <div className="bg-red-950/40 border border-red-800 rounded-lg p-4 text-red-200 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">خطا در بارگذاری گزارش:</p>
              <p className="mt-1 text-red-300">{error}</p>
              <Button variant="secondary" size="sm" onClick={loadReport} className="mt-3">
                تلاش مجدد
              </Button>
            </div>
          </div>
        )}

        {report && !loading && (
          <div className="space-y-6">
            {/* Header Title & Period */}
            <div className="bg-gradient-to-l from-indigo-950/40 to-slate-900 border border-indigo-800/40 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-base">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <span>{report.title}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-slate-800/80 px-2.5 py-1 rounded-md">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{report.period}</span>
                </div>
              </div>
              <p className="text-gray-200 text-sm leading-relaxed">{report.summary}</p>
            </div>

            {/* Key Deterministic Metrics */}
            {report.keyMetrics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-center">
                  <span className="text-xs text-gray-400 block mb-1">تعداد معاملات</span>
                  <span className="text-lg font-bold text-gray-100">{report.keyMetrics.totalTrades ?? report.sampleSize}</span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-center">
                  <span className="text-xs text-gray-400 block mb-1">سود/زیان خالص</span>
                  <span className={`text-lg font-bold ${Number(report.keyMetrics.netPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {Number(report.keyMetrics.netPnl || 0) >= 0 ? '+' : ''}{Number(report.keyMetrics.netPnl || 0).toFixed(2)}$
                  </span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-center">
                  <span className="text-xs text-gray-400 block mb-1">نرخ برد (Win Rate)</span>
                  <span className="text-lg font-bold text-blue-400">
                    {report.keyMetrics.winRate !== null && report.keyMetrics.winRate !== undefined
                      ? `${Number(report.keyMetrics.winRate).toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-center">
                  <span className="text-xs text-gray-400 block mb-1">فاکتور سود (PF)</span>
                  <span className="text-lg font-bold text-purple-400">
                    {report.keyMetrics.profitFactor !== null && report.keyMetrics.profitFactor !== undefined
                      ? Number(report.keyMetrics.profitFactor).toFixed(2)
                      : '—'}
                  </span>
                </div>
              </div>
            )}

            {/* Performance Interpretation */}
            {report.performanceInterpretation && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2 text-slate-300 font-medium text-sm">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>تحلیل تخصصی بازدهی و عملکرد دوره</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">{report.performanceInterpretation}</p>
              </div>
            )}

            {/* Comparisons With Previous Period */}
            {report.comparisonWithPrevious && report.comparisonWithPrevious.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3 text-slate-200 font-medium text-sm">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span>مقایسه دقیق با دوره مشابه ماقبل (Trend Detection)</span>
                </div>
                <div className="space-y-2.5">
                  {report.comparisonWithPrevious.map((comp, idx) => (
                    <div key={idx} className="bg-slate-800/40 border border-slate-700/40 p-3 rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-gray-200">{comp.metric}:</span>
                        <span className="text-gray-300 mr-1.5">{comp.currentValue} (دوره فعلی) در برابر {comp.previousValue} (دوره قبل)</span>
                        <p className="text-[11px] text-gray-400 mt-0.5">{comp.interpretation}</p>
                      </div>
                      <div className="text-left shrink-0 font-bold text-indigo-400">
                        تغییر: {comp.change}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Strengths */}
              <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3 text-emerald-400 font-medium text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>رفتارهای مثبت و منضبط دوره</span>
                </div>
                {report.strongBehaviors && report.strongBehaviors.length > 0 ? (
                  <ul className="space-y-2 text-xs text-emerald-200/90">
                    {report.strongBehaviors.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-400">مورد شاخصی گزارش نشد.</p>
                )}
              </div>

              {/* Problems */}
              <div className="bg-amber-950/20 border border-amber-900/50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3 text-amber-400 font-medium text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>اصلی‌ترین چالش‌ها و خطاهای تکراری</span>
                </div>
                {report.biggestProblems && report.biggestProblems.length > 0 ? (
                  <ul className="space-y-2 text-xs text-amber-200/90">
                    {report.biggestProblems.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-400">خطای تکراری بارزی ثبت نشد.</p>
                )}
              </div>
            </div>

            {/* Top 3 Priorities */}
            {report.topPriorities && report.topPriorities.length > 0 && (
              <div className="bg-gradient-to-r from-blue-950/30 to-slate-900 border border-blue-900/40 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3 text-blue-400 font-semibold text-sm">
                  <ListChecks className="w-4 h-4 text-blue-400" />
                  <span>۳ اولویت راهبردی برای دوره آینده (Top 3 Priorities)</span>
                </div>
                <div className="space-y-2">
                  {report.topPriorities.slice(0, 3).map((priority, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-xs text-gray-200">
                      <span className="w-5 h-5 rounded-full bg-blue-900/80 text-blue-300 flex items-center justify-center shrink-0 font-bold text-[11px]">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{priority}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Statistical Limitations */}
            {report.limitations && report.limitations.length > 0 && (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-gray-400 text-xs flex items-center gap-2">
                <Info className="w-4 h-4 text-gray-400 shrink-0" />
                <span>{report.limitations.join(' | ')}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-800">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            بستن
          </Button>
          {report && !loading && onSaveToTradingReviews && (
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{saving ? 'در حال ذخیره...' : 'ذخیره در بازبینی‌های معاملاتی (Save Review)'}</span>
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
