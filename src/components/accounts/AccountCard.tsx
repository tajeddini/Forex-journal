import { Link } from 'react-router-dom';
import type { TradingAccount } from '../../types/database';
import { Badge, getStatusBadgeVariant } from '../ui/Badge';
import { formatCurrency, formatShortDate } from '../../utils/format';

interface AccountCardProps {
  account: TradingAccount;
  phaseCount?: number;
}

export function AccountCard({ account, phaseCount }: AccountCardProps) {
  return (
    <Link
      to={`/app/accounts/${account.id}`}
      className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {account.name}
          </h3>
          {account.broker && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {account.broker}
              {account.platform && ` • ${account.platform}`}
            </p>
          )}
        </div>
        <Badge variant={getStatusBadgeVariant(account.status)}>
          {getStatusLabel(account.status)}
        </Badge>
      </div>

      {/* Balances */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">موجودی اولیه</p>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100" dir="ltr">
            {formatCurrency(account.initial_balance, account.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">موجودی فعلی</p>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100" dir="ltr">
            {formatCurrency(account.current_balance, account.currency)}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-700">
        <span>{phaseCount !== undefined ? `${phaseCount} فاز` : '—'}</span>
        <span>{formatShortDate(account.created_at)}</span>
      </div>
    </Link>
  );
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'فعال',
    passed: 'موفق',
    failed: 'ناموفق',
    funded: 'تأمین‌شده',
    archived: 'آرشیو شده',
  };
  return labels[status] || status;
}
