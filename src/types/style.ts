export type BulletStyle =
  | "dot"
  | "dash";

export type HighlightMode = "keep" | "remove";

export interface StyleConfig {
  /** In points (pt), aligned with Word font size. */
  titleSize: number;
  /** In points (pt), aligned with Word font size. */
  subtitleSize: number;
  /** In points (pt), aligned with Word font size. */
  paragraphSize: number;
  paragraphSpacing: number;
  fontFamily: string;
  bulletStyle: BulletStyle;
  highlightMode: HighlightMode;
  detectCodeBlocks: boolean;
  codeBackground: string;

  /**
   * When Original Highlights is Keep: if false (default), body `<p>` / `<li>`
   * keep Word font **sizes** and inline colours; **Font Family** still applies from
   * the sidebar so preview/export stay consistent. Turn on to force Paragraph Size too.
   * Remove highlights mode always applies full body typography (size + family).
   */
  applyBodyFontFromSettings: boolean;

  /**
   * When true, consecutive tab- or wide-space-separated paragraphs may be turned
   * into an HTML table. Off by default so Word layout, borders, and pseudo-tables
   * are not altered.
   */
  inferParagraphTables: boolean;

  /**
   * When true, short heading-like opening `<p>` / `<li>` blocks get Title/Subtitle
   * sizes. On by default; turn off to keep Word’s original styling on those lines.
   */
  promoteOutlineHeadings: boolean;
}

export const DEFAULT_STYLE_CONFIG: StyleConfig = {
  titleSize: 24,
  subtitleSize: 18,
  paragraphSize: 14,
  paragraphSpacing: 10,
  fontFamily: "Calibri",
  bulletStyle: "dot",
  highlightMode: "keep",
  detectCodeBlocks: true,
  codeBackground: "#f8fafc",
  applyBodyFontFromSettings: false,
  inferParagraphTables: false,
  promoteOutlineHeadings: true,
};

export const CODE_BACKGROUND_PRESETS: {
  value: string;
  label: string;
}[] = [
  { value: "#f8fafc", label: "Slate" },
  { value: "#f1f5f9", label: "Cool gray" },
  { value: "#fef3c7", label: "Yellow" },
  { value: "#dcfce7", label: "Green" },
  { value: "#dbeafe", label: "Blue" },
  { value: "#fce7f3", label: "Pink" },
  { value: "#1e293b", label: "Dark" },
];