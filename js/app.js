(() => {
  const MIN_TEAMS = 2;
  const MAX_TEAMS = 8;

  const els = {
    rotateOverlay: document.getElementById("rotate-overlay"),
    app: document.getElementById("app"),

    screenSetup: document.getElementById("screen-setup"),
    teamCount: document.getElementById("team-count"),
    teamMinus: document.getElementById("team-minus"),
    teamPlus: document.getElementById("team-plus"),
    btnStartGame: document.getElementById("btn-start-game"),

    screenIdle: document.getElementById("screen-idle"),
    scoreboard: document.getElementById("scoreboard"),
    btnStartRound: document.getElementById("btn-start-round"),
    btnUndoStrike: document.getElementById("btn-undo-strike"),

    btnCategories: document.getElementById("btn-categories"),
    categoriesModal: document.getElementById("categories-modal"),
    categoryChips: document.getElementById("category-chips"),
    btnCategoriesDone: document.getElementById("btn-categories-done"),

    btnResetGame: document.getElementById("btn-reset-game"),
    resetModal: document.getElementById("reset-modal"),
    btnSoftReset: document.getElementById("btn-soft-reset"),
    btnFullReset: document.getElementById("btn-full-reset"),
    btnCancelReset: document.getElementById("btn-cancel-reset"),

    screenRound: document.getElementById("screen-round"),
    emojiBg: document.getElementById("emoji-bg"),
    wordDisplay: document.getElementById("word-display"),
    categoryDisplay: document.getElementById("category-display"),
    btnGotIt: document.getElementById("btn-got-it"),
    btnSkip: document.getElementById("btn-skip"),

    screenCaught: document.getElementById("screen-caught"),
    caughtTeams: document.getElementById("caught-teams"),
  };

  let teamCount = MIN_TEAMS;

  function showScreen(screen) {
    for (const s of [els.screenSetup, els.screenIdle, els.screenRound, els.screenCaught]) {
      s.hidden = s !== screen;
    }
    if (els.btnResetGame) {
      els.btnResetGame.hidden = screen === els.screenSetup;
    }
  }

  const CATEGORY_LABELS = {
    "people": "People",
    "movies-tv": "Movies & TV",
    "music": "Music",
    "books-characters": "Books & Characters",
    "brands-products": "Brands & Products",
    "food-drink": "Food & Drink",
    "places-landmarks": "Places & Landmarks",
    "animals": "Animals",
    "objects": "Objects",
    "activities-sports": "Activities & Sports",
    "idioms-sayings": "Idioms & Sayings",
    "science-nature": "Science & Nature",
    "internet-slang": "Internet & Slang",
    "events-holidays": "Events & Holidays",
  };

  const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS);
  let activeCategories = new Set(ALL_CATEGORIES);

  // A silly random background color per round, purely cosmetic.
  const ROUND_BACKGROUNDS = [
    "#2d1b4e", "#0f3d3e", "#3d0f1f", "#12351f",
    "#0f1f3d", "#3d2410", "#3d0f2f", "#1f2937",
  ];

  // A silly random emoji pattern per round: 5 rows, alternating scroll
  // direction (rows 1/3/5 right, rows 2/4 left), one randomly-picked
  // emoji shared by all rows for that round.
  const ROUND_EMOJIS = [
    "🎉", "🎊", "🥳", "😂", "🤣", "😎", "🔥", "⭐", "🌟", "💥",
    "🎯", "🎈", "🍕", "🌮", "🍎", "🍩", "🍦", "🐸", "🦄", "🐙",
    "👑", "💃", "🕺", "🎸", "🏆", "⚡", "🌈", "🍀", "👻", "🤪",
  ];
  const EMOJI_ROW_DIRECTIONS = ["right", "left", "right", "left", "right"];

  function renderEmojiBackground() {
    if (!els.emojiBg) return;
    const emoji = ROUND_EMOJIS[Math.floor(Math.random() * ROUND_EMOJIS.length)];
    const unit = (emoji + "    ").repeat(25);
    els.emojiBg.innerHTML = "";
    EMOJI_ROW_DIRECTIONS.forEach((dir) => {
      const row = document.createElement("div");
      row.className = "emoji-row " + (dir === "right" ? "emoji-row-right" : "emoji-row-left");
      row.textContent = unit + unit; // doubled so a -50%/0% loop is seamless
      els.emojiBg.appendChild(row);
    });
  }

  function renderCategoryChips() {
    if (!els.categoryChips) return;
    els.categoryChips.innerHTML = "";
    ALL_CATEGORIES.forEach((cat) => {
      const chip = document.createElement("button");
      chip.className = "category-chip" + (activeCategories.has(cat) ? " active" : "");
      chip.textContent = CATEGORY_LABELS[cat];
      chip.addEventListener("click", () => {
        if (activeCategories.has(cat)) {
          if (activeCategories.size === 1) return; // must keep at least one active
          activeCategories.delete(cat);
        } else {
          activeCategories.add(cat);
        }
        WordBank.setActiveCategories(activeCategories);
        renderCategoryChips();
        updateCategoriesButtonLabel();
      });
      els.categoryChips.appendChild(chip);
    });
  }

  function updateCategoriesButtonLabel() {
    if (!els.btnCategories) return;
    els.btnCategories.textContent = `Categories (${activeCategories.size}/${ALL_CATEGORIES.length})`;
  }

  function renderWord(word) {
    if (!word) return;
    els.wordDisplay.textContent = word.phrase;
    els.categoryDisplay.textContent = CATEGORY_LABELS[word.category] || word.category;
    els.btnSkip.disabled = !Game.isSkipAvailable();
  }

  function renderScoreboard() {
    const teams = Game.getTeams();
    const min = Math.min(...teams.map((t) => t.strikes));
    els.scoreboard.innerHTML = "";
    teams.forEach((team) => {
      const chip = document.createElement("div");
      chip.className = "score-chip" + (team.strikes === min ? " leading" : "");
      chip.innerHTML = `<span class="chip-name">${team.name}</span><span class="chip-strikes">${team.strikes}</span>`;
      els.scoreboard.appendChild(chip);
    });
  }

  function renderCaughtButtons() {
    const teams = Game.getTeams();
    els.caughtTeams.innerHTML = "";
    teams.forEach((team, idx) => {
      const btn = document.createElement("button");
      btn.className = "caught-team-btn";
      btn.textContent = team.name;
      btn.addEventListener("click", () => {
        Game.addStrike(idx);
        renderScoreboard();
        updateUndoButtonVisibility();
        showScreen(els.screenIdle);
      });
      els.caughtTeams.appendChild(btn);
    });
  }

  function updateUndoButtonVisibility() {
    if (!els.btnUndoStrike) return;
    els.btnUndoStrike.hidden = !Game.canUndoStrike();
  }

  function vibrateBuzz() {
    if (navigator.vibrate) {
      navigator.vibrate([300, 100, 300]);
    }
  }

  function onBuzz() {
    vibrateBuzz();
    renderCaughtButtons();
    showScreen(els.screenCaught);
  }

  function onWordChange(word) {
    renderWord(word);
  }

  // ---------- Setup screen ----------
  function updateTeamCountDisplay() {
    els.teamCount.textContent = String(teamCount);
    els.teamMinus.disabled = teamCount <= MIN_TEAMS;
    els.teamPlus.disabled = teamCount >= MAX_TEAMS;
  }

  els.teamMinus.addEventListener("click", () => {
    teamCount = Math.max(MIN_TEAMS, teamCount - 1);
    updateTeamCountDisplay();
  });

  els.teamPlus.addEventListener("click", () => {
    teamCount = Math.min(MAX_TEAMS, teamCount + 1);
    updateTeamCountDisplay();
  });

  els.btnStartGame.addEventListener("click", () => {
    Game.init(teamCount, { onWordChange, onBuzz });
    renderScoreboard();
    updateUndoButtonVisibility();
    showScreen(els.screenIdle);
  });

  els.btnCategories.addEventListener("click", () => {
    els.categoriesModal.hidden = false;
  });

  els.btnCategoriesDone.addEventListener("click", () => {
    els.categoriesModal.hidden = true;
  });

  els.categoriesModal.addEventListener("click", (e) => {
    if (e.target === els.categoriesModal) {
      els.categoriesModal.hidden = true;
    }
  });

  // ---------- Idle screen ----------
  els.btnStartRound.addEventListener("click", () => {
    GameAudio.unlock();
    // Cosmetic flourishes must never be able to block the round itself —
    // if a stale/mismatched cache makes one of these throw, starting the
    // round should still work.
    try {
      els.screenRound.style.backgroundColor =
        ROUND_BACKGROUNDS[Math.floor(Math.random() * ROUND_BACKGROUNDS.length)];
      renderEmojiBackground();
    } catch (err) {
      console.error("Round decoration failed, continuing anyway:", err);
    }
    showScreen(els.screenRound);
    Game.startRound();
  });

  els.btnUndoStrike.addEventListener("click", () => {
    Game.undoLastStrike();
    renderScoreboard();
    updateUndoButtonVisibility();
  });

  els.btnResetGame.addEventListener("click", () => {
    els.resetModal.hidden = false;
  });

  els.btnSoftReset.addEventListener("click", () => {
    els.resetModal.hidden = true;
    Game.stopTimer();
    showScreen(els.screenIdle);
  });

  els.btnFullReset.addEventListener("click", () => {
    els.resetModal.hidden = true;
    Game.stopTimer();
    showScreen(els.screenSetup);
  });

  els.btnCancelReset.addEventListener("click", () => {
    els.resetModal.hidden = true;
  });

  els.resetModal.addEventListener("click", (e) => {
    if (e.target === els.resetModal) {
      els.resetModal.hidden = true;
    }
  });

  // ---------- Round screen ----------
  els.btnGotIt.addEventListener("click", () => {
    Game.gotIt();
  });

  els.btnSkip.addEventListener("click", () => {
    if (Game.skip()) {
      els.btnSkip.disabled = true;
    }
  });

  // ---------- Rotate overlay + round pause/resume ----------
  // A round pauses whenever the phone isn't in landscape (rotated back to
  // portrait, mid-explanation) or the app isn't visible (screen locked,
  // switched to another app) — otherwise the timer would silently keep
  // counting down the whole time nobody can see or hear it.
  const pauseBlockers = { portrait: false, hidden: false };

  function updatePauseState() {
    if (pauseBlockers.portrait || pauseBlockers.hidden) {
      Game.pauseRound();
    } else {
      Game.resumeRound();
    }
  }

  function checkOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth;
    els.rotateOverlay.hidden = !isPortrait;
    pauseBlockers.portrait = isPortrait;
    updatePauseState();
  }

  window.addEventListener("resize", checkOrientation);
  window.addEventListener("orientationchange", checkOrientation);

  document.addEventListener("visibilitychange", () => {
    pauseBlockers.hidden = document.hidden;
    updatePauseState();
  });

  // Best-effort landscape lock: only works on platforms that support the
  // Screen Orientation API for installed apps (mainly Android). No-ops
  // silently everywhere else — iOS Safari doesn't support this at all,
  // which is why the pause-on-portrait handling above is the real fix.
  function tryLockOrientation() {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock("landscape").catch(() => {});
    }
  }

  // ---------- Boot ----------
  async function boot() {
    updateTeamCountDisplay();
    checkOrientation();
    tryLockOrientation();
    renderCategoryChips();
    updateCategoriesButtonLabel();
    showScreen(els.screenSetup);

    try {
      await WordBank.load();
    } catch (err) {
      els.wordDisplay.textContent = "Could not load word list.";
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("sw.js")
        .then((reg) => reg.update())
        .catch(() => {});

      // As soon as a new service worker takes control (i.e. an update was
      // found and installed), reload once so the new version is actually
      // shown — otherwise a stale PWA can sit on an old cached version
      // indefinitely with no visible sign anything changed.
      let reloadedForUpdate = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloadedForUpdate) return;
        reloadedForUpdate = true;
        window.location.reload();
      });
    }
  }

  boot();
})();
