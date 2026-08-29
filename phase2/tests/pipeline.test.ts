/**
 * Unit tests for the Phase 2 classification pipeline.
 *
 * Run with: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  analyzeForm,
  AnalysisError,
  validateAnalyzedForm,
  type AnalyzedForm,
  type AnalyzedQuestion,
  type Phase1Question,
} from "../index.ts";

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function analyze(questions: Phase1Question[]): AnalyzedForm {
  return analyzeForm({
    formTitle: "Test form",
    url: "https://docs.google.com/forms/d/e/1FA/viewform",
    scannedAt: "2026-08-30T00:00:00.000Z",
    questionCount: questions.length,
    questions,
  });
}

function q(
  id: string,
  label: string,
  type: Phase1Question["type"] = "text",
  overrides: Partial<Phase1Question> = {}
): Phase1Question {
  return { id, label, type, ...overrides };
}

function byId(form: AnalyzedForm, id: string): AnalyzedQuestion {
  const found = form.questions.find((question) => question.id === id);
  if (!found) throw new Error(`question ${id} missing from analysis`);
  return found;
}

/* ------------------------------------------------------------------ *
 * Personal / reference fields
 * ------------------------------------------------------------------ */

test("personal fields are classified", () => {
  const form = analyze([
    q("q1", "Full Name"),
    q("q2", "Email Address"),
    q("q3", "Contact No."),
    q("q4", "Mobile Number"),
    q("q5", "Current City"),
    q("q6", "Address"),
    q("q7", "Registration Number"),
  ]);

  assert.equal(byId(form, "q1").field, "NAME");
  assert.equal(byId(form, "q1").category, "PERSONAL_DATA");
  assert.ok(byId(form, "q1").fieldConfidence > 0.6);

  assert.equal(byId(form, "q2").field, "EMAIL");
  assert.equal(byId(form, "q2").type, "EMAIL");
  assert.equal(byId(form, "q2").category, "PERSONAL_DATA");

  assert.equal(byId(form, "q3").field, "PHONE");
  assert.equal(byId(form, "q3").category, "PERSONAL_DATA");

  assert.equal(byId(form, "q4").field, "PHONE");

  assert.equal(byId(form, "q5").field, "CITY");

  assert.equal(byId(form, "q6").field, "ADDRESS");

  assert.equal(byId(form, "q7").field, "REFERENCE_NUMBER");
  assert.equal(byId(form, "q7").category, "REFERENCE_DATA");
});

test("phone synonyms map to PHONE", () => {
  for (const label of [
    "Phone",
    "Mobile",
    "Mobile number",
    "Contact number",
    "Contact no",
    "Telephone",
    "WhatsApp number",
    "Cell number",
  ]) {
    const form = analyze([q("p", label)]);
    assert.equal(
      byId(form, "p").field,
      "PHONE",
      `expected ${JSON.stringify(label)} -> PHONE`
    );
  }
});

/* ------------------------------------------------------------------ *
 * Knowledge questions
 * ------------------------------------------------------------------ */

test("knowledge questions are recognized", () => {
  const form = analyze([
    q("k1", "What is HTTP?", "text"),
    q("k2", "What is the capital of India?", "text"),
    q(
      "k3",
      "Which AWS service provides object storage?",
      "radio",
      { options: ["S3", "EC2", "Lambda", "RDS"] }
    ),
  ]);

  assert.equal(byId(form, "k1").category, "KNOWLEDGE");
  assert.equal(byId(form, "k2").category, "KNOWLEDGE");
  assert.equal(byId(form, "k3").category, "KNOWLEDGE");
  assert.equal(byId(form, "k3").field, "NONE");
  assert.equal(byId(form, "k3").type, "RADIO");
});

/* ------------------------------------------------------------------ *
 * User context
 * ------------------------------------------------------------------ */

test("user-context questions are recognized", () => {
  const form = analyze([
    q("u1", "What university do you attend?"),
    q("u2", "What programming languages do you know?", "checkbox", {
      options: ["Java", "Python", "C++"],
    }),
    q("u3", "Describe your previous project.", "paragraph"),
  ]);

  assert.equal(byId(form, "u1").category, "USER_CONTEXT");
  assert.equal(byId(form, "u1").field, "UNIVERSITY");

  assert.equal(byId(form, "u2").category, "USER_CONTEXT");
  assert.equal(byId(form, "u2").type, "CHECKBOX");

  assert.equal(byId(form, "u3").category, "USER_CONTEXT");
  assert.equal(byId(form, "u3").type, "PARAGRAPH");
});

/* ------------------------------------------------------------------ *
 * Feedback / preference / other
 * ------------------------------------------------------------------ */

test("feedback, preference and checkbox-technologies are handled", () => {
  const form = analyze([
    q("f1", "How satisfied are you?", "radio", {
      options: ["Very satisfied", "Satisfied", "Neutral", "Dissatisfied"],
    }),
    q("f2", "Which option do you prefer?", "radio", {
      options: ["A", "B", "C"],
    }),
    q("f3", "Select all technologies you have used.", "checkbox", {
      options: ["React", "Angular", "Vue"],
    }),
  ]);

  assert.equal(byId(form, "f1").category, "FEEDBACK");

  assert.equal(byId(form, "f2").category, "PREFERENCE");

  assert.equal(byId(form, "f3").category, "USER_CONTEXT");
});

/* ------------------------------------------------------------------ *
 * Ambiguous questions stay unclassified
 * ------------------------------------------------------------------ */

test("ambiguous labels are not aggressively classified", () => {
  for (const label of ["Contact", "Details", "Information", "Tell us more", "Other"]) {
    const form = analyze([q("a", label)]);
    const question = byId(form, "a");
    assert.equal(question.category, "UNKNOWN", `expected UNKNOWN for '${label}'`);
    assert.ok(
      question.categoryConfidence < 0.5,
      `expected low confidence for '${label}' (got ${question.categoryConfidence})`
    );
    assert.equal(question.field, "NONE", `expected field NONE for '${label}'`);
    assert.equal(question.needsAI, true, `expected needsAI for '${label}'`);
  }
});

/* ------------------------------------------------------------------ *
 * Type normalization
 * ------------------------------------------------------------------ */

test("text fields refine into EMAIL/NUMBER", () => {
  const form = analyze([
    q("t1", "Your Email Address"),
    q("t2", "Years of experience", undefined, {}),
  ]);
  assert.equal(byId(form, "t1").type, "EMAIL");
});

test("radio with numeric options becomes SCALE", () => {
  const form = analyze([
    q("s1", "Rate your experience", "radio", {
      options: ["1", "2", "3", "4", "5"],
    }),
  ]);
  assert.equal(byId(form, "s1").type, "SCALE");
});

test("untyped upload questions become FILE_UPLOAD", () => {
  const form = analyze([q("f", "Upload your resume", "unknown")]);
  assert.equal(byId(form, "f").type, "FILE_UPLOAD");
});

test("date/time and paragraph types are preserved", () => {
  const form = analyze([
    q("d1", "Date of Birth", "date"),
    q("d2", "Preferred time slot", "time"),
    q("d3", "Anything else?", "paragraph"),
  ]);
  assert.equal(byId(form, "d1").type, "DATE");
  assert.equal(byId(form, "d1").field, "DATE");
  assert.equal(byId(form, "d1").category, "PERSONAL_DATA");
  assert.equal(byId(form, "d2").type, "TIME");
  assert.equal(byId(form, "d3").type, "PARAGRAPH");
});

/* ------------------------------------------------------------------ *
 * Phase 1 information is preserved
 * ------------------------------------------------------------------ */

test("original Phase 1 fields are retained", () => {
  const options = ["Yes", "No"];
  const form = analyze([
    q("q1", "Do you like it?", "radio", { options, required: true }),
  ]);
  const question = byId(form, "q1");
  assert.equal(question.originalType, "radio");
  assert.deepEqual(question.options, options);
  assert.equal(question.required, true);
  assert.equal(question.id, "q1");
  assert.equal(question.label, "Do you like it?");
});

test("questionCount and metadata are present", () => {
  const form = analyze([q("q1", "Full Name")]);
  assert.equal(form.questionCount, 1);
  assert.equal(form.analyzerVersion, "0.2.0");
  assert.ok(form.analyzedAt);
  assert.ok(form.formTitle === "Test form");
});

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

test("radio without options produces a warning", () => {
  const form = analyze([q("r1", "Pick one", "radio")]);
  const question = byId(form, "r1");
  assert.equal(question.type, "RADIO");
  assert.ok(
    question.warnings.some((w) => w.includes("no listed options")),
    `expected an options warning, got: ${question.warnings.join(", ")}`
  );
});

test("duplicate question ids are detected", () => {
  const form = analyze([
    q("dup", "Full Name"),
    q("dup", "Mobile Number"),
  ]);
  assert.ok(
    form.warnings.some((w) => w.includes("duplicate question id 'dup'")),
    `expected duplicate-id warning, got: ${form.warnings.join(", ")}`
  );
});

test("invalid input throws AnalysisError", () => {
  assert.throws(() => analyzeForm({}), AnalysisError);
  assert.throws(
    () => analyzeForm({ questions: [{ label: "no id" }] }),
    AnalysisError
  );
});

test("out-of-range confidence is rejected by the validator", () => {
  const good = analyze([q("q1", "Full Name")]);
  const broken = good.questions[0];
  const corrupt: AnalyzedForm = {
    ...good,
    questions: [{ ...broken, confidence: 1.7 }],
  };
  assert.throws(() => validateAnalyzedForm(corrupt), AnalysisError);
});

test("every generated confidence stays within [0, 1]", () => {
  const form = analyze([
    q("q1", "Full Name"),
    q("q2", "What is the capital of India?", "text"),
    q("q3", "Tell us more", "paragraph"),
  ]);
  for (const question of form.questions) {
    for (const value of [
      question.typeConfidence,
      question.categoryConfidence,
      question.fieldConfidence,
      question.confidence,
    ]) {
      assert.ok(value >= 0 && value <= 1, `out-of-range confidence ${value}`);
    }
  }
});