import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getTradesWithJournal, getTradeCount, type JournalFilters } from '../../services/tradeJournals';
import { getStrategies } from '../../services/strategies';
import type { TradeWithJournal, Strategy } from '../../types/database';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { formatDateTime, getJournalStatusLabel } from '../../utils/format';
import { Link } from 'react-router-dom';

export default function JournalPage() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<TradeWithJournal[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;

  // Filters
  const [search, setSearch] = useState('');
  const [journalFilter, setJournalFilter] = useState<string>('all');
  const [strategyFilter, setStrategyFilter] = useState<string>('all');

  // Load strategies for filter
  useEffect(() => {
    if (user) {
      getStrategies(user.id)
        .then(setStrategies)
        .catch(() => {}); // Non-critical
    }
  }, [user]);

  const fetchTrades = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);

      const filters: JournalFilters = {
        search: search.trim() || undefined,
        journalStatus: journalFilter !== 'all' ? journalFilter : undefined,
        strategyId: strategyFilter !== 'all' ? strategyFilter : undefined,
      };

      const [tradesData, count] = await Promise.all([
        getTradesWithJournal(user.id, filters, page, limit),
        getTradeCount(user.id, filters),
      ]);

      setTrades(tradesData);
      setTotalCount(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در دریافت ژورنال‌ها');
    } finally {
      setLoading(false);
    }
  }, [user, page, search, journalFilter, strategyFilter]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, journalFilter, strategyFilter]);

  const totalPages = Math.ceil(totalCount / limit);

  if (loading && trades.length === 0) {
    return <Loading message="در حال بارگذاری ژورنال‌ها..." />;
  }

  if (error) {
    return <ErrorState message={error} retry={fetchTrades} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ژورنال معاملاتی</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          مدیریت و بررسی ژورنال معاملات
        </p>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="جستجو در نماد، تیکت، کامنت..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            value={journalFilter}
            onChange={(e) => setJournalFilter(e.target.value)}
            options={[
              { value: 'all', label: 'همه وضعیت‌های ژورنال' },
              { value: 'not_started', label: 'شروع نشده' },
              { value: 'in_progress', label: 'در حال تکمیل' },
              { value: 'completed', label: 'تکمیل شده' },
            ]}
          />
          <Select
            value={strategyFilter}
            onChange={(e) => setStrategyFilter(e.target.value)}
            options={[
              { value: 'all', label: 'همه استراتژی‌ها' },
              { value: 'no_strategy', label: 'بدون استراتژی' },
              ...strategies.map(s => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>
      </Card>

      {/* Journal List */}
      {trades.length > 0 ? (
        <>
          {/* Desktop Table View */}
          <Card padding={false} className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">تاریخ</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">نماد</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">جهت</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">سود/زیان</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">استراتژی</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">احساسات</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">رعایت قوانین</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">وضعیت ژورنال</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => {
                    const strategyName = strategies.find(s => s.id === trade.journal?.strategy_id)?.name;
                    return (
                      <tr
                        key={trade.id}
                        className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {formatDateTime(trade.entry_datetime)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                          {trade.symbol}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={trade.side === 'buy' ? 'success' : 'danger'}>
                            {trade.side === 'buy' ? 'خرید' : 'فروش'}
                          </Badge>
                        </td>
                        <td className={`px-4 py-3 font-medium ${trade.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} dir="ltr">
                          {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {strategyName || (trade.journal?.strategy_id ? '—' : '—')}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {trade.journal?.emotion_before || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {trade.journal?.rule_adherence && trade.journal.rule_adherence !== 'not_set' ? (
                            <Badge variant={
                              trade.journal.rule_adherence === 'followed' ? 'success' :
                              trade.journal.rule_adherence === 'partially_followed' ? 'warning' : 'danger'
                            }>
                              {trade.journal.rule_adherence === 'followed' ? 'رعایت شده' :
                               trade.journal.rule_adherence === 'partially_followed' ? 'تا حدی' : 'نقض شده'}
                            </Badge>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <JournalStatusBadge status={trade.journal?.status || 'not_started'} />
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/app/trades/${trade.id}`}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
                          >
                            مشاهده
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  صفحه {page} از {totalPages} ({totalCount} معامله)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    قبلی
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    بعدی
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {trades.map((trade) => {
              const strategyName = strategies.find(s => s.id === trade.journal?.strategy_id)?.name;
              return (
                <Link
                  key={trade.id}
                  to={`/app/trades/${trade.id}`}
                  className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{trade.symbol}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatDateTime(trade.entry_datetime)}
                      </p>
                    </div>
                    <Badge variant={trade.side === 'buy' ? 'success' : 'danger'}>
                      {trade.side === 'buy' ? 'خرید' : 'فروش'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">سود/زیان</p>
                      <p className={`text-sm font-bold ${trade.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} dir="ltr">
                        {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">وضعیت ژورنال</p>
                      <JournalStatusBadge status={trade.journal?.status || 'not_started'} />
                    </div>
                  </div>
                  {strategyName && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      استراتژی: {strategyName}
                    </div>
                  )}
                  {trade.journal?.emotion_before && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      احساس: {trade.journal.emotion_before}
                    </div>
                  )}
                </Link>
              );
            })}

            {/* Mobile Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  صفحه {page} از {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    قبلی
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    بعدی
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : totalCount === 0 ? (
        <EmptyState
          icon={
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
          title="هنوز ژورنالی ثبت نشده"
          description="برای ثبت ژورنال، به صفحه معاملات بروید و روی یک معامله کلیک کنید."
          action={
            <Link to="/app/trades">
              <Button>مشاهده معاملات</Button>
            </Link>
          }
        />
      ) : (
        <EmptyState
          title="ژورنالی یافت نشد"
          description="هیچ ژورنالی با فیلترهای انتخاب‌شده یافت نشد."
        />
      )}
    </div>
  );
}

function JournalStatusBadge({ status }: { status: string }) {
  const variant = status === 'completed' ? 'success' : status === 'in_progress' ? 'warning' : 'default';
  return (
    <Badge variant={variant}>
      {getJournalStatusLabel(status)}
    </Badge>
  );
}
