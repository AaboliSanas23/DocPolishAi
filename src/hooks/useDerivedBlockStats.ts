import { useMemo } from "react";
import type { DocumentBlock } from "../types/document";

export interface DerivedBlockStats {
  total: number;
  titles: number;
  subtitles: number;
  paragraphs: number;
  code: number;
}

/**
 * Block counts for the sidebar. Recomputes only when block ids/types or length
 * change — not on every text edit — so memoized sidebars can skip re-renders.
 */
export function useDerivedBlockStats(
  blocks: DocumentBlock[]
): DerivedBlockStats {
  const structureKey = useMemo(
    () =>
      `${blocks.length}:${blocks
        .map((b) => `${b.id}:${b.type}`)
        .join("|")}`,
    [blocks]
  );

  return useMemo(() => {
    let titles = 0;
    let subtitles = 0;
    let paragraphs = 0;
    let code = 0;

    for (const block of blocks) {
      if (block.type === "title") titles += 1;
      if (block.type === "subtitle") subtitles += 1;
      if (block.type === "paragraph") paragraphs += 1;
      if (block.type === "code") code += 1;
    }

    return {
      total: blocks.length,
      titles,
      subtitles,
      paragraphs,
      code,
    };
  }, [structureKey]); // eslint-disable-line react-hooks/exhaustive-deps -- blocks matches last render when key unchanged; recount when key changes
}
