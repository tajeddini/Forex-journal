import React, { useState } from 'react';
import { GitHubRepo } from '../types/github';
import { LANGUAGE_COLORS } from '../services/githubApi';
import {
  Star,
  GitFork,
  Lock,
  Globe,
  ExternalLink,
  Code2,
  Copy,
  Check,
  Eye,
  Calendar,
} from 'lucide-react';

interface RepoCardProps {
  repo: GitHubRepo;
  onInspect: (repo: GitHubRepo) => void;
}

export const RepoCard: React.FC<RepoCardProps> = ({ repo, onInspect }) => {
  const [copiedClone, setCopiedClone] = useState(false);

  const langColor = repo.language ? LANGUAGE_COLORS[repo.language] || '#94a3b8' : null;

  const copyCloneUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`git clone ${repo.clone_url}`);
    setCopiedClone(true);
    setTimeout(() => setCopiedClone(false), 2000);
  };

  const updatedDate = new Date(repo.updated_at).toLocaleDateString('fa-IR', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      onClick={() => onInspect(repo)}
      className="rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 p-5 flex flex-col justify-between transition-all hover:shadow-xl hover:shadow-indigo-500/5 cursor-pointer group"
    >
      <div className="space-y-3">
        {/* Header: Title + Visibility Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {repo.private ? (
              <span className="p-1 rounded bg-amber-500/10 text-amber-400 shrink-0" title="مخزن خصوصی">
                <Lock className="w-3.5 h-3.5" />
              </span>
            ) : (
              <span className="p-1 rounded bg-slate-800 text-slate-400 shrink-0" title="مخزن عمومی">
                <Globe className="w-3.5 h-3.5" />
              </span>
            )}
            <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-indigo-400 transition-colors truncate font-mono">
              {repo.name}
            </h3>
          </div>

          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 border ${
              repo.private
                ? 'bg-amber-950/60 text-amber-400 border-amber-800/40'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/60'
            }`}
          >
            {repo.private ? 'خصوصی' : 'عمومی'}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px] leading-relaxed">
          {repo.description || 'بدون توضیحات ثبت‌شده'}
        </p>

        {/* Topics if available */}
        {repo.topics && repo.topics.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {repo.topics.slice(0, 3).map((topic) => (
              <span
                key={topic}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/40 text-indigo-300 border border-indigo-900/40"
              >
                #{topic}
              </span>
            ))}
            {repo.topics.length > 3 && (
              <span className="text-[10px] text-slate-500 px-1 py-0.5">
                +{repo.topics.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-4 mt-4 border-t border-slate-800/80 space-y-3">
        {/* Meta counters & language */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            {repo.language && (
              <div className="flex items-center gap-1.5 font-mono text-slate-300">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: langColor || '#94a3b8' }}
                />
                <span>{repo.language}</span>
              </div>
            )}

            <div className="flex items-center gap-1 hover:text-amber-400 transition-colors" title="ستاره‌ها">
              <Star className="w-3.5 h-3.5" />
              <span className="font-mono text-[11px]">{repo.stargazers_count}</span>
            </div>

            <div className="flex items-center gap-1 hover:text-purple-400 transition-colors" title="فورک‌ها">
              <GitFork className="w-3.5 h-3.5" />
              <span className="font-mono text-[11px]">{repo.forks_count}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <Calendar className="w-3 h-3" />
            <span>{updatedDate}</span>
          </div>
        </div>

        {/* Actions bar */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            onClick={copyCloneUrl}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800 transition-colors cursor-pointer"
            title="کپی دستور کلون git clone"
          >
            {copiedClone ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">کپی شد!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>کپی کلون</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-1.5">
            <a
              href={repo.html_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="مشاهده در گیت‌هاب"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={() => onInspect(repo)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 text-xs font-medium transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>مشاهده و بررسی</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
