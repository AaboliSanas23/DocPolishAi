import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { X } from "lucide-react";
import { useStore } from "react-redux";

import Navbar from "../components/layout/Navbar";
import LeftSidebar from "../components/sidebar/LeftSidebar";
import DocumentPreview from "../components/editor/DocumentPreview";

import { DocumentBlock } from "../types/document";
import { StyleConfig } from "../types/style";

import { blocksToHtml } from "../utils/docx/blocksToHtml";
import { extractDocumentHtml } from "../utils/docx/extractBlocks";
import { extractBlocksFromHtml } from "../utils/docx/parseDoc";
import { detectBlockTypes } from "../utils/docx/detectType";
import { exportDocument } from "../utils/docx/exportDoc";
import { autoFixBlocksWithAI } from "../utils/ai/autoFixWithAI";
import { stripBoldTagsFromRichHtml } from "../utils/editor/sanitizeRichParagraphHtml";

import {
  resetWorkspaceDocument,
  setBlocks as setBlocksAction,
  setOriginalHtml as setOriginalHtmlAction,
  setPreviewMode as setPreviewModeAction,
  setStyles as setStylesAction,
} from "../store/workspaceSlice";
import {
  useAppDispatch,
  useAppSelector,
} from "../store/hooks";
import type { RootState } from "../store/store";

/** Editor mode: defer syncing HTML so typing stays responsive (preview/export still use fresh HTML). */
const ORIGINAL_HTML_DEBOUNCE_MS = 200;

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
  const dispatch = useAppDispatch();
  const store = useStore();
  const originalHtmlDebounceRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const blocks = useAppSelector(
    (s) => s.workspace.blocks
  );
  const originalHtml = useAppSelector(
    (s) => s.workspace.originalHtml
  );
  const styles = useAppSelector(
    (s) => s.workspace.styles
  );
  const previewMode = useAppSelector(
    (s) => s.workspace.previewMode
  );

  const [formattingMenuOpen, setFormattingMenuOpen] =
    useState(false);
  const [autoFixing, setAutoFixing] = useState(false);
  const [autoFixMessage, setAutoFixMessage] = useState(
    ""
  );

  /** Bumped on Home / Close document so the editor remounts with a clean UI. */
  const [workspaceSession, setWorkspaceSession] =
    useState(0);

  const setBlocks = useCallback<
    Dispatch<SetStateAction<DocumentBlock[]>>
  >(
    (update) => {
      const prev =
        (
          store.getState() as RootState
        ).workspace.blocks;
      dispatch(
        setBlocksAction(
          typeof update === "function"
            ? (
                update as (
                  p: DocumentBlock[]
                ) => DocumentBlock[]
              )(prev)
            : update
        )
      );
    },
    [dispatch, store]
  );

  const setOriginalHtml = useCallback<
    Dispatch<SetStateAction<string>>
  >(
    (update) => {
      const prev =
        (
          store.getState() as RootState
        ).workspace.originalHtml;
      dispatch(
        setOriginalHtmlAction(
          typeof update === "function"
            ? (update as (p: string) => string)(
                prev
              )
            : update
        )
      );
    },
    [dispatch, store]
  );

  const setStyles = useCallback<
    Dispatch<SetStateAction<StyleConfig>>
  >(
    (update) => {
      const prev =
        (
          store.getState() as RootState
        ).workspace.styles;
      dispatch(
        setStylesAction(
          typeof update === "function"
            ? (
                update as (
                  p: StyleConfig
                ) => StyleConfig
              )(prev)
            : update
        )
      );
    },
    [dispatch, store]
  );

  const resetWorkspace = useCallback(() => {
    setWorkspaceSession((s) => s + 1);
    dispatch(resetWorkspaceDocument());
    setAutoFixMessage("");
    setFormattingMenuOpen(false);
  }, [dispatch]);

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      const extractedHtml =
        await extractDocumentHtml(file);
      const rawBlocks =
        extractBlocksFromHtml(extractedHtml);
      const classifiedBlocks =
        detectBlockTypes(rawBlocks);

      dispatch(
        setBlocksAction(
          styles.applyBodyFontFromSettings
            ? stripParagraphBoldFlagsWhenApplyingBodyFont(
                classifiedBlocks
              )
            : classifiedBlocks
        )
      );
      dispatch(setPreviewModeAction(false));
    } catch (error) {
      console.error(
        "Document processing failed:",
        error
      );
    }
  }, [dispatch, styles.applyBodyFontFromSettings]);

  const handleExport = useCallback(async () => {
    try {
      const state =
        store.getState() as RootState;
      const { blocks: wsBlocks, styles: wsStyles } =
        state.workspace;
      const html =
        wsBlocks.length > 0
          ? blocksToHtml(wsBlocks)
          : "";
      await exportDocument(html, wsStyles);
    } catch (error) {
      console.error("Export failed:", error);
    }
  }, [store]);

  const handleAutoFix = useCallback(async () => {
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
      dispatch(setBlocksAction(aiFixedBlocks));
      setAutoFixMessage(
        "Auto Fix applied using local AI classification."
      );
    } else {
      setAutoFixMessage(
        "Auto Fix unavailable (AI offline). Connect Ollama to use AI fixes."
      );
    }

    setAutoFixing(false);
  }, [blocks, styles, autoFixing, dispatch]);

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

    const currentBlocks =
      (
        store.getState() as RootState
      ).workspace.blocks;

    dispatch(
      setBlocksAction(
        stripParagraphBoldFlagsWhenApplyingBodyFont(
          currentBlocks
        )
      )
    );
  }, [
    styles.applyBodyFontFromSettings,
    dispatch,
    store,
  ]);

  useEffect(() => {
    if (!blocks.length) {
      if (originalHtmlDebounceRef.current) {
        clearTimeout(
          originalHtmlDebounceRef.current
        );
        originalHtmlDebounceRef.current = null;
      }
      dispatch(setOriginalHtmlAction(""));
      return;
    }

    if (previewMode) {
      if (originalHtmlDebounceRef.current) {
        clearTimeout(
          originalHtmlDebounceRef.current
        );
        originalHtmlDebounceRef.current = null;
      }
      dispatch(
        setOriginalHtmlAction(
          blocksToHtml(blocks)
        )
      );
      return;
    }

    if (originalHtmlDebounceRef.current) {
      clearTimeout(
        originalHtmlDebounceRef.current
      );
    }
    originalHtmlDebounceRef.current = setTimeout(
      () => {
        originalHtmlDebounceRef.current = null;
        const latestBlocks =
          (
            store.getState() as RootState
          ).workspace.blocks;

        if (!latestBlocks.length) {
          dispatch(setOriginalHtmlAction(""));
          return;
        }

        dispatch(
          setOriginalHtmlAction(
            blocksToHtml(latestBlocks)
          )
        );
      },
      ORIGINAL_HTML_DEBOUNCE_MS
    );

    return () => {
      if (originalHtmlDebounceRef.current) {
        clearTimeout(
          originalHtmlDebounceRef.current
        );
        originalHtmlDebounceRef.current = null;
      }
    };
  }, [blocks, previewMode, dispatch, store]);

  const handlePreviewToggle = useCallback(() => {
    dispatch(
      setPreviewModeAction(
        !(
          store.getState() as RootState
        ).workspace.previewMode
      )
    );
  }, [dispatch, store]);

  const handleOpenFormatting = useCallback(() => {
    setFormattingMenuOpen(true);
  }, []);

  useEffect(() => {
    if (!formattingMenuOpen) {
      return;
    }

    const mq =
      window.matchMedia("(min-width: 1024px)");
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
    const prevOverflow =
      document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      mq.removeEventListener(
        "change",
        closeIfDesktop
      );
      document.removeEventListener(
        "keydown",
        onKeyDown
      );
      document.body.style.overflow =
        prevOverflow;
    };
  }, [formattingMenuOpen]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f5f6fa]">
      <div className="flex-none">
        <Navbar
          previewMode={previewMode}
          hasDocument={blocks.length > 0}
          onPreview={handlePreviewToggle}
          onExport={handleExport}
          onAutoFix={handleAutoFix}
          onUpload={handleFileUpload}
          onResetWorkspace={resetWorkspace}
          onOpenFormatting={handleOpenFormatting}
          autoFixing={autoFixing}
          formattingPanelOpen={
            formattingMenuOpen
          }
        />

        {autoFixMessage ? (
          <div className="px-6 pb-0 pt-3">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm text-indigo-700">
              {autoFixMessage}
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-12 lg:gap-6 lg:p-6">
        <div className="hidden h-full min-h-0 overflow-y-auto lg:col-span-3 lg:block">
          <LeftSidebar
            blocks={blocks}
            styles={styles}
            setStyles={setStyles}
          />
        </div>

        <div className="h-full min-h-0 overflow-y-auto lg:col-span-9">
          <DocumentPreview
            key={workspaceSession}
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

      {formattingMenuOpen ? (
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
      ) : null}
    </div>
  );
}

export default App;
