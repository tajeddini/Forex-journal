import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getSetups, createSetup, updateSetup, deleteSetup } from '../../services/setups';
import { getStrategies } from '../../services/strategies';
import type { Setup, Strategy } from '../../types/database';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';

export default function SetupsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [setups, setSetups] = useState<Setup[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSetup, setEditingSetup] = useState<Setup | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string | null }>({
    isOpen: false,
    id: null,
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    strategy_id: '',
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [setupsData, strategiesData] = await Promise.all([
        getSetups(user.id),
        getStrategies(user.id),
      ]);
      setSetups(setupsData);
      setStrategies(strategiesData);
    } catch (err) {
      toast.error('خطا در دریافت داده‌ها');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingSetup(null);
    setFormData({ name: '', description: '', strategy_id: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (setup: Setup) => {
    setEditingSetup(setup);
    setFormData({
      name: setup.name,
      description: setup.description || '',
      strategy_id: setup.strategy_id || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formData.name.trim()) {
      toast.error('نام ستاپ الزامی است');
      return;
    }

    try {
      if (editingSetup) {
        await updateSetup(editingSetup.id, user.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          strategy_id: formData.strategy_id || null,
        });
        toast.success('ستاپ با موفقیت ویرایش شد');
      } else {
        await createSetup({
          user_id: user.id,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          strategy_id: formData.strategy_id || null,
          is_active: true,
        });
        toast.success('ستاپ با موفقیت ایجاد شد');
      }

      await loadData();
      setIsModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ذخیره ستاپ');
    }
  };

  const handleDelete = async () => {
    if (!user || !deleteDialog.id) return;

    try {
      await deleteSetup(deleteDialog.id, user.id);
      toast.success('ستاپ با موفقیت حذف شد');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در حذف ستاپ');
    } finally {
      setDeleteDialog({ isOpen: false, id: null });
    }
  };

  const getStrategyName = (strategyId: string | null) => {
    if (!strategyId) return null;
    const strategy = strategies.find(s => s.id === strategyId);
    return strategy?.name || null;
  };

  if (loading) {
    return <Loading message="در حال بارگذاری ستاپ‌ها..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ستاپ‌ها</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            مدیریت ستاپ‌های معاملاتی خود
          </p>
        </div>
        <Button onClick={openCreateModal}>+ ستاپ جدید</Button>
      </div>

      {/* Setups List */}
      {setups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {setups.map((setup) => (
            <Card key={setup.id}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {setup.name}
                  </h3>
                  {setup.description && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {setup.description}
                    </p>
                  )}
                  {setup.strategy_id && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      استراتژی: {getStrategyName(setup.strategy_id)}
                    </p>
                  )}
                </div>
                <Badge variant={setup.is_active ? 'success' : 'default'}>
                  {setup.is_active ? 'فعال' : 'غیرفعال'}
                </Badge>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openEditModal(setup)}
                >
                  ویرایش
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteDialog({ isOpen: true, id: setup.id })}
                >
                  حذف
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="هنوز ستاپی ثبت نشده"
          description="ستاپ‌های معاملاتی خود را اضافه کنید."
          action={<Button onClick={openCreateModal}>ایجاد اولین ستاپ</Button>}
        />
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSetup ? 'ویرایش ستاپ' : 'ستاپ جدید'}
      >
        <div className="space-y-4">
          <Input
            label="نام ستاپ *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="مثال: شکست مقاومت، پولبک به EMA"
          />
          <Select
            label="استراتژی (اختیاری)"
            value={formData.strategy_id}
            onChange={(e) => setFormData({ ...formData, strategy_id: e.target.value })}
            options={[
              { value: '', label: 'بدون استراتژی' },
              ...strategies.map(s => ({ value: s.id, label: s.name })),
            ]}
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
              placeholder="توضیح مختصری درباره این ستاپ..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              انصراف
            </Button>
            <Button onClick={handleSave}>
              {editingSetup ? 'بروزرسانی' : 'ایجاد'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        title="حذف ستاپ"
        message="آیا مطمئن هستید که می‌خواهید این ستاپ را حذف کنید؟"
        confirmLabel="حذف"
        variant="danger"
      />
    </div>
  );
}
