import mammoth from "mammoth";
import {
  applyColoredRunsToHtml,
  extractDocxColoredRuns,
} from "./extractDocxColors";
import { normalizeWordListsInHtml } from "./normalizeWordLists";

export const extractDocumentHtml = async (
  file: File
): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();

  // Run mammoth and color extraction in parallel.
  const [mammothResult, coloredRuns] = await Promise.all([
    mammoth.convertToHtml({ arrayBuffer }),
    extractDocxColoredRuns(arrayBuffer),
  ]);

  let html = mammothResult.value;

  if (coloredRuns.length) {
    html = applyColoredRunsToHtml(
      html,
      coloredRuns
    );
  }

  return normalizeWordListsInHtml(html);
};