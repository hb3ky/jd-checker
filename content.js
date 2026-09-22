// ─────────────────────────────────────────────
//  SINGLE SOURCE OF TRUTH for scanning
//  Badge AND popup both read from lastScanResult
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

let lastScanResult = null;
const occurrenceIndex = new Map(); // term -> next occurrence to jump to

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scanPage() {
  const bodyText = document.body?.innerText || "";
  if (!bodyText.trim()) return null;

  const flagged = [];
  KEYWORDS.forEach(({ term, label }) => {
    const regex = new RegExp(escapeRegex(term), "gi");
    const matches = [...bodyText.matchAll(regex)];
    if (matches.length > 0) flagged.push({ term, label, count: matches.length });
  });

  return {
    flagged,
    url: window.location.href,
    title: document.title || location.hostname,
    scannedAt: Date.now()
  };
}

function runScanAndReport() {
  const result = scanPage();
  if (!result) return;
  lastScanResult = result;
  chrome.runtime.sendMessage({ type: "SCAN_UPDATE", ...result }).catch(() => {});
}

// ── Initial scan after render delay ──
function initialScan() {
  setTimeout(runScanAndReport, 1200);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialScan);
} else {
  initialScan();
}

// ── Re-scan automatically whenever the page content changes ──
// This is what fixes the Omnicell bug: dynamic/SPA job boards that
// render the JD text after the initial page load now get caught.
let mutationTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(mutationTimer);
  mutationTimer = setTimeout(runScanAndReport, 800);
});
observer.observe(document.body, { childList: true, subtree: true, characterData: true });

// Stop watching after 20s so long-lived tabs don't churn CPU forever
setTimeout(() => observer.disconnect(), 20000);

// ─────────────────────────────────────────────
//  Respond to popup requests
// ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_LATEST_SCAN") {
    // Rescan fresh right now — guarantees popup always matches page's true state
    const fresh = scanPage();
    if (fresh) lastScanResult = fresh;
    sendResponse(lastScanResult);
    return true;
  }

  if (message.type === "SCROLL_TO_KEYWORD") {
    scrollToKeyword(message.term);
    sendResponse({ ok: true });
    return true;
  }
});

// ─────────────────────────────────────────────
//  Scroll to + highlight a keyword occurrence
//  Clicking the same keyword again cycles to the next match
// ─────────────────────────────────────────────
function scrollToKeyword(term) {
  const regex = new RegExp(escapeRegex(term), "i");
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !regex.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
      const parentTag = node.parentElement?.tagName;
      if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(parentTag)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  if (nodes.length === 0) return;

  const idx = (occurrenceIndex.get(term) || 0) % nodes.length;
  occurrenceIndex.set(term, idx + 1);

  const el = nodes[idx].parentElement;
  if (!el) return;

  el.scrollIntoView({ behavior: "smooth", block: "center" });

  const originalBg = el.style.backgroundColor;
  el.style.transition = "background-color 0.3s ease";
  el.style.backgroundColor = "#fde047";
  setTimeout(() => { el.style.backgroundColor = originalBg; }, 1800);
}