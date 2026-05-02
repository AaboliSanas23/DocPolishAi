import { useMemo, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { BlockType, DocumentBlock } from "../types/document";
import { StyleConfig } from "../types/style";
import { applyStylesToHtml } from "../utils/applyStylesToHtml";

type BlockTab = BlockType;

interface Props {
  blocks: DocumentBlock[];
  setBlocks: React.Dispatch<React.SetStateAction<DocumentBlock[]>>;
  previewMode: boolean;
  styles: StyleConfig;
  originalHtml: string;
  onUpload: (file: File) => void;
}

const DocumentPreview = ({
  blocks,
  setBlocks,
  previewMode,
  styles,
  originalHtml,
  onUpload,
}: Props) => {
  const [activeTab, setActiveTab] = useState<BlockTab>("title");

  const [searchText, setSearchText] = useState("");

  const handleInlineUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (file) {
      onUpload(file);
    }
  };

  const InlineUploadButton = () => (
    <label className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white cursor-pointer hover:bg-indigo-700">
      <Upload size={16} />
      Upload DOCX
      <input
        type="file"
        accept=".docx"
        className="hidden"
        onChange={handleInlineUpload}
      />
    </label>
  );

  //-----------------------------------
  // Bold All
  //-----------------------------------
  const activeTabBlocks = useMemo(
    () => blocks.filter((block) => block.type === activeTab),
    [blocks, activeTab]
  );

  const isBoldAllActive =
    activeTabBlocks.length > 0 &&
    activeTabBlocks.every((block) => block.isBold);

  const isItalicAllActive =
    activeTabBlocks.length > 0 &&
    activeTabBlocks.every((block) => block.isItalic);

  const handleBoldAll = () => {
    const nextBoldState = !isBoldAllActive;

    setBlocks((prev) =>
      prev.map((block) =>
        block.type === activeTab
          ? {
              ...block,
              isBold: nextBoldState,
            }
          : block,
      ),
    );
  };

  //-----------------------------------
  // Italic All
  //-----------------------------------
  const handleItalicAll = () => {
    const nextItalicState = !isItalicAllActive;

    setBlocks((prev) =>
      prev.map((block) =>
        block.type === activeTab
          ? {
              ...block,
              isItalic: nextItalicState,
            }
          : block,
      ),
    );
  };

  //-----------------------------------
  // Delete block
  //-----------------------------------
  const handleDelete = (id: number) => {
    setBlocks((prev) => prev.filter((block) => block.id !== id));
  };

  //-----------------------------------
  // Single block bold
  //-----------------------------------
  const toggleBold = (id: number) => {
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === id
          ? {
              ...block,
              isBold: !block.isBold,
            }
          : block,
      ),
    );
  };

  //-----------------------------------
  // Single block italic
  //-----------------------------------
  const toggleItalic = (id: number) => {
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === id
          ? {
              ...block,
              isItalic: !block.isItalic,
            }
          : block,
      ),
    );
  };

  //-----------------------------------
  // Change block type
  //-----------------------------------
  const updateBlockType = (
    id: number,
    type: BlockType,
  ) => {
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === id
          ? {
              ...block,
              type,
            }
          : block,
      ),
    );
  };

  //-----------------------------------
  // Filter blocks
  //-----------------------------------
  const filteredBlocks = blocks.filter(
    (block) =>
      block.type === activeTab &&
      block.text.toLowerCase().includes(searchText.toLowerCase()),
  );

  const styledPreviewHtml = useMemo(() => {
    if (!originalHtml.trim()) {
      return "";
    }

    return applyStylesToHtml(originalHtml, styles);
  }, [originalHtml, styles]);

  //-----------------------------------
  // Dynamic styles
  //-----------------------------------
  const getBlockStyle = (block: DocumentBlock) => {
    let fontSize = styles.paragraphSize;
    let lineHeight = styles.paragraphLineHeight;
    let marginBottom = `${styles.paragraphSpacing}px`;

    if (block.type === "title") {
      fontSize = styles.titleSize;
      lineHeight = styles.titleLineHeight;
      marginBottom = `${styles.paragraphSpacing + 6}px`;
    }

    if (block.type === "subtitle") {
      fontSize = styles.subtitleSize;
      lineHeight = styles.subtitleLineHeight;
      marginBottom = `${styles.paragraphSpacing + 2}px`;
    }

    //-----------------------------------
    // Code block styling
    //-----------------------------------
    if (block.type === "code") {
      return {
        fontSize: "16px",
        fontFamily: "monospace",
        background: "#07152f",
        color: "#4ade80",
        padding: "20px",
        borderRadius: "12px",
        whiteSpace: "pre-wrap" as const,
        lineHeight: "1.6",
        marginBottom,
      };
    }

    return {
      fontSize: `${fontSize}px`,
      fontFamily: styles.fontFamily,
      fontWeight: block.isBold ? "bold" : "normal",
      fontStyle: block.isItalic ? "italic" : "normal",
      lineHeight: String(lineHeight),
      marginBottom,
    };
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      {/* ---------------- PREVIEW MODE ---------------- */}
      {previewMode ? (
        <>
          <h1 className="text-3xl font-bold mb-6">Final Preview</h1>

          <div className="max-h-[750px] overflow-y-auto border rounded-xl p-6">
            {styledPreviewHtml ? (
              <div
                dangerouslySetInnerHTML={{
                  __html: styledPreviewHtml,
                }}
              />
            ) : (
              <div className="min-h-[220px] flex items-center justify-center text-center text-gray-500">
                <div>
                  <p className="font-semibold text-lg text-gray-700">No document loaded</p>
                  <p className="mt-1">Upload a DOCX file to preview formatted output.</p>
                  <InlineUploadButton />
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* ---------------- EDITOR MODE ---------------- */}
          <h1 className="text-3xl font-bold mb-6">Document Editor</h1>

          {/* Tabs + Global Controls */}
          <div className="flex justify-between items-center mb-4">
            {/* Left Tabs */}
            <div className="flex gap-4">
              {(
                ["title", "subtitle", "paragraph", "code"] as BlockTab[]
              ).map((tab) => (
                <button
                  key={tab}
                  onClick={() =>
                    setActiveTab(tab as BlockTab)
                  }
                  className={`px-6 py-3 rounded-xl ${
                    activeTab === tab
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Right Controls */}
            <div className="flex gap-3">
              <button
                onClick={handleBoldAll}
                className={`px-4 py-2 rounded-lg ${
                  isBoldAllActive
                    ? "bg-indigo-500 text-white"
                    : "bg-indigo-100 text-indigo-700"
                }`}
              >
                Bold All
              </button>

              <button
                onClick={handleItalicAll}
                className={`px-4 py-2 rounded-lg ${
                  isItalicAllActive
                    ? "bg-indigo-500 text-white"
                    : "bg-indigo-100 text-indigo-700"
                }`}
              >
                Italic All
              </button>
            </div>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            className="w-full border rounded-xl p-3 mb-6"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />

          {/* Blocks */}
          <div className="space-y-5 max-h-[700px] overflow-y-auto">
            {filteredBlocks.length === 0 ? (
              <div className="border border-dashed rounded-xl p-10 text-center text-gray-500">
                {blocks.length === 0 ? (
                  <>
                    <p className="font-semibold text-lg text-gray-700">Start by uploading a DOCX file</p>
                    <p className="mt-1">Use any upload button to load your document.</p>
                    <InlineUploadButton />
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-lg text-gray-700">No blocks in this tab</p>
                    <p className="mt-1">Try a different tab or search text.</p>
                  </>
                )}
              </div>
            ) : (
              filteredBlocks.map((block) => (
                <div key={block.id} className="border rounded-xl p-5">
                  <div className="flex justify-between mb-4">
                    {/* Dropdown */}
                    <select
                      value={block.type}
                      onChange={(e) =>
                        updateBlockType(
                          block.id,
                          e.target.value as BlockTab
                        )
                      }
                      className="border rounded-lg px-3 py-2"
                    >
                      <option value="title">Title</option>
                      <option value="subtitle">Subtitle</option>
                      <option value="paragraph">Paragraph</option>
                      <option value="code">Code</option>
                    </select>

                    {/* Controls */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleBold(block.id)}
                        className={`px-3 py-2 rounded-lg border ${
                          block.isBold
                            ? "bg-indigo-400 text-white border-indigo-400"
                            : "bg-indigo-50 text-indigo-700 border-indigo-200"
                        }`}
                      >
                        B
                      </button>

                      <button
                        onClick={() => toggleItalic(block.id)}
                        className={`px-3 py-2 rounded-lg border italic ${
                          block.isItalic
                            ? "bg-indigo-400 text-white border-indigo-400"
                            : "bg-indigo-50 text-indigo-700 border-indigo-200"
                        }`}
                      >
                        I
                      </button>

                      <button
                        onClick={() => handleDelete(block.id)}
                        className="px-3 py-2 text-red-500 rounded-lg border border-red-200 hover:bg-red-50 transition-colors duration-150"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div style={getBlockStyle(block)}>{block.text}</div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DocumentPreview;
