// ============================================================
// Custom Dashboard Page
// ============================================================

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getDashboardAnalytics, fetchAccounts } from '../../services/analytics';
import { calculateCoreMetrics } from '../../services/analytics/metrics';
import { calculateDrawdown } from '../../services/analytics/equity';
import type { DashboardWidget, DashboardLayout } from '../../types/database';
import { DEFAULT_DASHBOARD_WIDGETS, getDefaultDashboardLayout, updateDashboardLayout } from '../../services/dashboard';
import { Card, CardTitle, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { TradingSuggestions } from '../../components/analytics/TradingSuggestions';
import { formatCurrency, formatNumber } from '../../utils/format';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function CustomDashboardPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<DashboardLayout | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidget[]>(DEFAULT_DASHBOARD_WIDGETS);
  const [dashboardAnalytics, setDashboardAnalytics] = useState<Awaited<ReturnType<typeof getDashboardAnalytics>> | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountCount, setAccountCount] = useState(0);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Widget management
  const [isAddWidgetModalOpen, setIsAddWidgetModalOpen] = useState(false);
  const [resetDialog, setResetDialog] = useState(false);

  // Load data
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        const [savedLayout, accountsData] = await Promise.all([
          getDefaultDashboardLayout(user.id),
          fetchAccounts(user.id),
        ]);

        if (savedLayout) {
          setLayout(savedLayout);
          setWidgets(savedLayout.layout_config || DEFAULT_DASHBOARD_WIDGETS);
        }

        setAccounts(accountsData);
        setAccountCount(accountsData.length);

        const startingBalance = selectedAccountId
          ? (accountsData.find(a => a.id === selectedAccountId)?.initial_balance || 0)
          : accountsData.reduce((sum, acc) => sum + (acc.initial_balance || 0), 0);

        const analytics = await getDashboardAnalytics(
          user.id,
          selectedAccountId,
          startingBalance
        );
        setDashboardAnalytics(analytics);
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, selectedAccountId]);

  const metrics = dashboardAnalytics?.metrics || {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    breakevenTrades: 0,
    winRate: null,
    netPnl: 0,
    grossProfit: 0,
    grossLoss: 0,
    profitFactor: null,
    averageWin: null,
    averageLoss: null,
    expectancy: null,
  };

  const equity = dashboardAnalytics?.equity || {
    points: [],
    startingBalance: 0,
    endingBalance: 0,
    netChange: 0,
    returnPercent: null,
  };

  const drawdown = useMemo(() => calculateDrawdown(equity), [equity]);
  const dailyPnl = dashboardAnalytics?.dailyPnl || [];
  const symbolPerformance = dashboardAnalytics?.symbolPerformance || [];
  const sidePerformance = dashboardAnalytics?.sidePerformance || [];

  // Save layout
  const saveLayout = async (newWidgets: DashboardWidget[]) => {
    if (!user || !layout) return;
    try {
      await updateDashboardLayout(layout.id, user.id, { layout_config: newWidgets });
      setWidgets(newWidgets);
    } catch (err) {
      toast.error('خطا در ذخیره چیدمان');
    }
  };

  // Remove widget
  const removeWidget = (widgetId: string) => {
    const newWidgets = widgets.filter(w => w.id !== widgetId);
    setWidgets(newWidgets);
    saveLayout(newWidgets);
  };

  // Reset dashboard
  const resetDashboard = () => {
    setWidgets(DEFAULT_DASHBOARD_WIDGETS);
    saveLayout(DEFAULT_DASHBOARD_WIDGETS);
    setResetDialog(false);
    toast.success('داشبورد بازنشانی شد');
  };

  if (loading) return <Loading message="در حال بارگذاری داشبورد..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">داشبورد سفارشی</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            داشبورد شخصی‌سازی‌شده شما
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setResetDialog(true)}>
            بازنشانی
          </Button>
          <Button onClick={() => setIsAddWidgetModalOpen(true)}>
            افزودن ویجت
          </Button>
        </div>
      </div>

      {/* Global Filter */}
      <Card>
        <Select
          value={selectedAccountId || ''}
          onChange={(e) => setSelectedAccountId(e.target.value || null)}
          options={[
            { value: '', label: 'همه حساب‌ها' },
            ...accounts.map(account => ({
              value: account.id,
              label: account.name,
            })),
          ]}
        />
      </Card>

      {/* Smart Trading Suggestions in Persian */}
      {metrics && metrics.totalTrades > 0 && (
        <TradingSuggestions
          metrics={metrics}
          drawdown={drawdown}
          symbolPerformance={symbolPerformance}
          sidePerformance={sidePerformance}
        />
      )}

      {/* Widgets Grid */}
      {widgets.length === 0 ? (
        <EmptyState
          title="داشبورد خالی است"
          description="ویجت‌هایی را به داشبورد خود اضافه کنید."
          action={<Button onClick={() => setIsAddWidgetModalOpen(true)}>افزودن ویجت</Button>}
        />
      ) : (
        <SortableWidgets
          widgets={widgets}
          onReorder={(newWidgets) => {
            setWidgets(newWidgets);
            saveLayout(newWidgets);
          }}
          onRemove={removeWidget}
          metrics={metrics}
          equity={equity}
          dailyPnl={dailyPnl}
          symbolPerformance={symbolPerformance}
          drawdown={drawdown}
          accountCount={accountCount}
        />
      )}

      {/* Add Widget Modal */}
      <Modal
        isOpen={isAddWidgetModalOpen}
        onClose={() => setIsAddWidgetModalOpen(false)}
        title="افزودن ویجت"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            ویجت مورد نظر خود را انتخاب کنید:
          </p>
          <div className="grid grid-cols-2 gap-3">
            {DEFAULT_DASHBOARD_WIDGETS.filter(w => !widgets.find(ew => ew.type === w.type && ew.config?.metric === w.config?.metric)).map(w => (
              <button
                key={w.id}
                onClick={() => {
                  const newWidget = { ...w, id: `${w.id}-${Date.now()}` };
                  const newWidgets = [...widgets, newWidget];
                  setWidgets(newWidgets);
                  saveLayout(newWidgets);
                  setIsAddWidgetModalOpen(false);
                }}
                className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-right"
              >
                <p className="font-medium text-gray-900 dark:text-gray-100">{w.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{w.type}</p>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Reset Confirmation */}
      <ConfirmDialog
        isOpen={resetDialog}
        onClose={() => setResetDialog(false)}
        onConfirm={resetDashboard}
        title="بازنشانی داشبورد"
        message="آیا مطمئن هستید که می‌خواهید داشبورد را به حالت پیش‌فرض بازنشانی کنید؟"
        confirmLabel="بازنشانی"
        variant="warning"
      />
    </div>
  );
}

// --- Sortable Widget Component ---

function SortableWidget({ widget, onRemove, metrics, equity, dailyPnl, symbolPerformance, drawdown, accountCount }: {
  widget: DashboardWidget;
  onRemove: () => void;
  metrics: any;
  equity: any;
  dailyPnl: any;
  symbolPerformance: any;
  drawdown: any;
  accountCount: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <Card>
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 right-2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10 p-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
          title="جابجایی ویجت"
        >
          <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>

        {/* Remove Button */}
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={onRemove}
            className="p-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
            title="حذف ویجت"
          >
            ×
          </button>
        </div>

        <CardHeader>
          <CardTitle>{widget.title}</CardTitle>
        </CardHeader>

        {widget.type === 'kpi' && <KpiWidget metric={widget.config?.metric} metrics={metrics} accountCount={accountCount} />}
        {widget.type === 'chart' && <ChartWidget chartType={widget.config?.chartType} equity={equity} dailyPnl={dailyPnl} />}
        {widget.type === 'table' && <TableWidget tableType={widget.config?.tableType} symbolPerformance={symbolPerformance} />}
      </Card>
    </div>
  );
}

// --- Sortable Widgets Container ---

function SortableWidgets({ widgets, onReorder, onRemove, metrics, equity, dailyPnl, symbolPerformance, drawdown, accountCount }: {
  widgets: DashboardWidget[];
  onReorder: (newWidgets: DashboardWidget[]) => void;
  onRemove: (widgetId: string) => void;
  metrics: any;
  equity: any;
  dailyPnl: any;
  symbolPerformance: any;
  drawdown: any;
  accountCount: number;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = widgets.findIndex(w => w.id === active.id);
      const newIndex = widgets.findIndex(w => w.id === over.id);
      const newWidgets = arrayMove(widgets, oldIndex, newIndex);
      onReorder(newWidgets);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={widgets.map(w => w.id)}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {widgets.map(widget => (
            <SortableWidget
              key={widget.id}
              widget={widget}
              onRemove={() => onRemove(widget.id)}
              metrics={metrics}
              equity={equity}
              dailyPnl={dailyPnl}
              symbolPerformance={symbolPerformance}
              drawdown={drawdown}
              accountCount={accountCount}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// --- Widget Renderer ---

interface WidgetRendererProps {
  widget: DashboardWidget;
  onRemove: () => void;
  metrics: any;
  equity: any;
  dailyPnl: any;
  symbolPerformance: any;
  drawdown: any;
  accountCount: number;
}

function WidgetRenderer({ widget, onRemove, metrics, equity, dailyPnl, symbolPerformance, drawdown, accountCount }: WidgetRendererProps) {
  const sizeClass = widget.size === 'large' ? 'md:col-span-2 lg:col-span-4' :
                    widget.size === 'medium' ? 'md:col-span-2' : 'md:col-span-1';

  return (
    <div className={`${sizeClass} relative group`}>
      <Card>
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={onRemove}
            className="p-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
            title="حذف ویجت"
          >
            ×
          </button>
        </div>

        <CardHeader>
          <CardTitle>{widget.title}</CardTitle>
        </CardHeader>

        {widget.type === 'kpi' && <KpiWidget metric={widget.config?.metric} metrics={metrics} accountCount={accountCount} />}
        {widget.type === 'chart' && <ChartWidget chartType={widget.config?.chartType} equity={equity} dailyPnl={dailyPnl} />}
        {widget.type === 'table' && <TableWidget tableType={widget.config?.tableType} symbolPerformance={symbolPerformance} />}
      </Card>
    </div>
  );
}

function KpiWidget({ metric, metrics, accountCount }: { metric: string; metrics: any; accountCount: number }) {
  let value = 'N/A';
  let colorClass = '';

  switch (metric) {
    case 'totalTrades':
      value = metrics.totalTrades.toString();
      break;
    case 'winRate':
      value = metrics.winRate !== null ? `${metrics.winRate.toFixed(1)}%` : 'N/A';
      break;
    case 'netPnl':
      value = formatCurrency(metrics.netPnl, 'USD');
      colorClass = metrics.netPnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
      break;
    case 'profitFactor':
      value = metrics.profitFactor !== null ? metrics.profitFactor.toFixed(2) : 'N/A';
      break;
    case 'accountCount':
      value = accountCount.toString();
      break;
    default:
      value = 'N/A';
  }

  return (
    <div className="text-center py-4">
      <p className={`text-3xl font-bold ${colorClass || 'text-gray-900 dark:text-gray-100'}`} dir="ltr">
        {value}
      </p>
    </div>
  );
}

function ChartWidget({ chartType, equity, dailyPnl }: { chartType: string; equity: any; dailyPnl: any }) {
  if (chartType === 'equity' && equity.points.length > 1) {
    return (
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={equity.points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="tradeIndex" hide />
            <YAxis hide />
            <Tooltip formatter={(value: any) => formatCurrency(Number(value) || 0, 'USD')} />
            <Area type="monotone" dataKey="equity" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === 'dailyPnl' && dailyPnl.length > 0) {
    return (
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dailyPnl.slice(-30)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="period" hide />
            <YAxis hide />
            <Tooltip formatter={(value: any) => formatCurrency(Number(value) || 0, 'USD')} />
            <Bar dataKey="netPnl">
              {dailyPnl.slice(-30).map((entry: any, index: number) => (
                <Cell key={index} fill={entry.netPnl >= 0 ? '#10B981' : '#EF4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return <EmptyState title="داده‌ای برای نمایش وجود ندارد" />;
}

function TableWidget({ tableType, symbolPerformance }: { tableType: string; symbolPerformance: any }) {
  if (tableType === 'symbolPerformance' && symbolPerformance.length > 0) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-2 py-1 text-right">نماد</th>
              <th className="px-2 py-1 text-right">معاملات</th>
              <th className="px-2 py-1 text-right">سود/زیان</th>
            </tr>
          </thead>
          <tbody>
            {symbolPerformance.slice(0, 5).map((item: any) => (
              <tr key={item.key} className="border-b border-gray-100 dark:border-gray-700/50">
                <td className="px-2 py-1">{item.label}</td>
                <td className="px-2 py-1">{item.trades}</td>
                <td className={`px-2 py-1 ${item.netPnl >= 0 ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                  {formatCurrency(item.netPnl, 'USD')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <EmptyState title="داده‌ای برای نمایش وجود ندارد" />;
}
