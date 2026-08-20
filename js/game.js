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

const Game = (() => {
  let teams = [];
  let currentWord = null;
  let skipUsed = false;
  let endTime = 0;
  let totalDurationMs = 0;
  let beepTimeoutId = null;
  let lastStrikeTeamIndex = null;
  let roundActive = false;
  let paused = false;
  let pausedRemainingMs = null;

  let callbacks = { onWordChange: () => {}, onBuzz: () => {} };

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

  function addStrike(teamIndex) {
    teams[teamIndex].strikes += 1;
    lastStrikeTeamIndex = teamIndex;
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
    callbacks.onWordChange(currentWord);
    tick();
  }

  function tick() {
    const remainingMs = endTime - Date.now();
    if (remainingMs <= 0) {
      clearTimeout(beepTimeoutId);
      roundActive = false;
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
    skipUsed = false;
    currentWord = WordBank.draw();
    callbacks.onWordChange(currentWord);
  }

  function skip() {
    if (skipUsed) return false;
    skipUsed = true;
    currentWord = WordBank.draw();
    callbacks.onWordChange(currentWord);
    return true;
  }

  function isSkipAvailable() {
    return !skipUsed;
  }

  return {
    init,
    getTeams,
    addStrike,
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
