import { DocumentBlock } from "../types/document";
import { isCodeLikeLine } from "./codeDetection";

/**
 * Paragraph sequence after a code block that Preview treats as “Output” +
 * sample lines ({@link applyStylesToHtml}).
 */
export type OutputTailBundle = {
  labelBlock: DocumentBlock;
  bodyBlocks: DocumentBlock[];
};

/**
 * When blocks are `[ … code, Output label, short prose lines … ]`, returns that tail so the
 * editor can mirror Preview / DOCX layout inside the Code card.
 */
export const tryParseOutputTailAfterCode = (
  blocks: DocumentBlock[],
  codeBlockIndex: number
): OutputTailBundle | null => {
  const start = codeBlockIndex + 1;

  if (start >= blocks.length) {
    return null;
  }

  const label = blocks[start];

  if (label.type !== "paragraph") {
    return null;
  }

  const lt =
    label.text.trim().toLowerCase();

  if (lt !== "output" && lt !== "output:") {
    return null;
  }

  const bodyBlocks: DocumentBlock[] = [];
  let j = start + 1;

  while (j < blocks.length) {
    const nb = blocks[j];

    if (nb.type !== "paragraph") {
      break;
    }

    const v =
      nb.text.trim();

    if (!v) {
      break;
    }

    if (isCodeLikeLine(v)) {
      break;
    }

    if (v.length > 120) {
      break;
    }

    if (
      /^(example|syntax|input)\b/i.test(
        v
      )
    ) {
      break;
    }

    bodyBlocks.push(nb);
    j += 1;
  }

  if (!bodyBlocks.length) {
    return null;
  }

  return {
    labelBlock: label,
    bodyBlocks,
  };
};

/** Split joined editor text across Word-derived output paragraphs (preserves multi-block structure). */
export const applyJoinedLinesToBodyBlocks = (
  joinedText: string,
  bodyBlocks: DocumentBlock[]
): { id: number; text: string }[] => {
  const lines =
    joinedText.split(/\n/);
  const n = bodyBlocks.length;

  if (n === 0) {
    return [];
  }

  const values: string[] =
    new Array(n).fill("");

  if (lines.length <= n) {
    for (
      let i = 0;
      i < n;
      i += 1
    ) {
      values[i] = lines[i] ?? "";
    }
  } else {
    for (
      let i = 0;
      i < n - 1;
      i += 1
    ) {
      values[i] = lines[i];
    }
    values[n - 1] = lines
      .slice(n - 1)
      .join("\n");
  }

  return bodyBlocks.map((b, i) => ({
    id: b.id,
    text: values[i],
  }));
};
