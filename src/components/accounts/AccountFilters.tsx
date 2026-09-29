import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import type { AccountStatus } from '../../types/database';
import { ACCOUNT_STATUSES } from '../../types/database';

interface AccountFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: AccountStatus | 'all';
  onStatusFilterChange: (value: AccountStatus | 'all') => void;
  currencyFilter: string;
  onCurrencyFilterChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  availableCurrencies: string[];
}

export function AccountFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  currencyFilter,
  onCurrencyFilterChange,
  sortBy,
  onSortByChange,
  availableCurrencies,
}: AccountFiltersProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Input
          placeholder="جستجو در نام، بروکر، پلتفرم..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        <Select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as AccountStatus | 'all')}
          options={[
            { value: 'all', label: 'همه وضعیت‌ها' },
            ...ACCOUNT_STATUSES.map((s) => ({ value: s.value, label: s.label })),
          ]}
        />

        <Select
          value={currencyFilter}
          onChange={(e) => onCurrencyFilterChange(e.target.value)}
          options={[
            { value: 'all', label: 'همه ارزها' },
            ...availableCurrencies.map((c) => ({ value: c, label: c })),
          ]}
        />

        <Select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value)}
          options={[
            { value: 'newest', label: 'جدیدترین' },
            { value: 'oldest', label: 'قدیمی‌ترین' },
            { value: 'name', label: 'نام حساب' },
            { value: 'initial_balance', label: 'موجودی اولیه' },
            { value: 'current_balance', label: 'موجودی فعلی' },
            { value: 'status', label: 'وضعیت' },
          ]}
        />
      </div>
    </div>
  );
}
