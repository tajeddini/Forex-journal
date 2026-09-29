import { useRouteError, useNavigate } from 'react-router-dom';
import { Button } from './ui/Button';

export function RouteErrorFallback() {
  const error = useRouteError() as any;
  const navigate = useNavigate();

  const errorMessage = error?.message || error?.statusText || 'خطای غیرمنتظره در بارگذاری صفحه رخ داد.';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4" dir="rtl">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center border border-gray-100 dark:border-gray-700">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          خطا در بارگذاری بخش مورد نظر
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {errorMessage.includes('Failed to fetch dynamically imported module')
            ? 'نسخه جدیدی از برنامه بارگذاری شده یا ارتباط موقتاً قطع شده است. لطفاً صفحه را تازه‌سازی کنید.'
            : errorMessage}
        </p>
        <div className="space-y-3">
          <Button
            className="w-full justify-center"
            onClick={() => window.location.reload()}
          >
            بارگذاری مجدد صفحه
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-center"
            onClick={() => navigate('/app/dashboard')}
          >
            بازگشت به داشبورد
          </Button>
        </div>
      </div>
    </div>
  );
}
