import {
  countUnescapedBackticks,
  isCodeLikeLine,
  isDocSectionHeadingLine,
  isLikelyCodeBridgeLine,
  isSoftCodeContinuationLine,
} from "../docx/codeDetection";
import { isLikelyHeadingCandidate } from "../docx/detectType";
import { StyleConfig } from "../../types/style";

/** Remove inline font-size on descendants so parent heading / title rules win (Word runs). */
const stripFontSizeFromStyledSubtree = (
  root: HTMLElement
) => {
  root
    .querySelectorAll("[style]")
    .forEach((el) => {
      const node = el as HTMLElement;

      node.style.removeProperty(
        "font-size"
      );

      const attr =
        node.getAttribute("style");

      if (
        attr !== null &&
        !attr.trim()
      ) {
        node.removeAttribute("style");
      }
    });
};

const collectOutlineNodes = (
  doc: Document
): HTMLElement[] => {
  const out: HTMLElement[] = [];

  doc
    .querySelectorAll(
      "h1,h2,h3,p,li,pre"
    )
    .forEach((el) => {
      const node =
        el as HTMLElement;
      const tag =
        node.tagName.toLowerCase();

      const raw =
        node.textContent || "";

      const text =
        tag === "pre"
          ? raw.trimEnd()
          : raw.trim();

      if (!text) {
        return;
      }

      if (
        (tag === "p" ||
          tag === "li") &&
        node.closest("table")
      ) {
        return;
      }

      out.push(node);
    });

  return out;
};

/** Mammoth maps Word “Heading 1”…“Heading 6” to `<p class="Heading1">` etc. */
const mammothHeadingLevelFromClass = (
  className: string | undefined
): number | null => {
  if (
    !className ||
    typeof className !== "string"
  ) {
    return null;
  }

  const m = className.match(
    /(?:^|\s)heading\s*([1-6])(?:\s|$)/i
  );

  if (m) {
    return parseInt(m[1], 10);
  }

  if (/(?:^|\s)title(?:\s|$)/i.test(className)) {
    return 1;
  }

  if (/(?:^|\s)subtitle(?:\s|$)/i.test(className)) {
    return 2;
  }

  return null;
};

/** When sidebar forces paragraph typography onto body, drop Word-run bold wrappers so preview/export match Paragraph styling. */
const stripOriginalBodyBoldWhenApplyingParagraphFont = (
  doc: Document,
  styles: StyleConfig
) => {
  if (!styles.applyBodyFontFromSettings) {
    return;
  }

  doc.querySelectorAll("p, li").forEach((el) => {
    const node =
      el as HTMLElement;

    if (
      node.closest("table") ||
      node.closest("pre")
    ) {
      return;
    }

    if (
      node.tagName.toLowerCase() === "p"
    ) {
      const cls =
        node.className?.toString() ||
        "";

      if (
        mammothHeadingLevelFromClass(
          cls
        ) !== null
      ) {
        return;
      }
    }

    node
      .querySelectorAll("strong, b")
      .forEach((boldEl) => {
        const parent =
          boldEl.parentNode;

        if (!parent) {
          return;
        }

        while (boldEl.firstChild) {
          parent.insertBefore(
            boldEl.firstChild,
            boldEl
          );
        }

        parent.removeChild(boldEl);
      });

    node
      .querySelectorAll("[style]")
      .forEach((styled) => {
        const styledEl =
          styled as HTMLElement;

        styledEl.style.removeProperty(
          "font-weight"
        );

        const attr =
          styledEl.getAttribute(
            "style"
          );

        if (
          attr !== null &&
          !attr.trim()
        ) {
          styledEl.removeAttribute(
            "style"
          );
        }
      });

    node.style.removeProperty(
      "font-weight"
    );
  });
};

export type ApplyStylesOptions = {
  /**
   * When true (DOCX export only), wraps shaded `<pre>` blocks in a one-cell table so
   * Word keeps backgrounds; omit for in-app preview HTML → blocks round-trip.
   */
  wrapPresForWord?: boolean;
};

export const applyStylesToHtml = (
  html: string,
  styles: StyleConfig,
  options?: ApplyStylesOptions
) => {
  const parser = new DOMParser();

  const doc = parser.parseFromString(
    html,
    "text/html"
  );

  stripOriginalBodyBoldWhenApplyingParagraphFont(
    doc,
    styles
  );

  const keepHighlights =
    styles.highlightMode === "keep";

  const codeDetectionEnabled =
    styles.detectCodeBlocks !== false;

  const applyBodyFont =
    !keepHighlights ||
    styles.applyBodyFontFromSettings === true;

  //-----------------------------------
  // Optional: convert tab-separated paragraph
  // runs into an HTML table (off by default so
  // Word layout is preserved).
  //-----------------------------------
  if (styles.inferParagraphTables === true) {
    const allParagraphs = Array.from(
      doc.querySelectorAll("p")
    );

    let currentTableRows: HTMLElement[] = [];

    const createTableFromRows = (
      rows: HTMLElement[]
    ) => {
      if (rows.length < 2) return;

      const table =
        doc.createElement("table");

      const tbody =
        doc.createElement("tbody");

      rows.forEach((row, index) => {
        const text =
          row.textContent?.trim() ||
          "";

        if (!text) return;

        //-----------------------------------
        // Split table columns
        //-----------------------------------
        const columns = text
          .split(/\t+|\s{4,}/)
          .map((col) => col.trim())
          .filter(Boolean);

        if (columns.length < 2) return;

        const tr =
          doc.createElement("tr");

        columns.forEach((colText) => {
          const cell =
            index === 0
              ? doc.createElement("th")
              : doc.createElement("td");

          cell.textContent =
            colText;

          tr.appendChild(cell);
        });

        tbody.appendChild(tr);
      });

      if (
        tbody.children.length >= 2
      ) {
        table.appendChild(tbody);

        rows[0].parentNode?.insertBefore(
          table,
          rows[0]
        );

        rows.forEach((r) =>
          r.remove()
        );
      }
    };

    allParagraphs.forEach(
      (paragraph) => {
        if (paragraph.closest("table")) {
          if (
            currentTableRows.length
          ) {
            createTableFromRows(
              currentTableRows
            );

            currentTableRows =
              [];
          }

          return;
        }

        const text =
          paragraph.textContent?.trim() ||
          "";

        const looksLikeTable =
          text.includes("\t") ||
          /\s{4,}/.test(text);

        if (looksLikeTable) {
          currentTableRows.push(
            paragraph as HTMLElement
          );
        } else {
          if (
            currentTableRows.length
          ) {
            createTableFromRows(
              currentTableRows
            );

            currentTableRows =
              [];
          }
        }
      }
    );

    if (
      currentTableRows.length
    ) {
      createTableFromRows(
        currentTableRows
      );
    }
  }

  //-----------------------------------
  // Preserve actual tables
  //-----------------------------------
  doc.querySelectorAll("table").forEach((table) => {
    const node =
      table as HTMLElement;

    node.style.width = "100%";
    node.style.borderCollapse =
      "collapse";
    node.style.marginTop =
      "20px";
    node.style.marginBottom =
      "20px";
  });

  doc.querySelectorAll("th").forEach((th) => {
    const node =
      th as HTMLElement;

    node.style.border =
      "1px solid #d1d5db";
    node.style.padding =
      "8px 10px";
    node.style.background =
      "#f3f4f6";
    node.style.fontWeight =
      "bold";
    node.style.textAlign =
      "left";

    if (applyBodyFont) {
      node.style.fontFamily =
        styles.fontFamily;
      node.style.fontSize = `${styles.paragraphSize}pt`;
    }
  });

  doc.querySelectorAll("td").forEach((td) => {
    const node =
      td as HTMLElement;

    node.style.border =
      "1px solid #d1d5db";
    node.style.padding =
      "8px 10px";
    node.style.textAlign =
      "left";

    if (applyBodyFont) {
      node.style.fontFamily =
        styles.fontFamily;
      node.style.fontSize = `${styles.paragraphSize}pt`;
    }
  });

  //-----------------------------------
  // Split mixed paragraphs (only when code
  // detection is on — avoids reshaping Word).
  //-----------------------------------
  if (codeDetectionEnabled) {
    const paragraphNodes = Array.from(
      doc.querySelectorAll("p")
    );

    paragraphNodes.forEach((paragraph) => {
      if (paragraph.closest("table")) {
        return;
      }

      const text =
        paragraph.textContent || "";

      if (!text.includes("\n")) {
        return;
      }

      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length <= 1) {
        return;
      }

      const hasCode = lines.some((line) =>
        isCodeLikeLine(line)
      );

      // Split when:
      // - prose + code mixed (original), or
      // - multiple lines that all look like code — Word often merges
      //   closing `` `...`; `` and `console.log(...)` into one <p>.
      if (!hasCode || lines.length <= 1) {
        return;
      }

      const parent =
        paragraph.parentNode;

      if (!parent) return;

      lines.forEach((line) => {
        const p =
          doc.createElement("p");

        p.textContent =
          line;

        parent.insertBefore(
          p,
          paragraph
        );
      });

      paragraph.remove();
    });
  }

  //-----------------------------------
  // TITLE / SUBTITLE (always use sidebar
  // sizes; strip nested Word font-size so
  // spans cannot shrink headings when keeping
  // highlight colours).
  //-----------------------------------
  doc.querySelectorAll("h1").forEach((el) => {
    const node =
      el as HTMLElement;

    node.style.fontSize = `${styles.titleSize}pt`;
    node.style.fontWeight =
      "bold";
    node.style.fontFamily =
      styles.fontFamily;
    node.style.marginBottom =
      `${styles.paragraphSpacing + 6}px`;
    node.style.lineHeight =
      "1.4";

    stripFontSizeFromStyledSubtree(
      node
    );
  });

  doc
    .querySelectorAll("h2,h3")
    .forEach((el) => {
      const node =
        el as HTMLElement;

      node.style.fontSize = `${styles.subtitleSize}pt`;
      node.style.fontWeight =
        "bold";
      node.style.fontFamily =
        styles.fontFamily;
      node.style.marginTop =
        "20px";
      node.style.marginBottom =
        `${styles.paragraphSpacing + 2}px`;
      node.style.lineHeight =
        "1.4";

      stripFontSizeFromStyledSubtree(
        node
      );
    });

  //-----------------------------------
  // Paragraph styling
  //-----------------------------------
  doc.querySelectorAll("p").forEach((el) => {
    const node =
      el as HTMLElement;

    if (node.closest("table")) {
      node.style.marginBottom = "0";
      node.style.marginTop = "0";

      if (!applyBodyFont) {
        return;
      }

      node.style.fontSize = `${styles.paragraphSize}pt`;
      node.style.fontFamily =
        styles.fontFamily;
      node.style.lineHeight =
        "1.8";
      return;
    }

    if (keepHighlights && !applyBodyFont) {
      // Preserve Word sizes / highlight colours; align body font with sidebar.
      node.style.marginBottom = `${styles.paragraphSpacing}px`;
      node.style.fontFamily =
        styles.fontFamily;
      return;
    }

    node.style.fontSize = `${styles.paragraphSize}pt`;
    node.style.fontFamily =
      styles.fontFamily;
    node.style.lineHeight =
      "1.8";
    node.style.marginBottom =
      `${styles.paragraphSpacing}px`;
  });

  //-----------------------------------
  // List styling
  //-----------------------------------
  doc.querySelectorAll("li").forEach((el) => {
      const node =
        el as HTMLElement;

    if (node.closest("table")) {
      if (!applyBodyFont) {
        return;
      }
      node.style.fontSize = `${styles.paragraphSize}pt`;
      node.style.fontFamily =
        styles.fontFamily;
      node.style.lineHeight =
        "1.8";
      return;
    }

    if (keepHighlights && !applyBodyFont) {
      node.style.marginBottom = `${styles.paragraphSpacing}px`;
      node.style.fontFamily =
        styles.fontFamily;
      return;
    }

    node.style.fontSize = `${styles.paragraphSize}pt`;
    node.style.fontFamily =
      styles.fontFamily;
    node.style.lineHeight =
      "1.8";
  });

  doc
    .querySelectorAll("ul, ol")
    .forEach((el) => {
      const node =
        el as HTMLElement;

      if (node.closest("table")) {
        return;
      }

      node.style.fontFamily =
        styles.fontFamily;
      node.style.marginTop = "0";
      node.style.marginBottom =
        `${styles.paragraphSpacing}px`;
      node.style.paddingLeft =
        "1.35em";

      const tag =
        node.tagName.toLowerCase();

      if (tag === "ul") {
        node.style.listStylePosition =
          "outside";
        node.style.listStyleType =
          styles.bulletStyle === "dash"
            ? '"– "'
            : "disc";
      }
    });

  //-----------------------------------
  // Heading-like opening <p> lines (optional).
  //-----------------------------------
  if (styles.promoteOutlineHeadings === true) {
    const outline =
      collectOutlineNodes(doc);

    for (
      let i = 0;
      i < outline.length;
      i++
    ) {
      const node =
        outline[i];
      const tag =
        node.tagName.toLowerCase();

      // List items can look like mini headings ("Client Side:") — never
      // promote them or bullets disappear from preview/export HTML.
      if (tag === "li") {
        continue;
      }

      if (tag !== "p") {
        continue;
      }

      const text = (
        node.textContent || ""
      ).trim();

      if (!isLikelyHeadingCandidate(text)) {
        continue;
      }

      const next =
        outline[i + 1];
      const previous =
        outline[i - 1];

      const nextText = next
        ? (next.textContent || "").trim()
        : "";
      const prevText = previous
        ? (previous.textContent || "").trim()
        : "";
      const nextTag = next
        ? next.tagName.toLowerCase()
        : "";
      const prevTag = previous
        ? previous.tagName.toLowerCase()
        : "";

      const nextLooksLikeBody =
        !!next &&
        nextTag === "p" &&
        nextText.length > 70 &&
        !isCodeLikeLine(nextText);

      const previousLooksLikeBody =
        !!previous &&
        prevTag === "p" &&
        prevText.length > 70 &&
        !isCodeLikeLine(prevText);

      const role:
        | "title"
        | "subtitle"
        | null =
        i <= 1
          ? "title"
          : nextLooksLikeBody ||
              previousLooksLikeBody
            ? "subtitle"
            : null;

      if (!role) {
        continue;
      }

      if (role === "title") {
        node.style.fontSize = `${styles.titleSize}pt`;
        node.style.fontWeight =
          "bold";
        node.style.fontFamily =
          styles.fontFamily;
        node.style.lineHeight =
          "1.4";
        node.style.marginBottom = `${styles.paragraphSpacing + 6}px`;
      } else {
        node.style.fontSize = `${styles.subtitleSize}pt`;
        node.style.fontWeight =
          "bold";
        node.style.fontFamily =
          styles.fontFamily;
        node.style.lineHeight =
          "1.4";
        node.style.marginTop =
          "20px";
        node.style.marginBottom = `${styles.paragraphSpacing + 2}px`;
      }

      stripFontSizeFromStyledSubtree(
        node
      );
    }
  }

  //-----------------------------------
  // Word “Heading 1–6” as <p class="Heading1">
  // (Mammoth) — always map to sidebar title /
  // subtitle sizes so preview matches Title Size.
  //-----------------------------------
  doc.querySelectorAll("p").forEach((el) => {
    const node =
      el as HTMLElement;

    if (node.closest("table")) {
      return;
    }

    const cls =
      node.className?.toString() || "";

    const level =
      mammothHeadingLevelFromClass(
        cls
      );

    if (!level) {
      return;
    }

    if (level === 1) {
      node.style.fontSize = `${styles.titleSize}pt`;
      node.style.fontWeight =
        "bold";
      node.style.fontFamily =
        styles.fontFamily;
      node.style.lineHeight =
        "1.4";
      node.style.marginBottom = `${styles.paragraphSpacing + 6}px`;
    } else if (
      level === 2 ||
      level === 3
    ) {
      node.style.fontSize = `${styles.subtitleSize}pt`;
      node.style.fontWeight =
        "bold";
      node.style.fontFamily =
        styles.fontFamily;
      node.style.marginTop =
        "20px";
      node.style.marginBottom = `${styles.paragraphSpacing + 2}px`;
      node.style.lineHeight =
        "1.4";
    } else {
      node.style.fontSize = `${styles.subtitleSize}pt`;
      node.style.fontWeight =
        "bold";
      node.style.fontFamily =
        styles.fontFamily;
      node.style.marginTop =
        "12px";
      node.style.marginBottom = `${styles.paragraphSpacing + 2}px`;
      node.style.lineHeight =
        "1.4";
    }

    stripFontSizeFromStyledSubtree(
      node
    );
  });

  //-----------------------------------
  // Resolve text color based on chosen
  // background brightness (dark bg → light text).
  //-----------------------------------
  const codeBgValue =
    styles.codeBackground || "#f8fafc";
  const isDarkBackground = (() => {
    const hex = (codeBgValue || "").replace("#", "");
    if (hex.length !== 6) return false;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (
      Number.isNaN(r) ||
      Number.isNaN(g) ||
      Number.isNaN(b)
    ) {
      return false;
    }
    const luma =
      (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luma < 0.5;
  })();
  const codeTextColor = isDarkBackground
    ? "#f8fafc"
    : "#0f172a";

  /** Multiline <p> fails single-line `isCodeLikeLine` — treat as code when every line qualifies. */
  const allLinesLookLikeCode = (
    raw: string
  ): boolean => {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return false;
    }

    return lines.every(
      (line) =>
        isCodeLikeLine(line) ||
        isLikelyCodeBridgeLine(line) ||
        isSoftCodeContinuationLine(line)
    );
  };

  //-----------------------------------
  // Smart code detection
  //-----------------------------------
  const paragraphs = codeDetectionEnabled
    ? Array.from(doc.querySelectorAll("p")).filter(
        (p) => !p.closest("table")
      )
    : [];

  let currentCodeGroup:
    HTMLElement[] = [];

  let insideCodeBlock =
    false;

  const createCodeBlock = (
    group: HTMLElement[]
  ) => {
    if (!group.length) return;

    const pre =
      doc.createElement("pre");

    if (keepHighlights) {
      const parts = group.map(
        (item) => item.innerHTML.trim()
      );
      pre.innerHTML = parts.join("\n");
    } else {
      pre.textContent = group
        .map(
          (item) => item.textContent?.trim() || ""
        )
        .join("\n");
    }

    pre.style.background = codeBgValue;
    pre.style.color = codeTextColor;
    pre.style.border =
      "1px solid #e2e8f0";
    pre.style.padding =
      "14px 16px";
    pre.style.borderRadius =
      "8px";
    pre.style.fontFamily =
      "monospace";
    pre.style.fontSize =
      "15px";
    pre.style.whiteSpace =
      "pre-wrap";
    pre.style.display =
      "block";
    pre.style.overflowX =
      "auto";
    pre.style.marginBottom =
      "12px";
    pre.style.lineHeight =
      "1.6";

    group[0].parentNode?.insertBefore(
      pre,
      group[0]
    );

    group.forEach((item) =>
      item.remove()
    );
  };

  paragraphs.forEach(
    (paragraph, index) => {
      const node =
        paragraph as HTMLElement;

      const text =
        node.textContent?.trim() ||
        "";

      const nextText =
        index <
        paragraphs.length - 1
          ? (
              paragraphs[
                index + 1
              ] as HTMLElement
            ).textContent?.trim() ||
            ""
          : "";

      //-----------------------------------
      // Start code block
      //-----------------------------------
      if (
        (isCodeLikeLine(text) ||
          allLinesLookLikeCode(text)) &&
        !insideCodeBlock
      ) {
        insideCodeBlock =
          true;

        currentCodeGroup.push(
          node
        );

        return;
      }

      //-----------------------------------
      // Continue code block
      //-----------------------------------
      if (insideCodeBlock) {
        // Keep empty separator lines inside the same code block.
        if (!text) {
          currentCodeGroup.push(
            node
          );
          return;
        }

        const ticksInGroup =
          currentCodeGroup.reduce(
            (sum, el) =>
              sum +
              countUnescapedBackticks(
                el.textContent || ""
              ),
            0
          );
        if (ticksInGroup % 2 === 1) {
          currentCodeGroup.push(
            node
          );
          return;
        }

        const stopWords = [
          "output",
          "output:",
          "example",
          "example:",
          "result",
          "result:",
          "syntax",
          "syntax:",
        ];

        const isStopText =
          stopWords.includes(
            text.toLowerCase()
          ) ||
          isDocSectionHeadingLine(text);

        const looksLikeParagraph =
          text.length > 100 &&
          !isCodeLikeLine(text);

        if (
          isStopText ||
          looksLikeParagraph
        ) {
          createCodeBlock(
            currentCodeGroup
          );

          currentCodeGroup =
            [];

          insideCodeBlock =
            false;

          return;
        }

        if (
          isCodeLikeLine(text) ||
          isLikelyCodeBridgeLine(text) ||
          isSoftCodeContinuationLine(text) ||
          allLinesLookLikeCode(text)
        ) {
        currentCodeGroup.push(
          node
        );
        } else {
          createCodeBlock(
            currentCodeGroup
          );

          currentCodeGroup =
            [];

          insideCodeBlock =
            false;

          return;
        }

        if (
          !isCodeLikeLine(
            nextText
          ) &&
          nextText.length > 80
        ) {
          createCodeBlock(
            currentCodeGroup
          );

          currentCodeGroup =
            [];

          insideCodeBlock =
            false;
        }
      }
    }
  );

  //-----------------------------------
  // Remaining code block
  //-----------------------------------
  if (
    currentCodeGroup.length
  ) {
    createCodeBlock(
      currentCodeGroup
    );
  }

  //-----------------------------------
  // Cleanup empty paragraphs (keep Word “line”
  // paragraphs that use borders / mso rules)
  //-----------------------------------
  doc.querySelectorAll("p").forEach((el) => {
    const node = el as HTMLElement;

    if (node.closest("table")) {
      return;
    }

    const raw = node.textContent || "";
    if (raw.trim()) {
      return;
    }

    const styleAttr = (
      node.getAttribute("style") || ""
    ).toLowerCase();

    if (
      /border(?:-bottom|-top|-left|-right)?\s*:/i.test(
        styleAttr
      ) ||
      /mso-border/i.test(styleAttr) ||
      /border\s*:/i.test(styleAttr)
    ) {
      return;
    }

    node.remove();
  });

  //-----------------------------------
  // Merge adjacent <pre> blocks (only when code
  // detection is on — preserves original layout
  // when code styling is disabled).
  //-----------------------------------
  if (codeDetectionEnabled) {
    let mergedAny = true;

    while (mergedAny) {
      mergedAny = false;

      const allPres = Array.from(
        doc.querySelectorAll("pre")
      ) as HTMLElement[];

      for (
        let idx = 0;
        idx < allPres.length - 1;
        idx += 1
      ) {
        const cur = allPres[idx];
        const nxt = allPres[idx + 1];

        if (!cur.isConnected || !nxt.isConnected) {
          continue;
        }

        const probe = doc.createRange();
        probe.setStartAfter(cur);
        probe.setEndBefore(nxt);

        const between = probe
          .toString()
          .replace(/[\s\u00A0]+/g, " ")
          .trim();

        if (between) {
          continue;
        }

        if (keepHighlights) {
          cur.innerHTML = `${
            cur.innerHTML || ""
          }\n${nxt.innerHTML || ""}`;
        } else {
          cur.textContent = `${
            cur.textContent || ""
          }\n${nxt.textContent || ""}`;
        }

        const wipe = doc.createRange();
        wipe.setStartAfter(cur);
        wipe.setEndAfter(nxt);
        wipe.deleteContents();

        mergedAny = true;
        break;
      }
    }
  }

  //-----------------------------------
  // Output block styling (label + highlighted box)
  // — only when code detection is enabled, since
  //   off mode keeps everything as plain paragraphs.
  //-----------------------------------
  if (codeDetectionEnabled) {
    const outputParagraphs = Array.from(
      doc.querySelectorAll("p")
    ).filter(
      (p) => !p.closest("table")
    ) as HTMLElement[];

    for (
      let i = 0;
      i < outputParagraphs.length;
      i += 1
    ) {
      const label = outputParagraphs[i];

      if (!label.isConnected) continue;

      const labelText =
        label.textContent
          ?.trim()
          .toLowerCase() || "";

      if (
        labelText !== "output" &&
        labelText !== "output:"
      ) {
        continue;
      }

      label.style.fontWeight = "700";
      label.style.marginTop = "16px";
      label.style.marginBottom = "6px";

      const collectedLines: HTMLElement[] = [];
      let cursor = i + 1;

      while (cursor < outputParagraphs.length) {
        const candidate =
          outputParagraphs[cursor];

        if (!candidate.isConnected) {
          cursor += 1;
          continue;
        }

        const value =
          candidate.textContent?.trim() || "";

        if (!value) break;
        if (isCodeLikeLine(value)) break;
        if (value.length > 120) break;
        if (
          /^(example|syntax|input)\b/i.test(
            value
          )
        ) {
          break;
        }

        collectedLines.push(candidate);
        cursor += 1;
      }

      if (!collectedLines.length) continue;

      const outputBox =
        doc.createElement("pre");

      // Mark for the highlight strip-pass to skip.
      outputBox.setAttribute(
        "data-output-box",
        "true"
      );

      // Always plain text — Word/html-docx-js re-applies nested span
      // highlight/shading on export if we keep innerHTML.
      outputBox.textContent = collectedLines
        .map(
          (line) =>
            line.textContent?.trim() || ""
        )
        .join("\n");

      outputBox.style.background = codeBgValue;
      outputBox.style.border =
        "1px solid #e2e8f0";
      outputBox.style.borderRadius = "8px";
      outputBox.style.padding = "14px 16px";
      outputBox.style.marginBottom = "12px";
      outputBox.style.marginTop = "6px";
      outputBox.style.whiteSpace = "pre-wrap";
      outputBox.style.fontFamily = "monospace";
      outputBox.style.fontSize = "15px";
      outputBox.style.color = codeTextColor;
      outputBox.style.lineHeight = "1.6";
      outputBox.style.display = "block";
      outputBox.style.overflowX = "auto";
      outputBox.style.boxSizing = "border-box";
      outputBox.style.width = "100%";

      label.parentNode?.insertBefore(
        outputBox,
        label.nextSibling
      );

      collectedLines.forEach((line) =>
        line.remove()
      );
    }
  }

  //-----------------------------------
  // Existing pre/code styling (only when code
  // detection is enabled — otherwise keep Word
  // pre/code appearance).
  //-----------------------------------
  if (codeDetectionEnabled) {
  doc
    .querySelectorAll(
      "pre, code"
    )
    .forEach((el) => {
      const node =
        el as HTMLElement;

        node.style.background = codeBgValue;
        node.style.color = codeTextColor;
        node.style.border =
          "1px solid #e2e8f0";
      node.style.padding =
          "14px 16px";
      node.style.borderRadius =
          "8px";
      node.style.fontFamily =
        "monospace";
      node.style.fontSize =
          "15px";
      node.style.whiteSpace =
        "pre-wrap";
      node.style.display =
        "block";
      node.style.overflowX =
        "auto";
      node.style.marginBottom =
          "12px";
      node.style.lineHeight =
        "1.6";
    });
  }

  //-----------------------------------
  // Highlight mode: optionally strip all
  // inline colour/background-color styles
  // that came from the original document.
  //-----------------------------------
  if (styles.highlightMode === "remove") {
    doc
      .querySelectorAll("[style]")
      .forEach((el) => {
        const node = el as HTMLElement;

        const tag = node.tagName.toLowerCase();
        // Keep only the block wrapper's own styles
        // (code bg, padding, etc.). Strip colours on
        // all descendants including inside <pre>.
        if (tag === "pre" || tag === "code") {
          return;
        }
        if (
          node.getAttribute("data-output-box") ===
          "true"
        ) {
          return;
        }

        node.style.removeProperty("color");
        node.style.removeProperty(
          "background-color"
        );
        node.style.removeProperty(
          "background"
        );

        if (
          tag === "span" &&
          !node.getAttribute("style")?.trim()
        ) {
          node.replaceWith(
            ...Array.from(node.childNodes)
          );
        }
      });
  }

  //-----------------------------------
  // Horizontal rules from Word / HTML
  //-----------------------------------
  doc.querySelectorAll("hr").forEach((el) => {
    const node = el as HTMLElement;

    node.style.border = "none";
    node.style.borderTop = "1px solid #94a3b8";
    node.style.margin = "12px 0";
    node.style.height = "0";
    node.style.background = "transparent";
  });

  //-----------------------------------
  // Word / html-docx-js: shading on `<pre>` is often dropped when AltChunk
  // HTML is imported. A one-cell `<table>` keeps background + border in DOCX.
  // In-app preview skips this so HTML → blocks round-trip stays stable.
  //-----------------------------------
  if (
    codeDetectionEnabled &&
    options?.wrapPresForWord === true
  ) {
    const wrapCandidates =
      Array.from(
        doc.querySelectorAll("pre")
      ) as HTMLElement[];

    wrapCandidates.forEach((pre) => {
      if (
        !pre.parentNode ||
        pre.closest("td")
      ) {
        return;
      }

      const attr =
        pre.getAttribute("style") || "";

      const looksStyled =
        /background(?:-color)?\s*:/i.test(
          attr
        ) ||
        pre.getAttribute(
          "data-output-box"
        ) === "true";

      if (!looksStyled) {
        return;
      }

      const marginBottom =
        pre.style.marginBottom ||
        "12px";
      const marginTop =
        pre.style.marginTop || "0";

      const fill =
        pre.style.backgroundColor ||
        pre.style.background ||
        codeBgValue;
      const border =
        pre.style.border || "";
      const pad =
        pre.style.padding ||
        "14px 16px";
      const radius =
        pre.style.borderRadius ||
        "";

      const table =
        doc.createElement("table");

      table.style.borderCollapse =
        "collapse";
      table.style.width = "100%";
      table.style.marginBottom =
        marginBottom;
      table.style.marginTop =
        marginTop;

      const tr =
        doc.createElement("tr");
      const td =
        doc.createElement("td");

      td.style.backgroundColor =
        fill;
      if (border) {
        td.style.border = border;
      }
      td.style.padding = pad;
      if (radius) {
        td.style.borderRadius = radius;
      }
      td.style.verticalAlign =
        "top";

      const hexFill =
        /^#([0-9a-f]{6})$/i.exec(
          fill.trim()
        );
      if (hexFill) {
        td.setAttribute(
          "bgcolor",
          `#${hexFill[1]}`
        );
      }

      pre.style.marginBottom =
        "0";
      pre.style.marginTop = "0";
      pre.style.border = "none";
      pre.style.padding = "0";
      pre.style.background =
        "transparent";
      pre.style.backgroundColor =
        "transparent";
      pre.style.borderRadius =
        "0";

      pre.parentNode.insertBefore(
        table,
        pre
      );
      td.appendChild(pre);
      tr.appendChild(td);
      table.appendChild(tr);
    });
  }

  return doc.body.innerHTML;
};