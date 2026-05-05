import { applyStylesToHtml } from "./applyStylesToHtml";

const styles = {
  fontFamily: "Inter",
  paragraphSize: 16,
  titleSize: 32,
  subtitleSize: 22,
  paragraphSpacing: 12,
  detectCodeBlocks: true,
  codeBackground: "#f8fafc",
  highlightMode: "remove",
  applyBodyFontFromSettings: false,
  inferParagraphTables: false,
  promoteOutlineHeadings: false,
} as any;

const countPres = (html: string) =>
  (html.match(/<pre[\s>]/g) || []).length;

/** `<pre>` blocks from merged code — excludes Output wrappers (`data-output-box`). */
const countCodePres = (html: string): number => {
  const re = /<pre\b[^>]*>/gi;
  let n = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (!/data-output-box\s*=/i.test(m[0])) {
      n += 1;
    }
  }
  return n;
};

describe("applyStylesToHtml merge behavior", () => {
  test("each line as own <p>", () => {
    const html = [
      `<p>let s = \`</p>`,
      `<p>This is a</p>`,
      `<p>multiline</p>`,
      `<p>string\`;</p>`,
      `<p>console.log(s);</p>`,
      `<p>Output</p>`,
      `<p>This is a</p>`,
      `<p>multiline</p>`,
      `<p>string</p>`,
    ].join("\n");

    const out = applyStylesToHtml(html, styles);
    expect(countCodePres(out)).toBe(1);
    expect(out).toContain("data-output-box");
    expect(out).toContain("console.log(s);");
  });

  test("closing template + console.log in one <p> becomes one <pre>", () => {
    const html = [
      `<p>let s = \`</p>`,
      `<p>This is a</p>`,
      `<p>multiline</p>`,
      `<p>string\`;
console.log(s);</p>`,
      `<p>Output</p>`,
      `<p>result</p>`,
    ].join("\n");

    const out = applyStylesToHtml(html, styles);
    expect(countCodePres(out)).toBe(1);
    expect(out).toContain("data-output-box");
    const codePreMatch = out.match(
      /<pre(?![^>]*data-output-box)[^>]*>([\s\S]*?)<\/pre>/i
    );
    expect(codePreMatch).toBeTruthy();
    expect(codePreMatch![1]).toContain("console.log(s);");
    expect(codePreMatch![1]).toContain("string");
  });

  test("NBSP (Word) between words in template body keeps one pre", () => {
    const nbsp = "\u00A0";
    const html = [
      `<p>let s = \`</p>`,
      `<p>This${nbsp}is${nbsp}a</p>`,
      `<p>multiline</p>`,
      `<p>string\`;</p>`,
      `<p>console.log(s);</p>`,
      `<p>Output</p>`,
    ].join("\n");

    const out = applyStylesToHtml(html, styles);
    expect(countCodePres(out)).toBe(1);
    expect(out).toContain("console.log(s);");
  });

  test("with empty <p> between", () => {
    const html = [
      `<p>let s = \`</p>`,
      `<p>This is a</p>`,
      `<p>multiline</p>`,
      `<p>string\`;</p>`,
      `<p></p>`,
      `<p>console.log(s);</p>`,
      `<p>Output</p>`,
      `<p>This is a</p>`,
      `<p>multiline</p>`,
      `<p>string</p>`,
    ].join("\n");

    const out = applyStylesToHtml(html, styles);
    expect(countCodePres(out)).toBe(1);
    expect(out).toContain("data-output-box");
  });

  test("two pre blocks separated by stray <br>", () => {
    const html =
      `<pre>let s = \`\nThis is a\nmultiline\nstring\`;</pre>` +
      `<br/>` +
      `<pre>console.log(s);</pre>` +
      `<p>Output</p><p>This is a</p>`;

    const out = applyStylesToHtml(html, styles);
    expect(countCodePres(out)).toBe(1);
    expect(out).toContain("data-output-box");
  });

  test("two pre blocks in different parents", () => {
    const html =
      `<div><pre>let s = \`\nThis is a\nmultiline\nstring\`;</pre></div>` +
      `<div><pre>console.log(s);</pre></div>` +
      `<p>Output</p><p>This is a</p>`;

    const out = applyStylesToHtml(html, styles);
    expect(countCodePres(out)).toBe(1);
    expect(out).toContain("data-output-box");
  });

  test("real text between pre blocks does NOT merge", () => {
    const html =
      `<pre>let s = \`\nThis is a\nmultiline\nstring\`;</pre>` +
      `<p>Some unrelated explanation that should remain.</p>` +
      `<pre>console.log(s);</pre>`;

    const out = applyStylesToHtml(html, styles);
    expect(countPres(out)).toBe(2);
  });

  test("detectCodeBlocks=false leaves paragraphs as-is", () => {
    const html = [
      `<p>let s = \`</p>`,
      `<p>This is a</p>`,
      `<p>console.log(s);</p>`,
    ].join("\n");

    const out = applyStylesToHtml(html, {
      ...styles,
      detectCodeBlocks: false,
    });

    expect(countPres(out)).toBe(0);
    expect(out).toContain("console.log(s);");
  });

  test("custom codeBackground is applied to created <pre>", () => {
    const html = [
      `<p>let s = \`</p>`,
      `<p>console.log(s);</p>`,
    ].join("\n");

    const out = applyStylesToHtml(html, {
      ...styles,
      codeBackground: "#fef3c7",
    });

    expect(countPres(out)).toBe(1);
    // Browsers normalize hex to rgb() in inline styles.
    const lowered = out.toLowerCase();
    expect(
      lowered.includes("#fef3c7") ||
        lowered.includes("rgb(254, 243, 199)")
    ).toBe(true);
  });

  test("Keep mode preserves inner color spans inside code", () => {
    const html = [
      `<p><span style="color: #7e57c2">let</span> s = \`</p>`,
      `<p><span style="color: #ff8a65">This is a</span></p>`,
      `<p>console.log(s);</p>`,
    ].join("\n");

    const out = applyStylesToHtml(html, {
      ...styles,
      highlightMode: "keep",
    });

    expect(countPres(out)).toBe(1);
    const lowered = out.toLowerCase();
    expect(
      lowered.includes("#7e57c2") ||
        lowered.includes("rgb(126, 87, 194)")
    ).toBe(true);
    expect(
      lowered.includes("#ff8a65") ||
        lowered.includes("rgb(255, 138, 101)")
    ).toBe(true);
  });

  test("Remove mode strips Word highlight colours inside code too", () => {
    const html = [
      `<p><span style="color: #ff8a65">A long prose paragraph that is definitely not code, with words and punctuation, ending with a period.</span></p>`,
      `<p><span style="color: #7e57c2">let</span> s = \`</p>`,
      `<p>console.log(s);</p>`,
    ].join("\n");

    const out = applyStylesToHtml(html, {
      ...styles,
      highlightMode: "remove",
      detectCodeBlocks: true,
    });

    const lowered = out.toLowerCase();
    // Code syntax colours removed — uniform text.
    expect(
      !lowered.includes("#7e57c2") &&
        !lowered.includes("rgb(126, 87, 194)")
    ).toBe(true);
    // Prose orange stripped too.
    expect(
      !lowered.includes("#ff8a65") &&
        !lowered.includes("rgb(255, 138, 101)")
    ).toBe(true);
    expect(countPres(out)).toBe(1);
  });

  test("Remove mode + code detection off strips ALL colors", () => {
    const html = [
      `<p><span style="color: #7e57c2">let</span> s = \`</p>`,
      `<p>console.log(s);</p>`,
    ].join("\n");

    const out = applyStylesToHtml(html, {
      ...styles,
      highlightMode: "remove",
      detectCodeBlocks: false,
    });

    const lowered = out.toLowerCase();
    expect(countPres(out)).toBe(0);
    expect(
      !lowered.includes("#7e57c2") &&
        !lowered.includes("rgb(126, 87, 194)")
    ).toBe(true);
  });

  test("Output box uses chosen codeBackground", () => {
    const html = [
      `<p>console.log("Hello");</p>`,
      `<p>Output</p>`,
      `<p>Hello</p>`,
    ].join("\n");

    const out = applyStylesToHtml(html, {
      ...styles,
      codeBackground: "#dbeafe",
    });

    const lowered = out.toLowerCase();
    expect(
      lowered.includes("#dbeafe") ||
        lowered.includes("rgb(219, 234, 254)")
    ).toBe(true);
    expect(out).toContain("data-output-box");
  });

  test("Output box on dark code bg drops nested span colours", () => {
    const html = [
      `<p>console.log("x");</p>`,
      `<p>Output</p>`,
      `<p><span style="color: #111827">Hello</span></p>`,
    ].join("\n");

    const out = applyStylesToHtml(html, {
      ...styles,
      highlightMode: "keep",
      codeBackground: "#1e293b",
    });

    const lowered = out.toLowerCase();
    expect(lowered).toContain("data-output-box");
    expect(
      !lowered.includes("#111827") &&
        !lowered.includes("rgb(17, 24, 39)")
    ).toBe(true);
    expect(
      lowered.includes("#f8fafc") ||
        lowered.includes("rgb(248, 250, 252)")
    ).toBe(true);
  });

  test("Output box uses plain text so DOCX export matches <pre> (no nested Word spans)", () => {
    const html = [
      `<p>console.log("x");</p>`,
      `<p>Output</p>`,
      `<p><span style="background-color: #fce7f3">This is a</span></p>`,
      `<p><span style="background-color: #fce7f3">multiline</span></p>`,
      `<p><span style="background-color: #fce7f3">string</span></p>`,
    ].join("\n");

    const out = applyStylesToHtml(html, {
      ...styles,
      highlightMode: "keep",
      codeBackground: "#fce7f3",
    });

    expect(out).toContain("data-output-box");
    expect(out.toLowerCase()).not.toContain(
      "background-color:"
    );
    expect(out).toContain("This is a");
  });

  test("wrapPresForWord wraps code <pre> in a table for Word-compatible shading", () => {
    const html = `<p>console.log(1);</p>`;

    const preview = applyStylesToHtml(
      html,
      styles
    );
    const exportHtml = applyStylesToHtml(
      html,
      styles,
      { wrapPresForWord: true }
    );

    expect(
      preview.toLowerCase()
    ).not.toContain("<table");
    expect(
      exportHtml.toLowerCase()
    ).toContain("<table");
    expect(
      exportHtml.toLowerCase()
    ).toContain("<td");
    expect(exportHtml.toLowerCase()).toContain(
      "<pre"
    );
  });

  test("Parameters ends code block (not merged into <pre>)", () => {
    const html = [
      `<p>array.join(separator);</p>`,
      `<p>Parameters</p>`,
      `<p>This method accepts one parameter.</p>`,
    ].join("\n");

    const out = applyStylesToHtml(html, styles);
    expect(countPres(out)).toBe(1);
    const preMatch = out.match(
      /<pre[^>]*>([\s\S]*?)<\/pre>/i
    );
    expect(preMatch).toBeTruthy();
    expect(
      preMatch![1].toLowerCase()
    ).not.toContain("parameters");
    expect(out.toLowerCase()).toContain(
      "parameters"
    );
  });

  test("real Word tables are not mangled by paragraph-table heuristics", () => {
    const html = `<table><tbody><tr><th>Static</th><th>Instance</th></tr><tr><td><p>Shared</p></td><td><p>Unique</p></td></tr></tbody></table>`;

    const out = applyStylesToHtml(html, styles);
    expect(
      (out.match(/<table/gi) || []).length
    ).toBe(1);
    expect(out).toContain("Static");
    expect(out).toContain("Shared");
    expect(out).toContain("Unique");
  });

  test("Remove mode strips colours inside mammoth <pre> spans", () => {
    const html =
      `<pre><span style="color: #7e57c2">let</span> x = 1;</pre>`;

    const out = applyStylesToHtml(html, {
      ...styles,
      highlightMode: "remove",
    });

    const lowered = out.toLowerCase();
    expect(
      !lowered.includes("#7e57c2") &&
        !lowered.includes("rgb(126, 87, 194)")
    ).toBe(true);
    expect(lowered).toContain("let x = 1;");
  });

  test("Keep mode still applies sidebar title size on h1 and removes nested span font-size", () => {
    const html =
      '<h1><span style="font-size: 11pt; color: rgb(200, 0, 0)">Main Title</span></h1>';

    const out = applyStylesToHtml(html, {
      ...styles,
      highlightMode: "keep",
    });

    expect(out).toContain("font-size: 32pt");
    expect(out).not.toContain("11pt");
    expect(out).toContain("rgb(200, 0, 0)");
  });

  test("Keep mode without body font applies sidebar font-family but not paragraph size", () => {
    const html = "<p>Hello world</p>";

    const out = applyStylesToHtml(html, {
      ...styles,
      highlightMode: "keep",
      applyBodyFontFromSettings: false,
      promoteOutlineHeadings: false,
      fontFamily: "Inter",
      paragraphSize: 16,
    });

    expect(out).toContain("Hello world");
    expect(out.toLowerCase()).toContain(
      "font-family: inter"
    );
    expect(out).not.toContain("font-size: 16pt");
  });

  test("Keep mode with apply body font forces paragraph typography", () => {
    const html = "<p>Hello world</p>";

    const out = applyStylesToHtml(html, {
      ...styles,
      highlightMode: "keep",
      applyBodyFontFromSettings: true,
      promoteOutlineHeadings: false,
      fontFamily: "Inter",
      paragraphSize: 16,
    });

    expect(out.toLowerCase()).toContain(
      "font-family: inter"
    );
    expect(out).toContain("font-size: 16pt");
  });

  test("Keep mode with apply body font unwraps Word bold in body paragraphs", () => {
    const html =
      "<p><strong>Bold body</strong></p>";

    const out = applyStylesToHtml(html, {
      ...styles,
      highlightMode: "keep",
      applyBodyFontFromSettings: true,
      promoteOutlineHeadings: false,
    });

    expect(out).toContain("Bold body");
    expect(out.toLowerCase()).not.toContain(
      "<strong>"
    );
    expect(out.toLowerCase()).not.toContain(
      "<b>"
    );
  });

  test("apply body font skips stripping bold inside Mammoth Heading paragraphs", () => {
    const html =
      '<p class="Heading1"><strong>Title</strong></p>';

    const out = applyStylesToHtml(html, {
      ...styles,
      highlightMode: "keep",
      applyBodyFontFromSettings: true,
      promoteOutlineHeadings: false,
    });

    expect(out.toLowerCase()).toContain(
      "<strong>"
    );
  });

  test("inferParagraphTables builds table from tab-separated ps", () => {
    const html =
      "<p>ColA\tColB</p><p>1\t2</p>";

    const out = applyStylesToHtml(html, {
      ...styles,
      highlightMode: "remove",
      inferParagraphTables: true,
    });

    expect(
      (out.match(/<table/gi) || []).length
    ).toBe(1);
  });

  test("Keep mode applies title size to heading-like opening paragraphs when promotion on", () => {
    const longBody =
      "This is a much longer body paragraph that clearly exceeds the seventy character threshold used for next paragraph detection.";
    const html = `<p>Short Doc Title Here</p><p>${longBody}</p>`;

    const out = applyStylesToHtml(html, {
      ...styles,
      highlightMode: "keep",
      promoteOutlineHeadings: true,
    });

    expect(out).toContain("Short Doc Title Here");
    expect(out).toContain("font-size: 32pt");
  });

  test("Keep mode applies title size to Mammoth Heading1 paragraph", () => {
    const html =
      '<p class="Heading1">🔷 Static vs Instance (Quick)</p><p>Body text.</p>';

    const out = applyStylesToHtml(html, {
      ...styles,
      highlightMode: "keep",
      titleSize: 24,
      promoteOutlineHeadings: false,
    });

    expect(out).toContain("font-size: 24pt");
    expect(out).toContain("Static vs Instance");
  });
});
