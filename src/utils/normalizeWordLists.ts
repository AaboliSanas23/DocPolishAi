/**
 * Mammoth often emits real Word lists as `<ul>/<ol>/<li>`, but some DOCX files
 * still produce plain `<p>` nodes (manual bullets, paste, or unmappable list
 * styles). `extractBlocksFromHtml` only treats `<li>` as list rows, so we
 * normalize obvious list-like paragraph runs into `<ul>/<ol>` before parsing.
 */

const WRAPPER_TAGS = new Set([
  "div",
  "section",
  "article",
  "main",
  "blockquote",
  "header",
  "footer",
  "center",
  "aside",
  "figure",
]);

type ListParaKind =
  | "bulletUl"
  | "orderedOl"
  | "indentUl"
  | "pairedLeadUl";

/** Two Title Case words then colon + body, e.g. "Client Side: On the …". */
const MULTIWORD_TITLECASE_LEAD =
  /^[ \t]*(?:[A-Z][a-z]+(?: [A-Z][a-z]+)+):\s+\S/u;

/**
 * Word often emits pseudo-list rows as `<p><strong>Label:</strong> rest…</p>`
 * or plain paragraphs matching {@link MULTIWORD_TITLECASE_LEAD}.
 * Requires consecutive pairs (`pairedLeadUl`, minimum run length 2).
 */
const looksLikePairedLeadListParagraph = (
  el: HTMLElement
): boolean => {
  const text =
    (el.textContent || "").trim();

  if (
    MULTIWORD_TITLECASE_LEAD.test(text)
  ) {
    return true;
  }

  const first =
    el.firstElementChild;

  if (
    first &&
    /^(strong|b)$/i.test(
      first.tagName
    )
  ) {
    const label =
      (first.textContent || "").trim();

    if (
      /^[A-Za-z0-9][A-Za-z0-9\s-]{1,52}:$/.test(
        label
      ) &&
      text.length >
        label.length + 1
    ) {
      return true;
    }
  }

  return false;
};

type ParagraphListGuess = {
  kind: ListParaKind;
  indentSig: string;
} | null;

const parseCssLengthToPt = (
  raw: string
): number | null => {
  const m =
    raw
      .trim()
      .match(
        /^([\d.]+)\s*(pt|px|in|cm|mm|em|rem)$/i
      );

  if (!m) {
    return null;
  }

  const n =
    parseFloat(m[1]);

  if (Number.isNaN(n)) {
    return null;
  }

  const u =
    m[2].toLowerCase();

  switch (u) {
    case "pt":
      return n;
    case "px":
      return n * (72 / 96);
    case "in":
      return n * 72;
    case "cm":
      return n * 28.3465;
    case "mm":
      return n * 2.83465;
    case "em":
    case "rem":
      return n * 12;
    default:
      return null;
  }
};

const readLengthPt = (
  styleLower: string,
  prop: string
): number | null => {
  const re =
    new RegExp(
      `(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`,
      "i"
    );
  const m =
    styleLower.match(re);

  if (!m) {
    return null;
  }

  return parseCssLengthToPt(m[1].trim());
};

const normalizeIndentSignature = (
  el: HTMLElement
): string => {
  const style =
    (el.getAttribute("style") || "")
      .toLowerCase()
      .replace(/\s+/g, "");

  const extract = (
    name: string
  ) => {
    const mm =
      style.match(
        new RegExp(
          `${name}:([^;]+)`,
          "i"
        )
      );

    return mm
      ? mm[1].trim()
      : "";
  };

  const ml =
    extract("margin-left");
  const pl =
    extract("padding-left");

  return `${ml}|${pl}`;
};

const listishClass = (
  className: string
): boolean => {
  const c =
    className.toLowerCase();

  return (
    /\blistparagraph\b/.test(c) ||
    /\bmsolistparagraph\b/.test(c) ||
    /\bcxsp(first|middle|last)\b/.test(
      c
    )
  );
};

const classifyListParagraph = (
  el: HTMLElement
): ParagraphListGuess => {
  const cls =
    el.getAttribute("class") || "";
  const styleRaw =
    el.getAttribute("style") || "";
  const styleLower =
    styleRaw.toLowerCase();

  const text =
    (el.textContent || "").replace(
      /^\uFEFF/,
      ""
    );

  const bulletPrefix =
    /^\s*(?:[\u2022\u2023\u2219\u25AA\u25CF\u25E6\u00B7●○■□◦]\s|[*\-–—]\s|\uF0B7\s)/;

  if (bulletPrefix.test(text)) {
    return {
      kind: "bulletUl",
      indentSig: "",
    };
  }

  const orderedPrefix =
    /^\s*\d{1,3}[.)]\s+/;

  if (orderedPrefix.test(text)) {
    return {
      kind: "orderedOl",
      indentSig:
        normalizeIndentSignature(el),
    };
  }

  if (listishClass(cls)) {
    return {
      kind: "indentUl",
      indentSig:
        normalizeIndentSignature(el),
    };
  }

  const ml =
    readLengthPt(
      styleLower,
      "margin-left"
    );
  const pl =
    readLengthPt(
      styleLower,
      "padding-left"
    );
  const ti =
    readLengthPt(
      styleLower,
      "text-indent"
    );

  const baseIndent =
    ml ?? pl ?? null;

  if (
    baseIndent !== null &&
    baseIndent >= 14 &&
    ti !== null &&
    ti <= -8
  ) {
    return {
      kind: "indentUl",
      indentSig:
        normalizeIndentSignature(el),
    };
  }

  if (
    baseIndent !== null &&
    baseIndent >= 18
  ) {
    return {
      kind: "indentUl",
      indentSig:
        normalizeIndentSignature(el),
    };
  }

  if (
    looksLikePairedLeadListParagraph(el)
  ) {
    return {
      kind: "pairedLeadUl",
      indentSig:
        normalizeIndentSignature(el),
    };
  }

  return null;
};

const minRunForKind = (
  kind: ListParaKind,
  first: HTMLElement
): number => {
  if (
    kind === "bulletUl" ||
    kind === "orderedOl"
  ) {
    return 1;
  }

  if (kind === "pairedLeadUl") {
    return 2;
  }

  const cls =
    first.getAttribute("class") || "";

  if (listishClass(cls)) {
    return 1;
  }

  const styleLower =
    (
      first.getAttribute("style") || ""
    ).toLowerCase();
  const ml =
    readLengthPt(
      styleLower,
      "margin-left"
    );
  const pl =
    readLengthPt(
      styleLower,
      "padding-left"
    );
  const ti =
    readLengthPt(
      styleLower,
      "text-indent"
    );
  const base =
    ml ?? pl ?? null;

  if (
    base !== null &&
    base >= 14 &&
    ti !== null &&
    ti <= -8
  ) {
    return 1;
  }

  return 2;
};

const indentSigMustMatch = (
  kind: ListParaKind
): boolean => {
  return (
    kind === "indentUl" ||
    kind === "orderedOl" ||
    kind === "pairedLeadUl"
  );
};

const convertRunToList = (
  doc: Document,
  parent: HTMLElement,
  anchor: HTMLElement,
  run: HTMLElement[],
  kind: ListParaKind
) => {
  const listTag =
    kind === "orderedOl" ? "ol" : "ul";
  const listEl =
    doc.createElement(listTag);

  parent.insertBefore(listEl, anchor);

  for (const p of run) {
    const li =
      doc.createElement("li");
    li.innerHTML =
      p.innerHTML;
    listEl.appendChild(li);
    p.remove();
  }
};

const normalizeParagraphRunsUnder = (
  doc: Document,
  parent: HTMLElement
) => {
  let idx = 0;

  while (
    idx < parent.children.length
  ) {
    const child =
      parent.children[idx];

    if (
      !(child instanceof HTMLElement)
    ) {
      idx++;
      continue;
    }

    const tag =
      child.tagName.toLowerCase();

    if (WRAPPER_TAGS.has(tag)) {
      normalizeListsInElement(
        doc,
        child
      );
      idx++;
      continue;
    }

    if (tag !== "p") {
      idx++;
      continue;
    }

    const run: HTMLElement[] = [];
    let scan = idx;
    let expectedKind: ListParaKind | null =
      null;
    let indentSig = "";

    while (
      scan < parent.children.length
    ) {
      const node =
        parent.children[scan];

      if (
        !(node instanceof HTMLElement)
      ) {
        break;
      }

      if (
        node.tagName.toLowerCase() !==
        "p"
      ) {
        break;
      }

      const guess =
        classifyListParagraph(node);

      if (!guess) {
        break;
      }

      if (!run.length) {
        expectedKind = guess.kind;
        indentSig =
          guess.indentSig;
        run.push(node);
        scan++;
        continue;
      }

      if (
        guess.kind !== expectedKind
      ) {
        break;
      }

      if (
        indentSigMustMatch(
          expectedKind
        ) &&
        guess.indentSig !== indentSig
      ) {
        break;
      }

      run.push(node);
      scan++;
    }

    const kind =
      expectedKind;

    if (
      kind &&
      run.length >=
        minRunForKind(kind, run[0])
    ) {
      const anchor =
        run[0];

      convertRunToList(
        doc,
        parent,
        anchor,
        run,
        kind
      );

      continue;
    }

    idx++;
  }
};

function normalizeListsInElement(
  doc: Document,
  root: HTMLElement
) {
  normalizeParagraphRunsUnder(
    doc,
    root
  );
}

export const normalizeWordListsInHtml = (
  html: string
): string => {
  const parser =
    new DOMParser();
  const doc =
    parser.parseFromString(
      html,
      "text/html"
    );

  normalizeListsInElement(
    doc,
    doc.body
  );

  return doc.body.innerHTML;
};
