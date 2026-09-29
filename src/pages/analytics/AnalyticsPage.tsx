// ============================================================
// Analytics Page — Core Trading Analytics Dashboard
// ============================================================

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { calculateAnalytics, fetchAccounts } from '../../services/analytics';
import type { AnalyticsFilters, AnalyticsResult } from '../../services/analytics/types';
import { Card, CardTitle, CardHeader } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Loading } from '../../components/ui/Loading';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency, formatNumber, formatDuration } from '../../utils/format';
import type { TradingAccount } from '../../types/database';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch accounts for filter
  useEffect(() => {
    if (user) {
      fetchAccounts(user.id).then(setAccounts).catch(() => {});
    }
  }, [user]);

  // Calculate analytics
  useEffect(() => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    calculateAnalytics(user.id, filters)
      .then(setAnalytics)
      .catch(err => setError(err instanceof Error ? err.message : 'خطا در محاسبه آنالیتیکس'))
      .finally(() => setLoading(false));
  }, [user, filters]);

  if (loading) return <Loading message="در حال محاسبه آنالیتیکس..." />;
  if (error) return <ErrorState message={error} retry={() => window.location.reload()} />;
  if (!analytics) return null;

  const hasTrades = analytics.trades.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">آنالیتیکس معاملاتی</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          تحلیل عملکرد معاملاتی شما
        </p>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="حساب"
            value={filters.accountId || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, accountId: e.target.value || null, phaseId: null }))}
            options={[
              { value: '', label: 'همه حساب‌ها' },
              ...accounts.map(a => ({ value: a.id, label: a.name })),
            ]}
          />
          <Select
            label="بازه زمانی"
            value={filters.dateFrom ? 'custom' : 'all'}
            onChange={(e) => {
              if (e.target.value === 'all') {
                setFilters(prev => ({ ...prev, dateFrom: null, dateTo: null }));
              }
            }}
            options={[
              { value: 'all', label: 'همه زمان‌ها' },
              { value: 'custom', label: 'سفارشی' },
            ]}
          />
          <div className="flex items-end">
            <button
              onClick={() => {
                setLoading(true);
                calculateAnalytics(user!.id, filters)
                  .then(setAnalytics)
                  .finally(() => setLoading(false));
              }}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              بروزرسانی
            </button>
          </div>
        </div>
      </Card>

      {!hasTrades ? (
        <EmptyState
          title="هنوز معامله‌ای برای تحلیل وجود ندارد"
          description="پس از وارد کردن معاملات، آنالیتیکس شما اینجا نمایش داده خواهد شد."
        />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KpiCard label="کل معاملات" value={analytics.metrics.totalTrades.toString()} />
            <KpiCard
              label="نرخ برد"
              value={analytics.metrics.winRate !== null ? `${analytics.metrics.winRate.toFixed(1)}%` : 'N/A'}
            />
            <KpiCard
              label="سود/زیان خالص"
              value={formatCurrency(analytics.metrics.netPnl, analytics.currency)}
              color={analytics.metrics.netPnl >= 0 ? 'green' : 'red'}
            />
            <KpiCard
              label="ضریب سود"
              value={
                analytics.metrics.profitFactor === null ? 'N/A' :
                analytics.metrics.profitFactor === Infinity ? '∞' :
                analytics.metrics.profitFactor.toFixed(2)
              }
            />
            <KpiCard
              label="انتظار ریاضی"
              value={
                analytics.metrics.expectancy !== null
                  ? formatCurrency(analytics.metrics.expectancy, analytics.currency)
                  : 'N/A'
              }
              color={analytics.metrics.expectancy !== null && analytics.metrics.expectancy >= 0 ? 'green' : 'red'}
            />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="معاملات برنده" value={analytics.metrics.winningTrades.toString()} color="green" />
            <KpiCard label="معاملات بازنده" value={analytics.metrics.losingTrades.toString()} color="red" />
            <KpiCard label="سربدرسر" value={analytics.metrics.breakevenTrades.toString()} />
            <KpiCard
              label="سود ناخالص"
              value={formatCurrency(analytics.metrics.grossProfit, analytics.currency)}
              color="green"
            />
          </div>

          {/* Equity Curve */}
          <Card>
            <CardHeader>
              <CardTitle>منحنی سرمایه</CardTitle>
            </CardHeader>
            {analytics.equity.points.length > 1 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.equity.points}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => new Date(v).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' })} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatNumber(v, 0)} />
                    <Tooltip
                      formatter={(value: any) => formatCurrency(Number(value) || 0, analytics.currency)}
                      labelFormatter={(label: any) => new Date(label).toLocaleDateString('fa-IR')}
                    />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      stroke="#3B82F6"
                      fill="#3B82F6"
                      fillOpacity={0.1}
                      name="سرمایه"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">داده کافی برای نمایش منحنی سرمایه وجود ندارد</p>
            )}
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">سرمایه اولیه</p>
                <p className="font-medium" dir="ltr">{formatCurrency(analytics.equity.startingBalance, analytics.currency)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">سرمایه نهایی</p>
                <p className="font-medium" dir="ltr">{formatCurrency(analytics.equity.endingBalance, analytics.currency)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">بازده</p>
                <p className={`font-medium ${analytics.equity.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                  {analytics.equity.returnPercent !== null ? `${analytics.equity.returnPercent.toFixed(2)}%` : 'N/A'}
                </p>
              </div>
            </div>
          </Card>

          {/* Drawdown */}
          <Card>
            <CardHeader>
              <CardTitle>افت سرمایه (Drawdown)</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">افت فعلی</p>
                <p className="font-medium text-red-600" dir="ltr">
                  {formatCurrency(analytics.drawdown.currentDrawdown, analytics.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">حداکثر افت</p>
                <p className="font-medium text-red-600" dir="ltr">
                  {formatCurrency(analytics.drawdown.maxDrawdown, analytics.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">افت فعلی %</p>
                <p className="font-medium text-red-600" dir="ltr">
                  {analytics.drawdown.currentDrawdownPercent !== null ? `${analytics.drawdown.currentDrawdownPercent.toFixed(2)}%` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">حداکثر افت %</p>
                <p className="font-medium text-red-600" dir="ltr">
                  {analytics.drawdown.maxDrawdownPercent !== null ? `${analytics.drawdown.maxDrawdownPercent.toFixed(2)}%` : 'N/A'}
                </p>
              </div>
            </div>
            {analytics.drawdown.points.length > 1 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.drawdown.points}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => new Date(v).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' })} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatNumber(v, 0)} />
                    <Tooltip
                      formatter={(value: any) => formatCurrency(Number(value) || 0, analytics.currency)}
                      labelFormatter={(label: any) => new Date(label).toLocaleDateString('fa-IR')}
                    />
                    <Area
                      type="monotone"
                      dataKey="drawdown"
                      stroke="#EF4444"
                      fill="#EF4444"
                      fillOpacity={0.2}
                      name="افت سرمایه"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">داده کافی برای نمایش نمودار افت وجود ندارد</p>
            )}
          </Card>

          {/* Monthly P/L */}
          <Card>
            <CardHeader>
              <CardTitle>سود/زیان ماهانه</CardTitle>
            </CardHeader>
            {analytics.monthlyPnl.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.monthlyPnl}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatNumber(v, 0)} />
                    <Tooltip
                      formatter={(value: any) => formatCurrency(Number(value) || 0, analytics.currency)}
                    />
                    <Bar dataKey="netPnl" name="سود/زیان">
                      {analytics.monthlyPnl.map((entry, index) => (
                        <Cell key={index} fill={entry.netPnl >= 0 ? '#10B981' : '#EF4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">داده‌ای برای نمایش وجود ندارد</p>
            )}
          </Card>

          {/* Symbol Performance */}
          <Card>
            <CardHeader>
              <CardTitle>عملکرد بر اساس نماد</CardTitle>
            </CardHeader>
            {analytics.symbolPerformance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-3 py-2 text-right">نماد</th>
                      <th className="px-3 py-2 text-right">معاملات</th>
                      <th className="px-3 py-2 text-right">برد</th>
                      <th className="px-3 py-2 text-right">باخت</th>
                      <th className="px-3 py-2 text-right">نرخ برد</th>
                      <th className="px-3 py-2 text-right">سود/زیان</th>
                      <th className="px-3 py-2 text-right">میانگین</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.symbolPerformance.map(item => (
                      <tr key={item.key} className="border-b border-gray-100 dark:border-gray-700/50">
                        <td className="px-3 py-2 font-medium">{item.label}</td>
                        <td className="px-3 py-2">{item.trades}</td>
                        <td className="px-3 py-2 text-green-600">{item.wins}</td>
                        <td className="px-3 py-2 text-red-600">{item.losses}</td>
                        <td className="px-3 py-2">{item.winRate !== null ? `${item.winRate.toFixed(1)}%` : 'N/A'}</td>
                        <td className={`px-3 py-2 ${item.netPnl >= 0 ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                          {formatCurrency(item.netPnl, analytics.currency)}
                        </td>
                        <td className={`px-3 py-2 ${item.averagePnl !== null && item.averagePnl >= 0 ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                          {item.averagePnl !== null ? formatCurrency(item.averagePnl, analytics.currency) : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">داده‌ای برای نمایش وجود ندارد</p>
            )}
          </Card>

          {/* Setup Performance */}
          <Card>
            <CardHeader>
              <CardTitle>عملکرد بر اساس ستاپ</CardTitle>
            </CardHeader>
            {analytics.setupPerformance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-3 py-2 text-right">ستاپ</th>
                      <th className="px-3 py-2 text-right">معاملات</th>
                      <th className="px-3 py-2 text-right">برد</th>
                      <th className="px-3 py-2 text-right">باخت</th>
                      <th className="px-3 py-2 text-right">نرخ برد</th>
                      <th className="px-3 py-2 text-right">سود/زیان</th>
                      <th className="px-3 py-2 text-right">میانگین</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.setupPerformance.map(item => (
                      <tr key={item.key} className="border-b border-gray-100 dark:border-gray-700/50">
                        <td className="px-3 py-2 font-medium">{item.label}</td>
                        <td className="px-3 py-2">{item.trades}</td>
                        <td className="px-3 py-2 text-green-600">{item.wins}</td>
                        <td className="px-3 py-2 text-red-600">{item.losses}</td>
                        <td className="px-3 py-2">{item.winRate !== null ? `${item.winRate.toFixed(1)}%` : 'N/A'}</td>
                        <td className={`px-3 py-2 ${item.netPnl >= 0 ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                          {formatCurrency(item.netPnl, analytics.currency)}
                        </td>
                        <td className={`px-3 py-2 ${item.averagePnl !== null && item.averagePnl >= 0 ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                          {item.averagePnl !== null ? formatCurrency(item.averagePnl, analytics.currency) : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">داده‌ای برای نمایش وجود ندارد</p>
            )}
          </Card>

          {/* Buy vs Sell */}
          <Card>
            <CardHeader>
              <CardTitle>عملکرد خرید در برابر فروش</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {analytics.sidePerformance.map(item => (
                <div key={item.key} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <h4 className="font-semibold text-lg mb-3">{item.label}</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">معاملات</p>
                      <p className="font-medium">{item.trades}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">نرخ برد</p>
                      <p className="font-medium">{item.winRate !== null ? `${item.winRate.toFixed(1)}%` : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">سود/زیان</p>
                      <p className={`font-medium ${item.netPnl >= 0 ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                        {formatCurrency(item.netPnl, analytics.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">میانگین</p>
                      <p className={`font-medium ${item.averagePnl !== null && item.averagePnl >= 0 ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                        {item.averagePnl !== null ? formatCurrency(item.averagePnl, analytics.currency) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Duration Analytics */}
          <Card>
            <CardHeader>
              <CardTitle>تحلیل مدت معاملات</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <DurationItem label="میانگین مدت" value={analytics.duration.average} />
              <DurationItem label="میانه مدت" value={analytics.duration.median} />
              <DurationItem label="حداقل مدت" value={analytics.duration.min} />
              <DurationItem label="حداکثر مدت" value={analytics.duration.max} />
              <DurationItem label="میانگین مدت معاملات برنده" value={analytics.duration.winningAverage} />
              <DurationItem label="میانگین مدت معاملات بازنده" value={analytics.duration.losingAverage} />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// --- Helper Components ---

function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
  const colorClass = color === 'green' ? 'text-green-600 dark:text-green-400' :
                     color === 'red' ? 'text-red-600 dark:text-red-400' :
                     'text-gray-900 dark:text-gray-100';
  
  return (
    <Card>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-xl font-bold mt-1 ${colorClass}`} dir="ltr">{value}</p>
    </Card>
  );
}

function DurationItem({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="font-medium mt-1">{value !== null ? formatDuration(value) : 'N/A'}</p>
    </div>
  );
}
