import { DocumentBlock } from "../../types/document";
import { blocksToHtml } from "./blocksToHtml";
import { extractBlocksFromHtml } from "./parseDoc";
import { detectBlockTypes } from "./detectType";

describe("blocksToHtml", () => {
  test("serializes title/subtitle/paragraph/code", () => {
    const blocks: DocumentBlock[] = [
      {
        id: 1,
        text: "Main Title",
        type: "title",
        originalTag: "h1",
        isBold: true,
        isList: false,
      },
      {
        id: 2,
        text: "Sub head",
        type: "subtitle",
        originalTag: "h2",
        isBold: true,
        isList: false,
      },
      {
        id: 3,
        text: "Body line.",
        type: "paragraph",
        originalTag: "p",
        isBold: false,
        isList: false,
      },
      {
        id: 4,
        text: "let x = 1;",
        type: "code",
        originalTag: "p",
        isBold: false,
        isList: false,
        isCode: true,
      },
    ];

    const html = blocksToHtml(blocks);

    expect(html).toContain("<h1>");
    expect(html).toContain("Main Title");
    expect(html).toContain("<h2>");
    expect(html).toContain("Sub head");
    expect(html).toContain("<p>");
    expect(html).toContain("Body line.");
    expect(html).toContain("<pre>");
    expect(html).toContain("let x = 1;");
  });

  test("editor edits survive parse round-trip into preview/export pipeline", () => {
    const blocks: DocumentBlock[] = [
      {
        id: 10,
        text: "JavaScriptttttttt",
        type: "title",
        originalTag: "p",
        isBold: true,
        isList: false,
      },
      {
        id: 11,
        text: "Guide text",
        type: "subtitle",
        originalTag: "p",
        isBold: true,
        isList: false,
      },
    ];

    const html = blocksToHtml(blocks);
    const raw = extractBlocksFromHtml(html);
    const roundTrip =
      detectBlockTypes(raw);

    const titleBlock =
      roundTrip.find((b) => b.type === "title") ||
      roundTrip[0];

    expect(titleBlock?.text).toContain(
      "JavaScriptttttttt"
    );

    const subBlock =
      roundTrip.find((b) => b.type === "subtitle");

    expect(subBlock?.text).toContain("Guide text");
  });

  test("DOCX-style bullet list survives extract → classify → blocksToHtml", () => {
    const html = `
      <ul>
        <li>Client Side: short line.</li>
        <li>Server Side: another short line.</li>
      </ul>
    `;

    const raw =
      extractBlocksFromHtml(html);
    const classified =
      detectBlockTypes(raw);

    expect(
      classified.every(
        (b) =>
          b.type === "paragraph" &&
          b.originalTag === "li"
      )
    ).toBe(true);

    const roundTrip =
      blocksToHtml(classified);

    expect(roundTrip).toContain("<ul>");
    expect(roundTrip).toContain("</ul>");
    expect(
      (roundTrip.match(/<li>/g) || [])
        .length
    ).toBe(2);
  });

  test("underline survives html extract round-trip", () => {
    const blocks: DocumentBlock[] = [
      {
        id: 20,
        text: "Underlined Title",
        type: "title",
        originalTag: "h1",
        isBold: true,
        isList: false,
        isUnderline: true,
      },
    ];

    const html = blocksToHtml(blocks);
    const raw =
      extractBlocksFromHtml(html);

    const hit = raw.find((b) =>
      b.text.includes("Underlined Title")
    );

    expect(
      hit?.inlineHtml
        ?.toLowerCase()
        .includes("<u>")
    ).toBe(true);
  });
});
