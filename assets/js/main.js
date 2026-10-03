/* VEYRA Juwelen - Seitenlogik
   1) Navigation  2) Einblenden beim Scrollen  3) Terminformular  4) Scroll-Sequenz */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1) Navigation ---------- */
  var nav = document.getElementById('nav');
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');

  function setMenu(open) {
    navLinks.classList.toggle('is-open', open);
    nav.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
  }
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      setMenu(navToggle.getAttribute('aria-expanded') !== 'true');
    });
    navLinks.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });
  }

  /* Navigation bekommt einen Hintergrund, sobald die Seite nicht mehr ganz oben steht */
  var topMark = document.getElementById('topMark');
  if (nav && topMark && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      nav.classList.toggle('is-solid', !entries[0].isIntersecting);
    }).observe(topMark);
  } else if (nav) {
    nav.classList.add('is-solid');
  }

  /* ---------- 2) Einblenden beim Scrollen ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------- 3) Terminformular ---------- */
  var form = document.getElementById('terminForm');
  if (form) {
    var dateInput = form.querySelector('#f-date');
    var today = new Date();
    var iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    dateInput.min = iso;

    var rules = [
      { el: form.querySelector('#f-name'), err: form.querySelector('#e-name'), check: function (v) { return v.trim().length >= 2 ? '' : 'Bitte geben Sie Ihren Namen an.'; } },
      { el: form.querySelector('#f-mail'), err: form.querySelector('#e-mail'), check: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Bitte geben Sie eine gültige E-Mail-Adresse an.'; } },
      { el: dateInput, err: form.querySelector('#e-date'), check: function (v) { if (!v) return 'Bitte wählen Sie einen Wunschtermin.'; return v >= iso ? '' : 'Der Termin liegt in der Vergangenheit.'; } }
    ];

    function validate(rule) {
      var msg = rule.check(rule.el.value);
      rule.err.textContent = msg;
      rule.el.closest('.field').classList.toggle('is-invalid', !!msg);
      rule.el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      return !msg;
    }
    rules.forEach(function (rule) {
      rule.el.addEventListener('blur', function () { validate(rule); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstBad = null;
      rules.forEach(function (rule) { if (!validate(rule) && !firstBad) firstBad = rule.el; });
      var ok = document.getElementById('formOk');
      if (firstBad) { ok.hidden = true; firstBad.focus(); return; }
      /* Hier vor dem Livegang die Daten an einen Formular-Dienst oder ein Backend senden. */
      form.reset();
      ok.hidden = false;
    });
  }

  /* ---------- 4) Scroll-Sequenz ---------- */
  var seq = document.querySelector('.seq');
  var stage = document.getElementById('seqStage');
  var canvas = document.getElementById('seqCanvas');
  if (!seq || !stage || !canvas || reduceMotion || !window.gsap || !window.ScrollTrigger) return;

  /* Einzelbilder: vier Clips hintereinander. MARKS sind die Bilder, auf denen je ein Schmuckstück steht. */
  var FRAMES = 481;
  var MARKS = [0, 120, 240, 360, 480];
  var FOCUS = [0.5, 0.45, 0.5, 0.41, 0.45];        /* horizontaler Bildausschnitt je Station (0 links, 1 rechts) */
  var SIDES = ['left', 'right', 'left', 'right', 'left']; /* Textseite je Station auf großen Bildschirmen */
  var VPOS = ['bottom', 'mid', 'bottom', 'top', 'top'];       /* Texthöhe je Station auf großen Bildschirmen */
  var HOLD = [1.0, 0.55, 0.55, 0.55, 0.8];         /* Verweildauer je Station, in Bildschirmhöhen */
  var MOVE = 1.0;                                  /* Fahrt zwischen zwei Stationen */
  var BG = '#f3f4f6';

  var small = window.matchMedia('(max-width: 767px)').matches;
  var dir = small ? 'assets/frames/m/' : 'assets/frames/d/';
  var step = small ? 2 : 1;                        /* mobil nur jedes zweite Bild */

  /* Zeitachse in Einheiten: Halt, Fahrt, Halt, ... */
  var holds = [];
  var cursor = 0;
  for (var i = 0; i < MARKS.length; i++) {
    holds.push({ start: cursor, end: cursor + HOLD[i] });
    cursor += HOLD[i] + (i < MARKS.length - 1 ? MOVE : 0);
  }
  var TOTAL = cursor;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* liefert Stationsposition als Kommazahl: 0 = Ring, 1.5 = auf halbem Weg zum Collier */
  function stationAt(u) {
    for (var k = 0; k < holds.length; k++) {
      if (u <= holds[k].end) return k;
      if (k < holds.length - 1 && u < holds[k + 1].start) return k + (u - holds[k].end) / MOVE;
    }
    return holds.length - 1;
  }
  function frameAt(pos) {
    var k = Math.min(Math.floor(pos), MARKS.length - 2);
    var t = pos - k;
    return MARKS[k] + (MARKS[k + 1] - MARKS[k]) * t;
  }

  /* Bilder laden: der Reihe nach, sechs gleichzeitig */
  var images = new Array(FRAMES);
  var order = [];
  for (var f = 0; f < FRAMES; f += step) order.push(f);
  if (order[order.length - 1] !== FRAMES - 1 && !small) order.push(FRAMES - 1);
  var loadedCount = 0;
  var nextInOrder = 0;
  var loadBar = document.getElementById('seqLoad');
  var loadFill = loadBar ? loadBar.querySelector('span') : null;

  function src(index) { return dir + 'f' + String(index + 1).padStart(4, '0') + '.webp'; }
  function loadNext() {
    if (nextInOrder >= order.length) return;
    var index = order[nextInOrder++];
    var img = new Image();
    img.decoding = 'async';
    img.onload = img.onerror = function () {
      if (img.naturalWidth) images[index] = img;
      loadedCount++;
      if (loadFill) {
        var ratio = loadedCount / order.length;
        loadFill.style.transform = 'scaleX(' + ratio + ')';
        loadBar.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
        if (loadedCount === order.length) loadBar.classList.add('is-done');
      }
      if (index === 0) { seq.classList.add('is-ready'); draw(); }
      else if (Math.abs(index - state.frame) <= step) draw();
      loadNext();
    };
    img.src = src(index);
  }

  function nearest(index) {
    index = Math.round(index);
    for (var d = 0; d < FRAMES; d++) {
      if (index - d >= 0 && images[index - d]) return images[index - d];
      if (index + d < FRAMES && images[index + d]) return images[index + d];
    }
    return null;
  }

  /* Zeichnen */
  var ctx = canvas.getContext('2d', { alpha: false });
  var state = { u: 0, frame: 0, focus: FOCUS[0] };
  var lastDrawn = null;

  function sizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    var w = Math.round(stage.clientWidth * dpr);
    var h = Math.round(stage.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h; lastDrawn = null;
    }
  }

  function draw() {
    var img = nearest(state.frame);
    if (!img) return;
    var key = img.src + '|' + state.focus.toFixed(3);
    if (key === lastDrawn) return;
    lastDrawn = key;

    var cw = canvas.width, ch = canvas.height;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var portrait = cw / ch < 0.8;

    if (!portrait) {
      /* Querformat: Bild füllt die Fläche */
      var s = Math.max(cw / iw, ch / ih);
      var dw = iw * s, dh = ih * s;
      ctx.drawImage(img, (cw - dw) * state.focus, (ch - dh) * 0.5, dw, dh);
      return;
    }
    /* Hochformat: Bild oben, darunter Platz für den Text. Der weiße Studiohintergrund läuft weich in die Seite aus. */
    var bandH = ch * 0.62;
    var sp = Math.max(bandH / ih, cw / iw);
    var pw = iw * sp, ph = ih * sp;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - pw) * state.focus, 0, pw, ph);
    var fade = ctx.createLinearGradient(0, ph * 0.7, 0, ph);
    fade.addColorStop(0, 'rgba(243,244,246,0)');
    fade.addColorStop(1, 'rgba(243,244,246,1)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, ph * 0.7, cw, ph * 0.3 + 2);
  }

  /* Texte je Station */
  var heroPanel = stage.querySelector('[data-panel="hero"]');
  var panels = [];
  for (var p = 0; p < MARKS.length; p++) {
    var el = stage.querySelector('[data-panel="' + p + '"]');
    el.setAttribute('data-side', SIDES[p]);
    el.setAttribute('data-v', VPOS[p]);
    panels.push(el);
  }
  var indexButtons = Array.prototype.slice.call(document.querySelectorAll('#seqIndex button'));
  var FADE = 0.16;
  var HERO_END = 0.34;
  var FIRST_IN = 0.5;

  function showPanel(el, alpha) {
    el.style.opacity = alpha.toFixed(3);
    el.style.visibility = alpha > 0.01 ? 'visible' : 'hidden';
    el.style.transform = 'translate3d(0,' + ((1 - alpha) * 18).toFixed(1) + 'px,0)';
  }

  var activeIndex = -1;
  function render() {
    var u = state.u;
    var pos = stationAt(u);
    state.frame = frameAt(pos);
    var k = Math.min(Math.floor(pos), FOCUS.length - 2);
    state.focus = FOCUS[k] + (FOCUS[k + 1] - FOCUS[k]) * (pos - k);
    draw();

    showPanel(heroPanel, 1 - clamp01((u - HERO_END) / FADE));
    var active = -1;
    for (var n = 0; n < panels.length; n++) {
      var a = n === 0 ? FIRST_IN : holds[n].start - 0.1;
      var b = holds[n].end + 0.06;
      var alpha = clamp01((u - a) / FADE);
      if (n < panels.length - 1) alpha *= clamp01((b - u) / FADE);
      showPanel(panels[n], alpha);
      if (alpha > 0.5) active = n;
    }
    if (active !== activeIndex) {
      activeIndex = active;
      indexButtons.forEach(function (btn, idx) {
        if (idx === active) btn.setAttribute('aria-current', 'true');
        else btn.removeAttribute('aria-current');
      });
    }
  }

  /* Scrollsteuerung: Bühne wird angeheftet, der Scrollweg treibt die Zeitachse */
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  seq.classList.add('is-live');
  sizeCanvas();

  var tween = gsap.to(state, {
    u: TOTAL,
    ease: 'none',
    onUpdate: render,
    scrollTrigger: {
      trigger: stage,
      start: 'top top',
      end: function () { return '+=' + Math.round(TOTAL * window.innerHeight * (small ? 0.8 : 0.95)); },
      pin: true,
      scrub: 0.6,
      anticipatePin: 1,
      invalidateOnRefresh: true
    }
  });

  indexButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var n = Number(btn.getAttribute('data-go'));
      var st = tween.scrollTrigger;
      var target = n === 0 ? FIRST_IN + 0.3 : (holds[n].start + holds[n].end) / 2;
      window.scrollTo({ top: st.start + (st.end - st.start) * (target / TOTAL), behavior: 'smooth' });
    });
  });

  if ('ResizeObserver' in window) {
    new ResizeObserver(function () { sizeCanvas(); draw(); }).observe(stage);
  }

  render();
  for (var c = 0; c < 6; c++) loadNext();
})();
