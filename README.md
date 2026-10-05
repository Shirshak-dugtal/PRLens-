# PRLens

AI-powered GitHub Pull Request reviewer. Paste a PR URL → PRLens pulls the real diff through the
GitHub REST API, feeds a structured state to **TypeSafe's Jev** model as 13 narrow typed questions,
and renders the returned judgments as an engineering review dashboard.

Jev never generates free-form prose. Every answer arrives as a **choice**, **score**, or **yes/no**
value with calibrated probabilities, so the backend reads answers directly as data — no prompt parsing,
no markdown cleanup, no hallucinated text.

---

## Stack

| Layer     | Tech |
|-----------|------|
| Frontend  | React 19, Vite, TypeScript, Tailwind CSS v4 |
| Backend   | Node.js 20+, Express 5, TypeScript |
| AI        | `@typesafe-ai/sdk` → TypeSafe Jev (`jev-latest`) |
| Data      | GitHub REST API (plain `fetch`, optional token) |
| Config    | `dotenv`, `cors` |

---

## Quick start

### 1. Install

```bash
npm install
```

### 2. Configure secrets

```bash
cp server/.env.example server/.env
```

Then edit `server/.env`:

| Variable            | Required | Purpose |
|---------------------|----------|---------|
| `TYPESAFE_API_KEY`  | ✅ yes   | TypeSafe API key (from the TypeSafe dashboard) |
| `GITHUB_TOKEN`      | optional | GitHub PAT — raises the 60 req/h limit to 5,000, and enables private repos |
| `PORT`              | optional | Backend port (default `8787`) |
| `CLIENT_ORIGIN`     | optional | CORS origin for the Vite dev server (default: any) |
| `TYPESAFE_MODEL`    | optional | Jev model override (default `jev-latest`) |

Secrets live **only** in this server-side file — `.env` is gitignored, and the browser never sees
GitHub or TypeSafe keys.

### 3. Run

**Development** (server on `:8787`, Vite on `:5173` with an `/api` proxy):

```bash
npm run dev
```

**Production** (built client served by Express from a single port):

```bash
npm run build
npm start
```

Then open http://localhost:5173 (dev) or http://localhost:8787 (prod).

---

## How a review works

```
Browser ── POST /api/review { "prUrl": "https://github.com/owner/repo/pull/123" } ──▶ Express
  │
  │  1. parsePrUrl  →  owner / repo / pullRequestNumber
  │  2. GitHub REST →  PR title, body, author, state, stats, base/head,
  │                    changed files (paginated, sorted by size), commit authors
  │  3. buildState  →  bounded structured state (≤200k chars; per-file patches
  │                    capped at 16k chars, overflow skipped + reported)
  │  4. Jev         →  13 typed questions (choice / score / noul) answered in
  │                    one parallel call, returning probabilities per answer
  │  5. normalize   →  { pr, truncation, review, model, usage } JSON
  │
  ◀── 200 + JSON ── review dashboard (verdict, scores, risk checklist,
                    findings, changed files with diffs)
```

### API

**`POST /api/review`**

```json
{ "prUrl": "https://github.com/facebook/react/pull/12345" }
```

Response: see `server/src/types.ts` → `ReviewResponse`.

**`GET /api/health`** → `{ ok, service, jevConfigured, githubConfigured }`

Errors are returned as `{ "error": "...", "code": "..." }` with a proper status
(`400` invalid URL, `404` PR not found, `429` GitHub rate limited, `500` missing API key,
`502` TypeSafe/GitHub failure).

---

## The typed question catalog

Each question is one of Jev's three answer types, built with `choice()`, `score()`, or `noul()` from
`@typesafe-ai/sdk` (`server/src/review.ts`):

| Question | Type | What it judges |
|----------|------|----------------|
| `mergeRecommendation` | `choice` | approve · approveWithSuggestions · requestChanges · reject |
| `overallQuality` | `score` (0–6) | execution quality, unweighted by risk |
| `riskLevel` | `score` (0–4) | regression / blast-radius risk of merging |
| `testCoverage` | `score` (0–4) | adequacy of tests incl. edge cases |
| `codeClarity` | `score` (0–4) | readability, naming, structure |
| `introducesBug` | `noul` | functional bug or regression path |
| `introducesSecurityIssue` | `noul` | injection, secrets, auth, unsafe deserialization |
| `introducesPerformanceRegression` | `noul` | N+1 queries, unbounded work, hot-path blocking |
| `breaksExistingBehavior` | `noul` | incompatible change to expected behavior |
| `breakingChangeForConsumers` | `noul` | breaks exported API / CLI / schema dependents |
| `scopeCohesive` | `noul` | focused single change vs. unrelated grab-bag |
| `mostSignificantFinding` | `choice` | the dominant issue category (12 labels) |
| `worstFile` | `choice` (dynamic) | picks from the top-20 changed files by change count |

Answer shapes (see `server/src/types.ts`):

```ts
// choice → { choice, confidence, probabilities: Record<label, number> }
// score  → { score, confidence, legend: Record<level, description>, probabilities }
// noul   → { yes, probability }        // probability = P(yes), calibrated
```

`worstFile` builds its criteria dynamically from the PR's file list, so Jev chooses among the
actual filenames — a label space defined in advance, as Jev requires.

---

## Project layout

```
server/
  src/
    env.ts        dotenv loading + config
    github.ts     GitHub REST client (pagination, rate-limit handling, retries)
    review.ts     PR URL parsing → state assembly → typed Jev questions → normalization
    types.ts      ReviewResponse contract (shared shape with client/src/types.ts)
    server.ts     Express app: routes, CORS, static client serving, error middleware
    errors.ts     AppError with HTTP status + machine-readable code
client/
  src/
    App.tsx               layout, phases (idle/loading/done/error)
    api.ts                fetch wrapper for POST /api/review
    types.ts              mirror of server/src/types.ts
    components/           PRHeader, VerdictBanner, ScoresGrid, Checklist,
                          FindingsPanel, FilesPanel, PrForm
```

---

## Security notes

- **Keys never reach the browser.** The React app only ever calls `/api/review` with a PR URL; the
  GitHub token and TypeSafe key are read exclusively in Express from `server/.env`.
- `.env` is gitignored; `server/.env.example` documents every variable with empty values.
- The request body is capped at 64 KB, and the review state at 200 K chars, so a hostile PR URL
  cannot balloon upstream cost.
- GitHub calls use the official REST API with your token sent only as an `Authorization` header to
  `api.github.com`.

## Behavior on huge PRs

Patch text is capped per file (16 K chars) and across the whole state (200 K chars), prioritizing the
largest changes. If anything is dropped, the response's `truncation` field is populated and the
dashboard shows a notice — scores reflect the visible portion only.

## Smoke testing without a real key

`reviewPullRequest(prUrl, { client })` accepts an injected Jev client, so the GitHub → state →
normalization pipeline can be exercised with a stubbed `systemOne()` and no `TYPESAFE_API_KEY`:

```js
import { reviewPullRequest } from "./server/dist/review.js";

const client = {
  systemOne: async ({ questions }) => ({ /* fabricate answers per question.type */ }),
};

const result = await reviewPullRequest("https://github.com/octocat/Hello-World/pull/1", { client });
console.log(result.review.mergeRecommendation);
```