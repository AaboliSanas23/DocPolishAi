export type BlockType =
  | "title"
  | "subtitle"
  | "paragraph"
  | "code"
  | "table";

export interface DocumentBlock {
  id: number;
  text: string;
  type: BlockType;

  originalTag: string;
  isBold: boolean;
  isList: boolean;
  isCode?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;

  /** Full `<table>...</table>` from DOCX when this block is a real Word table. */
  tableHtml?: string;

  /**
   * Inline HTML inside one body/title/subtitle/list row when Word uses mixed
   * bold/italic/underline or coloured spans; omitted when the whole block shares
   * one style via isBold / isItalic / isUnderline only.
   */
  inlineHtml?: string;
}