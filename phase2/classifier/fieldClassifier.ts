/**
 * Field classifier: maps a question to the deterministic user/context field
 * it asks about (EMAIL, PHONE, NAME, REFERENCE_NUMBER, ...).
 *
 * Only questions in categories that describe personally-mappable data are
 * eligible for a specific field. Everything else is NONE, and PERSONAL_DATA
 * that matches no known field is left as OTHER rather than guessed.
 */
import {
  CLASSIFY_THRESHOLD,
  FIELD_ELIGIBLE_CATEGORIES,
  FIELD_KEYWORDS,
  FIELD_PRIORITY,
  hasAnyMatch,
  scoreRule,
} from "../rules/keywords.ts";
import type { FieldType, QuestionCategory } from "../schemas/questionSchema.ts";

export interface FieldResult {
  field: FieldType;
  confidence: number;
  matched: string[];
}

export function classifyField(
  label: string,
  category: QuestionCategory
): FieldResult {
  if (!FIELD_ELIGIBLE_CATEGORIES.includes(category)) {
    return { field: "NONE", confidence: 0.85, matched: ["non-personal category"] };
  }

  for (const field of FIELD_PRIORITY) {
    if (field === "NONE" || field === "OTHER") continue;
    const match = scoreRule(FIELD_KEYWORDS[field], label);
    if (hasAnyMatch(match) && match.confidence >= CLASSIFY_THRESHOLD) {
      return { field, confidence: match.confidence, matched: match.matchedStrong };
    }
  }

  if (category === "PERSONAL_DATA") {
    // Personal data we can't pin to a known field: stay honest about it.
    return { field: "OTHER", confidence: 0.4, matched: [] };
  }

  return { field: "NONE", confidence: 0.8, matched: ["no personal field matched"] };
}