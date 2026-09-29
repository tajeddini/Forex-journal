import React from 'react';
import { GitHubUser, AuthMode } from '../types/github';
import {
  MapPin,
  Building,
  Link as LinkIcon,
  Twitter,
  Users,
  BookOpen,
  FolderGit2,
  ExternalLink,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

interface ProfileCardProps {
  user: GitHubUser;
  authMode: AuthMode;
  scopes: string[];
}

export const ProfileCard: React.FC<ProfileCardProps> = ({ user, authMode, scopes }) => {
  const formattedDate = new Date(user.created_at).toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: 'long',
  });

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -z-0 pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* User Info */}
        <div className="flex items-start sm:items-center gap-4">
          <div className="relative shrink-0">
            <img
              src={user.avatar_url}
              alt={user.login}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-slate-700 shadow-md object-cover"
            />
            <span
              className={`absolute -bottom-1 -left-1 w-4 h-4 rounded-full border-2 border-slate-900 ${
                authMode === 'token' || authMode === 'oauth' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {user.name || user.login}
              </h2>
              <a
                href={user.html_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-800/40 transition-colors"
              >
                <span>@{user.login}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {user.bio && (
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                {user.bio}
              </p>
            )}

            {/* Meta tags */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400 pt-1">
              {user.company && (
                <div className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-slate-500" />
                  <span>{user.company}</span>
                </div>
              )}
              {user.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>{user.location}</span>
                </div>
              )}
              {user.blog && (
                <a
                  href={user.blog.startsWith('http') ? user.blog : `https://${user.blog}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-indigo-400 hover:underline"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[150px]">{user.blog}</span>
                </a>
              )}
              {user.twitter_username && (
                <a
                  href={`https://x.com/${user.twitter_username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-sky-400 hover:underline"
                >
                  <Twitter className="w-3.5 h-3.5" />
                  <span>@{user.twitter_username}</span>
                </a>
              )}
              <div className="flex items-center gap-1 text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>عضویت از {formattedDate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center min-w-[90px]">
            <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs mb-1">
              <FolderGit2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>مخازن</span>
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {user.total_private_repos
                ? user.public_repos + user.total_private_repos
                : user.public_repos}
            </div>
          </div>

          <div className="px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center min-w-[90px]">
            <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs mb-1">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span>دنبال‌کننده</span>
            </div>
            <div className="text-lg font-bold text-white font-mono">{user.followers}</div>
          </div>

          <div className="px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center min-w-[90px]">
            <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs mb-1">
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>دنبال‌شده</span>
            </div>
            <div className="text-lg font-bold text-white font-mono">{user.following}</div>
          </div>
        </div>
      </div>

      {/* Permissions / Mode strip */}
      <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-300 font-medium">سطح دسترسی:</span>
          <span className="text-slate-400">
            {authMode === 'token'
              ? scopes.length > 0
                ? `توکن شخصی با اسکوپ‌های (${scopes.join(', ')})`
                : 'توکن شخصی با دسترسی کامل'
              : authMode === 'oauth'
              ? 'ورود امن OAuth گیت‌هاب'
              : 'کاوشگر عمومی (فقط خواندنی)'}
          </span>
        </div>

        {authMode === 'public' && (
          <span className="text-amber-400 text-[11px] bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
            برای مشاهده مخازن خصوصی یا ایجاد مخزن، با توکن متصل شوید.
          </span>
        )}
      </div>
    </div>
  );
};
