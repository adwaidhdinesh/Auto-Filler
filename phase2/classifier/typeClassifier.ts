/**
 * Type classifier: maps the Phase 1 DOM-derived type into a normalized
 * Phase 2 type, refining with label/options evidence where safe.
 *
 * The raw DOM type is a starting point, never gospel: a sealed text field
 * labelled "Email Address" is normalized to EMAIL, a radio whose options
 * are all numeric becomes SCALE, and file-upload questions that the scanner
 * couldn't type become FILE_UPLOAD.
 */
import {
  CLASSIFY_THRESHOLD,
  TYPE_EMAIL,
  TYPE_FILE_UPLOAD,
  TYPE_GRID,
  TYPE_NUMBER,
  TYPE_SCALE,
  hasAnyMatch,
  scoreRule,
  type MatchScore,
} from "../rules/keywords.ts";
import { looksLikeScaleOptions } from "../rules/normalize.ts";
import type {
  NormalizedType,
  Phase1Question,
} from "../schemas/questionSchema.ts";

export interface TypeResult {
  type: NormalizedType;
  confidence: number;
  matched: string[];
}

const DIRECT: Record<Phase1Question["type"], TypeResult> = {
  date: { type: "DATE", confidence: 0.97, matched: ["DOM type 'date'"] },
  time: { type: "TIME", confidence: 0.97, matched: ["DOM type 'time'"] },
  radio: { type: "RADIO", confidence: 0.96, matched: ["DOM role radio"] },
  checkbox: { type: "CHECKBOX", confidence: 0.96, matched: ["DOM role checkbox"] },
  dropdown: { type: "DROPDOWN", confidence: 0.96, matched: ["DOM role listbox"] },
  paragraph: { type: "PARAGRAPH", confidence: 0.96, matched: ["DOM textarea"] },
  text: { type: "TEXT", confidence: 0.95, matched: ["DOM text input"] },
  unknown: { type: "UNKNOWN", confidence: 0.5, matched: ["DOM type unknown"] },
};

function fromRule(match: MatchScore, type: NormalizedType): TypeResult | null {
  if (hasAnyMatch(match) && match.confidence >= CLASSIFY_THRESHOLD) {
    return { type, confidence: match.confidence, matched: match.matchedStrong };
  }
  return null;
}

export function classifyType(question: Phase1Question): TypeResult {
  const base = DIRECT[question.type];
  const label = question.label;
  const options = question.options ?? [];

  switch (question.type) {
    case "radio": {
      if (looksLikeScaleOptions(options)) {
        return {
          type: "SCALE",
          confidence: 0.9,
          matched: ["all options are numeric"],
        };
      }
      const scale = fromRule(scoreRule(TYPE_SCALE, label), "SCALE");
      if (scale) return scale;
      break;
    }
    case "text": {
      const email = fromRule(scoreRule(TYPE_EMAIL, label), "EMAIL");
      if (email) return email;
      const number = fromRule(scoreRule(TYPE_NUMBER, label), "NUMBER");
      if (number) return number;
      break;
    }
    case "unknown": {
      const upload = fromRule(scoreRule(TYPE_FILE_UPLOAD, label), "FILE_UPLOAD");
      if (upload) return upload;
      const grid = fromRule(scoreRule(TYPE_GRID, label), "GRID");
      if (grid) return grid;
      const scale = fromRule(scoreRule(TYPE_SCALE, label), "SCALE");
      if (scale) return scale;
      break;
    }
    default:
      break;
  }

  return (
    base ?? { type: "UNKNOWN", confidence: 0.5, matched: ["no type evidence"] }
  );
}