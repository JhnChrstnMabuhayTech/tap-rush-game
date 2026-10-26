/* @ds-bundle: {"format":4,"namespace":"Glowcatch","components":[{"name":"Button"},{"name":"Icon"},{"name":"Chip"},{"name":"ScoreHud"},{"name":"Firefly"},{"name":"Countdown"},{"name":"TitleScreen"},{"name":"PlayField"},{"name":"GameOver"},{"name":"Leaderboard"},{"name":"ShareCard"},{"name":"Notice"},{"name":"FloatText"},{"name":"PhaseBanner"},{"name":"BonusLegend"}]} */
/* Glowcatch UI kit. Plain DOM + Canvas, no framework: every component is a function (props) => HTMLElement.
   Stateful ones expose el.update(nextProps). Canvas helpers (drawField, drawFirefly, renderShareImage) read
   colours from the CSS custom properties in tokens.css, so a theme switch re-colours the canvas too. */
(function () {
  "use strict";
  var G = {};
  var SVGNS = "http://www.w3.org/2000/svg";

  /* ---------- helpers ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
  function token(name, el) {
    return getComputedStyle(el || document.documentElement).getPropertyValue("--" + name).trim();
  }
  function ms(name) { var v = token(name); return v ? parseFloat(v) : 0; }
  function reducedMotion() { return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); }
  function fmt(n) { return n == null ? "—" : String(n); }
  function initials(name) { return (name || "?").trim().split(/\s+/).slice(0, 2).map(function (p) { return p[0]; }).join("").toUpperCase(); }
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }

  /* ---------- Rules: difficulty, combo, bonuses ----------
     The round's numbers live here so the game, the docs and the server share one curve.
     Pace (0 → 1) blends the clock and the score: every round opens slow, then speeds up as the player
     scores — a strong player reaches Midnight early, a struggling one still gets there by the end.
     pace = clamp(0.4 × elapsed/total + 0.6 × score/PACE_SCORE). elapsed excludes frozen time. */
  var PACE_SCORE = 90;
  var PHASES = [
    { id: "dusk", name: "Dusk", from: 0 },
    { id: "night", name: "Night falls", from: 1 / 3 },
    { id: "midnight", name: "Midnight", from: 2 / 3 }
  ];
  var CURVE = {           // values at pace 0, 1/3, 2/3, 1; linear between
    spawnEvery: [950, 620, 460, 340],   // ms between spawns — the opening is deliberately gentle
    maxAlive: [2, 3, 5, 6],
    life: [1900, 1450, 1150, 850],      // ms a normal firefly lives
    sizeScale: [1.08, 0.95, 0.82, 0.7], // × firefly-start
    drift: [4, 10, 18, 24],             // px of wander
    bonusEvery: [8000, 6500, 5000, 5000],
    streakWindow: [3000, 3000, 2600, 2200] // ms without a catch before the combo is lost
  };
  function pace(elapsed, score, total) {
    total = total || 30;
    var p = 0.4 * Math.max(0, elapsed || 0) / total + 0.6 * Math.max(0, score || 0) / PACE_SCORE;
    return Math.max(0, Math.min(1, p));
  }
  function difficulty(elapsed, total, score) {
    var p = pace(elapsed, score, total);
    var i = Math.min(2, Math.floor(p * 3)), k = p * 3 - i, out = {};
    for (var key in CURVE) { var c = CURVE[key]; out[key] = c[i] + (c[i + 1] - c[i]) * k; }
    out.maxAlive = Math.round(out.maxAlive);
    out.pace = p; out.phase = PHASES[i].id; out.phaseName = PHASES[i].name; out.phaseIndex = i;
    return out;
  }
  var BONUSES = {
    lantern: { name: "Lantern", effect: "+5", points: 5, life: 1200, sizeScale: 1.25, weight: 40 },
    frost: { name: "Frost", effect: "Stops the clock for 3s", freezeMs: 3000, life: 1300, sizeScale: 1, weight: 35, maxPerRound: 2 },
    swarm: { name: "Swarm", effect: "Six quick fireflies", count: 6, windowMs: 2500, life: 1300, sizeScale: 1, moteLife: 800, moteScale: 0.6, weight: 25 }
  };
  // ×1 for streaks 0–4, ×2 from the 5th catch in a row, ×3 from the 10th
  function comboFor(streak) { return streak >= 10 ? 3 : streak >= 5 ? 2 : 1; }
  // points for one catch; streak already includes this catch. Lantern is flat; everything else uses the combo.
  function pointsFor(kind, streak) { return kind === "lantern" ? BONUSES.lantern.points : comboFor(streak); }
  function pickBonus(r, frostsUsed) {
    var pool = Object.keys(BONUSES).filter(function (k) { return k !== "frost" || frostsUsed < BONUSES.frost.maxPerRound; });
    var sum = pool.reduce(function (s, k) { return s + BONUSES[k].weight; }, 0), x = r() * sum;
    for (var i = 0; i < pool.length; i++) { x -= BONUSES[pool[i]].weight; if (x <= 0) return pool[i]; }
    return pool[0];
  }

  /* ---------- Icon ---------- */
  var ICONS = {
    play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" fill="currentColor" stroke="none"/>',
    replay: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>',
    share: '<path d="M12 3v12"/><path d="M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8.5 20h7M10 17h4"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    "sound-on": '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    "sound-off": '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.6 2.6M15.8 15.8l2.6 2.6M18.4 5.6l-2.6 2.6M8.2 15.8l-2.6 2.6"/>',
    offline: '<path d="M2.5 8.5a14 14 0 0 1 19 0M5.5 12a9.5 9.5 0 0 1 13 0M8.8 15.4a4.6 4.6 0 0 1 6.4 0"/><circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none"/><path d="M3 3l18 18"/>',
    alert: '<path d="M12 3.5 2.5 20h19L12 3.5Z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.3" r="1.1" fill="currentColor" stroke="none"/>',
    frost: '<path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5"/><path d="M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5M4.3 10.4l3.4-.9-.9-3.4M19.7 13.6l-3.4.9.9 3.4M6.8 17.9l.9-3.4-3.4-.9M17.2 6.1l-.9 3.4 3.4.9"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>'
  };
  function Icon(props) {
    props = typeof props === "string" ? { name: props } : props || {};
    var svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.25");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    if (props.size) { svg.setAttribute("width", props.size); svg.setAttribute("height", props.size); }
    svg.innerHTML = ICONS[props.name] || "";
    return svg;
  }
  Icon.names = Object.keys(ICONS);

  /* ---------- Button ---------- */
  function Button(props) {
    props = props || {};
    var variant = props.variant || "primary";
    var cls = ["gc-btn"];
    if (props.iconOnly) cls.push("gc-btn-icon"); else cls.push("gc-btn-" + variant);
    if (props.size === "lg") cls.push("gc-btn-lg");
    if (props.block) cls.push("gc-btn-block");
    if (props.busy) cls.push("gc-btn-busy");
    var b = h("button", {
      type: "button", class: cls.join(" "), disabled: props.disabled || props.busy,
      "aria-label": props.iconOnly ? props.label : null, "aria-busy": props.busy ? "true" : null,
      onClick: props.onClick
    }, props.icon ? Icon(props.icon) : null, props.iconOnly ? null : props.label);
    if (props.pressed != null) b.setAttribute("aria-pressed", props.pressed ? "true" : "false");
    return b;
  }

  /* ---------- Chip ---------- */
  function Chip(props) {
    props = props || {};
    return h("span", { class: "gc-chip gc-chip-" + (props.tone || "neutral") + (props.pop ? " gc-chip-pop" : "") },
      props.icon ? Icon(props.icon) : null, props.label);
  }

  /* ---------- ScoreHud ---------- */
  function ScoreHud(props) {
    var state = Object.assign({ score: 0, timeLeft: 30, total: 30, streak: 0, streakLeft: 1, lowAt: 5, frozen: 0 }, props);
    var barFill = h("i"), bar = h("span", { class: "gc-streakbar", "aria-hidden": "true" }, barFill);
    var scoreEl = h("b", { class: "gc-num", "aria-live": "off" }, "0");
    var comboSlot = h("div", { class: "gc-hud-combo" });
    var left = h("div", { class: "gc-hud-score" }, h("span", { class: "gc-label" }, "Score"), scoreEl, comboSlot);

    var svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 148 64");
    svg.innerHTML = '<path class="gc-timer-track" d="M10 56 A64 44 0 0 1 138 56"/>' +
      '<path class="gc-timer-done" d="M10 56 A64 44 0 0 1 138 56"/>' +
      '<circle class="gc-timer-moon" r="8" cx="10" cy="56"/>';
    var numText = h("span", null, "30");
    var num = h("span", { class: "gc-timer-num gc-num", role: "timer", "aria-label": "Time left" }, Icon("frost"), numText);
    var timer = h("div", { class: "gc-timer" }, svg, num);

    var pauseBtn = Button({ iconOnly: true, icon: "pause", label: "Pause", onClick: function () { state.onPause && state.onPause(); } });
    var right = h("div", { class: "gc-hud-right" }, pauseBtn);
    var el = h("div", { class: "gc-hud" }, left, timer, right);

    var done = svg.querySelector(".gc-timer-done"), moon = svg.querySelector(".gc-timer-moon");
    var lastScore = state.score, lastCombo = "";
    function render() {
      var len = done.getTotalLength ? done.getTotalLength() : 170;
      var p = Math.max(0, Math.min(1, 1 - state.timeLeft / state.total));
      done.style.strokeDasharray = len + " " + len;
      done.style.strokeDashoffset = String(len * (1 - p));
      if (done.getPointAtLength) { var pt = done.getPointAtLength(len * p); moon.setAttribute("cx", pt.x); moon.setAttribute("cy", pt.y); }
      numText.textContent = String(Math.ceil(state.timeLeft));
      var frozen = state.frozen > 0;
      timer.classList.toggle("gc-timer-frozen", frozen);
      timer.classList.toggle("gc-timer-low", !frozen && state.timeLeft <= state.lowAt && state.timeLeft > 0);
      if (state.score !== lastScore) {
        scoreEl.textContent = String(state.score);
        if (state.score > lastScore && !reducedMotion()) { scoreEl.classList.remove("gc-bump"); void scoreEl.offsetWidth; scoreEl.classList.add("gc-bump"); }
        lastScore = state.score;
      }
      // combo: pips fill toward the next multiplier; the chip appears from ×2
      var mult = comboFor(state.streak), filled = mult === 3 ? 5 : state.streak % 5, key = mult + ":" + filled;
      if (key !== lastCombo) {
        var up = lastCombo && +lastCombo.split(":")[0] < mult;
        comboSlot.textContent = "";
        if (state.streak > 0) {
          if (mult > 1) comboSlot.appendChild(Chip({ tone: mult === 3 ? "glow" : "lime", icon: "spark", label: "×" + mult + " combo", pop: up }));
          var pips = h("span", { class: "gc-pips" + (mult === 3 ? " gc-pips-max" : ""), "aria-hidden": "true" });
          for (var i = 0; i < 5; i++) pips.appendChild(h("i", { class: i < filled ? "on" : null }));
          comboSlot.appendChild(pips);
          comboSlot.appendChild(bar);
        }
        lastCombo = key;
      }
      // the combo clock: drains between catches, coral in its last quarter
      var left = Math.max(0, Math.min(1, state.streakLeft));
      barFill.style.transform = "scaleX(" + left + ")";
      bar.classList.toggle("gc-streakbar-low", left < 0.25);
      bar.classList.toggle("gc-streakbar-frozen", state.frozen > 0);
    }
    el.update = function (next) { Object.assign(state, next); render(); };
    scoreEl.textContent = String(state.score);
    requestAnimationFrame(render); render();
    return el;
  }

  /* ---------- Canvas: field ----------
     opts: { time, seed, phase (0 dusk · 1 night · 2 midnight), frozen (0 → 1), heat (0 → 1, from the streak), hot (×3 combo) } */
  function drawField(ctx, w, hgt, opts) {
    opts = opts || {};
    var t = opts.time || 0, r = rng(opts.seed || 7), phase = opts.phase || 0;
    var g = ctx.createLinearGradient(0, 0, 0, hgt);
    g.addColorStop(0, token("sky-deep")); g.addColorStop(0.7, token("sky")); g.addColorStop(1, token("sky"));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, hgt);
    // the night deepens with each phase: sky-deep washes down from the top
    if (phase > 0) {
      var dk = ctx.createLinearGradient(0, 0, 0, hgt);
      dk.addColorStop(0, token("sky-deep")); dk.addColorStop(1, clear(token("sky-deep")));
      ctx.globalAlpha = phase === 1 ? 0.55 : 1; ctx.fillStyle = dk; ctx.fillRect(0, 0, w, hgt); ctx.globalAlpha = 1;
    }
    // streak heat: the horizon warms with the combo (sky-warm), and at ×3 a faint aurora (sky-aurora) rises
    if (opts.heat > 0.01) {
      var hw = token("sky-warm"), wg = ctx.createLinearGradient(0, hgt, 0, hgt * (0.55 - 0.25 * opts.heat));
      wg.addColorStop(0, hw); wg.addColorStop(1, clear(hw));
      ctx.globalAlpha = Math.min(1, opts.heat * 1.2); ctx.fillStyle = wg; ctx.fillRect(0, 0, w, hgt);
      if (opts.hot) {
        var au = token("sky-aurora"), ay = hgt * 0.32 + Math.sin(t / 1500) * hgt * 0.03, ag = ctx.createLinearGradient(0, ay - hgt * 0.14, 0, ay + hgt * 0.14);
        ag.addColorStop(0, clear(au)); ag.addColorStop(0.5, au); ag.addColorStop(1, clear(au));
        ctx.globalAlpha = opts.heat; ctx.fillStyle = ag; ctx.fillRect(0, ay - hgt * 0.14, w, hgt * 0.28);
      }
      ctx.globalAlpha = 1;
    }
    // stars: more of them, brighter, as it gets darker
    ctx.fillStyle = token("ink");
    var stars = Math.round(w * hgt / (9000 - phase * 2500));
    for (var i = 0; i < stars; i++) {
      var sx = r() * w, sy = r() * hgt * 0.6, sr = r() < 0.15 ? 1.4 : 0.8, ph = r() * 6.28;
      ctx.globalAlpha = 0.18 + 0.08 * phase + 0.22 * (0.5 + 0.5 * Math.sin(t / 1400 + ph));
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // meadow: two rolling silhouettes along the bottom 12%, with sparse swaying blades on the front one
    var base = hgt * 0.9, still = opts.frozen > 0;
    [["meadow", 0.0, 1.0, 3], ["meadow-tip", 0.035, 0.7, 9]].forEach(function (row, ri) {
      ctx.fillStyle = token(row[0]);
      var y0 = base + hgt * row[1], amp = hgt * 0.018 * row[2], ph = row[3];
      function hill(x) { return y0 - amp * (Math.sin(x / (w * 0.23) + ph) + 0.6 * Math.sin(x / (w * 0.09) + ph * 2)); }
      ctx.beginPath(); ctx.moveTo(0, hgt);
      for (var x = 0; x <= w; x += 8) ctx.lineTo(x, hill(x));
      ctx.lineTo(w, hgt); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = token(row[0]); ctx.lineWidth = 2.5; ctx.lineCap = "round";
      var rr = rng((opts.seed || 7) + ri * 101), n = Math.round(w / 22);
      for (var i = 0; i < n; i++) {
        var bx = rr() * w, by = hill(bx) + 3, bh = (10 + rr() * 22) * row[2] * (hgt / 640 + 0.4);
        var sway = (still ? 0 : Math.sin(t / 1600 + bx / 50) * 3) + (rr() - 0.5) * 6;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + sway * 0.3, by - bh * 0.6, bx + sway, by - bh); ctx.stroke();
      }
    });
    // frozen: a cold tint over everything and a frost vignette creeping in from the edges
    if (opts.frozen > 0) {
      var fh = token("frost-halo"), fz = Math.min(1, opts.frozen);
      ctx.globalAlpha = 0.12 * fz; ctx.fillStyle = fh; ctx.fillRect(0, 0, w, hgt);
      var vg = ctx.createRadialGradient(w / 2, hgt / 2, Math.max(w, hgt) * 0.42, w / 2, hgt / 2, Math.max(w, hgt) * 0.72);
      vg.addColorStop(0, clear(fh)); vg.addColorStop(1, fh);
      ctx.globalAlpha = fz; ctx.fillStyle = vg; ctx.fillRect(0, 0, w, hgt); ctx.globalAlpha = 1;
    }
  }

  function clear(c) {
    // the same colour at alpha 0, so gradients fade instead of greying out through transparent black
    var m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) { var n = parseInt(m[1], 16); return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + ",0)"; }
    var r = /^rgba?\(([^,]+),([^,]+),([^,)]+)/.exec(c.replace(/\s/g, ""));
    return r ? "rgba(" + r[1] + "," + r[2] + "," + r[3] + ",0)" : "rgba(0,0,0,0)";
  }

  /* ---------- Canvas: firefly ----------
     f = { x, y, r (start radius, css px), life (1 → 0), caught (0 → 1 burst progress), seed, kind }
     kind: "normal" · "lantern" · "frost" · "swarm". Each bonus differs in shape as well as colour:
     Lantern is larger with a turning dashed ring, Frost wears six ice spokes, Swarm has three orbiting motes.
     The visible radius follows life^0.7 so a bug stays catchable for most of its life, then winks out. */
  function palette(kind) {
    if (kind === "frost") return { body: token("frost"), core: token("glow-core"), halo: token("frost-halo") };
    if (kind === "swarm") return { body: token("lime"), core: token("glow-core"), halo: token("lime-halo") };
    return { body: token("glow"), core: token("glow-core"), halo: token("glow-halo") };
  }
  function drawFirefly(ctx, f, now) {
    now = now || 0;
    var kind = f.kind || "normal", pal = palette(kind), ring = token("firefly-ring");
    var life = Math.max(0, Math.min(1, f.life == null ? 1 : f.life));
    var flick = 0.92 + 0.08 * Math.sin(now / 90 + (f.seed || 0));
    var rad = f.r * Math.pow(life, 0.7);
    if (f.caught != null) {
      // catch burst: an expanding ring of light and eight sparks, added onto the sky
      var p = Math.max(0, Math.min(1, f.caught)), br = f.r * (0.8 + (kind === "normal" ? 0.9 : 1.6) * p);
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 1 - p * p;
      ctx.fillStyle = pal.core; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.6 * (1 - p), 0, 6.2832); ctx.fill();
      ctx.strokeStyle = pal.core; ctx.lineWidth = 2 + 5 * (1 - p);
      ctx.beginPath(); ctx.arc(f.x, f.y, br, 0, 6.2832); ctx.stroke();
      ctx.strokeStyle = pal.body; ctx.lineWidth = 3; ctx.lineCap = "round";
      var sparks = kind === "normal" ? 8 : 12;
      for (var i = 0; i < sparks; i++) {
        var a = i * 6.2832 / sparks + (f.seed || 0), d0 = br + 6, d1 = d0 + 12 * (1 - p) + 2;
        ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * d0, f.y + Math.sin(a) * d0); ctx.lineTo(f.x + Math.cos(a) * d1, f.y + Math.sin(a) * d1); ctx.stroke();
      }
      ctx.restore(); return;
    }
    if (rad < 0.5) return;
    // halo: wide, soft, the body's colour fading to nothing (twice as strong on a Lantern)
    var hr = rad * (kind === "lantern" ? 3.2 : 2.6), hg = ctx.createRadialGradient(f.x, f.y, rad * 0.6, f.x, f.y, hr);
    hg.addColorStop(0, pal.halo); hg.addColorStop(1, clear(pal.halo));
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(f.x, f.y, hr, 0, 6.2832); ctx.fill();
    if (kind === "lantern") { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(now / 220); ctx.fill(); ctx.globalAlpha = 1; }
    // wings: two faint ellipses, beating
    var beat = Math.sin(now / 45 + (f.seed || 0)) * 0.25 + 0.75;
    ctx.fillStyle = pal.core; ctx.globalAlpha = 0.14 * life;
    ctx.beginPath(); ctx.ellipse(f.x - rad * 0.62, f.y - rad * 0.62, rad * 0.55 * beat, rad * 0.3, -0.7, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.ellipse(f.x + rad * 0.62, f.y - rad * 0.62, rad * 0.55 * beat, rad * 0.3, 0.7, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
    // body: the hit disc — colour at the rim, glow-core at the heart
    var bg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, rad);
    bg.addColorStop(0, pal.core); bg.addColorStop(kind === "lantern" ? 0.65 : 0.45, pal.core); bg.addColorStop(1, pal.body);
    ctx.globalAlpha = flick; ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(f.x, f.y, rad, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
    // the bonus marks: shape, not just colour
    ctx.save(); ctx.lineCap = "round";
    if (kind === "lantern") {
      ctx.strokeStyle = pal.body; ctx.lineWidth = 2.5; ctx.setLineDash([5, 6]); ctx.lineDashOffset = -now / 30;
      ctx.beginPath(); ctx.arc(f.x, f.y, rad + 8, 0, 6.2832); ctx.stroke();
    } else if (kind === "frost") {
      ctx.strokeStyle = pal.body; ctx.lineWidth = 2.25;
      for (var s = 0; s < 6; s++) {
        var ang = s * 1.0472 + now / 2400, c = Math.cos(ang), sn = Math.sin(ang), r0 = rad + 5, r1 = rad + 12, tip = rad + 9;
        ctx.beginPath(); ctx.moveTo(f.x + c * r0, f.y + sn * r0); ctx.lineTo(f.x + c * r1, f.y + sn * r1);
        ctx.moveTo(f.x + Math.cos(ang - 0.18) * (tip + 3), f.y + Math.sin(ang - 0.18) * (tip + 3)); ctx.lineTo(f.x + c * tip, f.y + sn * tip);
        ctx.lineTo(f.x + Math.cos(ang + 0.18) * (tip + 3), f.y + Math.sin(ang + 0.18) * (tip + 3)); ctx.stroke();
      }
    } else if (kind === "swarm") {
      ctx.fillStyle = pal.body;
      for (var m = 0; m < 3; m++) {
        var oa = now / 260 + m * 2.0944, mr = Math.max(2.5, rad * 0.16);
        ctx.beginPath(); ctx.arc(f.x + Math.cos(oa) * (rad + 9), f.y + Math.sin(oa) * (rad + 9), mr, 0, 6.2832); ctx.fill();
      }
    }
    ctx.restore();
    // ring (Contrast theme only — transparent in Night)
    ctx.strokeStyle = ring; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, rad + 3, 0, 6.2832); ctx.stroke();
  }

  function sizeCanvas(c, w, hgt) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(w * dpr); c.height = Math.round(hgt * dpr);
    c.style.width = w + "px"; c.style.height = hgt + "px";
    var ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return ctx;
  }

  /* ---------- Firefly (preview element; the game draws with drawFirefly on its own canvas) ---------- */
  function Firefly(props) {
    props = Object.assign({ diameter: 72, life: 1, animate: false, caught: null, label: null, kind: "normal" }, props);
    var box = Math.round(props.diameter * (props.kind === "normal" ? 2.6 : 3.4));
    var c = h("canvas", { role: "img", "aria-label": props.label || (props.kind === "normal" ? "Firefly" : props.kind + " firefly") });
    var ctx = sizeCanvas(c, box, box), start = performance.now(), raf;
    function frame(now) {
      ctx.clearRect(0, 0, box, box);
      var life = props.life, caught = props.caught;
      if (props.animate && !reducedMotion()) {
        var dur = ms("dur-life") || 1600, burst = ms("dur-burst") || 320, cyc = (now - start) % (dur + burst + 500);
        if (cyc < dur * 0.62) { life = 1 - cyc / dur; caught = null; }
        else if (cyc < dur * 0.62 + burst) { caught = (cyc - dur * 0.62) / burst; }
        else { life = 0; caught = null; }
      }
      drawFirefly(ctx, { x: box / 2, y: box / 2, r: props.diameter / 2, life: life, caught: caught, seed: 3, kind: props.kind }, reducedMotion() ? 0 : now);
      if (props.animate || props.life > 0) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    c.stop = function () { cancelAnimationFrame(raf); };
    return c;
  }

  /* ---------- FloatText (score popups at the catch point) ---------- */
  function FloatText(props) {
    props = props || {};
    var el = h("span", { class: "gc-float gc-float-" + (props.tone || "glow") + (props.big ? " gc-float-big" : ""), "aria-hidden": "true",
      style: "left:" + (props.x || 0) + "px;top:" + (props.y || 0) + "px" }, props.icon ? Icon(props.icon) : null, props.text);
    function bye() { if (el.parentNode) el.parentNode.removeChild(el); }
    el.addEventListener("animationend", bye);
    setTimeout(bye, (ms("dur-float") || 700) + 400);
    if (props.parent) props.parent.appendChild(el);
    return el;
  }

  /* ---------- PhaseBanner (Night falls · Midnight) ---------- */
  function PhaseBanner(props) {
    props = props || {};
    var el = h("div", { class: "gc-phase" + (props.still ? " gc-still" : ""), role: "status" },
      h("span", { class: "gc-label" }, props.step || ""), h("b", null, props.name || "Night falls"),
      props.hint ? h("span", { class: "gc-phase-hint" }, props.hint) : null);
    if (!props.still) el.addEventListener("animationend", function () { if (el.parentNode) el.parentNode.removeChild(el); });
    if (props.parent) props.parent.appendChild(el);
    return el;
  }

  /* ---------- BonusLegend (how to play) ---------- */
  function BonusLegend(props) {
    props = props || {};
    var items = [
      { kind: "normal", name: "Firefly", effect: "1 point, times your combo" },
      { kind: "lantern", name: BONUSES.lantern.name, effect: "+5 points" },
      { kind: "frost", name: BONUSES.frost.name, effect: BONUSES.frost.effect },
      { kind: "swarm", name: BONUSES.swarm.name, effect: BONUSES.swarm.effect }
    ];
    var list = h("ul", { class: "gc-legend-list" }, items.map(function (it) {
      return h("li", null, h("span", { class: "gc-legend-bug" }, Firefly({ diameter: 26, kind: it.kind, label: it.name })),
        h("span", { class: "gc-legend-text" }, h("b", null, it.name), h("span", null, it.effect)));
    }));
    var combo = h("div", { class: "gc-legend-combo" }, Chip({ tone: "lime", icon: "spark", label: "×2" }), Chip({ tone: "glow", icon: "spark", label: "×3" }),
      h("span", null, "Catch 5 in a row to double every catch, 10 to triple it. Let one fade and the combo resets."));
    return h("section", { class: "gc-legend" }, props.title === null ? null : h("h2", null, props.title || "How to play"), list, combo);
  }

  /* ---------- Countdown ---------- */
  function Countdown(props) {
    props = props || {};
    var v = props.value == null ? 3 : props.value;
    var go = v === 0 || v === "Go";
    var num = h("b", { class: "gc-num" + (go ? " gc-go" : ""), "aria-live": "assertive" }, go ? "Go!" : String(v));
    return h("div", { class: "gc-countdown" + (props.still ? " gc-still" : "") }, num, props.hint ? h("p", null, props.hint) : null);
  }

  /* ---------- TitleScreen ----------
     The name animates in: "Glow" rises letter by letter, then "catch" lights up one letter at a time like
     fireflies switching on, flickers, and settles into a slow breathing glow with a wave running through it.
     A single firefly loops around the name. The rest of the screen follows once the name has landed. */
  function TitleScreen(props) {
    props = props || {};
    function letters(word, offset) {
      return word.split("").map(function (ch, i) { return h("span", { class: "gc-l", style: "--i:" + (i + (offset || 0)), "aria-hidden": "true" }, ch); });
    }
    var name = h("h1", { class: "gc-title-name", "aria-label": "Glowcatch" },
      h("span", { class: "gc-title-glow" }, letters("Glow")),
      h("span", { class: "gc-title-catch" }, letters("catch", 4)),
      h("span", { class: "gc-title-fly", "aria-hidden": "true" }));
    return h("div", { class: "gc-title" + (props.still ? " gc-still" : "") },
      name,
      h("p", null, props.tagline || "Thirty seconds of dusk. Tap the fireflies before their light fades."),
      props.best ? h("div", { class: "gc-title-best" }, Chip({ tone: "glow", icon: "trophy", label: "Best " + props.best })) : null,
      h("div", { class: "gc-title-actions" },
        Button({ variant: "primary", size: "lg", icon: "play", label: props.playLabel || "Play", block: true, onClick: props.onPlay }),
        Button({ variant: "ghost", icon: "trophy", label: "Leaderboard", block: true, onClick: props.onLeaderboard })
      )
    );
  }

  /* ---------- Leaderboard ---------- */
  function Leaderboard(props) {
    props = Object.assign({ state: "ready", entries: [], title: "Tonight’s brightest", scope: "Top 10" }, props);
    var body;
    if (props.state === "loading") {
      body = h("div", { "aria-busy": "true", "aria-label": "Loading leaderboard" }, [0, 1, 2, 3, 4].map(function () { return h("div", { class: "gc-skel" }); }));
    } else if (props.state === "error" || props.state === "offline") {
      body = Notice({ tone: props.state === "offline" ? "offline" : "error",
        message: props.state === "offline" ? "You’re offline. Scores will rank when you’re back." : "Couldn’t load the leaderboard.",
        actionLabel: "Retry", onAction: props.onRetry });
    } else if (!props.entries.length) {
      body = h("div", { class: "gc-board-empty" }, h("b", null, "No catches yet tonight"), "Be the first light on the board.");
    } else {
      var list = h("ol", { "aria-label": props.title });
      props.entries.slice(0, 10).forEach(function (e, i) { list.appendChild(row(e, i)); });
      if (props.playerEntry && !props.entries.some(function (e) { return e.isPlayer; })) {
        list.appendChild(h("li", { class: "gc-row-gap", "aria-hidden": "true" }, "•••"));
        list.appendChild(row(Object.assign({ isPlayer: true }, props.playerEntry), 10));
      }
      body = list;
    }
    return h("section", { class: "gc-board" },
      props.hideHeader ? null : h("div", { class: "gc-board-head" }, h("h2", null, props.title), h("span", { class: "gc-label" }, props.scope)),
      body);
  }
  function row(e, i) {
    var rank = e.rank || i + 1;
    var av = h("span", { class: "gc-avatar", "aria-hidden": "true" });
    if (e.photo) { var img = h("img", { src: e.photo, alt: "" }); img.onerror = function () { av.textContent = initials(e.name); }; av.appendChild(img); }
    else av.textContent = initials(e.name);
    return h("li", { class: "gc-row" + (e.isPlayer ? " gc-row-me" : "") + (rank <= 3 ? " gc-row-top" : ""), style: "animation-delay:" + Math.min(i, 10) * 30 + "ms" },
      h("span", { class: "gc-row-rank gc-num" }, String(rank)), av,
      h("span", { class: "gc-row-name" }, e.isPlayer ? (e.name || "You") + " (you)" : e.name),
      h("span", { class: "gc-row-score gc-num" }, String(e.score)));
  }

  /* ---------- Notice ---------- */
  function Notice(props) {
    props = props || {};
    var tone = props.tone || "info";
    var icon = tone === "error" ? "alert" : tone === "offline" ? "offline" : "spark";
    return h("div", { class: "gc-notice gc-notice-" + tone, role: tone === "error" ? "alert" : "status" },
      Icon(icon), h("span", { class: "gc-notice-msg" }, props.message),
      props.actionLabel && props.onAction !== null ? h("button", { type: "button", onClick: props.onAction }, props.actionLabel) : null);
  }

  /* ---------- GameOver ---------- */
  function GameOver(props) {
    props = Object.assign({ score: 0, best: 0, isNewBest: false, submit: "sent" }, props);
    var top = h("div", { class: "gc-over-top" },
      h("span", { class: "gc-label" }, "Score"),
      h("div", { class: "gc-over-score gc-num", "aria-live": "polite" }, String(props.score)),
      props.isNewBest ? Chip({ tone: "lime", icon: "spark", label: "New best", pop: true }) : null
    );
    var stats = h("div", { class: "gc-over-stats" },
      h("div", { class: "gc-stat" }, h("span", { class: "gc-label" }, "Best"), h("b", { class: "gc-num" }, fmt(props.best))),
      h("div", { class: "gc-stat" }, h("span", { class: "gc-label" }, "Rank"), h("b", { class: "gc-num" }, props.rank ? "#" + props.rank : "—")),
      props.topCombo ? h("div", { class: "gc-stat" }, h("span", { class: "gc-label" }, "Combo"), h("b", { class: "gc-num" }, "×" + props.topCombo)) : null,
      props.caught != null ? h("div", { class: "gc-stat" }, h("span", { class: "gc-label" }, "Caught"), h("b", { class: "gc-num" }, String(props.caught))) : null
    );
    var notice = null;
    if (props.submit === "failed") notice = Notice({ tone: "error", message: "Score not sent yet.", actionLabel: "Retry", onAction: props.onRetrySubmit });
    if (props.submit === "offline") notice = Notice({ tone: "offline", message: "Offline — your best is saved on this device." });
    var actions = h("div", { class: "gc-over-actions" },
      Button({ variant: "secondary", icon: "share", label: "Share", busy: props.sharing, onClick: props.onShare }),
      Button({ variant: "primary", icon: "replay", label: "Play again", onClick: props.onPlayAgain })
    );
    var board = props.leaderboard ? Leaderboard(Object.assign({}, props.leaderboard)) : null;
    return h("div", { class: "gc-panel gc-over" + (props.isNewBest ? " gc-over-new" : ""), role: "dialog", "aria-label": "Round over" },
      top, stats, notice, actions, board);
  }

  /* ---------- PlayField (a whole in-game screen: field canvas + fireflies + HUD) ----------
     demo + clock: a real mini-round driven by difficulty(), comboFor() and BONUSES — the reference
     implementation of Gameplay. ambient: a few dim fireflies and no HUD, for the title screen. */
  function PlayField(props) {
    props = Object.assign({ score: 0, timeLeft: 30, streak: 0, elapsed: null, frozen: 0, demo: true, ambient: false, clock: null, loop: true, layer: null }, props);
    var clock = props.clock == null ? (props.demo && !props.ambient && !props.layer) : props.clock;
    var TOTAL = 30;
    var c = h("canvas", { "aria-hidden": "true" });
    var elapsed = props.elapsed != null ? props.elapsed : TOTAL - props.timeLeft;
    var hud = props.ambient ? null : ScoreHud({ score: props.score, timeLeft: TOTAL - elapsed, streak: props.streak, frozen: props.frozen });
    var fx = h("div", { class: "gc-fx", "aria-hidden": "true" });
    var el = h("div", { class: "gc-frame" }, c, fx, hud, props.layer ? h("div", { class: "gc-layer" }, props.layer) : null);
    var bugs = [], ctx, W = 0, H = 0, raf, last = 0, seedN = 1;
    var S = { score: props.score, streak: props.streak, streakLeft: props.streak ? 2000 : 0, heat: 0, topPhase: 0, frozen: props.frozen, spawnAcc: 0, bonusAcc: 4000, frosts: 0, swarmLeft: 0, swarmAcc: 0, phase: -1, ended: 0 };
    var r = rng(20261022);
    function resize() { W = el.clientWidth; H = el.clientHeight; if (W && H) ctx = sizeCanvas(c, W, H); }
    function baseD() { return (parseFloat(token("firefly-start")) || 72) * Math.min(1.25, Math.min(W, H) / 390); }
    function spawn(kind, d) {
      var mote = kind === "swarm-mote", spec = BONUSES[kind];
      var scale = props.ambient ? 0.55 : d.sizeScale * (mote ? BONUSES.swarm.moteScale : spec ? spec.sizeScale : 1);
      var dia = baseD() * scale, top = 100 + dia / 2, bottom = H * 0.88 - dia / 2, x, y, tries = 0;
      do { x = dia + r() * (W - 2 * dia); y = top + r() * Math.max(1, bottom - top); tries++; }
      while (tries < 10 && bugs.some(function (b) { return !b.caughtAt && Math.hypot(b.x - x, b.y - y) < 1.2 * (dia + b.r * 2) / 2 + dia * 0.6; }));
      var dur = props.ambient ? 2200 + r() * 800 : mote ? BONUSES.swarm.moteLife : (spec ? spec.life : d.life);
      bugs.push({ x0: x, y0: y, x: x, y: y, r: dia / 2, age: 0, dur: dur, life: 1, kind: kind, seed: (seedN++ * 1.7) % 6.28, drift: d.drift });
    }
    function pop(text, tone, x, y, icon, big) { FloatText({ parent: fx, text: text, tone: tone, x: x, y: y, icon: icon, big: big }); }
    function catchBug(b, now) {
      b.caughtAt = now;
      var before = comboFor(S.streak);
      S.streak++;
      var pts = pointsFor(b.kind, S.streak), mult = comboFor(S.streak);
      S.score += pts;
      S.streakLeft = difficulty(elapsed, TOTAL, S.score).streakWindow;
      if (b.kind === "lantern") pop("+" + pts, "glow", b.x, b.y, null, true);
      else pop("+" + pts, mult === 3 ? "glow" : mult === 2 ? "lime" : "ink", b.x, b.y);
      if (b.kind === "frost") { S.frozen = BONUSES.frost.freezeMs; S.frosts++; pop("Frozen 3s", "frost", W / 2, H * 0.3, "frost", true); }
      if (b.kind === "swarm") { S.swarmLeft = BONUSES.swarm.count; S.swarmAcc = 0; pop("Swarm", "lime", b.x, b.y - 34, "spark"); }
      if (mult > before) pop("×" + mult + " combo", mult === 3 ? "glow" : "lime", b.x, b.y - 34, "spark");
      if (hud) hud.update({ score: S.score, streak: S.streak });
    }
    function step(dt, now) {
      var frozen = S.frozen > 0;
      if (frozen) S.frozen = Math.max(0, S.frozen - dt);
      else if (!S.ended) elapsed = Math.min(TOTAL, elapsed + dt / 1000);
      var d = difficulty(elapsed, TOTAL, S.score);
      // the combo clock: drains while nothing is caught; frozen time stops it too
      if (S.streak > 0 && !frozen && !S.ended) {
        S.streakLeft -= dt;
        if (S.streakLeft <= 0) { S.streak = 0; S.streakLeft = 0; if (hud) hud.update({ streak: 0 }); }
      }
      // background heat follows the combo: rises quickly, cools slowly
      var target = S.streak ? Math.min(1, S.streak / 12) : 0;
      S.heat += (target - S.heat) * Math.min(1, dt / (target > S.heat ? 180 : 700));
      if (d.phaseIndex !== S.phase) {
        if (S.phase >= 0 && d.phaseIndex > S.phase) PhaseBanner({ parent: fx, step: "Phase " + (d.phaseIndex + 1) + " of 3", name: d.phaseName, hint: d.phaseIndex === 1 ? "Faster and smaller" : "Last stretch" });
        S.phase = d.phaseIndex;
      }
      if (elapsed >= TOTAL && !S.ended) S.ended = now;
      if (!S.ended) {
        S.spawnAcc += dt;
        var normals = bugs.filter(function (b) { return !b.caughtAt && b.kind === "normal"; }).length;
        if (S.spawnAcc >= d.spawnEvery && normals < d.maxAlive) { S.spawnAcc = 0; spawn("normal", d); }
        if (!frozen) S.bonusAcc += dt;
        var bonusAlive = bugs.some(function (b) { return !b.caughtAt && BONUSES[b.kind]; });
        if (elapsed > 5 && S.bonusAcc >= d.bonusEvery && !bonusAlive) { S.bonusAcc = -r() * 1500; spawn(pickBonus(r, S.frosts), d); }
        if (S.swarmLeft > 0) { S.swarmAcc += dt; if (S.swarmAcc >= BONUSES.swarm.windowMs / BONUSES.swarm.count) { S.swarmAcc = 0; S.swarmLeft--; spawn("swarm-mote", d); } }
      } else if (props.loop && now - S.ended > 2000) {
        elapsed = 0; S.score = 0; S.streak = 0; S.streakLeft = 0; S.frosts = 0; S.ended = 0; S.phase = -1; S.bonusAcc = 4000; bugs = [];
        if (hud) hud.update({ score: 0, streak: 0 });
      }
      bugs = bugs.filter(function (b) {
        if (b.caughtAt) return now - b.caughtAt < (ms("dur-burst") || 320);
        if (!frozen || S.ended) { b.age += dt; }
        b.life = 1 - b.age / b.dur;
        if (b.life <= 0) { if (b.kind === "normal" && !S.ended) { S.streak = 0; S.streakLeft = 0; if (hud) hud.update({ streak: 0 }); } return false; }
        if (!frozen) { b.clock = (b.clock || 0) + dt; }
        var k = b.clock || 0, amp = b.drift * (BONUSES[b.kind] ? 1.6 : 1);
        b.x = b.x0 + Math.sin(k / 700 + b.seed) * amp; b.y = b.y0 + Math.cos(k / 900 + b.seed) * amp * 0.8;
        return true;
      });
      if (hud) hud.update({ timeLeft: TOTAL - elapsed, frozen: S.frozen, streakLeft: S.streak ? S.streakLeft / d.streakWindow : 0 });
      return d;
    }
    function ambientStep(dt) {
      var d = { sizeScale: 1, drift: 6 };
      if (bugs.length < 3) spawn("normal", d);
      bugs = bugs.filter(function (b) {
        b.age += dt; b.clock = (b.clock || 0) + dt; b.life = 1 - b.age / b.dur;
        b.x = b.x0 + Math.sin(b.clock / 700 + b.seed) * 6; b.y = b.y0 + Math.cos(b.clock / 900 + b.seed) * 5;
        return b.life > 0;
      });
    }
    function frame(now) {
      if (!ctx) { resize(); if (!ctx) { raf = requestAnimationFrame(frame); return; } }
      var dt = last ? Math.min(50, now - last) : 16; last = now;
      var d = null;
      if (props.demo) { if (props.ambient) ambientStep(dt); else if (clock) d = step(dt, now); }
      drawField(ctx, W, H, { time: S.frozen > 0 ? 0 : now, seed: 11, phase: d ? d.phaseIndex : 0, frozen: Math.min(1, S.frozen / 300), heat: S.heat, hot: comboFor(S.streak) === 3 });
      if (props.ambient) ctx.globalAlpha = 0.6;
      var t = S.frozen > 0 ? 0 : now;
      bugs.forEach(function (b) {
        var kind = b.kind === "swarm-mote" ? "swarm" : b.kind;
        if (b.caughtAt) drawFirefly(ctx, { x: b.x, y: b.y, r: b.r, caught: (now - b.caughtAt) / (ms("dur-burst") || 320), seed: b.seed, kind: kind }, now);
        else drawFirefly(ctx, { x: b.x, y: b.y, r: b.r, life: b.life, seed: b.seed, kind: b.kind === "swarm-mote" ? "normal" : kind }, t);
      });
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    c.addEventListener("pointerdown", function (e) {
      if (!clock || S.ended) return;
      var rect = c.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top, slop = parseFloat(token("firefly-hit-slop")) || 10;
      var hit = bugs.filter(function (b) { return !b.caughtAt && Math.hypot(b.x - x, b.y - y) <= b.r * Math.pow(b.life, 0.7) + slop; })
        .sort(function (a, b) { return a.life - b.life; })[0];
      if (hit) catchBug(hit, performance.now());
    });
    if (window.ResizeObserver) new ResizeObserver(function () { ctx = null; }).observe(el);
    raf = requestAnimationFrame(frame);
    el.stop = function () { cancelAnimationFrame(raf); };
    el.hud = hud;
    // for docs: drop a firefly of a kind in the middle of the field
    el.spawn = function (kind) { if (W) spawn(kind || "normal", difficulty(elapsed, TOTAL, S.score)); };
    return el;
  }

  /* ---------- Share image (1200 × 630, for FBInstant.shareAsync / updateAsync) ---------- */
  function renderShareImage(opts) {
    opts = Object.assign({ score: 0, name: "", width: 1200, height: 630 }, opts);
    var W = opts.width, H = opts.height, c = opts.canvas || document.createElement("canvas");
    c.width = W; c.height = H;
    var ctx = c.getContext("2d");
    drawField(ctx, W, H, { seed: 5, time: 2000 });
    var spots = [[0.66, 0.30, 46, 0.95], [0.86, 0.22, 34, 0.7], [0.78, 0.56, 58, 1], [0.94, 0.62, 26, 0.5], [0.60, 0.66, 22, 0.4]];
    spots.forEach(function (s, i) { drawFirefly(ctx, { x: W * s[0], y: H * s[1], r: s[2], life: s[3], seed: i }, 400 * i); });
    var disp = "\"Bricolage Grotesque\", system-ui, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = token("ink-muted"); ctx.font = "700 30px " + disp;
    ctx.fillText((opts.name ? opts.name.toUpperCase() + " SCORED" : "I SCORED"), 72, 150);
    ctx.fillStyle = token("glow"); ctx.font = "800 240px " + disp;
    ctx.shadowColor = token("glow-halo"); ctx.shadowBlur = 60;
    ctx.fillText(String(opts.score), 64, 380);
    ctx.shadowBlur = 0;
    ctx.fillStyle = token("ink"); ctx.font = "700 44px " + disp;
    ctx.fillText(opts.score === 1 ? "point in 30 seconds" : "points in 30 seconds", 72, 450);
    ctx.fillStyle = token("ink"); ctx.font = "800 40px " + disp;
    ctx.fillText("Glowcatch", 72, 560);
    var wm = ctx.measureText("Glowcatch").width;
    ctx.fillStyle = token("ink-muted"); ctx.font = "600 28px " + disp;
    ctx.fillText("Can you beat it?", 72 + wm + 20, 560);
    return c;
  }
  function ShareCard(props) {
    props = props || {};
    var c = h("canvas", { class: "gc-share", role: "img", "aria-label": "Share image: " + (props.score || 0) + " points" });
    function draw() { renderShareImage({ canvas: c, score: props.score || 0, name: props.name || "" }); }
    draw();
    if (document.fonts && document.fonts.load) document.fonts.load("800 40px \"Bricolage Grotesque\"").then(draw, function () {});
    return c;
  }

  Object.assign(G, {
    Button: Button, Icon: Icon, Chip: Chip, ScoreHud: ScoreHud, Firefly: Firefly, Countdown: Countdown,
    TitleScreen: TitleScreen, PlayField: PlayField, GameOver: GameOver, Leaderboard: Leaderboard,
    ShareCard: ShareCard, Notice: Notice, FloatText: FloatText, PhaseBanner: PhaseBanner, BonusLegend: BonusLegend,
    difficulty: difficulty, pace: pace, comboFor: comboFor, CURVE: CURVE, pointsFor: pointsFor, BONUSES: BONUSES, PHASES: PHASES,
    drawField: drawField, drawFirefly: drawFirefly, renderShareImage: renderShareImage, token: token, h: h
  });
  window.Glowcatch = Object.assign(window.Glowcatch || {}, G);
})();
