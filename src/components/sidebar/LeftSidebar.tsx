import { memo, useMemo } from "react";
import {
  CODE_BACKGROUND_PRESETS,
  DEFAULT_STYLE_CONFIG,
  HighlightMode,
  StyleConfig,
} from "../../types/style";
import { DocumentBlock } from "../../types/document";
import { wordStyleLabel } from "../../utils/docx/wordStyleLabels";

interface Props {
  blocks: DocumentBlock[];
  styles: StyleConfig;
  setStyles: React.Dispatch<React.SetStateAction<StyleConfig>>;
  /** When true, panel title is provided by the shell (e.g. mobile drawer). */
  embeddedInMenu?: boolean;
}

const LeftSidebar = ({
  blocks,
  styles,
  setStyles,
  embeddedInMenu = false,
}: Props) => {
  const updateStyle = <K extends keyof StyleConfig>(
    key: K,
    value: StyleConfig[K]
  ) => {
    setStyles((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const stats = useMemo(() => {
    let titles = 0;
    let subtitles = 0;
    let paragraphs = 0;
    let code = 0;

    blocks.forEach((block) => {
      if (block.type === "title") titles += 1;
      if (block.type === "subtitle") subtitles += 1;
      if (block.type === "paragraph") paragraphs += 1;
      if (block.type === "code") code += 1;
    });

    return {
      total: blocks.length,
      titles,
      subtitles,
      paragraphs,
      code,
    };
  }, [blocks]);

  return (
    <div className="space-y-6">
      {/* Formatting */}
      <div className="bg-white p-5 rounded-xl shadow-sm">
        {!embeddedInMenu ? (
          <h2 className="mb-4 font-semibold">
            Formatting Rules
          </h2>
        ) : (
          <span className="sr-only">Formatting Rules</span>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600">
              Title Size (pt)
            </label>
            <input
              type="number"
              value={styles.titleSize}
              onChange={(e) =>
                updateStyle(
                  "titleSize",
                  Number(e.target.value)
                )
              }
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">
              Subtitle Size (pt)
            </label>
            <input
              type="number"
              value={styles.subtitleSize}
              onChange={(e) =>
                updateStyle(
                  "subtitleSize",
                  Number(e.target.value)
                )
              }
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">
              Paragraph Size (pt)
            </label>
            <input
              type="number"
              value={styles.paragraphSize}
              onChange={(e) =>
                updateStyle(
                  "paragraphSize",
                  Number(e.target.value)
                )
              }
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Paragraph Spacing</label>
            <input
              type="number"
              min="0"
              max="60"
              value={styles.paragraphSpacing}
              onChange={(e) =>
                updateStyle(
                  "paragraphSpacing",
                  Number(e.target.value)
                )
              }
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Font Family</label>
            <select
              value={styles.fontFamily}
              onChange={(e) =>
                updateStyle(
                  "fontFamily",
                  e.target.value
                )
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:outline-none"
            >
              <option>Calibri</option>
              <option>Times New Roman</option>
              <option>Arial</option>
              <option>Nunito</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600">Bullet Style</label>
            <select
              value={styles.bulletStyle}
              onChange={(e) =>
                updateStyle(
                  "bulletStyle",
                  e.target.value as "dot" | "dash"
                )
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:outline-none"
            >
              <option value="dot">Dot</option>
              <option value="dash">Dash</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Dot or dash markers for unordered lists in preview,
              export, and beside list rows in the editor (when Word
              lists were detected).
            </p>
          </div>

          {/* Code section detection toggle */}
          <div>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm text-gray-600">
                Detect Code Sections
              </span>

              <span
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                  styles.detectCodeBlocks
                    ? "bg-indigo-500"
                    : "bg-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={styles.detectCodeBlocks}
                  onChange={(e) =>
                    updateStyle(
                      "detectCodeBlocks",
                      e.target.checked
                    )
                  }
                  className="sr-only"
                />
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                    styles.detectCodeBlocks
                      ? "translate-x-5"
                      : "translate-x-0.5"
                  }`}
                />
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Off = treat code lines as plain paragraphs.
            </p>
          </div>

          {/* Code background color */}
          {styles.detectCodeBlocks && (
            <div>
              <label className="text-sm text-gray-600 block mb-2">
                Code Background
              </label>

              <div className="grid grid-cols-7 gap-1.5 mb-2">
                {CODE_BACKGROUND_PRESETS.map(
                  (preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      title={preset.label}
                      onClick={() =>
                        updateStyle(
                          "codeBackground",
                          preset.value
                        )
                      }
                      className={`h-8 w-full rounded-md border-2 transition ${
                        styles.codeBackground ===
                        preset.value
                          ? "border-indigo-500 ring-2 ring-indigo-200"
                          : "border-gray-200"
                      }`}
                      style={{
                        background: preset.value,
                      }}
                    />
                  )
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={styles.codeBackground}
                  onChange={(e) =>
                    updateStyle(
                      "codeBackground",
                      e.target.value
                    )
                  }
                  className="h-9 w-11 rounded border cursor-pointer"
                />
                <input
                  type="text"
                  value={styles.codeBackground}
                  onChange={(e) =>
                    updateStyle(
                      "codeBackground",
                      e.target.value
                    )
                  }
                  className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono"
                  placeholder="#f8fafc"
                />
              </div>
            </div>
          )}

          {/* Highlight toggle */}
          <div>
            <label className="text-sm text-gray-600 block mb-2">
              Original Highlights
            </label>

            <div className="flex gap-3">
              {(
                [
                  { value: "keep", label: "Keep" },
                  { value: "remove", label: "Remove" },
                ] as { value: HighlightMode; label: string }[]
              ).map(({ value, label }) => (
                <label
                  key={value}
                  className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border text-sm flex-1 justify-center ${
                    styles.highlightMode === value
                      ? "bg-indigo-50 border-indigo-400 text-indigo-700 font-medium"
                      : "bg-white border-gray-200 text-gray-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="highlightMode"
                    value={value}
                    checked={styles.highlightMode === value}
                    onChange={() =>
                      updateStyle("highlightMode", value)
                    }
                    className="accent-indigo-600"
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Keep: Word text colours and highlights as in the
              document. Remove: strip them everywhere (including
              inside code); code and output still use your Code
              Background. Switching to Remove applies to this copy
              only — upload the DOCX again if you want to reload the
              original colours from Word. Use &quot;Preserve Word
              highlights &amp; inline body styling&quot; below for a
              single switch that also resets body typography.
            </p>
          </div>

          <div>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm text-gray-600">
                Preserve Word highlights &amp; inline body styling
              </span>
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                  styles.highlightMode ===
                    "keep" &&
                  !styles.applyBodyFontFromSettings
                    ? "bg-indigo-500"
                    : "bg-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={
                    styles.highlightMode ===
                      "keep" &&
                    !styles.applyBodyFontFromSettings
                  }
                  onChange={(e) => {
                    const preserve =
                      e.target.checked;

                    setStyles(
                      (
                        prev
                      ) => ({
                        ...prev,
                        highlightMode:
                          preserve
                            ? "keep"
                            : "remove",
                        applyBodyFontFromSettings:
                          !preserve,
                      })
                    );
                  }}
                  className="sr-only"
                />
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                    styles.highlightMode ===
                      "keep" &&
                    !styles.applyBodyFontFromSettings
                      ? "translate-x-5"
                      : "translate-x-0.5"
                  }`}
                />
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              On (default): keeps Word highlight colours on body text,
              preserves inline bold/italic/underline inside paragraphs,
              and keeps imported tables; sidebar title/subtitle rules
              and spacing still apply. Off: sets Original Highlights to
              Remove, applies sidebar Paragraph Size and font to body,
              and clears Word bold on body — upload the DOCX again to
              reload original colours and emphasis.
            </p>
          </div>

          <div>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm text-gray-600">
                Promote heading-like opening lines
              </span>
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                  styles.promoteOutlineHeadings
                    ? "bg-indigo-500"
                    : "bg-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={styles.promoteOutlineHeadings}
                  onChange={(e) =>
                    updateStyle(
                      "promoteOutlineHeadings",
                      e.target.checked
                    )
                  }
                  className="sr-only"
                />
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                    styles.promoteOutlineHeadings
                      ? "translate-x-5"
                      : "translate-x-0.5"
                  }`}
                />
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Off: first lines keep Word styling. On (default): short
              title-like paragraphs use your Title/Subtitle sizes in
              preview.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setStyles({
                ...DEFAULT_STYLE_CONFIG,
              })
            }
            className="w-full border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-3 py-2 text-sm font-medium"
          >
            Reset Defaults
          </button>
        </div>
      </div>

      {/* Outline */}
      {/* <div className="bg-white p-5 rounded-xl shadow-sm">
        <h2 className="font-semibold mb-3">Document Outline</h2>

        {titles.map((title) => (
          <p key={title.id} className="text-sm mb-2">
            {title.text}
          </p>
        ))}
      </div> */}

      {/* Stats */}
      <div className="bg-white p-5 rounded-xl shadow-sm">
        <h2 className="font-semibold mb-3">Stats</h2>

        <p>
          Total Blocks:
          {stats.total}
        </p>
        <p>
          {wordStyleLabel("title")}:
          {stats.titles}
        </p>
        <p>
          {wordStyleLabel("subtitle")}:
          {stats.subtitles}
        </p>
        <p>
          {wordStyleLabel("paragraph")}:
          {stats.paragraphs}
        </p>
        <p>
          {wordStyleLabel("code")}:
          {stats.code}
        </p>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm">
        <h2 className="font-semibold mb-3">Project Insights</h2>
        <p className="text-sm text-gray-600">
          Detection Mode: Rules 
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Structure Preserve: Word tables stay as tables; heading
          promotion is opt-in; code styling only when detection is on.
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Code Styling: Monospace font with your Code Background colour
          (defaults to light; dark presets adjust text automatically).
        </p>
        <p className="text-xs text-gray-500 mt-3">
          Tip: If a block is misclassified, change its Word style in the
          editor (Title, Paragraph, etc.).
        </p>
      </div>
    </div>
  );
};

export default memo(LeftSidebar);
