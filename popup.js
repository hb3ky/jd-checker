const scanBtn = document.getElementById("scanBtn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

scanBtn.addEventListener("click", runScreen);
runScreen(); // auto-run the moment the popup opens

async function runScreen() {
  scanBtn.disabled = true;
  statusEl.textContent = "Checking this page...";
  resultsEl.innerHTML = "";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    statusEl.textContent = "Error: Could not access the current tab.";
    scanBtn.disabled = false;
    return;
  }

  let result;
  try {
    result = await chrome.tabs.sendMessage(tab.id, { type: "GET_LATEST_SCAN" });
  } catch {
    statusEl.textContent = "Page not ready yet — try again in a moment.";
    scanBtn.disabled = false;
    return;
  }

  if (!result) {
    statusEl.textContent = "No content found on this page yet.";
    scanBtn.disabled = false;
    return;
  }

  statusEl.textContent = "";
  renderResumeScreen(result.flagged, tab.id);
  scanBtn.disabled = false;
}

function renderResumeScreen(flagged, tabId) {
  if (flagged.length > 0) {
    resultsEl.innerHTML = `
      <div class="warning-card">
        <div class="warning-title">⛔ DISQUALIFIER DETECTED</div>
        <div class="warning-subtitle">
          This job description contains ${flagged.length} disqualifying term${flagged.length > 1 ? "s" : ""}.
          Do <strong>not</strong> generate a resume for this role.
        </div>
        <div class="exit-banner">⛔ EXIT — DO NOT PROCEED</div>
        <div class="flagged-keywords" id="flaggedTags"></div>
      </div>
      <div class="mode-hint">Click a term to jump to it on the page.</div>
    `;

    const tagWrap = document.getElementById("flaggedTags");
    flagged.forEach(f => {
      const tag = document.createElement("span");
      tag.className = "flagged-tag";
      tag.textContent = `${f.label} (${f.count}×)`;
      tag.style.cursor = "pointer";
      tag.addEventListener("click", () => jumpToKeyword(tabId, f.term));
      tagWrap.appendChild(tag);
    });
  } else {
    resultsEl.innerHTML = `
      <div class="proceed-card">
        <div class="proceed-title">✅ NO DISQUALIFIERS FOUND</div>
        <div class="proceed-subtitle">
          No clearance, hybrid, onsite, in-person, travel, or FedRAMP requirements detected.
          This role appears to be <strong>fully remote</strong>.
        </div>
        <div class="proceed-banner">✅ PROCEED — SAFE TO GENERATE RESUME</div>
      </div>
    `;
  }
}
//https://drive.google.com/file/d/1tyQtRjHivjhm5BBUTja7QHWnF_GU4mf2/view?usp=sharing
async function jumpToKeyword(tabId, term) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "SCROLL_TO_KEYWORD", term });
    window.close(); // close the popup so you can see the page scroll/highlight
  } catch (err) {
    console.error("Could not jump to keyword:", err);
  }
}
