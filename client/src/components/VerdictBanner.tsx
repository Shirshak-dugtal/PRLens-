import type { ChoiceAnswer } from "../types";
import { percent, titleCase, VERDICT_TONES, type TonePalette } from "../lib";

const VERDICTS: Record<string, { label: string; blurb: string; tone: keyof typeof VERDICT_TONES }> = {
  approve: { label: "Approve", blurb: "Merge as-is — no blocking concerns", tone: "good" },
  approveWithSuggestions: {
    label: "Approve with suggestions",
    blurb: "Merge with non-blocking follow-ups",
    tone: "suggest",
  },
  requestChanges: { label: "Request changes", blurb: "Substantive issues to address first", tone: "warn" },
  reject: { label: "Reject", blurb: "Do not merge in its current form", tone: "danger" },
};

function ChoiceDistribution({ answer, labels }: { answer: ChoiceAnswer; labels: string[] }) {
  const max = Math.max(0.001, ...labels.map((label) => answer.probabilities[label] ?? 0));
  return (
    <ul className="flex flex-col gap-1.5">
      {labels.map((label) => {
        const prob = answer.probabilities[label] ?? 0;
        return (
          <li key={label}>
            <div className="mb-0.5 flex items-baseline justify-between text-xs">
              <span className="text-zinc-400">{titleCase(label)}</span>
              <span className="font-mono text-zinc-300">{percent(prob)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full ${label === answer.choice ? "bg-emerald-400" : "bg-zinc-600"}`}
                style={{ width: `${(prob / max) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

interface VerdictBannerProps {
  answer: ChoiceAnswer;
}

export default function VerdictBanner({ answer }: VerdictBannerProps) {
  const config =
    VERDICTS[answer.choice] ??
    ({
      label: titleCase(answer.choice),
      blurb: "Engineering decision from Jev",
      tone: "suggest",
    } satisfies { label: string; blurb: string; tone: keyof typeof VERDICT_TONES });
  const tone: TonePalette = VERDICT_TONES[config.tone]!
  const order = ["approve", "approveWithSuggestions", "requestChanges", "reject"];

  return (
    <section className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 ring-1 ${tone.ring}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${tone.chip} ring-1`}>
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {answer.choice === "reject" ? (
                <path d="M18 6 6 18M6 6l12 12" />
              ) : answer.choice === "requestChanges" ? (
                <path d="M6 9V3m6 6V3m6 6V3M4 9h16v.01M4 9l.75 11a2 2 0 0 0 2 1.99h10.5a2 2 0 0 0 2-1.99L20 9" />
              ) : (
                <path d="M20 6 9 17l-5-5" />
              )}
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-bold ${tone.accent}`}>{config.label}</span>
              <span className="font-mono text-xs text-zinc-500">{percent(answer.confidence)} confidence</span>
            </div>
            <p className="text-sm text-zinc-400">{config.blurb}</p>
          </div>
        </div>
        <span className="rounded-full bg-zinc-800/80 px-3 py-1 text-xs font-medium text-zinc-400">
          Merge recommendation
        </span>
      </div>
      <div className="mt-5 grid gap-6 border-t border-zinc-800 pt-5 md:grid-cols-[1fr_1.2fr]">
        <div className="text-sm text-zinc-400">
          <p>
            Jev assigns a probability to every possible verdict. The chosen answer
            {answer.probabilities[answer.choice] !== undefined && answer.probabilities[answer.choice]! > 0.9
              ? " is near-certain"
              : ""}{" "}
            is highlighted, but the full calibrated distribution is shown so you can weigh the uncertainty.
          </p>
        </div>
        <ChoiceDistribution answer={answer} labels={order} />
      </div>
    </section>
  );
}