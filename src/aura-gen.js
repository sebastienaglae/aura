/*!
 * Aura/gen — colorful "generating…" animations for AI output.  © Dash Systems.
 *
 * UI only: these play a lively colorful placeholder while YOUR app generates an
 * image / song / video / text with whatever AI backend you use, then reveal the
 * result. No network, no AI calls here.
 *
 *   const g = new ImageGen(el, { colors: ['#ff2d6f','#7a5bff','#00d4ff'] });
 *   // ... call your AI ...
 *   g.complete('https://.../result.png');     // fades the image in
 *
 * Common API on every generator:
 *   start() · stop() · setProgress(0..1) · setLabel(text) · complete(payload) · reset() · destroy()
 *   option onComplete(payload)
 */

const DEFAULT_COLORS = ['#ff2d6f', '#ff7a00', '#ffe000', '#21d36a', '#00d4ff', '#3d6bff', '#a93bff'];
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const gradList = (cols) => cols.join(',');

let CSS_INJECTED = false;
function injectCSS() {
  if (CSS_INJECTED || typeof document === 'undefined') return; CSS_INJECTED = true;
  const css = `
.ag-host { position: relative; overflow: hidden; }
.ag { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; font-family: system-ui, sans-serif; }
.ag-flow { position: absolute; inset: -12%; background: linear-gradient(115deg, var(--ag-cols)); background-size: 280% 280%; filter: blur(10px) saturate(1.2); opacity: 0; transition: opacity .45s ease; }
.ag-run .ag-flow { opacity: .92; animation: ag-flow var(--ag-speed,7s) ease infinite; }
@keyframes ag-flow { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
.ag-grain { position: absolute; inset: 0; opacity: .07; mix-blend-mode: overlay; pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
.ag-sweep { position: absolute; inset: 0; background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,.55) 50%, transparent 65%); transform: translateX(-120%); opacity: 0; }
.ag-run .ag-sweep { opacity: 1; animation: ag-sweep 1.8s ease-in-out infinite; }
@keyframes ag-sweep { to { transform: translateX(120%) } }
.ag-label { position: absolute; left: 0; right: 0; bottom: 10px; text-align: center; color: #fff; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; text-shadow: 0 1px 6px rgba(0,0,0,.6); opacity: .9; }
.ag-bar-progress { position: absolute; left: 8%; right: 8%; bottom: 30px; height: 4px; border-radius: 4px; background: rgba(255,255,255,.18); overflow: hidden; opacity: 0; transition: opacity .3s; }
.ag-run .ag-bar-progress.show { opacity: 1; }
.ag-bar-progress > i { display: block; height: 100%; width: calc(var(--ag-p,0)*100%); background: linear-gradient(90deg, var(--ag-cols)); transition: width .3s ease; }

/* reveal */
.ag-reveal { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transform: scale(1.04); transition: opacity .6s ease, transform .6s ease; }
.ag-reveal.show { opacity: 1; transform: scale(1); }
.ag-done .ag-flow, .ag-done .ag-sweep, .ag-done .ag-eq, .ag-done .ag-scan, .ag-done .ag-play, .ag-done .ag-lines, .ag-done .ag-label, .ag-done .ag-bar-progress { opacity: 0 !important; transition: opacity .5s; }

/* SONG — equalizer bars */
.ag-eq { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 14% 8%; }
.ag-eq > i { flex: 1; max-width: 12px; border-radius: 6px; background: linear-gradient(180deg, var(--ag-cols)); transform: scaleY(.15); transform-origin: center; opacity: .92; }
.ag-run .ag-eq > i { animation: ag-eq 1s ease-in-out infinite; }
@keyframes ag-eq { 0%,100%{ transform: scaleY(.18) } 50%{ transform: scaleY(1) } }

/* VIDEO — scanlines + play glyph */
.ag-scan { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 2px, transparent 2px 5px); mix-blend-mode: overlay; opacity: 0; }
.ag-run .ag-scan { opacity: 1; animation: ag-scan 5s linear infinite; }
@keyframes ag-scan { to { background-position: 0 60px } }
.ag-play { position: absolute; inset: 0; margin: auto; width: 0; height: 0; border-style: solid; border-width: 16px 0 16px 26px; border-color: transparent transparent transparent rgba(255,255,255,.92); filter: drop-shadow(0 0 14px rgba(255,255,255,.5)); }
.ag-run .ag-play { animation: ag-pulse 1.4s ease-in-out infinite; }
@keyframes ag-pulse { 0%,100%{ transform: scale(.9); opacity:.7 } 50%{ transform: scale(1.12); opacity:1 } }

/* TEXT — shimmering skeleton lines */
.ag-lines { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 11px; padding: 8% 9%; }
.ag-line { height: 12px; border-radius: 7px; background: linear-gradient(90deg, var(--ag-cols)); background-size: 300% 100%; }
.ag-run .ag-line { animation: ag-flow 2.6s linear infinite; }
.ag-text { position: absolute; inset: 0; padding: 8% 9%; color: #f4f6ff; font: 500 clamp(14px,2vw,18px)/1.55 system-ui,sans-serif; opacity: 0; transition: opacity .4s ease; overflow:auto; }
.ag-text.show { opacity: 1; }`;
  const el = document.createElement('style'); el.textContent = css; document.head.appendChild(el);
}

class GenBase {
  constructor(el, opts, kind) {
    injectCSS();
    if (!el) throw new Error('Aura gen: target element required');
    this.el = el; this.kind = kind;
    this.o = Object.assign({ autoStart: true, colors: DEFAULT_COLORS, label: '', speed: 7, onComplete: null }, opts);
    el.classList.add('ag-host');
    const node = document.createElement('div'); node.className = 'ag ag-' + kind;
    node.style.setProperty('--ag-cols', gradList(this.o.colors));
    node.style.setProperty('--ag-speed', this.o.speed + 's');
    this.node = node; el.appendChild(node);
    this._build();
    if (this.o.label) this.setLabel(this.o.label);
    if (this.o.autoStart) this.start();
  }
  start()       { this.node.classList.add('ag-run'); this.node.classList.remove('ag-done'); return this; }
  stop()        { this.node.classList.remove('ag-run'); return this; }
  setProgress(p){ this.node.style.setProperty('--ag-p', clamp01(p)); if (this._bar) this._bar.classList.add('show'); return this; }
  setLabel(t)   { if (!this._label) { this._label = document.createElement('div'); this._label.className = 'ag-label'; this.node.appendChild(this._label); } this._label.textContent = t; return this; }
  setColors(c)  { this.o.colors = c; this.node.style.setProperty('--ag-cols', gradList(c)); return this; }
  reset()       { this.node.classList.remove('ag-done'); if (this._result) { this._result.remove(); this._result = null; } this.start(); return this; }
  complete(payload) {
    this._reveal(payload);
    this.node.classList.add('ag-done'); this.node.classList.remove('ag-run');
    if (this.o.onComplete) this.o.onComplete(payload);
    return this;
  }
  destroy() { if (this.node.parentNode) this.node.parentNode.removeChild(this.node); }
  _build() {}
  _reveal() {}
  _mediaShow(node) { this.node.appendChild(node); setTimeout(() => node.classList.add('show'), 30); this._result = node; }
}

/* ---- Image ---- */
export class ImageGen extends GenBase {
  constructor(el, opts) { super(el, opts, 'image'); }
  _build() {
    this.node.appendChild(Object.assign(document.createElement('div'), { className: 'ag-flow' }));
    this.node.appendChild(Object.assign(document.createElement('div'), { className: 'ag-grain' }));
    this.node.appendChild(Object.assign(document.createElement('div'), { className: 'ag-sweep' }));
    this._bar = Object.assign(document.createElement('div'), { className: 'ag-bar-progress', innerHTML: '<i></i>' });
    this.node.appendChild(this._bar);
  }
  _reveal(url) {
    if (!url) return;
    const img = new Image(); img.className = 'ag-reveal'; img.alt = ''; img.src = url;
    img.onload = () => this._mediaShow(img);
  }
}

/* ---- Song / audio ---- */
export class SongGen extends GenBase {
  constructor(el, opts) { super(el, opts, 'song'); }
  _build() {
    this.node.appendChild(Object.assign(document.createElement('div'), { className: 'ag-flow' }));
    const bars = Math.max(8, (this.o.bars || 28) | 0);
    const eq = document.createElement('div'); eq.className = 'ag-eq';
    for (let i = 0; i < bars; i++) {
      const b = document.createElement('i');
      b.style.animationDelay = (-(i % 7) * 0.13 - Math.random() * 0.2) + 's';
      b.style.animationDuration = (0.7 + (i % 5) * 0.12) + 's';
      eq.appendChild(b);
    }
    this.node.appendChild(eq);
  }
  /** payload: an <audio>/HTMLMediaElement, a URL string, or a DOM node to show */
  _reveal(payload) {
    if (!payload) return;
    let node;
    if (typeof payload === 'string') { node = document.createElement('audio'); node.controls = true; node.src = payload; node.style.cssText = 'position:absolute;left:8%;right:8%;bottom:14%;width:84%;'; }
    else node = payload;
    node.classList && node.classList.add('ag-reveal');
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
  /** payload: a video URL string or an HTMLVideoElement */
  _reveal(payload) {
    if (!payload) return;
    let v;
    if (typeof payload === 'string') { v = document.createElement('video'); v.src = payload; v.controls = true; v.playsInline = true; }
    else v = payload;
    v.classList.add('ag-reveal');
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
  /** payload: the generated text (typed out), or { text, type:false } to skip typing */
  _reveal(payload) {
    const text = typeof payload === 'string' ? payload : (payload && payload.text) || '';
    const type = !(payload && payload.type === false);
    const box = document.createElement('div'); box.className = 'ag-text';
    this.node.appendChild(box);
    setTimeout(() => box.classList.add('show'), 30);
    this._result = box;
    if (!type) { box.textContent = text; return; }
    let i = 0; const step = Math.max(1, Math.round(text.length / 120));
    const tick = () => { if (!box.isConnected) return; i = Math.min(text.length, i + step); box.textContent = text.slice(0, i); if (i < text.length) this._typeTimer = setTimeout(tick, 16); };
    tick();
  }
  destroy() { clearTimeout(this._typeTimer); super.destroy(); }
}

export const GEN = { ImageGen, SongGen, VideoGen, TextGen };
