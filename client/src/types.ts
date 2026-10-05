/** Mirrors the JSON contract produced by the Express backend. */

export interface PrAuthor {
  login: string;
  avatarUrl: string | null;
}

export interface PrFileSummary {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  previousFilename: string | null;
  patch: string | null;
  truncated: boolean;
  patchSkipped: boolean;
}

export interface PullRequestSummary {
  htmlUrl: string;
  owner: string;
  repo: string;
  number: number;
  title: string;
  description: string | null;
  author: PrAuthor;
  authors: string[];
  state: "open" | "closed";
  merged: boolean;
  locked: boolean;
  mergeable: boolean | null;
  baseBranch: string;
  headBranch: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  commitCount: number;
  createdAt: string;
  updatedAt: string;
  files: PrFileSummary[];
}

export interface ChoiceAnswer {
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface ScoreAnswer {
  score: number;
  confidence: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
}

export interface NoulAnswer {
  yes: boolean;
  probability: number;
}

export interface ReviewAnswers {
  mergeRecommendation: ChoiceAnswer;
  overallQuality: ScoreAnswer;
  riskLevel: ScoreAnswer;
  testCoverage: ScoreAnswer;
  codeClarity: ScoreAnswer;
  introducesBug: NoulAnswer;
  introducesSecurityIssue: NoulAnswer;
  introducesPerformanceRegression: NoulAnswer;
  breaksExistingBehavior: NoulAnswer;
  breakingChangeForConsumers: NoulAnswer;
  scopeCohesive: NoulAnswer;
  worstFile: ChoiceAnswer | null;
  mostSignificantFinding: ChoiceAnswer;
}

export interface TruncationInfo {
  active: boolean;
  maxStateChars: number;
  fullDiffChars: number;
  filesTotal: number;
  filesPatchIncluded: number;
  filesPatchSkipped: number;
  patchesTruncated: number;
}

export interface ReviewResponse {
  pr: PullRequestSummary;
  truncation: TruncationInfo | null;
  review: ReviewAnswers;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}