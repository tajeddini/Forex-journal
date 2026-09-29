import type { TradingAccount } from '../../types/database';
import { Card } from '../ui/Card';

interface AccountSummaryProps {
  accounts: TradingAccount[];
}

export function AccountSummary({ accounts }: AccountSummaryProps) {
  const total = accounts.length;
  const active = accounts.filter((a) => a.status === 'active').length;
  const funded = accounts.filter((a) => a.status === 'funded').length;
  const passed = accounts.filter((a) => a.status === 'passed').length;
  const failed = accounts.filter((a) => a.status === 'failed').length;
  const archived = accounts.filter((a) => a.status === 'archived').length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      <SummaryCard label="کل حساب‌ها" value={total} color="blue" />
      <SummaryCard label="فعال" value={active} color="green" />
      <SummaryCard label="تأمین‌شده" value={funded} color="purple" />
      <SummaryCard label="موفق" value={passed} color="cyan" />
      <SummaryCard label="ناموفق" value={failed} color="red" />
      <SummaryCard label="آرشیو شده" value={archived} color="gray" />
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'purple' | 'cyan' | 'red' | 'gray';
}

const colorClasses = {
  blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30',
  green: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/30',
  purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/30',
  cyan: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-100 dark:border-cyan-800/30',
  red: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30',
  gray: 'bg-gray-50 dark:bg-gray-900/20 border-gray-100 dark:border-gray-800/30',
};

function SummaryCard({ label, value, color }: SummaryCardProps) {
  return (
    <Card className={`border ${colorClasses[color]}`}>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </Card>
  );
}
