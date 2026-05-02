import { BlockType, DocumentBlock } from "../types/document";

export const extractBlocksFromHtml = (
  html: string
): DocumentBlock[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    html,
    "text/html"
  );

  const blocks: DocumentBlock[] = [];

  const elements =
    doc.body.querySelectorAll(
      "h1,h2,h3,p,li,pre"
    );

  elements.forEach(
    (element, index) => {
      const rawText =
        element.textContent || "";

      const text =
        element.tagName.toLowerCase() === "pre"
          ? rawText.trimEnd()
          : rawText.trim();

      if (!text) return;

      const tag =
        element.tagName.toLowerCase();

      let type:
        BlockType = "paragraph";

      //-----------------------------------
      // Detect block type
      //-----------------------------------
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

      //-----------------------------------
      // Default formatting rules
      //-----------------------------------
      const isBold =
        type === "title" ||
        type === "subtitle";

      blocks.push({
        id: Date.now() + index,
        text,
        type,
        originalTag: tag,

        // Titles/Subtitles bold by default
        isBold,

        // Nothing italic by default
        isItalic: false,

        isList: tag === "li",
        isCode:
          type === "code",
      });
    }
  );

  return blocks;
};