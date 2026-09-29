import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGuest } from '../../contexts/GuestContext';
import { useGuestData } from '../../hooks/useGuestData';
import { Card, CardTitle } from '../../components/ui/Card';
import { getAccountCount } from '../../services/accounts';
import { EmptyState } from '../../components/ui/EmptyState';

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const { isGuest } = useGuest();
  const { accounts, trades } = useGuestData();
  const [accountCount, setAccountCount] = useState<number | null>(null);

  useEffect(() => {
    if (isGuest) {
      setAccountCount(accounts.length);
    } else if (user) {
      getAccountCount(user.id).then(setAccountCount).catch(() => setAccountCount(0));
    }
  }, [user, isGuest, accounts]);

  const displayName = isGuest ? 'کاربر مهمان' : (profile?.display_name || user?.email?.split('@')[0] || 'کاربر');

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          سلام، {displayName} 👋
        </h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          به ژورنال معاملاتی خود خوش آمدید
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="حساب‌های معاملاتی"
          value={accountCount !== null ? accountCount.toString() : '...'}
          subtitle="حساب فعال"
          color="blue"
        />
        <StatCard
          title="معاملات"
          value={isGuest ? trades.length.toString() : '۰'}
          subtitle="مجموع معاملات"
          color="green"
        />
        <StatCard
          title="نرخ برد"
          value={isGuest ? '60%' : '—'}
          subtitle={isGuest ? 'نمونه' : 'هفته جاری'}
          color="purple"
        />
        <StatCard
          title="سود/زیان خالص"
          value={isGuest ? '+$457' : '۰$'}
          subtitle={isGuest ? 'نمونه' : 'ماه جاری'}
          color="orange"
        />
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>آخرین معاملات</CardTitle>
          <EmptyState
            title="هنوز معامله‌ای ثبت نشده"
            description="پس از ورود معاملات از MT4/MT5 یا ثبت دستی، آخرین معاملات شما اینجا نمایش داده می‌شود."
          />
        </Card>

        <Card>
          <CardTitle>عملکرد هفتگی</CardTitle>
          <EmptyState
            title="داده‌ای برای نمایش وجود ندارد"
            description="پس از ثبت معاملات، نمودار عملکرد هفتگی شما اینجا نمایش داده می‌شود."
          />
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardTitle>دسترسی سریع</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <QuickAction label="ثبت معامله" emoji="📝" />
          <QuickAction label="ورود MT4/MT5" emoji="📥" />
          <QuickAction label="افزودن حساب" emoji="💼" />
          <QuickAction label="بازبینی روزانه" emoji="📋" />
        </div>
      </Card>
    </div>
  );
}

function StatCard({ title, value, subtitle, color }: {
  title: string;
  value: string;
  subtitle: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/30',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/30',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800/30',
  };

  return (
    <Card className={`border ${colorClasses[color]}`}>
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
    </Card>
  );
}

function QuickAction({ label, emoji }: { label: string; emoji: string }) {
  return (
    <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <span className="text-2xl">{emoji}</span>
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
    </button>
  );
}
