/**
 * Count case-insensitive substring hits in visible text (not in
 * script/style), without mutating HTML.
 */
export const countSearchMatchesInHtml = (
  html: string,
  rawQuery: string
): number => {
  const query = rawQuery.trim();

  if (!query || !html.trim()) {
    return 0;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      `<div id="docpolish-search-root">${html}</div>`,
      "text/html"
    );

    const root = doc.getElementById(
      "docpolish-search-root"
    );

    if (!root) {
      return 0;
    }

    const lowerQ = query.toLowerCase();
    let total = 0;

    const walker = doc.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT
    );

    let cur: Node | null;

    while ((cur = walker.nextNode())) {
      if (cur.nodeType !== Node.TEXT_NODE) {
        continue;
      }

      const text = cur as Text;
      const val = text.nodeValue ?? "";

      let el: Element | null =
        text.parentElement;

      let skip = false;

      while (el) {
        const tag = el.tagName;

        if (
          tag === "SCRIPT" ||
          tag === "STYLE"
        ) {
          skip = true;
          break;
        }

        el = el.parentElement;
      }

      if (skip) {
        continue;
      }

      const valLower = val.toLowerCase();
      let pos = 0;

      while (pos < val.length) {
        const idx = valLower.indexOf(
          lowerQ,
          pos
        );

        if (idx === -1) {
          break;
        }

        total += 1;
        pos = idx + query.length;
      }
    }

    return total;
  } catch {
    return 0;
  }
};

/**
 * Wraps case-insensitive matches in HTML text nodes with <mark>,
 * without touching tag boundaries or script/style content.
 * @param activeMatchIndex — which hit gets stronger highlight (for prev/next).
 */
export const highlightSearchInHtml = (
  html: string,
  rawQuery: string,
  activeMatchIndex: number = 0
): string => {
  const query = rawQuery.trim();

  if (!query || !html.trim()) {
    return html;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      `<div id="docpolish-search-root">${html}</div>`,
      "text/html"
    );

    const root = doc.getElementById(
      "docpolish-search-root"
    );

    if (!root) {
      return html;
    }

    const lowerQ = query.toLowerCase();

    const textNodes: Text[] = [];
    const walker = doc.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT
    );

    let cur: Node | null;

    while ((cur = walker.nextNode())) {
      if (cur.nodeType !== Node.TEXT_NODE) {
        continue;
      }

      const text = cur as Text;
      const val = text.nodeValue ?? "";

      if (!val.toLowerCase().includes(lowerQ)) {
        continue;
      }

      let el: Element | null =
        text.parentElement;

      let skip = false;

      while (el) {
        const tag = el.tagName;

        if (
          tag === "SCRIPT" ||
          tag === "STYLE" ||
          tag === "MARK"
        ) {
          skip = true;
          break;
        }

        el = el.parentElement;
      }

      if (!skip) {
        textNodes.push(text);
      }
    }

    const wrapOne = (textNode: Text) => {
      const val = textNode.nodeValue ?? "";
      const valLower = val.toLowerCase();
      const frag = doc.createDocumentFragment();

      let i = 0;

      while (i < val.length) {
        const idx = valLower.indexOf(
          lowerQ,
          i
        );

        if (idx === -1) {
          frag.appendChild(
            doc.createTextNode(val.slice(i))
          );
          break;
        }

        if (idx > i) {
          frag.appendChild(
            doc.createTextNode(
              val.slice(i, idx)
            )
          );
        }

        const mark =
          doc.createElement("mark");

        mark.setAttribute(
          "data-docpolish-search",
          "1"
        );
        mark.style.backgroundColor =
          "#fef08a";
        mark.style.padding = "0 2px";
        mark.style.borderRadius = "2px";

        mark.appendChild(
          doc.createTextNode(
            val.slice(
              idx,
              idx + query.length
            )
          )
        );

        frag.appendChild(mark);

        i = idx + query.length;
      }

      textNode.parentNode?.replaceChild(
        frag,
        textNode
      );
    };

    textNodes.forEach(wrapOne);

    const marks = root.querySelectorAll(
      "mark[data-docpolish-search]"
    );

    const safeIndex = Math.max(
      0,
      Math.min(
        activeMatchIndex,
        Math.max(0, marks.length - 1)
      )
    );

    marks.forEach((mark, i) => {
      const el = mark as HTMLElement;

      el.setAttribute(
        "data-docpolish-hit-index",
        String(i)
      );

      if (i === safeIndex) {
        el.style.backgroundColor = "#facc15";
        el.style.outline =
          "2px solid #ca8a04";
        el.style.outlineOffset = "1px";
      } else {
        el.style.backgroundColor = "#fef08a";
        el.style.outline = "none";
      }
    });

    return root.innerHTML;
  } catch {
    return html;
  }
};

/** Remove preview search highlights before persisting edited HTML. */
export const stripDocPolishSearchMarks = (
  html: string
): string => {
  if (
    !html.includes("data-docpolish-search") &&
    !html.includes("data-docpolish-hit-index")
  ) {
    return html;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      `<div id="docpolish-strip-root">${html}</div>`,
      "text/html"
    );

    const root = doc.getElementById(
      "docpolish-strip-root"
    );

    if (!root) {
      return html;
    }

    root
      .querySelectorAll(
        "mark[data-docpolish-search]"
      )
      .forEach((mark) => {
        const parent = mark.parentNode;

        if (!parent) {
          return;
        }

        while (mark.firstChild) {
          parent.insertBefore(
            mark.firstChild,
            mark
          );
        }

        parent.removeChild(mark);
      });

    return root.innerHTML;
  } catch {
    return html;
  }
};
