const BADGE_COLORS = { flagged: "#dc2626", clean: "#16a34a" };
const notifiedUrls = new Set();

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: "" });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    chrome.action.setBadgeText({ text: "", tabId });
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== "SCAN_UPDATE") return;

  const { flagged, url, title } = message;
  const tabId = sender.tab?.id;
  if (!tabId) return;

  const hasFlagged = flagged.length > 0;

  if (hasFlagged) {
    const count = flagged.length;
    chrome.action.setBadgeText({ text: count.toString(), tabId });
    chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS.flagged, tabId });
    chrome.action.setTitle({ title: `⛔ ${count} disqualifier${count > 1 ? "s" : ""} found`, tabId });
  } else {
    chrome.action.setBadgeText({ text: "✓", tabId });
    chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS.clean, tabId });
    chrome.action.setTitle({ title: "✅ No disqualifiers — safe to generate resume", tabId });
  }

  if (hasFlagged && !notifiedUrls.has(url)) {
    notifiedUrls.add(url);
    const uniqueLabels = [...new Set(flagged.map(f => f.label))];
    const pageTitle = title.length > 40 ? title.slice(0, 40) + "…" : title;

    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "⛔ JD DISQUALIFIER DETECTED",
      message: pageTitle,
      contextMessage: uniqueLabels.join(" · "),
      priority: 2
    });
  }
});