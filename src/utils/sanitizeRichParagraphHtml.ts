/**
 * Whitelist inline markup for paragraph/title/list blocks so DOCX paste and
 * contenteditable round-trip stay safe and predictable.
 */

const PHRASE_TAGS = new Set([
  "em",
  "i",
  "strong",
  "b",
  "u",
  "mark",
]);

const ALLOWED_STYLE_KEYS = new Set([
  "color",
  "background-color",
  "font-style",
  "font-weight",
  "text-decoration",
]);

const filterSpanStyleAttr = (
  styleAttr: string
): string | null => {
  const parts =
    styleAttr
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

  const kept: string[] = [];

  for (const part of parts) {
    const colon =
      part.indexOf(":");

    if (colon === -1) {
      continue;
    }

    const key =
      part
        .slice(0, colon)
        .trim()
        .toLowerCase();

    if (
      !ALLOWED_STYLE_KEYS.has(
        key
      )
    ) {
      continue;
    }

    kept.push(
      `${key}: ${part.slice(colon + 1).trim()}`
    );
  }

  return kept.length
    ? kept.join("; ")
    : null;
};

const unwrapElement = (
  el: Element
) => {
  const parent =
    el.parentNode;

  if (!parent) {
    return;
  }

  while (el.firstChild) {
    parent.insertBefore(
      el.firstChild,
      el
    );
  }

  parent.removeChild(el);
};

const normalizeFontElement = (
  el: HTMLElement,
  doc: Document
): HTMLElement => {
  const span =
    doc.createElement(
      "span"
    );
  const color =
    el.getAttribute(
      "color"
    );

  if (
    color &&
    color.trim()
  ) {
    span.style.color =
      color.trim();
  }

  while (el.firstChild) {
    span.appendChild(
      el.firstChild
    );
  }

  el.parentNode?.replaceChild(
    span,
    el
  );

  return span;
};

/**
 * Walk `root` in-place: unwrap disallowed tags; normalise span/font;
 * turn block-level div/p from contenteditable into `<br>` breaks.
 */
export const sanitizeRichParagraphHtml = (
  html: string
): string => {
  const trimmed =
    html.trim();

  if (!trimmed) {
    return "";
  }

  const parser =
    new DOMParser();
  const doc =
    parser.parseFromString(
      `<div>${trimmed}</div>`,
      "text/html"
    );
  const root =
    doc.body
      .firstElementChild as
      | HTMLElement
      | null;

  if (
    !root ||
    root.tagName.toLowerCase() !==
      "div"
  ) {
    return "";
  }

  let safety = 0;

  while (
    safety++ <
      5000
  ) {
    const candidates =
      root.querySelectorAll(
        "div, p"
      );
    const block =
      candidates[0];

    if (!block) {
      break;
    }

    const parent =
      block.parentNode as
      | HTMLElement
      | null;

    if (!parent) {
      break;
    }

    parent.insertBefore(
      doc.createElement(
        "br"
      ),
      block
    );
    unwrapElement(block);
  }

  const visit = (
    container: HTMLElement
  ) => {
    for (
      let ch =
        container.firstChild;
      ch !== null;

    ) {
      const next =
        ch.nextSibling;

      if (
        ch.nodeType ===
        Node.TEXT_NODE
      ) {
        ch = next!;
        continue;
      }

      if (
        ch.nodeType !==
        Node.ELEMENT_NODE
      ) {
        container.removeChild(
          ch
        );
        ch = next!;
        continue;
      }

      const el =
        ch as HTMLElement;
      const tag =
        el.tagName.toLowerCase();

      if (tag === "br") {
        ch = next!;
        continue;
      }

      if (tag === "font") {
        const span =
          normalizeFontElement(
            el,
            doc
          );
        visit(span);
        ch = next!;
        continue;
      }

      if (
        PHRASE_TAGS.has(
          tag
        )
      ) {
        el.removeAttribute(
          "class"
        );
        el.removeAttribute(
          "style"
        );
        visit(el);
        ch = next!;
        continue;
      }

      if (tag === "span") {
        const filtered =
          filterSpanStyleAttr(
            el.getAttribute(
              "style"
            ) || ""
          );

        el.removeAttribute(
          "class"
        );

        if (filtered) {
          el.setAttribute(
            "style",
            filtered
          );
        } else {
          el.removeAttribute(
            "style"
          );
        }

        visit(el);

        ch = next!;
        continue;
      }

      visit(el);
      unwrapElement(el);
      ch = next!;
    }
  };

  visit(root);

  return root.innerHTML;
};

/** Used when forcing sidebar paragraph typography (strip Word bold runs). */
export const stripBoldTagsFromRichHtml = (
  html: string
): string => {
  const clean =
    sanitizeRichParagraphHtml(
      html
    );

  if (!clean.trim()) {
    return "";
  }

  const parser =
    new DOMParser();
  const doc =
    parser.parseFromString(
      `<div>${clean}</div>`,
      "text/html"
    );
  const wrapper =
    doc.body
      .firstElementChild as
      | HTMLElement
      | null;

  if (!wrapper) {
    return "";
  }

  wrapper
    .querySelectorAll(
      "strong, b"
    )
    .forEach((boldEl) => {
      const parent =
        boldEl.parentNode;

      if (!parent) {
        return;
      }

      while (
        boldEl.firstChild
      ) {
        parent.insertBefore(
          boldEl.firstChild,
          boldEl
        );
      }

      parent.removeChild(
        boldEl
      );
    });

  return sanitizeRichParagraphHtml(
    wrapper.innerHTML
  );
};

export const elementHasInlineRichMarkup = (
  el: Element
): boolean => {
  if (
    el.querySelector(
      "em, i, strong, b, u, mark"
    )
  ) {
    return true;
  }

  if (
    el.querySelector(
      "font[color]"
    )
  ) {
    return true;
  }

  const styledSpans =
    Array.from(
      el.querySelectorAll(
        "span[style], font[style]"
      )
    );

  for (
    let si = 0;
    si < styledSpans.length;
    si += 1
  ) {
    const node =
      styledSpans[si];
    const st =
      (
        node.getAttribute(
          "style"
        ) || ""
      )
        .toLowerCase()
        .replace(
          /\s+/g,
          ""
        );

    if (
      /font-style:italic/.test(
        st
      )
    ) {
      return true;
    }

    if (
      /font-weight:(bold|700|[6-9]\d{2})/.test(
        st
      )
    ) {
      return true;
    }

    if (
      /text-decoration[^:]*underline/.test(
        st
      )
    ) {
      return true;
    }

    if (/color:/.test(st)) {
      return true;
    }

    if (
      /background(?:-color)?:/.test(
        st
      )
    ) {
      return true;
    }
  }

  return false;
};
