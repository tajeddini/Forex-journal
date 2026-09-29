// ============================================================
// Calendar Page — Trading Calendar View
// ============================================================

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchAnalyticsTrades } from '../../services/analytics';
import { generateCalendarData } from '../../services/analytics/timeAnalytics';
import { classifyTrades } from '../../services/analytics/metrics';
import type { CalendarDay } from '../../services/analytics/types';
import type { TradingAccount } from '../../types/database';
import { fetchAccounts } from '../../services/analytics';
import { Card, CardTitle, CardHeader } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Loading } from '../../components/ui/Loading';
import { formatCurrency, formatDuration } from '../../utils/format';
import { Link } from 'react-router-dom';

export default function CalendarPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Fetch accounts
  useEffect(() => {
    if (user) {
      fetchAccounts(user.id).then(setAccounts).catch(() => {});
    }
  }, [user]);

  // Fetch and generate calendar data
  useEffect(() => {
    if (!user) return;
    
    setLoading(true);
    
    const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    fetchAnalyticsTrades(user.id, {
      accountId: selectedAccountId,
      dateFrom: startDate.toISOString(),
      dateTo: endDate.toISOString(),
    })
      .then(trades => {
        const classified = classifyTrades(trades);
        const data = generateCalendarData(classified, startDate, endDate);
        setCalendarData(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, selectedAccountId, currentMonth]);

  // Get calendar grid
  const calendarGrid = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Get day of week for first day (0=Saturday for Persian)
    const firstDayOfWeek = (firstDay.getDay() + 1) % 7;
    
    const days: (CalendarDay | null)[] = [];
    
    // Add empty cells for days before first day
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const dayData = calendarData.find(d => d.date === dateStr) || null;
      days.push(dayData);
    }
    
    return days;
  }, [currentMonth, calendarData]);

  const monthLabel = currentMonth.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long' });

  const goToPrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  if (loading) return <Loading message="در حال بارگذاری تقویم..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">تقویم معاملاتی</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          نمای تقویمی عملکرد معاملاتی
        </p>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="حساب"
            value={selectedAccountId || ''}
            onChange={(e) => setSelectedAccountId(e.target.value || null)}
            options={[
              { value: '', label: 'همه حساب‌ها' },
              ...accounts.map(a => ({ value: a.id, label: a.name })),
            ]}
          />
        </div>
      </Card>

      {/* Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{monthLabel}</CardTitle>
            <div className="flex gap-2">
              <button
                onClick={goToPrevMonth}
                className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                ←
              </button>
              <button
                onClick={goToNextMonth}
                className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                →
              </button>
            </div>
          </div>
        </CardHeader>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarGrid.map((day, index) => (
            <CalendarCell
              key={index}
              day={day}
              isSelected={selectedDate === day?.date}
              onClick={() => day && setSelectedDate(day.date === selectedDate ? null : day.date)}
            />
          ))}
        </div>
      </Card>

      {/* Selected date details */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle>
              جزئیات {new Date(selectedDate).toLocaleDateString('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </CardTitle>
          </CardHeader>
          {(() => {
            const dayData = calendarData.find(d => d.date === selectedDate);
            if (!dayData || dayData.trades === 0) {
              return <p className="text-gray-500 dark:text-gray-400">معامله‌ای در این روز وجود ندارد</p>;
            }
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">تعداد معاملات</p>
                  <p className="text-lg font-bold">{dayData.trades}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">سود/زیان</p>
                  <p className={`text-lg font-bold ${dayData.netPnl >= 0 ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                    {dayData.netPnl.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">نرخ برد</p>
                  <p className="text-lg font-bold">{dayData.winRate !== null ? `${dayData.winRate.toFixed(1)}%` : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">مدت کل</p>
                  <p className="text-lg font-bold">{formatDuration(dayData.totalDuration)}</p>
                </div>
              </div>
            );
          })()}
        </Card>
      )}
    </div>
  );
}

function CalendarCell({ day, isSelected, onClick }: { day: CalendarDay | null; isSelected: boolean; onClick: () => void }) {
  if (!day) {
    return <div className="aspect-square" />;
  }

  const hasTrades = day.trades > 0;
  const isProfit = day.netPnl > 0;
  const isLoss = day.netPnl < 0;

  const bgColor = !hasTrades
    ? 'bg-gray-50 dark:bg-gray-800/50'
    : isProfit
      ? 'bg-green-50 dark:bg-green-900/20'
      : isLoss
        ? 'bg-red-50 dark:bg-red-900/20'
        : 'bg-gray-100 dark:bg-gray-700';

  const borderColor = isSelected ? 'ring-2 ring-blue-500' : '';

  return (
    <button
      onClick={onClick}
      className={`
        aspect-square rounded-lg p-1 text-center transition-all
        ${bgColor} ${borderColor}
        hover:ring-2 hover:ring-blue-300
        ${hasTrades ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {new Date(day.date).getDate()}
      </div>
      {hasTrades && (
        <>
          <div className={`text-sm font-bold ${isProfit ? 'text-green-600' : isLoss ? 'text-red-600' : 'text-gray-600'}`}>
            {day.trades}
          </div>
          <div className={`text-xs ${isProfit ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
            {day.netPnl >= 0 ? '+' : ''}{day.netPnl.toFixed(0)}
          </div>
        </>
      )}
    </button>
  );
}
