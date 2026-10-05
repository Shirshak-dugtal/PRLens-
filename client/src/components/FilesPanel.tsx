import type { PrFileSummary } from "../types";
import { formatNumber } from "../lib";

const STATUS_STYLES: Record<string, string> = {
  added: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  removed: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  renamed: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  copied: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  modified: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
};

function StatusChip({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${style}`}>{status}</span>
  );
}

function FileHeader({ file }: { file: PrFileSummary }) {
  return (
    <>
      <StatusChip status={file.status} />
      <span className="min-w-0 flex-1 break-all font-mono text-sm text-zinc-200">{file.filename}</span>
      <span className="shrink-0 font-mono text-xs text-emerald-400">+{formatNumber(file.additions)}</span>
      <span className="shrink-0 font-mono text-xs text-rose-400">−{formatNumber(file.deletions)}</span>
    </>
  );
}

function FileRow({ file }: { file: PrFileSummary }) {
  if (file.patch === null) {
    return (
      <li className="border-b border-zinc-800/70 px-4 py-3 last:border-b-0">
        <div className="flex items-center gap-3">
          <FileHeader file={file} />
          <span className="shrink-0 text-[11px] text-zinc-600">
            {file.patchSkipped ? "patch omitted" : "no diff"}
          </span>
        </div>
      </li>
    );
  }

  return (
    <li className="border-b border-zinc-800/70 last:border-b-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition hover:bg-zinc-800/40 [&::-webkit-details-marker]:hidden">
          <FileHeader file={file} />
          <span className="relative shrink-0 rounded-lg bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 group-open:text-emerald-300">
            Diff
            <svg
              className="mr-0.5 inline h-3 w-3 align-middle transition-transform group-open:rotate-180"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </summary>
        <pre className="max-h-96 overflow-auto border-t border-zinc-800/70 bg-black/30 px-4 py-3 text-xs leading-relaxed text-zinc-300">
          <code>{file.patch}</code>
        </pre>
      </details>
    </li>
  );
}

interface FilesPanelProps {
  files: PrFileSummary[];
  worstFileChoice: string | null;
}

export default function FilesPanel({ files, worstFileChoice }: FilesPanelProps) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Changed files · {formatNumber(files.length)}
        </h2>
        {worstFileChoice && (
          <span className="truncate text-xs text-zinc-500">
            Flagged: <span className="font-mono text-amber-300">{worstFileChoice}</span>
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60">
        <ul className="divide-y divide-zinc-800/70">
          {files.map((file) => (
            <FileRow key={`${file.previousFilename ?? ""}${file.filename}`} file={file} />
          ))}
        </ul>
      </div>
    </section>
  );
}