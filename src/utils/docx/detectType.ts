import { BlockType, DocumentBlock } from "../../types/document";
import {
  countUnescapedBackticks,
  isCodeLikeLine,
  isLikelyCodeBridgeLine,
  isSoftCodeContinuationLine,
} from "./codeDetection";

const HEADING_STOPWORDS = new Set([
  "and",
  "or",
  "the",
  "a",
  "an",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "by",
]);

/** Exported for preview HTML so title/subtitle sizes match the editor. */
export const isLikelyHeadingCandidate = (
  text: string
) => {
  const cleaned = text.trim();

  const forAnalysis = cleaned.replace(
    /^[^A-Za-z0-9]+/,
    ""
  );

  if (!forAnalysis || forAnalysis.length > 90) {
    return false;
  }

  if (/[.!?]$/.test(forAnalysis)) {
    return false;
  }

  if (/^[\d\-*]+\s/.test(forAnalysis)) {
    return false;
  }

  const words = forAnalysis.split(/\s+/);

  if (words.length < 1 || words.length > 10) {
    return false;
  }

  const titleLikeWords = words.filter((word, index) => {
    const normalized = word.replace(/[^a-zA-Z']/g, "");

    if (!normalized) {
      return false;
    }

    if (
      index !== 0 &&
      HEADING_STOPWORDS.has(normalized.toLowerCase())
    ) {
      return true;
    }

    return /^[A-Z]/.test(normalized);
  });

  return titleLikeWords.length / words.length >= 0.6;
};

/** Multiline body lines inside one block must be checked per line (newlines fail `isSoftCodeContinuationLine`). */
const blockQualifiesAsCodeBridgeRun = (
  text: string
): boolean => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return false;
  }

  return lines.every(
    (line) =>
      isLikelyCodeBridgeLine(line) ||
      isSoftCodeContinuationLine(line)
  );
};

const splitMixedBlocks = (
  rawBlocks: DocumentBlock[]
): DocumentBlock[] => {
  const expanded: DocumentBlock[] = [];
  let generatedId = Date.now();

  rawBlocks.forEach((block) => {
    if (
      block.originalTag === "pre" ||
      block.originalTag === "code"
    ) {
      expanded.push(block);
      return;
    }

    if (
      block.originalTag === "table" &&
      block.tableHtml
    ) {
      expanded.push(block);
      return;
    }

    const lines = block.text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (
      block.inlineHtml?.trim()
    ) {
      expanded.push(block);
      return;
    }

    if (lines.length <= 1) {
      expanded.push(block);
      return;
    }

    let currentGroup: string[] = [];
    let currentGroupIsCode: boolean | null = null;

    const pushCurrentGroup = () => {
      if (!currentGroup.length || currentGroupIsCode === null) {
        return;
      }

      const mergedText = currentGroup.join("\n");

      expanded.push({
        ...block,
        id: generatedId++,
        text: mergedText,
        type: currentGroupIsCode ? "code" : "paragraph",
        isCode: currentGroupIsCode,
        inlineHtml:
          undefined,
      });
    };

    lines.forEach((line) => {
      const lineLooksLikeCode = isCodeLikeLine(line);
      const lineIsBridge = isLikelyCodeBridgeLine(line);
      let nextGroupType = lineLooksLikeCode || lineIsBridge;

      if (currentGroupIsCode === null) {
        currentGroupIsCode = nextGroupType;
        currentGroup = [line];
        return;
      }

      if (currentGroupIsCode === nextGroupType) {
        currentGroup.push(line);
        return;
      }

      // Keep template-literal body lines in the same code group until backticks balance.
      if (
        currentGroupIsCode &&
        !nextGroupType
      ) {
        const tickSum = currentGroup.reduce(
          (sum, l) =>
            sum + countUnescapedBackticks(l),
          0
        );
        if (tickSum % 2 === 1) {
          currentGroup.push(line);
          return;
        }
      }

      pushCurrentGroup();
      currentGroupIsCode = nextGroupType;
      currentGroup = [line];
    });

    pushCurrentGroup();
  });

  return expanded;
};

export const detectBlockTypes = (
  rawBlocks: DocumentBlock[]
): DocumentBlock[] => {
  const normalizedBlocks = splitMixedBlocks(rawBlocks);

  //-----------------------------------
  // Step 1: classify
  //-----------------------------------
  const classifiedBlocks = normalizedBlocks.map((block, index) => {
    const text = block.text.trim();

    let detectedType:
      BlockType = "paragraph";

    if (
      block.originalTag === "li" ||
      block.isList
    ) {
      return {
        ...block,
        type: "paragraph" as const,
        isCode: false,
      };
    }

    if (
      block.originalTag === "pre" ||
      block.originalTag === "code"
    ) {
      detectedType = "code";
    } else if (
      block.originalTag === "table"
    ) {
      detectedType = "table";
    } else if (block.originalTag === "h1") {
      detectedType = "title";
    } else if (
      block.originalTag === "h2" ||
      block.originalTag === "h3"
    ) {
      detectedType = "subtitle";
    } else if (isCodeLikeLine(text)) {
      detectedType = "code";
    } else if (
      block.originalTag === "p" &&
      isLikelyHeadingCandidate(text)
    ) {
      const next = normalizedBlocks[index + 1];
      const previous = normalizedBlocks[index - 1];

      const nextLooksLikeBody =
        !!next &&
        next.originalTag === "p" &&
        next.text.length > 70 &&
        !isCodeLikeLine(next.text);

      const previousLooksLikeBody =
        !!previous &&
        previous.originalTag === "p" &&
        previous.text.length > 70 &&
        !isCodeLikeLine(previous.text);

      detectedType =
        index <= 1
          ? "title"
          : nextLooksLikeBody ||
              previousLooksLikeBody
            ? "subtitle"
            : "paragraph";
    }

    return {
      ...block,
      type: detectedType,
      isCode: detectedType === "code",
    };
  });

  //-----------------------------------
  // Step 2: include short bridge lines between code lines
  //-----------------------------------
  const contextAwareBlocks = [...classifiedBlocks];
  let index = 0;

  while (index < contextAwareBlocks.length) {
    if (contextAwareBlocks[index].type === "code") {
      index += 1;
      continue;
    }

    if (
      contextAwareBlocks[index].type ===
      "table"
    ) {
      index += 1;
      continue;
    }

    const runStart = index;
    let runEnd = index;

    while (
      runEnd + 1 < contextAwareBlocks.length &&
      contextAwareBlocks[runEnd + 1].type !== "code"
    ) {
      runEnd += 1;
    }

    const previousCode =
      runStart > 0 &&
      contextAwareBlocks[runStart - 1].type === "code";

    const nextCode =
      runEnd + 1 < contextAwareBlocks.length &&
      contextAwareBlocks[runEnd + 1].type === "code";

    if (previousCode && nextCode) {
      const runBlocks = contextAwareBlocks.slice(
        runStart,
        runEnd + 1
      );

      const canBridge =
        runBlocks.every(
          (block) =>
            block.originalTag !==
              "table" &&
            blockQualifiesAsCodeBridgeRun(
              block.text
            )
        );

      if (canBridge) {
        for (
          let cursor = runStart;
          cursor <= runEnd;
          cursor += 1
        ) {
          contextAwareBlocks[cursor] = {
            ...contextAwareBlocks[cursor],
            type: "code",
            isCode: true,
          };
        }
      }
    }

    index = runEnd + 1;
  }

//-----------------------------------
// Step 3: merge adjacent logical code blocks
//-----------------------------------
const mergedBlocks: DocumentBlock[] = [];

let i = 0;

while (i < contextAwareBlocks.length) {
  const block = contextAwareBlocks[i];

  //-----------------------------------
  // Non-code → push directly
  //-----------------------------------
  if (block.type !== "code") {
    mergedBlocks.push(block);
    i++;
    continue;
  }

  //-----------------------------------
  // Start new code group
  //-----------------------------------
  let mergedCodeText = block.text;

  let j = i + 1;

  while (j < contextAwareBlocks.length) {
    const nextBlock = contextAwareBlocks[j];

    //-----------------------------------
    // Stop when actual document section starts
    //-----------------------------------
    if (
      nextBlock.type !== "code" &&
      !blockQualifiesAsCodeBridgeRun(nextBlock.text) &&
      nextBlock.text.trim() !== ""
    ) {
      break;
    }

    //-----------------------------------
    // Merge next code block
    //-----------------------------------
    if (nextBlock.type === "code") {
      mergedCodeText += "\n" + nextBlock.text;
      j++;
      continue;
    }

    //-----------------------------------
    // Ignore empty/bridge block
    //-----------------------------------
    if (
      nextBlock.text.trim() === "" ||
      blockQualifiesAsCodeBridgeRun(nextBlock.text)
    ) {
      j++;
      continue;
    }

    break;
  }

  mergedBlocks.push({
    ...block,
    text: mergedCodeText,
    type: "code",
    isCode: true,
  });

  i = j;
}

return mergedBlocks;
};