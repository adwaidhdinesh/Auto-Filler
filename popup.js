const output = document.getElementById("output");
const countLabel = document.getElementById("count");
const scanBtn = document.getElementById("scanBtn");
const copyBtn = document.getElementById("copyBtn");

function render(result) {
  output.value = JSON.stringify(result, null, 2);
  countLabel.textContent = result?.questionCount
    ? `${result.questionCount} question${result.questionCount === 1 ? "" : "s"}`
    : "";
}

async function requestScan() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url || !tab.url.startsWith("https://docs.google.com/forms/")) {
    output.value =
      "Not a Google Form.\n\nOpen a form at docs.google.com/forms/... and try again.";
    countLabel.textContent = "";
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "SCAN_FORM" }, (response) => {
    if (chrome.runtime.lastError) {
      output.value =
        "Couldn't reach the page.\n\nReload the form tab and try again:\n" +
        chrome.runtime.lastError.message;
      countLabel.textContent = "";
      return;
    }
    if (response?.ok) {
      render(response.result);
    } else {
      output.value = "Scan failed: " + (response?.error || "unknown error");
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
  if (tab && tab.url === data.lastScan.url) render(data.lastScan);
});
