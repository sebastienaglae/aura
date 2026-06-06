/*!
 * Aura/gen — colorful "generating…" animations for AI output.  © Dash Systems.
 *
 * UI only: play a lively placeholder while YOUR app generates an image / song /
 * video / text, then reveal the result — or show a failure animation if it errors.
 *
 *   const g = new ImageGen(el, { colors: ['#ff2d6f','#7a5bff','#00d4ff'] });
 *   try   { g.complete(await ai.image(prompt)); }   // reveals the image
 *   catch { g.fail('Could not generate image'); }   // red shake + message
 *
 * API: start() · stop() · setProgress(0..1) · setLabel(t) · setColors([…]) ·
 *      reset() · complete(payload) · fail(message?) · destroy()
 * Options: autoStart, colors, label, speed, onComplete, onFail (+ bars / lines / tiles)
 */

const DEFAULT_COLORS = ['#ff2d6f', '#ff7a00', '#ffe000', '#21d36a', '#00d4ff', '#3d6bff', '#a93bff'];
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const gradList = (c) => c.join(',');
const ICON = {
  image: '<svg class="ag-glyph" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5L5 20"/></svg>',
  note:  '<svg class="ag-glyph" viewBox="0 0 24 24" fill="#fff"><path d="M9 17a3 3 0 1 1-2-2.83V5l11-2v9.5a3 3 0 1 1-2-2.83V6.3L9 7.6V17z"/></svg>',
  fail:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/></svg>',
};

let CSS_INJECTED = false;
function injectCSS() {
  if (CSS_INJECTED || typeof document === 'undefined') return; CSS_INJECTED = true;
  const css = `
.ag-host { position: relative; overflow: hidden; }
.ag { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; background: #07080f; font-family: system-ui, sans-serif; }
.ag-flow { position: absolute; inset: -12%; background: linear-gradient(115deg, var(--ag-cols)); background-size: 280% 280%; filter: blur(10px) saturate(1.2); opacity: 0; transition: opacity .45s ease; }
.ag-run .ag-flow { opacity: .35; animation: ag-flow var(--ag-speed,7s) ease infinite; }
@keyframes ag-flow { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
.ag-sweep { position: absolute; inset: 0; background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,.5) 50%, transparent 62%); transform: translateX(-120%); opacity: 0; }
.ag-run .ag-sweep { opacity: 1; animation: ag-sweep 1.9s ease-in-out infinite; }
@keyframes ag-sweep { to { transform: translateX(120%) } }
.ag-glyph { position: absolute; inset: 0; margin: auto; width: 34%; height: 34%; opacity: .55; filter: drop-shadow(0 2px 8px rgba(0,0,0,.5)); }
.ag-run .ag-glyph { animation: ag-breathe 2.2s ease-in-out infinite; }
@keyframes ag-breathe { 0%,100%{opacity:.4;transform:scale(.96)} 50%{opacity:.7;transform:scale(1.03)} }
.ag-label { position: absolute; left: 0; right: 0; bottom: 9px; text-align: center; color: #fff; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; text-shadow: 0 1px 6px rgba(0,0,0,.7); opacity: .85; }
.ag-bar-progress { position: absolute; left: 8%; right: 8%; bottom: 26px; height: 4px; border-radius: 4px; background: rgba(255,255,255,.16); overflow: hidden; opacity: 0; transition: opacity .3s; }
.ag-bar-progress.show { opacity: 1; }
.ag-bar-progress > i { display: block; height: 100%; width: calc(var(--ag-p,0)*100%); background: linear-gradient(90deg, var(--ag-cols)); transition: width .3s ease; }

/* reveal */
.ag-reveal { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transform: scale(1.04); transition: opacity .55s ease, transform .55s ease; }
.ag-reveal.show { opacity: 1; transform: scale(1); }
.ag-done .ag-flow, .ag-done .ag-sweep, .ag-done .ag-eq, .ag-done .ag-scan, .ag-done .ag-play, .ag-done .ag-lines, .ag-done .ag-mosaic, .ag-done .ag-glyph, .ag-done .ag-wave, .ag-done .ag-label, .ag-done .ag-bar-progress { opacity: 0 !important; transition: opacity .45s; }

/* IMAGE — resolving mosaic of colored tiles + image glyph */
.ag-mosaic { position: absolute; inset: 0; display: grid; gap: 2px; padding: 6px; }
.ag-mosaic > i { background: var(--c); border-radius: 3px; opacity: .2; transform: scale(.85); }
.ag-run .ag-mosaic > i { animation: ag-tile 1.7s ease-in-out infinite; animation-delay: var(--d); }
@keyframes ag-tile { 0%,100%{ opacity:.16; transform:scale(.84) } 50%{ opacity:.95; transform:scale(1) } }

/* SONG — clean equalizer bars + baseline + note glyph (reads as audio) */
.ag-eq { position: absolute; left: 0; right: 0; bottom: 34%; top: 24%; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 0 9%; }
.ag-eq > i { flex: 1; max-width: 10px; border-radius: 6px; background: linear-gradient(180deg, var(--ag-cols)); transform: scaleY(.16); transform-origin: center; }
.ag-run .ag-eq > i { animation: ag-eq 1s ease-in-out infinite; }
@keyframes ag-eq { 0%,100%{ transform: scaleY(.16) } 50%{ transform: scaleY(1) } }
.ag-baseline { position: absolute; left: 9%; right: 9%; bottom: 34%; height: 2px; background: rgba(255,255,255,.25); }

/* VIDEO — scanlines + pulsing play glyph (kept) */
.ag-scan { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 2px, transparent 2px 5px); mix-blend-mode: overlay; opacity: 0; }
.ag-run .ag-scan { opacity: 1; animation: ag-scan 5s linear infinite; }
@keyframes ag-scan { to { background-position: 0 60px } }
.ag-play { position: absolute; inset: 0; margin: auto; width: 0; height: 0; border-style: solid; border-width: 16px 0 16px 26px; border-color: transparent transparent transparent rgba(255,255,255,.92); filter: drop-shadow(0 0 14px rgba(255,255,255,.5)); }
.ag-run .ag-play { animation: ag-pulse 1.4s ease-in-out infinite; }
@keyframes ag-pulse { 0%,100%{ transform: scale(.9); opacity:.7 } 50%{ transform: scale(1.12); opacity:1 } }

/* TEXT — shimmering skeleton lines, then revealed text */
.ag-lines { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 11px; padding: 8% 9%; }
.ag-line { height: 12px; border-radius: 7px; background: linear-gradient(90deg, var(--ag-cols)); background-size: 300% 100%; opacity: .85; }
.ag-run .ag-line { animation: ag-flow 2.6s linear infinite; }
/* base opacity 1 => text is ALWAYS visible the moment it's revealed (the fade is a bonus) */
.ag-text { position: absolute; inset: 0; padding: 8% 9%; color: #f4f6ff; font: 500 clamp(14px,2vw,18px)/1.55 system-ui,sans-serif; opacity: 1; overflow: auto; animation: ag-fadein .45s ease; }
/* animate transform only — opacity stays 1 so text is visible even if the tab isn't compositing */
@keyframes ag-fadein { from { transform: translateY(6px) } to { transform: none } }
.ag-text::after { content: '▋'; opacity: .6; animation: ag-caret 1s steps(1) infinite; }
.ag-text.done::after { content: ''; }
@keyframes ag-caret { 50% { opacity: 0 } }

/* FAIL — red shake + message (any generator) */
.ag-fail { animation: ag-shake .42s ease; }
@keyframes ag-shake { 0%,100%{transform:translateX(0)} 18%{transform:translateX(-7px)} 38%{transform:translateX(6px)} 58%{transform:translateX(-4px)} 78%{transform:translateX(3px)} }
.ag-failmsg { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; padding: 8%; text-align: center; background: radial-gradient(120% 120% at 50% 45%, rgba(120,18,22,.55), rgba(40,6,8,.85)); color: #ffb4b4; font: 600 13px/1.4 system-ui, sans-serif; opacity: 0; transition: opacity .3s ease; }
.ag-failmsg.show { opacity: 1; }
.ag-failmsg svg { width: 34px; height: 34px; color: #ff6a6a; animation: ag-failpulse 1.1s ease-in-out infinite; }
@keyframes ag-failpulse { 0%,100%{ transform: scale(1); opacity:.85 } 50%{ transform: scale(1.12); opacity:1 } }`;
  const el = document.createElement('style'); el.textContent = css; document.head.appendChild(el);
}

class GenBase {
  constructor(el, opts, kind) {
    injectCSS();
    if (!el) throw new Error('Aura gen: target element required');
    this.el = el; this.kind = kind;
    this.o = Object.assign({ autoStart: true, colors: DEFAULT_COLORS, label: '', speed: 7, onComplete: null, onFail: null }, opts);
    el.classList.add('ag-host');
    const node = document.createElement('div'); node.className = 'ag ag-' + kind;
    node.style.setProperty('--ag-cols', gradList(this.o.colors));
    node.style.setProperty('--ag-speed', this.o.speed + 's');
    this.node = node; el.appendChild(node);
    this._build();
    if (this.o.label) this.setLabel(this.o.label);
    if (this.o.autoStart) this.start();
  }
  start()        { this.node.classList.add('ag-run'); this.node.classList.remove('ag-done', 'ag-fail'); return this; }
  stop()         { this.node.classList.remove('ag-run'); return this; }
  setProgress(p) { this.node.style.setProperty('--ag-p', clamp01(p)); if (this._bar) this._bar.classList.add('show'); return this; }
  setLabel(t)    { if (!this._label) { this._label = document.createElement('div'); this._label.className = 'ag-label'; this.node.appendChild(this._label); } this._label.textContent = t; return this; }
  setColors(c)   { this.o.colors = c; this.node.style.setProperty('--ag-cols', gradList(c)); return this; }
  reset() {
    this.node.classList.remove('ag-done', 'ag-fail');
    if (this._result) { this._result.remove(); this._result = null; }
    if (this._fail) { this._fail.classList.remove('show'); }
    this.start(); return this;
  }
  complete(payload) {
    this._reveal(payload);
    this.node.classList.add('ag-done'); this.node.classList.remove('ag-run', 'ag-fail');
    if (this.o.onComplete) this.o.onComplete(payload);
    return this;
  }
  /** show the failure animation (red shake + message) */
  fail(message) {
    this.stop();
    if (!this._fail) {
      this._fail = document.createElement('div'); this._fail.className = 'ag-failmsg';
      this._fail.innerHTML = ICON.fail; this._failText = document.createElement('div'); this._fail.appendChild(this._failText);
      this.node.appendChild(this._fail);
    }
    this._failText.textContent = message || 'Generation failed';
    // restart the shake even if already failed once
    this.node.classList.remove('ag-fail'); void this.node.offsetWidth; this.node.classList.add('ag-fail');
    void this._fail.offsetWidth; this._fail.classList.add('show');
    if (this.o.onFail) this.o.onFail(message);
    return this;
  }
  destroy() { if (this.node.parentNode) this.node.parentNode.removeChild(this.node); }
  _build() {}
  _reveal() {}
  // robust reveal: a reflow-driven CSS transition (runs even when rAF/timers are throttled)
  _mediaShow(node) { node.classList.add('ag-reveal'); this.node.appendChild(node); void node.offsetWidth; node.classList.add('show'); this._result = node; }
}

/* ---- Image ---- */
export class ImageGen extends GenBase {
  constructor(el, opts) { super(el, opts, 'image'); }
  _build() {
    const cols = (this.o.tiles && this.o.tiles[0]) || 8, rows = (this.o.tiles && this.o.tiles[1]) || 5;
    const m = document.createElement('div'); m.className = 'ag-mosaic';
    m.style.gridTemplateColumns = `repeat(${cols},1fr)`; m.style.gridTemplateRows = `repeat(${rows},1fr)`;
    const pal = this.o.colors;
    for (let i = 0; i < cols * rows; i++) {
      const t = document.createElement('i');
      t.style.setProperty('--c', pal[(i * 3 + ((i / cols) | 0)) % pal.length]);
      t.style.setProperty('--d', (-((i % cols) * 0.08 + ((i / cols) | 0) * 0.12) - Math.random() * 0.2) + 's');
      m.appendChild(t);
    }
    this.node.appendChild(m);
    this.node.insertAdjacentHTML('beforeend', ICON.image);
    this.node.appendChild(Object.assign(document.createElement('div'), { className: 'ag-sweep' }));
    this._bar = Object.assign(document.createElement('div'), { className: 'ag-bar-progress', innerHTML: '<i></i>' });
    this.node.appendChild(this._bar);
  }
  _reveal(url) { if (!url) return; const img = new Image(); img.alt = ''; img.onload = () => this._mediaShow(img); img.src = url; }
}

/* ---- Song / audio ---- */
export class SongGen extends GenBase {
  constructor(el, opts) { super(el, opts, 'song'); }
  _build() {
    this.node.appendChild(Object.assign(document.createElement('div'), { className: 'ag-flow' }));
    this.node.insertAdjacentHTML('beforeend', ICON.note);
    const bars = Math.max(10, (this.o.bars || 24) | 0);
    const eq = document.createElement('div'); eq.className = 'ag-eq';
    for (let i = 0; i < bars; i++) {
      const b = document.createElement('i');
      b.style.animationDelay = (-(i % 9) * 0.09 - Math.random() * 0.15) + 's';
      b.style.animationDuration = (0.65 + (i % 5) * 0.1) + 's';
      eq.appendChild(b);
    }
    this.node.appendChild(eq);
    this.node.appendChild(Object.assign(document.createElement('div'), { className: 'ag-baseline' }));
  }
  _reveal(payload) {
    if (!payload) return;
    let node;
    if (typeof payload === 'string') { node = document.createElement('audio'); node.controls = true; node.src = payload; node.style.cssText = 'position:absolute;left:8%;right:8%;bottom:16%;width:84%;'; }
    else node = payload;
    this._mediaShow(node);
  }
}

/* ---- Video ---- */
export class VideoGen extends GenBase {
  constructor(el, opts) { super(el, opts, 'video'); }
  _build() {
    this.node.appendChild(Object.assign(document.createElement('div'), { className: 'ag-flow' }));
    this.node.appendChild(Object.assign(document.createElement('div'), { className: 'ag-scan' }));
    this.node.appendChild(Object.assign(document.createElement('div'), { className: 'ag-play' }));
    this._bar = Object.assign(document.createElement('div'), { className: 'ag-bar-progress', innerHTML: '<i></i>' });
    this.node.appendChild(this._bar);
  }
  _reveal(payload) {
    if (!payload) return;
    let v;
    if (typeof payload === 'string') { v = document.createElement('video'); v.src = payload; v.controls = true; v.playsInline = true; }
    else v = payload;
    this._mediaShow(v);
  }
}

/* ---- Text ---- */
export class TextGen extends GenBase {
  constructor(el, opts) { super(el, opts, 'text'); }
  _build() {
    const lines = Math.max(2, (this.o.lines || 4) | 0);
    const wrap = document.createElement('div'); wrap.className = 'ag-lines';
    for (let i = 0; i < lines; i++) {
      const l = document.createElement('div'); l.className = 'ag-line';
      l.style.width = (i === lines - 1 ? 45 + Math.random() * 25 : 78 + Math.random() * 20) + '%';
      l.style.animationDelay = (-i * 0.25) + 's';
      wrap.appendChild(l);
    }
    this.node.appendChild(wrap);
  }
  _reveal(payload) {
    const text = typeof payload === 'string' ? payload : (payload && payload.text) || '';
    const type = !(payload && payload.type === false);
    const box = document.createElement('div'); box.className = 'ag-text';
    box.textContent = type ? '' : text;          // visible immediately (base opacity 1)
    this.node.appendChild(box);
    this._result = box;
    if (!type) { box.classList.add('done'); return; }
    let i = 0; const step = Math.max(1, Math.round(text.length / 110));
    const tick = () => {
      if (!box.isConnected) return;
      i = Math.min(text.length, i + step); box.textContent = text.slice(0, i);
      if (i < text.length) this._typeTimer = setTimeout(tick, 18); else box.classList.add('done');
    };
    tick();
  }
  destroy() { clearTimeout(this._typeTimer); super.destroy(); }
}

export const GEN = { ImageGen, SongGen, VideoGen, TextGen };
