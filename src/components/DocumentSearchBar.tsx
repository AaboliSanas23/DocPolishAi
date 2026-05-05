import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Total matches (0 when none). */
  totalMatches: number;
  /** Zero-based index of the highlighted / focused match. */
  activeMatchIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onClear: () => void;
  className?: string;
}

const DocumentSearchBar = ({
  value,
  onChange,
  placeholder = "Search…",
  totalMatches,
  activeMatchIndex,
  onPrev,
  onNext,
  onClear,
  className = "",
}: Props) => {
  const canNavigate =
    totalMatches > 0 && value.trim().length > 0;

  const shown =
    totalMatches === 0
      ? 0
      : Math.min(
          activeMatchIndex + 1,
          totalMatches
        );

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`}
    >
      <div
        className="relative flex min-w-0 flex-1 flex-[1_1_240px] items-center rounded-xl border border-slate-300 bg-white shadow-sm focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-200"
      >
        <Search
          className="pointer-events-none absolute left-3 h-4 w-4 shrink-0 text-slate-400"
          aria-hidden
        />

        <input
          type="search"
          value={value}
          onChange={(e) =>
            onChange(e.target.value)
          }
          placeholder={placeholder}
          className="w-full min-w-0 rounded-xl border-0 bg-transparent py-2.5 pl-10 pr-24 text-sm outline-none ring-0 focus:ring-0"
          autoComplete="off"
          spellCheck={false}
        />

        <span
          className="pointer-events-none absolute right-10 text-xs tabular-nums text-slate-400"
          aria-live="polite"
        >
          {shown}/{totalMatches}
        </span>

        {value ? (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center rounded-xl border border-slate-200 bg-slate-50">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canNavigate}
          className="rounded-l-xl p-2 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous match"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div
          className="h-6 w-px bg-slate-200"
          aria-hidden
        />
        <button
          type="button"
          onClick={onNext}
          disabled={!canNavigate}
          className="rounded-r-xl p-2 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next match"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <span
        className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-400"
        title="Reserved for future options (e.g. match case)"
        aria-hidden
      >
        <MoreHorizontal className="h-5 w-5" />
      </span>
    </div>
  );
};

export default DocumentSearchBar;
