import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { ManualTradeForm } from '../../components/trades/ManualTradeForm';
import { Button } from '../../components/ui/Button';

export default function ManualTradePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultAccountId = searchParams.get('account') || undefined;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Breadcrumb & Action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/app/trades" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
            معاملات
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-gray-100 font-semibold">
            ثبت معامله دستی جدید
          </span>
        </div>
        <Link to="/app/import">
          <Button variant="outline" size="sm">
            ورود با فایل اکسل MT4/MT5
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="border-b border-gray-100 dark:border-gray-700/60 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">ثبت معامله دستی</CardTitle>
              <CardDescription className="mt-1">
                اطلاعات ورود و خروج معامله خود را بدون نیاز به فایل اکسل به سادگی وارد نمایید. پس از ذخیره می‌توانید مستقیماً تحلیل، احساسات و تصاویر چارت را در ژورنال معامله ثبت کنید.
              </CardDescription>
            </div>
            <div className="hidden sm:block text-3xl">
              ✍️
            </div>
          </div>
        </CardHeader>

        <div className="p-4 sm:p-6">
          <ManualTradeForm
            defaultAccountId={defaultAccountId}
            onCancel={() => navigate('/app/trades')}
            onSuccess={(trade, shouldOpenJournal) => {
              if (shouldOpenJournal) {
                navigate(`/app/trades/${trade.id}?tab=pretrade`);
              } else {
                navigate('/app/trades');
              }
            }}
          />
        </div>
      </Card>
    </div>
  );
}
