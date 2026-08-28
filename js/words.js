// Word pool loading and draw logic with a 15-minute repeat cooldown, plus
// lightweight difficulty balancing so hard words don't cluster together
// and swing the game unfairly between teams.
// Session-only: lastShownAt resets on reload.
const WordBank = (() => {
  const COOLDOWN_MS = 15 * 60 * 1000;

  // How many of the most recent draws to look back at when balancing.
  // A candidate's selection weight drops the more its difficulty tier has
  // shown up in that recent window, so e.g. three "hard" words rarely
  // land back-to-back — probabilistic, not a strict alternation, so it
  // doesn't feel mechanically predictable.
  const RECENT_DIFFICULTY_WINDOW = 3;

  let pool = []; // [{ phrase, category, difficulty, lastShownAt }]
  let activeCategories = null; // null = all categories active
  let recentDifficulties = [];

  async function load() {
    const res = await fetch("catchphrase-words.json");
    const raw = await res.json();
    pool = raw.map((entry) => ({
      phrase: entry.phrase,
      category: entry.category,
      difficulty: entry.difficulty || 2,
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

  function difficultyWeight(difficulty) {
    const recentCount = recentDifficulties.filter((d) => d === difficulty).length;
    return 1 / (1 + recentCount);
  }

  function weightedPick(candidates) {
    const weights = candidates.map((c) => difficultyWeight(c.difficulty));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  function draw() {
    const candidatePool = activePool();
    if (candidatePool.length === 0) return null;
    const now = Date.now();
    const eligible = candidatePool.filter((w) => now - w.lastShownAt >= COOLDOWN_MS);
    const candidates = eligible.length > 0 ? eligible : leastRecentlyShown(candidatePool);
    const chosen = weightedPick(candidates);
    chosen.lastShownAt = now;

    recentDifficulties.push(chosen.difficulty);
    if (recentDifficulties.length > RECENT_DIFFICULTY_WINDOW) {
      recentDifficulties.shift();
    }

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
