/**
 * Category classifier: assigns every question a high-level intent category
 * (PERSONAL_DATA, USER_CONTEXT, KNOWLEDGE, ...) using deterministic keyword
 * rules. Pure keyword scoring with an explicit confidence; if nothing scores
 * above CLASSIFY_THRESHOLD the question is marked UNKNOWN rather than forced
 * into a guessed bucket.
 */
import {
  CATEGORY_KEYWORDS,
  CATEGORY_PRIORITY,
  CLASSIFY_THRESHOLD,
  hasAnyMatch,
  scoreRule,
} from "../rules/keywords.ts";
import type { QuestionCategory } from "../schemas/questionSchema.ts";

export interface CategoryResult {
  category: QuestionCategory;
  confidence: number;
  matched: string[];
}

export function classifyCategory(label: string): CategoryResult {
  let best: QuestionCategory | null = null;
  let bestConfidence = 0;
  let bestStrong: string[] = [];

  for (const category of CATEGORY_PRIORITY) {
    if (category === "UNKNOWN") continue;
    const match = scoreRule(CATEGORY_KEYWORDS[category], label);
    if (!hasAnyMatch(match)) continue;
    if (match.confidence > bestConfidence) {
      best = category;
      bestConfidence = match.confidence;
      bestStrong = match.matchedStrong;
    }
  }

  if (!best) {
    return { category: "UNKNOWN", confidence: 0.2, matched: [] };
  }

  if (bestConfidence < CLASSIFY_THRESHOLD) {
    // Close but not convincing: surfacing the near-miss keeps it explainable.
    return { category: "UNKNOWN", confidence: bestConfidence, matched: bestStrong };
  }

  return { category: best, confidence: bestConfidence, matched: bestStrong };
}