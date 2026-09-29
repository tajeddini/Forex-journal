import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getStrategies, createStrategy, updateStrategy, deleteStrategy } from '../../services/strategies';
import type { Strategy } from '../../types/database';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';

export default function StrategiesPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string | null }>({
    isOpen: false,
    id: null,
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    if (user) {
      loadStrategies();
    }
  }, [user]);

  const loadStrategies = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await getStrategies(user.id);
      setStrategies(data);
    } catch (err) {
      toast.error('خطا در دریافت استراتژی‌ها');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingStrategy(null);
    setFormData({ name: '', description: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (strategy: Strategy) => {
    setEditingStrategy(strategy);
    setFormData({
      name: strategy.name,
      description: strategy.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formData.name.trim()) {
      toast.error('نام استراتژی الزامی است');
      return;
    }

    try {
      if (editingStrategy) {
        await updateStrategy(editingStrategy.id, user.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
        });
        toast.success('استراتژی با موفقیت ویرایش شد');
      } else {
        await createStrategy({
          user_id: user.id,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          is_active: true,
        });
        toast.success('استراتژی با موفقیت ایجاد شد');
      }

      await loadStrategies();
      setIsModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ذخیره استراتژی');
    }
  };

  const handleDelete = async () => {
    if (!user || !deleteDialog.id) return;

    try {
      await deleteStrategy(deleteDialog.id, user.id);
      toast.success('استراتژی با موفقیت حذف شد');
      await loadStrategies();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در حذف استراتژی');
    } finally {
      setDeleteDialog({ isOpen: false, id: null });
    }
  };

  const toggleActive = async (strategy: Strategy) => {
    if (!user) return;

    try {
      await updateStrategy(strategy.id, user.id, {
        is_active: !strategy.is_active,
      });
      toast.success(strategy.is_active ? 'استراتژی غیرفعال شد' : 'استراتژی فعال شد');
      await loadStrategies();
    } catch (err) {
      toast.error('خطا در تغییر وضعیت');
    }
  };

  if (loading) {
    return <Loading message="در حال بارگذاری استراتژی‌ها..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">استراتژی‌ها</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            مدیریت استراتژی‌های معاملاتی خود
          </p>
        </div>
        <Button onClick={openCreateModal}>+ استراتژی جدید</Button>
      </div>

      {/* Strategies List */}
      {strategies.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategies.map((strategy) => (
            <Card key={strategy.id}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {strategy.name}
                  </h3>
                  {strategy.description && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {strategy.description}
                    </p>
                  )}
                </div>
                <Badge variant={strategy.is_active ? 'success' : 'default'}>
                  {strategy.is_active ? 'فعال' : 'غیرفعال'}
                </Badge>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => toggleActive(strategy)}
                >
                  {strategy.is_active ? 'غیرفعال' : 'فعال'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openEditModal(strategy)}
                >
                  ویرایش
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteDialog({ isOpen: true, id: strategy.id })}
                >
                  حذف
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="هنوز استراتژی‌ای ثبت نشده"
          description="استراتژی‌های معاملاتی خود را اضافه کنید تا بتوانید عملکرد آن‌ها را تحلیل کنید."
          action={<Button onClick={openCreateModal}>ایجاد اولین استراتژی</Button>}
        />
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStrategy ? 'ویرایش استراتژی' : 'استراتژی جدید'}
      >
        <div className="space-y-4">
          <Input
            label="نام استراتژی *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="مثال: Breakout, Pullback, Scalping"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              توضیحات
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="توضیح مختصری درباره این استراتژی..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              انصراف
            </Button>
            <Button onClick={handleSave}>
              {editingStrategy ? 'بروزرسانی' : 'ایجاد'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        title="حذف استراتژی"
        message="آیا مطمئن هستید که می‌خواهید این استراتژی را حذف کنید؟ معاملات مرتبط با این استراتژی بدون استراتژی باقی خواهند ماند."
        confirmLabel="حذف"
        variant="danger"
      />
    </div>
  );
}
