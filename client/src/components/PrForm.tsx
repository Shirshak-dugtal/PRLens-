import { useState } from "react";
import { PR_URL_RE } from "../lib";

interface PrFormProps {
  busy: boolean;
  onSubmit: (url: string) => void;
}

export default function PrForm({ busy, onSubmit }: PrFormProps) {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const invalid = touched && value.trim() !== "" && !PR_URL_RE.test(value.trim());
  const empty = value.trim() === "";

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (empty || invalid || busy) return;
    onSubmit(value.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="w-full" noValidate>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
          </span>
          <input
            type="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="https://github.com/owner/repository/pull/123"
            aria-label="GitHub Pull Request URL"
            aria-invalid={invalid}
            className={`w-full rounded-xl bg-zinc-900 py-3.5 pl-12 pr-4 text-zinc-100 placeholder-zinc-500 shadow-inner ring-1 focus:outline-none focus:ring-2 ${
              invalid
                ? "ring-rose-500/60 focus:ring-rose-500"
                : "ring-zinc-800 focus:ring-emerald-500/60"
            } transition`}
          />
        </div>
        <button
          type="submit"
          disabled={busy || empty}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-900/30 border-t-emerald-900" />
              Reviewing…
            </>
          ) : (
            <>
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m5 12 4 4L19 6" />
              </svg>
              Review PR
            </>
          )}
        </button>
      </div>
      <p className="mt-2 min-h-5 text-sm text-rose-400" role="alert">
        {invalid ? "Not a valid GitHub pull request URL — expected github.com/{owner}/{repo}/pull/{number}" : ""}
      </p>
    </form>
  );
}