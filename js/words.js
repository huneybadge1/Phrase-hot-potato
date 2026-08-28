// Word pool loading and draw logic with a 15-minute repeat cooldown, plus
// difficulty-swing dampening so consecutive words move through nearby
// difficulty tiers instead of lurching between hard and easy — that
// lurch (a team struggles with a hard word, then the very next team
// breezes through a trivial one) is the specific unfairness this targets,
// not just avoiding same-tier streaks.
// Session-only: lastShownAt resets on reload.
const WordBank = (() => {
  const COOLDOWN_MS = 15 * 60 * 1000;

  // Selection weight by how many difficulty tiers away a candidate is
  // from the last drawn word (0 = same tier, 1 = adjacent, 2 = opposite
  // ends). Adjacent tiers are favored over repeating the same tier, and
  // a full jump (hard straight to easy or back) is heavily discounted —
  // still possible, just uncommon, so it never feels mechanical.
  const DIFFICULTY_DISTANCE_WEIGHTS = { 0: 0.5, 1: 1.0, 2: 0.2 };

  let pool = []; // [{ phrase, category, difficulty, lastShownAt }]
  let activeCategories = null; // null = all categories active
  let lastDifficulty = null;

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
    if (lastDifficulty === null) return 1; // no prior word yet — unbiased
    const distance = Math.abs(difficulty - lastDifficulty);
    return DIFFICULTY_DISTANCE_WEIGHTS[distance] ?? 1;
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
    lastDifficulty = chosen.difficulty;
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
