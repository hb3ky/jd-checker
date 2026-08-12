// ─────────────────────────────────────────────
//  AUTO-SCAN on page load
//  Runs on every page, sends results to background.js
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

// Wait for page to fully render, then scan
function runAutoScan() {
  const bodyText = document.body?.innerText || "";
  if (!bodyText.trim()) return; // empty page, skip

  const flagged = [];

  KEYWORDS.forEach(({ term, label }) => {
    const regex   = new RegExp(term, "gi");
    const matches = [...bodyText.matchAll(regex)];
    if (matches.length > 0) {
      flagged.push({ term, label, count: matches.length });
    }
  });

  // Always report back — background.js decides what to show
  chrome.runtime.sendMessage({
    type:    "AUTO_SCAN_RESULT",
    flagged: flagged,
    url:     window.location.href,
    title:   document.title || window.location.hostname
  });
}

// Use a small delay so dynamic JD pages (React/SPA) finish rendering
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(runAutoScan, 1200));
} else {
  setTimeout(runAutoScan, 1200);
}