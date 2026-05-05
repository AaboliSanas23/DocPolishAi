const VARIABLE_DECLARATION_REGEX =
  /^(const|let|var)\s+[a-zA-Z_$][\w$]*/;
const FUNCTION_DECLARATION_REGEX =
  /^(async\s+)?function\b.*\(/;
const CLASS_DECLARATION_REGEX = /^class\s+[a-zA-Z_$][\w$]*/;
const MODULE_STATEMENT_REGEX = /^(import|export)\b/;
const TRY_CATCH_FINALLY_REGEX =
  /^(try|catch|finally)\b/;
const CONTROL_FLOW_STATEMENT_REGEX =
  /\b(if|for|while|switch)\s*\(/;
const RETURN_STATEMENT_REGEX = /^\s*return\b[^.]*;?$/;

const EXACT_NON_CODE_WORDS = new Set([
  "output",
  "output:",
  "example",
  "example:",
  "result",
  "result:",
  "syntax",
  "syntax:",
  "parameters",
  "parameter",
  "returns",
  "description",
  "arguments",
  "argument",
]);

/** Single-line API / tutorial section labels — never code continuations. */
const DOC_SECTION_HEADING_EXACT = new Set([
  "parameters",
  "parameter",
  "syntax",
  "returns",
  "description",
  "arguments",
  "argument",
  "examples",
  "usage",
  "remarks",
  "properties",
  "methods",
  "constructor",
  "overview",
  "summary",
  "introduction",
  "prerequisites",
  "see also",
  "notes",
  "note",
  "inputs",
  "outputs",
  "output",
  "values",
  "options",
  "errors",
  "throws",
  "inheritance",
  "definition",
  "definitions",
  "details",
]);

export const normalizeCodeText = (text: string) =>
  text.replace(/\u00A0/g, " ").trim();

/** Count `` ` `` characters not preceded by `\` (JS template literals). */
export const countUnescapedBackticks = (
  line: string
): number => {
  let count = 0;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === "`" && line[i - 1] !== "\\") {
      count += 1;
    }
  }
  return count;
};

export const isDocSectionHeadingLine = (
  text: string
): boolean => {
  const cleaned = normalizeCodeText(text);
  if (!cleaned) {
    return false;
  }

  const t = cleaned.toLowerCase();

  if (DOC_SECTION_HEADING_EXACT.has(t)) {
    return true;
  }

  if (
    /^\[[\w\s]+\]:\s*$/i.test(cleaned) ||
    /^example\s*\d+\s*:\s*$/i.test(t) ||
    /^example\s*:\s*$/i.test(t)
  ) {
    return true;
  }

  if (
    /^see\s+also\b/i.test(cleaned) &&
    cleaned.length < 60
  ) {
    return true;
  }

  return false;
};

const BRACKET_ONLY_LINES = new Set([
  "{",
  "}",
  "[",
  "]",
  "(",
  ")",
  "];",
  "};",
  ");",
]);

const ASSIGNMENT_REGEX = /^[a-zA-Z_$][\w$]*\s*=[^=]/;
// Simple function call: foo(args);
const FUNCTION_CALL_REGEX = /^[a-zA-Z_$][\w$]*\([^)]*\);?$/;
// Chained / method call: console.log(args); obj.method.call(args);
const METHOD_CALL_REGEX =
  /^[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)+\([^)]*\);?$/;

const INLINE_SYMBOL_REGEX = /[{}[\];]|=>|::|===|!==|\+\+|--/;

const PROSE_SENTENCE_REGEX = /^[A-Z][^{}[\];]*[.?!]$/;
const REGEX_LITERAL_REGEX = /^\/.+\/[gimsuy]*$/;
const REGEX_TABLE_TOKEN_REGEX = /^\[\^?[A-Za-z0-9-]+\]$/;
const REGEX_ALTERNATION_TOKEN_REGEX = /^\([A-Za-z0-9]+\|[A-Za-z0-9]+\)$/;
const REGEX_ESCAPE_TOKEN_REGEX = /^\\[nrtvfb0dswDSWbB]$/;

export const isCodeLikeLine = (text: string): boolean => {
  const cleaned = normalizeCodeText(text);

  if (!cleaned) {
    return false;
  }

  if (EXACT_NON_CODE_WORDS.has(cleaned.toLowerCase())) {
    return false;
  }

  if (cleaned.startsWith("//") || cleaned.startsWith("/*")) {
    return true;
  }

  if (BRACKET_ONLY_LINES.has(cleaned)) {
    return true;
  }

  if (REGEX_LITERAL_REGEX.test(cleaned)) {
    return true;
  }

  // Standalone regex reference tokens in tables are not code snippets.
  if (
    REGEX_TABLE_TOKEN_REGEX.test(cleaned) ||
    REGEX_ALTERNATION_TOKEN_REGEX.test(cleaned) ||
    REGEX_ESCAPE_TOKEN_REGEX.test(cleaned)
  ) {
    return false;
  }

  if (
    ASSIGNMENT_REGEX.test(cleaned) ||
    FUNCTION_CALL_REGEX.test(cleaned) ||
    METHOD_CALL_REGEX.test(cleaned)
  ) {
    return true;
  }

  if (
    VARIABLE_DECLARATION_REGEX.test(cleaned) ||
    FUNCTION_DECLARATION_REGEX.test(cleaned) ||
    CLASS_DECLARATION_REGEX.test(cleaned) ||
    MODULE_STATEMENT_REGEX.test(cleaned) ||
    TRY_CATCH_FINALLY_REGEX.test(cleaned)
  ) {
    return true;
  }

  if (CONTROL_FLOW_STATEMENT_REGEX.test(cleaned)) {
    return true;
  }

  if (RETURN_STATEMENT_REGEX.test(cleaned)) {
    return true;
  }

  const words = cleaned.split(/\s+/);
  const looksLikeLongProse = words.length >= 7;

  if (looksLikeLongProse && PROSE_SENTENCE_REGEX.test(cleaned)) {
    return false;
  }

  if (
    INLINE_SYMBOL_REGEX.test(cleaned) &&
    !PROSE_SENTENCE_REGEX.test(cleaned) &&
    !looksLikeLongProse
  ) {
    return true;
  }

  return false;
};

export const isLikelyCodeBridgeLine = (text: string): boolean => {
  const cleaned = normalizeCodeText(text);

  if (!cleaned || cleaned.length > 80) {
    return false;
  }

  if (isDocSectionHeadingLine(cleaned)) {
    return false;
  }

  if (isCodeLikeLine(cleaned)) {
    return true;
  }

  const hasCodeCharacters = /[{}[\]();=]/.test(cleaned);
  const hasFewWords = cleaned.split(/\s+/).length <= 8;

  return hasCodeCharacters && hasFewWords && !PROSE_SENTENCE_REGEX.test(cleaned);
};

export const isSoftCodeContinuationLine = (
  text: string
): boolean => {
  const cleaned = normalizeCodeText(text);

  if (!cleaned) {
    return false;
  }

  if (EXACT_NON_CODE_WORDS.has(cleaned.toLowerCase())) {
    return false;
  }

  if (isDocSectionHeadingLine(cleaned)) {
    return false;
  }

  const words = cleaned.split(/\s+/);

  if (words.length > 8 || cleaned.length > 45) {
    return false;
  }

  if (/[.!?]$/.test(cleaned)) {
    return false;
  }

  return /^[a-zA-Z0-9_'"\- ]+$/.test(cleaned);
};
