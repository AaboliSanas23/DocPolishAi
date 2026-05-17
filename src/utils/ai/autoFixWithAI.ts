import { BlockType, DocumentBlock } from "../../types/document";
import { StyleConfig } from "../../types/style";

type AIType = BlockType | "syntax" | "output";

interface AIPrediction {
  id: number;
  type: AIType;
  confidence: number;
}

const OLLAMA_URL =
  process.env.REACT_APP_OLLAMA_URL ||
  "http://localhost:11434/api/generate";

const OLLAMA_MODEL =
  process.env.REACT_APP_OLLAMA_MODEL ||
  "qwen2.5:7b";

const CONFIDENCE_THRESHOLD = 0.75;

const buildPrompt = (
  blocks: DocumentBlock[],
  styles: StyleConfig
) => {
  const payload = blocks.map((block) => ({
    id: block.id,
    text: block.text,
    currentType: block.type,
    originalTag: block.originalTag,
  }));

  return `You are a document formatter assistant.
Classify each block into one type: title, subtitle, paragraph, code, syntax, output.

Important constraints:
1) Do NOT change user styling values. These are fixed by app settings:
   - fontFamily: ${styles.fontFamily}
   - titleSize: ${styles.titleSize}
   - subtitleSize: ${styles.subtitleSize}
   - paragraphSize: ${styles.paragraphSize}
2) You only decide block type labels for auto-fix.
3) Use syntax/output for snippets like [a-z], \\n, Output:, printed results.

Return STRICT JSON only:
{"items":[{"id":1,"type":"paragraph","confidence":0.0}]}

Input:
${JSON.stringify(payload)}`;
};

const extractJsonObject = (value: string) => {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return value.slice(start, end + 1);
};

const parsePredictions = (
  raw: string
): AIPrediction[] => {
  const jsonText = extractJsonObject(raw);

  if (!jsonText) {
    return [];
  }

  const parsed = JSON.parse(jsonText) as {
    items?: AIPrediction[];
  };

  if (!parsed.items || !Array.isArray(parsed.items)) {
    return [];
  }

  return parsed.items.filter(
    (item) =>
      typeof item.id === "number" &&
      typeof item.confidence === "number" &&
      [
        "title",
        "subtitle",
        "paragraph",
        "code",
        "syntax",
        "output",
      ].includes(item.type)
  );
};

const normalizeAIType = (
  type: AIType
): BlockType => {
  if (type === "syntax" || type === "output") {
    return "code";
  }

  return type;
};

const mergeConsecutiveCodeBlocks = (
  blocks: DocumentBlock[]
) => {
  const merged: DocumentBlock[] = [];
  let currentCodeBlock: DocumentBlock | null = null;

  for (const block of blocks) {
    if (block.type === "code") {
      if (!currentCodeBlock) {
        currentCodeBlock = {
          ...block,
          isCode: true,
        };
      } else {
        currentCodeBlock.text += `\n${block.text}`;
      }
    } else {
      if (currentCodeBlock) {
        merged.push(currentCodeBlock);
        currentCodeBlock = null;
      }

      merged.push(block);
    }
  }

  if (currentCodeBlock) {
    merged.push(currentCodeBlock);
  }

  return merged;
};

export const autoFixBlocksWithAI = async (
  blocks: DocumentBlock[],
  styles: StyleConfig
): Promise<DocumentBlock[] | null> => {
  if (!blocks.length) {
    return [];
  }

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: buildPrompt(blocks, styles),
        stream: false,
        format: "json",
        options: {
          temperature: 0,
        },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      response?: string;
    };

    if (!data.response) {
      return null;
    }

    const predictions = parsePredictions(data.response);

    if (!predictions.length) {
      return null;
    }

    const predictionMap = new Map(
      predictions.map((item) => [item.id, item])
    );

    const autoFixed = blocks.map((block) => {
      if (block.originalTag === "table") {
        return block;
      }

      const prediction = predictionMap.get(block.id);

      if (
        !prediction ||
        prediction.confidence < CONFIDENCE_THRESHOLD
      ) {
        return block;
      }

      const nextType = normalizeAIType(
        prediction.type
      );

      return {
        ...block,
        type: nextType,
        isCode: nextType === "code",
        isBold:
          nextType === "title" ||
          nextType === "subtitle"
            ? true
            : block.isBold,
        isItalic:
          nextType === "code"
            ? false
            : block.isItalic,
      };
    });

    return mergeConsecutiveCodeBlocks(autoFixed);
  } catch (error) {
    console.warn("Auto Fix AI unavailable:", error);
    return null;
  }
};
