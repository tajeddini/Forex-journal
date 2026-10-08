// ============================================================
// Phase 14 AI Trade Review Modal
// Displays structured facts, strengths, improvements, psychology,
// rule adherence, risk analysis, and actionable lessons in Persian RTL.
// ============================================================

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Loading } from '../ui/Loading';
import { requestTradeReview } from '../../services/ai/client';
import type { AITradeReviewResponse } from '../../services/ai/types';
import { Sparkles, CheckCircle2, AlertTriangle, HelpCircle, Shield, Brain, ListChecks, Info } from 'lucide-react';

interface AITradeReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tradeId: string;
  isGuest?: boolean;
}

export const AITradeReviewModal: React.FC<AITradeReviewModalProps> = ({
  isOpen,
  onClose,
  tradeId,
  isGuest = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<AITradeReviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && tradeId) {
      loadReview();
    } else {
      setReview(null);
      setError(null);
    }
  }, [isOpen, tradeId]);

  const loadReview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await requestTradeReview({ tradeId, isGuest });
      setReview(data);
    } catch (err: any) {
      setError(err?.message || 'خطا در برقراری ارتباط با دستیار هوشمند معامله');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تحلیل و بازبینی هوشمند معامله (AI Trade Review)"
      size="xl"
    >
      <div className="space-y-6 dir-rtl text-right">
        {loading && (
          <div className="py-6">
            <Loading message="در حال پردازش داده‌های قطعی معامله و تهیه ارزیابی تخصصی..." />
          </div>
        )}

        {error && (
          <div className="bg-red-950/40 border border-red-800 rounded-lg p-4 text-red-200 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">خطا در دریافت بررسی هوشمند:</p>
              <p className="mt-1 text-red-300">{error}</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={loadReview}
                className="mt-3"
              >
                تلاش مجدد
              </Button>
            </div>
          </div>
        )}

        {review && !loading && (
          <div className="space-y-6">
            {/* Summary Banner */}
            <div className="bg-gradient-to-l from-indigo-950/40 to-slate-900 border border-indigo-800/40 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-indigo-400 font-semibold text-base">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span>خلاصه ارزیابی معامله</span>
              </div>
              <p className="text-gray-200 text-sm leading-relaxed">{review.summary}</p>
            </div>

            {/* Facts and Objective Data */}
            {review.facts && review.facts.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3 text-slate-300 font-medium text-sm">
                  <Info className="w-4 h-4 text-cyan-400" />
                  <span>فکت‌های قطعی ثبت‌شده</span>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-300">
                  {review.facts.map((fact, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Strengths */}
              <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3 text-emerald-400 font-medium text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>نقاط قوت مستند</span>
                </div>
                {review.whatWentWell && review.whatWentWell.length > 0 ? (
                  <ul className="space-y-2 text-xs text-emerald-200/90">
                    {review.whatWentWell.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-400">موردی ثبت نشده است.</p>
                )}
              </div>

              {/* Improvements */}
              <div className="bg-amber-950/20 border border-amber-900/50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3 text-amber-400 font-medium text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>نقاط ضعف و قابل بهبود</span>
                </div>
                {review.whatCouldBeImproved && review.whatCouldBeImproved.length > 0 ? (
                  <ul className="space-y-2 text-xs text-amber-200/90">
                    {review.whatCouldBeImproved.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-400">نقطه ضعف بارزی گزارش نشد.</p>
                )}
              </div>
            </div>

            {/* Rule Adherence & Risk Management */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Rule Adherence */}
              {review.ruleAdherenceAnalysis && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2 text-slate-300 font-medium text-sm">
                    <ListChecks className="w-4 h-4 text-blue-400" />
                    <span>پایبندی به قوانین پلن معاملاتی</span>
                  </div>
                  <div className="inline-block px-2.5 py-1 rounded text-xs font-semibold mb-2 bg-slate-800 text-blue-300">
                    {review.ruleAdherenceAnalysis.status === 'followed'
                      ? 'رعایت کامل قوانین'
                      : review.ruleAdherenceAnalysis.status === 'partially_followed'
                      ? 'رعایت نسبی'
                      : review.ruleAdherenceAnalysis.status === 'violated'
                      ? 'نقض قوانین'
                      : 'تنظیم نشده'}
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {review.ruleAdherenceAnalysis.explanation}
                  </p>
                </div>
              )}

              {/* Risk Management */}
              {review.riskManagementAnalysis && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2 text-slate-300 font-medium text-sm">
                    <Shield className="w-4 h-4 text-indigo-400" />
                    <span>تحلیل مدیریت ریسک و سرمایه</span>
                  </div>
                  {review.riskManagementAnalysis.riskRewardRatio && (
                    <div className="text-xs text-indigo-300 mb-2">
                      نسبت R:R معامله: <span className="font-bold">{review.riskManagementAnalysis.riskRewardRatio}</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {review.riskManagementAnalysis.assessment}
                  </p>
                </div>
              )}
            </div>

            {/* Psychology & Emotions */}
            {review.psychologyAnalysis && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2 text-purple-400 font-medium text-sm">
                  <Brain className="w-4 h-4 text-purple-400" />
                  <span>بررسی روانشناسی و حالات هیجانی</span>
                </div>
                {review.psychologyAnalysis.observedEmotions && review.psychologyAnalysis.observedEmotions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {review.psychologyAnalysis.observedEmotions.map((emo, idx) => (
                      <span key={idx} className="bg-purple-950/60 text-purple-300 border border-purple-800/40 text-xs px-2.5 py-0.5 rounded-full">
                        {emo}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-300 leading-relaxed">
                  {review.psychologyAnalysis.assessment}
                </p>
              </div>
            )}

            {/* Actionable Lessons (Max 3) */}
            {review.actionableLessons && review.actionableLessons.length > 0 && (
              <div className="bg-gradient-to-r from-blue-950/30 to-slate-900 border border-blue-900/40 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3 text-blue-400 font-semibold text-sm">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span>درس‌های عملیاتی برای معاملات آتی (حداکثر ۳ درس)</span>
                </div>
                <div className="space-y-2">
                  {review.actionableLessons.slice(0, 3).map((lesson, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-xs text-gray-200">
                      <span className="w-5 h-5 rounded-full bg-blue-900/80 text-blue-300 flex items-center justify-center shrink-0 font-bold text-[11px]">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{lesson}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Questions for Trader self-reflection */}
            {review.questionsForTrader && review.questionsForTrader.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2 text-slate-300 font-medium text-sm">
                  <HelpCircle className="w-4 h-4 text-amber-400" />
                  <span>سوالات خودارزیابی تریدر</span>
                </div>
                <ul className="space-y-1.5 text-xs text-gray-300">
                  {review.questionsForTrader.map((q, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-400">؟</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Limitations Notice */}
            {review.limitations && review.limitations.length > 0 && (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-gray-400 text-xs flex items-center gap-2">
                <Info className="w-4 h-4 text-gray-400 shrink-0" />
                <span>{review.limitations.join(' | ')}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            بستن
          </Button>
        </div>
      </div>
    </Modal>
  );
};
