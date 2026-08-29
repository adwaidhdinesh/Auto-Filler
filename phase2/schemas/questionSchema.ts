/**
 * Strongly typed schema for the whole Phase 2 pipeline.
 *
 * Phase 1 input (raw DOM JSON from content.js) and Phase 2 output
 * (normalized, classified) are both described here so the flow is explicit:
 *
 *   Phase 1 JSON -> analyzeForm() -> AnalyzedForm
 */

/** Values emitted by the Phase 1 scanner (content.js). */
export const PHASE1_TYPES = [
  "radio",
  "checkbox",
  "dropdown",
  "paragraph",
  "text",
  "date",
  "time",
  "unknown",
] as const;
export type Phase1Type = (typeof PHASE1_TYPES)[number];

export interface Phase1Question {
  id: string;
  label: string;
  type: Phase1Type;
  required?: boolean;
  options?: string[];
}

/** Cap on hard errors surfaced by AnalysisError (keeps messages readable). */
export const ANALYZER_MAX_ERRORS = 20;

export interface Phase1Form {
  formTitle: string;
  url: string;
  scannedAt: string;
  questionCount: number;
  questions: Phase1Question[];
}

/** Normalized question types (independent of the raw DOM type). */
export const NORMALIZED_TYPES = [
  "TEXT",
  "PARAGRAPH",
  "RADIO",
  "CHECKBOX",
  "DROPDOWN",
  "DATE",
  "TIME",
  "NUMBER",
  "EMAIL",
  "FILE_UPLOAD",
  "SCALE",
  "GRID",
  "UNKNOWN",
] as const;
export type NormalizedType = (typeof NORMALIZED_TYPES)[number];

export const QUESTION_CATEGORIES = [
  "PERSONAL_DATA",
  "USER_CONTEXT",
  "KNOWLEDGE",
  "OPINION",
  "FEEDBACK",
  "PREFERENCE",
  "DATE_TIME",
  "REFERENCE_DATA",
  "UNKNOWN",
] as const;
export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export const FIELD_TYPES = [
  "NAME",
  "EMAIL",
  "PHONE",
  "ADDRESS",
  "CITY",
  "STATE",
  "COUNTRY",
  "DATE",
  "TIME",
  "REFERENCE_NUMBER",
  "COLLEGE",
  "UNIVERSITY",
  "DEGREE",
  "OTHER",
  "NONE",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface AnalyzedQuestion {
  id: string;
  label: string;

  /** Normalized Phase 2 type (e.g. TEXT, EMAIL, NUMBER, ...). */
  type: NormalizedType;
  /** Original Phase 1 DOM-based type, always preserved. */
  originalType: Phase1Type;

  category: QuestionCategory;
  field: FieldType;

  options: string[];
  required: boolean;

  /** Per-classifier confidences (0..1) plus one overall figure. */
  typeConfidence: number;
  categoryConfidence: number;
  fieldConfidence: number;
  confidence: number;

  /** True when rule confidence fell below the usable threshold. */
  needsAI: boolean;

  /** Non-fatal notes produced while analyzing this question. */
  warnings: string[];

  /** Matched terms, kept for explainability/debugging. */
  matchedTerms: {
    category: string[];
    field: string[];
  };
}

export interface AnalyzedForm {
  formTitle: string;
  url: string;
  scannedAt: string;
  questionCount: number;
  questions: AnalyzedQuestion[];

  /** Form-level warnings (e.g. duplicate question ids). */
  warnings: string[];

  analyzerVersion: string;
  analyzedAt: string;
}