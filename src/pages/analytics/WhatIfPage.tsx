// ============================================================
// What-If Analysis Page
// ============================================================

import { useEffect, useState, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { fetchAnalyticsTrades } from '../../services/analytics';
import { classifyTrades } from '../../services/analytics/metrics';
import { calculateWhatIf, PRESET_SCENARIOS, type WhatIfScenario, type WhatIfCondition, type WhatIfConditionType } from '../../services/analytics/whatIf';
import type { TradingAccount } from '../../types/database';
import type { ClassifiedTrade } from '../../services/analytics/types';
import { fetchAccounts } from '../../services/analytics';
import { Card, CardTitle, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency, formatDuration } from '../../utils/format';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, Cell,
} from 'recharts';

export default function WhatIfPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [trades, setTrades] = useState<ClassifiedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState<WhatIfScenario>({
    id: 'current',
    name: 'سناریوی فعلی',
    conditions: [],
  });

  // Condition builder
  const [conditionType, setConditionType] = useState<WhatIfConditionType>('symbol');
  const [conditionValue, setConditionValue] = useState('');

  // Fetch accounts and trades
  useEffect(() => {
    if (!user) return;
    
    setLoading(true);
    fetchAccounts(user.id).then(setAccounts).catch(() => {});
    
    fetchAnalyticsTrades(user.id, { accountId: selectedAccountId })
      .then(rawTrades => {
        setTrades(classifyTrades(rawTrades));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, selectedAccountId]);

  // Calculate What-If
  const whatIfResult = useMemo(() => {
    if (trades.length === 0) return null;
    
    const startingBalance = 10000; // Default starting balance
    return calculateWhatIf(trades, scenario, startingBalance);
  }, [trades, scenario]);

  // Add condition
  const addCondition = () => {
    if (!conditionValue) return;
    
    const newCondition: WhatIfCondition = {
      id: Math.random().toString(36).substring(2, 9),
      type: conditionType,
      operator: 'equals',
      value: conditionValue,
      label: `${conditionType} = ${conditionValue}`,
    };
    
    setScenario(prev => ({
      ...prev,
      conditions: [...prev.conditions, newCondition],
    }));
    setConditionValue('');
  };

  // Remove condition
  const removeCondition = (conditionId: string) => {
    setScenario(prev => ({
      ...prev,
      conditions: prev.conditions.filter(c => c.id !== conditionId),
    }));
  };

  // Clear all conditions
  const clearConditions = () => {
    setScenario(prev => ({ ...prev, conditions: [] }));
  };

  // Apply preset
  const applyPreset = (presetFn: () => WhatIfScenario) => {
    setScenario(presetFn());
  };

  if (loading) return <Loading message="در حال بارگذاری..." />;

  if (trades.length === 0) {
    return (
      <EmptyState
        title="معامله‌ای برای تحلیل وجود ندارد"
        description="لطفاً ابتدا معاملات خود را وارد کنید."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">تحلیل What-If</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            شبیه‌سازی سناریوهای فرضی بدون تغییر داده‌های واقعی
          </p>
        </div>

        {/* Sub-nav switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          <NavLink
            to="/app/analytics"
            end
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`
            }
          >
            آنالیتیکس کلی
          </NavLink>
          <NavLink
            to="/app/analytics/patterns"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`
            }
          >
            الگوها و بینش‌ها
          </NavLink>
          <NavLink
            to="/app/analytics/what-if"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`
            }
          >
            شبیه‌ساز فرضی (What-If)
          </NavLink>
        </div>
      </div>

      {/* Account Filter */}
      <Card>
        <Select
          label="حساب"
          value={selectedAccountId || ''}
          onChange={(e) => setSelectedAccountId(e.target.value || null)}
          options={[
            { value: '', label: 'همه حساب‌ها' },
            ...accounts.map(a => ({ value: a.id, label: a.name })),
          ]}
        />
      </Card>

      {/* Scenario Builder */}
      <Card>
        <CardHeader>
          <CardTitle>سازنده سناریو</CardTitle>
        </CardHeader>
        
        <div className="space-y-4">
          {/* Presets */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              سناریوهای آماده
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => applyPreset(PRESET_SCENARIOS.excludeLosingTrades)}>
                حذف معاملات بازنده
              </Button>
              <Button variant="secondary" size="sm" onClick={() => applyPreset(PRESET_SCENARIOS.excludeWinningTrades)}>
                حذف معاملات برنده
              </Button>
              <Button variant="secondary" size="sm" onClick={() => applyPreset(PRESET_SCENARIOS.excludeFriday)}>
                حذف معاملات جمعه
              </Button>
              <Button variant="secondary" size="sm" onClick={() => applyPreset(PRESET_SCENARIOS.excludeShortTrades)}>
                حذف معاملات کوتاه
              </Button>
              <Button variant="secondary" size="sm" onClick={() => applyPreset(PRESET_SCENARIOS.excludeRuleViolations)}>
                حذف نقض قوانین
              </Button>
            </div>
          </div>

          {/* Custom Condition */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="نوع شرط"
              value={conditionType}
              onChange={(e) => setConditionType(e.target.value as WhatIfConditionType)}
              options={[
                { value: 'symbol', label: 'نماد' },
                { value: 'side', label: 'جهت' },
                { value: 'day_of_week', label: 'روز هفته' },
                { value: 'hour', label: 'ساعت' },
                { value: 'result', label: 'نتیجه' },
                { value: 'duration_min', label: 'حداقل مدت' },
                { value: 'duration_max', label: 'حداکثر مدت' },
              ]}
            />
            <Input
              label="مقدار"
              value={conditionValue}
              onChange={(e) => setConditionValue(e.target.value)}
              placeholder="مثال: EURUSD"
            />
            <div className="flex items-end">
              <Button onClick={addCondition} disabled={!conditionValue}>
                افزودن شرط
              </Button>
            </div>
          </div>

          {/* Active Conditions */}
          {scenario.conditions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  شروط فعال
                </label>
                <Button variant="ghost" size="sm" onClick={clearConditions}>
                  پاک کردن همه
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {scenario.conditions.map(condition => (
                  <div
                    key={condition.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
                  >
                    <span className="text-sm text-blue-700 dark:text-blue-400">
                      {condition.label}
                    </span>
                    <button
                      onClick={() => removeCondition(condition.id)}
                      className="text-blue-600 hover:text-blue-800 dark:hover:text-blue-300"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Results */}
      {whatIfResult && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>خلاصه شبیه‌سازی</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">معاملات اصلی</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {whatIfResult.originalTrades}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">حذف شده</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {whatIfResult.excludedTrades}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">باقی‌مانده</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {whatIfResult.remainingTrades}
                </p>
              </div>
            </div>
          </Card>

          {/* Metrics Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>مقایسه شاخص‌ها</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-2 text-right">شاخص</th>
                    <th className="px-4 py-2 text-right">واقعی</th>
                    <th className="px-4 py-2 text-right">What-If</th>
                    <th className="px-4 py-2 text-right">تفاوت</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="px-4 py-2">تعداد معاملات</td>
                    <td className="px-4 py-2" dir="ltr">{whatIfResult.actualMetrics.totalTrades}</td>
                    <td className="px-4 py-2" dir="ltr">{whatIfResult.whatIfMetrics.totalTrades}</td>
                    <td className={`px-4 py-2 ${whatIfResult.differences.totalTrades >= 0 ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                      {whatIfResult.differences.totalTrades >= 0 ? '+' : ''}{whatIfResult.differences.totalTrades}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="px-4 py-2">سود/زیان خالص</td>
                    <td className="px-4 py-2" dir="ltr">{formatCurrency(whatIfResult.actualMetrics.netPnl, 'USD')}</td>
                    <td className="px-4 py-2" dir="ltr">{formatCurrency(whatIfResult.whatIfMetrics.netPnl, 'USD')}</td>
                    <td className={`px-4 py-2 ${whatIfResult.differences.netPnl >= 0 ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                      {whatIfResult.differences.netPnl >= 0 ? '+' : ''}{formatCurrency(whatIfResult.differences.netPnl, 'USD')}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="px-4 py-2">نرخ برد</td>
                    <td className="px-4 py-2" dir="ltr">{whatIfResult.actualMetrics.winRate?.toFixed(1) || 'N/A'}%</td>
                    <td className="px-4 py-2" dir="ltr">{whatIfResult.whatIfMetrics.winRate?.toFixed(1) || 'N/A'}%</td>
                    <td className={`px-4 py-2 ${whatIfResult.differences.winRate !== null && whatIfResult.differences.winRate >= 0 ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                      {whatIfResult.differences.winRate !== null ? `${whatIfResult.differences.winRate >= 0 ? '+' : ''}${whatIfResult.differences.winRate.toFixed(1)}%` : 'N/A'}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="px-4 py-2">ضریب سود</td>
                    <td className="px-4 py-2" dir="ltr">{whatIfResult.actualMetrics.profitFactor?.toFixed(2) || 'N/A'}</td>
                    <td className="px-4 py-2" dir="ltr">{whatIfResult.whatIfMetrics.profitFactor?.toFixed(2) || 'N/A'}</td>
                    <td className={`px-4 py-2 ${whatIfResult.differences.profitFactor !== null && whatIfResult.differences.profitFactor >= 0 ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                      {whatIfResult.differences.profitFactor !== null ? `${whatIfResult.differences.profitFactor >= 0 ? '+' : ''}${whatIfResult.differences.profitFactor.toFixed(2)}` : 'N/A'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">حداکثر افت</td>
                    <td className="px-4 py-2 text-red-600" dir="ltr">{formatCurrency(whatIfResult.actualDrawdown.maxDrawdown, 'USD')}</td>
                    <td className="px-4 py-2 text-red-600" dir="ltr">{formatCurrency(whatIfResult.whatIfDrawdown.maxDrawdown, 'USD')}</td>
                    <td className={`px-4 py-2 ${whatIfResult.differences.maxDrawdown >= 0 ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                      {whatIfResult.differences.maxDrawdown >= 0 ? '+' : ''}{formatCurrency(whatIfResult.differences.maxDrawdown, 'USD')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Equity Curve Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>مقایسه منحنی سرمایه</CardTitle>
            </CardHeader>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis 
                    dataKey="tradeIndex" 
                    tick={{ fontSize: 12 }}
                    label={{ value: 'معامله', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value) || 0, 'USD')} />
                  <Legend />
                  <Line
                    data={whatIfResult.actualEquity.points}
                    type="monotone"
                    dataKey="equity"
                    stroke="#3B82F6"
                    name="واقعی"
                    dot={false}
                  />
                  <Line
                    data={whatIfResult.whatIfEquity.points}
                    type="monotone"
                    dataKey="equity"
                    stroke="#10B981"
                    name="What-If"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
