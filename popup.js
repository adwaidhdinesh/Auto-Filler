const output = document.getElementById("output");
const countLabel = document.getElementById("count");
const scanBtn = document.getElementById("scanBtn");
const copyBtn = document.getElementById("copyBtn");
const viewSelect = document.getElementById("view");

let rawResult = null;

const NOT_BUILT_HINT =
  "Phase 2 analyzer isn't built.\n\nRun `npm run build` in the repo, then " +
  "reload the extension from chrome://extensions.\n\nShowing raw Phase 1 " +
  "output instead:";

function hasAnalyzer() {
  return typeof window.AutoFiller?.analyzeForm === "function";
}

function analyzeResult(result) {
  if (!hasAnalyzer()) return { ok: false, error: "not built" };
  try {
    return { ok: true, result: window.AutoFiller.analyzeForm(result) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function questionCount(n) {
  return `${n} question${n === 1 ? "" : "s"}`;
}

function renderView() {
  if (!rawResult) return;

  const count = questionCount(rawResult.questionCount);

  if (viewSelect.value === "normalized") {
    const analysis = analyzeResult(rawResult);
    if (analysis.ok) {
      output.value = JSON.stringify(analysis.result, null, 2);
      countLabel.textContent = `${count} · normalized`;
    } else if (analysis.error === "not built") {
      output.value = NOT_BUILT_HINT + "\n\n" + JSON.stringify(rawResult, null, 2);
      countLabel.textContent = "";
    } else {
      output.value = "Analysis failed: " + analysis.error + "\n\n" + JSON.stringify(rawResult, null, 2);
      countLabel.textContent = "";
    }
    return;
  }

  output.value = JSON.stringify(rawResult, null, 2);
  countLabel.textContent = count;
}

viewSelect.addEventListener("change", renderView);

async function requestScan() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url || !tab.url.startsWith("https://docs.google.com/forms/")) {
    output.value =
      "Not a Google Form.\n\nOpen a form at docs.google.com/forms/... and try again.";
    countLabel.textContent = "";
    rawResult = null;
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "SCAN_FORM" }, (response) => {
    if (chrome.runtime.lastError) {
      output.value =
        "Couldn't reach the page.\n\nReload the form tab and try again:\n" +
        chrome.runtime.lastError.message;
      countLabel.textContent = "";
      rawResult = null;
      return;
    }
    if (response?.ok) {
      rawResult = response.result;
      renderView();
    } else {
      output.value = "Scan failed: " + (response?.error || "unknown error");
      countLabel.textContent = "";
      rawResult = null;
    }
  });
}

scanBtn.addEventListener("click", requestScan);

async function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  if (!ok) throw new Error("copy failed");
}

copyBtn.addEventListener("click", async () => {
  if (!output.value) return;
  const original = copyBtn.textContent;
  try {
    await copyToClipboard(output.value);
    copyBtn.textContent = "Copied";
  } catch (err) {
    copyBtn.textContent = "Copy failed";
  } finally {
    setTimeout(() => (copyBtn.textContent = original), 1200);
  }
});

// Show the cached scan immediately, if it belongs to the form that's actually
// open right now. Showing a scan from a *different* form would be misleading,
// and the user can hit "Scan form" to refresh this one.
chrome.storage.local.get("lastScan", async (data) => {
  if (!data.lastScan) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url === data.lastScan.url) {
    rawResult = data.lastScan;
    renderView();
  }
});