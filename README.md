<div align="center">

# 🤖 Auto-Filler

**Local Google Forms Scanner and Classifier (Chrome Extension)**

Scans Google Forms and classifies question types locally with deterministic rules. Autofill and AI-powered features are planned; the current version does not generate or enter answers.

`TypeScript` · `Chrome Extension` · `Google Forms` · `Local Analysis`

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node 20+](https://img.shields.io/badge/Node-20%2B-339933.svg?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
![Status](https://img.shields.io/badge/Status-Phase%202%20(Scanner%20%2B%20Classification)-blue.svg)

</div>

---

## 📍 Project Status

**Currently: Phase 2 — Form Scanner + Question Classification** (rule-based normalization)

- ✅ Phase 1: Form detection + extraction
- ✅ Phase 2: Question classification (rule-based)
- ⏳ Phase 3: Local autofill (planned)
- ⏳ Phase 4: AI classification fallback (planned)
- ⏳ Phase 5: AI-generated answers (planned)

> **Important:** No AI, no answer generation, no autofill, no submission, and no network calls yet. The schema is being built reliably first so later phases can build on a solid foundation.

---

## Load it

Prerequisites: Node.js 20+.

1. `npm install`
2. `npm run build` (compiles the Phase 2 analyzer into `phase2/dist/`)
3. Go to `chrome://extensions`
4. Turn on **Developer mode** (top right)
5. Click **Load unpacked**
6. Select the repository folder that contains `manifest.json`
7. Open any Google Form (`docs.google.com/forms/...`)
8. Click the extension icon → **Scan form**

The popup shows the **Normalized** (Phase 2) view by default and can switch
to **Raw (Phase 1)**.

The raw output (Phase 1) looks like:

```json
{
  "formTitle": "Event Registration",
  "url": "https://docs.google.com/forms/d/e/.../viewform",
  "scannedAt": "2026-08-29T16:31:00.000Z",
  "questionCount": 2,
  "questions": [
    { "id": "q1", "label": "Full Name", "type": "text", "required": true },
    {
      "id": "q2",
      "label": "Which protocol is used for secure web communication?",
      "type": "radio",
      "required": true,
      "options": ["HTTP", "FTP", "HTTPS", "SMTP"]
    }
  ]
}
```

## How detection works

Google Forms renders each question as `[role="listitem"]`, with the question
text in a `[role="heading"]` inside it. Type is inferred from the input
control present: `[role="radio"]`, `[role="checkbox"]`, `[role="listbox"]`
(dropdown), `textarea` (paragraph), or `input[type=text/date/time]`.

This is DOM-structure based, not class-name based, since Google's CSS class
names are obfuscated and change across deploys — ARIA roles are far more
stable.

## Phase 2 — Question Classification & Understanding

`analyzeForm(rawFormJson)` (in `phase2/index.ts`) turns the raw scan into a
normalized, classified form. The pipeline is modular:

```text
Phase 1 JSON
  -> typeClassifier   (normalized type: TEXT, EMAIL, NUMBER, SCALE, ...)
  -> categoryClassifier (PERSONAL_DATA, KNOWLEDGE, USER_CONTEXT, ...)
  -> fieldClassifier    (NAME, EMAIL, PHONE, UNIVERSITY, REFERENCE_NUMBER, ...)
  -> questionNormalizer (assembles AnalyzedQuestion + per-question warnings)
  -> validateAnalyzedForm (schema checks; throws AnalysisError on hard issues)
  -> AnalyzedForm
```

Rules are data, centralized in `phase2/rules/keywords.ts` (label text is
normalized and singularized before matching, so synonyms and plurals work).
Every classification carries a deterministic confidence in [0,1]; anything
below `CLASSIFY_THRESHOLD` (0.5) becomes `UNKNOWN` with `needsAI: true`
instead of a guessed answer. The analyzer is pure and local: no AI, no
network, no storage of user values, no logging of labels.

Normalized question example:

```json
{
  "id": "q1",
  "label": "Contact No.",
  "type": "TEXT",
  "originalType": "text",
  "category": "PERSONAL_DATA",
  "field": "PHONE",
  "options": [],
  "required": true,
  "typeConfidence": 0.95,
  "categoryConfidence": 0.87,
  "fieldConfidence": 0.87,
  "confidence": 0.9,
  "needsAI": false,
  "warnings": [],
  "matchedTerms": { "category": ["contact no"], "field": ["contact no"] }
}
```

Normalized types: `TEXT PARAGRAPH RADIO CHECKBOX DROPDOWN DATE TIME NUMBER
EMAIL FILE_UPLOAD SCALE GRID UNKNOWN`

Categories: `PERSONAL_DATA USER_CONTEXT KNOWLEDGE OPINION FEEDBACK PREFERENCE
DATE_TIME REFERENCE_DATA UNKNOWN`

Fields: `NAME EMAIL PHONE ADDRESS CITY STATE COUNTRY DATE TIME
REFERENCE_NUMBER COLLEGE UNIVERSITY DEGREE OTHER NONE`

The future Answer Engine consumes `AnalyzedForm` and never needs to know how
the DOM scanner works.

## Development commands

```bash
npm test         # run the Phase 2 unit tests (Node's built-in test runner)
npm run typecheck   # strict TypeScript check, no emit
npm run build       # compile TypeScript -> phase2/dist (required by the popup)
```

Run these from the repo root, after `npm install`.

## Known limitations (Phases 1-2)

- Multi-page forms: only scans the currently visible page/section. Re-run
  scan after clicking "Next."
- File upload, linear scale, and grid questions aren't specifically typed by
  the scanner; Phase 2 recovers upload/grid/scale from the label when it can,
  otherwise they stay `"unknown"`.
- Classification is English-keyword based; non-English forms will mostly
  fall back to `UNKNOWN` until an AI fallback is added in a later phase.
- Doesn't yet distinguish a question from a section description that
  happens to have heading-like markup. Rare, but possible false positive.

## Where this is scoped to stop

The rest of the roadmap in the original design doc adds local autofill
(name/email/phone from a saved profile), AI-assisted classification of
ambiguous fields, and — further out — AI-generated answers for open-ended
and multiple-choice questions.

Worth building deliberately: autofilling *your own* known information on
repetitive forms (job applications, event signups, contact forms, surveys)
is a reasonable productivity tool. Using the same pipeline to auto-select
"correct" answers on graded quizzes, exams, or certification tests is a
different thing — that's assessment fraud, not autofill. If you extend
Phase 5+ (AI Answers) or the MCQ/dropdown answer-selection logic, it's worth
explicitly scoping *which* forms it's allowed to run on (e.g. an allowlist
of form URLs you maintain, rather than "any Google Form").

## Next phase

Phase 3 — Local Autofill: match detected `field` values like NAME / EMAIL /
PHONE / UNIVERSITY against a small profile stored in `chrome.storage.local`
and fill them directly. Still no AI.

---

## ⚖️ Ethical Use

This project is designed as a **productivity tool** for repetitive personal forms (job applications, event signups, contact forms, surveys).

It is **NOT** intended for:
- Auto-completing graded quizzes, exams, or certification tests
- Academic fraud of any kind
- Bypassing form security or CAPTCHA protections

Future AI-answer phases should be scoped with an allowlist of permitted form URLs. Use responsibly.

---

## License

MIT License — see [LICENSE](LICENSE).
