import JSZip from "jszip";

export interface ColoredRun {
  text: string;
  color: string | null;
  highlight: string | null;
}

const HIGHLIGHT_NAME_TO_HEX: Record<string, string> = {
  yellow: "#fff59d",
  green: "#c8e6c9",
  cyan: "#b2ebf2",
  magenta: "#f8bbd0",
  blue: "#bbdefb",
  red: "#ffcdd2",
  darkBlue: "#90caf9",
  darkCyan: "#80deea",
  darkGreen: "#a5d6a7",
  darkMagenta: "#ce93d8",
  darkRed: "#ef9a9a",
  darkYellow: "#fff176",
  darkGray: "#bdbdbd",
  lightGray: "#eeeeee",
  black: "#9e9e9e",
};

const NORMALIZED_BLACK = new Set([
  "auto",
  "000000",
  "black",
]);

const cleanColorVal = (raw: string | null) => {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (NORMALIZED_BLACK.has(lower)) return null;
  if (/^[0-9a-f]{6}$/i.test(lower)) {
    return `#${lower}`;
  }
  return null;
};

const cleanHighlightVal = (raw: string | null) => {
  if (!raw) return null;
  const lower = raw.trim();
  if (lower === "none") return null;
  return HIGHLIGHT_NAME_TO_HEX[lower] || null;
};

export const extractDocxColoredRuns = async (
  arrayBuffer: ArrayBuffer
): Promise<ColoredRun[]> => {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const file = zip.file("word/document.xml");
    if (!file) return [];

    const xml = await file.async("string");

    // Parse the XML once.
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");

    if (
      doc.getElementsByTagName("parsererror").length > 0
    ) {
      return [];
    }

    const wNamespace =
      "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

    const runs = doc.getElementsByTagNameNS(
      wNamespace,
      "r"
    );

    const result: ColoredRun[] = [];

    for (let i = 0; i < runs.length; i += 1) {
      const run = runs[i];

      const rPr = run.getElementsByTagNameNS(
        wNamespace,
        "rPr"
      )[0];

      let color: string | null = null;
      let highlight: string | null = null;

      if (rPr) {
        const colorEl = rPr.getElementsByTagNameNS(
          wNamespace,
          "color"
        )[0];

        if (colorEl) {
          color = cleanColorVal(
            colorEl.getAttributeNS(wNamespace, "val")
          );
        }

        const highlightEl = rPr.getElementsByTagNameNS(
          wNamespace,
          "highlight"
        )[0];

        if (highlightEl) {
          highlight = cleanHighlightVal(
            highlightEl.getAttributeNS(wNamespace, "val")
          );
        }
      }

      // Concatenate all <w:t> text inside this run.
      const textNodes = run.getElementsByTagNameNS(
        wNamespace,
        "t"
      );

      let text = "";
      for (let t = 0; t < textNodes.length; t += 1) {
        text += textNodes[t].textContent || "";
      }

      // Tabs become a single space, line breaks become newline.
      const breaks = run.getElementsByTagNameNS(
        wNamespace,
        "br"
      );
      if (breaks.length > 0 && !text) {
        text = "\n".repeat(breaks.length);
      }

      if (!text) continue;

      result.push({ text, color, highlight });
    }

    return result;
  } catch (error) {
    console.warn("Failed to extract DOCX colors:", error);
    return [];
  }
};

//-----------------------------------
// Inject color spans into a mammoth-produced HTML by
// walking text nodes in document order and consuming
// from a flat list of (text, color, highlight) runs.
//-----------------------------------
export const applyColoredRunsToHtml = (
  html: string,
  runs: ColoredRun[]
): string => {
  if (!runs.length) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<!DOCTYPE html><html><body>${html}</body></html>`,
    "text/html"
  );

  let runIdx = 0;
  let consumed = 0;

  const isDecorated = (run: ColoredRun) =>
    run.color !== null || run.highlight !== null;

  const peekRun = () => {
    while (
      runIdx < runs.length &&
      consumed >= runs[runIdx].text.length
    ) {
      runIdx += 1;
      consumed = 0;
    }
    return runIdx < runs.length ? runs[runIdx] : null;
  };

  const advanceWithoutDecorating = (n: number) => {
    let remaining = n;
    while (remaining > 0) {
      const run = peekRun();
      if (!run) return;

      const left = run.text.length - consumed;
      const take = Math.min(remaining, left);
      consumed += take;
      remaining -= take;

      if (consumed >= run.text.length) {
        runIdx += 1;
        consumed = 0;
      }
    }
  };

  const walker = doc.createTreeWalker(
    doc.body,
    NodeFilter.SHOW_TEXT
  );

  const replacements: {
    node: Text;
    fragment: DocumentFragment;
  }[] = [];

  let current = walker.nextNode() as Text | null;

  while (current) {
    const text = current.nodeValue || "";

    if (!text) {
      current = walker.nextNode() as Text | null;
      continue;
    }

    const fragment = doc.createDocumentFragment();
    let cursor = 0;
    let mismatched = false;

    while (cursor < text.length) {
      const run = peekRun();
      if (!run) break;

      const left = run.text.length - consumed;
      const remainingText = text.length - cursor;
      const take = Math.min(left, remainingText);

      const expected = run.text.slice(
        consumed,
        consumed + take
      );
      const actual = text.slice(cursor, cursor + take);

      if (expected !== actual) {
        mismatched = true;
        break;
      }

      if (isDecorated(run)) {
        const span = doc.createElement("span");

        if (run.color) {
          span.style.color = run.color;
        }

        if (run.highlight) {
          span.style.backgroundColor = run.highlight;
        }

        span.appendChild(
          doc.createTextNode(actual)
        );
        fragment.appendChild(span);
      } else {
        fragment.appendChild(
          doc.createTextNode(actual)
        );
      }

      cursor += take;
      consumed += take;

      if (consumed >= run.text.length) {
        runIdx += 1;
        consumed = 0;
      }
    }

    if (mismatched || cursor < text.length) {
      const leftover = text.slice(cursor);
      // Leftover text we couldn't align — keep as plain text
      // and try to resync by skipping non-matching runs.
      fragment.appendChild(
        doc.createTextNode(leftover)
      );

      // Try a small resync attempt.
      const resyncWindow = leftover.slice(0, 24);
      let resynced = false;
      for (
        let probe = runIdx;
        probe < Math.min(runIdx + 50, runs.length);
        probe += 1
      ) {
        const idx = runs[probe].text.indexOf(
          resyncWindow
        );
        if (idx !== -1) {
          runIdx = probe;
          consumed = idx + resyncWindow.length;
          resynced = true;
          break;
        }
      }
      if (!resynced) {
        advanceWithoutDecorating(leftover.length);
      }
    }

    if (fragment.childNodes.length) {
      replacements.push({
        node: current,
        fragment,
      });
    }

    current = walker.nextNode() as Text | null;
  }

  replacements.forEach(({ node, fragment }) => {
    node.parentNode?.replaceChild(fragment, node);
  });

  return doc.body.innerHTML;
};
