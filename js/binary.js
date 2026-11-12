// Secret binary visualizer. Open it with ↑ ↑ ↓ Space ↑ ↑ ↑ (or the #binary / #binary-text URL hash).
// Number tab: each digit shows its place as a power of 2, and the full expansion is
// written out step by step: 110 = (1 × 2²) + (1 × 2¹) + (0 × 2⁰) = … = 6.
// Text tab: each character becomes its ASCII code, and that code becomes one byte.
(() => {
  const MAX_DIGITS = 16;
  const DEFAULT_DIGITS = 3; // the class PCB has 3 mode switches (modes 0–7)
  const BYTE = 8;
  const MAX_TEXT = 16;
  const DEFAULT_TEXT = "Hi!";
  const CODE = "up up down space up up up";
  const TOKENS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", " ": "space" };
  const CODE_LEN = CODE.split(" ").length;

  const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const sup = n => String(n).split("").map(d => SUPERSCRIPT[d]).join("");
  const fmt = n => n.toLocaleString("en-US");
  const esc = s => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  // Bits as an array where bits[i] is the 2^i place.
  const toBits = (v, n) => Array.from({ length: n }, (_, i) => Math.floor(v / 2 ** i) % 2);
  const toValue = (b, n) => b.slice(0, n).reduce((sum, bit, i) => sum + bit * 2 ** i, 0);
  const placesOf = n => [...Array(n).keys()].reverse(); // most significant first
  // Binary digits spaced in groups of four, counted from the right.
  const nibbles = (b, n) => placesOf(n).reduce((out, p) => {
    if (p % 4 === 3 || p === n - 1) out.push("");
    out[out.length - 1] += b[p];
    return out;
  }, []);

  const isAscii = ch => ch.codePointAt(0) < 128;
  const showChar = ch => ch === " " ? "␣" : esc(ch);
  const charName = ch => ch === " " ? "space" : `“${esc(ch)}”`;

  let tab = "number";
  let digits = DEFAULT_DIGITS;
  const bits = Array(MAX_DIGITS).fill(0);
  let text = DEFAULT_TEXT, sel = 0;
  let open = false, lastFocus = null, flashPlace = null;

  // ---------- DOM ----------

  const CHART = [
    ["Capital letters", "ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
    ["Lowercase letters", "abcdefghijklmnopqrstuvwxyz"],
    ["Digits", "0123456789"],
    ["Symbols", " !?.,'@#$%&*+-=/:;()"],
  ];

  const root = document.createElement("div");
  root.className = "bv";
  root.hidden = true;
  root.innerHTML = `
    <div class="bv-panel" role="dialog" aria-modal="true" aria-labelledby="bv-title">
      <header class="bv-head">
        <div>
          <h2 id="bv-title">Binary Decoder</h2>
          <div class="bv-tabs" role="tablist" aria-label="Decoder mode">
            <button class="bv-tab" role="tab" data-tab="number" aria-controls="bv-number">Number → Decimal</button>
            <button class="bv-tab" role="tab" data-tab="text" aria-controls="bv-text-tab">Text → Binary</button>
          </div>
        </div>
        <button class="bv-close" data-act="close" aria-label="Close binary decoder">✕</button>
      </header>

      <section class="bv-section" id="bv-number" role="tabpanel">
        <p class="bv-sub">Tap a digit to flip it between <b>0</b> (off) and <b>1</b> (on).</p>
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
        <div id="bv-num-board"></div>
        <div class="bv-math" aria-live="polite">
          <h3>Let's work it out</h3>
          <ol class="bv-steps" id="bv-num-steps"></ol>
        </div>
        <p class="bv-range" id="bv-range"></p>
      </section>

      <section class="bv-section" id="bv-text-tab" role="tabpanel">
        <p class="bv-sub">Computers can only store numbers, so every character gets a
          <b>code number</b> from a chart called <b>ASCII</b>. Then that number is stored in binary
          using <b>8 digits</b>, called a <b>byte</b>.</p>
        <label class="bv-field">
          <span>Type a message</span>
          <input id="bv-text" type="text" maxlength="${MAX_TEXT}" autocomplete="off" spellcheck="false">
          <button class="bv-btn bv-btn-soft" data-act="text-clear">Clear</button>
        </label>
        <div class="bv-chars" id="bv-chars" role="list" aria-label="Characters in your message"></div>
        <div class="bv-detail" id="bv-detail" aria-live="polite"></div>
        <div class="bv-message" id="bv-message"></div>
        <details class="bv-chart">
          <summary>ASCII code chart <span>(tap a character to add it)</span></summary>
          ${CHART.map(([title, chars]) => `
            <h4>${title}</h4>
            <div class="bv-chart-row">${[...chars].map(ch => `
              <button class="bv-chip" data-add="${esc(ch)}"><b>${showChar(ch)}</b>${ch.charCodeAt(0)}</button>`).join("")}
            </div>`).join("")}
        </details>
      </section>
    </div>`;
  document.body.appendChild(root);

  const $ = id => root.querySelector("#" + id);
  const input = $("bv-text");
  input.value = text;

  // ---------- shared pieces ----------

  // Place-value columns: digit, 2ⁿ, and its value. Interactive ones are buttons.
  function boardHTML(b, n, { interactive = false } = {}) {
    const groups = [];
    placesOf(n).forEach(p => {
      const g = Math.floor(p / 4);
      (groups[g] = groups[g] || []).push(p);
    });
    const tag = interactive ? "button" : "div";
    const col = p => `
      <div class="bv-col${b[p] ? " on" : ""}${p === flashPlace ? " flash" : ""}">
        <${tag} class="bv-bit" ${interactive ? `data-place="${p}" aria-pressed="${!!b[p]}"
          aria-label="2 to the power ${p}, worth ${fmt(2 ** p)}: currently ${b[p]}"` : ""}>
          <span class="bv-digit">${b[p]}</span>
          <span class="bv-onoff">${b[p] ? "ON" : "OFF"}</span>
        </${tag}>
        <span class="bv-pow">2${sup(p)}</span>
        <span class="bv-val">${fmt(2 ** p)}</span>
      </div>`;
    return `
      <div class="bv-board">
        <div class="bv-labels" aria-hidden="true">
          <span class="bv-row-bit">Binary digit</span>
          <span class="bv-row-pow">Place</span>
          <span class="bv-row-val">Place value</span>
        </div>
        <div class="bv-groups">${groups.reverse().map(g => `
          <div class="bv-group">${g.map(col).join("")}</div>`).join("")}
        </div>
      </div>`;
  }

  // The worked expansion from binary to decimal, one line per step.
  function stepsHTML(b, n, finalNote = "Add them up!") {
    const term = (p, inner) =>
      `<span class="bv-term${b[p] ? " on" : ""}${p === flashPlace ? " flash" : ""}">${inner}</span>`;
    const plus = `<span class="bv-op">+</span>`;
    const join = fn => placesOf(n).map(p => term(p, fn(p))).join(plus);
    const binary = nibbles(b, n).map(g => `<span class="bv-nibble">${g}</span>`).join("");
    const steps = [
      [`<span class="bv-binary">${binary}</span><sub class="bv-base">2</sub>`, "Our binary number"],
      [join(p => `(${b[p]} × 2${sup(p)})`), "Each digit times its place"],
      [join(p => `(${b[p]} × ${fmt(2 ** p)})`), "Work out the powers of 2"],
      [join(p => fmt(b[p] * 2 ** p)), "Multiply"],
      [`<span class="bv-answer">${fmt(toValue(b, n))}</span><sub class="bv-base">10</sub>`, finalNote],
    ];
    return steps.map(([math, note], i) => `
      <li>
        <span class="bv-eq">${i ? "=" : ""}</span>
        <span class="bv-expr">${math}</span>
        <span class="bv-note">${note}</span>
      </li>`).join("");
  }

  // ---------- rendering ----------

  function render() {
    root.querySelectorAll(".bv-tab").forEach(t => {
      const on = t.dataset.tab === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
    });
    $("bv-number").hidden = tab !== "number";
    $("bv-text-tab").hidden = tab !== "text";
    tab === "number" ? renderNumber() : renderText();
  }

  function renderNumber() {
    $("bv-digits").textContent = digits;
    $("bv-digits-word").textContent = digits === 1 ? "digit" : "digits";
    root.querySelector('[data-act="fewer"]').disabled = digits <= 1;
    root.querySelector('[data-act="more"]').disabled = digits >= MAX_DIGITS;
    $("bv-num-board").innerHTML = boardHTML(bits, digits, { interactive: true });
    $("bv-num-steps").innerHTML = stepsHTML(bits, digits);
    const count = 2 ** digits;
    $("bv-range").innerHTML = `With <b>${digits}</b> ${digits === 1 ? "digit" : "digits"} you can make
      2${sup(digits)} = <b>${fmt(count)}</b> different numbers: <b>0</b> to <b>${fmt(count - 1)}</b>.`;
  }

  function renderText() {
    const chars = [...text];
    sel = Math.min(sel, Math.max(chars.length - 1, 0));
    root.querySelector('[data-act="text-clear"]').disabled = !chars.length;

    $("bv-chars").innerHTML = chars.map((ch, i) => {
      const ok = isAscii(ch), code = ch.codePointAt(0);
      return `
        <button class="bv-char${i === sel ? " sel" : ""}${ok ? "" : " bad"}" data-char="${i}" role="listitem"
          aria-label="${ch === " " ? "space" : esc(ch)}: ${ok ? `code ${code}, binary ${nibbles(toBits(code, BYTE), BYTE).join(" ")}` : "not in the ASCII chart"}">
          <span class="bv-char-glyph">${showChar(ch)}</span>
          <span class="bv-char-code">${ok ? code : "?"}</span>
          <span class="bv-char-bits">${ok ? nibbles(toBits(code, BYTE), BYTE).join(" ") : "not ASCII"}</span>
        </button>`;
    }).join("") || `<p class="bv-empty">Type something above, or tap a character in the chart below.</p>`;

    const ch = chars[sel];
    if (!ch) {
      $("bv-detail").innerHTML = "";
    } else if (!isAscii(ch)) {
      $("bv-detail").innerHTML = `<p class="bv-skip">${charName(ch)} isn't in the basic ASCII chart, so it needs
        a bigger code (and more than one byte). Try an English letter, digit or symbol instead.</p>`;
    } else {
      const code = ch.charCodeAt(0), b = toBits(code, BYTE);
      $("bv-detail").innerHTML = `
        <div class="bv-detail-head">
          <h3><span class="bv-glyph">${showChar(ch)}</span> ${ch === " " ? "(space) " : ""}has ASCII code <b>${code}</b></h3>
          <button class="bv-btn bv-btn-soft" data-act="to-number" title="Flip these bits yourself">Open in Number tab</button>
        </div>
        ${boardHTML(b, BYTE)}
        <ol class="bv-steps">${stepsHTML(b, BYTE, `the code for ${charName(ch)}!`)}</ol>`;
    }

    const ascii = chars.filter(isAscii);
    $("bv-message").innerHTML = chars.length ? `
      <h3>Your whole message in binary</h3>
      <p class="bv-bytes">${chars.map((c, i) => `
        <span class="bv-byte${i === sel ? " sel" : ""}" title="${c === " " ? "space" : esc(c)}">${isAscii(c) ? toBits(c.charCodeAt(0), BYTE).reverse().join("") : "????????"}</span>`).join("")}
      </p>
      <p class="bv-range">${plural(ascii.length, "character")} × 8 bits = <b>${ascii.length * BYTE} bits</b>
        (${plural(ascii.length, "byte")}) of ones and zeros.</p>` : "";
  }

  function flash(place) {
    flashPlace = place;
    render();
    clearTimeout(flash.t);
    flash.t = setTimeout(() => { flashPlace = null; render(); }, 500);
  }

  const refocus = selector => root.querySelector(selector)?.focus();

  function setTab(next) {
    tab = next;
    flashPlace = null;
    render();
  }

  // ---------- actions ----------

  root.addEventListener("click", e => {
    if (e.target === root) return close(); // backdrop

    const t = e.target.closest("[data-tab]");
    if (t) { setTab(t.dataset.tab); return refocus(`[data-tab="${tab}"]`); }

    const bit = e.target.closest("[data-place]");
    if (bit) {
      const p = Number(bit.dataset.place);
      bits[p] ^= 1;
      flash(p);
      return refocus(`[data-place="${p}"]`);
    }

    const charBtn = e.target.closest("[data-char]");
    if (charBtn) {
      sel = Number(charBtn.dataset.char);
      render();
      return refocus(`[data-char="${sel}"]`);
    }

    const add = e.target.closest("[data-add]");
    if (add) {
      if ([...text].length >= MAX_TEXT) return;
      text += add.dataset.add;
      input.value = text;
      sel = [...text].length - 1;
      return render();
    }

    const act = e.target.closest("[data-act]")?.dataset.act;
    const max = 2 ** digits;
    switch (act) {
      case "close": return close();
      case "fewer": if (digits > 1) { bits[--digits] = 0; } break;
      case "more": if (digits < MAX_DIGITS) digits++; break;
      case "inc": bits.splice(0, digits, ...toBits((toValue(bits, digits) + 1) % max, digits)); break;
      case "dec": bits.splice(0, digits, ...toBits((toValue(bits, digits) - 1 + max) % max, digits)); break;
      case "clear": bits.fill(0); break;
      case "text-clear": text = ""; input.value = ""; sel = 0; render(); return input.focus();
      case "to-number": {
        bits.fill(0);
        digits = BYTE;
        bits.splice(0, BYTE, ...toBits([...text][sel].charCodeAt(0), BYTE));
        setTab("number");
        return refocus('[data-tab="number"]');
      }
      default: return;
    }
    flashPlace = null;
    render();
  });

  input.addEventListener("input", () => {
    const grew = [...input.value].length > [...text].length;
    text = input.value;
    // Follow the cursor so the newest character is the one explained.
    const before = [...text.slice(0, input.selectionStart ?? text.length)].length;
    sel = Math.max(0, grew ? before - 1 : Math.min(sel, before));
    render();
  });

  // Arrow keys move between tabs, like a standard tab strip.
  root.querySelector(".bv-tabs").addEventListener("keydown", e => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    setTab(tab === "number" ? "text" : "number");
    refocus(`[data-tab="${tab}"]`);
  });

  function show(which) {
    if (which) tab = which;
    if (open) return render();
    open = true;
    lastFocus = document.activeElement;
    render();
    root.hidden = false;
    document.body.classList.add("bv-open");
    tab === "text" ? input.focus() : refocus(".bv-bit");
  }

  function close() {
    if (!open) return;
    open = false;
    root.hidden = true;
    document.body.classList.remove("bv-open");
    if (location.hash.startsWith("#binary")) history.replaceState(null, "", location.pathname + location.search);
    lastFocus?.focus?.();
  }

  // ---------- secret code ----------
  // Listens on window in the capture phase so it runs before the game's handler,
  // and keeps the game from moving tiles while the decoder is open.

  let recent = [];
  window.addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const typing = e.target === input;
    recent = typing ? [] : [...recent, TOKENS[e.key] || e.key.toLowerCase()].slice(-CODE_LEN);
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
    const items = [...root.querySelectorAll("button:not(:disabled), input, summary")]
      .filter(el => el.offsetParent !== null && el.tabIndex >= 0);
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // Classroom shortcuts: bookmark #binary (numbers) or #binary-text (text) to open straight in.
  const fromHash = () => {
    if (location.hash === "#binary") show("number");
    if (location.hash === "#binary-text") show("text");
  };
  window.addEventListener("hashchange", fromHash);
  fromHash();

  window.binaryDecoder = { open: show, close };
})();
