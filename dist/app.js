"use strict";
(async () => {
  await window.LaGradaContent.ready;
  const main = document.querySelector("#main");
  const dialog = document.querySelector("#detail");
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const displayRecord = (value) =>
    typeof value === "string"
      ? esc(value)
      : Array.isArray(value)
        ? value.map(displayRecord)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value).map(([k, v]) => [k, displayRecord(v)]),
            )
          : value;
  const normalize = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  let storageAvailable = true;
  function read(key, fallback) {
    try {
      const v = localStorage.getItem("lagrada-" + key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem("lagrada-" + key, JSON.stringify(value));
    } catch {
      storageAvailable = false;
      toast("Browser storage is unavailable. Progress lasts for this visit.");
    }
  }
  const localDay = (d = new Date()) =>
    [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  const dayIndex = (day) =>
    Math.floor(Date.parse(day + "T00:00:00Z") / 86400000);
  let today = localDay();
  let saved = read("favorites", []);
  if (!Array.isArray(saved)) saved = [];
  let results = read("results", {});
  if (!results || typeof results !== "object" || Array.isArray(results))
    results = {};
  let club = read("club", "");
  if (typeof club !== "string") club = "";
  let mode = "daily",
    practiceIndex = 0,
    feedback = "",
    search = "",
    clubFilter = "all";
  function freshGame(index) {
    return {
      id: GAME_PLAYERS[index % GAME_PLAYERS.length].id,
      turn: 0,
      guesses: [],
      status: "playing",
    };
  }
  function dailyGame() {
    const expected = freshGame(dayIndex(today));
    const g = read("daily-" + today, expected);
    return g &&
      g.id === expected.id &&
      Number.isInteger(g.turn) &&
      g.turn >= 0 &&
      g.turn < 6 &&
      Array.isArray(g.guesses) &&
      ["playing", "won", "lost"].includes(g.status)
      ? g
      : expected;
  }
  let game = dailyGame();
  function ensureDay() {
    const now = localDay();
    if (now !== today) {
      today = now;
      if (mode === "daily") {
        game = dailyGame();
        feedback = "A new daily challenge is ready.";
      }
    }
  }
  function saveGame() {
    if (mode === "daily") write("daily-" + today, game);
  }
  function getPlayer() {
    return GAME_PLAYERS.find((p) => p.id === game.id);
  }
  function clues(p) {
    return [
      `My role on the pitch: ${p.position.toLowerCase()}.`,
      `I represented ${p.nation} internationally.`,
      `An early chapter: ${p.origin}.`,
      `My featured Spanish club is ${p.club} (${p.years}).`,
      p.fact,
      `My name starts with “${p.name[0]}”. It has ${p.name.replace(/[^\p{L}]/gu, "").length} letters.`,
    ];
  }
  function streak() {
    let n = 0;
    let index = dayIndex(today);
    if (results[today] !== "won") index--;
    for (let i = index; i > index - 1000; i--) {
      const date = new Date(i * 86400000).toISOString().slice(0, 10);
      if (results[date] !== "won") break;
      n++;
    }
    return n;
  }
  function endGame(status) {
    game.status = status;
    if (mode === "daily") {
      results[today] = status;
      write("results", results);
    }
    saveGame();
  }
  function submitGuess(raw) {
    ensureDay();
    if (game.status !== "playing")
      return { ok: false, message: "This round has finished." };
    const value = raw.trim();
    if (!value) {
      feedback = "Enter a player’s name first.";
      refreshGame();
      return { ok: false, message: feedback };
    }
    if (value.length > 80) {
      feedback = "Please enter a shorter name.";
      refreshGame();
      return { ok: false, message: feedback };
    }
    const n = normalize(value);
    const p = getPlayer();
    if (game.guesses.some((g) => normalize(g) === n)) {
      feedback = "You already tried that name. Try another or reveal a clue.";
      refreshGame();
      return { ok: false, message: feedback };
    }
    game.guesses.push(value);
    if ([p.name, ...p.aliases].some((a) => normalize(a) === n)) {
      endGame("won");
      feedback = "Correct!";
    } else if (game.turn === 5) {
      endGame("lost");
      feedback = "All six clues used.";
    } else {
      game.turn++;
      feedback = "Not quite. Here’s another clue.";
      saveGame();
    }
    refreshGame();
    return {
      ok: true,
      status: game.status,
      clueNumber: game.turn + 1,
      message: feedback,
    };
  }
  function skipClue() {
    ensureDay();
    if (game.status !== "playing") return;
    if (game.turn === 5) {
      endGame("lost");
      feedback = "Here’s the player behind the clues.";
    } else {
      game.turn++;
      feedback = "Another piece of the puzzle.";
      saveGame();
    }
    refreshGame();
  }
  function gameMarkup() {
    const p = getPlayer();
    const done = game.status !== "playing";
    return `<article class="game-card" id="game-card"><div class="card-top"><span class="pill">${mode === "daily" ? "THE DAILY GUESS" : "PRACTICE ROUND"}</span><span>${mode === "daily" ? new Date(today + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Play at your own pace"}</span></div><div class="game-intro"><div><h2>${done ? (game.status === "won" ? "You know your football." : "One for the memory bank.") : "You know the game.<br>Do you know the player?"}</h2><p>${done ? (mode === "daily" ? "Your daily result is saved on this browser." : "Practice rounds don’t affect your daily streak.") : "Six clues. One name. How soon can you spot the player?"}</p></div><span class="question-mark" aria-hidden="true">${done ? (game.status === "won" ? "!" : "?") : "?"}</span></div>${
      done
        ? `<div class="game-result"><span class="eyebrow">${game.status === "won" ? `SOLVED WITH ${game.turn + 1} OF 6 CLUES` : "THE ANSWER WAS"}</span><h3>${p.name}</h3><p>${p.nation} · ${p.club}<br>${p.fact}</p><div class="result-buttons"><a class="dark-button" href="#player/${p.id}">Explore the player ↗</a><button class="text-button" data-action="practice">Play a practice round</button>${mode === "practice" ? '<button class="text-button" data-action="daily">Back to daily</button>' : ""}</div></div>`
        : `<div class="clue"><span>CLUE ${String(game.turn + 1).padStart(2, "0")} / 06</span><p>${clues(p)[game.turn]}</p>${
            game.turn > 0
              ? `<details class="previous-clues"><summary>Earlier clues</summary><ol>${clues(
                  p,
                )
                  .slice(0, game.turn)
                  .map((c) => `<li>${c}</li>`)
                  .join("")}</ol></details>`
              : ""
          }</div><form id="guess-form"><label class="sr-only" for="guess-input">Player name</label><input id="guess-input" name="guess" maxlength="80" placeholder="Type a player's name…" autocomplete="off" aria-describedby="guess-feedback"><button class="dark-button" type="submit">Make a guess ↗</button></form><div class="game-actions"><div class="clue-dots" aria-label="${game.turn + 1} of 6 clues revealed">${Array.from({ length: 6 }, (_, i) => `<span class="${i <= game.turn ? "filled" : ""}"></span>`).join("")}</div><button data-action="skip">${game.turn === 5 ? "Reveal answer" : "Skip to next clue"}</button></div>`
    }<p class="guess-feedback" id="guess-feedback" role="status">${esc(feedback)}</p>${game.guesses.length ? `<div class="guess-history">Your guesses: ${game.guesses.map(esc).join(" · ")}</div>` : ""}<p class="game-foot">${mode === "daily" ? "A new player every day · Resets at your local midnight" : "Just for fun · Explore all 30 players"}${!storageAvailable ? " · Progress cannot be saved" : ""}</p></article>`;
  }
  function refreshGame() {
    const holder = document.querySelector("#game-card");
    if (holder) {
      holder.outerHTML = gameMarkup();
      document.querySelector("#guess-input")?.focus();
    }
    const current = document.querySelector("#streak-number");
    if (current) current.textContent = streak();
    const solved = document.querySelector("#solved-number");
    if (solved)
      solved.textContent = Object.values(results).filter(
        (x) => x === "won",
      ).length;
  }
  function playerCard(raw) {
    const p = displayRecord(raw);
    return `<article class="player-card"><div class="player-cover ${p.color}"><span class="initials">${p.initials}</span><span class="player-number">${p.joined}<br>SPANISH CHAPTER</span></div><div class="player-info"><h3>${p.name}</h3><p>${p.nation} · ${p.position}</p><p>${p.club}</p></div><a class="player-open" href="#player/${p.id}" aria-label="Explore ${p.name}"></a><button class="favorite" data-save="${p.id}" aria-pressed="${saved.includes(p.id)}" aria-label="${saved.includes(p.id) ? "Unsave" : "Save"} ${p.name}">${saved.includes(p.id) ? "♥" : "♡"}</button></article>`;
  }
  function storyCard(raw) {
    const s = displayRecord(raw);
    return `<article class="story-card"><span class="story-category">${s.category} / ${s.year}</span><h3><a href="#story/${s.id}">${s.title}</a></h3><p>${s.subtitle}</p><div class="story-bottom"><span>${s.read}</span><a href="#story/${s.id}" aria-label="Read ${s.title}">Read story ↗</a></div></article>`;
  }
  function heading(title, eyebrow = "THE LA LIGA COLLECTION", sub = "") {
    return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${sub ? `<p class="page-subtitle">${sub}</p>` : ""}</div><span class="edition">LA LIGA EDITION <span>01</span></span></div>`;
  }
  function feature() {
    if (!STORIES.some((s) => s.id === "messi-fifty"))
      return `<article class="game-sidebar"><h2>Follow your football curiosity.</h2><p>Explore the published stories in our collection.</p><a class="dark-button" href="#discover">Discover ↗</a></article>`;
    return `<article class="feature-story"><img src="https://upload.wikimedia.org/wikipedia/commons/1/18/Imatge_panor%C3%A0mica_del_Camp_Nou.jpg" alt="Archival panorama of Camp Nou in 2010"><div class="feature-shade"></div><div class="feature-copy"><span class="pill">FROM THE ARCHIVE</span><h2>The season<br>of fifty.</h2><p>Messi. Barcelona. 2011/12.<br>A league campaign beyond belief.</p><a href="#story/messi-fifty" class="light-link">Inside the story ↗</a></div></article>`;
  }
  function home() {
    return `${heading("A little deeper into football.", "SPAIN. FOOTBALL. OBSESSION.")}<section class="opening" aria-label="Daily game and featured story">${gameMarkup()}${feature()}</section><div class="section-head"><h2>Meet the greats</h2><a href="#players">Explore all ${PLAYERS.length} players ↗</a></div><section class="player-grid home-players" aria-label="Featured players">${PLAYERS.slice(0, 4).map(playerCard).join("")}</section><div class="section-head"><h2>There’s always another story.</h2><a href="#discover">Into the rabbit hole ↗</a></div><section class="story-grid">${STORIES.slice(1, 4).map(storyCard).join("")}</section><div class="manifesto"><span class="mark">✳</span><strong>For the love of the game.</strong><p>${PLAYERS.length} players. ${STORIES.length} stories. One daily challenge. A small corner of the internet for a big football obsession.</p></div>`;
  }
  function play() {
    return `${heading("A name behind every clue.", "THE DAILY FOOTBALL RITUAL")}<div class="game-layout">${gameMarkup()}<aside class="game-sidebar"><h2>Your form</h2><div class="progress-metrics"><div><strong id="streak-number">${streak()}</strong><span>day winning streak</span></div><div><strong id="solved-number">${Object.values(results).filter((x) => x === "won").length}</strong><span>daily games solved</span></div></div><h2>How to play</h2><ol><li>Guess a player from our collection of 30 La Liga greats.</li><li>A wrong guess or skip reveals the next clue. You have six clues in total.</li><li>Names work with or without accents. Try a full name if two players share a surname.</li><li>After the reveal, explore the player’s story or try a practice round.</li></ol><p>Clues describe historical careers, not current squads.</p><button class="text-button" data-action="${mode === "daily" ? "practice" : "daily"}">${mode === "daily" ? "Switch to practice" : "Return to daily challenge"}</button><p class="storage-note">Progress is saved only in this browser. No account needed.</p></aside></div>`;
  }
  const clubs = [...new Set(PLAYERS.map((p) => p.club))].sort();
  function filteredPlayers() {
    return PLAYERS.filter(
      (p) =>
        (clubFilter === "all" || p.club === clubFilter) &&
        normalize(
          p.name + " " + p.nation + " " + p.position + " " + p.club,
        ).includes(normalize(search)),
    );
  }
  function players() {
    return `${heading("Players worth knowing.", `${PLAYERS.length} CAREERS. COUNTLESS CONNECTIONS.`, "A curated historical collection. Club labels refer to featured spells, not current squads.")}<div class="filters"><label class="sr-only" for="player-search">Search players</label><input id="player-search" type="search" value="${esc(search)}" placeholder="Search by name, country, position…"><label class="sr-only" for="club-filter">Filter by featured club</label><select id="club-filter"><option value="all">All featured clubs</option>${clubs.map((c) => `<option${c === clubFilter ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></div><p class="result-count" id="result-count" role="status">${filteredPlayers().length} players</p><section id="player-results" class="player-grid">${filteredPlayers().map(playerCard).join("")}</section><p id="no-players" class="empty" ${filteredPlayers().length ? "hidden" : ""}>No players found. Try a different name or club.</p>`;
  }
  function updatePlayers() {
    const found = filteredPlayers();
    document.querySelector("#player-results").innerHTML = found
      .map(playerCard)
      .join("");
    document.querySelector("#result-count").textContent =
      `${found.length} players`;
    document.querySelector("#no-players").hidden = !!found.length;
  }
  function profile(raw) {
    const p = displayRecord(raw);
    const stats = displayRecord(HISTORICAL_STATS[p.id]);
    const related = STORIES.filter((s) => s.related.includes(p.id));
    return `<a class="breadcrumb" href="#players">← Back to players</a><article class="article"><span class="archive-note">HISTORICAL PLAYER PROFILE</span><div class="profile-hero"><div><p class="eyebrow">${p.nation} · ${p.position}</p><h1>${p.name}</h1></div><span class="profile-initials">${p.initials}</span></div><p class="lead">${p.fact
      .replace(/\bI\b/g, "he")
      .replace(/\bMy\b/g, "His")
      .replace(
        /^he /,
        "He ",
      )}</p><button class="dark-button" data-save="${p.id}" aria-pressed="${saved.includes(p.id)}">${saved.includes(p.id) ? "♥ Saved to your collection" : "♡ Save this player"}</button><div class="section-head"><h2>A few chapters</h2></div><div class="timeline"><p><strong>Early football</strong><br>${p.origin}</p><p><strong>Featured Spanish spell</strong><br>${p.club} · ${p.years}</p><p><strong>International team</strong><br>${p.nation}</p></div>${stats ? `<h2>By the numbers</h2><p class="storage-note">${stats.scope}</p><div class="stats">${stats.values.map((v) => `<div class="stat"><strong>${v[0]}</strong><span>${v[1]}</span></div>`).join("")}</div><p class="source"><a href="${stats.source}" target="_blank" rel="noopener">Official club statistics source ↗</a> · Historical totals, not a current-season feed.</p>` : '<p class="archive-note">Detailed statistics are not yet included for this profile.</p>'}<p class="source">Career reference: <a href="${p.source}" target="_blank" rel="noopener">${p.name} on Wikipedia ↗</a>. Selected milestones, not a complete career timeline. Market valuations are not included.</p>${related.length ? `<div class="section-head"><h2>Keep following the story</h2></div><div class="story-grid related-stories">${related.slice(0, 2).map(storyCard).join("")}</div>` : '<p><a class="dark-button" href="#discover">Explore more football stories ↗</a></p>'}</article>`;
  }
  function discover() {
    return `${heading("Follow your football curiosity.", "THE RABBIT HOLE", "Short reads, unexpected connections, and seasons worth remembering.")}<section class="story-grid discover-grid">${STORIES.map(storyCard).join("")}</section>`;
  }
  function article(raw) {
    const s = displayRecord(raw);
    return `<a class="breadcrumb" href="#discover">← Back to Discover</a><article class="article"><p class="eyebrow">${s.category} · ${s.year} · ${s.read}</p><h1>${s.title}</h1><p class="lead">${s.subtitle}</p>${s.id === "messi-fifty" ? '<figure class="article-image"><img src="https://upload.wikimedia.org/wikipedia/commons/1/18/Imatge_panor%C3%A0mica_del_Camp_Nou.jpg" alt="Camp Nou photographed in 2010"><figcaption>Camp Nou, 2010. Archival image, not a photograph from the 2011/12 season.</figcaption></figure>' : ""}${s.paragraphs.map((p) => `<p>${p}</p>`).join("")}<p class="source">Original La Grada text. Factual references: <a href="${s.source}" target="_blank" rel="noopener">${s.sourceName} ↗</a>${s.extraSource ? ` · <a href="${s.extraSource}" target="_blank" rel="noopener">La Liga champions ↗</a>` : ""}.</p><div class="section-head"><h2>Players in this football world</h2></div><div class="player-grid article-players">${s.related.map((id) => playerCard(PLAYERS.find((p) => p.id === id))).join("")}</div><div class="section-head"><a href="#story/${STORIES[(STORIES.findIndex((item) => item.id === s.id) + 1) % STORIES.length].id}">Next story: ${esc(STORIES[(STORIES.findIndex((item) => item.id === s.id) + 1) % STORIES.length].title)} ↗</a></div></article>`;
  }
  function savedPage() {
    const selected = PLAYERS.filter((p) => saved.includes(p.id));
    return `${heading("Your corner of the clubhouse.", "SAVED & FAVOURITES", "The players you want to come back to. Saved only on this browser.")}<div class="club-preference"><label for="favorite-club"><strong>Your favourite Spanish club</strong></label><select id="favorite-club" class="club-select"><option value="">Choose a club</option>${["Athletic Club", "Atlético Madrid", "Barcelona", "Celta Vigo", "Deportivo La Coruña", "Espanyol", "Getafe", "Girona", "Mallorca", "Osasuna", "Rayo Vallecano", "Real Betis", "Real Madrid", "Real Sociedad", "Sevilla", "Valencia", "Villarreal"].map((c) => `<option${club === c ? " selected" : ""}>${esc(c)}</option>`).join("")}</select><p class="storage-note">A personal preference, saved on this device.</p></div><div class="section-head"><h2>Saved players <span class="muted">(${selected.length})</span></h2></div>${selected.length ? `<section class="player-grid">${selected.map(playerCard).join("")}</section>` : '<div class="empty"><h2>Your collection starts with a favourite.</h2><p>Tap the heart on any player to save them here.</p><a class="dark-button" href="#players">Explore players ↗</a></div>'}`;
  }
  function render() {
    ensureDay();
    const route = location.hash.slice(1) || "home";
    let html,
      title = "Clubhouse";
    if (route === "home") html = home();
    else if (route === "play") {
      html = play();
      title = "Daily game";
    } else if (route === "players") {
      html = players();
      title = "Players";
    } else if (route === "discover") {
      html = discover();
      title = "Discover";
    } else if (route === "saved") {
      html = savedPage();
      title = "Your collection";
    } else if (route.startsWith("player/")) {
      const p = PLAYERS.find((p) => p.id === route.slice(7));
      if (p) {
        html = profile(p);
        title = p.name;
      }
    } else if (route.startsWith("story/")) {
      const s = STORIES.find((s) => s.id === route.slice(6));
      if (s) {
        html = article(s);
        title = s.title;
      }
    }
    main.setAttribute("aria-busy", "false");
    document.querySelector("#content-notice")?.remove();
    if (window.LaGradaContent.source === "bundled") {
      const notice = document.createElement("p");
      notice.id = "content-notice";
      notice.className = "content-notice";
      notice.setAttribute("role", "status");
      notice.textContent =
        "Showing the saved collection. The latest content could not be loaded. Refresh to try again.";
      main.before(notice);
    }
    main.innerHTML =
      html ||
      `${heading("That page is offside.")}<p>We couldn’t find that player or story.</p><a class="dark-button" href="#home">Back to the clubhouse</a>`;
    document.title = title + " — La Grada";
    document.querySelectorAll(".topbar nav a").forEach((a) => {
      const active =
        a.hash === "#" + route ||
        (route.startsWith("player/") && a.hash === "#players") ||
        (route.startsWith("story/") && a.hash === "#discover");
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }
  let toastTimer;
  function toast(msg) {
    const el = document.querySelector("#toast");
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.style.display = "none"), 2600);
  }
  function favorite(id) {
    if (!PLAYERS.some((p) => p.id === id)) throw new Error("Unknown player");
    const existed = saved.includes(id);
    saved = existed ? saved.filter((x) => x !== id) : [...saved, id];
    write("favorites", saved);
    document.querySelectorAll("[data-save]").forEach((b) => {
      if (b.dataset.save === id) {
        b.setAttribute("aria-pressed", String(!existed));
        if (b.classList.contains("favorite")) {
          b.textContent = existed ? "♡" : "♥";
          b.setAttribute(
            "aria-label",
            `${existed ? "Save" : "Unsave"} ${PLAYERS.find((p) => p.id === id).name}`,
          );
        } else
          b.textContent = existed
            ? "♡ Save this player"
            : "♥ Saved to your collection";
      }
    });
    if (location.hash === "#saved") render();
    toast(
      existed
        ? "Player removed from your collection"
        : "Player saved to your collection",
    );
    return { playerId: id, saved: !existed };
  }
  function switchGame(nextMode) {
    ensureDay();
    mode = nextMode;
    feedback = "";
    if (mode === "daily") game = dailyGame();
    else {
      practiceIndex++;
      game = freshGame(dayIndex(today) + practiceIndex);
    }
    if (location.hash !== "#play") location.hash = "play";
    else render();
  }
  document.querySelector(".skip").addEventListener("click", (e) => {
    e.preventDefault();
    main.focus();
    main.scrollIntoView();
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id === "guess-form") {
      e.preventDefault();
      submitGuess(document.querySelector("#guess-input").value);
    }
  });
  document.addEventListener("click", (e) => {
    const save = e.target.closest("[data-save]");
    if (save) {
      favorite(save.dataset.save);
      return;
    }
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "skip") skipClue();
    if (action === "practice" || action === "daily") switchGame(action);
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "player-search") {
      search = e.target.value;
      updatePlayers();
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "club-filter") {
      clubFilter = e.target.value;
      updatePlayers();
    }
    if (e.target.id === "favorite-club") {
      club = e.target.value;
      write("club", club);
      toast(
        club
          ? `${club} saved as your favourite club`
          : "Club preference cleared",
      );
    }
  });
  document
    .querySelector(".close-dialog")
    .addEventListener("click", () => dialog.close());
  document.querySelector("#about-button").addEventListener("click", () => {
    document.querySelector("#dialog-content").innerHTML =
      `<p class="eyebrow">A SMALL, INDEPENDENT FOOTBALL PROJECT</p><h2>For the love of the game.</h2><p>La Grada means “the stands”. This first edition explores Spanish football through historical player profiles, original short reads and a daily guessing game. Published profiles and stories are stored in Supabase and refreshed when you open the site. The daily game uses a fixed historical roster so editorial updates do not change an in-progress round.</p><h3>Our collection</h3><p>This is a curated historical collection, not a live squad database. Club names describe a featured spell. Each player and story links to its factual references; selected statistics show their competition and date range. No live results or market valuations are displayed.</p><h3>Free to explore</h3><p>No paid football feeds, paid AI requests or account signup. Your guesses, streak, favourites and club preference stay in this browser’s storage. Clearing that storage removes your progress.</p><h3>Image credit</h3><p><a href="https://commons.wikimedia.org/wiki/File:Imatge_panor%C3%A0mica_del_Camp_Nou.jpg" target="_blank" rel="noopener">Camp Nou panorama</a> — Javierito92 / Wikimedia Commons, <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a>. Photographed in 2010; cropped for the story card. The site loads this image from Wikimedia, fonts from Google Fonts, and published football content from Supabase. Your game progress and favourites are not sent to Supabase.</p><p>Independent fan project. Not affiliated with La Liga or any football club.</p>`;
    dialog.showModal();
  });
  window.addEventListener("hashchange", () => {
    render();
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      const before = today;
      ensureDay();
      if (before !== today) render();
    }
  });
  render();
  // Progressive WebMCP enhancement; the same actions power the visible controls.
  const context = document.modelContext;
  if (context?.registerTool) {
    const lifecycle = new AbortController();
    const tools = [
      {
        name: "read_guessing_game",
        description:
          "Read the visible guessing round, including revealed clues and result.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: () => ({
          mode,
          status: game.status,
          clues: clues(getPlayer()).slice(0, game.turn + 1),
          guesses: game.guesses,
          ...(game.status !== "playing" ? { answer: getPlayer().name } : {}),
        }),
      },
      {
        name: "submit_player_guess",
        description:
          "Submit a player name to the current round. A wrong guess consumes a clue.",
        inputSchema: {
          type: "object",
          properties: { name: { type: "string", minLength: 1, maxLength: 80 } },
          required: ["name"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input) => {
          if (
            !input ||
            typeof input.name !== "string" ||
            !input.name.trim() ||
            input.name.length > 80
          )
            throw new Error("A player name of 1–80 characters is required.");
          if (!document.querySelector("#game-card")) {
            location.hash = "play";
            render();
          }
          return submitGuess(input.name);
        },
      },
    ];
    for (const tool of tools) {
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    }
    window.addEventListener("pagehide", () => lifecycle.abort(), {
      once: true,
    });
  }
})();
