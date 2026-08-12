// ─────────────────────────────────────────────
//  KEYWORDS — matches your AI resume prompt exactly
// ─────────────────────────────────────────────
const KEYWORDS = [
  { term: "clearance",     label: "Clearance"     },
  { term: "hybrid",        label: "Hybrid"        },
  { term: "on-site",       label: "On-Site"       },
  { term: "onsite",        label: "Onsite"        },
  { term: "in-person",     label: "In-Person"     },
  { term: "in person",     label: "In Person"     },
  { term: "travel",        label: "Travel"        },
  { term: "travel-office", label: "Travel-Office" },
  { term: "fedramp",       label: "FedRAMP"       }
];

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
let currentMode = "resume"; // "resume" | "scan"

const scanBtn   = document.getElementById("scanBtn");
const statusEl  = document.getElementById("status");
const resultsEl = document.getElementById("results");
const modeHint  = document.getElementById("modeHint");

const HINTS = {
  resume: "Mirrors your AI prompt: EXIT on any disqualifier · PROCEED if fully remote.",
  scan:   "Shows every keyword hit with context snippets — no pass/fail verdict."
};

const BTN_LABELS = {
  resume: "Run Resume Screen",
  scan:   "Scan This Page"
};

// ─────────────────────────────────────────────
//  MODE TOGGLE
// ─────────────────────────────────────────────
document.getElementById("modeResume").addEventListener("click", () => setMode("resume"));
document.getElementById("modeScan").addEventListener("click",   () => setMode("scan"));

function setMode(mode) {
  currentMode = mode;
  document.getElementById("modeResume").classList.toggle("active", mode === "resume");
  document.getElementById("modeScan").classList.toggle("active",   mode === "scan");
  scanBtn.textContent = BTN_LABELS[mode];
  modeHint.textContent = HINTS[mode];
  statusEl.textContent = "";
  resultsEl.innerHTML  = "";
}

// ─────────────────────────────────────────────
//  SCAN BUTTON
// ─────────────────────────────────────────────
scanBtn.addEventListener("click", async () => {
  scanBtn.disabled     = true;
  statusEl.textContent = "Scanning page...";
  resultsEl.innerHTML  = "";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.id) {
    statusEl.textContent = "Error: Could not access the current tab.";
    scanBtn.disabled = false;
    return;
  }

  let response;
  try {
    response = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func:   scanPageForKeywords,
      args:   [KEYWORDS.map(k => k.term)]
    });
  } catch {
    statusEl.textContent = "Error: Cannot scan this page (restricted URL).";
    scanBtn.disabled = false;
    return;
  }

  const rawResults = response[0].result;

  // Merge label info back in
  const results = rawResults.map(r => ({
    ...r,
    label: KEYWORDS.find(k => k.term === r.keyword)?.label || r.keyword
  }));

  statusEl.textContent = "";

  if (currentMode === "resume") {
    renderResumeScreen(results);
  } else {
    renderFullScan(results);
  }

  scanBtn.disabled = false;
});

// ─────────────────────────────────────────────
//  RESUME SCREEN MODE
// ─────────────────────────────────────────────
function renderResumeScreen(results) {
  const flagged = results.filter(r => r.count > 0);

  if (flagged.length > 0) {
    // ── DISQUALIFIED — show WARNING + EXIT
    const uniqueLabels = [...new Set(flagged.map(r => r.label))];

    resultsEl.innerHTML = `
      <div class="warning-card">
        <div class="warning-title">⛔ DISQUALIFIER DETECTED</div>
        <div class="warning-subtitle">
          This job description contains ${flagged.length} disqualifying term${flagged.length > 1 ? "s" : ""}.
          Do <strong>not</strong> generate a resume for this role.
        </div>
        <div class="exit-banner">⛔ EXIT — DO NOT PROCEED</div>
        <div class="flagged-keywords">
          ${uniqueLabels.map(l => `<span class="flagged-tag">${escapeHtml(l)}</span>`).join("")}
        </div>
      </div>
      <div class="keyword-list" id="resumeContextList"></div>
    `;

    // Show expandable context for each flagged keyword
    const list = document.getElementById("resumeContextList");
    flagged.forEach(result => {
      const item = buildKeywordItem(result);
      list.appendChild(item);
    });

  } else {
    // ── CLEAN — show PROCEED
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

// ─────────────────────────────────────────────
//  FULL SCAN MODE
// ─────────────────────────────────────────────
function renderFullScan(results) {
  const totalFound = results.filter(r => r.count > 0).length;

  if (totalFound === 0) {
    resultsEl.innerHTML = `
      <div class="result-summary clean">✅ No disqualifiers found — JD looks clean.</div>`;
    return;
  }

  const summary = document.createElement("div");
  summary.className = "result-summary flagged";
  summary.innerHTML = `⚠️ ${totalFound} disqualifier${totalFound > 1 ? "s" : ""} found on this page.`;
  resultsEl.appendChild(summary);

  const list = document.createElement("div");
  list.className = "keyword-list";
  results.filter(r => r.count > 0).forEach(result => {
    list.appendChild(buildKeywordItem(result));
  });
  resultsEl.appendChild(list);
}

// ─────────────────────────────────────────────
//  SHARED: Expandable keyword item
// ─────────────────────────────────────────────
function buildKeywordItem(result) {
  const uid = result.keyword.replace(/\s+/g, "-");
  const item = document.createElement("div");
  item.className = "keyword-item";

  const header = document.createElement("div");
  header.className = "keyword-header";
  header.innerHTML = `
    <div class="keyword-name">
      <span class="dot found"></span>
      ${escapeHtml(result.label || result.keyword.toUpperCase())}
    </div>
    <div style="display:flex;align-items:center;gap:8px;">
      <span class="count-badge">${result.count}×</span>
      <span class="chevron" id="chev-${uid}">▼</span>
    </div>
  `;

  const contextBox = document.createElement("div");
  contextBox.className = "keyword-contexts";

  result.contexts.forEach(ctx => {
    const ctxEl = document.createElement("div");
    ctxEl.className = "context-item";
    ctxEl.innerHTML = highlightKeyword(ctx, result.keyword);
    contextBox.appendChild(ctxEl);
  });

  header.addEventListener("click", () => {
    const isOpen = contextBox.classList.toggle("open");
    document.getElementById(`chev-${uid}`)?.classList.toggle("open", isOpen);
  });

  item.appendChild(header);
  item.appendChild(contextBox);
  return item;
}

// ─────────────────────────────────────────────
//  UTILS
// ─────────────────────────────────────────────
function highlightKeyword(text, keyword) {
  return escapeHtml(text).replace(
    new RegExp(`(${escapeRegex(keyword)})`, "gi"),
    "<mark>$1</mark>"
  );
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─────────────────────────────────────────────
//  PAGE SCANNER — injected into the active tab
// ─────────────────────────────────────────────
function scanPageForKeywords(keywords) {
  const bodyText = document.body.innerText || "";
  return keywords.map(keyword => {
    const regex   = new RegExp(keyword, "gi");
    const matches = [...bodyText.matchAll(regex)];
    const count   = matches.length;
    const seen    = new Set();
    const contexts = [];

    matches.slice(0, 5).forEach(match => {
      const idx     = match.index;
      const start   = Math.max(0, idx - 80);
      const end     = Math.min(bodyText.length, idx + keyword.length + 80);
      const snippet = bodyText.slice(start, end).replace(/\s+/g, " ").trim();
      if (!seen.has(snippet)) { seen.add(snippet); contexts.push(snippet); }
    });

    return { keyword, count, contexts };
  });
}