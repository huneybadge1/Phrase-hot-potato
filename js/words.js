// Word pool loading and draw logic with a 15-minute repeat cooldown.
// Session-only: lastShownAt resets on reload.
const WordBank = (() => {
  const COOLDOWN_MS = 15 * 60 * 1000;

  let pool = []; // [{ phrase, category, lastShownAt }]
  let activeCategories = null; // null = all categories active

  async function load() {
    const res = await fetch("catchphrase-words.json");
    const raw = await res.json();
    pool = raw.map((entry) => ({
      phrase: entry.phrase,
      category: entry.category,
      lastShownAt: 0,
    }));
    return pool.length;
  }

  function setActiveCategories(categories) {
    activeCategories = categories ? new Set(categories) : null;
  }

  function activePool() {
    if (!activeCategories) return pool;
    return pool.filter((w) => activeCategories.has(w.category));
  }

  function draw() {
    const candidatePool = activePool();
    if (candidatePool.length === 0) return null;
    const now = Date.now();
    const eligible = candidatePool.filter((w) => now - w.lastShownAt >= COOLDOWN_MS);
    const candidates = eligible.length > 0 ? eligible : leastRecentlyShown(candidatePool);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    chosen.lastShownAt = now;
    return chosen;
  }

  function leastRecentlyShown(fromPool) {
    let min = Infinity;
    for (const w of fromPool) min = Math.min(min, w.lastShownAt);
    return fromPool.filter((w) => w.lastShownAt === min);
  }

  function size() {
    return pool.length;
  }

  return { load, draw, size, setActiveCategories };
})();
