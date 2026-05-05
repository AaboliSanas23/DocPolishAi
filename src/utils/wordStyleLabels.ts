import { BlockType } from "../types/document";

/**
 * Human-readable labels for editor UI. Internal `BlockType` is unchanged.
 */
export const wordStyleLabel = (
  type: BlockType
): string => {
  switch (type) {
    case "title":
      return "Title";
    case "subtitle":
      return "Subtitle";
    case "paragraph":
      return "Paragraph";
    case "code":
      return "Code";
    case "table":
      return "Table";
    default:
      return type;
  }
};
