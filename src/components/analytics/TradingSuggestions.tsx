// ============================================================
// Smart Trading Suggestions Component
// Analyzes trading metrics & data to provide actionable Persian advice
// ============================================================

import { useMemo } from 'react';
import type { AnalyticsResult } from '../../services/analytics/types';
import { Card, CardTitle, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { formatCurrency } from '../../utils/format';

export interface TradingSuggestionItem {
  id: string;
  category: 'risk' | 'strategy' | 'psychology' | 'timing' | 'symbol';
  categoryLabel: string;
  badgeVariant: 'default' | 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  impact: 'بالا' | 'متوسط' | 'بهینه‌سازی';
}

interface TradingSuggestionsProps {
  analytics?: AnalyticsResult | null;
  metrics?: any;
  drawdown?: any;
  symbolPerformance?: any[];
  sidePerformance?: any[];
  duration?: any;
  currency?: string;
}

export function TradingSuggestions({
  analytics,
  metrics: propMetrics,
  drawdown: propDrawdown,
  symbolPerformance: propSymbolPerformance,
  sidePerformance: propSidePerformance,
  duration: propDuration,
  currency: propCurrency = 'USD',
}: TradingSuggestionsProps) {
  const suggestions = useMemo<TradingSuggestionItem[]>(() => {
    const list: TradingSuggestionItem[] = [];
    const metrics = analytics?.metrics || propMetrics;
    const drawdown = analytics?.drawdown || propDrawdown;
    const symbolPerformance = analytics?.symbolPerformance || propSymbolPerformance || [];
    const sidePerformance = analytics?.sidePerformance || propSidePerformance || [];
    const duration = analytics?.duration || propDuration || {};
    const currency = analytics?.currency || propCurrency;

    if (!metrics) return list;

    // 1. Risk & Drawdown Suggestions
    if (drawdown && drawdown.maxDrawdownPercent !== null && drawdown.maxDrawdownPercent > 10) {
      list.push({
        id: 'dd-high',
        category: 'risk',
        categoryLabel: 'مدیریت ریسک',
        badgeVariant: 'danger',
        title: 'کنترل افت سرمایه (Drawdown)',
        description: `حداکثر افت سرمایه شما به ${drawdown.maxDrawdownPercent.toFixed(1)}٪ رسیده است. پیشنهاد اکید می‌شود حجم هر معامله را به حداکثر ۰.۵٪ تا ۱٪ بالانس محدود کنید تا از آسیب‌های متوالی جلوگیری شود.`,
        impact: 'بالا',
      });
    } else if (drawdown) {
      list.push({
        id: 'risk-optimal',
        category: 'risk',
        categoryLabel: 'مدیریت ریسک',
        badgeVariant: 'success',
        title: 'ثبات در کنترل ریسک',
        description: 'افت سرمایه شما در محدوده مجاز و ایمن حفظ شده است. ادامه پایبندی به حجم ثابت و حد ضرر منطقی به رشد پایدار حساب کمک خواهد کرد.',
        impact: 'بهینه‌سازی',
      });
    }

    // 2. Win Rate & Profit Factor Suggestions
    if (metrics.winRate !== null) {
      if (metrics.winRate < 45 && metrics.profitFactor !== null && metrics.profitFactor < 1.2) {
        list.push({
          id: 'winrate-low',
          category: 'strategy',
          categoryLabel: 'استراتژی ورود',
          badgeVariant: 'warning',
          title: 'ارتقای فیلترهای ورود به معامله',
          description: `نرخ برد فعلی (${metrics.winRate.toFixed(1)}٪) نشان می‌دهد نیاز به تایید فاکتورهای همپوشانی (Confluence) بیشتری دارید. از ورود به معاملات پرخطر و پیش‌بینی زودرس روند خودداری فرمایید.`,
          impact: 'بالا',
        });
      } else if (metrics.winRate >= 55) {
        list.push({
          id: 'winrate-good',
          category: 'strategy',
          categoryLabel: 'استراتژی',
          badgeVariant: 'success',
          title: 'افزایش نسبت سود به زیان (R:R)',
          description: `با نرخ برد عالی ${metrics.winRate.toFixed(1)}٪، اکنون بهترین زمان است که تارگت‌های قیمتی را بازتر بگذارید تا سود هر معامله افزایش یابد.`,
          impact: 'متوسط',
        });
      }
    }

    // 3. Symbol Performance Suggestions
    if (symbolPerformance.length > 0) {
      const best = [...symbolPerformance].sort((a, b) => b.netPnl - a.netPnl)[0];
      const worst = [...symbolPerformance].sort((a, b) => a.netPnl - b.netPnl)[0];

      if (best && best.netPnl > 0) {
        list.push({
          id: 'symbol-best',
          category: 'symbol',
          categoryLabel: 'نمادهای معاملاتی',
          badgeVariant: 'info',
          title: `تمرکز بر نماد سودآور ${best.label}`,
          description: `شما بیشترین بازدهی را روی نماد ${best.label} با سود ${formatCurrency(best.netPnl, currency)} ثبت کرده‌اید. اختصاص تمرکز اصلی به این دارایی بازدهی کلی را افزایش می‌دهد.`,
          impact: 'متوسط',
        });
      }

      if (worst && worst.netPnl < 0) {
        list.push({
          id: 'symbol-worst',
          category: 'symbol',
          categoryLabel: 'حذف جفت‌ارزهای پرضرر',
          badgeVariant: 'danger',
          title: `توقف معامله روی ${worst.label}`,
          description: `نماد ${worst.label} با زیان ${formatCurrency(Math.abs(worst.netPnl), currency)} ضعیف‌ترین نتیجه را رقم زده است. پیشنهاد می‌شود این نماد را موقتاً از واچ‌لیست حذف کنید یا استراتژی آن را در دمو بازنگری نمایید.`,
          impact: 'بالا',
        });
      }
    }

    // 4. Directional Bias Suggestions (Buy vs Sell)
    if (sidePerformance.length === 2) {
      const buy = sidePerformance.find(s => s.key === 'buy');
      const sell = sidePerformance.find(s => s.key === 'sell');
      if (buy && sell && buy.trades >= 3 && sell.trades >= 3) {
        if (buy.netPnl > 0 && sell.netPnl < 0) {
          list.push({
            id: 'side-bias-buy',
            category: 'timing',
            categoryLabel: 'جهت‌گیری بازار',
            badgeVariant: 'info',
            title: 'بازدهی برتر در معاملات خرید (Buy)',
            description: 'نتایج نشان می‌دهد در جهت صعودی بازار مهارت تحلیلی بهتری دارید. پیشنهاد می‌شود از گرفتن پوزیشن‌های خلاف روند در موقعیت‌های فروش پرهیز کنید.',
            impact: 'متوسط',
          });
        } else if (sell.netPnl > 0 && buy.netPnl < 0) {
          list.push({
            id: 'side-bias-sell',
            category: 'timing',
            categoryLabel: 'جهت‌گیری بازار',
            badgeVariant: 'info',
            title: 'بازدهی برتر در معاملات فروش (Sell)',
            description: 'پوزیشن‌های فروش شما سوددهی بسیار باکیفیت‌تری داشته‌اند. در تایم‌فریم‌های روزانه به دنبال ساختارهای نزولی باشید.',
            impact: 'متوسط',
          });
        }
      }
    }

    // 5. Psychology & Trade Duration
    if (duration.average !== null && duration.average < 180 && metrics.totalTrades >= 5) {
      list.push({
        id: 'duration-scalp',
        category: 'psychology',
        categoryLabel: 'روانشناسی معامله‌گری',
        badgeVariant: 'warning',
        title: 'مدیریت هیجان و خروج‌های زودهنگام',
        description: 'میانگین زمان ماندن در معامله کمتر از ۳ دقیقه است. این موضوع غالباً ناشی از استرس، خروج زودهنگام یا حرکات هیجانی است. اجازه دهید معاملات بر اساس تارگت تحلیلی به پایان برسند.',
        impact: 'متوسط',
      });
    }

    return list;
  }, [analytics, propMetrics, propDrawdown, propSymbolPerformance, propSidePerformance, propDuration, propCurrency]);

  if (suggestions.length === 0) return null;

  return (
    <Card className="border border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-br from-white via-indigo-50/20 to-blue-50/20 dark:from-gray-800 dark:via-gray-800 dark:to-indigo-950/20">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <CardTitle className="text-base text-gray-900 dark:text-gray-100">
              پیشنهادها و تحلیل‌های هوشمند معاملاتی
            </CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              توصیه‌های کاربردی شخصی‌سازی شده بر اساس عملکرد و سوابق معاملاتی شما
            </p>
          </div>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800">
          {suggestions.length} پیشنهاد فعال
        </span>
      </CardHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-2">
        {suggestions.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-xl bg-white/90 dark:bg-gray-800/90 border border-gray-100 dark:border-gray-700 shadow-xs hover:border-indigo-200 dark:hover:border-indigo-700 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <Badge variant={item.badgeVariant}>
                  {item.categoryLabel}
                </Badge>
                <span className="text-[11px] text-gray-400 dark:text-gray-400 flex items-center gap-1">
                  اولویت: <span className="font-medium text-gray-700 dark:text-gray-300">{item.impact}</span>
                </span>
              </div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
                {item.title}
              </h4>
              <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
