import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getMistakes, createMistake, updateMistake, deleteMistake } from '../../services/mistakes';
import type { Mistake } from '../../types/database';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';

export default function MistakesPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMistake, setEditingMistake] = useState<Mistake | null>(null);
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
      loadMistakes();
    }
  }, [user]);

  const loadMistakes = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await getMistakes(user.id);
      setMistakes(data);
    } catch (err) {
      toast.error('خطا در دریافت اشتباهات');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingMistake(null);
    setFormData({ name: '', description: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (mistake: Mistake) => {
    setEditingMistake(mistake);
    setFormData({
      name: mistake.name,
      description: mistake.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formData.name.trim()) {
      toast.error('نام اشتباه الزامی است');
      return;
    }

    try {
      if (editingMistake) {
        await updateMistake(editingMistake.id, user.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
        });
        toast.success('اشتباه با موفقیت ویرایش شد');
      } else {
        await createMistake({
          user_id: user.id,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          is_active: true,
        });
        toast.success('اشتباه با موفقیت ایجاد شد');
      }

      await loadMistakes();
      setIsModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ذخیره اشتباه');
    }
  };

  const handleDelete = async () => {
    if (!user || !deleteDialog.id) return;

    try {
      await deleteMistake(deleteDialog.id, user.id);
      toast.success('اشتباه با موفقیت حذف شد');
      await loadMistakes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در حذف اشتباه');
    } finally {
      setDeleteDialog({ isOpen: false, id: null });
    }
  };

  if (loading) {
    return <Loading message="در حال بارگذاری اشتباهات..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">اشتباهات رایج</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            مدیریت اشتباهات معاملاتی خود برای تحلیل بهتر
          </p>
        </div>
        <Button onClick={openCreateModal}>+ اشتباه جدید</Button>
      </div>

      {/* Mistakes List */}
      {mistakes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mistakes.map((mistake) => (
            <Card key={mistake.id}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {mistake.name}
                  </h3>
                  {mistake.description && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {mistake.description}
                    </p>
                  )}
                </div>
                <Badge variant={mistake.is_active ? 'warning' : 'default'}>
                  {mistake.is_active ? 'فعال' : 'غیرفعال'}
                </Badge>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openEditModal(mistake)}
                >
                  ویرایش
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteDialog({ isOpen: true, id: mistake.id })}
                >
                  حذف
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="هنوز اشتباهی ثبت نشده"
          description="اشتباهات رایج معاملاتی خود را اضافه کنید تا بتوانید آن‌ها را تحلیل کنید."
          action={<Button onClick={openCreateModal}>ایجاد اولین اشتباه</Button>}
        />
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingMistake ? 'ویرایش اشتباه' : 'اشتباه جدید'}
      >
        <div className="space-y-4">
          <Input
            label="نام اشتباه *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="مثال: ورود زودهنگام، جابجایی حد ضرر، FOMO"
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
              placeholder="توضیح مختصری درباره این اشتباه..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              انصراف
            </Button>
            <Button onClick={handleSave}>
              {editingMistake ? 'بروزرسانی' : 'ایجاد'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        title="حذف اشتباه"
        message="آیا مطمئن هستید که می‌خواهید این اشتباه را حذف کنید؟"
        confirmLabel="حذف"
        variant="danger"
      />
    </div>
  );
}
