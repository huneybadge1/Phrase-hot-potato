// Core game state machine: round timing, accelerating beep schedule, teams/scoring.
const MIN_ROUND_SECONDS = 60;
const MAX_ROUND_SECONDS = 105;

// The fastest tier (formerly MIN_BEEP_INTERVAL_MS = 140) read as too
// frantic. Raising the floor here reshapes the whole easing curve
// proportionally across the entire round — every beep from the first to
// the last gets slightly slower, not just a stretched-out final tier — so
// the round still smoothly spans start to buzzer with no plateau.
const MIN_BEEP_INTERVAL_MS = 180;
const MAX_BEEP_INTERVAL_MS = 1500;

// A power of 1 (linear) spends roughly equal wall-clock time in every
// speed tier from MAX down to MIN. Below 1 skews time toward the slow
// end (lingers longer, fast end is brief); above 1 skews it back toward
// the fast end (which is what made the original 2.2 curve feel like it
// stayed frantic for too long near the buzzer).
const BEEP_EASING_POWER = 1;

// If Got It is tapped this close to the buzzer, grant a short "sudden
// death" extension instead of leaving the next team with virtually no
// chance to react. Can chain: if the next team also passes it off within
// the (extended) threshold, it extends again.
const LATE_GOTIT_THRESHOLD_MS = 5000;
const LATE_GOTIT_EXTENSION_MS = 5000;

const Game = (() => {
  let teams = [];
  let currentWord = null;
  let wordShownAt = 0;
  let skipUsed = false;
  let endTime = 0;
  let totalDurationMs = 0;
  let beepTimeoutId = null;
  let lastStrikeTeamIndex = null;
  let roundActive = false;
  let paused = false;
  let pausedRemainingMs = null;
  let maxStrikes = null; // null = no limit

  let callbacks = {
    onWordChange: () => {},
    onBuzz: () => {},
    onBonusTime: () => {},
    onWordResolved: () => {}, // (word, outcome, elapsedMs) — for local play-stat logging
  };

  function init(teamCount, cb) {
    teams = Array.from({ length: teamCount }, (_, i) => ({
      name: `Team ${i + 1}`,
      strikes: 0,
    }));
    lastStrikeTeamIndex = null;
    callbacks = { ...callbacks, ...cb };
  }

  function getTeams() {
    return teams;
  }

  function setMaxStrikes(value) {
    maxStrikes = value; // number, or null for no limit
  }

  function getMaxStrikes() {
    return maxStrikes;
  }

  function isGameOver() {
    if (maxStrikes === null) return false;
    return teams.some((t) => t.strikes >= maxStrikes);
  }

  // Team(s) with the fewest strikes — ties are all returned.
  function getWinners() {
    if (teams.length === 0) return [];
    const min = Math.min(...teams.map((t) => t.strikes));
    return teams.filter((t) => t.strikes === min);
  }

  function addStrike(teamIndex) {
    teams[teamIndex].strikes += 1;
    lastStrikeTeamIndex = teamIndex;
  }

  function removeStrike(teamIndex) {
    const team = teams[teamIndex];
    if (!team || team.strikes <= 0) return false;
    team.strikes -= 1;
    return true;
  }

  function canUndoStrike() {
    return lastStrikeTeamIndex !== null;
  }

  function undoLastStrike() {
    if (lastStrikeTeamIndex === null) return false;
    const team = teams[lastStrikeTeamIndex];
    if (team.strikes > 0) team.strikes -= 1;
    lastStrikeTeamIndex = null;
    return true;
  }

  function resolveCurrentWord(outcome) {
    if (!currentWord) return;
    const elapsed = Date.now() - wordShownAt;
    callbacks.onWordResolved(currentWord, outcome, elapsed);
  }

  function startRound() {
    const seconds =
      MIN_ROUND_SECONDS + Math.random() * (MAX_ROUND_SECONDS - MIN_ROUND_SECONDS);
    totalDurationMs = seconds * 1000;
    endTime = Date.now() + totalDurationMs;
    skipUsed = false;
    roundActive = true;
    paused = false;
    pausedRemainingMs = null;
    currentWord = WordBank.draw();
    wordShownAt = Date.now();
    callbacks.onWordChange(currentWord);
    tick();
  }

  function tick() {
    const remainingMs = endTime - Date.now();
    if (remainingMs <= 0) {
      clearTimeout(beepTimeoutId);
      roundActive = false;
      resolveCurrentWord("buzzed");
      GameAudio.buzzer();
      callbacks.onBuzz();
      return;
    }
    const frac = Math.max(0, Math.min(1, remainingMs / totalDurationMs));
    const eased = Math.pow(frac, BEEP_EASING_POWER);
    let interval =
      MIN_BEEP_INTERVAL_MS + (MAX_BEEP_INTERVAL_MS - MIN_BEEP_INTERVAL_MS) * eased;
    interval = Math.min(interval, remainingMs);
    beepTimeoutId = setTimeout(() => {
      GameAudio.beep();
      tick();
    }, interval);
  }

  function stopTimer() {
    clearTimeout(beepTimeoutId);
    roundActive = false;
    paused = false;
    pausedRemainingMs = null;
  }

  // Freezes the countdown (no more beeps, no more elapsing time) — used
  // when the phone rotates back to portrait or the app loses visibility
  // (backgrounded, screen locked) mid-round, so a round can't silently
  // burn through its whole remaining time while nobody can see or hear it.
  function pauseRound() {
    if (!roundActive || paused) return;
    paused = true;
    pausedRemainingMs = endTime - Date.now();
    clearTimeout(beepTimeoutId);
  }

  function resumeRound() {
    if (!roundActive || !paused) return;
    paused = false;
    endTime = Date.now() + pausedRemainingMs;
    pausedRemainingMs = null;
    tick();
  }

  function gotIt() {
    if (roundActive) {
      const remainingMs = paused ? pausedRemainingMs : endTime - Date.now();
      if (remainingMs > 0 && remainingMs <= LATE_GOTIT_THRESHOLD_MS) {
        if (paused) {
          pausedRemainingMs += LATE_GOTIT_EXTENSION_MS;
        } else {
          endTime += LATE_GOTIT_EXTENSION_MS;
        }
        totalDurationMs += LATE_GOTIT_EXTENSION_MS;
        callbacks.onBonusTime();
      }
    }
    resolveCurrentWord("gotIt");
    skipUsed = false;
    currentWord = WordBank.draw();
    wordShownAt = Date.now();
    callbacks.onWordChange(currentWord);
  }

  function skip() {
    if (skipUsed) return false;
    skipUsed = true;
    resolveCurrentWord("skip");
    currentWord = WordBank.draw();
    wordShownAt = Date.now();
    callbacks.onWordChange(currentWord);
    return true;
  }

  function isSkipAvailable() {
    return !skipUsed;
  }

  return {
    init,
    getTeams,
    setMaxStrikes,
    getMaxStrikes,
    isGameOver,
    getWinners,
    addStrike,
    removeStrike,
    canUndoStrike,
    undoLastStrike,
    startRound,
    stopTimer,
    pauseRound,
    resumeRound,
    gotIt,
    skip,
    isSkipAvailable,
  };
})();
