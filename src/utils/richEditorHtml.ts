import type { DocumentBlock } from "../types/document";
import { sanitizeRichParagraphHtml } from "./sanitizeRichParagraphHtml";

const escapeHtmlText = (
  text: string
): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * HTML shown inside the rich paragraph editor (contenteditable).
 */
export const blockToRichEditorHtml = (
  block: DocumentBlock
): string => {
  if (
    block.inlineHtml?.trim()
  ) {
    return block.inlineHtml.trim();
  }

  const esc =
    escapeHtmlText(
      block.text
    ).replace(
      /\n/g,
      "<br>"
    );

  if (!esc) {
    return "<br>";
  }

  let inner =
    esc;

  if (block.isUnderline) {
    inner = `<u>${inner}</u>`;
  }

  if (block.isItalic) {
    inner = `<em>${inner}</em>`;
  }

  if (block.isBold) {
    inner = `<strong>${inner}</strong>`;
  }

  return inner;
};

const hasStructuralInlineMarkup = (
  html: string
): boolean =>
  /<(?:em|i|strong|b|u|mark|span|br)\b/i.test(
    html
  );

export const commitRichEditorPayload = (
  rawHtml: string,
  plain: string
): Pick<
  DocumentBlock,
  | "text"
  | "inlineHtml"
  | "isBold"
  | "isItalic"
  | "isUnderline"
> => {
  const sanitized =
    sanitizeRichParagraphHtml(
      rawHtml
    );

  const text =
    plain.trim();

  if (
    !hasStructuralInlineMarkup(
      sanitized
    ) ||
    !sanitized.trim()
  ) {
    return {
      text,
      inlineHtml:
        undefined,
      isBold: false,
      isItalic: false,
      isUnderline: false,
    };
  }

  return {
    text,
    inlineHtml:
      sanitized.trim(),
    isBold: false,
    isItalic: false,
    isUnderline: false,
  };
};

const fontWeightMeansBold = (
  value: string
): boolean => {
  const v =
    value.trim().toLowerCase();

  if (
    v === "bold" ||
    v === "bolder"
  ) {
    return true;
  }

  const n =
    Number.parseInt(
      v,
      10
    );

  return (
    Number.isFinite(n) &&
    n >= 600
  );
};

/** True if this element applies bold (semantic tags or bold font-weight on span/font). */
const elementContributesBold = (
  el: Element
): boolean => {
  const tag =
    el.tagName.toLowerCase();

  if (
    tag === "strong" ||
    tag === "b"
  ) {
    return true;
  }

  if (
    tag !== "span" &&
    tag !== "font"
  ) {
    return false;
  }

  const styleAttr =
    el.getAttribute(
      "style"
    ) ?? "";

  for (const part of styleAttr
    .split(";")
    .map((s) =>
      s.trim()
    )
    .filter(Boolean)) {
    const colon =
      part.indexOf(":");

    if (colon === -1) {
      continue;
    }

    const key =
      part
        .slice(
          0,
          colon
        )
        .trim()
        .toLowerCase();

    if (
      key !==
      "font-weight"
    ) {
      continue;
    }

    const val =
      part
        .slice(
          colon +
            1
        )
        .trim();

    return fontWeightMeansBold(
      val
    );
  }

  return false;
};

/** Every non-empty text node sits under some bold styling within `container`. */
const richInlineSubtreeFullyBold = (
  container: Element
): boolean => {
  const doc =
    container.ownerDocument;

  const walker =
    doc.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

  let sawNonEmpty =
    false;

  let node =
    walker.nextNode();

  while (node) {
    const text =
      node.textContent ??
      "";

    if (
      !text.trim()
    ) {
      node =
        walker.nextNode();

      continue;
    }

    sawNonEmpty =
      true;

    let el =
      node.parentElement;

    let underBold =
      false;

    while (
      el &&
      container.contains(
        el
      )
    ) {
      if (
        elementContributesBold(
          el
        )
      ) {
        underBold =
          true;

        break;
      }

      el =
        el.parentElement;
    }

    if (!underBold) {
      return false;
    }

    node =
      walker.nextNode();
  }

  return sawNonEmpty;
};

/** Strip outer bold from a lone span whose styles include bold font-weight (keeps colour etc.). */
const stripOuterBoldFontWeightSpan = (
  el: Element
): string | null => {
  if (
    !/^span$/i.test(
      el.tagName
    )
  ) {
    return null;
  }

  const styleAttr =
    el.getAttribute(
      "style"
    ) ?? "";

  const parts =
    styleAttr
      .split(";")
      .map((s) =>
        s.trim()
      )
      .filter(Boolean);

  const kept: string[] =
    [];
  let hadBoldWeight =
    false;

  for (const part of parts) {
    const colon =
      part.indexOf(":");

    if (colon === -1) {
      continue;
    }

    const key =
      part
        .slice(
          0,
          colon
        )
        .trim()
        .toLowerCase();

    const val =
      part
        .slice(
          colon +
            1
        )
        .trim();

    if (
      key ===
      "font-weight"
    ) {
      if (
        fontWeightMeansBold(
          val
        )
      ) {
        hadBoldWeight =
          true;
      }

      continue;
    }

    kept.push(
      `${key}: ${val}`
    );
  }

  if (!hadBoldWeight) {
    return null;
  }

  const inner =
    sanitizeRichParagraphHtml(
      el.innerHTML
    );

  if (
    kept.length ===
    0
  ) {
    return inner;
  }

  return sanitizeRichParagraphHtml(
    `<span style="${kept.join(
      "; "
    )}">${inner}</span>`
  );
};

const unwrapOuterBoldOnce = (
  html: string
): string => {
  const cleaned =
    sanitizeRichParagraphHtml(
      html
    ).trim();

  if (!cleaned) {
    return cleaned;
  }

  const doc =
    new DOMParser().parseFromString(
      `<div>${cleaned}</div>`,
      "text/html"
    );
  const root =
    doc.body.firstElementChild;

  if (!root) {
    return cleaned;
  }

  const meaningful =
    Array.from(
      root.childNodes
    ).filter(
      (n) =>
        n.nodeType ===
          Node.ELEMENT_NODE ||
        (n.nodeType ===
          Node.TEXT_NODE &&
          (n.textContent ||
            "").trim()
            .length > 0)
    );

  if (
    meaningful.length !==
      1 ||
    meaningful[0].nodeType !==
      Node.ELEMENT_NODE
  ) {
    return cleaned;
  }

  const el =
    meaningful[0] as Element;

  if (
    /^strong|b$/i.test(
      el.tagName
    )
  ) {
    return sanitizeRichParagraphHtml(
      el.innerHTML
    );
  }

  const spanStripped =
    stripOuterBoldFontWeightSpan(
      el
    );

  if (
    spanStripped !== null
  ) {
    return spanStripped;
  }

  return cleaned;
};

/** Strip stacked outer bold wrappers (nested strong or bold spans). */
const unwrapOuterBoldRepeated = (
  html: string
): string => {
  let cur =
    sanitizeRichParagraphHtml(
      html
    ).trim();

  for (
    let i =
      0;
    i <
      28;
    i++
  ) {
    const next =
      unwrapOuterBoldOnce(
        cur
      );

    if (
      next ===
      cur
    ) {
      break;
    }

    cur =
      next;
  }

  return cur;
};

const unwrapOuterItalicOnce = (
  html: string
): string => {
  const cleaned =
    sanitizeRichParagraphHtml(
      html
    ).trim();

  if (!cleaned) {
    return cleaned;
  }

  const doc =
    new DOMParser().parseFromString(
      `<div>${cleaned}</div>`,
      "text/html"
    );
  const root =
    doc.body.firstElementChild;

  if (!root) {
    return cleaned;
  }

  const meaningful =
    Array.from(
      root.childNodes
    ).filter(
      (n) =>
        n.nodeType ===
          Node.ELEMENT_NODE ||
        (n.nodeType ===
          Node.TEXT_NODE &&
          (n.textContent ||
            "").trim()
            .length > 0)
    );

  if (
    meaningful.length !==
      1 ||
    meaningful[0].nodeType !==
      Node.ELEMENT_NODE
  ) {
    return cleaned;
  }

  const el =
    meaningful[0] as Element;

  if (
    !/^em|i$/i.test(
      el.tagName
    )
  ) {
    return cleaned;
  }

  return sanitizeRichParagraphHtml(
    el.innerHTML
  );
};

const unwrapOuterUnderlineOnce = (
  html: string
): string => {
  const cleaned =
    sanitizeRichParagraphHtml(
      html
    ).trim();

  if (!cleaned) {
    return cleaned;
  }

  const doc =
    new DOMParser().parseFromString(
      `<div>${cleaned}</div>`,
      "text/html"
    );
  const root =
    doc.body.firstElementChild;

  if (!root) {
    return cleaned;
  }

  const meaningful =
    Array.from(
      root.childNodes
    ).filter(
      (n) =>
        n.nodeType ===
          Node.ELEMENT_NODE ||
        (n.nodeType ===
          Node.TEXT_NODE &&
          (n.textContent ||
            "").trim()
            .length > 0)
    );

  if (
    meaningful.length !==
      1 ||
    meaningful[0].nodeType !==
      Node.ELEMENT_NODE
  ) {
    return cleaned;
  }

  const el =
    meaningful[0] as Element;

  if (
    !/^u$/i.test(
      el.tagName
    )
  ) {
    return cleaned;
  }

  return sanitizeRichParagraphHtml(
    el.innerHTML
  );
};

/** Whether bulk Bold All considers this block fully bold (flags or outer strong/b). */
export const blockLooksGloballyBold = (
  block: DocumentBlock
): boolean => {
  if (
    block.type === "table" ||
    block.type === "code"
  ) {
    return false;
  }

  if (
    !block.inlineHtml?.trim()
  ) {
    return !!block.isBold;
  }

  const cleaned =
    sanitizeRichParagraphHtml(
      block.inlineHtml
    ).trim();

  if (!cleaned) {
    return false;
  }

  const doc =
    new DOMParser().parseFromString(
      `<div>${cleaned}</div>`,
      "text/html"
    );
  const root =
    doc.body.firstElementChild;

  if (!root) {
    return false;
  }

  const meaningful =
    Array.from(
      root.childNodes
    ).filter(
      (n) =>
        n.nodeType ===
          Node.ELEMENT_NODE ||
        (n.nodeType ===
          Node.TEXT_NODE &&
          (n.textContent ||
            "").trim()
            .length > 0)
    );

  if (
    meaningful.length ===
      1 &&
    meaningful[0].nodeType ===
      Node.ELEMENT_NODE
  ) {
    const outer =
      meaningful[0] as Element;

    if (
      elementContributesBold(
        outer
      )
    ) {
      return true;
    }
  }

  return richInlineSubtreeFullyBold(
    root
  );
};

/** Whole-block italic: flags or exactly one outer em/i wrapping everything. */
export const blockLooksGloballyItalic = (
  block: DocumentBlock
): boolean => {
  if (
    block.type === "table" ||
    block.type === "code"
  ) {
    return false;
  }

  if (
    !block.inlineHtml?.trim()
  ) {
    return !!block.isItalic;
  }

  const cleaned =
    sanitizeRichParagraphHtml(
      block.inlineHtml
    ).trim();

  if (!cleaned) {
    return false;
  }

  const doc =
    new DOMParser().parseFromString(
      `<div>${cleaned}</div>`,
      "text/html"
    );
  const root =
    doc.body.firstElementChild;

  if (!root) {
    return false;
  }

  const meaningful =
    Array.from(
      root.childNodes
    ).filter(
      (n) =>
        n.nodeType ===
          Node.ELEMENT_NODE ||
        (n.nodeType ===
          Node.TEXT_NODE &&
          (n.textContent ||
            "").trim()
            .length > 0)
    );

  if (
    meaningful.length !==
      1 ||
    meaningful[0].nodeType !==
      Node.ELEMENT_NODE
  ) {
    return false;
  }

  return /^em|i$/i.test(
    (
      meaningful[0] as Element
    ).tagName
  );
};

/** Whole-block underline: flags or exactly one outer u wrapping everything. */
export const blockLooksGloballyUnderline = (
  block: DocumentBlock
): boolean => {
  if (
    block.type === "table" ||
    block.type === "code"
  ) {
    return false;
  }

  if (
    !block.inlineHtml?.trim()
  ) {
    return !!block.isUnderline;
  }

  const cleaned =
    sanitizeRichParagraphHtml(
      block.inlineHtml
    ).trim();

  if (!cleaned) {
    return false;
  }

  const doc =
    new DOMParser().parseFromString(
      `<div>${cleaned}</div>`,
      "text/html"
    );
  const root =
    doc.body.firstElementChild;

  if (!root) {
    return false;
  }

  const meaningful =
    Array.from(
      root.childNodes
    ).filter(
      (n) =>
        n.nodeType ===
          Node.ELEMENT_NODE ||
        (n.nodeType ===
          Node.TEXT_NODE &&
          (n.textContent ||
            "").trim()
            .length > 0)
    );

  if (
    meaningful.length !==
      1 ||
    meaningful[0].nodeType !==
      Node.ELEMENT_NODE
  ) {
    return false;
  }

  return /^u$/i.test(
    (
      meaningful[0] as Element
    ).tagName
  );
};

export const applyBoldAllToBlock = (
  block: DocumentBlock,
  boldOn: boolean
): DocumentBlock => {
  if (
    block.type === "table" ||
    block.type === "code"
  ) {
    return block;
  }

  if (
    !block.inlineHtml?.trim()
  ) {
    return {
      ...block,
      isBold: boldOn,
    };
  }

  if (boldOn) {
    let inner =
      unwrapOuterBoldOnce(
        block.inlineHtml
      );
    inner =
      sanitizeRichParagraphHtml(
        inner
      );
    const wrapped =
      sanitizeRichParagraphHtml(
        `<strong>${inner}</strong>`
      );

    const plainDoc =
      new DOMParser().parseFromString(
        `<div>${wrapped}</div>`,
        "text/html"
      );

    const plain =
      plainDoc.body.textContent ??
      "";

    return {
      ...block,
      ...commitRichEditorPayload(
        wrapped,
        plain
      ),
    };
  }

  const inner =
    unwrapOuterBoldRepeated(
      block.inlineHtml
    );

  const plainDoc =
    new DOMParser().parseFromString(
      `<div>${inner}</div>`,
      "text/html"
    );

  const plain =
    plainDoc.body.textContent ??
    block.text;

  return {
    ...block,
    ...commitRichEditorPayload(
      inner,
      plain
    ),
  };
};

export const applyItalicAllToBlock = (
  block: DocumentBlock,
  italicOn: boolean
): DocumentBlock => {
  if (
    block.type === "table" ||
    block.type === "code"
  ) {
    return block;
  }

  if (
    !block.inlineHtml?.trim()
  ) {
    return {
      ...block,
      isItalic: italicOn,
    };
  }

  if (italicOn) {
    let inner =
      unwrapOuterItalicOnce(
        block.inlineHtml
      );
    inner =
      sanitizeRichParagraphHtml(
        inner
      );
    const wrapped =
      sanitizeRichParagraphHtml(
        `<em>${inner}</em>`
      );

    const plainDoc =
      new DOMParser().parseFromString(
        `<div>${wrapped}</div>`,
        "text/html"
      );

    const plain =
      plainDoc.body.textContent ??
      "";

    return {
      ...block,
      ...commitRichEditorPayload(
        wrapped,
        plain
      ),
    };
  }

  const inner =
    unwrapOuterItalicOnce(
      block.inlineHtml
    );

  const plainDoc =
    new DOMParser().parseFromString(
      `<div>${inner}</div>`,
      "text/html"
    );

  const plain =
    plainDoc.body.textContent ??
    block.text;

  return {
    ...block,
    ...commitRichEditorPayload(
      inner,
      plain
    ),
  };
};

export const applyUnderlineAllToBlock = (
  block: DocumentBlock,
  underlineOn: boolean
): DocumentBlock => {
  if (
    block.type === "table" ||
    block.type === "code"
  ) {
    return block;
  }

  if (
    !block.inlineHtml?.trim()
  ) {
    return {
      ...block,
      isUnderline: underlineOn,
    };
  }

  if (underlineOn) {
    let inner =
      unwrapOuterUnderlineOnce(
        block.inlineHtml
      );
    inner =
      sanitizeRichParagraphHtml(
        inner
      );
    const wrapped =
      sanitizeRichParagraphHtml(
        `<u>${inner}</u>`
      );

    const plainDoc =
      new DOMParser().parseFromString(
        `<div>${wrapped}</div>`,
        "text/html"
      );

    const plain =
      plainDoc.body.textContent ??
      "";

    return {
      ...block,
      ...commitRichEditorPayload(
        wrapped,
        plain
      ),
    };
  }

  const inner =
    unwrapOuterUnderlineOnce(
      block.inlineHtml
    );

  const plainDoc =
    new DOMParser().parseFromString(
      `<div>${inner}</div>`,
      "text/html"
    );

  const plain =
    plainDoc.body.textContent ??
    block.text;

  return {
    ...block,
    ...commitRichEditorPayload(
      inner,
      plain
    ),
  };
};
