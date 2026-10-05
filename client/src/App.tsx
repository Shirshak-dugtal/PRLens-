import { useState } from "react";
import { fetchReview } from "./api";
import Checklist from "./components/Checklist";
import FilesPanel from "./components/FilesPanel";
import FindingsPanel from "./components/FindingsPanel";
import PRHeader from "./components/PRHeader";
import PrForm from "./components/PrForm";
import ScoresGrid from "./components/ScoresGrid";
import VerdictBanner from "./components/VerdictBanner";
import { formatNumber } from "./lib";
import type { ReviewResponse } from "./types";

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30">
        <svg
          className="h-5 w-5 text-emerald-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
          <path d="M9 11h6" />
        </svg>
      </div>
      <div>
        <span className="text-lg font-bold tracking-tight text-zinc-50">PRLens</span>
        <span className="ml-2 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
          by TypeSafe Jev
        </span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto mt-10 flex max-w-lg flex-col items-center text-center">
      <div className="grid w-full gap-4 sm:grid-cols-3">
        {[
          { step: "1", title: "Paste a PR", body: "Any GitHub pull request URL" },
          { step: "2", title: "Jev judges", body: "Typed questions, calibrated answers" },
          { step: "3", title: "Read the verdict", body: "Scores, risks, findings, diffs" },
        ].map((item) => (
          <div key={item.step} className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-4">
            <span className="font-mono text-xs text-emerald-500">0{item.step}</span>
            <p className="mt-1 text-sm font-semibold text-zinc-200">{item.title}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{item.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 max-w-md text-sm leading-relaxed text-zinc-500">
        Jev never writes free-form prose — every answer arrives as a typed choice, score, or yes/no
        with a calibrated probability, so the dashboard needs no prompt parsing.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
      <p className="text-sm font-medium text-zinc-200">Fetching diff and consulting Jev…</p>
      <p className="text-xs text-zinc-500">
        GitHub PR metadata → structured state → 13 typed questions
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6">
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-rose-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
        <div>
          <h3 className="text-sm font-semibold text-rose-200">Review failed</h3>
          <p className="mt-1 text-sm leading-relaxed text-rose-200/70">{message}</p>
        </div>
      </div>
    </div>
  );
}

function Description({ text }: { text: string }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">PR description</h2>
      <p className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
        {text}
      </p>
    </section>
  );
}

function TruncationNotice({ truncation }: { truncation: NonNullable<ReviewResponse["truncation"]> }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
      <span className="font-semibold">Large diff: </span>
      {formatNumber(truncation.filesTotal)} changed files,{" "}
      {formatNumber(truncation.filesPatchSkipped)} patches omitted and{" "}
      {formatNumber(truncation.patchesTruncated)} truncated to fit the{" "}
      {formatNumber(truncation.maxStateChars)}-character review window. Scores reflect the visible portion.
    </div>
  );
}

function Footer({ model, usage }: { model: string; usage: ReviewResponse["usage"] }) {
  return (
    <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-6 text-xs text-zinc-600">
      <span>
        Model <span className="font-mono text-zinc-400">{model}</span> · {formatNumber(usage.inputTokens)} input
        tokens
      </span>
      <span>Structured answers only — no free-form AI text</span>
    </footer>
  );
}

type Phase = "idle" | "loading" | "done" | "error";

export default function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ReviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReview(url: string) {
    setPhase("loading");
    setError(null);
    setResult(null);
    try {
      const response = await fetchReview(url);
      setResult(response);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Brand />
        {result && (
          <span className="font-mono text-xs text-zinc-600">
            {result.pr.owner}/{result.pr.repo}
          </span>
        )}
      </header>

      <main className="flex flex-1 flex-col">
        <div className="mt-10 text-center">
          <h1 className="mx-auto max-w-2xl text-3xl font-bold leading-tight tracking-tight text-zinc-50 sm:text-4xl">
            Read the PR before the review reads you.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-500">
            Paste a GitHub pull request URL. PRLens pulls the real diff through the GitHub API and runs it
            past TypeSafe Jev for typed, calibrated engineering judgments.
          </p>
        </div>

        <div className="mt-7">
          <PrForm busy={phase === "loading"} onSubmit={handleReview} />
        </div>

        <div className="mt-4 flex-1">
          {phase === "idle" && <EmptyState />}
          {phase === "loading" && <LoadingState />}
          {phase === "error" && error && <ErrorState message={error} />}

          {phase === "done" && result && (
            <div className="flex flex-col gap-8">
              <PRHeader pr={result.pr} />
              <VerdictBanner answer={result.review.mergeRecommendation} />
              <ScoresGrid
                overallQuality={result.review.overallQuality}
                riskLevel={result.review.riskLevel}
                testCoverage={result.review.testCoverage}
                codeClarity={result.review.codeClarity}
              />
              <Checklist review={result.review} />
              <FindingsPanel
                mostSignificantFinding={result.review.mostSignificantFinding}
                worstFile={result.review.worstFile}
              />
              {result.truncation && <TruncationNotice truncation={result.truncation} />}
              {result.pr.description && <Description text={result.pr.description} />}
              <FilesPanel
                files={result.pr.files}
                worstFileChoice={result.review.worstFile?.choice ?? null}
              />
            </div>
          )}
        </div>
      </main>

      {phase === "done" && result && <Footer model={result.model} usage={result.usage} />}
    </div>
  );
}