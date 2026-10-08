// ============================================================
// Reviews Page — Daily/Weekly/Monthly Trading Reviews
// ============================================================

import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getReviews, createReview, updateReview, deleteReview, getReviewPeriod, computeReviewStats } from '../../services/reviews';
import { getAccounts } from '../../services/accounts';
import { getProfile } from '../../services/profiles';
import { DEFAULT_TIMEZONE, getZonedDateStr } from '../../utils/timezone';
import type { TradingReview, ReviewType, TradingAccount } from '../../types/database';
import { REVIEW_TYPES } from '../../types/database';
import { Card, CardTitle, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency, formatDuration, formatDate } from '../../utils/format';
import { VoiceInput } from '../../components/journal/VoiceInput';
import { AIPeriodicReviewModal } from '../../components/ai/AIPeriodicReviewModal';
import type { AIReportResponse } from '../../services/ai/types';
import { Sparkles } from 'lucide-react';

export default function ReviewsPage() {
  const { user } = useAuth();
  const toast = useToast();
  
  const [reviews, setReviews] = useState<TradingReview[]>([]);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [userTimezone, setUserTimezone] = useState<string>(DEFAULT_TIMEZONE);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<ReviewType | 'all'>('all');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<TradingReview | null>(null);
  const [saving, setSaving] = useState(false);

  // Phase 14 AI Periodic Review Modal state
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiPeriodType, setAiPeriodType] = useState<'weekly' | 'monthly'>('weekly');
  
  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; reviewId: string | null }>({
    isOpen: false,
    reviewId: null,
  });

  // Form state
  const [formData, setFormData] = useState({
    review_type: 'daily' as ReviewType,
    review_date: new Date().toISOString().split('T')[0],
    account_id: '',
    summary: '',
    what_went_well: '',
    what_went_wrong: '',
    main_lesson: '',
    main_mistake: '',
    psychology_notes: '',
    rule_adherence_notes: '',
    improvement_plan: '',
    next_period_plan: '',
  });

  // Fetch reviews and accounts
  useEffect(() => {
    if (user) {
      getReviews(user.id, filterType === 'all' ? undefined : filterType)
        .then(setReviews)
        .catch(() => toast.error('خطا در دریافت بازبینی‌ها'))
        .finally(() => setLoading(false));

      getAccounts(user.id)
        .then(setAccounts)
        .catch(() => {});

      getProfile(user.id)
        .then(p => {
          if (p?.timezone) setUserTimezone(p.timezone);
        })
        .catch(() => {});
    }
  }, [user, filterType]);

  const openCreateModal = () => {
    setEditingReview(null);
    setFormData({
      review_type: 'daily',
      review_date: getZonedDateStr(new Date(), userTimezone),
      account_id: '',
      summary: '',
      what_went_well: '',
      what_went_wrong: '',
      main_lesson: '',
      main_mistake: '',
      psychology_notes: '',
      rule_adherence_notes: '',
      improvement_plan: '',
      next_period_plan: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (review: TradingReview) => {
    setEditingReview(review);
    setFormData({
      review_type: review.review_type,
      review_date: review.review_date,
      account_id: review.account_id || '',
      summary: review.summary || '',
      what_went_well: review.what_went_well || '',
      what_went_wrong: review.what_went_wrong || '',
      main_lesson: review.main_lesson || '',
      main_mistake: review.main_mistake || '',
      psychology_notes: review.psychology_notes || '',
      rule_adherence_notes: review.rule_adherence_notes || '',
      improvement_plan: review.improvement_plan || '',
      next_period_plan: review.next_period_plan || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const date = new Date(formData.review_date);
      const period = getReviewPeriod(formData.review_type, date, userTimezone);
      const periodStart = getZonedDateStr(period.start, userTimezone);
      const periodEnd = getZonedDateStr(period.end, userTimezone);

      // Calculate real statistics strictly without silent zero fallback
      const stats = await computeReviewStats(
        user.id,
        period.start,
        period.end,
        formData.account_id || null,
        null
      );
      
      const reviewData = {
        user_id: user.id,
        review_type: formData.review_type,
        review_date: formData.review_date,
        period_start: periodStart,
        period_end: periodEnd,
        account_id: formData.account_id || null,
        phase_id: null,
        total_trades: stats.total_trades,
        net_pnl: stats.net_pnl,
        win_rate: stats.win_rate,
        profit_factor: stats.profit_factor,
        expectancy: stats.expectancy,
        max_drawdown: null,
        avg_duration: stats.avg_duration,
        summary: formData.summary || null,
        what_went_well: formData.what_went_well || null,
        what_went_wrong: formData.what_went_wrong || null,
        main_lesson: formData.main_lesson || null,
        main_mistake: formData.main_mistake || null,
        psychology_notes: formData.psychology_notes || null,
        rule_adherence_notes: formData.rule_adherence_notes || null,
        improvement_plan: formData.improvement_plan || null,
        next_period_plan: formData.next_period_plan || null,
      };
      
      if (editingReview) {
        await updateReview(editingReview.id, user.id, reviewData);
        toast.success('بازبینی با موفقیت ویرایش شد');
      } else {
        await createReview(reviewData);
        toast.success('بازبینی با موفقیت ایجاد شد');
      }
      
      // Refresh reviews
      const updatedReviews = await getReviews(user.id, filterType === 'all' ? undefined : filterType);
      setReviews(updatedReviews);
      setIsModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ذخیره بازبینی');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !deleteDialog.reviewId) return;
    
    try {
      await deleteReview(deleteDialog.reviewId, user.id);
      toast.success('بازبینی با موفقیت حذف شد');
      
      // Refresh reviews
      const updatedReviews = await getReviews(user.id, filterType === 'all' ? undefined : filterType);
      setReviews(updatedReviews);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در حذف بازبینی');
    } finally {
      setDeleteDialog({ isOpen: false, reviewId: null });
    }
  };

  if (loading) return <Loading message="در حال بارگذاری بازبینی‌ها..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">بازبینی‌های معاملاتی</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            بازبینی روزانه، هفتگی و ماهانه عملکرد
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setAiPeriodType('weekly');
              setIsAIModalOpen(true);
            }}
            className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>گزارش هفتگی هوشمند (AI)</span>
          </Button>

          <Button
            variant="secondary"
            onClick={() => {
              setAiPeriodType('monthly');
              setIsAIModalOpen(true);
            }}
            className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>گزارش ماهانه هوشمند (AI)</span>
          </Button>

          <Button onClick={openCreateModal}>+ بازبینی جدید</Button>
        </div>
      </div>

      {/* Filter */}
      <Card>
        <Select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as ReviewType | 'all')}
          options={[
            { value: 'all', label: 'همه بازبینی‌ها' },
            ...REVIEW_TYPES.map(t => ({ value: t.value, label: t.label })),
          ]}
        />
      </Card>

      {/* Reviews List */}
      {reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map(review => (
            <Card key={review.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {REVIEW_TYPES.find(t => t.value === review.review_type)?.label}
                    </h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(review.review_date)}
                    </span>
                    {review.account_id && (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {accounts.find(a => a.id === review.account_id)?.name || 'حساب'}
                      </span>
                    )}
                  </div>
                  {review.summary && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {review.summary}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openEditModal(review)}>
                    ویرایش
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setDeleteDialog({ isOpen: true, reviewId: review.id })}>
                    حذف
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="هنوز بازبینی‌ای ثبت نشده"
          description="بازبینی‌های روزانه، هفتگی و ماهانه به شما کمک می‌کنند عملکرد خود را بهبود دهید."
          action={<Button onClick={openCreateModal}>ایجاد اولین بازبینی</Button>}
        />
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingReview ? 'ویرایش بازبینی' : 'بازبینی جدید'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="نوع بازبینی"
              value={formData.review_type}
              onChange={(e) => setFormData(prev => ({ ...prev, review_type: e.target.value as ReviewType }))}
              options={REVIEW_TYPES.map(t => ({ value: t.value, label: t.label }))}
            />
            <Input
              label="تاریخ"
              type="date"
              value={formData.review_date}
              onChange={(e) => setFormData(prev => ({ ...prev, review_date: e.target.value }))}
              dir="ltr"
            />
            <Select
              label="حساب معاملاتی"
              value={formData.account_id}
              onChange={(e) => setFormData(prev => ({ ...prev, account_id: e.target.value }))}
              options={[
                { value: '', label: 'همه حساب‌ها / عمومی' },
                ...accounts.map(acc => ({ value: acc.id, label: acc.name })),
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              خلاصه
            </label>
            <div className="relative">
              <textarea
                value={formData.summary}
                onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="خلاصه‌ای از این دوره..."
              />
              <VoiceInput onResult={(text) => setFormData(prev => ({ ...prev, summary: prev.summary + (prev.summary ? ' ' : '') + text }))} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              چه چیزی خوب پیش رفت؟
            </label>
            <div className="relative">
              <textarea
                value={formData.what_went_well}
                onChange={(e) => setFormData(prev => ({ ...prev, what_went_well: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
              <VoiceInput onResult={(text) => setFormData(prev => ({ ...prev, what_went_well: prev.what_went_well + (prev.what_went_well ? ' ' : '') + text }))} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              چه چیزی اشتباه پیش رفت؟
            </label>
            <div className="relative">
              <textarea
                value={formData.what_went_wrong}
                onChange={(e) => setFormData(prev => ({ ...prev, what_went_wrong: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
              <VoiceInput onResult={(text) => setFormData(prev => ({ ...prev, what_went_wrong: prev.what_went_wrong + (prev.what_went_wrong ? ' ' : '') + text }))} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              درس اصلی
            </label>
            <div className="relative">
              <textarea
                value={formData.main_lesson}
                onChange={(e) => setFormData(prev => ({ ...prev, main_lesson: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
              <VoiceInput onResult={(text) => setFormData(prev => ({ ...prev, main_lesson: prev.main_lesson + (prev.main_lesson ? ' ' : '') + text }))} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              یادداشت‌های روانشناسی
            </label>
            <div className="relative">
              <textarea
                value={formData.psychology_notes}
                onChange={(e) => setFormData(prev => ({ ...prev, psychology_notes: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
              <VoiceInput onResult={(text) => setFormData(prev => ({ ...prev, psychology_notes: prev.psychology_notes + (prev.psychology_notes ? ' ' : '') + text }))} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              برنامه دوره بعد
            </label>
            <div className="relative">
              <textarea
                value={formData.next_period_plan}
                onChange={(e) => setFormData(prev => ({ ...prev, next_period_plan: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
              <VoiceInput onResult={(text) => setFormData(prev => ({ ...prev, next_period_plan: prev.next_period_plan + (prev.next_period_plan ? ' ' : '') + text }))} />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={saving}>
              انصراف
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingReview ? 'بروزرسانی' : 'ایجاد'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, reviewId: null })}
        onConfirm={handleDelete}
        title="حذف بازبینی"
        message="آیا مطمئن هستید که می‌خواهید این بازبینی را حذف کنید؟ این عمل قابل بازگشت نیست."
        confirmLabel="حذف"
        variant="danger"
      />

      {/* Phase 14 AI Periodic Review Modal */}
      {user && (
        <AIPeriodicReviewModal
          isOpen={isAIModalOpen}
          onClose={() => setIsAIModalOpen(false)}
          periodType={aiPeriodType}
          startDate={getZonedDateStr(
            getReviewPeriod(aiPeriodType, new Date(), userTimezone).start,
            userTimezone
          )}
          endDate={getZonedDateStr(
            getReviewPeriod(aiPeriodType, new Date(), userTimezone).end,
            userTimezone
          )}
          periodTitle={aiPeriodType === 'weekly' ? 'هفته جاری' : 'ماه جاری'}
          isGuest={user.id === 'guest-demo-user'}
          onSaveToTradingReviews={async (aiReport) => {
            const period = getReviewPeriod(aiPeriodType, new Date(), userTimezone);
            const periodStart = getZonedDateStr(period.start, userTimezone);
            const periodEnd = getZonedDateStr(period.end, userTimezone);

            const stats = await computeReviewStats(
              user.id,
              period.start,
              period.end,
              null,
              null
            );

            await createReview({
              user_id: user.id,
              review_type: aiPeriodType,
              review_date: getZonedDateStr(new Date(), userTimezone),
              period_start: periodStart,
              period_end: periodEnd,
              account_id: null,
              phase_id: null,
              total_trades: stats.total_trades,
              net_pnl: stats.net_pnl,
              win_rate: stats.win_rate,
              profit_factor: stats.profit_factor,
              expectancy: stats.expectancy,
              max_drawdown: null,
              avg_duration: stats.avg_duration,
              summary: aiReport.summary || null,
              what_went_well: aiReport.strongBehaviors?.join('\n• ') || null,
              what_went_wrong: aiReport.biggestProblems?.join('\n• ') || null,
              main_lesson: aiReport.topPriorities?.[0] || null,
              main_mistake: aiReport.repeatedMistakes?.[0] || null,
              psychology_notes: aiReport.psychologyAnalysis?.join('\n') || null,
              rule_adherence_notes: aiReport.riskManagementAnalysis?.join('\n') || null,
              improvement_plan: aiReport.topPriorities?.join('\n') || null,
              next_period_plan: aiReport.recommendations?.join('\n') || null,
            });

            const updatedReviews = await getReviews(user.id, filterType === 'all' ? undefined : filterType);
            setReviews(updatedReviews);
            toast.success('گزارش هوشمند با موفقیت در بازبینی‌های معاملاتی ذخیره گردید');
          }}
        />
      )}
    </div>
  );
}
