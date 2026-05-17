import {
  DocumentBlock,
  BlockType,
} from "../../types/document";

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const wrapInlineFormatting = (
  block: DocumentBlock,
  escapedText: string
): string => {
  if (!escapedText) {
    return escapedText;
  }

  let content = escapedText;

  if (block.isUnderline) {
    content = `<u>${content}</u>`;
  }

  if (block.isItalic) {
    content = `<em>${content}</em>`;
  }

  if (block.isBold) {
    content = `<strong>${content}</strong>`;
  }

  return content;
};

const blockInnerHtml = (
  block: DocumentBlock,
  plainEscaped: string
): string => {
  if (block.type === "code") {
    return plainEscaped;
  }

  if (block.inlineHtml?.trim()) {
    return block.inlineHtml.trim();
  }

  return wrapInlineFormatting(
    block,
    plainEscaped
  );
};

const openingTagForType = (
  type: BlockType
): string => {
  switch (type) {
    case "title":
      return "<h1>";
    case "subtitle":
      return "<h2>";
    case "code":
      return "<pre>";
    default:
      return "<p>";
  }
};

const closingTagForType = (
  type: BlockType
): string => {
  switch (type) {
    case "title":
      return "</h1>";
    case "subtitle":
      return "</h2>";
    case "code":
      return "</pre>";
    default:
      return "</p>";
  }
};

/**
 * Minimal HTML fragment for {@link extractBlocksFromHtml} /
 * {@link detectBlockTypes}. Keeps preview/export aligned with editor blocks.
 */
export const blocksToHtml = (
  blocks: DocumentBlock[]
): string => {
  const pieces: string[] = [];

  let listOpen = false;

  const closeListIfNeeded = () => {
    if (listOpen) {
      pieces.push("</ul>");
      listOpen = false;
    }
  };

  blocks.forEach((block) => {
    if (
      block.type === "table" &&
      block.tableHtml?.trim()
    ) {
      closeListIfNeeded();
      pieces.push(block.tableHtml.trim());
      return;
    }

    const plain = escapeHtml(block.text);
    const inner = blockInnerHtml(
      block,
      plain
    );

    const useLi =
      block.originalTag === "li" ||
      block.isList;

    if (useLi && block.type === "paragraph") {
      if (!listOpen) {
        pieces.push("<ul>");
        listOpen = true;
      }

      pieces.push(`<li>${inner}</li>`);
      return;
    }

    closeListIfNeeded();

    const open = openingTagForType(block.type);
    const close = closingTagForType(block.type);

    pieces.push(`${open}${inner}${close}`);
  });

  closeListIfNeeded();

  return pieces.join("\n");
};
