import React, { useState, useEffect } from 'react';
import {
  Github,
  Key,
  Shield,
  User,
  AlertCircle,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { fetchGitHubUser } from '../services/githubApi';
import { GitHubUser, RateLimitInfo, AuthMode } from '../types/github';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: {
    user: GitHubUser;
    token: string | null;
    mode: AuthMode;
    rateLimit: RateLimitInfo;
    scopes: string[];
  }) => void;
  defaultTab?: 'token' | 'oauth' | 'public';
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultTab = 'token',
}) => {
  const [activeTab, setActiveTab] = useState<'token' | 'oauth' | 'public'>(defaultTab);
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OAuth server status
  const [oauthStatus, setOauthStatus] = useState<{
    configured: boolean;
    appUrl: string;
  } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Pre-configured URLs from runtime context
  const devCallback = 'https://ais-dev-ugww374krr2faultzec26h-907593650628.europe-west2.run.app/auth/callback';
  const preCallback = 'https://ais-pre-ugww374krr2faultzec26h-907593650628.europe-west2.run.app/auth/callback';

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    // Check OAuth server status
    fetch('/api/auth/github/status')
      .then((res) => res.json())
      .then((data) => setOauthStatus(data))
      .catch(() => setOauthStatus({ configured: false, appUrl: '' }));
  }, []);

  // Listen for OAuth postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin if needed
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { token, user } = event.data;
        if (token && user) {
          onSuccess({
            user,
            token,
            mode: 'oauth',
            rateLimit: { limit: '5000', remaining: '4999', reset: null },
            scopes: ['repo', 'read:user', 'user:email'],
          });
          onClose();
        }
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setError(event.data.error || 'خطا در احراز هویت با گیت‌هاب');
        setLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSuccess, onClose]);

  if (!isOpen) return null;

  const handleConnectToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setError('لطفاً توکن دسترسی شخصی (Personal Access Token) خود را وارد کنید.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchGitHubUser(tokenInput.trim(), true);
      onSuccess({
        user: result.user,
        token: tokenInput.trim(),
        mode: 'token',
        rateLimit: result.rateLimit,
        scopes: result.scopes,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'توکن نامعتبر است یا منقضی شده است.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectPublic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) {
      setError('لطفاً نام کاربری گیت‌هاب را وارد کنید.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchGitHubUser(usernameInput.trim(), false);
      onSuccess({
        user: result.user,
        token: null,
        mode: 'public',
        rateLimit: result.rateLimit,
        scopes: [],
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'کاربر در گیت‌هاب یافت نشد.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/github/url');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'تنظیمات OAuth در سرور کامل نیست');
      }

      const { url } = await response.json();

      // Open OAuth provider directly in popup window
      const authWindow = window.open(url, 'github_oauth_popup', 'width=650,height=750');

      if (!authWindow) {
        setError('پنجره پاپ‌آپ توسط مرورگر مسدود شد. لطفاً پاپ‌آپ را مجاز کنید.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'خطا در شروع احراز هویت OAuth');
      setLoading(false);
    }
  };

  const copyUrl = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(id);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/20">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">اتصال به گیت‌هاب (GitHub)</h2>
              <p className="text-xs text-slate-400">روش اتصال مورد نظر خود را انتخاب فرمایید</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-slate-800 bg-slate-950/20 p-2 gap-1 text-xs sm:text-sm font-medium">
          <button
            onClick={() => {
              setActiveTab('token');
              setError(null);
            }}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'token'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>توکن شخصی (سریع)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('oauth');
              setError(null);
            }}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'oauth'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>ورود OAuth</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('public');
              setError(null);
            }}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'public'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <User className="w-4 h-4" />
            <span>بدون لاگین</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: TOKEN */}
          {activeTab === 'token' && (
            <form onSubmit={handleConnectToken} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-slate-200">
                    توکن دسترسی گیت‌هاب (Personal Access Token)
                  </label>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo,read:user,user:email&description=Google_AI_Studio_Hub"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
                  >
                    <span>ساخت توکن در گیت‌هاب</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    dir="ltr"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-4 py-2.5 pl-10 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 font-mono text-xs sm:text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  نکته: توکن‌های کلاسیک یا Fine-grained هر دو پشتیبانی می‌شوند. کافیست دسترسی <code className="text-indigo-300">repo</code> و <code className="text-indigo-300">read:user</code> فعال باشد.
                </p>
              </div>

              {/* Quick try options */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>آیا هنوز توکن ندارید؟</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  روی لینک «ساخت توکن در گیت‌هاب» در بالا کلیک کنید تا صفحه با مجوزهای آماده باز شود، دکمه Generate را بزنید و کد را اینجا قرار دهید. یا می‌توانید از تب «بدون لاگین» استفاده کنید.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>در حال اعتبارسنجی و اتصال...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>اتصال فوری به حساب</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: OAUTH */}
          {activeTab === 'oauth' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">وضعیت OAuth در سرور:</span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      oauthStatus?.configured
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                        : 'bg-amber-950 text-amber-400 border border-amber-800/50'
                    }`}
                  >
                    {oauthStatus?.configured ? 'آماده اتصال' : 'نیاز به تنظیم Client ID'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  احراز هویت استاندارد گیت‌هاب از طریق باز شدن پاپ‌آپ و تأیید هویت انجام می‌شود.
                </p>

                {oauthStatus?.configured ? (
                  <button
                    onClick={handleOAuthLogin}
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>در حال باز کردن درگاه ورود...</span>
                      </>
                    ) : (
                      <>
                        <Github className="w-4 h-4" />
                        <span>ورود مستقیم با گیت‌هاب (OAuth)</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-3 pt-1">
                    <div className="text-[11px] text-slate-400 space-y-2">
                      <p>
                        برای فعال‌سازی ورود OAuth، یک اپلیکیشن در <a href="https://github.com/settings/developers" target="_blank" rel="noreferrer" className="text-indigo-400 underline">GitHub Developer Settings</a> ایجاد کرده و متغیرهای <code className="text-indigo-300 font-mono">GITHUB_CLIENT_ID</code> و <code className="text-indigo-300 font-mono">GITHUB_CLIENT_SECRET</code> را تنظیم نمایید.
                      </p>
                      
                      <div className="space-y-1.5 font-mono text-[10px] bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                        <div className="text-slate-400 font-sans text-[11px]">آدرس Callback مورد نیاز در گیت‌هاب:</div>
                        <div className="flex items-center justify-between text-slate-200">
                          <span className="truncate max-w-[280px]">{devCallback}</span>
                          <button
                            onClick={() => copyUrl(devCallback, 'dev')}
                            className="p-1 hover:text-white transition-colors cursor-pointer"
                          >
                            {copiedUrl === 'dev' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <button
                        onClick={() => setActiveTab('token')}
                        className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5" />
                        <span>استفاده از روش توکن (بدون نیاز به تنظیم سرور)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PUBLIC USERNAME */}
          {activeTab === 'public' && (
            <form onSubmit={handleConnectPublic} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-200">
                  نام کاربری گیت‌هاب (GitHub Username)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    dir="ltr"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="e.g. torvalds, octocat, your-username"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 font-mono text-xs sm:text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  در این حالت بدون نیاز به وارد کردن هیچ رمزی، می‌توانید به مخازن عمومی دسترسی داشته باشید، کدهای کلون را دریافت کنید و کامیت‌ها را بازبینی کنید.
                </p>
              </div>

              {/* Sample Usernames */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-400 text-[11px]">نمونه‌های پیشنهادی:</span>
                {['torvalds', 'octocat', 'shadcn', 'gaearon'].map((user) => (
                  <button
                    key={user}
                    type="button"
                    onClick={() => setUsernameInput(user)}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] transition-colors cursor-pointer"
                  >
                    @{user}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>در حال دریافت اطلاعات عمومی...</span>
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4" />
                      <span>مشاهده مخازن این کاربر</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
