import { useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import type { AccountPhase, PhaseType, PhaseStatus } from '../../types/database';
import { PHASE_TYPES, PHASE_STATUSES } from '../../types/database';

interface PhaseFormProps {
  accountId: string;
  initialData?: AccountPhase;
  onSubmit: (data: PhaseFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export interface PhaseFormData {
  account_id: string;
  name: string;
  phase_type: PhaseType;
  status: PhaseStatus;
  starting_balance: number;
  target_balance: number | null;
  maximum_drawdown: number | null;
  daily_drawdown_limit: number | null;
  start_date: string | null;
  end_date: string | null;
}

export function PhaseForm({ accountId, initialData, onSubmit, onCancel, loading }: PhaseFormProps) {
  const [formData, setFormData] = useState<PhaseFormData>({
    account_id: accountId,
    name: initialData?.name || '',
    phase_type: initialData?.phase_type || 'challenge',
    status: initialData?.status || 'active',
    starting_balance: initialData?.starting_balance ?? 0,
    target_balance: initialData?.target_balance ?? null,
    maximum_drawdown: initialData?.maximum_drawdown ?? null,
    daily_drawdown_limit: initialData?.daily_drawdown_limit ?? null,
    start_date: initialData?.start_date ? initialData.start_date.split('T')[0] : null,
    end_date: initialData?.end_date ? initialData.end_date.split('T')[0] : null,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof PhaseFormData, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof PhaseFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'نام فاز الزامی است';
    } else if (formData.name.length > 100) {
      newErrors.name = 'نام فاز نباید بیشتر از ۱۰۰ کاراکتر باشد';
    }

    if (isNaN(formData.starting_balance) || formData.starting_balance < 0) {
      newErrors.starting_balance = 'موجودی شروع باید یک عدد معتبر و غیرمنفی باشد';
    }

    if (formData.target_balance !== null && formData.target_balance < 0) {
      newErrors.target_balance = 'موجودی هدف نباید منفی باشد';
    }

    if (formData.maximum_drawdown !== null && formData.maximum_drawdown < 0) {
      newErrors.maximum_drawdown = 'حداکثر افت سرمایه نباید منفی باشد';
    }

    if (formData.daily_drawdown_limit !== null && formData.daily_drawdown_limit < 0) {
      newErrors.daily_drawdown_limit = 'حد افت سرمایه روزانه نباید منفی باشد';
    }

    if (formData.start_date && formData.end_date) {
      if (new Date(formData.end_date) < new Date(formData.start_date)) {
        newErrors.end_date = 'تاریخ پایان نباید قبل از تاریخ شروع باشد';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(formData);
  };

  const handleChange = (field: keyof PhaseFormData, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="نام فاز *"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          placeholder="مثال: چالش مرحله اول"
          disabled={loading}
        />

        <Select
          label="نوع فاز *"
          value={formData.phase_type}
          onChange={(e) => handleChange('phase_type', e.target.value as PhaseType)}
          options={PHASE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          disabled={loading}
        />
      </div>

      <Select
        label="وضعیت *"
        value={formData.status}
        onChange={(e) => handleChange('status', e.target.value as PhaseStatus)}
        options={PHASE_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
        disabled={loading}
      />

      <Input
        label="موجودی شروع *"
        type="number"
        step="0.01"
        min="0"
        value={formData.starting_balance}
        onChange={(e) => handleChange('starting_balance', parseFloat(e.target.value) || 0)}
        error={errors.starting_balance}
        placeholder="0.00"
        disabled={loading}
        dir="ltr"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="موجودی هدف"
          type="number"
          step="0.01"
          min="0"
          value={formData.target_balance ?? ''}
          onChange={(e) => handleChange('target_balance', e.target.value ? parseFloat(e.target.value) : null)}
          error={errors.target_balance}
          placeholder="اختیاری"
          disabled={loading}
          dir="ltr"
        />

        <Input
          label="حداکثر افت سرمایه"
          type="number"
          step="0.01"
          min="0"
          value={formData.maximum_drawdown ?? ''}
          onChange={(e) => handleChange('maximum_drawdown', e.target.value ? parseFloat(e.target.value) : null)}
          error={errors.maximum_drawdown}
          placeholder="اختیاری"
          disabled={loading}
          dir="ltr"
        />
      </div>

      <Input
        label="حد افت سرمایه روزانه"
        type="number"
        step="0.01"
        min="0"
        value={formData.daily_drawdown_limit ?? ''}
        onChange={(e) => handleChange('daily_drawdown_limit', e.target.value ? parseFloat(e.target.value) : null)}
        error={errors.daily_drawdown_limit}
        placeholder="اختیاری"
        disabled={loading}
        dir="ltr"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="تاریخ شروع"
          type="date"
          value={formData.start_date ?? ''}
          onChange={(e) => handleChange('start_date', e.target.value || null)}
          error={errors.start_date}
          disabled={loading}
          dir="ltr"
        />

        <Input
          label="تاریخ پایان"
          type="date"
          value={formData.end_date ?? ''}
          onChange={(e) => handleChange('end_date', e.target.value || null)}
          error={errors.end_date}
          disabled={loading}
          dir="ltr"
        />
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          انصراف
        </Button>
        <Button type="submit" loading={loading}>
          {initialData ? 'بروزرسانی فاز' : 'ایجاد فاز'}
        </Button>
      </div>
    </form>
  );
}
