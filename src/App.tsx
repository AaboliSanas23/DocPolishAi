import { useState } from "react";

import Navbar from "./components/Navbar";
import LeftSidebar from "./components/LeftSidebar";
import DocumentPreview from "./components/DocumentPreview";

import { DocumentBlock } from "./types/document";
import { DEFAULT_STYLE_CONFIG, StyleConfig } from "./types/style";

import { extractDocumentHtml } from "./utils/extractBlocks";
import { extractBlocksFromHtml } from "./utils/parseDoc";
import { detectBlockTypes } from "./utils/detectType";
import { exportDocument } from "./utils/exportDoc";

function App() {
  const [blocks, setBlocks] = useState<DocumentBlock[]>([]);
  const [originalHtml, setOriginalHtml] = useState("");

  const [previewMode, setPreviewMode] = useState(false);

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
      setOriginalHtml(extractedHtml);
      const rawBlocks = extractBlocksFromHtml(extractedHtml);
      const classifiedBlocks = detectBlockTypes(rawBlocks);
      setBlocks(classifiedBlocks);
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
  const handleAutoFix = () => {
    console.log("Auto Fix clicked");
  };

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Navbar */}
      <Navbar
        previewMode={previewMode}
        hasDocument={blocks.length > 0}
        onPreview={() => setPreviewMode(!previewMode)}
        onExport={handleExport}
        onAutoFix={handleAutoFix}
        onUpload={handleFileUpload}
      />

      {/* Main content */}
      <div className="grid grid-cols-12 gap-6 p-6">
        {/* Left Sidebar */}
        <div className="col-span-3">
          <LeftSidebar
            blocks={blocks}
            styles={styles}
            setStyles={setStyles}
          />
        </div>

        {/* Main Editor / Preview */}
        <div className="col-span-9">
          <DocumentPreview
            blocks={blocks}
            setBlocks={setBlocks}
            previewMode={previewMode}
            styles={styles}
            originalHtml={originalHtml}
            onUpload={handleFileUpload}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
