# Auto-Filler

An AI-powered Chrome extension that scans Google Forms, understands different question types, and uses user data, context, AI, and web research to generate and fill relevant answers.

The current checked-in code is **Phase 1 — Form Scanner**, which does *only* detection and extraction. No AI, no autofill:

- No AI
- No answer generation
- No autofill
- No submission

Everything later in the roadmap (local autofill, AI classification, user
context, generated answers) builds on top of this schema, so it needs to be
reliable first.

## Load it

1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this `extension/` folder
5. Open any Google Form (`docs.google.com/forms/...`)
6. Click the extension icon → **Scan form**

The output looks like:

```json
{
  "formTitle": "Event Registration",
  "url": "https://docs.google.com/forms/d/e/.../viewform",
  "scannedAt": "2026-08-29T16:31:00.000Z",
  "questionCount": 3,
  "questions": [
    { "id": "q1", "label": "Full Name", "type": "text", "required": true },
    {
      "id": "q2",
      "label": "T-shirt size",
      "type": "radio",
      "required": false,
      "options": ["S", "M", "L", "XL"]
    },
    { "id": "q3", "label": "Anything else we should know?", "type": "paragraph", "required": false }
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

## Known limitations (fine for Phase 1)

- Multi-page forms: only scans the currently visible page/section. Re-run
  scan after clicking "Next."
- File upload, linear scale, and grid questions aren't specifically typed yet —
  they'll currently fall back to `"unknown"` (grids are detected via the
  question's `[role="table"]` container and skipped).
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

Phase 2 — Local Autofill: match detected `text` questions like "Full Name" /
"Email" / "Phone" against a small profile stored in `chrome.storage.local`
and fill them directly. Still no AI.