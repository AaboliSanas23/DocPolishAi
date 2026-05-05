import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import Navbar from "./components/Navbar";
import LeftSidebar from "./components/LeftSidebar";
import DocumentPreview from "./components/DocumentPreview";

import { DocumentBlock } from "./types/document";
import { DEFAULT_STYLE_CONFIG, StyleConfig } from "./types/style";

import { blocksToHtml } from "./utils/blocksToHtml";
import { extractDocumentHtml } from "./utils/extractBlocks";
import { extractBlocksFromHtml } from "./utils/parseDoc";
import { detectBlockTypes } from "./utils/detectType";
import { exportDocument } from "./utils/exportDoc";
import { autoFixBlocksWithAI } from "./utils/autoFixWithAI";
import { stripBoldTagsFromRichHtml } from "./utils/sanitizeRichParagraphHtml";

const stripParagraphBoldFlagsWhenApplyingBodyFont = (
  blocks: DocumentBlock[]
): DocumentBlock[] =>
  blocks.map((block) => {
    if (
      block.type !== "paragraph" ||
      block.tableHtml?.trim()
    ) {
      return block;
    }

    let next: DocumentBlock = {
      ...block,
      isBold: false,
    };

    if (next.inlineHtml?.trim()) {
      next = {
        ...next,
        inlineHtml:
          stripBoldTagsFromRichHtml(
            next.inlineHtml
          ).trim() ||
          undefined,
      };
    }

    return next;
  });

function App() {
  const [blocks, setBlocks] = useState<DocumentBlock[]>([]);
  const [originalHtml, setOriginalHtml] = useState("");

  const [previewMode, setPreviewMode] = useState(false);
  const [formattingMenuOpen, setFormattingMenuOpen] =
    useState(false);
  const [autoFixing, setAutoFixing] = useState(false);
  const [autoFixMessage, setAutoFixMessage] = useState("");

  const [styles, setStyles] = useState<StyleConfig>(
    () => ({
      ...DEFAULT_STYLE_CONFIG,
    })
  );

  /** Clear loaded document and return to the empty workspace (Home / Close document). */
  const resetWorkspace = () => {
    setBlocks([]);
    setOriginalHtml("");
    setPreviewMode(false);
    setAutoFixMessage("");
    setFormattingMenuOpen(false);
  };

  //------------------------------------------
  // Upload DOCX
  //------------------------------------------
  const handleFileUpload = async (file: File) => {
    try {
      const extractedHtml = await extractDocumentHtml(file);
      const rawBlocks =
        extractBlocksFromHtml(extractedHtml);
      const classifiedBlocks =
        detectBlockTypes(rawBlocks);

      setBlocks(
        styles.applyBodyFontFromSettings
          ? stripParagraphBoldFlagsWhenApplyingBodyFont(
              classifiedBlocks
            )
          : classifiedBlocks
      );
      setPreviewMode(false);
    } catch (error) {
      console.error("Document processing failed:", error);
    }
  };

  //------------------------------------------
  // Export DOCX
  //------------------------------------------
  const handleExport = async () => {
    try {
      await exportDocument(originalHtml, styles);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  //------------------------------------------
  // Auto Fix
  //------------------------------------------
  const handleAutoFix = async () => {
    if (!blocks.length || autoFixing) {
      return;
    }

    setAutoFixing(true);
    setAutoFixMessage("");

    const aiFixedBlocks = await autoFixBlocksWithAI(
      blocks,
      styles
    );

    if (aiFixedBlocks && aiFixedBlocks.length) {
      setBlocks(aiFixedBlocks);
      setAutoFixMessage(
        "Auto Fix applied using local AI classification."
      );
    } else {
      setAutoFixMessage(
        "Auto Fix unavailable (AI offline). Connect Ollama to use AI fixes."
      );
    }

    setAutoFixing(false);
  };

  const prevApplyBodyFontRef =
    useRef(
      styles.applyBodyFontFromSettings
    );

  useEffect(() => {
    const wasOn =
      prevApplyBodyFontRef.current;

    prevApplyBodyFontRef.current =
      styles.applyBodyFontFromSettings;

    if (
      !styles.applyBodyFontFromSettings ||
      wasOn
    ) {
      return;
    }

    setBlocks((prev) =>
      stripParagraphBoldFlagsWhenApplyingBodyFont(
        prev
      )
    );
  }, [styles.applyBodyFontFromSettings]);

  useEffect(() => {
    if (!blocks.length) {
      setOriginalHtml("");
      return;
    }

    setOriginalHtml(blocksToHtml(blocks));
  }, [blocks]);

  useEffect(() => {
    if (!formattingMenuOpen) {
      return;
    }

    const mq = window.matchMedia("(min-width: 1024px)");
    const closeIfDesktop = () => {
      if (mq.matches) {
        setFormattingMenuOpen(false);
      }
    };

    closeIfDesktop();
    mq.addEventListener("change", closeIfDesktop);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFormattingMenuOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      mq.removeEventListener("change", closeIfDesktop);
      document.removeEventListener(
        "keydown",
        onKeyDown
      );
      document.body.style.overflow = prevOverflow;
    };
  }, [formattingMenuOpen]);

  return (
    <div className="h-screen flex flex-col bg-[#f5f6fa] overflow-hidden">
      {/* Navbar */}
      <div className="flex-none">
        <Navbar
          previewMode={previewMode}
          hasDocument={blocks.length > 0}
          onPreview={() => setPreviewMode(!previewMode)}
          onExport={handleExport}
          onAutoFix={handleAutoFix}
          onUpload={handleFileUpload}
          onResetWorkspace={resetWorkspace}
          onOpenFormatting={() =>
            setFormattingMenuOpen(true)
          }
          autoFixing={autoFixing}
          formattingPanelOpen={
            formattingMenuOpen
          }
        />

        {autoFixMessage && (
          <div className="px-6 pt-3 pb-0">
            <div className="bg-indigo-50 text-indigo-700 text-sm rounded-xl px-4 py-2 border border-indigo-100">
              {autoFixMessage}
            </div>
          </div>
        )}
      </div>

      {/* lg+: same split as before (3 | 9). Smaller screens: one column + drawer */}
      <div className="flex-1 grid min-h-0 grid-cols-1 gap-4 p-4 lg:grid-cols-12 lg:gap-6 lg:p-6">
        <div className="hidden h-full min-h-0 overflow-y-auto lg:col-span-3 lg:block">
          <LeftSidebar
            blocks={blocks}
            styles={styles}
            setStyles={setStyles}
          />
        </div>

        <div className="h-full min-h-0 overflow-y-auto lg:col-span-9">
          <DocumentPreview
            blocks={blocks}
            setBlocks={setBlocks}
            previewMode={previewMode}
            styles={styles}
            originalHtml={originalHtml}
            setOriginalHtml={setOriginalHtml}
            onUpload={handleFileUpload}
          />
        </div>
      </div>

      {formattingMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="formatting-panel-title"
        >
          <button
            type="button"
            aria-label="Close formatting panel"
            className="absolute inset-0 bg-black/40"
            onClick={() =>
              setFormattingMenuOpen(false)
            }
          />
          <div className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-[#f5f6fa] shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
              <h2
                id="formatting-panel-title"
                className="text-lg font-semibold text-gray-900"
              >
                Formatting Rules
              </h2>
              <button
                type="button"
                onClick={() =>
                  setFormattingMenuOpen(false)
                }
                className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-indigo-600 hover:bg-indigo-50"
                aria-label="Close formatting panel"
              >
                <span className="hidden text-sm font-medium text-gray-800 sm:inline">
                  Close
                </span>
                <X size={22} aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <LeftSidebar
                blocks={blocks}
                styles={styles}
                setStyles={setStyles}
                embeddedInMenu
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
