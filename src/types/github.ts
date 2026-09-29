export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  total_private_repos?: number;
  owned_private_repos?: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  clone_url: string;
  ssh_url: string;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  default_branch: string;
  topics?: string[];
  license?: {
    key: string;
    name: string;
    spdx_id: string;
  } | null;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  html_url: string;
  author: {
    login: string;
    avatar_url: string;
    html_url: string;
  } | null;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  body: string | null;
  user: {
    login: string;
    avatar_url: string;
  };
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
}

export interface RateLimitInfo {
  limit: string | null;
  remaining: string | null;
  reset: string | null;
}

export type AuthMode = 'token' | 'oauth' | 'public' | 'none';
