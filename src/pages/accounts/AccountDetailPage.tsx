import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getAccount, updateAccount } from '../../services/accounts';
import { getPhases, createPhase, updatePhase } from '../../services/accountPhases';
import type { TradingAccount, AccountPhase, AccountStatus, PhaseStatus } from '../../types/database';
import { Badge, getStatusBadgeVariant } from '../../components/ui/Badge';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { AccountForm, type AccountFormData } from '../../components/accounts/AccountForm';
import { PhaseForm, type PhaseFormData } from '../../components/account-phases/PhaseForm';
import { PhaseCard } from '../../components/account-phases/PhaseCard';
import { formatCurrency, formatDate, formatDateTime, getAccountStatusLabel, sortPhasesByType } from '../../utils/format';
import { ACCOUNT_STATUSES, PHASE_STATUSES } from '../../types/database';

export default function AccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [account, setAccount] = useState<TradingAccount | null>(null);
  const [phases, setPhases] = useState<AccountPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPhaseModalOpen, setIsPhaseModalOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<AccountPhase | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ isOpen: boolean; newStatus: AccountStatus | null }>({
    isOpen: false,
    newStatus: null,
  });

  const [submitting, setSubmitting] = useState(false);

  // Fetch account and phases
  useEffect(() => {
    if (!user || !accountId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const accountData = await getAccount(accountId, user.id);
        if (!accountData) {
          setError('حساب مورد نظر یافت نشد یا دسترسی غیرمجاز است');
          return;
        }
        setAccount(accountData);

        const phasesData = await getPhases(accountId, user.id);
        setPhases(phasesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'خطا در دریافت اطلاعات');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, accountId]);

  // Update account
  const handleUpdateAccount = async (data: AccountFormData) => {
    if (!user || !account) return;

    try {
      setSubmitting(true);
      const updated = await updateAccount(account.id, user.id, {
        name: data.name.trim(),
        broker: data.broker.trim() || null,
        platform: data.platform.trim() || null,
        account_number_label: data.account_number_label.trim() || null,
        currency: data.currency,
        current_balance: data.current_balance,
        status: data.status,
        notes: data.notes.trim() || null,
      });
      setAccount(updated);
      setIsEditModalOpen(false);
      toast.success('حساب با موفقیت ویرایش شد');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ویرایش حساب');
    } finally {
      setSubmitting(false);
    }
  };

  // Change status
  const handleChangeStatus = async () => {
    if (!user || !account || !statusDialog.newStatus) return;

    try {
      setSubmitting(true);
      const updated = await updateAccount(account.id, user.id, { status: statusDialog.newStatus });
      setAccount(updated);
      setStatusDialog({ isOpen: false, newStatus: null });
      toast.success('وضعیت حساب با موفقیت تغییر کرد');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در تغییر وضعیت');
    } finally {
      setSubmitting(false);
    }
  };

  // Create phase
  const handleCreatePhase = async (data: PhaseFormData) => {
    if (!user || !account) return;

    try {
      setSubmitting(true);
      await createPhase(
        {
          account_id: account.id,
          name: data.name.trim(),
          phase_type: data.phase_type,
          status: data.status,
          starting_balance: data.starting_balance,
          target_balance: data.target_balance,
          maximum_drawdown: data.maximum_drawdown,
          daily_drawdown_limit: data.daily_drawdown_limit,
          start_date: data.start_date ? new Date(data.start_date).toISOString() : null,
          end_date: data.end_date ? new Date(data.end_date).toISOString() : null,
        },
        user.id
      );

      const updatedPhases = await getPhases(account.id, user.id);
      setPhases(updatedPhases);
      setIsPhaseModalOpen(false);
      toast.success('فاز با موفقیت ایجاد شد');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ایجاد فاز');
    } finally {
      setSubmitting(false);
    }
  };

  // Update phase
  const handleUpdatePhase = async (data: PhaseFormData) => {
    if (!user || !editingPhase) return;

    try {
      setSubmitting(true);
      await updatePhase(
        editingPhase.id,
        user.id,
        {
          name: data.name.trim(),
          phase_type: data.phase_type,
          status: data.status,
          starting_balance: data.starting_balance,
          target_balance: data.target_balance,
          maximum_drawdown: data.maximum_drawdown,
          daily_drawdown_limit: data.daily_drawdown_limit,
          start_date: data.start_date ? new Date(data.start_date).toISOString() : null,
          end_date: data.end_date ? new Date(data.end_date).toISOString() : null,
        }
      );

      const updatedPhases = await getPhases(account!.id, user.id);
      setPhases(updatedPhases);
      setIsPhaseModalOpen(false);
      setEditingPhase(null);
      toast.success('فاز با موفقیت ویرایش شد');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ویرایش فاز');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Loading message="در حال بارگذاری..." />;
  }

  if (error || !account) {
    return (
      <ErrorState
        message={error || 'حساب مورد نظر یافت نشد'}
        retry={() => navigate('/app/accounts')}
      />
    );
  }

  const sortedPhases = sortPhasesByType(phases);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link to="/app/accounts" className="hover:text-blue-600 dark:hover:text-blue-400">
          حساب‌ها
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-gray-100">{account.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{account.name}</h1>
            <Badge variant={getStatusBadgeVariant(account.status)}>
              {getAccountStatusLabel(account.status)}
            </Badge>
          </div>
          {account.broker && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {account.broker}
              {account.platform && ` • ${account.platform}`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setIsEditModalOpen(true)}>
            ویرایش
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              setStatusDialog({
                isOpen: true,
                newStatus: account.status === 'archived' ? 'active' : 'archived',
              })
            }
          >
            {account.status === 'archived' ? 'بازگردانی' : 'آرشیو'}
          </Button>
        </div>
      </div>

      {/* Account Info */}
      <Card>
        <CardTitle>اطلاعات حساب</CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
          <InfoItem label="ارز" value={account.currency} />
          <InfoItem
            label="موجودی اولیه"
            value={formatCurrency(account.initial_balance, account.currency)}
          />
          <InfoItem
            label="موجودی فعلی"
            value={formatCurrency(account.current_balance, account.currency)}
          />
          <InfoItem label="تاریخ ایجاد" value={formatDateTime(account.created_at)} />
        </div>
        {account.notes && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">یادداشت</p>
            <p className="text-gray-900 dark:text-gray-100">{account.notes}</p>
          </div>
        )}
      </Card>

      {/* Future Stats Placeholder */}
      <Card>
        <CardTitle>آمار معاملات</CardTitle>
        <div className="mt-4 py-8 text-center text-gray-500 dark:text-gray-400">
          <p className="text-sm">
            آمار معاملات پس از ثبت معاملات در این بخش نمایش داده خواهد شد.
          </p>
        </div>
      </Card>

      {/* Phases */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>فازها</CardTitle>
          <Button size="sm" onClick={() => setIsPhaseModalOpen(true)}>
            + افزودن فاز
          </Button>
        </div>

        {sortedPhases.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedPhases.map((phase) => (
              <PhaseCard
                key={phase.id}
                phase={phase}
                currency={account.currency}
                onEdit={() => {
                  setEditingPhase(phase);
                  setIsPhaseModalOpen(true);
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="برای این حساب هنوز فازی ثبت نشده است"
            description="فازها مراحل مختلف حساب معاملاتی شما را نشان می‌دهند (چالش، مرحله ۱، تأمین‌شده و...)"
            action={
              <Button size="sm" onClick={() => setIsPhaseModalOpen(true)}>
                افزودن فاز
              </Button>
            }
          />
        )}
      </Card>

      {/* Edit Account Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="ویرایش حساب"
        size="lg"
      >
        <AccountForm
          initialData={account}
          onSubmit={handleUpdateAccount}
          onCancel={() => setIsEditModalOpen(false)}
          loading={submitting}
        />
      </Modal>

      {/* Phase Modal */}
      <Modal
        isOpen={isPhaseModalOpen}
        onClose={() => {
          setIsPhaseModalOpen(false);
          setEditingPhase(null);
        }}
        title={editingPhase ? 'ویرایش فاز' : 'افزودن فاز جدید'}
        size="lg"
      >
        <PhaseForm
          accountId={account.id}
          initialData={editingPhase || undefined}
          onSubmit={editingPhase ? handleUpdatePhase : handleCreatePhase}
          onCancel={() => {
            setIsPhaseModalOpen(false);
            setEditingPhase(null);
          }}
          loading={submitting}
        />
      </Modal>

      {/* Status Change Dialog */}
      <ConfirmDialog
        isOpen={statusDialog.isOpen}
        onClose={() => setStatusDialog({ isOpen: false, newStatus: null })}
        onConfirm={handleChangeStatus}
        title="تغییر وضعیت حساب"
        message={
          statusDialog.newStatus === 'archived'
            ? 'آیا مطمئن هستید که می‌خواهید این حساب را آرشیو کنید؟ حساب آرشیو‌شده در لیست پیش‌فرض نمایش داده نمی‌شود اما اطلاعات آن حفظ می‌شود.'
            : `آیا مطمئن هستید که می‌خواهید وضعیت حساب را به "${getAccountStatusLabel(statusDialog.newStatus!)}" تغییر دهید؟`
        }
        confirmLabel="تأیید"
        loading={submitting}
      />
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 font-medium text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}
