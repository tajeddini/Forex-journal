import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute';
import { LoadingPage } from './components/ui/Loading';
import AppLayout from './components/layout/AppLayout';

// Lazy-loaded pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const GuestLoginPage = lazy(() => import('./pages/auth/GuestLoginPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const AccountsPage = lazy(() => import('./pages/accounts/AccountsPage'));
const AccountDetailPage = lazy(() => import('./pages/accounts/AccountDetailPage'));
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage'));
const ImportPage = lazy(() => import('./pages/import/ImportPage'));
const TradesPage = lazy(() => import('./pages/trades/TradesPage'));
const TradeDetailPage = lazy(() => import('./pages/trades/TradeDetailPage'));
const AnalyticsPage = lazy(() => import('./pages/analytics/AnalyticsPage'));
const WhatIfPage = lazy(() => import('./pages/analytics/WhatIfPage'));
const CalendarPage = lazy(() => import('./pages/calendar/CalendarPage'));
const ReviewsPage = lazy(() => import('./pages/reviews/ReviewsPage'));
const CustomDashboardPage = lazy(() => import('./pages/dashboard/CustomDashboardPage'));
const StrategiesPage = lazy(() => import('./pages/settings/StrategiesPage'));
const SetupsPage = lazy(() => import('./pages/settings/SetupsPage'));
const TagsPage = lazy(() => import('./pages/settings/TagsPage'));
const MistakesPage = lazy(() => import('./pages/settings/MistakesPage'));
const JournalPage = lazy(() => import('./pages/journal/JournalPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));

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
        path: 'import',
        element: (
          <SuspenseWrapper>
            <ImportPage />
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

  // Root redirect
  {
    path: '/',
    element: <Navigate to="/app/dashboard" replace />,
  },

  // Catch-all
  {
    path: '*',
    element: <Navigate to="/app/dashboard" replace />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
