// ============================================================
// Phase 15 — AI Pattern Insights Modal
// Displays structured AI interpretation of detected trading patterns
// with verified evidence, behavioral reflections, and caveats.
// ============================================================

import { useState } from 'react';
import type { AIPatternInsightsResponse } from '../../services/ai/types';
import { useToast } from '../../contexts/ToastContext';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';

interface AIPatternInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  insights: AIPatternInsightsResponse | null;
  isLoading: boolean;
  onRefresh?: () => void;
}

export function AIPatternInsightsModal({
  isOpen,
  onClose,
  insights,
  isLoading,
  onRefresh,
}: AIPatternInsightsModalProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!insights) return;
    const text = [
      '=== تحلیل هوشمند الگوها و بینش‌های معاملاتی ===',
      `خلاصه: ${insights.summary}`,
      '',
      'مزیت‌های آماری:',
      ...insights.confirmedEdges.map(e => `- ${e}`),
      '',
      'نقاط ضعف و نشتی سود:',
      ...insights.performanceLeaks.map(l => `- ${l}`),
      '',
      'تمایلات رفتاری و روانشناسی:',
      ...insights.behavioralTendencies.map(b => `- ${b}`),
      '',
      'اولویت‌های راهبردی:',
      ...insights.actionablePriorities.map((p, idx) => `${idx + 1}. ${p}`),
      '',
      'محدودیت‌های آماری:',
      ...insights.limitations.map(lim => `* ${lim}`),
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('گزارش تحلیلی الگوها در کلیپ‌بورد کپی شد');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تحلیل هوشمند الگوها و بینش‌های معاملاتی (AI Pattern Insights)"
      size="xl"
    >
      <div className="space-y-6 text-sm" dir="rtl">
        {isLoading ? (
          <div className="py-16 text-center space-y-4">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
            <p className="text-gray-600 dark:text-gray-300 font-medium">
              در حال ترکیب محاسبات آماری قطعی و استخراج بینش‌های هوشمند الگوها...
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              بررسی همپوشانی ستاپ‌ها، سشن‌ها، نمادها، روانشناسی و اشتباهات مکرر
            </p>
          </div>
        ) : !insights ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">
            اطلاعات تحلیلی یافت نشد.
          </div>
        ) : (
          <>
            {/* Executive Summary */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-100 dark:border-blue-800/60">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🧭</span>
                <h4 className="font-bold text-gray-900 dark:text-gray-100">
                  خلاصه راهبردی الگوها
                </h4>
              </div>
              <p className="text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                {insights.summary}
              </p>
            </div>

            {/* Confirmed Edges vs Leaks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Confirmed Edges */}
              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold">
                  <span>💎</span>
                  <span>مزیت‌های معاملاتی اثبات‌شده (Edges)</span>
                </div>
                {insights.confirmedEdges.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">موردی ثبت نشده است.</p>
                ) : (
                  <ul className="space-y-2">
                    {insights.confirmedEdges.map((edge, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-800 dark:text-gray-200 text-xs leading-relaxed">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">✓</span>
                        <span>{edge}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Performance Leaks */}
              <div className="p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 space-y-3">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold">
                  <span>🛑</span>
                  <span>نشتی‌های عملکرد و سرمایه (Leaks)</span>
                </div>
                {insights.performanceLeaks.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">نشتی بارزی ثبت نشده است.</p>
                ) : (
                  <ul className="space-y-2">
                    {insights.performanceLeaks.map((leak, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-800 dark:text-gray-200 text-xs leading-relaxed">
                        <span className="text-rose-600 dark:text-rose-400 font-bold mt-0.5">✕</span>
                        <span>{leak}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Behavioral & Psychology Tendencies */}
            {insights.behavioralTendencies.length > 0 && (
              <div className="p-4 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 space-y-2">
                <div className="flex items-center gap-2 text-purple-900 dark:text-purple-300 font-bold">
                  <span>🧠</span>
                  <span>تمایلات روانشناسی و انضباط معامله‌گر</span>
                </div>
                <ul className="space-y-1.5">
                  {insights.behavioralTendencies.map((tend, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-gray-800 dark:text-gray-200 text-xs leading-relaxed">
                      <span className="text-purple-600 dark:text-purple-400 font-bold mt-0.5">●</span>
                      <span>{tend}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actionable Priorities */}
            {insights.actionablePriorities.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-3">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold">
                  <span>🎯</span>
                  <span>اولویت‌های اقدام و بازبینی معامله‌گر</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {insights.actionablePriorities.map((prio, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-800/40 text-xs text-gray-800 dark:text-gray-200 font-medium"
                    >
                      <div className="text-amber-600 dark:text-amber-400 font-bold mb-1">
                        اولویت شماره {idx + 1}
                      </div>
                      {prio}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Limitations & Disclaimer */}
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <div className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <span>🛡️</span>
                <span>سلب مسئولیت و محدودیت‌های آماری</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {insights.limitations.map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
              >
                {copied ? '✓ کپی شد' : '📋 کپی متن کامل گزارش'}
              </button>

              <div className="flex items-center gap-2">
                {onRefresh && (
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    🔄 تحلیل مجدد
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  بستن
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
