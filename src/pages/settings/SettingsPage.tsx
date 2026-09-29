import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';

export default function SettingsPage() {
  const settingsItems = [
    {
      title: 'استراتژی‌ها',
      description: 'مدیریت استراتژی‌های معاملاتی خود',
      path: '/app/settings/strategies',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      title: 'ستاپ‌ها',
      description: 'مدیریت ستاپ‌های معاملاتی',
      path: '/app/settings/setups',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      title: 'تگ‌ها',
      description: 'مدیریت تگ‌های معاملاتی',
      path: '/app/settings/tags',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
    },
    {
      title: 'اشتباهات',
      description: 'مدیریت اشتباهات رایج معاملاتی',
      path: '/app/settings/mistakes',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">تنظیمات</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          مدیریت استراتژی‌ها، ستاپ‌ها، تگ‌ها و اشتباهات معاملاتی
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {settingsItems.map((item) => (
          <Link key={item.path} to={item.path}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {item.description}
                  </p>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">راهنما</h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              در این بخش می‌توانید استراتژی‌ها، ستاپ‌ها، تگ‌ها و اشتباهات معاملاتی خود را مدیریت کنید. 
              این موارد در ژورنال معاملات و آنالیتیکس استفاده می‌شوند.
            </p>
          </div>
        </div>
      </Card>

      {/* Supabase Connection Status Card */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2">وضعیت اتصال به پایگاه داده (Supabase)</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
          برنامه هم‌اکنون با ذخیره‌سازی ابری و دیتابیس درون‌حافظه‌ای پایدار (Local Storage & Mock Data) بدون نیاز به پیکربندی خارجی کار می‌کند. در صورت تمایل می‌توانید کلیدهای پروژه اختصاصی Supabase خود را متصل نمایید.
        </p>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span className="text-gray-700 dark:text-gray-300 font-medium">پایگاه داده محلی و دمو آماده فعالیت است</span>
        </div>
      </Card>
    </div>
  );
}
