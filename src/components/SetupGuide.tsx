import React, { useState } from 'react';
import {
  Key,
  Shield,
  Copy,
  Check,
  ExternalLink,
  Code2,
  Terminal,
  Layers,
  HelpCircle,
  Sparkles,
  GitBranch,
} from 'lucide-react';

interface SetupGuideProps {
  onSelectTokenMethod: () => void;
  onSelectOAuthMethod: () => void;
  onSelectPublicMethod: () => void;
}

export const SetupGuide: React.FC<SetupGuideProps> = ({
  onSelectTokenMethod,
  onSelectOAuthMethod,
  onSelectPublicMethod,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Pre-configured URLs from runtime context
  const devCallback = 'https://ais-dev-ugww374krr2faultzec26h-907593650628.europe-west2.run.app/auth/callback';
  const preCallback = 'https://ais-pre-ugww374krr2faultzec26h-907593650628.europe-west2.run.app/auth/callback';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-2">
      {/* Intro hero banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-purple-950/40 border border-indigo-900/40 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-xs font-medium text-indigo-300">
              <Sparkles className="w-3.5 h-3.5" />
              راهنمای جامع اتصال گیت‌هاب
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              چگونه گیت‌هاب خود را به این برنامه وصل کنید؟
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              شما می‌توانید به ۴ روش مختلف حساب، ریپازیتوری‌ها یا کدهای گیت‌هاب خود را به این سایت و سامانه متصل کنید. در زیر روش‌های مختلف توضیح داده شده‌اند:
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-col gap-2.5 w-full md:w-auto shrink-0">
            <button
              onClick={onSelectTokenMethod}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Key className="w-4 h-4" />
              اتصال سریع با توکن شخصی (توصیه شده)
            </button>
            <button
              onClick={onSelectPublicMethod}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              کاوش بدون نیاز به لاگین
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Methods */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Method 1: Personal Access Token */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 flex flex-col justify-between hover:border-indigo-500/40 transition-all shadow-md group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                ۱
              </span>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                سریع‌ترین روش (زیر ۳۰ ثانیه)
              </span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-400" />
                توکن دسترسی شخصی (Personal Access Token)
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                این روش ساده‌ترین روش برای توسعه‌دهندگان است. نیازی به تنظیم سرور ندارد و مستقیماً به API رسمی گیت‌هاب متصل می‌شود.
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-400 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <div className="font-semibold text-slate-200 mb-1">مراحل انجام:</div>
              <ol className="list-decimal list-inside space-y-1.5 leading-relaxed text-slate-300">
                <li>وارد بخش تنظیمات توکن در گیت‌هاب شوید.</li>
                <li>
                  مجوزهای <code className="text-indigo-300 bg-indigo-950/80 px-1 py-0.5 rounded font-mono">repo</code> و <code className="text-indigo-300 bg-indigo-950/80 px-1 py-0.5 rounded font-mono">read:user</code> را علامت بزنید.
                </li>
                <li>دکمه Generate Token را زده و توکن را کپی کنید.</li>
                <li>در تب اتصال برنامه پیست کنید!</li>
              </ol>
            </div>
          </div>

          <div className="pt-5 mt-4 border-t border-slate-800/80 flex items-center gap-3">
            <a
              href="https://github.com/settings/tokens/new?scopes=repo,read:user,user:email&description=AI_Studio_Hub_Connector"
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-2 px-3 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>ساخت توکن در گیت‌هاب</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={onSelectTokenMethod}
              className="py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-colors cursor-pointer"
            >
              اتصال با توکن
            </button>
          </div>
        </div>

        {/* Method 2: GitHub OAuth App */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 flex flex-col justify-between hover:border-purple-500/40 transition-all shadow-md group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                ۲
              </span>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-purple-950/60 text-purple-300 border border-purple-800/40">
                ورود با یک کلیک (OAuth)
              </span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-400" />
                احراز هویت وب (GitHub OAuth App)
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                ورود رسمی با کلیک روی دکمه ورود گیت‌هاب و باز شدن پنجره احراز هویت بدون نیاز به اشتراک‌گذاری دستی رمز یا توکن.
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-400 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <div className="font-semibold text-slate-200 mb-1">تنظیمات در Developer Settings:</div>
              <p className="text-slate-300 text-[11px]">
                اگر می‌خواهید OAuth را فعال کنید، یک OAuth App جدید در گیت‌هاب بسازید و نشانی‌های بازگشت (Callback URLs) زیر را در آن قرار دهید:
              </p>
              
              {/* Copyable dev callback */}
              <div className="pt-1 space-y-1.5 font-mono text-[11px]">
                <div className="text-[10px] text-slate-400 font-sans">نشانی Callback محیط توسعه (Dev):</div>
                <div className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800 text-slate-300">
                  <span className="truncate max-w-[200px] sm:max-w-xs">{devCallback}</span>
                  <button
                    onClick={() => copyToClipboard(devCallback, 'dev')}
                    className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="کپی"
                  >
                    {copiedKey === 'dev' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="text-[10px] text-slate-400 font-sans">نشانی Callback محیط عمومی (Shared):</div>
                <div className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800 text-slate-300">
                  <span className="truncate max-w-[200px] sm:max-w-xs">{preCallback}</span>
                  <button
                    onClick={() => copyToClipboard(preCallback, 'pre')}
                    className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="کپی"
                  >
                    {copiedKey === 'pre' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-5 mt-4 border-t border-slate-800/80 flex items-center gap-3">
            <a
              href="https://github.com/settings/applications/new"
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-2 px-3 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>ثبت OAuth App در گیت‌هاب</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={onSelectOAuthMethod}
              className="py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow transition-colors cursor-pointer"
            >
              ورود با OAuth
            </button>
          </div>
        </div>

        {/* Method 3: Public Username Explorer */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 flex flex-col justify-between hover:border-amber-500/40 transition-all shadow-md group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                ۳
              </span>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/40">
                حالت بدون لاگین
              </span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors flex items-center gap-2">
                <Code2 className="w-5 h-5 text-amber-400" />
                مشاهده و کاوش با یوزرنیم عمومی (Public Explorer)
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                اگر فقط می‌خواهید مخازن عمومی، زبان‌ها، فایل‌های README و کامیت‌های خود یا هر کاربر دیگر در گیت‌هاب را بررسی کنید، نیازی به لاگین ندارید.
              </p>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <div className="font-semibold text-slate-200">مزایا:</div>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>هیچ نیازی به رمز یا توکن ندارد.</li>
                <li>امکان سرچ بین ریپازیتوری‌های پابلیک.</li>
                <li>کپی دستورات Clone و مشاهده کامل کامیت‌ها.</li>
              </ul>
            </div>
          </div>

          <div className="pt-5 mt-4 border-t border-slate-800/80">
            <button
              onClick={onSelectPublicMethod}
              className="w-full py-2 px-3 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors cursor-pointer text-center"
            >
              امتحان با نام کاربری عمومی
            </button>
          </div>
        </div>

        {/* Method 4: AI Studio Export to GitHub */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 flex flex-col justify-between hover:border-cyan-500/40 transition-all shadow-md group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                ۴
              </span>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
                سینک کد پروژه
              </span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-cyan-400" />
                ارسال و سینک کدهای این پروژه در گیت‌هاب
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                آیا می‌خواهید کدهای همین برنامه‌ای که در آن هستید را در یک ریپازیتوری گیت‌هاب ذخیره کنید؟
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-300 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <div className="font-semibold text-slate-200">دستورات Push سریع:</div>
              <div className="bg-slate-900 p-2.5 rounded font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed border border-slate-800">
                <div>git remote add origin https://github.com/USERNAME/REPO.git</div>
                <div>git branch -M main</div>
                <div>git push -u origin main</div>
              </div>
            </div>
          </div>

          <div className="pt-5 mt-4 border-t border-slate-800/80">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>می‌توانید همینجا یک مخزن جدید در گیت‌هاب خود بسازید!</span>
            </div>
          </div>
        </div>
      </div>

      {/* Helpful FAQ Section */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800/90 p-6 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-indigo-400" />
          پرسش‌های متداول (FAQ)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 space-y-1.5">
            <h4 className="font-semibold text-white">آیا توکن من در سرور ذخیره می‌شود؟</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              خیر. توکن شما تنها در مرورگر شما نگهداری می‌شود و مستقیماً برای درخواست‌ها به سرورهای رسمی گیت‌هاب (api.github.com) فرستاده می‌شود.
            </p>
          </div>

          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 space-y-1.5">
            <h4 className="font-semibold text-white">کدام اسکوپ‌ها (Scopes) مورد نیاز است؟</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              اسکوپ <code className="text-indigo-300">repo</code> برای خواندن و ایجاد مخازن (عمومی و خصوصی) و <code className="text-indigo-300">read:user</code> برای دریافت اطلاعات پروفایل شما کافی است.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
