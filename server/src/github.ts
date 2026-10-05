import { AppError } from "./errors.js";

const API_ROOT = "https://api.github.com";
const USER_AGENT = "prlens/1.0 (AI PR reviewer)";

/** Minimal JSON shapes returned by the GitHub REST API. */
export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string | null;
  user: { login: string; avatar_url: string } | null;
  state: "open" | "closed";
  locked: boolean;
  merged: boolean;
  mergeable: boolean | null;
  additions: number;
  deletions: number;
  changed_files: number;
  commits: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  base: { ref: string; label: string; sha: string };
  head: { ref: string; label: string; sha: string };
}

export interface GitHubPullFile {
  sha: string;
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

export interface GitHubCommit {
  sha: string;
  commit: { message: string; author: { name?: string } | null };
  author: { login: string; avatar_url: string } | null;
}

function isGitHubPullRequest(value: unknown): value is GitHubPullRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as GitHubPullRequest).number === "number" &&
    typeof (value as GitHubPullRequest).title === "string" &&
    typeof (value as GitHubPullRequest).html_url === "string"
  );
}

function isGitHubPullFile(value: unknown): value is GitHubPullFile {
  return typeof value === "object" && value !== null && typeof (value as GitHubPullFile).filename === "string";
}

function isGitHubCommit(value: unknown): value is GitHubCommit {
  return typeof value === "object" && value !== null && typeof (value as GitHubCommit).sha === "string";
}

function parseLinkHeader(header: string | null): Record<string, string> {
  const links: Record<string, string> = {};
  if (!header) return links;
  for (const part of header.split(",")) {
    const match = /<([^>]+)>;\s*rel="([^"]+)"/.exec(part.trim());
    if (match && match[1] && match[2]) links[match[2]] = match[1];
  }
  return links;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Client for the GitHub REST API using plain fetch. */
export class GitHubClient {
  readonly token?: string;

  constructor(token?: string) {
    this.token = token;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": USER_AGENT,
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }

  private async fetchJson(path: string, attempt = 0): Promise<{ body: unknown; headers: Headers }> {
    const response = await fetch(`${API_ROOT}${path}`, { headers: this.headers() });
    const remaining = Number(response.headers.get("x-ratelimit-remaining") ?? "");

    if (response.status === 403 && remaining === 0) {
      const reset = Number(response.headers.get("x-ratelimit-reset") ?? "0");
      const inSeconds = reset - Math.floor(Date.now() / 1000);
      throw new AppError(
        `GitHub API rate limit exceeded${inSeconds > 0 ? ` — resets in ~${Math.ceil(inSeconds / 60)} min` : ""}. ` +
          (this.token
            ? "Consider raising your token's usage limits."
            : "Add a GITHUB_TOKEN to server/.env to raise the 60 req/hour anonymous limit."),
        429,
        "GITHUB_RATE_LIMITED",
      );
    }

    if (response.status === 403) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      if (attempt < 2 && retryAfter > 0 && retryAfter <= 30) {
        await sleep(retryAfter * 1000);
        return this.fetchJson(path, attempt + 1);
      }
    }

    if ((response.status === 502 || response.status === 503 || response.status === 500) && attempt < 2) {
      await sleep(1000 * (attempt + 1));
      return this.fetchJson(path, attempt + 1);
    }

    if (response.status === 404) {
      throw new AppError(
        `GitHub returned 404 — the PR, repository, or the required access does not exist.`,
        404,
        "GITHUB_NOT_FOUND",
      );
    }

    if (response.status === 401) {
      throw new AppError(`GitHub rejected the access token in server/.env.`, 502, "GITHUB_BAD_TOKEN");
    }

    if (!response.ok) {
      const detail = await response.text();
      throw new AppError(
        `GitHub API request failed with status ${response.status}.`,
        502,
        "GITHUB_ERROR",
        detail.slice(0, 500),
      );
    }

    let body: unknown;
    const raw = await response.text();
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
    return { body, headers: response.headers };
  }

  private async getArrayPage<T>(
    path: string,
    guard: (value: unknown) => value is T,
    base: string,
    perPage: number,
    page: number,
  ): Promise<{ items: T[]; nextUrl: string | null }> {
    const { body, headers } = await this.fetchJson(
      `${base}?per_page=${perPage}&page=${page}${path === "" ? "" : `&${path}`}`,
    );
    const items = Array.isArray(body) ? body.filter(guard) : [];
    const links = parseLinkHeader(headers.get("link"));
    return { items, nextUrl: links.next ?? null };
  }

  async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<GitHubPullRequest> {
    const { body } = await this.fetchJson(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
    if (!isGitHubPullRequest(body)) {
      throw new AppError("The GitHub PR response was not the expected shape.", 502, "GITHUB_UNEXPECTED");
    }
    return body;
  }

  /**
   * Fetch changed files in descending order of change magnitude. Pagination is
   * capped so that enormous PRs do not exhaust memory or rate limits.
   */
  async getPullRequestFiles(owner: string, repo: string, pullNumber: number, maxFiles = 500): Promise<GitHubPullFile[]> {
    const files: GitHubPullFile[] = [];
    let page = 1;
    do {
      const { items, nextUrl } = await this.getArrayPage(
        "",
        isGitHubPullFile,
        `/repos/${owner}/${repo}/pulls/${pullNumber}/files`,
        100,
        page,
      );
      files.push(...items);
      if (files.length >= maxFiles || nextUrl === null) break;
      page += 1;
    } while (page <= 100);
    files.sort((a, b) => b.changes - a.changes || a.filename.localeCompare(b.filename));
    return files.slice(0, maxFiles);
  }

  /** Fetch PR commit authors, deduplicated, capped by page count. */
  async getPullRequestAuthors(
    owner: string,
    repo: string,
    pullNumber: number,
    maxCommits = 250,
  ): Promise<string[]> {
    const seen = new Set<string>();
    const authors: string[] = [];
    let page = 1;
    let collected = 0;
    do {
      const { items, nextUrl } = await this.getArrayPage(
        "",
        isGitHubCommit,
        `/repos/${owner}/${repo}/pulls/${pullNumber}/commits`,
        100,
        page,
      );
      for (const commit of items) {
        const login = commit.author?.login;
        const name = commit.commit.author?.name;
        const key = login ?? name;
        if (key && key.toLowerCase() !== "web-flow" && !seen.has(key.toLowerCase())) {
          seen.add(key.toLowerCase());
          authors.push(key);
        }
      }
      collected += items.length;
      if (collected >= maxCommits || nextUrl === null) break;
      page += 1;
    } while (page <= 100);
    return authors.slice(0, 30);
  }
}