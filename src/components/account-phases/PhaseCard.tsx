import type { AccountPhase } from '../../types/database';
import { Badge, getStatusBadgeVariant } from '../ui/Badge';
import { formatCurrency, formatDate, getPhaseTypeLabel, getPhaseStatusLabel } from '../../utils/format';

interface PhaseCardProps {
  phase: AccountPhase;
  currency: string;
  onEdit?: () => void;
  onStatusChange?: () => void;
}

export function PhaseCard({ phase, currency, onEdit, onStatusChange }: PhaseCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">{phase.name}</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {getPhaseTypeLabel(phase.phase_type)}
          </p>
        </div>
        <Badge variant={getStatusBadgeVariant(phase.status)}>
          {getPhaseStatusLabel(phase.status)}
        </Badge>
      </div>

      {/* Balances */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">موجودی شروع</p>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100" dir="ltr">
            {formatCurrency(phase.starting_balance, currency)}
          </p>
        </div>
        {phase.target_balance !== null && (
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">موجودی هدف</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100" dir="ltr">
              {formatCurrency(phase.target_balance, currency)}
            </p>
          </div>
        )}
      </div>

      {/* Drawdown */}
      {(phase.maximum_drawdown !== null || phase.daily_drawdown_limit !== null) && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          {phase.maximum_drawdown !== null && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">حداکثر افت</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100" dir="ltr">
                {formatCurrency(phase.maximum_drawdown, currency)}
              </p>
            </div>
          )}
          {phase.daily_drawdown_limit !== null && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">افت روزانه</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100" dir="ltr">
                {formatCurrency(phase.daily_drawdown_limit, currency)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Dates */}
      {(phase.start_date || phase.end_date) && (
        <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
          {phase.start_date && <span>شروع: {formatDate(phase.start_date)}</span>}
          {phase.end_date && <span>پایان: {formatDate(phase.end_date)}</span>}
        </div>
      )}

      {/* Actions */}
      {(onEdit || onStatusChange) && (
        <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              ویرایش
            </button>
          )}
          {onStatusChange && (
            <button
              onClick={onStatusChange}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              تغییر وضعیت
            </button>
          )}
        </div>
      )}
    </div>
  );
}
