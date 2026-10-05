import {
  choice,
  type ChoiceResponse,
  noul,
  type NoulResponse,
  score,
  type ScoreResponse,
  type ChoiceCriteria,
  type EntryType,
  type Questions,
  type SystemOneResult,
  TypeSafeClient,
  type TypeSafeClientConfig,
} from "@typesafe-ai/sdk";
import { AppError, badRequest } from "./errors.js";
import { assertConfigured, config } from "./env.js";
import { GitHubClient, type GitHubPullFile, type GitHubPullRequest } from "./github.js";
import type {
  ChoiceAnswer,
  NoulAnswer,
  PrFileSummary,
  PullRequestSummary,
  ReviewAnswers,
  ReviewResponse,
  ScoreAnswer,
  TruncationInfo,
} from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_STATE_CHARS = 200_000;
const MAX_PATCH_CHARS_PER_FILE = 16_000;
const MAX_BODY_CHARS = 8_000;
const WORST_FILE_CHOICE_LIMIT = 20;

// ---------------------------------------------------------------------------
// Typesafe client
// ---------------------------------------------------------------------------

export function createTypeSafeClient(): TypeSafeClient {
  const { typesafeApiKey } = assertConfigured();
  const options: TypeSafeClientConfig = { apiKey: typesafeApiKey, timeout: 120_000 };
  if (config.typesafeModel) options.defaultModel = config.typesafeModel;
  return new TypeSafeClient(options);
}

export type JevClientLike = Pick<TypeSafeClient, "systemOne">;

// ---------------------------------------------------------------------------
// PR URL parsing
// ---------------------------------------------------------------------------

const PR_URL_RE =
  /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)\/pull\/(\d+)(?:[/?#].*)?$/;

export interface ParsedPrUrl {
  owner: string;
  repo: string;
  number: number;
}

export function parsePrUrl(raw: string): ParsedPrUrl {
  const match = PR_URL_RE.exec(raw.trim());
  if (!match) {
    throw badRequest(
      "Invalid GitHub pull request URL. Expected the shape https://github.com/{owner}/{repo}/pull/{number}.",
      "INVALID_PR_URL",
    );
  }
  const owner = match[1] as string;
  const repo = match[2] as string;
  const number = Number(match[3]);
  return { owner, repo, number };
}

// ---------------------------------------------------------------------------
// State assembly
// ---------------------------------------------------------------------------

type DiffStateFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string | null;
};

function capText(text: string | null | undefined, max: number): string | null {
  if (!text) return text ?? null;
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… [${(text.length - max).toLocaleString()} more chars truncated]`;
}

interface CappedPatch {
  value: string | undefined;
  truncated: boolean;
}

function capPatch(patch: string | undefined): CappedPatch {
  if (!patch) return { value: undefined, truncated: false };
  if (patch.length <= MAX_PATCH_CHARS_PER_FILE) return { value: patch, truncated: false };
  const omitted = patch.length - MAX_PATCH_CHARS_PER_FILE;
  return {
    value: `${patch.slice(0, MAX_PATCH_CHARS_PER_FILE)}\n… [${omitted.toLocaleString()} chars omitted]`,
    truncated: true,
  };
}

interface BuiltState {
  encoded: EntryType;
  truncation: TruncationInfo;
}

function buildState(
  owner: string,
  repo: string,
  pr: GitHubPullRequest,
  files: GitHubPullFile[],
): BuiltState {
  let chopped = 0;
  let skipped = 0;
  let truncationInUse: TruncationInfo = {
    active: false,
    maxStateChars: MAX_STATE_CHARS,
    fullDiffChars: 0,
    filesTotal: files.length,
    filesPatchIncluded: 0,
    filesPatchSkipped: 0,
    patchesTruncated: 0,
  };
  for (const file of files) {
    if (file.patch) truncationInUse.fullDiffChars += file.patch.length;
  }

  const entries: DiffStateFile[] = [];
  let budget = MAX_STATE_CHARS;

  for (const file of files) {
    const capped = capPatch(file.patch);
    const entry: DiffStateFile = {
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: null,
    };
    if (capped.value !== undefined) {
      if (capped.value.length <= budget) {
        entry.patch = capped.value;
        budget -= capped.value.length;
        if (capped.truncated) chopped += 1;
      } else {
        skipped += 1;
      }
    }
    entries.push(entry);
  }

  const included = entryCountWith(entries, (e) => e.patch !== null);
  truncationInUse = {
    ...truncationInUse,
    active: chopped > 0 || skipped > 0,
    filesPatchIncluded: included,
    filesPatchSkipped: entries.length - included,
    patchesTruncated: chopped,
  };

  return {
    encoded: {
      task:
        "You are performing a rigorous engineering peer review of this GitHub pull request. " +
        "Judge the diff and the contextual PR information, then answer every narrow question exactly " +
        "according to its rubric. Do not hedge; pick the single best answer per question.",
      repo: `${owner}/${repo}`,
      prNumber: pr.number,
      title: pr.title,
      description: capText(pr.body, MAX_BODY_CHARS),
      author: pr.user?.login ?? "unknown",
      state: pr.state,
      merged: pr.merged,
      mergeable: pr.mergeable,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFileCount: pr.changed_files,
      commitCount: pr.commits,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      files: entries,
    },
    truncation: truncationInUse,
  };
}

function entryCountWith(entries: DiffStateFile[], predicate: (entry: DiffStateFile) => boolean): number {
  let count = 0;
  for (const entry of entries) if (predicate(entry)) count += 1;
  return count;
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

function buildWorstFileCriteria(files: GitHubPullFile[]): ChoiceCriteria {
  const candidates = files.slice(0, WORST_FILE_CHOICE_LIMIT);
  if (candidates.length === 0) return { noFilesChanged: null };
  const criteria: ChoiceCriteria = {};
  for (const file of candidates) criteria[file.filename] = null;
  return criteria;
}

export const buildQuestions = (files: GitHubPullFile[]) =>
  ({
  mergeRecommendation: choice(
    "What is the correct merge decision for this pull request?",
    {
      approve: "Approve and merge as-is; no blocking concerns.",
      approveWithSuggestions: "Approve, with non-blocking follow-up suggestions.",
      requestChanges: "Request changes before merge; there are substantive issues to address.",
      reject: "Do not merge in its current form; the change is fundamentally problematic.",
    },
  ),
  overallQuality: score("Rate the overall engineering quality of this PR.", [
    "Unacceptable — fundamental correctness or architectural problems; needs a rewrite.",
    "Poor — significant issues that must be resolved before merge.",
    "Below average — several noteworthy problems; requires changes.",
    "Acceptable — meets the bar with minor issues or polish items.",
    "Good — solid implementation with only minor nits.",
    "Very good — well-tested, clear, and minimally risky.",
    "Excellent — exemplary; merge-worthy as-is.",
  ]),
  riskLevel: score("Rate the overall regression risk of merging this PR.", [
    "Negligible — trivial or fully covered change.",
    "Low — minor impact confined to well-tested paths.",
    "Moderate — some unguarded edge cases or a medium blast radius.",
    "High — likely to cause regressions in production.",
    "Critical — merging risks incidents or data loss.",
  ]),
  testCoverage: score("Rate the adequacy of test coverage for the changes in this PR.", [
    "No tests — the change is untested.",
    "Insufficient — tests exist but critical paths are uncovered.",
    "Adequate — the main paths are covered with gaps in edge cases.",
    "Good — thorough tests including key edge cases.",
    "Excellent — comprehensive, including regression and boundary cases.",
  ]),
  codeClarity: score("Rate the clarity and maintainability of the changed code.", [
    "Poor — unclear naming, tangled logic, hard to maintain.",
    "Below par — convoluted structure; should be refactored.",
    "Adequate — understandable with rough edges.",
    "Good — clean, idiomatic, and well structured.",
    "Excellent — exemplary clarity and structure.",
  ]),
  introducesBug: noul("Could this diff introduce a functional bug or runtime regression?", {
    true: "A concrete bug or an obvious regression path exists in the diff.",
    false: "No obvious functional defect or regression is introduced.",
  }),
  introducesSecurityIssue: noul(
    "Does this diff introduce a security vulnerability (injection, auth exposure, secrets, unsafe deserialization, etc.)?",
    {
      true: "The diff introduces an exploitable or exposed security risk.",
      false: "No new security vulnerability is introduced.",
    },
  ),
  introducesPerformanceRegression: noul(
    "Could this change cause a meaningful performance regression at scale?",
    {
      true: "Yes — e.g. N+1 queries, unbounded work, complexity blow-up, or blocking on hot paths.",
      false: "No meaningful performance regression is expected.",
    },
  ),
  breaksExistingBehavior: noul("Does this change break existing expected behavior or contracts?", {
    true: "Existing behavior or a public contract changes incompatibly.",
    false: "Existing behavior is preserved or intentionally and safely superseded.",
  }),
  breakingChangeForConsumers: noul(
    "Does this change break anyone consuming the code as a dependency or API (exported functions, CLI, config format, database schema)?",
    {
      true: "Downstream consumers or the storage/serialization contract would break.",
      false: "The change is internal or backward compatible.",
    },
  ),
  scopeCohesive: noul(
    "Is the PR scope focused and cohesive (one logical change) rather than a grab-bag of unrelated edits?",
    {
      true: "The changes form one coherent, reviewable unit.",
      false: "Unrelated changes are mixed in.",
    },
  ),
  mostSignificantFinding: choice("What is the single most significant engineering finding in this PR?", {
    noSignificantFindings: "The diff is clean — nothing significant to flag.",
    logicBug: "A likely logic error: wrong branch, off-by-one, or inverted condition.",
    exceptionRisk: "Code paths that can throw or crash at runtime.",
    concurrencyIssue: "Race conditions, thread-safety, or async pitfalls.",
    securityExposure: "Security concern: untrusted input, secrets, or auth flaws.",
    performanceHotspot: "Algorithmic or I/O hotspot that is slow at scale.",
    dataIntegrity: "Risks of data corruption, loss, or inconsistent state.",
    missingEdgeCaseHandling: "Important inputs or boundary cases are unhandled.",
    errorHandlingGap: "Failures are swallowed, ignored, or misreported.",
    apiBreakage: "A public interface, schema, or contract change that breaks callers.",
    testGap: "Changes in risky areas entirely lacking test coverage.",
    maintainability: "Structural or naming issues that will compound over time.",
  }),
  worstFile: choice(
    "Which changed file most likely contains the most significant issue?",
    buildWorstFileCriteria(files),
  ),
}) satisfies Questions;

// ---------------------------------------------------------------------------
// Answer normalization
// ---------------------------------------------------------------------------

function entryToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function choiceAnswer(answer: ChoiceResponse): ChoiceAnswer {
  return {
    choice: answer.choice,
    confidence: answer.confidence,
    probabilities: { ...answer.probabilities } as Record<string, number>,
  };
}

function scoreAnswer(answer: ScoreResponse): ScoreAnswer {
  const legend: Record<string, string> = {};
  const probabilities: Record<string, number> = {};
  for (const [key, value] of Object.entries(answer.legend)) legend[key] = entryToString(value);
  for (const [key, value] of Object.entries(answer.probabilities)) probabilities[key] = value;
  return { score: answer.score, confidence: answer.confidence, legend, probabilities };
}

function noulAnswer(answer: NoulResponse): NoulAnswer {
  const p = Math.min(1, Math.max(0, answer.noul));
  return { yes: p >= 0.5, probability: p };
}

// ---------------------------------------------------------------------------
// Main review flow
// ---------------------------------------------------------------------------

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const message = err instanceof Error ? err.message : String(err);
  if (/No API key|TYPESAFE_API_KEY/i.test(message)) {
    return new AppError(
      "The TypeSafe API key is not configured. Copy server/.env.example to server/.env and set TYPESAFE_API_KEY.",
      500,
      "TYPESAFE_API_KEY_MISSING",
    );
  }
  if (/timeout/i.test(message)) {
    return new AppError("The TypeSafe Jev request timed out.", 504, "TYPESAFE_TIMEOUT", message);
  }
  return new AppError(`TypeSafe Jev review failed: ${message}`, 502, "TYPESAFE_REVIEW_FAILED", message);
}

function summarizeFiles(files: GitHubPullFile[]): PrFileSummary[] {
  return files.map((file) => {
    const capped = capPatch(file.patch);
    return {
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      previousFilename: file.previous_filename ?? null,
      patch: capped.value ?? null,
      truncated: capped.truncated,
      patchSkipped: file.patch !== undefined && capped.value === undefined,
    };
  });
}

export async function reviewPullRequest(
  prUrlValue: string,
  deps?: { client?: JevClientLike; github?: GitHubClient },
): Promise<ReviewResponse> {
  const { owner, repo, number } = parsePrUrl(prUrlValue);
  const github = deps?.github ?? new GitHubClient(config.githubToken);

  const [pr, files] = await Promise.all([
    github.getPullRequest(owner, repo, number),
    github.getPullRequestFiles(owner, repo, number),
  ]);

  let authors: string[] = [];
  try {
    authors = await github.getPullRequestAuthors(owner, repo, number);
  } catch {
    // Commit metadata is non-critical; the review proceeds without it.
    authors = [];
  }

  const { encoded, truncation } = buildState(owner, repo, pr, files);
  const questions = buildQuestions(files);

  type QuestionsMap = ReturnType<typeof buildQuestions>;
  let result: SystemOneResult<QuestionsMap>;
  try {
    let client: JevClientLike;
    try {
      client = deps?.client ?? createTypeSafeClient();
    } catch (err) {
      if (deps?.client) throw err;
      throw toAppError(err);
    }
    result = await client.systemOne({
      state: encoded,
      questions,
    });
  } catch (err) {
    throw toAppError(err);
  }

  const answers = result.answers;
  const hasFiles = files.length > 0;

  const review: ReviewAnswers = {
    mergeRecommendation: choiceAnswer(answers.mergeRecommendation),
    overallQuality: scoreAnswer(answers.overallQuality),
    riskLevel: scoreAnswer(answers.riskLevel),
    testCoverage: scoreAnswer(answers.testCoverage),
    codeClarity: scoreAnswer(answers.codeClarity),
    introducesBug: noulAnswer(answers.introducesBug),
    introducesSecurityIssue: noulAnswer(answers.introducesSecurityIssue),
    introducesPerformanceRegression: noulAnswer(answers.introducesPerformanceRegression),
    breaksExistingBehavior: noulAnswer(answers.breaksExistingBehavior),
    breakingChangeForConsumers: noulAnswer(answers.breakingChangeForConsumers),
    scopeCohesive: noulAnswer(answers.scopeCohesive),
    worstFile: hasFiles ? choiceAnswer(answers.worstFile) : null,
    mostSignificantFinding: choiceAnswer(answers.mostSignificantFinding),
  };

  const prSummary: PullRequestSummary = {
    htmlUrl: pr.html_url,
    owner,
    repo,
    number: pr.number,
    title: pr.title,
    description: pr.body,
    author: {
      login: pr.user?.login ?? "unknown",
      avatarUrl: pr.user?.avatar_url ?? null,
    },
    authors,
    state: pr.state,
    merged: pr.merged,
    locked: pr.locked,
    mergeable: pr.mergeable,
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
    commitCount: pr.commits,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    files: summarizeFiles(files),
  };

  return {
    pr: prSummary,
    truncation: truncation.active ? truncation : null,
    review,
    model: result.model,
    usage: { inputTokens: result.usage.input_tokens, outputTokens: result.usage.output_tokens },
  };
}