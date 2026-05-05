import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import type { CSSProperties } from "react";

export type RichParagraphFieldHandle = {
  focus: () => void;
  applyCommand: (
    command:
      | "bold"
      | "italic"
      | "underline"
  ) => void;
  /** Root contenteditable element (for selection-aware toolbar actions). */
  getEditableRoot: () => HTMLDivElement | null;
};

type Props = {
  html: string;
  outerStyle: CSSProperties;
  className?: string;
  onCommit: (
    innerHtml: string,
    plainText: string
  ) => void;
};

const RichParagraphField = forwardRef<
  RichParagraphFieldHandle,
  Props
>(
  (
    {
      html,
      outerStyle,
      className,
      onCommit,
    },
    ref
  ) => {
    const divRef =
      useRef<HTMLDivElement>(
        null
      );

    const onCommitRef =
      useRef(onCommit);

    useEffect(() => {
      onCommitRef.current =
        onCommit;
    }, [onCommit]);

    const flush =
      () => {
        const el =
          divRef.current;

        if (!el) {
          return;
        }

        onCommitRef.current(
          el.innerHTML,
          el.textContent ??
            ""
        );
      };

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          divRef.current?.focus();
        },
        getEditableRoot: () =>
          divRef.current,
        applyCommand: (
          command
        ) => {
          const el =
            divRef.current;

          if (!el) {
            return;
          }

          el.focus();
          document.execCommand(
            command,
            false
          );
          flush();
        },
      }),
      []
    );

    useLayoutEffect(() => {
      const el =
        divRef.current;

      if (
        !el ||
        document.activeElement ===
          el
      ) {
        return;
      }

      if (
        el.innerHTML !==
        html
      ) {
        el.innerHTML =
          html;
      }
    }, [html]);

    return (
      <div
        ref={divRef}
        className={
          className
        }
        contentEditable
        spellCheck
        suppressContentEditableWarning
        role="textbox"
        aria-multiline={
          true
        }
        style={
          outerStyle
        }
        onInput={
          flush
        }
        onBlur={
          flush
        }
      />
    );
  }
);

RichParagraphField.displayName =
  "RichParagraphField";

export default RichParagraphField;
