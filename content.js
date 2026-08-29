/**
 * Form Scanner - Phase 1
 *
 * Turns a Google Form's DOM into a structured JSON schema of questions.
 * No AI, no answer generation, no autofill. Just detection + extraction.
 *
 * Matches the FormQuestion schema from the architecture doc:
 *   { id, label, type, options?, required? }
 */

const QUESTION_TYPES = {
  RADIO: "radio",
  CHECKBOX: "checkbox",
  DROPDOWN: "dropdown",
  PARAGRAPH: "paragraph",
  TEXT: "text",
  DATE: "date",
  TIME: "time",
  UNKNOWN: "unknown",
};

function cleanLabel(rawText) {
  if (!rawText) return "";
  // Google Forms appends "*" and sometimes duplicates the required marker
  // as trailing whitespace-separated asterisks. Strip all of that noise.
  return rawText.replace(/(?:\s*\*+)+$/, "").trim();
}

function detectQuestionType(item) {
  // Grid and linear-scale questions render every cell as a radio/checkbox;
  // they aren't typed yet, so say so instead of misreporting them.
  if (item.querySelector('[role="table"]')) return QUESTION_TYPES.UNKNOWN;
  if (item.querySelector('[role="radio"]')) return QUESTION_TYPES.RADIO;
  if (item.querySelector('[role="checkbox"]')) return QUESTION_TYPES.CHECKBOX;
  if (item.querySelector("textarea")) return QUESTION_TYPES.PARAGRAPH;
  if (item.querySelector('input[type="time"]')) return QUESTION_TYPES.TIME;
  if (item.querySelector('input[type="date"]')) return QUESTION_TYPES.DATE;
  if (item.querySelector('[role="listbox"]')) return QUESTION_TYPES.DROPDOWN;
  if (item.querySelector('input[type="text"], input:not([type])')) {
    return QUESTION_TYPES.TEXT;
  }
  return QUESTION_TYPES.UNKNOWN;
}

function extractOptions(item, type) {
  if (type === QUESTION_TYPES.RADIO || type === QUESTION_TYPES.CHECKBOX) {
    const nodes = Array.from(item.querySelectorAll(`[role="${type}"]`));
    const options = nodes
      .map((el) => el.getAttribute("aria-label") || el.textContent.trim())
      .filter(Boolean);
    return options.length ? options : undefined;
  }

  if (type === QUESTION_TYPES.DROPDOWN) {
    const nodes = Array.from(item.querySelectorAll('[role="option"]'));
    const options = nodes
      .map((el) => el.getAttribute("aria-label") || el.textContent.trim())
      .filter((text) => Boolean(text) && text.toLowerCase() !== "choose");
    return options.length ? options : undefined;
  }

  return undefined;
}

function extractLabel(item) {
  // Google Forms marks the question text with role="heading" inside each
  // listitem.
  const heading = item.querySelector('[role="heading"]');
  if (heading && heading.textContent.trim()) {
    return cleanLabel(heading.textContent);
  }

  // Fall back to the first meaningful text node outside the answer
  // controls (which would otherwise be picked up as the label).
  const isControl = (el) =>
    Boolean(
      el.closest(
        '[role="radio"], [role="checkbox"], [role="option"], [role="listbox"], textarea, input, select, button'
      )
    );

  const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
      if (isControl(node.parentElement)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const first = walker.nextNode();
  return first ? cleanLabel(first.textContent) : "";
}

function isRequired(item) {
  if (item.querySelector('[aria-label="Required question"]')) return true;
  const heading = item.querySelector('[role="heading"]');
  return Boolean(heading && /(?:\s*\*)+$/.test(heading.textContent || ""));
}

function scanForm() {
  const items = Array.from(document.querySelectorAll('[role="listitem"]'));
  const questions = [];
  let index = 0;

  for (const item of items) {
    const label = extractLabel(item);
    // Skip listitems with no question text - these are usually section
    // breaks, descriptions, or images rather than actual questions.
    if (!label) continue;

    index += 1;
    const type = detectQuestionType(item);
    const options = extractOptions(item, type);

    const question = {
      id: `q${index}`,
      label,
      type,
      required: isRequired(item),
    };
    if (options) question.options = options;

    questions.push(question);
  }

  return {
    formTitle: document.title || "",
    url: location.href,
    scannedAt: new Date().toISOString(),
    questionCount: questions.length,
    questions,
  };
}

// Run an initial scan on load so the popup has something to show immediately,
// without requiring the user to click "Scan" first. Don't let a partial scan
// (the form's questions may not be rendered yet) clobber a known-good cache.
function scanAndCache() {
  try {
    const result = scanForm();
    chrome.storage.local.get("lastScan", (existing) => {
      const current = existing && existing.lastScan;
      if (result.questionCount > 0 || !current) {
        chrome.storage.local.set({ lastScan: result });
      }
    });
  } catch (err) {
    // Swallow errors from an initial best-effort scan; the user can
    // still trigger a manual scan from the popup.
    console.warn("Form Scanner: initial scan failed", err);
  }
}

scanAndCache();

// Re-scan on request from the popup (useful if the form loaded slowly,
// or the user navigated to a new page/section within a multi-page form).
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === "SCAN_FORM") {
    try {
      const result = scanForm();
      chrome.storage.local.set({ lastScan: result });
      sendResponse({ ok: true, result });
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
  }
  return true; // keep the message channel open for async sendResponse
});
