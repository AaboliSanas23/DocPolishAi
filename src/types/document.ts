export type BlockType =
  | "title"
  | "subtitle"
  | "paragraph"
  | "code";

export interface DocumentBlock {
  id: number;
  text: string;
  type: BlockType;

  originalTag: string;
  isBold: boolean;
  isList: boolean;
  isCode?: boolean;
  isItalic?: boolean;
}