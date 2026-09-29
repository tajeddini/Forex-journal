import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getAccounts, createAccount, updateAccount } from '../../services/accounts';
import type { TradingAccount, AccountStatus } from '../../types/database';
import { AccountCard } from '../../components/accounts/AccountCard';
import { AccountFilters } from '../../components/accounts/AccountFilters';
import { AccountSummary } from '../../components/accounts/AccountSummary';
import { AccountForm, type AccountFormData } from '../../components/accounts/AccountForm';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';

export default function AccountsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch accounts
  useEffect(() => {
    if (!user) return;

    const fetchAccounts = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAccounts(user.id);
        setAccounts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'خطا در دریافت حساب‌ها');
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, [user]);

  // Available currencies from accounts
  const availableCurrencies = useMemo(() => {
    const currencies = new Set(accounts.map((a) => a.currency));
    return Array.from(currencies).sort();
  }, [accounts]);

  // Filtered and sorted accounts
  const filteredAccounts = useMemo(() => {
    let result = [...accounts];

    // Search
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(searchLower) ||
          a.broker?.toLowerCase().includes(searchLower) ||
          a.platform?.toLowerCase().includes(searchLower) ||
          a.account_number_label?.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((a) => a.status === statusFilter);
    }

    // Currency filter
    if (currencyFilter !== 'all') {
      result = result.filter((a) => a.currency === currencyFilter);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'initial_balance':
          return b.initial_balance - a.initial_balance;
        case 'current_balance':
          return b.current_balance - a.current_balance;
        case 'status':
          return a.status.localeCompare(b.status);
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [accounts, search, statusFilter, currencyFilter, sortBy]);

  // Create account
  const handleCreateAccount = async (data: AccountFormData) => {
    if (!user) return;

    try {
      setSubmitting(true);
      await createAccount({
        user_id: user.id,
        name: data.name.trim(),
        broker: data.broker.trim() || null,
        platform: data.platform.trim() || null,
        account_number_label: data.account_number_label.trim() || null,
        currency: data.currency,
        initial_balance: data.initial_balance,
        current_balance: data.current_balance,
        status: data.status,
        notes: data.notes.trim() || null,
      });

      // Refresh accounts
      const updatedAccounts = await getAccounts(user.id);
      setAccounts(updatedAccounts);

      setIsCreateModalOpen(false);
      toast.success('حساب با موفقیت ایجاد شد');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ایجاد حساب');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Loading message="در حال بارگذاری حساب‌ها..." />;
  }

  if (error) {
    return <ErrorState message={error} retry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">حساب‌های معاملاتی</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            مدیریت حساب‌ها و فازهای معاملاتی خود
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>+ افزودن حساب</Button>
      </div>

      {/* Summary */}
      {accounts.length > 0 && <AccountSummary accounts={accounts} />}

      {/* Filters */}
      {accounts.length > 0 && (
        <AccountFilters
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          currencyFilter={currencyFilter}
          onCurrencyFilterChange={setCurrencyFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          availableCurrencies={availableCurrencies}
        />
      )}

      {/* Account List */}
      {filteredAccounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          }
          title="هنوز حساب معاملاتی ثبت نشده است"
          description="اولین حساب خود را اضافه کنید تا بتوانید معاملات و عملکرد آن را ثبت و تحلیل کنید."
          action={
            <Button onClick={() => setIsCreateModalOpen(true)}>افزودن حساب</Button>
          }
        />
      ) : (
        <EmptyState
          title="حسابی یافت نشد"
          description="هیچ حسابی با فیلترهای انتخاب‌شده یافت نشد. فیلترها را تغییر دهید."
        />
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="افزودن حساب جدید"
        size="lg"
      >
        <AccountForm
          onSubmit={handleCreateAccount}
          onCancel={() => setIsCreateModalOpen(false)}
          loading={submitting}
        />
      </Modal>
    </div>
  );
}
