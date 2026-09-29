import React, { useState, useEffect } from 'react';
import {
  GitHubRepo,
  GitHubCommit,
  GitHubBranch,
  GitHubIssue,
} from '../types/github';
import {
  fetchRepoCommits,
  fetchRepoBranches,
  fetchRepoIssues,
  fetchRepoReadme,
  createGitHubIssue,
} from '../services/githubApi';
import {
  GitCommit,
  GitBranch,
  AlertCircle,
  FileText,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Plus,
  Terminal,
  ShieldAlert,
} from 'lucide-react';

interface RepoInspectorModalProps {
  repo: GitHubRepo | null;
  token: string | null;
  onClose: () => void;
}

export const RepoInspectorModal: React.FC<RepoInspectorModalProps> = ({
  repo,
  token,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'commits' | 'branches' | 'issues' | 'readme'>('commits');

  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [readme, setReadme] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [copiedCloneType, setCopiedCloneType] = useState<string | null>(null);

  // New Issue State
  const [showNewIssue, setShowNewIssue] = useState(false);
  const [issueTitle, setIssueTitle] = useState('');
  const [issueBody, setIssueBody] = useState('');
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  useEffect(() => {
    if (!repo) return;

    setLoading(true);
    const owner = repo.full_name.split('/')[0];
    const name = repo.name;

    Promise.allSettled([
      fetchRepoCommits(owner, name, token),
      fetchRepoBranches(owner, name, token),
      fetchRepoIssues(owner, name, token),
      fetchRepoReadme(owner, name, token),
    ]).then(([commitsRes, branchesRes, issuesRes, readmeRes]) => {
      if (commitsRes.status === 'fulfilled') setCommits(commitsRes.value);
      if (branchesRes.status === 'fulfilled') setBranches(branchesRes.value);
      if (issuesRes.status === 'fulfilled') setIssues(issuesRes.value);
      if (readmeRes.status === 'fulfilled') setReadme(readmeRes.value);
      setLoading(false);
    });
  }, [repo, token]);

  if (!repo) return null;

  const copyCommand = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCloneType(type);
    setTimeout(() => setCopiedCloneType(null), 2000);
  };

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setIssueError('برای ثبت ایشو نیاز به ورود با توکن دسترسی (Token) دارید.');
      return;
    }
    if (!issueTitle.trim()) {
      setIssueError('عنوان ایشو الزامی است.');
      return;
    }

    setIssueSubmitting(true);
    setIssueError(null);

    try {
      const owner = repo.full_name.split('/')[0];
      const newIssue = await createGitHubIssue(
        owner,
        repo.name,
        { title: issueTitle.trim(), body: issueBody.trim() },
        token
      );
      setIssues([newIssue, ...issues]);
      setIssueTitle('');
      setIssueBody('');
      setShowNewIssue(false);
    } catch (err: any) {
      setIssueError(err.message || 'خطا در ثبت ایشو');
    } finally {
      setIssueSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-mono text-sm">{repo.full_name.split('/')[0]} /</span>
              <h2 className="text-lg sm:text-xl font-bold text-white font-mono">{repo.name}</h2>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                  repo.private
                    ? 'bg-amber-950/60 text-amber-400 border-amber-800/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {repo.private ? 'مخزن خصوصی' : 'مخزن عمومی'}
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl line-clamp-1">
              {repo.description || 'بدون توضیحات ثبت شده'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <a
              href={repo.html_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              <span>مشاهده در GitHub</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Clone instructions bar */}
        <div className="px-5 py-3 bg-slate-950/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span className="text-slate-300 font-semibold">کلون این مخزن:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* HTTPS */}
            <div className="flex items-center bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300">
              <span className="text-slate-500 mr-1.5">HTTPS:</span>
              <span className="truncate max-w-[200px] sm:max-w-xs">{repo.clone_url}</span>
              <button
                onClick={() => copyCommand(`git clone ${repo.clone_url}`, 'https')}
                className="mr-2 text-slate-400 hover:text-white cursor-pointer"
                title="کپی دستور کلون"
              >
                {copiedCloneType === 'https' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* SSH */}
            <div className="flex items-center bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300">
              <span className="text-slate-500 mr-1.5">SSH:</span>
              <span className="truncate max-w-[160px] sm:max-w-xs">{repo.ssh_url}</span>
              <button
                onClick={() => copyCommand(`git clone ${repo.ssh_url}`, 'ssh')}
                className="mr-2 text-slate-400 hover:text-white cursor-pointer"
                title="کپی دستور SSH"
              >
                {copiedCloneType === 'ssh' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-5 gap-4 text-xs sm:text-sm font-medium">
          <button
            onClick={() => setActiveTab('commits')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'commits'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitCommit className="w-4 h-4" />
            <span>کامیت‌های اخیر ({commits.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('readme')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'readme'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>فایل README</span>
          </button>

          <button
            onClick={() => setActiveTab('branches')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'branches'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>شاخه‌ها ({branches.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('issues')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'issues'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>ایشوها ({issues.length})</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-xs">در حال بارگذاری اطلاعات از مخزن گیت‌هاب...</span>
            </div>
          ) : (
            <>
              {/* TAB: COMMITS */}
              {activeTab === 'commits' && (
                <div className="space-y-3">
                  {commits.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      کامیتی برای نمایش یافت نشد یا مخزن خالی است.
                    </div>
                  ) : (
                    commits.map((c) => {
                      const commitDate = new Date(c.commit.author.date).toLocaleDateString('fa-IR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      return (
                        <div
                          key={c.sha}
                          className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start justify-between gap-4 hover:border-slate-700 transition-colors"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-slate-200 font-mono line-clamp-2">
                              {c.commit.message}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              {c.author?.avatar_url && (
                                <img
                                  src={c.author.avatar_url}
                                  alt=""
                                  className="w-4 h-4 rounded-full"
                                />
                              )}
                              <span>{c.commit.author.name}</span>
                              <span>•</span>
                              <span>{commitDate}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-indigo-400">
                              {c.sha.slice(0, 7)}
                            </span>
                            <a
                              href={c.html_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-slate-400 hover:text-white"
                              title="مشاهده کامیت"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB: README */}
              {activeTab === 'readme' && (
                <div>
                  {readme ? (
                    <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 font-sans text-xs sm:text-sm leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono">
                      {readme}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      فایل README.md برای این مخزن یافت نشد.
                    </div>
                  )}
                </div>
              )}

              {/* TAB: BRANCHES */}
              {activeTab === 'branches' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {branches.length === 0 ? (
                    <div className="col-span-2 text-center py-12 text-slate-500 text-xs">
                      شاخه‌ای یافت نشد.
                    </div>
                  ) : (
                    branches.map((b) => (
                      <div
                        key={b.name}
                        className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <GitBranch className="w-4 h-4 text-indigo-400" />
                          <span className="font-mono text-xs sm:text-sm text-slate-200">{b.name}</span>
                          {b.name === repo.default_branch && (
                            <span className="text-[10px] bg-indigo-950/60 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-800/40">
                              شاخه‌ی پیش‌فرض
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">
                          {b.commit.sha.slice(0, 7)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB: ISSUES */}
              {activeTab === 'issues' && (
                <div className="space-y-4">
                  {/* Create Issue button / form */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      ایسوهای باز ({issues.length})
                    </span>
                    {token && (
                      <button
                        onClick={() => setShowNewIssue(!showNewIssue)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>ثبت ایشو جدید</span>
                      </button>
                    )}
                  </div>

                  {showNewIssue && (
                    <form
                      onSubmit={handleCreateIssue}
                      className="p-4 rounded-xl bg-slate-950 border border-indigo-900/40 space-y-3 animate-in fade-in"
                    >
                      <h4 className="font-bold text-xs sm:text-sm text-white">ایجاد ایشو جدید در گیت‌هاب</h4>
                      {issueError && (
                        <div className="p-2 rounded bg-rose-950 text-rose-300 text-xs">
                          {issueError}
                        </div>
                      )}
                      <div>
                        <input
                          type="text"
                          value={issueTitle}
                          onChange={(e) => setIssueTitle(e.target.value)}
                          placeholder="عنوان ایشو..."
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <textarea
                          rows={3}
                          value={issueBody}
                          onChange={(e) => setIssueBody(e.target.value)}
                          placeholder="توضیحات بیشتر (اختیاری)..."
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowNewIssue(false)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                        >
                          انصراف
                        </button>
                        <button
                          type="submit"
                          disabled={issueSubmitting}
                          className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5"
                        >
                          {issueSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>ارسال به گیت‌هاب</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {issues.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      هیچ ایشوی بازی برای این مخزن وجود ندارد.
                    </div>
                  ) : (
                    issues.map((issue) => (
                      <div
                        key={issue.id}
                        className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400 font-mono text-xs">#{issue.number}</span>
                            <h5 className="font-semibold text-xs sm:text-sm text-slate-200">
                              {issue.title}
                            </h5>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            توسط @{issue.user.login}
                          </div>
                        </div>

                        <a
                          href={issue.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-slate-400 hover:text-white"
                          title="مشاهده ایشو در گیت‌هاب"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
