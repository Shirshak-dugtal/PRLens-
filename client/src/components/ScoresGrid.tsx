import type { ScoreAnswer } from "../types";
import { scoreTone } from "../lib";

interface ScoreCardProps {
  title: string;
  hint: string;
  answer: ScoreAnswer;
  betterHigher: boolean;
  max: number;
}

function ScoreCard({ title, hint, answer, betterHigher, max }: ScoreCardProps) {
  const levels = Object.keys(answer.probabilities)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const nearest = levels.length > 0 ? levels.reduce((acc, level) => (Math.abs(level - answer.score) < Math.abs(acc - answer.score) ? level : acc), levels[0]!) : null;
  const legendText = nearest !== null ? answer.legend[String(nearest)] ?? "" : "";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>
        </div>
        <div className="text-right">
          <span className="font-mono text-2xl font-bold text-zinc-50">{answer.score.toFixed(1)}</span>
          <span className="font-mono text-sm text-zinc-500"> / {max}</span>
        </div>
      </div>

      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-zinc-800/60">
        {levels.map((level) => {
          const prob = answer.probabilities[String(level)] ?? 0;
          return (
            <div
              key={level}
              className={`h-full rounded-full transition-all ${scoreTone(level, max + 1, betterHigher)}`}
              style={{ width: `${prob * 100}%` }}
              title={`Score ${level}: ${(prob * 100).toFixed(1)}%`}
            />
          );
        })}
      </div>

      {legendText && <p className="text-xs leading-relaxed text-zinc-400">{legendText}</p>}
    </div>
  );
}

interface ScoresGridProps {
  overallQuality: ScoreAnswer;
  riskLevel: ScoreAnswer;
  testCoverage: ScoreAnswer;
  codeClarity: ScoreAnswer;
}

export default function ScoresGrid({ overallQuality, riskLevel, testCoverage, codeClarity }: ScoresGridProps) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Engineering scores</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ScoreCard title="Overall quality" hint="Higher is better" answer={overallQuality} betterHigher max={6} />
        <ScoreCard title="Regression risk" hint="Lower is better" answer={riskLevel} betterHigher={false} max={4} />
        <ScoreCard title="Test coverage" hint="Higher is better" answer={testCoverage} betterHigher max={4} />
        <ScoreCard title="Code clarity" hint="Higher is better" answer={codeClarity} betterHigher max={4} />
      </div>
    </section>
  );
}