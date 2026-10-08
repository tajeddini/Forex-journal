// ============================================================
// Phase 14 AI Auto-Tagging Modal
// Suggests strategies, setups, tags, and mistakes with explicit
// user selection, confirmation, and ZERO autonomous database writes.
// ============================================================

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Loading } from '../ui/Loading';
import { requestAutoTagging } from '../../services/ai/client';
import type { AIAutoTagResponse, AIAutoTagItem } from '../../services/ai/types';
import type { Strategy, Setup, Tag, Mistake } from '../../types/database';
import { Tag as TagIcon, Sparkles, Check, Plus, AlertCircle, CheckCircle } from 'lucide-react';

interface AIAutoTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  tradeId: string;
  isGuest?: boolean;
  existingStrategies: Strategy[];
  existingSetups: Setup[];
  existingTags: Tag[];
  existingMistakes: Mistake[];
  onApplySuggestions: (selected: {
    strategyId?: string;
    setupId?: string;
    tagIds: string[];
    mistakeIds: string[];
    newTagsToCreate?: string[];
    newMistakesToCreate?: string[];
  }) => Promise<void>;
}

export const AIAutoTagModal: React.FC<AIAutoTagModalProps> = ({
  isOpen,
  onClose,
  tradeId,
  isGuest = false,
  existingStrategies,
  existingSetups,
  existingTags,
  existingMistakes,
  onApplySuggestions,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AIAutoTagResponse | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen && tradeId) {
      loadSuggestions();
    } else {
      setResponse(null);
      setSelectedItems({});
      setError(null);
    }
  }, [isOpen, tradeId]);

  const loadSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await requestAutoTagging({ tradeId, isGuest });
      setResponse(data);

      // Pre-select suggestions with confidence >= 80%
      const initialSelection: Record<string, boolean> = {};
      const items = data.structuredSuggestions || [];
      items.forEach((item, idx) => {
        if ((item.confidence ?? 0) >= 80) {
          initialSelection[`item-${idx}`] = true;
        }
      });
      setSelectedItems(initialSelection);
    } catch (err: any) {
      setError(err?.message || 'خطا در واکشی پیشنهادات هوشمند تگ');
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (key: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleApply = async () => {
    if (!response?.structuredSuggestions) return;
    setSaving(true);
    try {
      let strategyId: string | undefined;
      let setupId: string | undefined;
      const tagIds: string[] = [];
      const mistakeIds: string[] = [];
      const newTagsToCreate: string[] = [];
      const newMistakesToCreate: string[] = [];

      response.structuredSuggestions.forEach((item, idx) => {
        if (!selectedItems[`item-${idx}`]) return;

        if (item.type === 'strategy') {
          if (item.id) strategyId = item.id;
        } else if (item.type === 'setup') {
          if (item.id) setupId = item.id;
        } else if (item.type === 'tag') {
          if (item.id) tagIds.push(item.id);
          else newTagsToCreate.push(item.name);
        } else if (item.type === 'mistake') {
          if (item.id) mistakeIds.push(item.id);
          else newMistakesToCreate.push(item.name);
        }
      });

      await onApplySuggestions({
        strategyId,
        setupId,
        tagIds,
        mistakeIds,
        newTagsToCreate,
        newMistakesToCreate,
      });

      onClose();
    } catch (err: any) {
      setError(err?.message || 'خطا در ذخیره برچسب‌های انتخابی');
    } finally {
      setSaving(false);
    }
  };

  const items: AIAutoTagItem[] = response?.structuredSuggestions || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="پیشنهاد هوشمند برچسب‌ها و ستاپ‌ها (AI Auto-Tagging)"
      size="lg"
    >
      <div className="space-y-5 dir-rtl text-right">
        {loading && (
          <div className="py-6">
            <Loading message="در حال بررسی فکت‌های معامله و مقایسه با استراتژی‌ها و تگ‌های موجود..." />
          </div>
        )}

        {error && (
          <div className="bg-red-950/40 border border-red-800 rounded-lg p-4 text-red-200 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">خطا:</p>
              <p className="mt-1 text-red-300">{error}</p>
            </div>
          </div>
        )}

        {!loading && items.length === 0 && !error && (
          <div className="text-center py-8 text-gray-400 text-sm">
            پیشنهادی برای این معامله یافت نشد.
          </div>
        )}

        {!loading && items.length > 0 && (
          <>
            <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-lg p-3 text-xs text-indigo-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                اقلام پیشنهادی را بررسی کنید. تنها مواردی که تیک زده‌اید، پس از تأیید شما بر روی ژورنال اعمال خواهند شد.
              </span>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pl-1">
              {items.map((item, idx) => {
                const key = `item-${idx}`;
                const isSelected = !!selectedItems[key];
                return (
                  <div
                    key={key}
                    onClick={() => toggleItem(key)}
                    className={`flex items-start justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-600/70 shadow-sm'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center mt-0.5 border ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'border-slate-700 bg-slate-800 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-100">{item.name}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              item.isExisting
                                ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/50'
                                : 'bg-amber-950/70 text-amber-300 border border-amber-800/50'
                            }`}
                          >
                            {item.isExisting ? 'موجود در سیستم' : 'پیشنهاد جدید'}
                          </span>
                          <span className="text-[10px] text-gray-400 bg-slate-800 px-2 py-0.5 rounded">
                            {item.type === 'strategy'
                              ? 'استراتژی'
                              : item.type === 'setup'
                              ? 'ستاپ'
                              : item.type === 'mistake'
                              ? 'اشتباه'
                              : 'برچسب'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{item.reason}</p>
                      </div>
                    </div>

                    {item.confidence && (
                      <div className="text-[11px] font-semibold text-indigo-400 bg-indigo-950/60 px-2 py-1 rounded-md shrink-0">
                        {item.confidence}٪ اطمینان
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="flex justify-between items-center pt-3 border-t border-slate-800">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            انصراف
          </Button>
          {!loading && items.length > 0 && (
            <Button
              variant="primary"
              onClick={handleApply}
              disabled={saving || Object.values(selectedItems).every(v => !v)}
              className="flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{saving ? 'در حال اعمال...' : 'تأیید و ذخیره موارد انتخابی'}</span>
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
