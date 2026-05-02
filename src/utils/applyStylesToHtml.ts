import {
  isCodeLikeLine,
  isLikelyCodeBridgeLine,
} from "./codeDetection";
import { StyleConfig } from "../types/style";

export const applyStylesToHtml = (
  html: string,
  styles: StyleConfig
) => {
  const parser = new DOMParser();

  const doc = parser.parseFromString(
    html,
    "text/html"
  );

  //-----------------------------------
  // FIX 1: Convert fake paragraph tables
  // into real HTML tables
  //-----------------------------------
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
      "12px";
    node.style.background =
      "#f3f4f6";
    node.style.fontWeight =
      "bold";
    node.style.textAlign =
      "left";
    node.style.fontFamily =
      styles.fontFamily;
    node.style.fontSize = `${styles.paragraphSize}px`;
  });

  doc.querySelectorAll("td").forEach((td) => {
    const node =
      td as HTMLElement;

    node.style.border =
      "1px solid #d1d5db";
    node.style.padding =
      "12px";
    node.style.textAlign =
      "left";
    node.style.fontFamily =
      styles.fontFamily;
    node.style.fontSize = `${styles.paragraphSize}px`;
  });

  //-----------------------------------
  // Split mixed paragraphs
  //-----------------------------------
  const paragraphNodes = Array.from(
    doc.querySelectorAll("p")
  );

  paragraphNodes.forEach((paragraph) => {
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

    const hasProse = lines.some(
      (line) => !isCodeLikeLine(line)
    );

    if (!hasCode || !hasProse) {
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

  //-----------------------------------
  // TITLE
  //-----------------------------------
  doc.querySelectorAll("h1").forEach((el) => {
    const node =
      el as HTMLElement;

    node.style.fontSize = `${styles.titleSize}px`;
    node.style.fontWeight =
      "bold";
    node.style.fontFamily =
      styles.fontFamily;
    node.style.marginBottom =
      `${styles.paragraphSpacing + 6}px`;
    node.style.lineHeight =
      String(styles.titleLineHeight);
  });

  //-----------------------------------
  // SUBTITLE
  //-----------------------------------
  doc
    .querySelectorAll("h2,h3")
    .forEach((el) => {
      const node =
        el as HTMLElement;

      node.style.fontSize = `${styles.subtitleSize}px`;
      node.style.fontWeight =
        "bold";
      node.style.fontFamily =
        styles.fontFamily;
      node.style.marginTop =
        "20px";
      node.style.marginBottom =
        `${styles.paragraphSpacing + 2}px`;
      node.style.lineHeight =
        String(styles.subtitleLineHeight);
    });

  //-----------------------------------
  // Paragraph styling
  //-----------------------------------
  doc.querySelectorAll("p").forEach((el) => {
    const node =
      el as HTMLElement;

    node.style.fontSize = `${styles.paragraphSize}px`;
    node.style.fontFamily =
      styles.fontFamily;
    node.style.lineHeight =
      String(styles.paragraphLineHeight);
    node.style.marginBottom =
      `${styles.paragraphSpacing}px`;
  });

  //-----------------------------------
  // List styling
  //-----------------------------------
  doc.querySelectorAll("li").forEach((el) => {
    const node =
      el as HTMLElement;

    node.style.fontSize = `${styles.paragraphSize}px`;
    node.style.fontFamily =
      styles.fontFamily;
    node.style.lineHeight =
      String(styles.paragraphLineHeight);
  });

  //-----------------------------------
  // Smart code detection
  //-----------------------------------
  const paragraphs = Array.from(
    doc.querySelectorAll("p")
  );

  let currentCodeGroup:
    HTMLElement[] = [];

  let insideCodeBlock =
    false;

  const createCodeBlock = (
    group: HTMLElement[]
  ) => {
    if (!group.length) return;

    const combinedText =
      group
        .map(
          (item) =>
            item.textContent?.trim() ||
            ""
        )
        .join("\n");

    const pre =
      doc.createElement("pre");

    pre.textContent =
      combinedText;

    pre.style.background =
      "#07152f";
    pre.style.color =
      "#4ade80";
    pre.style.padding =
      "20px";
    pre.style.borderRadius =
      "12px";
    pre.style.fontFamily =
      "monospace";
    pre.style.fontSize =
      "14px";
    pre.style.whiteSpace =
      "pre-wrap";
    pre.style.display =
      "block";
    pre.style.overflowX =
      "auto";
    pre.style.marginBottom =
      "20px";
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
        isCodeLikeLine(text) &&
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
          );

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
          isLikelyCodeBridgeLine(
            text
          )
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
  // Existing pre/code styling
  //-----------------------------------
  doc
    .querySelectorAll(
      "pre, code"
    )
    .forEach((el) => {
      const node =
        el as HTMLElement;

      node.style.background =
        "#07152f";
      node.style.color =
        "#4ade80";
      node.style.padding =
        "20px";
      node.style.borderRadius =
        "12px";
      node.style.fontFamily =
        "monospace";
      node.style.fontSize =
        "14px";
      node.style.whiteSpace =
        "pre-wrap";
      node.style.display =
        "block";
      node.style.overflowX =
        "auto";
      node.style.marginBottom =
        "20px";
      node.style.lineHeight =
        "1.6";
    });

  return doc.body.innerHTML;
};