import React from 'react';
import { GitHubUser, RateLimitInfo, AuthMode } from '../types/github';
import { Github, LogOut, ExternalLink, Zap, ShieldCheck, User as UserIcon, BookOpen } from 'lucide-react';

interface HeaderProps {
  user: GitHubUser | null;
  authMode: AuthMode;
  rateLimit: RateLimitInfo | null;
  onDisconnect: () => void;
  onOpenGuide: () => void;
  onOpenConnect: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  authMode,
  rateLimit,
  onDisconnect,
  onOpenGuide,
  onOpenConnect,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-md shadow-indigo-500/20 text-white">
            <Github className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg tracking-tight text-white">
                اتصال و مدیریت گیت‌هاب
              </span>
              <span className="hidden sm:inline-block text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
                GitHub Hub
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              مرکز اتصال و کاوشگر مخازن GitHub در برنامه شما
            </p>
          </div>
        </div>

        {/* Actions / User */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Rate limit badge if available */}
          {rateLimit?.remaining && (
            <div
              title={`محدودیت درخواست‌های API گیت‌هاب: ${rateLimit.remaining} از ${rateLimit.limit}`}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>
                {rateLimit.remaining}/{rateLimit.limit}
              </span>
            </div>
          )}

          {/* Guide Button */}
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs sm:text-sm font-medium text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">راهنمای اتصال</span>
            <span className="sm:hidden">راهنما</span>
          </button>

          {/* User Status */}
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3 pl-1 sm:pl-2 border-r border-slate-800 pr-2 sm:pr-3">
              <a
                href={user.html_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-lg hover:bg-slate-900 transition-colors group"
              >
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-slate-700 ring-2 ring-indigo-500/20"
                />
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-white group-hover:text-indigo-400 transition-colors flex items-center gap-1">
                    {user.name || user.login}
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    @{user.login}
                  </div>
                </div>
              </a>

              {/* Mode indicator */}
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-md border hidden lg:inline-block ${
                  authMode === 'token' || authMode === 'oauth'
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
                    : 'bg-amber-950/60 text-amber-400 border-amber-800/40'
                }`}
              >
                {authMode === 'token'
                  ? 'Personal Token'
                  : authMode === 'oauth'
                  ? 'OAuth'
                  : 'Public Read-Only'}
              </span>

              {/* Disconnect Button */}
              <button
                onClick={onDisconnect}
                title="خروج و قطع اتصال"
                className="p-2 rounded-lg bg-slate-900 hover:bg-rose-950/50 hover:text-rose-400 text-slate-400 border border-slate-800 hover:border-rose-900/50 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenConnect}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs sm:text-sm shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Github className="w-4 h-4" />
              <span>اتصال به گیت‌هاب</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
