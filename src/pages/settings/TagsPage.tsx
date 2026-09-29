import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getTags, createTag, updateTag, deleteTag } from '../../services/tags';
import type { Tag } from '../../types/database';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';

export default function TagsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string | null }>({
    isOpen: false,
    id: null,
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    color: '#3B82F6',
  });

  useEffect(() => {
    if (user) {
      loadTags();
    }
  }, [user]);

  const loadTags = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await getTags(user.id);
      setTags(data);
    } catch (err) {
      toast.error('خطا در دریافت تگ‌ها');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingTag(null);
    setFormData({ name: '', color: '#3B82F6' });
    setIsModalOpen(true);
  };

  const openEditModal = (tag: Tag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      color: tag.color || '#3B82F6',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formData.name.trim()) {
      toast.error('نام تگ الزامی است');
      return;
    }

    try {
      if (editingTag) {
        await updateTag(editingTag.id, user.id, {
          name: formData.name.trim(),
          color: formData.color,
        });
        toast.success('تگ با موفقیت ویرایش شد');
      } else {
        await createTag({
          user_id: user.id,
          name: formData.name.trim(),
          color: formData.color,
        });
        toast.success('تگ با موفقیت ایجاد شد');
      }

      await loadTags();
      setIsModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ذخیره تگ');
    }
  };

  const handleDelete = async () => {
    if (!user || !deleteDialog.id) return;

    try {
      await deleteTag(deleteDialog.id, user.id);
      toast.success('تگ با موفقیت حذف شد');
      await loadTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در حذف تگ');
    } finally {
      setDeleteDialog({ isOpen: false, id: null });
    }
  };

  if (loading) {
    return <Loading message="در حال بارگذاری تگ‌ها..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">تگ‌ها</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            مدیریت تگ‌های معاملاتی خود
          </p>
        </div>
        <Button onClick={openCreateModal}>+ تگ جدید</Button>
      </div>

      {/* Tags List */}
      {tags.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tags.map((tag) => (
            <Card key={tag.id}>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-8 h-8 rounded-full"
                  style={{ backgroundColor: tag.color || '#3B82F6' }}
                />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex-1">
                  {tag.name}
                </h3>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openEditModal(tag)}
                >
                  ویرایش
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteDialog({ isOpen: true, id: tag.id })}
                >
                  حذف
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="هنوز تگی ثبت نشده"
          description="تگ‌های معاملاتی خود را اضافه کنید."
          action={<Button onClick={openCreateModal}>ایجاد اولین تگ</Button>}
        />
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTag ? 'ویرایش تگ' : 'تگ جدید'}
      >
        <div className="space-y-4">
          <Input
            label="نام تگ *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="مثال: A+, FOMO, News, Revenge"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              رنگ
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-16 h-10 rounded cursor-pointer"
              />
              <Input
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="#3B82F6"
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              انصراف
            </Button>
            <Button onClick={handleSave}>
              {editingTag ? 'بروزرسانی' : 'ایجاد'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        title="حذف تگ"
        message="آیا مطمئن هستید که می‌خواهید این تگ را حذف کنید؟"
        confirmLabel="حذف"
        variant="danger"
      />
    </div>
  );
}
