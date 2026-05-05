import { extractBlocksFromHtml } from "./parseDoc";
import { detectBlockTypes } from "./detectType";

describe("extractBlocksFromHtml", () => {
  test("keeps a real Word-style table as one block, not one block per cell", () => {
    const html = `
      <p>Intro line</p>
      <table>
        <tr><th>Metacharacter</th><th>Description</th></tr>
        <tr><td><p>\\.</p></td><td><p>Search single characters</p></td></tr>
        <tr><td><p>\\w</p></td><td><p>Word chars</p></td></tr>
      </table>
      <p>After table</p>
    `;

    const raw = extractBlocksFromHtml(html);
    const tableBlocks = raw.filter(
      (b) => b.originalTag === "table"
    );

    expect(tableBlocks).toHaveLength(1);
    expect(tableBlocks[0].tableHtml).toContain(
      "<table"
    );
    expect(tableBlocks[0].tableHtml).toContain(
      "Metacharacter"
    );

    const classified = detectBlockTypes(raw);
    expect(
      classified.filter((b) => b.type === "table")
    ).toHaveLength(1);
    expect(
      classified.filter((b) => b.originalTag === "table")
    ).toHaveLength(1);
  });

  test("multiline template literal in one <p> becomes one code block", () => {
    const html = `<p>let s = \`
This is a
multiline
string\`;
console.log(s);</p>`;

    const raw = extractBlocksFromHtml(html);
    const classified = detectBlockTypes(raw);
    const codeBlocks = classified.filter(
      (b) => b.type === "code"
    );

    expect(codeBlocks).toHaveLength(1);
    expect(codeBlocks[0].text).toContain("let s = ");
    expect(codeBlocks[0].text).toContain(
      "console.log(s);"
    );
  });

  test("template literal split across multiple <p> merges into one code block", () => {
    const html = `
      <p>let s = \`</p>
      <p>This is a</p>
      <p>multiline</p>
      <p>string\`;</p>
      <p>console.log(s);</p>
    `;

    const raw = extractBlocksFromHtml(html);
    const classified = detectBlockTypes(raw);
    const codeBlocks = classified.filter(
      (b) => b.type === "code"
    );

    expect(codeBlocks).toHaveLength(1);
    expect(codeBlocks[0].text).toContain("console.log(s);");
  });

  test("Output wrapper pre[data-output-box] becomes paragraph, not code", () => {
    const html = [
      `<p>console.log("x");</p>`,
      `<p>Output</p>`,
      `<pre data-output-box="true">Hello\nworld</pre>`,
    ].join("\n");

    const raw = extractBlocksFromHtml(html);
    const classified = detectBlockTypes(raw);
    const codeBlocks = classified.filter(
      (b) => b.type === "code"
    );
    const outputBlocks = classified.filter(
      (b) =>
        b.type === "paragraph" &&
        b.text.includes("Hello") &&
        b.text.includes("world")
    );

    expect(codeBlocks).toHaveLength(1);
    expect(outputBlocks).toHaveLength(1);
    expect(outputBlocks[0].originalTag).toBe("p");
  });

  test("<pre> from contenteditable keeps line breaks via <br>", () => {
    const html =
      "<pre>x = 1;<br>console.log(x);</pre>";

    const raw =
      extractBlocksFromHtml(html);
    const code = raw.filter(
      (b) => b.type === "code"
    );

    expect(code).toHaveLength(1);
    expect(code[0].text).toContain("\n");
    expect(code[0].text).toMatch(
      /;\s*\n\s*console\.log/
    );
  });

  test("<pre> from contenteditable keeps line breaks via nested div", () => {
    const html =
      "<pre>x = 1;<div>console.log(x);</div></pre>";

    const raw =
      extractBlocksFromHtml(html);
    const code = raw.filter(
      (b) => b.type === "code"
    );

    expect(code).toHaveLength(1);
    expect(code[0].text).toContain("\n");
    expect(code[0].text).toMatch(
      /;\s*\n\s*console\.log/
    );
  });

  test("partial italic keeps em in inlineHtml without block isItalic", () => {
    const html =
      "<p>JavaScript is a <em>lightweight</em> interpreter.</p>";

    const raw =
      extractBlocksFromHtml(html);

    expect(raw).toHaveLength(1);
    expect(raw[0].inlineHtml).toContain(
      "<em>"
    );
    expect(
      raw[0].inlineHtml
    ).toContain("lightweight");
    expect(raw[0].isItalic).toBe(
      false
    );
    expect(raw[0].text).toContain(
      "lightweight"
    );
  });
});
