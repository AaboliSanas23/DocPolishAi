import { BlockType, DocumentBlock } from "../types/document";
import {
  isCodeLikeLine,
  isLikelyCodeBridgeLine,
} from "./codeDetection";

const splitMixedBlocks = (
  rawBlocks: DocumentBlock[]
): DocumentBlock[] => {
  const expanded: DocumentBlock[] = [];
  let generatedId = Date.now();

  rawBlocks.forEach((block) => {
    if (block.originalTag === "pre" || block.originalTag === "code") {
      expanded.push(block);
      return;
    }

    const lines = block.text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

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
      });
    };

    lines.forEach((line) => {
      const lineLooksLikeCode = isCodeLikeLine(line);
      const lineIsBridge = isLikelyCodeBridgeLine(line);
      const nextGroupType = lineLooksLikeCode || lineIsBridge;

      if (currentGroupIsCode === null) {
        currentGroupIsCode = nextGroupType;
        currentGroup = [line];
        return;
      }

      if (currentGroupIsCode === nextGroupType) {
        currentGroup.push(line);
        return;
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
  const classifiedBlocks = normalizedBlocks.map((block) => {
    const text = block.text.trim();

    let detectedType:
      BlockType = "paragraph";

    if (
      block.originalTag === "pre" ||
      block.originalTag === "code"
    ) {
      detectedType = "code";
    } else if (isCodeLikeLine(text)) {
      detectedType = "code";
    } else if (block.originalTag === "h1") {
      detectedType = "title";
    } else if (
      block.originalTag === "h2" ||
      block.originalTag === "h3"
    ) {
      detectedType = "subtitle";
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
  const contextAwareBlocks = classifiedBlocks.map(
    (block, index) => {
      if (block.type === "code") {
        return block;
      }

      const previous =
        index > 0
          ? classifiedBlocks[index - 1]
          : null;

      const next =
        index < classifiedBlocks.length - 1
          ? classifiedBlocks[index + 1]
          : null;

      const betweenCodeBlocks =
        previous?.type === "code" &&
        next?.type === "code";

      if (
        betweenCodeBlocks &&
        isLikelyCodeBridgeLine(block.text)
      ) {
        return {
          ...block,
          type: "code" as const,
          isCode: true,
        };
      }

      return block;
    }
  );

  //-----------------------------------
  // Step 3: merge consecutive code blocks
  //-----------------------------------
  const mergedBlocks: DocumentBlock[] = [];

  let currentCodeBlock: DocumentBlock | null =
    null;

  for (const block of contextAwareBlocks) {
    if (block.type === "code") {
      if (!currentCodeBlock) {
        currentCodeBlock = {
          ...block,
          text: block.text,
          isCode: true,
        };
      } else {
        currentCodeBlock.text +=
          "\n" + block.text;
      }
    } else {
      if (currentCodeBlock) {
        mergedBlocks.push(
          currentCodeBlock
        );
        currentCodeBlock = null;
      }

      mergedBlocks.push(block);
    }
  }

  //-----------------------------------
  // Push remaining code
  //-----------------------------------
  if (currentCodeBlock) {
    mergedBlocks.push(
      currentCodeBlock
    );
  }

  return mergedBlocks;
};