// ─────────────────────────────────────────────
//  BACKGROUND SERVICE WORKER
//  Receives auto-scan results, updates badge, fires notification
// ─────────────────────────────────────────────

const BADGE_COLORS = {
  flagged: "#dc2626", // red
  clean:   "#16a34a"  // green
};

// Track last notified URL to avoid duplicate alerts on re-renders
const notifiedUrls = new Set();

chrome.runtime.onInstalled.addListener(() => {
  console.log("JD Disqualifier Checker v3.0 installed.");
  // Clear badge on install
  chrome.action.setBadgeText({ text: "" });
});

// Clear badge when user navigates away
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    chrome.action.setBadgeText({ text: "", tabId });
  }
});

// ── Receive scan results from content.js ──
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== "AUTO_SCAN_RESULT") return;

  const { flagged, url, title } = message;
  const tabId = sender.tab?.id;
  if (!tabId) return;

  const hasFlagged = flagged.length > 0;

  // ── Update extension badge ──
  if (hasFlagged) {
    const count = flagged.length;
    chrome.action.setBadgeText({ text: count.toString(), tabId });
    chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS.flagged, tabId });
    chrome.action.setTitle({
      title: `⛔ ${count} disqualifier${count > 1 ? "s" : ""} found — click to review`,
      tabId
    });
  } else {
    chrome.action.setBadgeText({ text: "✓", tabId });
    chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS.clean, tabId });
    chrome.action.setTitle({
      title: "✅ No disqualifiers — safe to generate resume",
      tabId
    });
  }

  // ── Fire desktop notification only for flagged pages ──
  // Deduplicate: only notify once per unique URL per session
  if (hasFlagged && !notifiedUrls.has(url)) {
    notifiedUrls.add(url);

    const uniqueLabels = [...new Set(flagged.map(f => f.label))];
    const labelList    = uniqueLabels.join(" · ");
    const pageTitle    = title.length > 40 ? title.slice(0, 40) + "…" : title;

    chrome.notifications.create({
      type:     "basic",
      iconUrl:  "icons/icon128.png",
      title:    "⛔ JD DISQUALIFIER DETECTED",
      message:  `${pageTitle}`,
      contextMessage: labelList,
      priority: 2,
      requireInteraction: false
    });
  }
});