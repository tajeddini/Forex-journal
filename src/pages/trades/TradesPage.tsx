import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getTradesWithJournal, getTradeCount } from '../../services/tradeJournals';
import type { TradeWithJournal } from '../../types/database';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { formatDateTime, formatDuration, getJournalStatusLabel } from '../../utils/format';
import { TRADE_SIDES } from '../../types/database';
import { Link } from 'react-router-dom';

export default function TradesPage() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<TradeWithJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;

  // Filters
  const [search, setSearch] = useState('');
  const [sideFilter, setSideFilter] = useState<string>('all');
  const [journalFilter, setJournalFilter] = useState<string>('all');

  const fetchTrades = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const [tradesData, count] = await Promise.all([
        getTradesWithJournal(user.id, {}, page, limit),
        getTradeCount(user.id, {}),
      ]);
      setTrades(tradesData);
      setTotalCount(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در دریافت معاملات');
    } finally {
      setLoading(false);
    }
  }, [user, page]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  // Client-side filtering
  const filteredTrades = useMemo(() => {
    let result = [...trades];

    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(
        t => t.symbol.toLowerCase().includes(s) ||
             t.ticket?.toLowerCase().includes(s) ||
             t.comment?.toLowerCase().includes(s)
      );
    }

    if (sideFilter !== 'all') {
      result = result.filter(t => t.side === sideFilter);
    }

    if (journalFilter !== 'all') {
      result = result.filter(t => {
        const status = t.journal?.status || 'not_started';
        return status === journalFilter;
      });
    }

    return result;
  }, [trades, search, sideFilter, journalFilter]);

  const totalPages = Math.ceil(totalCount / limit);

  if (loading && trades.length === 0) {
    return <Loading message="در حال بارگذاری معاملات..." />;
  }

  if (error) {
    return <ErrorState message={error} retry={fetchTrades} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">معاملات</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {totalCount} معامله ثبت شده
          </p>
        </div>
        <Link to="/app/import">
          <Button>ورود معاملات جدید</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="جستجو در نماد، تیکت، کامنت..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            value={sideFilter}
            onChange={(e) => setSideFilter(e.target.value)}
            options={[
              { value: 'all', label: 'همه جهت‌ها' },
              ...TRADE_SIDES.map(s => ({ value: s.value, label: s.label })),
            ]}
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
        </div>
      </div>

      {/* Trade List */}
      {filteredTrades.length > 0 ? (
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
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">حجم</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">قیمت ورود</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">قیمت خروج</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">سود</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">مدت</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">استراتژی</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">ژورنال</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map((trade) => (
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
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400" dir="ltr">
                        {trade.volume}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400" dir="ltr">
                        {trade.entry_price}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400" dir="ltr">
                        {trade.exit_price}
                      </td>
                      <td className={`px-4 py-3 font-medium ${trade.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} dir="ltr">
                        {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {formatDuration(trade.duration_seconds)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {trade.journal?.strategy_id ? (
                          <span className="text-blue-600 dark:text-blue-400">✓</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <JournalStatusBadge status={trade.journal?.status || 'not_started'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
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
          </Card>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredTrades.map((trade) => (
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
                    <p className="text-xs text-gray-500 dark:text-gray-400">حجم</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100" dir="ltr">{trade.volume}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">مدت</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatDuration(trade.duration_seconds)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className={`text-lg font-bold ${trade.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} dir="ltr">
                    {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}
                  </div>
                  <JournalStatusBadge status={trade.journal?.status || 'not_started'} />
                </div>
              </Link>
            ))}

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
          title="هنوز معامله‌ای ثبت نشده"
          description="معاملات خود را از MT4/MT5 وارد کنید یا به صورت دستی ثبت کنید."
          action={
            <Link to="/app/import">
              <Button>ورود معاملات</Button>
            </Link>
          }
        />
      ) : (
        <EmptyState
          title="معامله‌ای یافت نشد"
          description="هیچ معامله‌ای با فیلترهای انتخاب‌شده یافت نشد."
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
