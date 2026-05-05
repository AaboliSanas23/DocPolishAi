import {
  applyJoinedLinesToBodyBlocks,
  tryParseOutputTailAfterCode,
} from "./outputSectionBlocks";
import { DocumentBlock } from "../types/document";

const mockBlocks = (
  parts: Partial<DocumentBlock>[]
): DocumentBlock[] =>
  parts.map((p, i) => ({
    id: 100 + i,
    text: "",
    type: "paragraph",
    originalTag: "p",
    isBold: false,
    isList: false,
    ...p,
  })) as DocumentBlock[];

describe("tryParseOutputTailAfterCode", () => {
  test("parses Output label + short lines after code block", () => {
    const blocks = mockBlocks([
      { type: "code", text: "console.log(1);" },
      { text: "Output" },
      { text: "Hello" },
      { text: "world" },
    ]);

    const tail = tryParseOutputTailAfterCode(
      blocks,
      0
    );

    expect(tail?.bodyBlocks).toHaveLength(2);
    expect(tail?.labelBlock.text).toBe(
      "Output"
    );
  });

  test("returns null when no body lines follow Output", () => {
    const blocks = mockBlocks([
      { type: "code", text: "x" },
      { text: "Output" },
    ]);

    expect(
      tryParseOutputTailAfterCode(blocks, 0)
    ).toBeNull();
  });
});

describe("applyJoinedLinesToBodyBlocks", () => {
  test("pads short input across blocks", () => {
    const bodies = mockBlocks([
      { text: "a" },
      { text: "b" },
    ]);
    const out =
      applyJoinedLinesToBodyBlocks(
        "only-one-line",
        bodies
      );

    expect(out[0].text).toBe(
      "only-one-line"
    );
    expect(out[1].text).toBe("");
  });

  test("merges overflow lines into last block", () => {
    const bodies = mockBlocks([
      { text: "" },
      { text: "" },
    ]);
    const out =
      applyJoinedLinesToBodyBlocks(
        "a\nb\nc\nd",
        bodies
      );

    expect(out[0].text).toBe("a");
    expect(out[1].text).toBe("b\nc\nd");
  });
});
