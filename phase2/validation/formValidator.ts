/**
 * Schema validation for Phase 2 output.
 *
 * Distinguishes two categories of problems:
 *  - hard errors  -> the analyzed form is structurally broken (unknown enum
 *                    values, confidence out of [0,1], missing ids); analyzeForm
 *                    refuses to return these and throws AnalysisError.
 *  - warnings     -> suspicious but valid output (radio without options,
 *                    personal data with no recognized field, duplicate ids);
 *                    collected and surfaced on the result.
 */
import {
  ANALYZER_MAX_ERRORS,
  FIELD_TYPES,
  NORMALIZED_TYPES,
  QUESTION_CATEGORIES,
  type AnalyzedForm,
  type AnalyzedQuestion,
} from "../schemas/questionSchema.ts";

export class AnalysisError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(
      errors.length === 1
        ? `Analysis error: ${errors[0]}`
        : `Analysis errors:\n- ${errors.join("\n- ")}`
    );
    this.name = "AnalysisError";
    this.errors = errors;
  }
}

const isFinite01 = (value: number): boolean =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

const includes = <T extends string>(list: readonly T[], value: string): value is T =>
  (list as readonly string[]).includes(value);

function validateQuestion(question: AnalyzedQuestion): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const where = `question '${question.id || "<missing id>"}'`;

  if (!question.id) {
    errors.push(`question has an empty id`);
  }

  if (!includes(NORMALIZED_TYPES, question.type)) {
    errors.push(`${where}: invalid normalized type '${question.type}'`);
  }
  if (!includes(QUESTION_CATEGORIES, question.category)) {
    errors.push(`${where}: invalid category '${question.category}'`);
  }
  if (!includes(FIELD_TYPES, question.field)) {
    errors.push(`${where}: invalid field '${question.field}'`);
  }

  for (const [key, value] of [
    ["typeConfidence", question.typeConfidence],
    ["categoryConfidence", question.categoryConfidence],
    ["fieldConfidence", question.fieldConfidence],
    ["confidence", question.confidence],
  ] as const) {
    if (!isFinite01(value)) {
      errors.push(`${where}: ${key} is out of range: ${String(value)}`);
    }
  }

  const optionRequiring = ["RADIO", "CHECKBOX", "DROPDOWN", "SCALE"] as const;
  if (
    includes(optionRequiring, question.type) &&
    question.options.length === 0
  ) {
    warnings.push(`${where}: ${question.type} has no options`);
  }

  if (question.category === "PERSONAL_DATA" && question.field === "NONE") {
    warnings.push(`${where}: PERSONAL_DATA without a recognized field`);
  }

  if (
    question.category === "UNKNOWN" &&
    question.originalType === "unknown"
  ) {
    // Allowed by design, but explicitly marked UNKNOWN.
    warnings.push(`${where}: unresolved type and category (UNKNOWN)`);
  }

  return { errors, warnings };
}

function validateFormCore(form: AnalyzedForm): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const seen = new Map<string, number>();
  for (const question of form.questions) {
    const validated = validateQuestion(question);
    errors.push(...validated.errors);
    warnings.push(...validated.warnings);

    const count = (seen.get(question.id) ?? 0) + 1;
    seen.set(question.id, count);
  }

  for (const [id, count] of seen) {
    if (count > 1) {
      warnings.push(`duplicate question id '${id}' (${count} occurrences)`);
    }
  }

  return { errors, warnings };
}

/**
 * Returns the aggregated warnings for a fully analyzed form. Throws
 * AnalysisError when any hard structural violation is present.
 */
export function validateAnalyzedForm(form: AnalyzedForm): string[] {
  const { errors, warnings } = validateFormCore(form);
  if (errors.length > 0) {
    throw new AnalysisError(errors.slice(0, ANALYZER_MAX_ERRORS));
  }
  return warnings;
}