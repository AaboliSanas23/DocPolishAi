import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Trash2, Upload } from "lucide-react";
import { BlockType, DocumentBlock } from "../../types/document";
import { StyleConfig } from "../../types/style";
import { applyStylesToHtml } from "../../utils/formatting/applyStylesToHtml";
import {
  countSearchMatchesInHtml,
  highlightSearchInHtml,
  stripDocPolishSearchMarks,
} from "../../utils/editor/highlightSearchInHtml";
import { extractBlocksFromHtml } from "../../utils/docx/parseDoc";
import { detectBlockTypes } from "../../utils/docx/detectType";
import {
  applyJoinedLinesToBodyBlocks,
  tryParseOutputTailAfterCode,
} from "../../utils/editor/outputSectionBlocks";
import { wordStyleLabel } from "../../utils/docx/wordStyleLabels";
import { useMatchMedia } from "../../hooks/useMatchMedia";
import DocumentSearchBar from "./DocumentSearchBar";
import RichParagraphField, {
  type RichParagraphFieldHandle,
} from "./RichParagraphField";
import {
  blockToRichEditorHtml,
  commitRichEditorPayload,
  applyBoldAllToBlock,
  applyItalicAllToBlock,
  applyUnderlineAllToBlock,
  blockLooksGloballyBold,
  blockLooksGloballyItalic,
  blockLooksGloballyUnderline,
} from "../../utils/editor/richEditorHtml";

/** Whether a {@link DocumentBlock} belongs to the editor’s active style tab. */
type EditorTab = BlockType | "all";

/** Narrow layout + real hover (e.g. resized desktop); phones skip `title` hints. */
const SMALL_VIEWPORT_HOVER =
  "(max-width: 1023px) and (hover: hover)";

function editorTabHoverTitle(
  tab: EditorTab
): string {
  switch (tab) {
    case "all":
      return "Show every block type in this document.";
    case "title":
      return "Show only title blocks.";
    case "subtitle":
      return "Show only subtitle blocks.";
    case "paragraph":
      return "Show paragraph and table blocks.";
    case "code":
      return "Show only code blocks.";
    case "table":
      return "Show table blocks.";
    default:
      return "";
  }
}

const blockMatchesEditorTab = (
  block: DocumentBlock,
  tab: EditorTab
): boolean => {
  if (tab === "all") {
    return true;
  }

  if (tab === "paragraph") {
    return (
      block.type === "paragraph" ||
      block.type === "table"
    );
  }

  return block.type === tab;
};

function InlineDocxUploadButton({
  onUpload,
}: {
  onUpload: (file: File) => void;
}) {
  return (
    <label className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white cursor-pointer hover:bg-indigo-700">
      <Upload size={16} />
      Upload DOCX
      <input
        type="file"
        accept=".docx"
        className="hidden"
        onChange={(e) => {
          const file =
            e.target.files?.[0];

          if (file) {
            onUpload(file);
          }
        }}
      />
    </label>
  );
}

/** Rich editor: inherit size/font only — bold/italic/underline come from inner HTML. */
const richEditorOuterStyle = (
  blockChrome: CSSProperties
): CSSProperties => {
  const {
    fontWeight: _fw,
    fontStyle: _fs,
    textDecoration: _td,
    ...chrome
  } = blockChrome;

  return {
    ...chrome,
    marginBottom: 0,
    minHeight: "4rem",
    outline: "none",
  };
};

const EditorTableBlock = ({
  tableHtml,
  styles,
  outerStyle,
}: {
  tableHtml: string;
  styles: StyleConfig;
  outerStyle: CSSProperties;
}) => {
  const html = useMemo(
    () =>
      applyStylesToHtml(
        tableHtml,
        styles
      ),
    [tableHtml, styles]
  );

  return (
    <div
      className="overflow-x-auto"
      style={outerStyle}
      dangerouslySetInnerHTML={{
        __html: html,
      }}
    />
  );
};

/** True when the user has an expanded selection inside `root` (partial rich-text edit). */
const richSelectionIsNonCollapsedIn = (
  root: HTMLElement | null
): boolean => {
  if (!root) {
    return false;
  }

  const sel =
    window.getSelection();

  if (
    !sel ||
    sel.rangeCount ===
      0 ||
    sel.isCollapsed
  ) {
    return false;
  }

  const range =
    sel.getRangeAt(
      0
    );

  return root.contains(
    range.commonAncestorContainer
  );
};

interface Props {
  blocks: DocumentBlock[];
  setBlocks: React.Dispatch<React.SetStateAction<DocumentBlock[]>>;
  previewMode: boolean;
  styles: StyleConfig;
  originalHtml: string;
  setOriginalHtml: React.Dispatch<
    React.SetStateAction<string>
  >;
  onUpload: (file: File) => void;
}

const DocumentPreview = ({
  blocks,
  setBlocks,
  previewMode,
  styles,
  originalHtml,
  setOriginalHtml,
  onUpload,
}: Props) => {
  const [activeTab, setActiveTab] =
    useState<EditorTab>("all");

  const [searchText, setSearchText] = useState("");

  const [previewSearchText, setPreviewSearchText] =
    useState("");

  const [previewMatchIndex, setPreviewMatchIndex] =
    useState(0);

  const [editorNavIndex, setEditorNavIndex] =
    useState(0);

  const previewContentRef =
    useRef<HTMLDivElement>(null);

  const [previewEditing, setPreviewEditing] =
    useState(false);

  /** Latest preview DOM HTML (includes search marks while typing). */
  const lastPreviewInnerHtmlRef =
    useRef("");

  /** True after user edited preview; avoids overwriting mammoth HTML on mode toggle. */
  const previewDirtyRef = useRef(false);

  const richHandlesRef =
    useRef<
      Map<
        number,
        RichParagraphFieldHandle
      >
    >(new Map());

  const narrowHoverHints =
    useMatchMedia(SMALL_VIEWPORT_HOVER);

  const handleRichCommit =
    useCallback(
      (
        id: number,
        innerHtml: string,
        plain: string
      ) => {
        const payload =
          commitRichEditorPayload(
            innerHtml,
            plain
          );

        setBlocks(
          (prev) =>
            prev.map(
              (b) =>
                b.id === id
                  ? {
                      ...b,
                      ...payload,
                    }
                  : b
            )
        );
      },
      [setBlocks]
    );

  const persistPreviewEdits = useCallback(
    (htmlFromDom: string) => {
      const cleaned =
        stripDocPolishSearchMarks(htmlFromDom);

      try {
        const rawBlocks =
          extractBlocksFromHtml(cleaned);
        setBlocks(
          detectBlockTypes(rawBlocks)
        );
      } catch {
        setOriginalHtml(cleaned);
      }
    },
    [setBlocks, setOriginalHtml]
  );

  useEffect(() => {
    if (
      styles.detectCodeBlocks === false &&
      activeTab === "code"
    ) {
      setActiveTab("paragraph");
    }
  }, [styles.detectCodeBlocks, activeTab]);

  useEffect(() => {
    if (activeTab === "table") {
      setActiveTab("paragraph");
    }
  }, [activeTab]);

  //-----------------------------------
  // If user has turned off code detection,
  // treat code-typed blocks as plain paragraphs
  // for display purposes.
  //-----------------------------------
  const displayBlocks = useMemo(() => {
    if (styles.detectCodeBlocks !== false) {
      return blocks;
    }
    return blocks.map((block) =>
      block.type === "code"
        ? { ...block, type: "paragraph" as const }
        : block
    );
  }, [blocks, styles.detectCodeBlocks]);

  const hiddenOutputParagraphIds =
    useMemo(() => {
      const hidden =
        new Set<number>();

      displayBlocks.forEach(
        (b, idx) => {
          if (b.type !== "code") {
            return;
          }

          const tail =
            tryParseOutputTailAfterCode(
              displayBlocks,
              idx
            );

          if (!tail) {
            return;
          }

          hidden.add(
            tail.labelBlock.id
          );
          tail.bodyBlocks.forEach(
            (bb) => {
              hidden.add(bb.id);
            }
          );
        }
      );

      return hidden;
    }, [displayBlocks]);

  //-----------------------------------
  // Bold All
  //-----------------------------------
  const activeTabBlocks = useMemo(
    () =>
      displayBlocks.filter((block) =>
        blockMatchesEditorTab(
          block,
          activeTab
        )
      ),
    [displayBlocks, activeTab]
  );

  /** Tables appear on Paragraph but bulk B/I/U applies only to body text blocks. */
  const blocksForGlobalFormatting = useMemo(
    () =>
      activeTabBlocks.filter(
        (block) => block.type !== "table"
      ),
    [activeTabBlocks]
  );

  /** Bulk B/I/U uses block flags only when no mixed inline HTML. */
  const blocksForPlainFormattingFlags =
    useMemo(
      () =>
        blocksForGlobalFormatting.filter(
          (block) =>
            !block.inlineHtml?.trim()
        ),
      [blocksForGlobalFormatting]
    );

  const isBoldAllActive =
    blocksForGlobalFormatting.length >
      0 &&
    blocksForGlobalFormatting.every(
      blockLooksGloballyBold
    );

  const isItalicAllActive =
    blocksForPlainFormattingFlags.length >
      0 &&
    blocksForPlainFormattingFlags.every(
      (block) => !!block.isItalic
    );

  const isUnderlineAllActive =
    blocksForPlainFormattingFlags.length >
      0 &&
    blocksForPlainFormattingFlags.every(
      (block) => !!block.isUnderline
    );

  const handleBoldAll = () => {
    if (
      blocksForGlobalFormatting.length ===
      0
    ) {
      return;
    }

    const nextBoldState =
      !blocksForGlobalFormatting.every(
        blockLooksGloballyBold
      );

    const targets =
      new Set(
        blocksForGlobalFormatting.map(
          (b) => b.id
        )
      );

    setBlocks((prev) =>
      prev.map((block) =>
        targets.has(block.id)
          ? applyBoldAllToBlock(
              block,
              nextBoldState
            )
          : block,
      ),
    );
  };

  //-----------------------------------
  // Italic All
  //-----------------------------------
  const handleItalicAll = () => {
    const nextItalicState = !isItalicAllActive;

    const targets = new Set(
      blocksForPlainFormattingFlags.map(
        (b) => b.id
      )
    );

    setBlocks((prev) =>
      prev.map((block) =>
        targets.has(block.id)
          ? {
              ...block,
              isItalic: nextItalicState,
            }
          : block,
      ),
    );
  };

  const handleUnderlineAll = () => {
    const next = !isUnderlineAllActive;

    const targets = new Set(
      blocksForPlainFormattingFlags.map(
        (b) => b.id
      )
    );

    setBlocks((prev) =>
      prev.map((block) =>
        targets.has(block.id)
          ? {
              ...block,
              isUnderline: next,
            }
          : block,
      ),
    );
  };

  //-----------------------------------
  // Delete block
  //-----------------------------------
  const handleDelete = (id: number) => {
    richHandlesRef.current.delete(
      id
    );
    setBlocks((prev) => prev.filter((block) => block.id !== id));
  };

  //-----------------------------------
  // Single block bold — selection uses execCommand; otherwise whole-block model
  //-----------------------------------
  const toggleBold = (id: number) => {
    const handle =
      richHandlesRef.current.get(
        id
      );
    const root =
      handle?.getEditableRoot() ??
      null;

    if (
      root &&
      document.activeElement ===
        root &&
      richSelectionIsNonCollapsedIn(
        root
      )
    ) {
      handle!.applyCommand(
        "bold"
      );
      return;
    }

    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== id) {
          return block;
        }

        if (block.type === "table") {
          return block;
        }

        if (block.type === "code") {
          return {
            ...block,
            isBold: !block.isBold,
          };
        }

        return applyBoldAllToBlock(
          block,
          !blockLooksGloballyBold(block),
        );
      }),
    );
  };

  //-----------------------------------
  // Single block italic
  //-----------------------------------
  const toggleItalic = (id: number) => {
    const handle =
      richHandlesRef.current.get(
        id
      );
    const root =
      handle?.getEditableRoot() ??
      null;

    if (
      root &&
      document.activeElement ===
        root &&
      richSelectionIsNonCollapsedIn(
        root
      )
    ) {
      handle!.applyCommand(
        "italic"
      );
      return;
    }

    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== id) {
          return block;
        }

        if (block.type === "table") {
          return block;
        }

        if (block.type === "code") {
          return {
            ...block,
            isItalic: !block.isItalic,
          };
        }

        return applyItalicAllToBlock(
          block,
          !blockLooksGloballyItalic(block),
        );
      }),
    );
  };

  const toggleUnderline = (id: number) => {
    const handle =
      richHandlesRef.current.get(
        id
      );
    const root =
      handle?.getEditableRoot() ??
      null;

    if (
      root &&
      document.activeElement ===
        root &&
      richSelectionIsNonCollapsedIn(
        root
      )
    ) {
      handle!.applyCommand(
        "underline"
      );
      return;
    }

    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== id) {
          return block;
        }

        if (block.type === "table") {
          return block;
        }

        if (block.type === "code") {
          return {
            ...block,
            isUnderline: !block.isUnderline,
          };
        }

        return applyUnderlineAllToBlock(
          block,
          !blockLooksGloballyUnderline(block),
        );
      }),
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
              ...(type === "code"
                ? {
                    inlineHtml:
                      undefined,
                    isBold: false,
                    isItalic: false,
                    isUnderline: false,
                  }
                : {}),
            }
          : block,
      ),
    );
  };

  const updateBlockText = (
    id: number,
    text: string,
  ) => {
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === id
          ? { ...block, text }
          : block,
      ),
    );
  };

  //-----------------------------------
  // Filter blocks
  //-----------------------------------
  const filteredBlocks = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return displayBlocks.filter((block) => {
      if (
        hiddenOutputParagraphIds.has(
          block.id
        )
      ) {
        return false;
      }

      if (
        !blockMatchesEditorTab(
          block,
          activeTab
        )
      ) {
        return false;
      }

      if (!q) {
        return true;
      }

      return (
        block.text
          .toLowerCase()
          .includes(q) ||
        (block.tableHtml &&
          block.tableHtml
            .toLowerCase()
            .includes(q))
      );
    });
  }, [
    displayBlocks,
    hiddenOutputParagraphIds,
    activeTab,
    searchText,
  ]);

  const styledPreviewHtml = useMemo(() => {
    if (!originalHtml.trim()) {
      return "";
    }

    return applyStylesToHtml(originalHtml, styles);
  }, [originalHtml, styles]);

  const previewMatchCount = useMemo(
    () =>
      countSearchMatchesInHtml(
        styledPreviewHtml,
        previewSearchText
      ),
    [styledPreviewHtml, previewSearchText]
  );

  const previewHtmlWithHighlights = useMemo(
    () =>
      highlightSearchInHtml(
        styledPreviewHtml,
        previewSearchText,
        previewMatchIndex
      ),
    [
      styledPreviewHtml,
      previewSearchText,
      previewMatchIndex,
    ]
  );

  useLayoutEffect(() => {
    if (
      !previewMode ||
      previewEditing ||
      !previewContentRef.current ||
      !styledPreviewHtml
    ) {
      return;
    }

    previewContentRef.current.innerHTML =
      previewHtmlWithHighlights;
    lastPreviewInnerHtmlRef.current =
      previewHtmlWithHighlights;
    previewDirtyRef.current = false;
  }, [
    previewMode,
    previewEditing,
    styledPreviewHtml,
    previewHtmlWithHighlights,
  ]);

  useEffect(() => {
    if (previewMode) {
      return;
    }

    // Parent cleared the workspace (Home / Close) — never re-import preview DOM into blocks.
    if (blocks.length === 0) {
      lastPreviewInnerHtmlRef.current = "";
      previewDirtyRef.current = false;
      setPreviewEditing(false);
      return;
    }

    const snap =
      lastPreviewInnerHtmlRef.current;

    if (
      previewDirtyRef.current &&
      snap.trim()
    ) {
      persistPreviewEdits(snap);
    }

    lastPreviewInnerHtmlRef.current = "";
    previewDirtyRef.current = false;
    setPreviewEditing(false);
  }, [
    previewMode,
    persistPreviewEdits,
    blocks.length,
  ]);

  const filteredBlockSignature = useMemo(
    () =>
      filteredBlocks
        .map((b) => b.id)
        .join(","),
    [filteredBlocks]
  );

  const editorNavTotal = useMemo(() => {
    if (!searchText.trim()) {
      return 0;
    }

    return filteredBlocks.length;
  }, [filteredBlocks, searchText]);

  useEffect(() => {
    setPreviewMatchIndex(0);
  }, [previewSearchText, styledPreviewHtml]);

  useEffect(() => {
    setEditorNavIndex(0);
  }, [
    searchText,
    activeTab,
    filteredBlockSignature,
  ]);

  useEffect(() => {
    setEditorNavIndex((i) =>
      Math.min(
        i,
        Math.max(0, editorNavTotal - 1)
      )
    );
  }, [editorNavTotal]);

  useEffect(() => {
    if (!previewSearchText.trim()) {
      return;
    }

    const root = previewContentRef.current;

    if (!root) {
      return;
    }

    const hit = root.querySelector(
      `[data-docpolish-hit-index="${previewMatchIndex}"]`
    );

    hit?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [
    previewHtmlWithHighlights,
    previewMatchIndex,
    previewSearchText,
  ]);

  useEffect(() => {
    if (!searchText.trim() || editorNavTotal === 0) {
      return;
    }

    const id =
      filteredBlocks[editorNavIndex]?.id;

    if (id == null) {
      return;
    }

    document
      .getElementById(
        `editor-block-${id}`
      )
      ?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
  }, [
    editorNavIndex,
    editorNavTotal,
    filteredBlockSignature,
    filteredBlocks,
    searchText,
  ]);

  //-----------------------------------
  // Dynamic styles
  //-----------------------------------
  const getBlockStyle = (block: DocumentBlock) => {
    let fontSize = styles.paragraphSize;
    let lineHeight = 1.8;
    let marginBottom = `${styles.paragraphSpacing}px`;

    if (block.type === "title") {
      fontSize = styles.titleSize;
      lineHeight = 1.4;
      marginBottom = `${styles.paragraphSpacing + 6}px`;
    }

    if (block.type === "subtitle") {
      fontSize = styles.subtitleSize;
      lineHeight = 1.4;
      marginBottom = `${styles.paragraphSpacing + 2}px`;
    }

    if (block.type === "table") {
      return {
        marginBottom: `${styles.paragraphSpacing}px`,
      };
    }

    //-----------------------------------
    // Code block styling
    //-----------------------------------
    if (block.type === "code") {
      const bg = styles.codeBackground || "#ffffff";

      const hex = bg.replace("#", "");
      let textColor = "#0f172a";
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const luma =
          (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        if (luma < 0.5) textColor = "#f8fafc";
      }

      return {
        fontSize: `${styles.paragraphSize}pt`,
        fontFamily: "monospace",
        background: bg,
        color: textColor,
        border: "1px solid #e2e8f0",
        padding: "14px 16px",
        borderRadius: "8px",
        whiteSpace: "pre-wrap" as const,
        lineHeight: "1.6",
        marginBottom,
        textDecoration: block.isUnderline
          ? "underline"
          : "none",
        fontWeight: block.isBold ? "bold" : "normal",
        fontStyle: block.isItalic ? "italic" : "normal",
      };
    }

    const richInline =
      !!block.inlineHtml?.trim();

    return {
      fontSize: `${fontSize}pt`,
      fontFamily:
        styles.fontFamily,
      fontWeight:
        richInline
          ? "normal"
          : block.isBold
            ? "bold"
            : "normal",
      fontStyle:
        richInline
          ? "normal"
          : block.isItalic
            ? "italic"
            : "normal",
      textDecoration:
        richInline
          ? "none"
          : block.isUnderline
            ? "underline"
            : "none",
      lineHeight:
        String(lineHeight),
      marginBottom,
    };
  };

  const renderCodeBlockEditor = (
    block: DocumentBlock
  ) => {
    const codeStyle =
      getBlockStyle(block) as CSSProperties;

    const codeIdx =
      displayBlocks.findIndex(
        (b) => b.id === block.id
      );

    const outputTail =
      codeIdx >= 0
        ? tryParseOutputTailAfterCode(
            displayBlocks,
            codeIdx
          )
        : null;

    const taRows = Math.min(
      18,
      Math.max(
        2,
        block.text.split(/\r?\n/)
          .length
      )
    );

    const joinedOutput =
      outputTail?.bodyBlocks
        .map((b) => b.text)
        .join("\n") ?? "";

    const outputRows = Math.min(
      12,
      Math.max(
        2,
        joinedOutput.split(/\r?\n/)
          .length || 1
      )
    );

    const handleOutputChange = (
      text: string
    ) => {
      if (!outputTail) return;

      const patch =
        applyJoinedLinesToBodyBlocks(
          text,
          outputTail.bodyBlocks
        );

      setBlocks((prev) =>
        prev.map((b) => {
          const hit = patch.find(
            (x) => x.id === b.id
          );
          return hit
            ? { ...b, text: hit.text }
            : b;
        })
      );
    };

    return (
      <div
        style={{
          marginBottom:
            codeStyle.marginBottom,
        }}
      >
        <div
          style={{
            background:
              codeStyle.background,
            border: codeStyle.border,
            borderRadius:
              codeStyle.borderRadius,
            overflow: "hidden",
          }}
        >
          <textarea
            value={block.text}
            onChange={(e) =>
              updateBlockText(
                block.id,
                e.target.value
              )
            }
            spellCheck
            rows={taRows}
            className="w-full max-h-[70vh] resize-y bg-transparent border-0 rounded-none outline-none focus-visible:outline-none ring-0 focus-visible:ring-0 box-border min-h-[3rem]"
            style={{
              fontSize: codeStyle.fontSize,
              fontFamily:
                codeStyle.fontFamily,
              color: codeStyle.color,
              whiteSpace:
                codeStyle.whiteSpace ??
                "pre-wrap",
              lineHeight:
                codeStyle.lineHeight,
              padding: codeStyle.padding,
              textDecoration:
                codeStyle.textDecoration,
              fontWeight:
                codeStyle.fontWeight,
              fontStyle:
                codeStyle.fontStyle,
              marginBottom: 0,
              display: "block",
            }}
          />
        </div>

        {outputTail ? (
          <>
            <p
              className="mt-3 mb-1.5 font-bold text-slate-800"
              style={{
                fontFamily:
                  styles.fontFamily,
                fontSize: `${styles.paragraphSize}pt`,
              }}
            >
              Output
            </p>
            <div
              style={{
                background:
                  codeStyle.background,
                border: codeStyle.border,
                borderRadius:
                  codeStyle.borderRadius,
                overflow: "hidden",
              }}
            >
              <textarea
                value={joinedOutput}
                onChange={(e) =>
                  handleOutputChange(
                    e.target.value
                  )
                }
                spellCheck={false}
                rows={outputRows}
                aria-label="Program output sample"
                className="w-full max-h-[40vh] resize-y bg-transparent border-0 rounded-none outline-none focus-visible:outline-none ring-0 focus-visible:ring-0 box-border min-h-[2.5rem]"
                style={{
                  fontSize:
                    codeStyle.fontSize,
                  fontFamily:
                    codeStyle.fontFamily,
                  color:
                    codeStyle.color,
                  whiteSpace: "pre-wrap",
                  lineHeight:
                    codeStyle.lineHeight,
                  padding:
                    codeStyle.padding,
                  marginBottom: 0,
                  display: "block",
                }}
              />
            </div>
          </>
        ) : null}
      </div>
    );
  };

  return (
    <div className="min-h-full rounded-xl bg-white p-4 shadow-sm sm:rounded-2xl sm:p-6">
      {/* ---------------- PREVIEW MODE ---------------- */}
      {previewMode ? (
        <>
          <h1 className="mb-2 text-xl font-bold sm:text-2xl lg:text-3xl">
            Final Preview
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Click below to edit. Changes are saved when you leave
            the preview area or switch back to the editor.
          </p>

          <DocumentSearchBar
            value={previewSearchText}
            onChange={setPreviewSearchText}
            placeholder="Find in document…"
            totalMatches={previewMatchCount}
            activeMatchIndex={previewMatchIndex}
            onPrev={() =>
              setPreviewMatchIndex((i) =>
                previewMatchCount <= 0
                  ? 0
                  : (i -
                      1 +
                      previewMatchCount) %
                    previewMatchCount
              )
            }
            onNext={() =>
              setPreviewMatchIndex((i) =>
                previewMatchCount <= 0
                  ? 0
                  : (i + 1) % previewMatchCount
              )
            }
            onClear={() => {
              setPreviewSearchText("");
              setPreviewMatchIndex(0);
            }}
            className="mb-4"
          />

          <div className="border rounded-xl p-6">
            {styledPreviewHtml ? (
              <div
                ref={previewContentRef}
                role="textbox"
                aria-multiline
                aria-label="Editable formatted preview"
                contentEditable
                suppressContentEditableWarning
                onFocus={() =>
                  setPreviewEditing(true)
                }
                onInput={(e) => {
                  previewDirtyRef.current = true;
                  lastPreviewInnerHtmlRef.current =
                    e.currentTarget.innerHTML;
                }}
                onBlur={(e) => {
                  lastPreviewInnerHtmlRef.current =
                    e.currentTarget.innerHTML;
                  if (previewDirtyRef.current) {
                    persistPreviewEdits(
                      e.currentTarget.innerHTML
                    );
                    previewDirtyRef.current = false;
                  }
                  lastPreviewInnerHtmlRef.current =
                    "";
                  setPreviewEditing(false);
                }}
                className="outline-none focus-visible:outline-none ring-0 focus-visible:ring-0 rounded-md min-h-[120px]"
              />
            ) : (
              <div className="min-h-[220px] flex items-center justify-center text-center text-gray-500">
                <div>
                  <p className="font-semibold text-lg text-gray-700">No document loaded</p>
                  <p className="mt-1">Upload a DOCX file to preview formatted output.</p>
                  <InlineDocxUploadButton onUpload={onUpload} />
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* ---------------- EDITOR MODE ---------------- */}
          <h1 className="mb-3 text-xl font-bold sm:mb-4 sm:text-2xl lg:mb-6 lg:text-3xl">
            Document Editor
          </h1>

          {/* Tabs + Global Controls — mobile: full-bleed scroll row + compact actions; lg+: unchanged row */}
          <div className="mb-3 flex flex-col gap-2 sm:mb-4 lg:mb-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <div className="-mx-4 flex w-full min-w-0 max-w-full touch-pan-x gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:thin] sm:-mx-6 sm:px-6 lg:mx-0 lg:w-auto lg:max-w-none lg:flex-wrap lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0">
              {(
                styles.detectCodeBlocks === false
                  ? ([
                      "all",
                      "title",
                      "subtitle",
                      "paragraph",
                    ] as EditorTab[])
                  : ([
                      "all",
                      "title",
                      "subtitle",
                      "paragraph",
                      "code",
                    ] as EditorTab[])
              ).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  aria-label={
                    tab === "all"
                      ? "All sections"
                      : wordStyleLabel(
                          tab as BlockType
                        )
                  }
                  title={
                    narrowHoverHints
                      ? editorTabHoverTitle(
                          tab
                        )
                      : undefined
                  }
                  onClick={() =>
                    setActiveTab(tab)
                  }
                  className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium lg:rounded-xl lg:px-6 lg:py-3 lg:text-base ${
                    activeTab === tab
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100"
                  }`}
                >
                  {tab === "all"
                    ? "All"
                    : tab === "paragraph"
                      ? (
                          <>
                            <span className="lg:hidden">
                              Para
                            </span>
                            <span className="hidden lg:inline">
                              {wordStyleLabel(
                                "paragraph"
                              )}
                            </span>
                          </>
                        )
                      : wordStyleLabel(
                          tab as BlockType
                        )}
                </button>
              ))}
            </div>

            <div className="flex w-full gap-1.5 lg:w-auto lg:shrink-0 lg:gap-3">
              <button
                type="button"
                onClick={handleBoldAll}
                title={
                  narrowHoverHints
                    ? "Apply bold to all text in the blocks listed for this tab."
                    : undefined
                }
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium leading-tight lg:flex-none lg:rounded-lg lg:px-4 lg:py-2 lg:text-base lg:leading-normal ${
                  isBoldAllActive
                    ? "bg-indigo-500 text-white"
                    : "bg-indigo-100 text-indigo-700"
                }`}
              >
                Bold All
              </button>

              <button
                type="button"
                onClick={handleItalicAll}
                title={
                  narrowHoverHints
                    ? "Apply italic to all text in the blocks listed for this tab."
                    : undefined
                }
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium leading-tight lg:flex-none lg:rounded-lg lg:px-4 lg:py-2 lg:text-base lg:leading-normal ${
                  isItalicAllActive
                    ? "bg-indigo-500 text-white"
                    : "bg-indigo-100 text-indigo-700"
                }`}
              >
                Italic All
              </button>

              <button
                type="button"
                onClick={handleUnderlineAll}
                title={
                  narrowHoverHints
                    ? "Apply underline to all text in the blocks listed for this tab."
                    : undefined
                }
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium leading-tight underline lg:flex-none lg:rounded-lg lg:px-4 lg:py-2 lg:text-base lg:leading-normal ${
                  isUnderlineAllActive
                    ? "bg-indigo-500 text-white"
                    : "bg-indigo-100 text-indigo-700"
                }`}
              >
                Underline All
              </button>
            </div>
          </div>

          <DocumentSearchBar
            value={searchText}
            onChange={setSearchText}
            placeholder={
              activeTab === "all"
                ? "Find in all sections…"
                : `Find in ${wordStyleLabel(activeTab)}…`
            }
            totalMatches={editorNavTotal}
            activeMatchIndex={editorNavIndex}
            onPrev={() =>
              setEditorNavIndex((i) =>
                editorNavTotal <= 0
                  ? 0
                  : (i -
                      1 +
                      editorNavTotal) %
                    editorNavTotal
              )
            }
            onNext={() =>
              setEditorNavIndex((i) =>
                editorNavTotal <= 0
                  ? 0
                  : (i + 1) % editorNavTotal
              )
            }
            onClear={() => {
              setSearchText("");
              setEditorNavIndex(0);
            }}
            className="mb-4 lg:mb-6"
          />

          {/* Blocks */}
          <div className="space-y-5">
            {filteredBlocks.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-gray-500 sm:p-10">
                {blocks.length === 0 ? (
                  <>
                    <p className="font-semibold text-lg text-gray-700">Start by uploading a DOCX file</p>
                    <p className="mt-1">Use any upload button to load your document.</p>
                    <InlineDocxUploadButton onUpload={onUpload} />
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-lg text-gray-700">No blocks in this tab</p>
                    <p className="mt-1">
                      Try another Word style tab or adjust your search.
                    </p>
                  </>
                )}
              </div>
            ) : (
              filteredBlocks.map((block) => (
                <div
                  id={`editor-block-${block.id}`}
                  key={block.id}
                  className={`border rounded-xl p-5 transition-shadow ${
                    searchText.trim() &&
                    editorNavTotal > 0 &&
                    filteredBlocks[editorNavIndex]
                      ?.id === block.id
                      ? "ring-2 ring-amber-400 ring-offset-2"
                      : ""
                  }`}
                >
                <div className="flex justify-between mb-4">
                    {block.type === "table" ? (
                      <span className="border rounded-lg px-3 py-2 text-sm font-medium bg-slate-100 text-slate-700">
                        {wordStyleLabel("table")}
                      </span>
                    ) : (
                  <select
                    value={block.type}
                    onChange={(e) =>
                          updateBlockType(
                            block.id,
                            e.target.value as BlockType
                          )
                    }
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:outline-none"
                  >
                        <option value="title">
                          {wordStyleLabel("title")}
                        </option>
                        <option value="subtitle">
                          {wordStyleLabel("subtitle")}
                        </option>
                        <option value="paragraph">
                          {wordStyleLabel("paragraph")}
                        </option>
                        <option value="code">
                          {wordStyleLabel("code")}
                        </option>
                  </select>
                    )}

                  {/* Controls */}
                  <div className="flex gap-2">
                      {block.type !== "table" && (
                        <>
                    <button
                            type="button"
                            onMouseDown={(e) =>
                              e.preventDefault()
                            }
                            onClick={() =>
                              toggleBold(block.id)
                            }
                            className={`px-3 py-2 rounded-lg border ${
                              blockLooksGloballyBold(block)
                                ? "bg-indigo-400 text-white border-indigo-400"
                                : "bg-indigo-50 text-indigo-700 border-indigo-200"
                            }`}
                    >
                      B
                    </button>

                    <button
                            type="button"
                            onMouseDown={(e) =>
                              e.preventDefault()
                            }
                            onClick={() =>
                              toggleItalic(block.id)
                            }
                            className={`px-3 py-2 rounded-lg border italic ${
                              blockLooksGloballyItalic(block)
                                ? "bg-indigo-400 text-white border-indigo-400"
                                : "bg-indigo-50 text-indigo-700 border-indigo-200"
                            }`}
                    >
                      I
                    </button>

                    <button
                            type="button"
                            onMouseDown={(e) =>
                              e.preventDefault()
                            }
                            onClick={() =>
                              toggleUnderline(block.id)
                            }
                            className={`px-3 py-2 rounded-lg border underline ${
                              blockLooksGloballyUnderline(block)
                                ? "bg-indigo-400 text-white border-indigo-400"
                                : "bg-indigo-50 text-indigo-700 border-indigo-200"
                            }`}
                          >
                            U
                          </button>
                        </>
                      )}

                      <button
                        onClick={() =>
                          handleDelete(block.id)
                        }
                        className="px-3 py-2 text-red-500 rounded-lg border border-red-200 hover:bg-red-50 transition-colors duration-150"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                  {block.type === "table" &&
                  block.tableHtml ? (
                    <EditorTableBlock
                      tableHtml={block.tableHtml}
                      styles={styles}
                      outerStyle={getBlockStyle(block)}
                    />
                  ) : block.type === "code" ? (
                    renderCodeBlockEditor(block)
                  ) : (
                    <div className="flex gap-3 items-start w-full box-border">
                      {(block.originalTag ===
                        "li" ||
                        block.isList) && (
                        <span
                          className="select-none shrink-0 text-slate-600"
                          aria-hidden
                          style={{
                            fontFamily:
                              styles.fontFamily,
                            fontSize: `${styles.paragraphSize}pt`,
                            lineHeight:
                              block.type ===
                                "paragraph"
                                ? "1.8"
                                : block.type ===
                                    "subtitle"
                                  ? "1.4"
                                  : "1.4",
                            paddingTop:
                              "3px",
                          }}
                        >
                          {styles.bulletStyle ===
                          "dash"
                            ? "–"
                            : "•"}
                        </span>
                      )}
                      <RichParagraphField
                        ref={(
                          handle
                        ) => {
                          if (
                            handle
                          ) {
                            richHandlesRef.current.set(
                              block.id,
                              handle
                            );
                          } else {
                            richHandlesRef.current.delete(
                              block.id
                            );
                          }
                        }}
                        html={blockToRichEditorHtml(
                          block
                        )}
                        outerStyle={richEditorOuterStyle(
                          getBlockStyle(
                            block
                          )
                        )}
                        className="flex-1 min-w-0 box-border rounded-md border border-transparent bg-transparent px-0 py-1 outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0 max-h-[70vh] overflow-y-auto"
                        onCommit={(
                          inner,
                          plain
                        ) =>
                          handleRichCommit(
                            block.id,
                            inner,
                            plain
                          )
                        }
                      />
                    </div>
                  )}
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
