import { useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import type { TradingAccount, AccountStatus } from '../../types/database';
import { ACCOUNT_STATUSES, CURRENCIES } from '../../types/database';

interface AccountFormProps {
  initialData?: TradingAccount;
  onSubmit: (data: AccountFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export interface AccountFormData {
  name: string;
  broker: string;
  platform: string;
  account_number_label: string;
  currency: string;
  initial_balance: number;
  current_balance: number;
  status: AccountStatus;
  notes: string;
}

export function AccountForm({ initialData, onSubmit, onCancel, loading }: AccountFormProps) {
  const [formData, setFormData] = useState<AccountFormData>({
    name: initialData?.name || '',
    broker: initialData?.broker || '',
    platform: initialData?.platform || '',
    account_number_label: initialData?.account_number_label || '',
    currency: initialData?.currency || 'USD',
    initial_balance: initialData?.initial_balance || 0,
    current_balance: initialData?.current_balance || initialData?.initial_balance || 0,
    status: initialData?.status || 'active',
    notes: initialData?.notes || '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof AccountFormData, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof AccountFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'نام حساب الزامی است';
    } else if (formData.name.length > 100) {
      newErrors.name = 'نام حساب نباید بیشتر از ۱۰۰ کاراکتر باشد';
    }

    if (!formData.currency) {
      newErrors.currency = 'ارز الزامی است';
    }

    if (isNaN(formData.initial_balance) || formData.initial_balance < 0) {
      newErrors.initial_balance = 'موجودی اولیه باید یک عدد معتبر و غیرمنفی باشد';
    }

    if (isNaN(formData.current_balance) || formData.current_balance < 0) {
      newErrors.current_balance = 'موجودی فعلی باید یک عدد معتبر و غیرمنفی باشد';
    }

    if (formData.broker.length > 100) {
      newErrors.broker = 'نام بروکر نباید بیشتر از ۱۰۰ کاراکتر باشد';
    }

    if (formData.platform.length > 100) {
      newErrors.platform = 'نام پلتفرم نباید بیشتر از ۱۰۰ کاراکتر باشد';
    }

    if (formData.notes.length > 1000) {
      newErrors.notes = 'یادداشت نباید بیشتر از ۱۰۰۰ کاراکتر باشد';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(formData);
  };

  const handleChange = (field: keyof AccountFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="نام حساب *"
        value={formData.name}
        onChange={(e) => handleChange('name', e.target.value)}
        error={errors.name}
        placeholder="مثال: حساب اصلی FTMO"
        disabled={loading}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="بروکر"
          value={formData.broker}
          onChange={(e) => handleChange('broker', e.target.value)}
          error={errors.broker}
          placeholder="مثال: FTMO"
          disabled={loading}
        />

        <Input
          label="پلتفرم"
          value={formData.platform}
          onChange={(e) => handleChange('platform', e.target.value)}
          error={errors.platform}
          placeholder="مثال: MT4, MT5"
          disabled={loading}
        />
      </div>

      <Input
        label="شناسه/برچسب حساب"
        value={formData.account_number_label}
        onChange={(e) => handleChange('account_number_label', e.target.value)}
        placeholder="مثال: 12345678"
        disabled={loading}
        dir="ltr"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="ارز *"
          value={formData.currency}
          onChange={(e) => handleChange('currency', e.target.value)}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          error={errors.currency}
          disabled={loading}
        />

        <Select
          label="وضعیت"
          value={formData.status}
          onChange={(e) => handleChange('status', e.target.value as AccountStatus)}
          options={ACCOUNT_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="موجودی اولیه *"
          type="number"
          step="0.01"
          min="0"
          value={formData.initial_balance}
          onChange={(e) => handleChange('initial_balance', parseFloat(e.target.value) || 0)}
          error={errors.initial_balance}
          placeholder="0.00"
          disabled={loading}
          dir="ltr"
        />

        <Input
          label="موجودی فعلی"
          type="number"
          step="0.01"
          min="0"
          value={formData.current_balance}
          onChange={(e) => handleChange('current_balance', parseFloat(e.target.value) || 0)}
          error={errors.current_balance}
          placeholder="0.00"
          disabled={loading}
          dir="ltr"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          یادداشت
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          className={`
            w-full rounded-lg border px-3 py-2 text-sm
            bg-white dark:bg-gray-900
            text-gray-900 dark:text-gray-100
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            transition-colors duration-150
            ${errors.notes ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
            disabled:opacity-50 disabled:cursor-not-allowed
            resize-none
          `}
          rows={3}
          placeholder="توضیحات اختیاری درباره این حساب..."
          disabled={loading}
        />
        {errors.notes && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.notes}</p>
        )}
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          انصراف
        </Button>
        <Button type="submit" loading={loading}>
          {initialData ? 'بروزرسانی حساب' : 'ایجاد حساب'}
        </Button>
      </div>
    </form>
  );
}
