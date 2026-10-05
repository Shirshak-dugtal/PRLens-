import type { PullRequestSummary } from "../types";
import { formatDate, formatNumber } from "../lib";

interface PRHeaderProps {
  pr: PullRequestSummary;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className={`font-mono text-sm ${tone ?? "text-zinc-300"}`}>{value}</dd>
    </div>
  );
}

export default function PRHeader({ pr }: PRHeaderProps) {
  const stateChip =
    pr.merged
      ? "bg-purple-500/15 text-purple-300 ring-purple-500/30"
      : pr.state === "open"
        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
        : "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30";

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 ring-1 ring-zinc-800/50">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono text-zinc-400">
            {pr.owner}/{pr.repo}
          </span>
          <span className="text-zinc-600">#</span>
          <span className="font-mono text-zinc-200">{pr.number}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${stateChip}`}>
            {pr.merged ? "Merged" : pr.state}
          </span>
          {pr.mergeable === false && (
            <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-300 ring-1 ring-rose-500/30">
              Merge conflict
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-zinc-50">{pr.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <img
                src={pr.author.avatarUrl ?? ""}
                alt=""
                className="h-6 w-6 rounded-full bg-zinc-800"
                onError={(e) => ((e.currentTarget.style.visibility = "hidden"), null)}
              />
              <a
                href={pr.htmlUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
              >
                {pr.author.login}
              </a>
              <span className="font-mono text-xs text-zinc-500">
                {pr.baseBranch} ← {pr.headBranch}
              </span>
              {pr.authors.length > 0 && (
                <span className="text-xs text-zinc-500">
                  {pr.authors.length} {pr.authors.length === 1 ? "contributor" : "contributors"}
                </span>
              )}
            </div>
          </div>
          <a
            href={pr.htmlUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-xs font-medium text-zinc-400 hover:text-zinc-200"
          >
            View on GitHub ↗
          </a>
        </div>

        <dl className="grid grid-cols-2 gap-4 border-t border-zinc-800 pt-4 sm:grid-cols-4 md:grid-cols-6">
          <Stat label="Changed files" value={formatNumber(pr.changedFiles)} />
          <Stat label="Additions" value={`+${formatNumber(pr.additions)}`} tone="text-emerald-400" />
          <Stat label="Deletions" value={`−${formatNumber(pr.deletions)}`} tone="text-rose-400" />
          <Stat label="Commits" value={formatNumber(pr.commitCount)} />
          <Stat label="Opened" value={formatDate(pr.createdAt)} />
          <Stat label="Updated" value={formatDate(pr.updatedAt)} />
        </dl>
      </div>
    </section>
  );
}