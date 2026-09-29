import {
  GitHubUser,
  GitHubRepo,
  GitHubCommit,
  GitHubBranch,
  GitHubIssue,
  RateLimitInfo,
} from '../types/github';

export const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  PHP: '#4F5D95',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Ruby: '#701516',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Shell: '#89e051',
  Dockerfile: '#384d54',
};

const BASE_URL = 'https://api.github.com';

function getHeaders(token?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token && token.trim()) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }
  return headers;
}

export async function fetchGitHubUser(tokenOrUsername: string, isToken: boolean): Promise<{ user: GitHubUser; rateLimit: RateLimitInfo; scopes: string[] }> {
  const url = isToken ? `${BASE_URL}/user` : `${BASE_URL}/users/${encodeURIComponent(tokenOrUsername)}`;
  const res = await fetch(url, {
    headers: isToken ? getHeaders(tokenOrUsername) : getHeaders(),
  });

  const rateLimit: RateLimitInfo = {
    limit: res.headers.get('x-ratelimit-limit'),
    remaining: res.headers.get('x-ratelimit-remaining'),
    reset: res.headers.get('x-ratelimit-reset'),
  };

  const rawScopes = res.headers.get('x-oauth-scopes') || '';
  const scopes = rawScopes.split(',').map((s) => s.trim()).filter(Boolean);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `خطا در دریافت اطلاعات کاربر (${res.status})`);
  }

  const user = await res.json();
  return { user, rateLimit, scopes };
}

export async function fetchUserRepos(
  tokenOrUsername: string,
  isToken: boolean,
  page: number = 1,
  perPage: number = 100
): Promise<GitHubRepo[]> {
  const url = isToken
    ? `${BASE_URL}/user/repos?per_page=${perPage}&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`
    : `${BASE_URL}/users/${encodeURIComponent(tokenOrUsername)}/repos?per_page=${perPage}&page=${page}&sort=updated`;

  const res = await fetch(url, {
    headers: isToken ? getHeaders(tokenOrUsername) : getHeaders(),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `خطا در دریافت مخازن (${res.status})`);
  }

  return res.json();
}

export async function fetchRepoCommits(owner: string, repo: string, token?: string | null): Promise<GitHubCommit[]> {
  const res = await fetch(`${BASE_URL}/repos/${owner}/${repo}/commits?per_page=15`, {
    headers: getHeaders(token),
  });

  if (!res.ok) {
    return [];
  }
  return res.json();
}

export async function fetchRepoBranches(owner: string, repo: string, token?: string | null): Promise<GitHubBranch[]> {
  const res = await fetch(`${BASE_URL}/repos/${owner}/${repo}/branches?per_page=20`, {
    headers: getHeaders(token),
  });

  if (!res.ok) {
    return [];
  }
  return res.json();
}

export async function fetchRepoIssues(owner: string, repo: string, token?: string | null): Promise<GitHubIssue[]> {
  const res = await fetch(`${BASE_URL}/repos/${owner}/${repo}/issues?state=open&per_page=15`, {
    headers: getHeaders(token),
  });

  if (!res.ok) {
    return [];
  }
  return res.json();
}

export async function fetchRepoReadme(owner: string, repo: string, token?: string | null): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/repos/${owner}/${repo}/readme`, {
    headers: {
      ...getHeaders(token),
      Accept: 'application/vnd.github.raw+json',
    },
  });

  if (!res.ok) {
    return null;
  }
  return res.text();
}

export async function createGitHubRepo(
  data: { name: string; description?: string; private: boolean; auto_init?: boolean },
  token: string
): Promise<GitHubRepo> {
  const res = await fetch(`${BASE_URL}/user/repos`, {
    method: 'POST',
    headers: {
      ...getHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'خطا در ایجاد مخزن جدید در گیت‌هاب');
  }

  return res.json();
}

export async function createGitHubIssue(
  owner: string,
  repo: string,
  data: { title: string; body?: string },
  token: string
): Promise<GitHubIssue> {
  const res = await fetch(`${BASE_URL}/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      ...getHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'خطا در ایجاد ایشو جدید');
  }

  return res.json();
}
