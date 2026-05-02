const STRONG_CODE_KEYWORD_REGEX =
  /\b(function|const|let|var|class|import|export|async|await|try|catch|finally)\b/;
const CONTROL_FLOW_KEYWORD_REGEX =
  /\b(return|if|for|while|switch)\b/;

const EXACT_NON_CODE_WORDS = new Set([
  "output",
  "output:",
  "example",
  "example:",
  "result",
  "result:",
  "syntax",
  "syntax:",
]);

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
const FUNCTION_CALL_REGEX = /^[a-zA-Z_$][\w$]*\([^)]*\);?$/;

const INLINE_SYMBOL_REGEX = /[{}[\];]|=>|::|===|!==|\+\+|--/;

const PROSE_SENTENCE_REGEX = /^[A-Z][^{}[\];]*[.?!]$/;
const REGEX_LITERAL_REGEX = /^\/.+\/[gimsuy]*$/;
const REGEX_TABLE_TOKEN_REGEX = /^\[\^?[A-Za-z0-9-]+\]$/;
const REGEX_ALTERNATION_TOKEN_REGEX = /^\([A-Za-z0-9]+\|[A-Za-z0-9]+\)$/;
const REGEX_ESCAPE_TOKEN_REGEX = /^\\[nrtvfb0dswDSWbB]$/;

export const normalizeCodeText = (text: string) => text.trim();

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

  if (ASSIGNMENT_REGEX.test(cleaned) || FUNCTION_CALL_REGEX.test(cleaned)) {
    return true;
  }

  if (STRONG_CODE_KEYWORD_REGEX.test(cleaned)) {
    return true;
  }

  const hasControlFlowKeyword = CONTROL_FLOW_KEYWORD_REGEX.test(cleaned);
  const hasCodePunctuation = /[{}[\]();=]/.test(cleaned);

  if (hasControlFlowKeyword && hasCodePunctuation) {
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

  if (isCodeLikeLine(cleaned)) {
    return true;
  }

  const hasCodeCharacters = /[{}[\]();=]/.test(cleaned);
  const hasFewWords = cleaned.split(/\s+/).length <= 8;

  return hasCodeCharacters && hasFewWords && !PROSE_SENTENCE_REGEX.test(cleaned);
};
