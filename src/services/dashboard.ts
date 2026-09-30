// ============================================================
// Dashboard Layouts Service
// ============================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { MockStorage } from './mockStorage';
import type { DashboardLayout, DashboardLayoutInsert, DashboardLayoutUpdate, DashboardWidget } from '../types/database';

/**
 * Get all dashboard layouts for a user
 */
export async function getDashboardLayouts(userId: string): Promise<DashboardLayout[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const layout = await MockStorage.getDefaultDashboardLayout(userId);
    return [layout];
  }

  const { data, error } = await supabase
    .from('dashboard_layouts')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`خطا در دریافت چیدمان‌های داشبورد: ${error.message}`);
  }

  return data || [];
}

/**
 * Get default dashboard layout
 */
export async function getDefaultDashboardLayout(userId: string): Promise<DashboardLayout | null> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getDefaultDashboardLayout(userId);
  }

  const { data, error } = await supabase
    .from('dashboard_layouts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();

  if (error) {
    throw new Error(`خطا در دریافت چیدمان پیش‌فرض: ${error.message}`);
  }

  return data;
}

/**
 * Create a new dashboard layout
 */
export async function createDashboardLayout(input: DashboardLayoutInsert): Promise<DashboardLayout> {
  if (!isSupabaseConfigured || input.user_id === 'guest-demo-user') {
    const layout: DashboardLayout = {
      id: `layout-${Date.now()}`,
      user_id: input.user_id,
      name: input.name,
      is_default: input.is_default || false,
      layout_config: input.layout_config || DEFAULT_DASHBOARD_WIDGETS,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return MockStorage.updateDashboardLayout(layout);
  }

  const { data, error } = await supabase
    .from('dashboard_layouts')
    .insert(input)
    .select()
    .single();

  if (error) {
    throw new Error(`خطا در ایجاد چیدمان داشبورد: ${error.message}`);
  }

  return data;
}

/**
 * Update a dashboard layout
 */
export async function updateDashboardLayout(
  layoutId: string,
  userId: string,
  input: DashboardLayoutUpdate
): Promise<DashboardLayout> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const existing = await MockStorage.getDefaultDashboardLayout(userId);
    const updated: DashboardLayout = {
      ...existing,
      ...input,
      updated_at: new Date().toISOString(),
    };
    return MockStorage.updateDashboardLayout(updated);
  }

  const { data, error } = await supabase
    .from('dashboard_layouts')
    .update(input)
    .eq('id', layoutId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`خطا در به‌روزرسانی چیدمان داشبورد: ${error.message}`);
  }

  return data;
}

/**
 * Delete a dashboard layout
 */
export async function deleteDashboardLayout(layoutId: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return;
  }

  const { error } = await supabase
    .from('dashboard_layouts')
    .delete()
    .eq('id', layoutId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`خطا در حذف چیدمان داشبورد: ${error.message}`);
  }
}

/**
 * Add a widget to a dashboard layout
 */
export async function addWidgetToLayout(
  layoutId: string,
  userId: string,
  widget: DashboardWidget
): Promise<DashboardLayout> {
  const layout = await getDefaultDashboardLayout(userId);
  if (!layout) throw new Error('چیدمان پیش‌فرض یافت نشد');

  const updatedWidgets = [...(layout.layout_config || []), widget];
  return updateDashboardLayout(layoutId, userId, { layout_config: updatedWidgets });
}

/**
 * Remove a widget from a dashboard layout
 */
export async function removeWidgetFromLayout(
  layoutId: string,
  userId: string,
  widgetId: string
): Promise<DashboardLayout> {
  const layout = await getDefaultDashboardLayout(userId);
  if (!layout) throw new Error('چیدمان پیش‌فرض یافت نشد');

  const updatedWidgets = (layout.layout_config || []).filter(w => w.id !== widgetId);
  return updateDashboardLayout(layoutId, userId, { layout_config: updatedWidgets });
}

/**
 * Reorder widgets in a dashboard layout
 */
export async function reorderWidgetsInLayout(
  layoutId: string,
  userId: string,
  widgets: DashboardWidget[]
): Promise<DashboardLayout> {
  return updateDashboardLayout(layoutId, userId, { layout_config: widgets });
}

/**
 * Reset dashboard to default widgets
 */
export async function resetDashboardLayout(
  layoutId: string,
  userId: string,
  defaultWidgets: DashboardWidget[]
): Promise<DashboardLayout> {
  return updateDashboardLayout(layoutId, userId, { layout_config: defaultWidgets });
}

// --- Default Widgets ---

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidget[] = [
  {
    id: 'kpi-total-trades',
    type: 'kpi',
    title: 'کل معاملات',
    size: 'small',
    config: { metric: 'totalTrades' },
  },
  {
    id: 'kpi-win-rate',
    type: 'kpi',
    title: 'نرخ برد',
    size: 'small',
    config: { metric: 'winRate' },
  },
  {
    id: 'kpi-net-pnl',
    type: 'kpi',
    title: 'سود/زیان خالص',
    size: 'small',
    config: { metric: 'netPnl' },
  },
  {
    id: 'kpi-profit-factor',
    type: 'kpi',
    title: 'ضریب سود',
    size: 'small',
    config: { metric: 'profitFactor' },
  },
  {
    id: 'chart-equity',
    type: 'chart',
    title: 'منحنی سرمایه',
    size: 'large',
    config: { chartType: 'equity' },
  },
  {
    id: 'chart-daily-pnl',
    type: 'chart',
    title: 'سود/زیان روزانه',
    size: 'medium',
    config: { chartType: 'dailyPnl' },
  },
  {
    id: 'table-symbol',
    type: 'table',
    title: 'عملکرد نمادها',
    size: 'medium',
    config: { tableType: 'symbolPerformance' },
  },
];
