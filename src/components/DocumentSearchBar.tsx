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
      className={`flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-2 ${className}`}
    >
      <div
        className="relative flex min-h-0 min-w-0 w-full items-center rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-200 lg:flex-[1_1_240px] lg:rounded-xl"
      >
        <Search
          className="pointer-events-none absolute left-2.5 h-4 w-4 shrink-0 text-slate-400 lg:left-3"
          aria-hidden
        />

        <input
          type="search"
          value={value}
          onChange={(e) =>
            onChange(e.target.value)
          }
          placeholder={placeholder}
          className={`w-full min-w-0 rounded-lg border-0 bg-transparent py-2 pl-9 text-sm outline-none ring-0 focus:ring-0 lg:rounded-xl lg:py-2.5 lg:pl-10 lg:pr-24 ${
            value
              ? "pr-24 lg:pr-24"
              : "pr-14 lg:pr-24"
          }`}
          autoComplete="off"
          spellCheck={false}
        />

        <span
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 tabular-nums text-slate-400 ${
            value
              ? "right-10 text-[11px] lg:right-10 lg:text-xs"
              : "right-2 text-[11px] lg:right-10 lg:text-xs"
          }`}
          aria-live="polite"
        >
          {shown}/{totalMatches}
        </span>

        {value ? (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="flex w-full items-center justify-end gap-2 lg:contents">
        <div className="flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50 lg:rounded-xl">
          <button
            type="button"
            onClick={onPrev}
            disabled={!canNavigate}
            className="rounded-l-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 lg:rounded-l-xl lg:p-2"
            aria-label="Previous match"
          >
            <ChevronLeft className="h-4 w-4 lg:h-5 lg:w-5" />
          </button>
          <div
            className="h-5 w-px bg-slate-200 lg:h-6"
            aria-hidden
          />
          <button
            type="button"
            onClick={onNext}
            disabled={!canNavigate}
            className="rounded-r-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 lg:rounded-r-xl lg:p-2"
            aria-label="Next match"
          >
            <ChevronRight className="h-4 w-4 lg:h-5 lg:w-5" />
          </button>
        </div>

        <span
          className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-400 lg:rounded-xl lg:p-2"
          title="Reserved for future options (e.g. match case)"
          aria-hidden
        >
          <MoreHorizontal className="h-4 w-4 lg:h-5 lg:w-5" />
        </span>
      </div>
    </div>
  );
};

export default DocumentSearchBar;
