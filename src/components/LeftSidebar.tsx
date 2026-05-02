import { useMemo } from "react";
import {
  DEFAULT_STYLE_CONFIG,
  StyleConfig,
} from "../types/style";
import { DocumentBlock } from "../types/document";

interface Props {
  blocks: DocumentBlock[];
  styles: StyleConfig;
  setStyles: React.Dispatch<React.SetStateAction<StyleConfig>>;
}

const LeftSidebar = ({ blocks, styles, setStyles }: Props) => {
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
        <h2 className="font-semibold mb-4">Formatting Rules</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600">Title Size</label>
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
            <label className="text-sm text-gray-600">Subtitle Size</label>
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
            <label className="text-sm text-gray-600">Paragraph Size</label>
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
            <label className="text-sm text-gray-600">Title Line Height</label>
            <input
              type="number"
              step="0.1"
              min="1"
              max="3"
              value={styles.titleLineHeight}
              onChange={(e) =>
                updateStyle(
                  "titleLineHeight",
                  Number(e.target.value)
                )
              }
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Subtitle Line Height</label>
            <input
              type="number"
              step="0.1"
              min="1"
              max="3"
              value={styles.subtitleLineHeight}
              onChange={(e) =>
                updateStyle(
                  "subtitleLineHeight",
                  Number(e.target.value)
                )
              }
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Paragraph Line Height</label>
            <input
              type="number"
              step="0.1"
              min="1"
              max="3"
              value={styles.paragraphLineHeight}
              onChange={(e) =>
                updateStyle(
                  "paragraphLineHeight",
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
              className="w-full border rounded-lg px-3 py-2"
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
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="dot">Dot</option>
              <option value="dash">Dash</option>
            </select>
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
          Titles:
          {stats.titles}
        </p>
        <p>
          Subtitles:
          {stats.subtitles}
        </p>
        <p>
          Paragraphs:
          {stats.paragraphs}
        </p>
        <p>
          Code:
          {stats.code}
        </p>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm">
        <h2 className="font-semibold mb-3">Project Insights</h2>
        <p className="text-sm text-gray-600">
          Detection Mode: Rules-based
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Structure Preserve: Enabled for tables and highlights
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Code Styling: Dark background + monospace
        </p>
        <p className="text-xs text-gray-500 mt-3">
          Tip: If any block is misclassified, switch its type from the editor dropdown.
        </p>
      </div>
    </div>
  );
};

export default LeftSidebar;
