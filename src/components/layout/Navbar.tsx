import {
  useCallback,
  useEffect,
  useRef,
  useState,
  memo,
} from "react";
import {
  Download,
  Eye,
  Home,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";

interface Props {
  onPreview: () => void;
  onExport: () => void;
  onAutoFix: () => void;
  onUpload: (file: File) => void;
  onOpenFormatting: () => void;
  /** Clear document and exit preview / close formatting drawer. */
  onResetWorkspace: () => void;
  previewMode: boolean;
  hasDocument: boolean;
  autoFixing?: boolean;
  /** When the slide-over formatting panel is open, hide the nav Format tooltip. */
  formattingPanelOpen?: boolean;
}

const Navbar = ({
  onPreview,
  onExport,
  onAutoFix,
  onUpload,
  onOpenFormatting,
  onResetWorkspace,
  previewMode,
  hasDocument,
  autoFixing = false,
  formattingPanelOpen = false,
}: Props) => {
  const formatBtnRef =
    useRef<HTMLButtonElement>(null);
  const [formatTipPos, setFormatTipPos] =
    useState<{
      top: number;
      left: number;
    } | null>(null);

  const updateFormatTooltip =
    useCallback(() => {
      const el =
        formatBtnRef.current;

      if (!el) {
        return;
      }

      const r =
        el.getBoundingClientRect();

      setFormatTipPos({
        top: r.bottom + 8,
        left:
          r.left +
          r.width / 2,
      });
    }, []);

  const hideFormatTooltip =
    useCallback(() => {
      setFormatTipPos(null);
    }, []);

  useEffect(() => {
    if (!formatTipPos) {
      return;
    }

    const sync =
      updateFormatTooltip;

    window.addEventListener(
      "scroll",
      sync,
      true
    );
    window.addEventListener(
      "resize",
      sync
    );

    return () => {
      window.removeEventListener(
        "scroll",
        sync,
        true
      );
      window.removeEventListener(
        "resize",
        sync
      );
    };
  }, [
    formatTipPos,
    updateFormatTooltip,
  ]);

  useEffect(() => {
    if (formattingPanelOpen) {
      setFormatTipPos(null);
    }
  }, [formattingPanelOpen]);

  return (
    <div className="flex items-center justify-between gap-2 border-b bg-white px-3 py-2.5 shadow-sm sm:px-6 sm:py-4">
      <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onResetWorkspace}
          aria-label="Home"
          title="Home"
          className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-800 shadow-sm hover:bg-gray-50 sm:gap-2 sm:px-3 sm:text-sm"
        >
          <Home
            size={18}
            className="shrink-0 text-indigo-600"
            aria-hidden
          />
          <span className="hidden sm:inline">
            Home
          </span>
        </button>

        <h1 className="min-w-0 truncate border-l border-gray-200 pl-2 text-lg font-bold tracking-tight text-indigo-600 sm:pl-3 sm:text-xl lg:text-2xl">
          DocPolishAI
        </h1>
      </div>

      <div className="flex min-w-0 flex-1 justify-end">
        <div className="flex max-w-full flex-nowrap items-center justify-end gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] sm:gap-2 sm:pb-0 lg:max-w-none lg:overflow-visible lg:pb-0">
        <button
          ref={formatBtnRef}
          type="button"
          onClick={onOpenFormatting}
          aria-describedby={
            formatTipPos
              ? "formatting-tooltip"
              : undefined
          }
          aria-label="Open formatting rules"
          className="flex shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-white p-2 text-xs font-medium text-indigo-800 shadow-sm hover:bg-indigo-50 lg:hidden"
          onMouseEnter={
            formattingPanelOpen
              ? undefined
              : updateFormatTooltip
          }
          onMouseLeave={
            formattingPanelOpen
              ? undefined
              : hideFormatTooltip
          }
          onFocus={
            formattingPanelOpen
              ? undefined
              : updateFormatTooltip
          }
          onBlur={
            formattingPanelOpen
              ? undefined
              : hideFormatTooltip
          }
        >
          <SlidersHorizontal
            size={18}
            className="shrink-0 text-indigo-600"
            aria-hidden
          />
        </button>

        {/* Upload */}
        <label
          aria-label="Upload new DOCX file"
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium hover:bg-gray-50 sm:gap-2 sm:px-4 sm:py-2 sm:text-base"
        >
          <Upload
            size={16}
            className="shrink-0 sm:h-[18px] sm:w-[18px]"
            aria-hidden
          />
          <span className="whitespace-nowrap sm:hidden">
            Upload
          </span>
          <span className="hidden whitespace-nowrap sm:inline">
            Upload New
          </span>
          <input
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];

              if (file) {
                onUpload(file);
              }
            }}
          />
        </label>

        {hasDocument && (
          <>
            <button
              type="button"
              onClick={onResetWorkspace}
              aria-label="Close document"
              title="Close document"
              className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 sm:gap-2 sm:px-4 sm:py-2 sm:text-base"
            >
              <X
                size={16}
                className="shrink-0 text-gray-700 sm:h-[18px] sm:w-[18px]"
                aria-hidden
              />
              <span className="whitespace-nowrap">
                Close
              </span>
            </button>

            {/* Auto Fix */}
            {/* <button
              onClick={onAutoFix}
              disabled={autoFixing}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg flex gap-2 items-center disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Wand2 size={18} />
              {autoFixing ? "Auto Fixing..." : "Auto Fix"}
            </button> */}

            {/* Preview */}
            <button
              type="button"
              onClick={onPreview}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-2 py-1.5 text-xs text-white sm:gap-2 sm:px-4 sm:py-2 sm:text-base"
            >
              <Eye
                size={16}
                className="shrink-0 sm:h-[18px] sm:w-[18px]"
                aria-hidden
              />
              {previewMode ? "Edit Mode" : "Preview"}
            </button>

            {/* Export */}
            <button
              type="button"
              onClick={onExport}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-green-600 px-2 py-1.5 text-xs text-white sm:gap-2 sm:px-4 sm:py-2 sm:text-base"
            >
              <Download
                size={16}
                className="shrink-0 sm:h-[18px] sm:w-[18px]"
                aria-hidden
              />
              Export
            </button>
          </>
        )}
        </div>
      </div>

      {formatTipPos &&
      !formattingPanelOpen ? (
        <div
          id="formatting-tooltip"
          role="tooltip"
          className="pointer-events-none fixed z-[100] max-w-[min(90vw,16rem)] -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-center text-xs font-medium leading-snug text-white shadow-lg ring-1 ring-white/10"
          style={{
            top: formatTipPos.top,
            left: formatTipPos.left,
          }}
        >
          Format
        </div>
      ) : null}
    </div>
  );
};

export default memo(Navbar);
