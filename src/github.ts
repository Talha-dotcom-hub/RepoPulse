export type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  homepage?: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  language: string | null;
  default_branch: string;
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
  topics?: string[];
  license?: { name: string; spdx_id: string | null } | null;
  archived?: boolean;
  disabled?: boolean;
  fork?: boolean;
  size?: number;
  visibility?: string;
  has_issues?: boolean;
  has_discussions?: boolean;
};

export type GitHubCommit = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; email?: string; date: string | null } | null;
    committer: { name: string; email?: string; date: string | null } | null;
  };
  author: { login: string; avatar_url: string; html_url: string } | null;
};

export type GitHubContributor = {
  login?: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  html_url?: string;
  contributions: number;
};

export type GitHubPull = {
  number: number;
  html_url: string;
  title: string;
  body?: string | null;
  state: 'open' | 'closed';
  draft?: boolean;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  user: { login: string } | null;
  comments?: number;
  additions?: number;
  deletions?: number;
  changed_files?: number;
};

export type GitHubIssue = {
  number: number;
  html_url: string;
  title: string;
  body?: string | null;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  user: { login: string } | null;
  comments?: number;
  labels?: Array<{ name: string; color: string }>;
  pull_request?: unknown;
};

export type GitHubRelease = {
  id: number;
  html_url: string;
  tag_name: string;
  name: string | null;
  body?: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string | null;
  author: { login: string; html_url: string } | null;
  assets?: Array<{ name: string; download_count: number; browser_download_url: string; size: number }>;
};

export type GitHubBranch = {
  name: string;
  protected: boolean;
  commit: { sha: string; url: string };
};

export type GitHubTag = {
  name: string;
  zipball_url: string;
  tarball_url: string;
  commit: { sha: string; url: string };
};

export type WeeklyActivity = {
  weekStart: string;
  label: string;
  total: number;
  days: number[];
};
export type LanguageShare = { language: string; bytes: number; percentage: number };

export type RepositoryReport = {
  repository: GitHubRepository;
  activity: WeeklyActivity[];
  activityTotal: number;
  activityStatus: 'ready' | 'pending' | 'unavailable';
  languages: LanguageShare[];
  languageTotalBytes: number;
  fetchedAt: string;
  dataNotes: string[];
};

export type DetailKind = 'commits' | 'contributors' | 'pulls' | 'issues' | 'releases' | 'tags' | 'branches';
export type PageResult<T> = {
  items: T[];
  page: number;
  perPage: number;
  hasNext: boolean;
  hasPrevious: boolean;
  totalPages?: number;
  rawCount: number;
};

const API_ROOT = 'https://api.github.com';
const API_VERSION = '2026-03-10';
const REQUEST_TIMEOUT_MS = 15_000;

type GitHubResponse<T> = { data: T | null; response: Response };

export function parseRepositoryInput(input: string): { owner: string; repo: string } {
  const clean = input.trim().replace(/\/$/, '');
  if (!clean) throw new Error('Enter a public GitHub repository URL or owner/repository.');

  let owner = '';
  let repo = '';
  if (/^https?:\/\//i.test(clean)) {
    let url: URL;
    try {
      url = new URL(clean);
    } catch {
      throw new Error('That URL does not look valid. Try https://github.com/owner/repository.');
    }
    if (url.hostname.toLowerCase() !== 'github.com' && url.hostname.toLowerCase() !== 'www.github.com') {
      throw new Error('Please enter a github.com repository URL.');
    }
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) throw new Error('Include both the owner and repository name.');
    [owner, repo] = parts;
  } else {
    const parts = clean.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    if (parts.length !== 2) throw new Error('Use owner/repository, such as vercel/next.js.');
    [owner, repo] = parts;
  }
  repo = repo.replace(/\.git$/i, '');
  if (
    !/^[a-zA-Z0-9_.-]+$/.test(owner) ||
    !/^[a-zA-Z0-9_.-]+$/.test(repo) ||
    owner === '.' || owner === '..' || repo === '.' || repo === '..'
  ) {
    throw new Error('That repository name contains unsupported characters.');
  }
  return { owner, repo };
}

async function githubResponse(path: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': API_VERSION },
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) throw new Error('GitHub did not respond within 15 seconds. Please try again.');
    throw new Error('Could not reach GitHub. Check your connection and try again.');
  } finally {
    globalThis.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let message = `GitHub returned ${response.status}.`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Some API errors have no JSON response body.
    }
    if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
      throw new Error('GitHub public API rate limit reached. Wait a little and try again. No data has been fabricated.');
    }
    if (response.status === 404) throw new Error('Repository not found, private, or inaccessible. Check the owner and repository name.');
    if (response.status === 409) throw new Error('GitHub cannot return this data yet, often because the repository is empty.');
    if (response.status === 422) throw new Error('GitHub could not process this request. The repository may be very large or the request may be invalid.');
    throw new Error(message);
  }
  return response;
}

async function githubGetWithResponse<T>(path: string): Promise<GitHubResponse<T>> {
  const response = await githubResponse(path);
  if (response.status === 202 || response.status === 204) return { data: null, response };
  return { data: (await response.json()) as T, response };
}

async function githubGet<T>(path: string): Promise<T> {
  const result = await githubGetWithResponse<T>(path);
  if (result.data === null) throw new Error('GitHub returned no data for this request. Try again shortly.');
  return result.data;
}

const wait = (ms: number) => new Promise((resolve) => globalThis.setTimeout(resolve, ms));

async function getWeeklyActivity(root: string): Promise<{ activity: WeeklyActivity[]; status: RepositoryReport['activityStatus']; message?: string }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, response } = await githubGetWithResponse<Array<{ week: number; total: number; days: number[] }>>(`${root}/stats/commit_activity`);
    if (response.status === 200 && data) {
      const activity = data.map((item) => {
        const date = new Date(item.week * 1000);
        return {
          weekStart: date.toISOString().slice(0, 10),
          label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
          total: Number.isFinite(item.total) ? item.total : 0,
          days: Array.isArray(item.days) ? item.days : [],
        };
      }).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
      return { activity, status: 'ready' };
    }
    if (response.status === 204) return { activity: [], status: 'unavailable', message: 'GitHub returned no weekly statistics body for this repository during this request.' };
    if (response.status === 202 && attempt < 2) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 2500) : 700 * (attempt + 1);
      await wait(delay);
      continue;
    }
    if (response.status === 202) return { activity: [], status: 'pending', message: 'GitHub is still calculating commit statistics. Re-run the analysis in a moment; the activity chart is deliberately marked pending.' };
    return { activity: [], status: 'unavailable', message: 'GitHub weekly commit statistics were not available in this response.' };
  }
  return { activity: [], status: 'pending', message: 'GitHub is still calculating commit statistics. Re-run the analysis in a moment.' };
}

function lastPageFromLink(link: string | null): number | undefined {
  if (!link) return undefined;
  const segments = link.split(',');
  for (const segment of segments) {
    if (!/rel="last"/.test(segment)) continue;
    const match = segment.match(/<([^>]+)>/);
    if (!match) continue;
    try {
      const page = Number(new URL(match[1]).searchParams.get('page'));
      if (Number.isInteger(page) && page > 0) return page;
    } catch {
      // Ignore a malformed pagination header and fall back to page-by-page detection.
    }
  }
  return undefined;
}

function pageHasNext(link: string | null, currentPage: number, pageLength: number, perPage: number): boolean {
  if (link) {
    const segments = link.split(',');
    if (segments.some((segment) => /rel="next"/.test(segment))) return true;
    if (segments.some((segment) => /rel="last"/.test(segment))) return false;
  }
  return pageLength >= perPage && currentPage < 100_000;
}

export async function fetchRepositoryPage(kind: 'commits', fullName: string, page: number, ref?: string): Promise<PageResult<GitHubCommit>>;
export async function fetchRepositoryPage(kind: 'contributors', fullName: string, page: number): Promise<PageResult<GitHubContributor>>;
export async function fetchRepositoryPage(kind: 'pulls', fullName: string, page: number): Promise<PageResult<GitHubPull>>;
export async function fetchRepositoryPage(kind: 'issues', fullName: string, page: number): Promise<PageResult<GitHubIssue>>;
export async function fetchRepositoryPage(kind: 'releases', fullName: string, page: number): Promise<PageResult<GitHubRelease>>;
export async function fetchRepositoryPage(kind: 'tags', fullName: string, page: number): Promise<PageResult<GitHubTag>>;
export async function fetchRepositoryPage(kind: 'branches', fullName: string, page: number): Promise<PageResult<GitHubBranch>>;
export async function fetchRepositoryPage(kind: DetailKind, fullName: string, page: number, ref?: string): Promise<PageResult<GitHubCommit | GitHubContributor | GitHubPull | GitHubIssue | GitHubRelease | GitHubTag | GitHubBranch>>;
export async function fetchRepositoryPage(kind: DetailKind, fullName: string, page: number, ref?: string): Promise<PageResult<GitHubCommit | GitHubContributor | GitHubPull | GitHubIssue | GitHubRelease | GitHubTag | GitHubBranch>> {
  const { owner, repo } = parseRepositoryInput(fullName);
  const root = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const safePage = Math.max(1, Math.floor(page));
  const perPage = kind === 'contributors' || kind === 'branches' ? 100 : 30;
  let path: string;

  switch (kind) {
    case 'commits': path = `${root}/commits?per_page=${perPage}&page=${safePage}${ref?.trim() ? `&sha=${encodeURIComponent(ref.trim())}` : ''}`; break;
    case 'contributors': path = `${root}/contributors?anon=1&per_page=${perPage}&page=${safePage}`; break;
    case 'pulls': path = `${root}/pulls?state=all&sort=updated&direction=desc&per_page=${perPage}&page=${safePage}`; break;
    case 'issues': path = `${root}/issues?state=all&sort=updated&direction=desc&per_page=${perPage}&page=${safePage}`; break;
    case 'releases': path = `${root}/releases?per_page=${perPage}&page=${safePage}`; break;
    case 'tags': path = `${root}/tags?per_page=${perPage}&page=${safePage}`; break;
    case 'branches': path = `${root}/branches?per_page=${perPage}&page=${safePage}`; break;
  }

  const { data, response } = await githubGetWithResponse<Array<GitHubCommit | GitHubContributor | GitHubPull | GitHubIssue | GitHubRelease | GitHubTag | GitHubBranch>>(path);
  const rawItems = data ?? [];
  // The issues endpoint includes pull requests in the response; this view intentionally excludes them.
  const items = kind === 'issues' ? rawItems.filter((item) => !('pull_request' in item && item.pull_request)) : rawItems;
  const link = response.headers.get('link');
  const hasNext = pageHasNext(link, safePage, rawItems.length, perPage);
  const totalPages = kind === 'issues' ? undefined : lastPageFromLink(link);
  return {
    items,
    page: safePage,
    perPage,
    hasNext,
    hasPrevious: safePage > 1,
    ...(totalPages ? { totalPages } : {}),
    rawCount: rawItems.length,
  } as PageResult<GitHubCommit | GitHubContributor | GitHubPull | GitHubIssue | GitHubRelease | GitHubTag | GitHubBranch>;
}

export async function analyzeRepository(input: string): Promise<RepositoryReport> {
  const { owner, repo } = parseRepositoryInput(input);
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  const root = `/repos/${encodedOwner}/${encodedRepo}`;
  const repository = await githubGet<GitHubRepository>(root);

  const [languagesResult, activityResult] = await Promise.allSettled([
    githubGet<Record<string, number>>(`${root}/languages`),
    getWeeklyActivity(root),
  ]);

  const rawLanguages = languagesResult.status === 'fulfilled' ? languagesResult.value : {};
  const languageTotalBytes = Object.values(rawLanguages).reduce((sum, value) => sum + (Number.isFinite(value) && value > 0 ? value : 0), 0);
  const languages = Object.entries(rawLanguages)
    .map(([language, bytes]) => ({ language, bytes, percentage: languageTotalBytes ? (bytes / languageTotalBytes) * 100 : 0 }))
    .sort((a, b) => b.bytes - a.bytes);

  const activityResultValue = activityResult.status === 'fulfilled'
    ? activityResult.value
    : { activity: [], status: 'unavailable' as const, message: activityResult.reason instanceof Error ? activityResult.reason.message : 'Weekly commit statistics could not be loaded.' };
  const activityTotal = activityResultValue.activity.reduce((sum, item) => sum + item.total, 0);
  const notes = [
    'Repository metadata is from GitHub REST API and reflects the time of this request.',
    'The activity series uses GitHub’s official last-year weekly commit statistics endpoint. It is not a lifetime total. The commit explorer is paginated and defaults to the repository default branch; use its ref field to inspect another branch, tag, or SHA.',
    'The commits, contributors, pull requests, issues, releases, tags, and branches sections are paginated. Navigate to later pages to browse all records GitHub makes available to this public API request.',
    'Contributor attribution is provided by GitHub. Anonymous contributors are requested too; GitHub notes that only the first 500 author email addresses can be linked to GitHub users for contributor statistics, and contributor data may be cached for a few hours. Remaining authors may appear anonymously.',
    'The language endpoint reports bytes by language, not an exact percentage of meaningful source lines or code quality.',
    'Unauthenticated public REST API requests are rate-limited (normally 60 requests per hour per originating IP). If a rate limit or a permissions error occurs, the relevant section will show an error instead of fabricating zero-valued results.',
  ];
  if (languagesResult.status === 'rejected') notes.push('Language data could not be fetched for this request. The language chart is empty because the API call failed, not because the repository has no languages.');
  if (activityResultValue.message) notes.push(activityResultValue.message);

  return {
    repository,
    activity: activityResultValue.activity,
    activityTotal,
    activityStatus: activityResultValue.status,
    languages,
    languageTotalBytes,
    fetchedAt: new Date().toISOString(),
    dataNotes: notes,
  };
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return 'Not available';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'Not available';
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30.4375);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(days / 365.25);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}
