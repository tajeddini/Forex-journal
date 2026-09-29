// ============================================================
// Guest Login Page
// Allows users to enter demo mode with sample data
// ============================================================

import { useNavigate } from 'react-router-dom';
import { useGuest } from '../../contexts/GuestContext';
import { Button } from '../../components/ui/Button';

export default function GuestLoginPage() {
  const navigate = useNavigate();
  const { enterGuestMode } = useGuest();

  const handleEnterGuestMode = () => {
    enterGuestMode();
    navigate('/app/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 dark:bg-blue-500 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            ژورنال معاملاتی
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            نسخه دمو با داده‌های نمونه
          </p>
        </div>

        {/* Guest Mode Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              ورود به عنوان مهمان
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              با داده‌های نمونه آشنا شوید
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">دسترسی کامل</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">تمام قابلیت‌ها در دسترس هستند</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">داده‌های نمونه</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">معاملات، حساب‌ها و آنالیتیکس آماده</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">بدون نیاز به ثبت‌نام</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">فوری و بدون دردسر</p>
              </div>
            </div>
          </div>

          <Button onClick={handleEnterGuestMode} className="w-full">
            ورود به حالت مهمان
          </Button>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              داده‌های نمونه فقط برای نمایش هستند و ذخیره نمی‌شوند
            </p>
          </div>
        </div>

        {/* Back to Login */}
        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          حساب کاربری دارید؟{' '}
          <button
            onClick={() => navigate('/login')}
            className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
          >
            وارد شوید
          </button>
        </p>
      </div>
    </div>
  );
}
