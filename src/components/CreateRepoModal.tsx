import React, { useState } from 'react';
import { GitHubRepo } from '../types/github';
import { createGitHubRepo } from '../services/githubApi';
import { FolderGit2, Lock, Globe, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CreateRepoModalProps {
  isOpen: boolean;
  token: string | null;
  onClose: () => void;
  onRepoCreated: (newRepo: GitHubRepo) => void;
}

export const CreateRepoModal: React.FC<CreateRepoModalProps> = ({
  isOpen,
  token,
  onClose,
  onRepoCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [autoInit, setAutoInit] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('برای ایجاد مخزن جدید نیاز به اتصال با توکن معتبر گیت‌هاب است.');
      return;
    }
    if (!name.trim()) {
      setError('نام مخزن الزامی است.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const createdRepo = await createGitHubRepo(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          private: isPrivate,
          auto_init: autoInit,
        },
        token
      );
      onRepoCreated(createdRepo);
      onClose();
    } catch (err: any) {
      setError(err.message || 'خطا در ایجاد مخزن جدید در گیت‌هاب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/20">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">ایجاد مخزن جدید (Repository)</h3>
              <p className="text-xs text-slate-400">یک مخزن جدید مستقیماً روی حساب گیت‌هاب شما ساخته می‌شود</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-200">نام مخزن (Repository Name) *</label>
            <input
              type="text"
              dir="ltr"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. my-awesome-app"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-200">توضیحات (اختیاری)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیح کوتاه درباره هدف این مخزن..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Visibility toggle */}
          <div className="pt-2 space-y-2">
            <label className="block text-xs font-semibold text-slate-200">نوع دسترسی:</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                  !isPrivate
                    ? 'bg-indigo-950/40 border-indigo-500 text-white ring-1 ring-indigo-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1 text-xs font-bold text-slate-200">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span>عمومی (Public)</span>
                </div>
                <p className="text-[11px] text-slate-400">همه می‌توانند مخزن را ببینند</p>
              </button>

              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                  isPrivate
                    ? 'bg-indigo-950/40 border-indigo-500 text-white ring-1 ring-indigo-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1 text-xs font-bold text-slate-200">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>خصوصی (Private)</span>
                </div>
                <p className="text-[11px] text-slate-400">فقط شما و اعضای مجاز</p>
              </button>
            </div>
          </div>

          {/* Auto Init README */}
          <label className="flex items-center gap-2.5 pt-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={autoInit}
              onChange={(e) => setAutoInit(e.target.checked)}
              className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <span>ایجاد خودکار فایل اولیه README.md</span>
          </label>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>ایجاد مخزن در گیت‌هاب</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
