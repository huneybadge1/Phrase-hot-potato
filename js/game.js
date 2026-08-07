// Core game state machine: round timing, accelerating beep schedule, teams/scoring.
const MIN_ROUND_SECONDS = 60;
const MAX_ROUND_SECONDS = 105;

const MIN_BEEP_INTERVAL_MS = 140;
const MAX_BEEP_INTERVAL_MS = 1500;
const BEEP_EASING_POWER = 2.2;

// The easing curve asymptotically approaches MIN_BEEP_INTERVAL_MS and stays
// there (audibly indistinguishable) for a long final stretch of every round.
// Once the natural interval gets this close to the floor, freeze the tempo
// at whatever pace it was holding just before crossing that line, instead of
// riding the curve all the way down into a many-second frantic buzz.
const FINAL_STRETCH_THRESHOLD_MS = MIN_BEEP_INTERVAL_MS * 1.2;

const Game = (() => {
  let teams = [];
  let currentWord = null;
  let skipUsed = false;
  let endTime = 0;
  let totalDurationMs = 0;
  let beepTimeoutId = null;
  let lastBeepInterval = MAX_BEEP_INTERVAL_MS;
  let frozenTailInterval = null;

  let callbacks = { onWordChange: () => {}, onBuzz: () => {} };

  function init(teamCount, cb) {
    teams = Array.from({ length: teamCount }, (_, i) => ({
      name: `Team ${i + 1}`,
      strikes: 0,
    }));
    callbacks = { ...callbacks, ...cb };
  }

  function getTeams() {
    return teams;
  }

  function addStrike(teamIndex) {
    teams[teamIndex].strikes += 1;
  }

  function startRound() {
    const seconds =
      MIN_ROUND_SECONDS + Math.random() * (MAX_ROUND_SECONDS - MIN_ROUND_SECONDS);
    totalDurationMs = seconds * 1000;
    endTime = Date.now() + totalDurationMs;
    skipUsed = false;
    lastBeepInterval = MAX_BEEP_INTERVAL_MS;
    frozenTailInterval = null;
    currentWord = WordBank.draw();
    callbacks.onWordChange(currentWord);
    tick();
  }

  function tick() {
    const remainingMs = endTime - Date.now();
    if (remainingMs <= 0) {
      clearTimeout(beepTimeoutId);
      GameAudio.buzzer();
      callbacks.onBuzz();
      return;
    }
    let interval;
    if (frozenTailInterval !== null) {
      interval = frozenTailInterval;
    } else {
      const frac = Math.max(0, Math.min(1, remainingMs / totalDurationMs));
      const eased = Math.pow(frac, BEEP_EASING_POWER);
      const natural =
        MIN_BEEP_INTERVAL_MS + (MAX_BEEP_INTERVAL_MS - MIN_BEEP_INTERVAL_MS) * eased;

      if (natural <= FINAL_STRETCH_THRESHOLD_MS) {
        // Entering the frantic floor — hold at the previous (slower) pace,
        // evenly, for the rest of the round instead of converging further.
        frozenTailInterval = lastBeepInterval;
        interval = frozenTailInterval;
      } else {
        interval = natural;
      }
    }

    interval = Math.min(interval, remainingMs);
    lastBeepInterval = interval;
    beepTimeoutId = setTimeout(() => {
      GameAudio.beep();
      tick();
    }, interval);
  }

  function stopTimer() {
    clearTimeout(beepTimeoutId);
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
    startRound,
    stopTimer,
    gotIt,
    skip,
    isSkipAvailable,
  };
})();
