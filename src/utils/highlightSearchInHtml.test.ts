import {
  countSearchMatchesInHtml,
  highlightSearchInHtml,
} from "./highlightSearchInHtml";

describe("highlightSearchInHtml", () => {
  test("wraps visible text matches in mark", () => {
    const html = "<p>Hello world</p>";
    const out = highlightSearchInHtml(html, "world");

    expect(out).toContain("<mark");
    expect(out).toContain("world");
    expect(out).toContain("Hello");
  });

  test("returns original html when query empty", () => {
    const html = "<p>Hello</p>";
    expect(highlightSearchInHtml(html, "")).toBe(html);
    expect(highlightSearchInHtml(html, "   ")).toBe(html);
  });

  test("does not match inside script", () => {
    const html =
      '<p>ok</p><script>var world = 1;</script>';
    const out = highlightSearchInHtml(html, "world");

    expect(out).toContain("<script>");
    expect(out).not.toContain("<mark");
  });

  test("marks active index with data-docpolish-hit-index", () => {
    const html = "<p>a a a</p>";
    const out = highlightSearchInHtml(html, "a", 1);

    expect(out).toContain('data-docpolish-hit-index="0"');
    expect(out).toContain('data-docpolish-hit-index="1"');
    expect(out).toContain('data-docpolish-hit-index="2"');
  });
});

describe("countSearchMatchesInHtml", () => {
  test("counts all non-overlapping matches", () => {
    expect(
      countSearchMatchesInHtml(
        "<p>foo bar foo</p>",
        "foo"
      )
    ).toBe(2);
  });

  test("returns 0 for empty query", () => {
    expect(
      countSearchMatchesInHtml("<p>x</p>", "")
    ).toBe(0);
  });
});
