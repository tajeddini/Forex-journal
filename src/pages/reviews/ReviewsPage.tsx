// ============================================================
// Reviews Page — Daily/Weekly/Monthly Trading Reviews
// ============================================================

import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getReviews, createReview, updateReview, deleteReview, getReviewPeriod } from '../../services/reviews';
import type { TradingReview, ReviewType } from '../../types/database';
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

export default function ReviewsPage() {
  const { user } = useAuth();
  const toast = useToast();
  
  const [reviews, setReviews] = useState<TradingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<ReviewType | 'all'>('all');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<TradingReview | null>(null);
  const [saving, setSaving] = useState(false);
  
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

  // Fetch reviews
  useEffect(() => {
    if (user) {
      getReviews(user.id, filterType === 'all' ? undefined : filterType)
        .then(setReviews)
        .catch(() => toast.error('خطا در دریافت بازبینی‌ها'))
        .finally(() => setLoading(false));
    }
  }, [user, filterType]);

  const openCreateModal = () => {
    setEditingReview(null);
    setFormData({
      review_type: 'daily',
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
      const period = getReviewPeriod(formData.review_type, date);
      
      const reviewData = {
        user_id: user.id,
        review_type: formData.review_type,
        review_date: formData.review_date,
        period_start: period.start.toISOString().split('T')[0],
        period_end: period.end.toISOString().split('T')[0],
        account_id: formData.account_id || null,
        phase_id: null,
        total_trades: 0,
        net_pnl: 0,
        win_rate: null,
        profit_factor: null,
        expectancy: null,
        max_drawdown: null,
        avg_duration: null,
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
        <Button onClick={openCreateModal}>+ بازبینی جدید</Button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    </div>
  );
}
