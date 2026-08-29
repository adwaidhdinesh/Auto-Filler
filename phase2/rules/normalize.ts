/**
 * Text normalization utilities shared by all rule-based classifiers.
 *
 * Matching is done on a "stemmed" form of the label so that keyword rules
 * written in the singular (e.g. "programming language") also match plural
 * labels ("programming languages"). Only metadata is used for matching;
 * no actual user-provided values are ever fed through these pipes.
 */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Crude but deterministic singularizer: technologies -> technology, numbers -> number. */
export function stemToken(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith("ies")) return token.slice(0, -3) + "y";
  if (token.endsWith("s")) return token.slice(0, -1);
  return token;
}

/** Lowercase, strip punctuation (keep letters, digits, "+"), collapse whitespace. */
export function normalizeText(raw: string): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[^\p{L}\p{N}+]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalized + singularized text, used as the matching surface. */
export function stemmedText(raw: string): string {
  return normalizeText(raw)
    .split(" ")
    .filter(Boolean)
    .map(stemToken)
    .join(" ");
}

/** True when `phrase` occurs as a whole phrase (word boundary aware) in `text`. */
export function containsPhrase(text: string, phrase: string): boolean {
  const target = stemmedText(text);
  const needle = stemmedText(phrase);
  if (!needle) return false;
  const spaced = escapeRegExp(needle).replace(/ /g, "\\s+");
  return new RegExp(`(^|\\s)${spaced}(\\s|$)`, "u").test(target);
}

/** True when `text` starts with `phrase` (used for a confidence boost). */
export function startsWithPhrase(text: string, phrase: string): boolean {
  const target = stemmedText(text);
  const needle = stemmedText(phrase);
  if (!needle) return false;
  if (!target.startsWith(needle)) return false;
  return target.length === needle.length || target[needle.length] === " ";
}

/** True when the string is a plain numeric literal (allows "1", "5.0", "-3"). */
export function isNumeric(value: string): boolean {
  return /^[+-]?\d+([.,]\d+)?$/.test(value.trim());
}

/** Radio-style options that are all numeric (1..5) look like a scale, not a list. */
export function looksLikeScaleOptions(options: string[]): boolean {
  const trimmed = (options ?? []).map((o) => o.trim()).filter(Boolean);
  return trimmed.length >= 3 && trimmed.every(isNumeric);
}