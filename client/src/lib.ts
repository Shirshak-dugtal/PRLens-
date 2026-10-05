export const PR_URL_RE = /^https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/pull\/\d+([/?#].*)?$/;

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function percent(value: number, digits = 0): string {
  return `${((value ?? 0) * 100).toFixed(digits)}%`;
}

export function titleCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^[a-z]|[A-Z]/g, (m) => m.toUpperCase());
}

export function scoreTone(index: number, total: number, betterHigher: boolean): string {
  const ratio = index / Math.max(1, total - 1);
  const r = betterHigher ? ratio : 1 - ratio;
  if (r < 0.34) return "bg-rose-500/80";
  if (r < 0.67) return "bg-amber-500/80";
  return "bg-emerald-500/80";
}

export interface TonePalette {
  accent: string;
  chip: string;
  ring: string;
}

export const VERDICT_TONES: Record<string, TonePalette> = {
  good: {
    accent: "text-emerald-400",
    chip: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    ring: "ring-emerald-500/20",
  },
  suggest: {
    accent: "text-sky-400",
    chip: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
    ring: "ring-sky-500/20",
  },
  warn: {
    accent: "text-amber-400",
    chip: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    ring: "ring-amber-500/20",
  },
  danger: {
    accent: "text-rose-400",
    chip: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
    ring: "ring-rose-500/20",
  },
};