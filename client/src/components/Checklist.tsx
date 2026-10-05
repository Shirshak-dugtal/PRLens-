import type { NoulAnswer, ReviewAnswers } from "../types";
import { percent } from "../lib";

type NoulKey = keyof Pick<
  ReviewAnswers,
  | "introducesBug"
  | "introducesSecurityIssue"
  | "introducesPerformanceRegression"
  | "breaksExistingBehavior"
  | "breakingChangeForConsumers"
  | "scopeCohesive"
>;

const ITEMS: { key: NoulKey; label: string; hint: string; positive: boolean }[] = [
  { key: "introducesSecurityIssue", label: "Security vulnerability", hint: "Injection, secrets, auth exposure, unsafe deserialization", positive: false },
  { key: "introducesBug", label: "Functional bug / regression", hint: "A concrete defect or obvious regression path", positive: false },
  { key: "introducesPerformanceRegression", label: "Performance regression", hint: "N+1 queries, unbounded work, hot-path blocking", positive: false },
  { key: "breaksExistingBehavior", label: "Breaks existing behavior", hint: "Incompatible change to expected behavior or contracts", positive: false },
  { key: "breakingChangeForConsumers", label: "Breaking change for consumers", hint: "Exports, CLI, config, schema that break dependents", positive: false },
  { key: "scopeCohesive", label: "Focused, cohesive scope", hint: "One logical change rather than unrelated edits", positive: true },
];

function NoulRow({ label, hint, answer, positive }: { label: string; hint: string; answer: NoulAnswer; positive: boolean }) {
  const flagged = answer.yes !== positive;
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">{label}</span>
          <span className="font-mono text-xs text-zinc-500">{percent(answer.probability)} yes</span>
        </div>
        <p className="truncate text-xs text-zinc-500">{hint}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ${
          flagged
            ? "bg-amber-500/15 text-amber-300 ring-amber-500/30"
            : "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
        }`}
      >
        {answer.yes ? "Yes" : "No"}
      </span>
    </div>
  );
}

interface ChecklistProps {
  review: ReviewAnswers;
}

export default function Checklist({ review }: ChecklistProps) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Risk checklist</h2>
      <div className="grid gap-2.5 md:grid-cols-2">
        {ITEMS.map((item) => (
          <NoulRow
            key={item.key}
            label={item.label}
            hint={item.hint}
            positive={item.positive}
            answer={review[item.key]}
          />
        ))}
      </div>
    </section>
  );
}