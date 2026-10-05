import type { ChoiceAnswer } from "../types";
import { percent, titleCase } from "../lib";

interface OptionBarsProps {
  answer: ChoiceAnswer;
  accent?: string;
}

function OptionBars({ answer, accent = "bg-emerald-400" }: OptionBarsProps) {
  const entries = Object.entries(answer.probabilities).sort((a, b) => b[1] - a[1]);
  const max = Math.max(0.001, ...entries.map(([, prob]) => prob));
  return (
    <ul className="flex flex-col gap-2">
      {entries.map(([label, prob]) => (
        <li key={label}>
          <div className="mb-0.5 flex items-baseline justify-between text-xs">
            <span className="text-zinc-400">{titleCase(label)}</span>
            <span className="font-mono text-zinc-300">{percent(prob)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full ${label === answer.choice ? accent : "bg-zinc-600"}`}
              style={{ width: `${(prob / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

interface FindingsPanelProps {
  mostSignificantFinding: ChoiceAnswer;
  worstFile: ChoiceAnswer | null;
}

export default function FindingsPanel({ mostSignificantFinding, worstFile }: FindingsPanelProps) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Key findings</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 ring-1 ring-amber-500/10">
          <div className="mb-1 flex items-center gap-2">
            <svg
              className="h-4 w-4 text-amber-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            <h3 className="text-sm font-semibold text-amber-200">Most significant finding</h3>
          </div>
          <p className="mt-2 text-lg font-bold leading-snug text-zinc-100">
            {titleCase(mostSignificantFinding.choice)}
          </p>
          <p className="mb-4 mt-0.5 font-mono text-xs text-zinc-500">
            {percent(mostSignificantFinding.confidence)} confidence
          </p>
          <OptionBars answer={mostSignificantFinding} accent="bg-amber-400" />
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-1 flex items-center gap-2">
            <svg
              className="h-4 w-4 text-sky-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            <h3 className="text-sm font-semibold text-sky-200">File most likely hosting the issue</h3>
          </div>
          {worstFile ? (
            <>
              <p className="mt-2 break-all font-mono text-lg font-bold text-zinc-100">{worstFile.choice}</p>
              <p className="mb-4 mt-0.5 font-mono text-xs text-zinc-500">
                {percent(worstFile.confidence)} confidence
              </p>
              <OptionBars answer={worstFile} accent="bg-sky-400" />
            </>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">No changed files to rank.</p>
          )}
        </div>
      </div>
    </section>
  );
}