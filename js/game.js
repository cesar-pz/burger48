(() => {
  const SIZE = 4;
  const SLIDE_MS = 110;
  const VECTORS = {
    up: { r: -1, c: 0 }, down: { r: 1, c: 0 },
    left: { r: 0, c: -1 }, right: { r: 0, c: 1 },
  };
  const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const sup = n => String(n).split("").map(d => SUPERSCRIPT[d]).join("");

  const $ = id => document.getElementById(id);
  const tilesEl = $("tiles");
  const els = new Map(); // tile id -> element

  let grid, score, best, won, keepPlaying, over, sauce, nextId = 1;
  let godRun = 0, godRunning = false, cheated = false;

  best = Number(storage("get", "burger48-best")) || 0;

  // ---------- game state ----------

  function resetBoard() {
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    score = 0; won = false; keepPlaying = false; over = false;
    tilesEl.innerHTML = "";
    els.clear();
    hideMessage();
  }

  function newGame() {
    godRun++; // cancels a god mode run in progress
    godRunning = false; cheated = false;
    $("board").classList.remove("god");
    resetBoard();
    sauce = SAUCES[Math.floor(Math.random() * SAUCES.length)];
    addRandom(); addRandom();
    renderRecipe();
    render();
    updateScore(0);
  }

  function emptyCells() {
    const cells = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (!grid[r][c]) cells.push([r, c]);
    return cells;
  }

  function addRandom() {
    const cells = emptyCells();
    if (!cells.length) return;
    const [r, c] = cells[Math.floor(Math.random() * cells.length)];
    grid[r][c] = { id: nextId++, value: Math.random() < 0.9 ? 2 : 4, r, c, anim: "new" };
  }

  function eachTile(fn) {
    for (const row of grid) for (const t of row) if (t) fn(t);
  }

  function move(dir, spawn = true) {
    if (over || (won && !keepPlaying)) return;
    const v = VECTORS[dir];
    const rows = [...Array(SIZE).keys()];
    const cols = [...Array(SIZE).keys()];
    if (v.r === 1) rows.reverse();
    if (v.c === 1) cols.reverse();

    eachTile(t => { t.merged = false; t.anim = null; });

    let moved = false, gained = 0;
    const dying = [], made = [];

    for (const r of rows) for (const c of cols) {
      const t = grid[r][c];
      if (!t) continue;
      let nr = r, nc = c, target = null;
      while (true) {
        const tr = nr + v.r, tc = nc + v.c;
        if (tr < 0 || tr >= SIZE || tc < 0 || tc >= SIZE) break;
        const o = grid[tr][tc];
        if (!o) { nr = tr; nc = tc; continue; }
        if (o.value === t.value && !o.merged) target = o;
        break;
      }
      if (target) {
        const value = t.value * 2;
        grid[r][c] = null;
        grid[target.r][target.c] = { id: nextId++, value, r: target.r, c: target.c, merged: true, anim: "merged" };
        t.r = target.r; t.c = target.c;
        dying.push(t, target);
        gained += value; made.push(value); moved = true;
      } else if (nr !== r || nc !== c) {
        grid[r][c] = null; grid[nr][nc] = t;
        t.r = nr; t.c = nc; moved = true;
      }
    }

    if (!moved) return;
    if (spawn) addRandom();
    render(dying);
    setTimeout(() => dying.forEach(t => { els.get(t.id)?.remove(); els.delete(t.id); }), SLIDE_MS + 20);
    updateScore(gained);

    if (made.includes(64)) pineappleEffect();
    if (made.includes(1024)) sauceEffect();
    if (godRunning) return; // god mode shows its own finale
    if (made.includes(2048) && !won) {
      won = true;
      setTimeout(() => showMessage("win"), 400);
    } else if (!movesAvailable()) {
      over = true;
      setTimeout(() => showMessage("lose"), 400);
    }
  }

  function movesAvailable() {
    if (emptyCells().length) return true;
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        const v = grid[r][c].value;
        if (r + 1 < SIZE && grid[r + 1][c].value === v) return true;
        if (c + 1 < SIZE && grid[r][c + 1].value === v) return true;
      }
    return false;
  }

  // ---------- rendering ----------

  function tileArt(value) {
    const i = tierIndexFor(value);
    const tier = TIERS[i];
    return tier.icon ? `<img src="${tier.icon}" alt="">` : burgerSVG(i, sauce);
  }

  function createTile(t) {
    const tier = TIERS[tierIndexFor(t.value)];
    const n = Math.log2(t.value);
    const el = document.createElement("div");
    el.className = "tile";
    el.style.setProperty("--tile-bg", tier.tile);
    el.innerHTML = `
      <div class="tile-inner ${t.anim ? "anim-" + t.anim : ""}" ${t.delay != null ? `style="--delay:${t.delay}ms"` : ""} title="${t.value} = 2${sup(n)} · ${n} layer${n > 1 ? "s" : ""}">
        ${tileArt(t.value)}
        <span class="badge">2${sup(n)} = ${t.value}</span>
      </div>`;
    return el;
  }

  function render(dying = []) {
    const live = new Set();
    const all = [];
    eachTile(t => all.push(t));
    for (const t of [...all, ...dying]) {
      live.add(t.id);
      let el = els.get(t.id);
      if (!el) {
        el = createTile(t);
        el.style.setProperty("--r", t.r);
        el.style.setProperty("--c", t.c);
        tilesEl.appendChild(el);
        els.set(t.id, el);
      }
      el.style.setProperty("--r", t.r);
      el.style.setProperty("--c", t.c);
      if (dying.includes(t)) el.classList.add("dying");
    }
    for (const [id, el] of els) if (!live.has(id)) { el.remove(); els.delete(id); }
  }

  function updateScore(gained) {
    score += gained;
    if (score > best && !cheated) { best = score; storage("set", "burger48-best", best); }
    $("score").textContent = score;
    $("best").textContent = best;
    if (gained) {
      const pop = document.createElement("span");
      pop.className = "score-pop";
      pop.textContent = "+" + gained;
      $("score-box").appendChild(pop);
      setTimeout(() => pop.remove(), 700);
    }
  }

  function renderRecipe() {
    $("recipe").innerHTML = TIERS.map((tier, i) => {
      const n = i + 1;
      const name = tier.key === "sauce" ? `${sauce.name}` : tier.name;
      return `
        <li>
          <span class="recipe-art" style="--tile-bg:${tier.tile}">${tier.icon ? `<img src="${tier.icon}" alt="">` : burgerSVG(i, sauce)}</span>
          <span class="recipe-name">${name}${tier.effect ? ` <button class="fx-tag" data-fx="${tier.effect}" title="Preview">▶ ${tier.effect === "pineapple" ? "screen FX" : "sound FX"}</button>` : ""}</span>
          <span class="recipe-math"><b>${tier.value}</b> = 2${sup(n)}</span>
          <span class="recipe-layers">${n} layer${n > 1 ? "s" : ""}</span>
        </li>`;
    }).join("");
    $("sauce-name").textContent = sauce.name;
  }

  const MESSAGES = {
    win: ["Order up! 🍔", () => "You stacked all 11 layers: 2¹¹ = 2048. A complete burger!"],
    lose: ["Kitchen's closed!", () => `No more moves. Final score: ${score}`],
    god: ["GOD MODE 🍔✨", () => "16 complete burgers! 16 × 2048 = 2⁴ × 2¹¹ = 2¹⁵ = 32,768"],
  };

  function showMessage(kind) {
    const m = $("message");
    const [title, text] = MESSAGES[kind];
    m.dataset.kind = kind;
    $("message-title").textContent = title;
    $("message-text").textContent = text();
    $("keep-going").hidden = kind === "lose";
    m.hidden = false;
  }

  function hideMessage() { $("message").hidden = true; }

  // ---------- effects ----------

  function pineappleEffect() {
    const app = $("app"), fx = $("fx");
    app.classList.remove("pineapple-mode");
    void app.offsetWidth;
    app.classList.add("pineapple-mode");

    const banner = document.createElement("div");
    banner.className = "fx-banner";
    banner.innerHTML = `<strong>PINEAPPLE?!</strong><span>Controversial. Bold. Tropical.</span>`;
    fx.appendChild(banner);

    for (let i = 0; i < 28; i++) {
      const p = document.createElement("span");
      p.className = "fx-fall";
      p.textContent = "🍍";
      p.style.left = Math.random() * 100 + "vw";
      p.style.fontSize = 18 + Math.random() * 28 + "px";
      p.style.animationDelay = Math.random() * 0.8 + "s";
      p.style.animationDuration = 1.6 + Math.random() * 1.2 + "s";
      fx.appendChild(p);
    }
    setTimeout(() => { fx.innerHTML = ""; app.classList.remove("pineapple-mode"); }, 3200);
  }

  let audio;
  function getAudio() {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume(); // browsers start audio paused until a user gesture
    return audio;
  }

  function toast(text, bg, color = "#fff") {
    const el = document.createElement("div");
    el.className = "fx-toast";
    el.style.setProperty("--sauce", bg);
    el.style.color = color;
    el.textContent = text;
    $("fx").appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  function sauceEffect() {
    try {
      const audio = getAudio();
      const t = audio.currentTime;

      // squirt: filtered noise sweeping down
      const len = Math.floor(audio.sampleRate * 0.45);
      const buf = audio.createBuffer(1, len, audio.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const noise = audio.createBufferSource();
      noise.buffer = buf;
      const bp = audio.createBiquadFilter();
      bp.type = "bandpass"; bp.Q.value = 4;
      bp.frequency.setValueAtTime(2200, t);
      bp.frequency.exponentialRampToValueAtTime(250, t + 0.4);
      const ng = audio.createGain();
      ng.gain.setValueAtTime(0.001, t);
      ng.gain.exponentialRampToValueAtTime(0.7, t + 0.03);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      noise.connect(bp).connect(ng).connect(audio.destination);
      noise.start(t);

      // splat: quick low thump
      const osc = audio.createOscillator();
      const og = audio.createGain();
      osc.frequency.setValueAtTime(190, t + 0.38);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.55);
      og.gain.setValueAtTime(0.001, t);
      og.gain.setValueAtTime(0.6, t + 0.38);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(og).connect(audio.destination);
      osc.start(t + 0.38); osc.stop(t + 0.62);
    } catch (e) { /* audio unavailable */ }

    toast(`*SQUIRT* ${sauce.name}!`, sauce.color, sauce.key === "mayo" ? "#8A6A3A" : "#fff");
  }

  // Rising note for each god mode beat (C major scale, one step per doubling).
  const SCALE = [523, 587, 659, 698, 784, 880, 988, 1047, 1175, 1319];
  function chime(freqs) {
    try {
      const audio = getAudio();
      const t = audio.currentTime;
      for (const f of [].concat(freqs)) {
        const osc = audio.createOscillator();
        const g = audio.createGain();
        osc.type = "triangle";
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.connect(g).connect(audio.destination);
        osc.start(t); osc.stop(t + 0.55);
      }
    } catch (e) { /* audio unavailable */ }
  }

  // ---------- god mode ----------
  // Every beat the full board slides and merges, then the emptied half refills
  // with the new value, so all 16 tiles gain a layer at once: 2 → 4 → … → 2048.

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function fillEmpty(value) {
    for (const [r, c] of emptyCells())
      grid[r][c] = { id: nextId++, value, r, c, anim: "new", delay: 100 + (r + c) * 35 };
    render();
  }

  async function godMode() {
    const run = ++godRun;
    godRunning = true; cheated = true;
    resetBoard();
    updateScore(0);
    $("board").classList.add("god");
    toast("GOD MODE", "#F0C44A");
    chime([523, 659, 784]);

    fillEmpty(2);
    await sleep(900);

    const dirs = ["left", "up", "right", "down"];
    for (let step = 0; step < 10; step++) {
      if (run !== godRun) return;
      move(dirs[step % 4], false);
      chime(SCALE[step]);
      const value = 4 << step;
      await sleep(260);
      if (run !== godRun) return;
      fillEmpty(value);
      // linger on the pineapple and sauce beats so their effects land
      await sleep(value === 64 || value === 1024 ? 1500 : 480);
    }
    if (run !== godRun) return;
    chime([1047, 1319, 1568, 2093]);
    godRunning = false; won = true;
    await sleep(500);
    if (run === godRun) showMessage("god");
  }

  // ---------- input ----------

  const KEYS = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right",
  };
  const KONAMI = "arrowup arrowup arrowdown arrowdown arrowleft arrowright arrowleft arrowright b a";
  let recentKeys = [];

  document.addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    recentKeys = [...recentKeys, e.key.toLowerCase()].slice(-10);
    if (recentKeys.join(" ") === KONAMI) {
      e.preventDefault();
      recentKeys = [];
      godMode();
      return;
    }
    const dir = KEYS[e.key] || KEYS[e.key.toLowerCase()];
    if (!dir) return;
    e.preventDefault();
    if (!godRunning) move(dir);
  });

  let touchStart = null;
  const board = $("board");
  board.addEventListener("touchstart", e => {
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  board.addEventListener("touchend", e => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
    touchStart = null;
    if (godRunning || Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  });

  $("new-game").addEventListener("click", newGame);
  $("try-again").addEventListener("click", newGame);
  $("keep-going").addEventListener("click", () => { keepPlaying = true; hideMessage(); });
  $("recipe").addEventListener("click", e => {
    const fx = e.target.closest("[data-fx]")?.dataset.fx;
    if (fx === "pineapple") pineappleEffect();
    if (fx === "sauce") sauceEffect();
  });
  $("show-numbers").addEventListener("change", e => {
    document.body.classList.toggle("show-numbers", e.target.checked);
    storage("set", "burger48-numbers", e.target.checked ? "1" : "0");
  });
  if (storage("get", "burger48-numbers") === "1") {
    $("show-numbers").checked = true;
    document.body.classList.add("show-numbers");
  }

  // Debug helpers for previewing effects from the console.
  window.burger = { pineapple: pineappleEffect, sauce: sauceEffect, god: godMode, win: () => showMessage("win") };

  function storage(op, key, value) {
    try {
      return op === "get" ? localStorage.getItem(key) : localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  newGame();
})();
