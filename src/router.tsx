import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute';
import { LoadingPage } from './components/ui/Loading';
import { RouteErrorFallback } from './components/RouteErrorFallback';
import AppLayout from './components/layout/AppLayout';

// Resilient dynamic module loader with auto-retry and cache-bust recovery
function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      console.warn('Dynamic chunk import failed, attempting retry...', error);
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        return await factory();
      } catch (retryError) {
        const key = 'chunk_reload_attempt';
        const hasReloaded = sessionStorage.getItem(key);
        if (!hasReloaded) {
          sessionStorage.setItem(key, 'true');
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
        sessionStorage.removeItem(key);
        throw retryError;
      }
    }
  });
}

// Lazy-loaded pages with resilient loading
const LoginPage = lazyWithRetry(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazyWithRetry(() => import('./pages/auth/RegisterPage'));
const GuestLoginPage = lazyWithRetry(() => import('./pages/auth/GuestLoginPage'));
const AccountsPage = lazyWithRetry(() => import('./pages/accounts/AccountsPage'));
const AccountDetailPage = lazyWithRetry(() => import('./pages/accounts/AccountDetailPage'));
const ImportPage = lazyWithRetry(() => import('./pages/import/ImportPage'));
const TradesPage = lazyWithRetry(() => import('./pages/trades/TradesPage'));
const ManualTradePage = lazyWithRetry(() => import('./pages/trades/ManualTradePage'));
const TradeDetailPage = lazyWithRetry(() => import('./pages/trades/TradeDetailPage'));
const AnalyticsPage = lazyWithRetry(() => import('./pages/analytics/AnalyticsPage'));
const WhatIfPage = lazyWithRetry(() => import('./pages/analytics/WhatIfPage'));
const CalendarPage = lazyWithRetry(() => import('./pages/calendar/CalendarPage'));
const ReviewsPage = lazyWithRetry(() => import('./pages/reviews/ReviewsPage'));
const CustomDashboardPage = lazyWithRetry(() => import('./pages/dashboard/CustomDashboardPage'));
const StrategiesPage = lazyWithRetry(() => import('./pages/settings/StrategiesPage'));
const SetupsPage = lazyWithRetry(() => import('./pages/settings/SetupsPage'));
const TagsPage = lazyWithRetry(() => import('./pages/settings/TagsPage'));
const MistakesPage = lazyWithRetry(() => import('./pages/settings/MistakesPage'));
const JournalPage = lazyWithRetry(() => import('./pages/journal/JournalPage'));
const SettingsPage = lazyWithRetry(() => import('./pages/settings/SettingsPage'));

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingPage />}>
      {children}
    </Suspense>
  );
}

const router = createBrowserRouter([
  // Public routes
  {
    path: '/login',
    errorElement: <RouteErrorFallback />,
    element: (
      <PublicRoute>
        <SuspenseWrapper>
          <LoginPage />
        </SuspenseWrapper>
      </PublicRoute>
    ),
  },
  {
    path: '/register',
    errorElement: <RouteErrorFallback />,
    element: (
      <PublicRoute>
        <SuspenseWrapper>
          <RegisterPage />
        </SuspenseWrapper>
      </PublicRoute>
    ),
  },
  {
    path: '/guest',
    errorElement: <RouteErrorFallback />,
    element: (
      <PublicRoute>
        <SuspenseWrapper>
          <GuestLoginPage />
        </SuspenseWrapper>
      </PublicRoute>
    ),
  },

  // Protected routes
  {
    path: '/app',
    errorElement: <RouteErrorFallback />,
    element: (
      <ProtectedRoute>
        <SuspenseWrapper>
          <AppLayout />
        </SuspenseWrapper>
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/app/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <SuspenseWrapper>
            <CustomDashboardPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'accounts',
        element: (
          <SuspenseWrapper>
            <AccountsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'accounts/:accountId',
        element: (
          <SuspenseWrapper>
            <AccountDetailPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'trades',
        element: (
          <SuspenseWrapper>
            <TradesPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'trades/new',
        element: (
          <SuspenseWrapper>
            <ManualTradePage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'trades/:tradeId',
        element: (
          <SuspenseWrapper>
            <TradeDetailPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'journal',
        element: (
          <SuspenseWrapper>
            <JournalPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'import',
        element: (
          <SuspenseWrapper>
            <ImportPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'analytics',
        element: (
          <SuspenseWrapper>
            <AnalyticsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'analytics/what-if',
        element: (
          <SuspenseWrapper>
            <WhatIfPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'calendar',
        element: (
          <SuspenseWrapper>
            <CalendarPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'reviews',
        element: (
          <SuspenseWrapper>
            <ReviewsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'settings',
        element: (
          <SuspenseWrapper>
            <SettingsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'settings/strategies',
        element: (
          <SuspenseWrapper>
            <StrategiesPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'settings/setups',
        element: (
          <SuspenseWrapper>
            <SetupsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'settings/tags',
        element: (
          <SuspenseWrapper>
            <TagsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'settings/mistakes',
        element: (
          <SuspenseWrapper>
            <MistakesPage />
          </SuspenseWrapper>
        ),
      },
    ],
  },

  // Fallback route
  {
    path: '*',
    element: <Navigate to="/app/dashboard" replace />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
