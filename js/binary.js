// Secret binary visualizer. Open it with ↑ ↑ ↓ Space ↑ ↑ ↑ (or the #binary URL hash).
// Each digit shows its place as a power of 2, and the full expansion is
// written out step by step: 110 = (1 × 2²) + (1 × 2¹) + (0 × 2⁰) = … = 6.
(() => {
  const MAX_DIGITS = 16;
  const DEFAULT_DIGITS = 3; // the class PCB has 3 mode switches (modes 0–7)
  const CODE = "up up down space up up up";
  const TOKENS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", " ": "space" };
  const CODE_LEN = CODE.split(" ").length;

  const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const sup = n => String(n).split("").map(d => SUPERSCRIPT[d]).join("");
  const fmt = n => n.toLocaleString("en-US");

  let digits = DEFAULT_DIGITS;
  const bits = Array(MAX_DIGITS).fill(0); // bits[i] is the 2^i place
  let open = false, lastFocus = null, flashPlace = null;

  // ---------- DOM ----------

  const root = document.createElement("div");
  root.className = "bv";
  root.hidden = true;
  root.innerHTML = `
    <div class="bv-panel" role="dialog" aria-modal="true" aria-labelledby="bv-title">
      <header class="bv-head">
        <div>
          <h2 id="bv-title">Binary Decoder</h2>
          <p class="bv-sub">Tap a digit to flip it between <b>0</b> (off) and <b>1</b> (on).</p>
        </div>
        <button class="bv-close" data-act="close" aria-label="Close binary decoder">✕</button>
      </header>

      <div class="bv-toolbar">
        <div class="bv-stepper" role="group" aria-label="Number of digits">
          <button class="bv-btn" data-act="fewer" aria-label="Fewer digits">−</button>
          <span class="bv-count"><b id="bv-digits"></b> <span id="bv-digits-word"></span></span>
          <button class="bv-btn" data-act="more" aria-label="More digits">+</button>
        </div>
        <div class="bv-actions">
          <button class="bv-btn" data-act="dec" title="Count down">−1</button>
          <button class="bv-btn" data-act="inc" title="Count up">+1</button>
          <button class="bv-btn bv-btn-soft" data-act="clear">All 0</button>
        </div>
      </div>

      <div class="bv-board">
        <div class="bv-labels" aria-hidden="true">
          <span class="bv-row-bit">Binary digit</span>
          <span class="bv-row-pow">Place</span>
          <span class="bv-row-val">Place value</span>
        </div>
        <div class="bv-groups" id="bv-groups"></div>
      </div>

      <div class="bv-math" aria-live="polite">
        <h3>Let's work it out</h3>
        <ol class="bv-steps" id="bv-steps"></ol>
      </div>

      <p class="bv-range" id="bv-range"></p>
    </div>`;
  document.body.appendChild(root);

  const $ = id => root.querySelector("#" + id);
  const groupsEl = $("bv-groups");
  const stepsEl = $("bv-steps");

  // ---------- rendering ----------

  const value = () => bits.slice(0, digits).reduce((sum, b, i) => sum + b * 2 ** i, 0);

  function setValue(v) {
    for (let i = 0; i < digits; i++) bits[i] = Math.floor(v / 2 ** i) % 2;
  }

  // Places from most significant (left) to least (right).
  const places = () => [...Array(digits).keys()].reverse();

  function render() {
    $("bv-digits").textContent = digits;
    $("bv-digits-word").textContent = digits === 1 ? "digit" : "digits";
    root.querySelector('[data-act="fewer"]').disabled = digits <= 1;
    root.querySelector('[data-act="more"]').disabled = digits >= MAX_DIGITS;

    // Columns, grouped in fours from the right so long numbers stay readable.
    const groups = [];
    places().forEach(p => {
      const g = Math.floor(p / 4);
      (groups[g] = groups[g] || []).push(p);
    });
    groupsEl.innerHTML = groups.reverse().map(g => `
      <div class="bv-group">${g.map(p => `
        <div class="bv-col${bits[p] ? " on" : ""}${p === flashPlace ? " flash" : ""}">
          <button class="bv-bit" data-place="${p}" aria-pressed="${!!bits[p]}"
            aria-label="2 to the power ${p}, worth ${fmt(2 ** p)}: currently ${bits[p]}">
            <span class="bv-digit">${bits[p]}</span>
            <span class="bv-onoff">${bits[p] ? "ON" : "OFF"}</span>
          </button>
          <span class="bv-pow">2${sup(p)}</span>
          <span class="bv-val">${fmt(2 ** p)}</span>
        </div>`).join("")}
      </div>`).join("");

    // Worked steps.
    const term = (p, inner) =>
      `<span class="bv-term${bits[p] ? " on" : ""}${p === flashPlace ? " flash" : ""}">${inner}</span>`;
    const plus = `<span class="bv-op">+</span>`;
    const join = fn => places().map(p => term(p, fn(p))).join(plus);
    // Space the binary number into groups of four, matching the columns above.
    const binary = places().reduce((out, p) => {
      if (p % 4 === 3 || p === digits - 1) out.push("");
      out[out.length - 1] += bits[p];
      return out;
    }, []).map(g => `<span class="bv-nibble">${g}</span>`).join("");

    const steps = [
      [`<span class="bv-binary">${binary}</span><sub class="bv-base">2</sub>`, "Our binary number"],
      [join(p => `(${bits[p]} × 2${sup(p)})`), "Each digit times its place"],
      [join(p => `(${bits[p]} × ${fmt(2 ** p)})`), "Work out the powers of 2"],
      [join(p => fmt(bits[p] * 2 ** p)), "Multiply"],
      [`<span class="bv-answer">${fmt(value())}</span><sub class="bv-base">10</sub>`, "Add them up!"],
    ];
    stepsEl.innerHTML = steps.map(([math, note], i) => `
      <li>
        <span class="bv-eq">${i ? "=" : ""}</span>
        <span class="bv-expr">${math}</span>
        <span class="bv-note">${note}</span>
      </li>`).join("");

    const count = 2 ** digits;
    $("bv-range").innerHTML = `With <b>${digits}</b> ${digits === 1 ? "digit" : "digits"} you can make
      2${sup(digits)} = <b>${fmt(count)}</b> different numbers: <b>0</b> to <b>${fmt(count - 1)}</b>.`;
  }

  function flash(place) {
    flashPlace = place;
    render();
    clearTimeout(flash.t);
    flash.t = setTimeout(() => { flashPlace = null; render(); }, 500);
  }

  function restoreFocus(selector) {
    root.querySelector(selector)?.focus();
  }

  // ---------- actions ----------

  root.addEventListener("click", e => {
    if (e.target === root) return close(); // backdrop
    const bit = e.target.closest("[data-place]");
    if (bit) {
      const p = Number(bit.dataset.place);
      bits[p] ^= 1;
      flash(p);
      restoreFocus(`[data-place="${p}"]`);
      return;
    }
    const act = e.target.closest("[data-act]")?.dataset.act;
    const max = 2 ** digits;
    switch (act) {
      case "close": return close();
      case "fewer": if (digits > 1) { bits[--digits] = 0; } break;
      case "more": if (digits < MAX_DIGITS) digits++; break;
      case "inc": setValue((value() + 1) % max); break;
      case "dec": setValue((value() - 1 + max) % max); break;
      case "clear": bits.fill(0); break;
      default: return;
    }
    flashPlace = null;
    render();
  });

  function show() {
    if (open) return;
    open = true;
    lastFocus = document.activeElement;
    render();
    root.hidden = false;
    document.body.classList.add("bv-open");
    root.querySelector(".bv-bit")?.focus();
  }

  function close() {
    if (!open) return;
    open = false;
    root.hidden = true;
    document.body.classList.remove("bv-open");
    if (location.hash === "#binary") history.replaceState(null, "", location.pathname + location.search);
    lastFocus?.focus?.();
  }

  // ---------- secret code ----------
  // Listens on window in the capture phase so it runs before the game's handler,
  // and keeps the game from moving tiles while the decoder is open.

  let recent = [];
  window.addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    recent = [...recent, TOKENS[e.key] || e.key.toLowerCase()].slice(-CODE_LEN);
    const typed = recent.join(" ");

    if (typed === CODE) {
      e.preventDefault();
      e.stopImmediatePropagation();
      recent = [];
      open ? close() : show();
      return;
    }
    // Space is part of the code: don't let it scroll the page mid-sequence.
    if (e.key === " " && !open && CODE.startsWith(typed + " ")) e.preventDefault();

    if (!open) return;
    e.stopImmediatePropagation(); // the game ignores keys while we're open
    if (e.key === "Escape") { e.preventDefault(); close(); }
    if (e.key === "Tab") trapFocus(e);
  }, true);

  function trapFocus(e) {
    const items = [...root.querySelectorAll("button:not(:disabled)")];
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // Classroom shortcut: bookmark the page with #binary to open straight into the decoder.
  const fromHash = () => { if (location.hash === "#binary") show(); };
  window.addEventListener("hashchange", fromHash);
  fromHash();

  window.binaryDecoder = { open: show, close };
})();
