import { BlockType, DocumentBlock } from "../../types/document";
import {
  elementHasInlineRichMarkup,
  sanitizeRichParagraphHtml,
} from "../editor/sanitizeRichParagraphHtml";

const WRAPPER_TAGS = new Set([
  "div",
  "section",
  "article",
  "main",
  "blockquote",
  "header",
  "footer",
  "center",
  "aside",
  "figure",
]);

/**
 * Contenteditable inside `<pre>` uses `<br>` and `<div>` for line breaks.
 * `textContent` skips `<br>` and glues lines together — breaks round-trip to blocks/export.
 */
const extractEditableRegionPlainText = (
  root: Element
): string => {
  let out = "";

  const ensureEndsWithNewline = () => {
    if (!out.length) return;

    if (!out.endsWith("\n")) {
      out += "\n";
    }
  };

  const visit = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === "br") {
      out += "\n";
      return;
    }

    if (
      tag === "div" ||
      tag === "p" ||
      tag === "li"
    ) {
      ensureEndsWithNewline();
      el.childNodes.forEach((ch) =>
        visit(ch)
      );
      ensureEndsWithNewline();
      return;
    }

    el.childNodes.forEach((ch) =>
      visit(ch)
    );
  };

  root.childNodes.forEach((ch) =>
    visit(ch)
  );

  return out
    .replace(/\r\n/g, "\n")
    .trimEnd();
};

/** Recover inline formatting lost when preview HTML is flattened to block text. */
const inferInlineFormatting = (
  el: Element
): {
  bold: boolean;
  italic: boolean;
  underline: boolean;
} => {
  let bold = false;
  let italic = false;
  let underline = false;

  const scanStyle = (
    styleAttr: string
  ) => {
    const compact =
      styleAttr
        .toLowerCase()
        .replace(/\s+/g, "");

    if (
      /text-decoration[^;:]*underline/.test(
        compact
      )
    ) {
      underline = true;
    }

    if (/font-style:italic/.test(compact)) {
      italic = true;
    }

    if (
      /font-weight:bold/.test(compact) ||
      /font-weight:700/.test(compact)
    ) {
      bold = true;
    }

    const fw =
      /font-weight:\s*(\d+)/i.exec(
        styleAttr
      );

    if (fw) {
      const w = parseInt(fw[1], 10);

      if (!Number.isNaN(w) && w >= 600) {
        bold = true;
      }
    }
  };

  scanStyle(
    el.getAttribute("style") || ""
  );

  el.querySelectorAll(
    "span[style], font[style]"
  ).forEach((node) => {
    scanStyle(
      node.getAttribute("style") || ""
    );
  });

  if (el.querySelector("u")) {
    underline = true;
  }

  if (el.querySelector("em, i")) {
    italic = true;
  }

  if (el.querySelector("strong, b")) {
    bold = true;
  }

  return {
    bold,
    italic,
    underline,
  };
};

const pushTextBlock = (
  element: Element,
  tag: string,
  blocks: DocumentBlock[],
  nextId: () => number
) => {
  const rawText =
    tag === "pre"
      ? extractEditableRegionPlainText(
          element
        )
      : element.textContent || "";

  const text =
    tag === "pre"
      ? rawText.trimEnd()
      : rawText.trim();

  if (!text) {
    return;
  }

  let type: BlockType = "paragraph";

  if (tag === "h1") {
    type = "title";
  } else if (
    tag === "h2" ||
    tag === "h3"
  ) {
    type = "subtitle";
  } else if (
    tag === "pre" ||
    tag === "code"
  ) {
    type = "code";
  }

  const headingTag =
    tag === "h1" ||
    tag === "h2" ||
    tag === "h3";

  const useRichInline =
    tag !== "pre" &&
    tag !== "code" &&
    elementHasInlineRichMarkup(
      element
    );

  const inferred =
    tag === "pre" || tag === "code"
      ? {
          bold: false,
          italic: false,
          underline: false,
        }
      : useRichInline
        ? {
            bold: false,
            italic: false,
            underline: false,
          }
        : inferInlineFormatting(
            element
          );

  const inlineHtmlSan =
    useRichInline
      ? sanitizeRichParagraphHtml(
          element.innerHTML
        ).trim()
      : "";

  const isBold =
    useRichInline
      ? false
      : inferred.bold ||
        headingTag;

  blocks.push({
    id: nextId(),
    text,
    type,
    originalTag: tag,
    isBold,
    isItalic:
      inferred.italic,
    isUnderline:
      inferred.underline,
    isList:
      tag === "li",
    isCode:
      type === "code",
    ...(inlineHtmlSan
      ? {
          inlineHtml:
            inlineHtmlSan,
        }
      : {}),
  });
};

const pushTableBlock = (
  table: HTMLTableElement,
  blocks: DocumentBlock[],
  nextId: () => number
) => {
  const text = (
    table.textContent || ""
  ).trim();

  if (!text) {
    return;
  }

  blocks.push({
    id: nextId(),
    text,
    type: "paragraph",
    originalTag: "table",
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isList: false,
    isCode: false,
    tableHtml: table.outerHTML,
  });
};

const walkContainer = (
  container: HTMLElement,
  blocks: DocumentBlock[],
  nextId: () => number
) => {
  for (const child of Array.from(
    container.children
  )) {
    const tag =
      child.tagName.toLowerCase();

    if (tag === "table") {
      pushTableBlock(
        child as HTMLTableElement,
        blocks,
        nextId
      );
      continue;
    }

    if (tag === "ul" || tag === "ol") {
      child
        .querySelectorAll("li")
        .forEach((li) => {
          pushTextBlock(
            li,
            "li",
            blocks,
            nextId
          );
        });
      continue;
    }

    if (
      tag === "h1" ||
      tag === "h2" ||
      tag === "h3" ||
      tag === "p"
    ) {
      pushTextBlock(
        child,
        tag,
        blocks,
        nextId
      );
      continue;
    }

    if (tag === "pre") {
      if (
        child.getAttribute(
          "data-output-box"
        ) === "true"
      ) {
        const text =
          extractEditableRegionPlainText(
            child
          ).trim();

        if (text) {
          blocks.push({
            id: nextId(),
            text,
            type: "paragraph",
            originalTag: "p",
            isBold: false,
            isItalic: false,
            isUnderline: false,
            isList: false,
            isCode: false,
          });
        }

        continue;
      }

      pushTextBlock(
        child,
        tag,
        blocks,
        nextId
      );
      continue;
    }

    // Styled preview merges Output lines into this wrapper — capture text so
    // persistPreview → blocks round-trip does not drop output body.
    if (
      tag === "div" &&
      child.getAttribute(
        "data-output-box"
      ) === "true"
    ) {
      const text =
        extractEditableRegionPlainText(
          child
        ).trim();

      if (text) {
        blocks.push({
          id: nextId(),
          text,
          type: "paragraph",
          originalTag: "p",
          isBold: false,
          isItalic: false,
          isUnderline: false,
          isList: false,
          isCode: false,
        });
      }

      continue;
    }

    if (WRAPPER_TAGS.has(tag)) {
      walkContainer(
        child as HTMLElement,
        blocks,
        nextId
      );
    }
  }
};

export const extractBlocksFromHtml = (
  html: string
): DocumentBlock[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    html,
    "text/html"
  );

  const blocks: DocumentBlock[] = [];
  let idCounter = 0;
  const nextId = () =>
    Date.now() + idCounter++;

  walkContainer(
    doc.body,
    blocks,
    nextId
  );

  return blocks;
};
