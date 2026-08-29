/**
 * Phase 2 — Question Classification & Understanding.
 *
 * Public entry point: analyzeForm() turns a Phase 1 raw form JSON into a
 * normalized, classified AnalyzedForm that a future Answer Engine can
 * consume without knowing anything about the DOM scanner.
 *
 *   Google Form -> Phase 1 Scanner -> Raw Form JSON -> analyzeForm() -> AnalyzedForm
 *
 * Phase 2 is 100% rule based. No AI, no network calls, no storage of user
 * values, no logging of labels.
 */
import { normalizeQuestion } from "./normalizer/questionNormalizer.ts";
import {
  PHASE1_TYPES,
  type AnalyzedForm,
  type Phase1Question,
} from "./schemas/questionSchema.ts";
import { AnalysisError, validateAnalyzedForm } from "./validation/formValidator.ts";
import { makeLogger, type DebugLog } from "./logging/logger.ts";

export const ANALYZER_VERSION = "0.2.0";

export * from "./schemas/questionSchema.ts";
export * from "./rules/keywords.ts";
export * from "./classifier/typeClassifier.ts";
export * from "./classifier/categoryClassifier.ts";
export * from "./classifier/fieldClassifier.ts";
export * from "./normalizer/questionNormalizer.ts";
export { AnalysisError, validateAnalyzedForm } from "./validation/formValidator.ts";
export { normalizeText, stemmedText } from "./rules/normalize.ts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;

function parseQuestion(raw: unknown, debug: DebugLog): Phase1Question {
  if (!isRecord(raw)) {
    throw new AnalysisError(["question entry is not an object"]);
  }

  const id = asString(raw.id, "");
  if (!id) {
    throw new AnalysisError(["question entry is missing an id"]);
  }

  const label = asString(raw.label, "");
  const rawType = asString(raw.type, "unknown");
  const type = (PHASE1_TYPES as readonly string[]).includes(rawType)
    ? (rawType as Phase1Question["type"])
    : "unknown";

  const options = Array.isArray(raw.options)
    ? raw.options.filter((o): o is string => typeof o === "string")
    : undefined;

  debug(`input question '${id}': type=${type} options=${options?.length ?? 0}`);

  return {
    id,
    label,
    type,
    required: raw.required === true,
    options,
  };
}

export interface AnalyzeOptions {
  /** Emit deterministic [Phase2] metadata logs (labels are never logged). */
  debug?: boolean;
}

/**
 * Normalize and classify a Phase 1 form JSON blob.
 *
 * Throws AnalysisError when the input is structurally invalid or the output
 * violates the schema (unknown enums, out-of-range confidence, missing ids).
 */
export function analyzeForm(formJson: unknown, options?: AnalyzeOptions): AnalyzedForm {
  const debug = makeLogger(options?.debug === true);

  if (!isRecord(formJson) || !Array.isArray(formJson.questions)) {
    throw new AnalysisError([
      "invalid Phase 1 form: expected an object with a 'questions' array",
    ]);
  }

  const questions = (formJson.questions as unknown[])
    .map((raw) => parseQuestion(raw, debug))
    .map((question) => normalizeQuestion(question));

  const form: AnalyzedForm = {
    formTitle: asString(formJson.formTitle, ""),
    url: asString(formJson.url, ""),
    scannedAt: asString(formJson.scannedAt, new Date().toISOString()),
    questionCount: questions.length,
    questions,
    warnings: [],
    analyzerVersion: ANALYZER_VERSION,
    analyzedAt: new Date().toISOString(),
  };

  const warnings = validateAnalyzedForm(form);
  form.warnings = warnings;

  for (const question of questions) {
    debug(
      `question '${question.id}': type=${question.type} category=${question.category} ` +
        `field=${question.field} categoryConf=${question.categoryConfidence} ` +
        `needsAI=${question.needsAI}`
    );
  }
  debug(`analyzed ${questions.length} question(s)`);

  return form;
}