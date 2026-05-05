import { useEffect, useRef, useState } from "react";

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
  const [autoFixing, setAutoFixing] = useState(false);
  const [autoFixMessage, setAutoFixMessage] = useState("");

  const [styles, setStyles] = useState<StyleConfig>(
    () => ({
      ...DEFAULT_STYLE_CONFIG,
    })
  );

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
          autoFixing={autoFixing}
        />

        {autoFixMessage && (
          <div className="px-6 pt-3 pb-0">
            <div className="bg-indigo-50 text-indigo-700 text-sm rounded-xl px-4 py-2 border border-indigo-100">
              {autoFixMessage}
            </div>
          </div>
        )}
      </div>

      {/* Main content — fills remaining height, both columns scroll independently */}
      <div className="flex-1 grid grid-cols-12 gap-6 p-6 min-h-0">
        {/* Left Sidebar */}
        <div className="col-span-3 h-full overflow-y-auto">
          <LeftSidebar
            blocks={blocks}
            styles={styles}
            setStyles={setStyles}
          />
        </div>

        {/* Main Editor / Preview */}
        <div className="col-span-9 h-full overflow-y-auto">
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
    </div>
  );
}

export default App;
