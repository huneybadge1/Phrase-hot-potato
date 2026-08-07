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

    btnResetGame: document.getElementById("btn-reset-game"),

    screenRound: document.getElementById("screen-round"),
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
    els.btnResetGame.hidden = screen === els.screenSetup;
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
        showScreen(els.screenIdle);
      });
      els.caughtTeams.appendChild(btn);
    });
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
    showScreen(els.screenIdle);
  });

  // ---------- Idle screen ----------
  els.btnStartRound.addEventListener("click", () => {
    GameAudio.unlock();
    showScreen(els.screenRound);
    Game.startRound();
  });

  els.btnResetGame.addEventListener("click", () => {
    if (confirm("Reset the game? This clears all strikes and returns to team setup.")) {
      Game.stopTimer();
      showScreen(els.screenSetup);
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

  // ---------- Rotate overlay ----------
  function checkOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth;
    els.rotateOverlay.hidden = !isPortrait;
  }

  window.addEventListener("resize", checkOrientation);
  window.addEventListener("orientationchange", checkOrientation);

  // ---------- Boot ----------
  async function boot() {
    updateTeamCountDisplay();
    checkOrientation();
    showScreen(els.screenSetup);

    try {
      await WordBank.load();
    } catch (err) {
      els.wordDisplay.textContent = "Could not load word list.";
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  boot();
})();
