import { normalizeWordListsInHtml } from "./normalizeWordLists";

describe("normalizeWordListsInHtml", () => {
  it("groups bullet-prefix paragraphs into a ul", () => {
    const html =
      "<p>\u2022 First item</p><p>\u2022 Second item</p>";
    const out =
      normalizeWordListsInHtml(html);

    expect(out).toContain("<ul>");
    expect(out).toContain("<li>");
    expect(out).toContain("First item");
    expect(out).toContain("Second item");
  });

  it("groups numbered-prefix paragraphs into an ol", () => {
    const html =
      "<p>1. Alpha</p><p>2. Beta</p>";
    const out =
      normalizeWordListsInHtml(html);

    expect(out).toContain("<ol>");
    expect(out).toContain("<li>");
  });

  it("groups hanging-indent paragraphs into a ul when margin matches", () => {
    const html =
      '<p style="margin-left:36pt;text-indent:-18pt">Item one</p>' +
      '<p style="margin-left:36pt;text-indent:-18pt">Item two</p>';
    const out =
      normalizeWordListsInHtml(html);

    expect(out).toContain("<ul>");
    expect(out.match(/<li/g)?.length).toBe(2);
  });

  it("does not wrap a single margin-only paragraph without list cues", () => {
    const html =
      '<p style="margin-left:48pt">Only one indented line.</p>';
    const out =
      normalizeWordListsInHtml(html);

    expect(out).not.toContain("<ul>");
    expect(out).toContain("<p");
  });

  it("groups paired Word-style lead-label paragraphs into ul", () => {
    const html =
      "<p><strong>Client Side:</strong> On the client.</p>" +
      "<p><strong>Server Side:</strong> On the server.</p>";
    const out =
      normalizeWordListsInHtml(html);

    expect(out).toContain("<ul>");
    expect(out.match(/<li/g)?.length).toBe(2);
  });

  it("groups plain Title Case lead-label paragraphs when consecutive", () => {
    const html =
      "<p>Client Side: On the client.</p>" +
      "<p>Server Side: On the server.</p>";
    const out =
      normalizeWordListsInHtml(html);

    expect(out).toContain("<ul>");
    expect(out.match(/<li/g)?.length).toBe(2);
  });

  it("does not wrap a single lead-label paragraph into ul", () => {
    const html =
      "<p><strong>Only One:</strong> Solo line.</p>";
    const out =
      normalizeWordListsInHtml(html);

    expect(out).not.toContain("<ul>");
  });

  it("leaves mammoth ul/ol markup untouched", () => {
    const html =
      "<ul><li>A</li><li>B</li></ul>";
    const out =
      normalizeWordListsInHtml(html);

    expect(out).toContain("<ul>");
    expect(out).toContain("<li>A</li>");
  });
});
