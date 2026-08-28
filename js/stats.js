// Local-only play-stat tracking: how often each word gets Got It, Skipped,
// or is still showing when the buzzer hits, and how long it stayed on
// screen. No backend, no network — persisted to localStorage on this one
// device so it survives closing/reopening the app (unlike the in-memory
// 15-minute repeat cooldown, which resets on reload). Exportable as a
// JSON file so it can be handed off later to inform word difficulty.
const PlayStats = (() => {
  const STORAGE_KEY = "catchphrase-play-stats-v1";

  function loadStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      return {};
    }
  }

  function saveStats(stats) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (err) {
      // Storage unavailable/full/private-browsing — never let this break
      // gameplay, just silently skip persisting.
    }
  }

  // outcome: "gotIt" | "skip" | "buzzed"
  function recordOutcome(phrase, category, outcome, elapsedMs) {
    try {
      const stats = loadStats();
      if (!stats[phrase]) {
        stats[phrase] = {
          category,
          shown: 0,
          gotIt: 0,
          skipped: 0,
          buzzed: 0,
          totalMs: 0,
        };
      }
      const entry = stats[phrase];
      entry.shown += 1;
      entry.totalMs += Math.max(0, Math.round(elapsedMs));
      if (outcome === "gotIt") entry.gotIt += 1;
      else if (outcome === "skip") entry.skipped += 1;
      else if (outcome === "buzzed") entry.buzzed += 1;
      saveStats(stats);
    } catch (err) {
      // Never let stats tracking break the actual game.
    }
  }

  function exportBlob() {
    const stats = loadStats();
    const payload = {
      exportedAt: new Date().toISOString(),
      appVersion: typeof APP_VERSION !== "undefined" ? APP_VERSION : null,
      entryCount: Object.keys(stats).length,
      stats,
    };
    return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  }

  function entryCount() {
    return Object.keys(loadStats()).length;
  }

  return { recordOutcome, exportBlob, entryCount };
})();
