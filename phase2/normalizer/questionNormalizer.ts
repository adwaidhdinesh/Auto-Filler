/**
 * Question normalizer: runs the three classifiers over a single Phase 1
 * question and assembles the normalized, strongly typed AnalyzedQuestion.
 *
 * This is the one place the pipeline stages meet; each classifier stays
 * small, pure, and independently testable.
 */
import { classifyCategory } from "../classifier/categoryClassifier.ts";
import { classifyField } from "../classifier/fieldClassifier.ts";
import { classifyType } from "../classifier/typeClassifier.ts";
import { CLASSIFY_THRESHOLD } from "../rules/keywords.ts";
import type {
  AnalyzedQuestion,
  NormalizedType,
  Phase1Question,
} from "../schemas/questionSchema.ts";

/** Normalized types that legitimately require answer options. */
const OPTION_REQUIRED_TYPES: NormalizedType[] = [
  "RADIO",
  "CHECKBOX",
  "DROPDOWN",
  "SCALE",
];

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

export function normalizeQuestion(question: Phase1Question): AnalyzedQuestion {
  const type = classifyType(question);
  const category = classifyCategory(question.label);
  const field = classifyField(question.label, category.category);

  const warnings: string[] = [];

  if (
    OPTION_REQUIRED_TYPES.includes(type.type) &&
    !(question.options && question.options.length > 0)
  ) {
    warnings.push(`${type.type} question has no listed options`);
  }

  if (
    ["EMAIL", "PHONE", "NAME"].includes(field.field) &&
    !["TEXT", "EMAIL", "NUMBER"].includes(type.type)
  ) {
    warnings.push(
      `suspicious type '${type.type}' for a ${field.field} field`
    );
  }

  if (category.category === "PERSONAL_DATA" && field.field === "OTHER") {
    warnings.push("personal data question without a recognized field");
  }

  const confidence = round3(
    (type.confidence + category.confidence + field.confidence) / 3
  );

  return {
    id: question.id,
    label: question.label,
    type: type.type,
    originalType: question.type,
    category: category.category,
    field: field.field,
    options: question.options ?? [],
    required: question.required === true,
    typeConfidence: round3(type.confidence),
    categoryConfidence: round3(category.confidence),
    fieldConfidence: round3(field.confidence),
    confidence,
    needsAI: category.category === "UNKNOWN" || category.confidence < CLASSIFY_THRESHOLD,
    warnings,
    matchedTerms: {
      category: category.matched,
      field: field.matched,
    },
  };
}