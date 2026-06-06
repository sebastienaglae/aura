/*!
 * Aura — voice-reactive orb + animated rainbow frame.  © Dash Systems.
 *
 * Audio runs on the browser's NATIVE Web Audio graph (BiquadFilter + AnalyserNode):
 * compiled C++ on a dedicated audio thread — as fast as WASM, zero deps. Per frame we
 * only do a ~1024-sample RMS loop in JS. Everything is delta-time based (identical at
 * any frame rate) and GPU-cheap (gradients rotated with transform, never repainted).
 *
 * This library is UI only — it never talks to an AI service. You drive it (setMode,
 * enableMic, level getters, events) from your own app.
 */

// ---- accent palette for the orb's internal waves ----
const PALETTE = [
  [255, 149, 64], [255, 78, 122], [214, 84, 214],
  [150, 92, 232], [90, 170, 255], [86, 224, 224],
];
function lerpColor(t) {
  const seg = PALETTE.length;
  const x = ((t % 1) + 1) % 1 * seg;
  const i = Math.floor(x), f = x - i;
  const a = PALETTE[i % seg], b = PALETTE[(i + 1) % seg];
  return [a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f, a[2]+(b[2]-a[2])*f];
}
const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
const easeOutBack = (x) => { const c = 1.70158, c3 = c + 1, u = x - 1; return 1 + c3*u*u*u + c*u*u; };

/* ===================== AudioReactor ===================== */
export class AudioReactor {
  constructor(opts = {}) {
    this.threshold = opts.threshold != null ? opts.threshold : 0.20;
    this.preamp    = opts.preamp    != null ? opts.preamp    : 2.4;
    this.highpass  = opts.highpass  != null ? opts.highpass  : 80;
    this.lowpass   = opts.lowpass   != null ? opts.lowpass   : 9000;
    this.level = 0; this.bass = 0; this.mid = 0; this.treble = 0;
    this.live = false; this.fake = false;
    this._peak = 0.012; this._gain = 4;
    this._bMax = 0.05; this._mMax = 0.05; this._tMax = 0.05;
    this._fakeT = 0; this._syll = 0; this._syllT = 0; this._pause = 0; this._pitch = 0.3;
  }
  async enableMic() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    const AC = window.AudioContext || window.webkitAudioContext;
    const actx = new AC();
    if (actx.state === 'suspended') await actx.resume();
    const src = actx.createMediaStreamSource(stream);
    const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = this.highpass;
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = this.lowpass;
    const gain = actx.createGain(); gain.gain.value = this.preamp;
    const an = actx.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = 0.7;
    src.connect(hp); hp.connect(lp); lp.connect(gain); gain.connect(an);
    this._an = an; this._freq = new Uint8Array(an.frequencyBinCount); this._time = new Uint8Array(an.fftSize);
    this._actx = actx; this._stream = stream; this.fake = false; this.live = true;
  }
  enableDemo() { this._freq = new Uint8Array(512); this._time = new Uint8Array(1024); this.fake = true; this.live = true; }
  stop() {
    if (this._stream) this._stream.getTracks().forEach(t => t.stop());
    if (this._actx) { try { this._actx.close(); } catch (e) {} }
    this._an = null; this._stream = null; this._actx = null; this.live = false; this.fake = false;
  }
  update(dt) {
    if (!this.live) {
      const d = 1 - Math.exp(-8 * dt);
      this.level += -this.level * d; this.bass += -this.bass * d; this.mid += -this.mid * d; this.treble += -this.treble * d;
      return;
    }
    let raw, normalize;
    if (this.fake) { raw = this._synth(dt); normalize = false; }
    else {
      this._an.getByteTimeDomainData(this._time);
      let ss = 0;
      for (let i = 0; i < this._time.length; i++) { const v = (this._time[i]-128)/128; ss += v*v; }
      const rms = Math.sqrt(ss / this._time.length);
      this._peak = Math.max(rms, this._peak * (1 - 0.4*dt), 0.012);
      let g = 0.85 / this._peak; g = Math.max(2, Math.min(16, g));
      this._gain += (g - this._gain) * (1 - Math.exp(-3*dt));
      raw = clamp01(rms * this._gain);
      this._an.getByteFrequencyData(this._freq);
      normalize = true;
    }
    const voiced = clamp01((raw - this.threshold) / (1 - this.threshold));
    this.level += (voiced - this.level) * (1 - Math.exp(-22*dt));
    this._bands(dt, voiced, normalize);
  }
  _bands(dt, voiced, normalize) {
    const s = 1 - Math.exp(-18*dt), f = this._freq, n = f.length;
    const avg = (a, b) => { let s=0,c=0; for (let i=a|0;i<b;i++){s+=f[i];c++;} return c?s/c/255:0; };
    let tb = avg(0,n*0.10), tm = avg(n*0.10,n*0.40), tt = avg(n*0.40,n*0.95);
    if (normalize) {
      const dec = 1 - 0.5*dt;
      this._bMax = Math.max(tb, this._bMax*dec, 0.04); this._mMax = Math.max(tm, this._mMax*dec, 0.04); this._tMax = Math.max(tt, this._tMax*dec, 0.03);
      tb = Math.min(1, tb/this._bMax); tm = Math.min(1, tm/this._mMax); tt = Math.min(1, tt/this._tMax);
    }
    tb *= voiced; tm *= voiced; tt *= voiced;
    this.bass += (tb-this.bass)*s; this.mid += (tm-this.mid)*s; this.treble += (tt-this.treble)*s;
  }
  _synth(dt) {
    this._fakeT += dt; this._syllT -= dt;
    if (this._syllT <= 0) {
      if (this._pause > 0) { this._pause--; this._syll = 0.02+Math.random()*0.04; this._syllT = 0.07; }
      else {
        this._syll = 0.25+Math.random()*0.75; this._syllT = 0.10+Math.random()*0.20;
        this._pitch = Math.max(0.12, Math.min(0.85, this._pitch + (Math.random()-0.5)*0.5));
        if (Math.random() < 0.22) this._pause = 1 + (Math.random()*3 | 0);
      }
    }
    const env = Math.min(1, this._syll * (1 + 0.12*Math.sin(this._fakeT*36)));
    const fr = this._freq, n = fr.length, peak = this._pitch*n, width = n*(0.10+env*0.18);
    for (let i = 0; i < n; i++) {
      const d = (i-peak)/width, dh = (i-peak*2)/(width*0.7);
      let v = Math.exp(-d*d)*255*env + Math.exp(-dh*dh)*120*env + Math.random()*26*(i>n*0.4?env:0.3);
      fr[i] = v<0?0:v>255?255:v|0;
    }
    return env;
  }
}

/* mode visual config — gradient + halo + body tints */
const MODE = {
  normal:  { halo: '150,190,255', grad: 'conic-gradient(#ff2d6f,#ff7a00,#ffe000,#21d36a,#00d4ff,#3d6bff,#a93bff,#ff3bc4,#ff2d6f)' },
  think:   { halo: '150,150,255', grad: 'conic-gradient(#6a5bff,#4d7bff,#00d4ff,#9b6bff,#6a5bff)' },
  error:   { halo: '255,90,90',   grad: 'conic-gradient(#ff2d2d,#ff6a3d,#b30000,#ff5b5b,#ff2d2d)', base: ['40,8,10','86,14,18','180,46,46'] },
  success: { halo: '120,255,170', grad: 'conic-gradient(#2bd576,#7CFF9B,#0b9e54,#56f0a0,#2bd576)', base: ['8,32,18','14,70,40','40,170,100'] },
  warning: { halo: '255,205,110', grad: 'conic-gradient(#ffb020,#ffd45e,#c77f00,#ffc94d,#ffb020)', base: ['40,28,6','80,56,12','190,140,40'] },
};
const WAVES = [
  { col: [110,165,255], yo: -0.12, fr: 1.4, sp:  0.0016, band: 'bass'   },
  { col: [150,200,255], yo: -0.04, fr: 2.0, sp: -0.0023, band: 'mid'    },
  { col: [195,225,255], yo:  0.04, fr: 1.7, sp:  0.0027, band: 'mid'    },
  { col: [225,242,255], yo:  0.12, fr: 2.6, sp: -0.0020, band: 'treble' },
  { col: [255,255,255], yo:  0.20, fr: 3.3, sp:  0.0031, band: 'treble' },
];

let CSS_INJECTED = false;
function injectCSS() {
  if (CSS_INJECTED || typeof document === 'undefined') return; CSS_INJECTED = true;
  const css = `
@property --vo-angle { syntax: '<angle>'; initial-value: 0deg; inherits: true; }
.vo-root { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.vo-canvas { position: absolute; inset: 0; z-index: 2; transition: filter .25s; }
.vo-canvas.vo-dim { filter: grayscale(1) brightness(.5); }
.vo-spin { position: absolute; top: 50%; left: 50%; width: 160vmax; height: 160vmax; margin: -80vmax 0 0 -80vmax; transform: rotate(var(--vo-angle)); }
/* two cross-fading gradient layers => smooth color transitions between modes */
.vo-grad { position: absolute; inset: 0; transition: opacity var(--vo-fade,.6s) ease; }
.vo-glow, .vo-border { position: absolute; inset: 0; overflow: hidden; }
.vo-glow { z-index: 3; opacity: .85;
  -webkit-mask: linear-gradient(to bottom,#000,transparent var(--vo-edge,0px)), linear-gradient(to top,#000,transparent var(--vo-edge,0px)), linear-gradient(to right,#000,transparent var(--vo-edge,0px)), linear-gradient(to left,#000,transparent var(--vo-edge,0px));
  -webkit-mask-composite: source-over; mask-composite: add; }
.vo-border { z-index: 4; padding: 4px; opacity: .8;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
.vo-hit { position: absolute; border-radius: 50%; z-index: 6; pointer-events: auto; cursor: grab; touch-action: none; }
.vo-hit:active { cursor: grabbing; }
.vo-highlight { position: absolute; z-index: 5; pointer-events: none; border: 2px solid #5b8cff; border-radius: 8px; box-shadow: 0 0 0 3px rgba(91,140,255,.25), 0 6px 30px rgba(91,140,255,.35); opacity: 0; transition: opacity .15s ease; }
.vo-highlight.on { opacity: 1; }
.vo-close { position: absolute; z-index: 9; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(18,18,22,.5); pointer-events: none; cursor: pointer; opacity: 0; transform: scale(.7); transition: opacity .2s ease, transform .2s ease; }
.vo-close.on { opacity: 1; transform: scale(1); pointer-events: auto; }
.vo-close svg { width: 44%; height: 44%; pointer-events: none; }
.vo-subtitle { position: absolute; left: 50%; bottom: 8%; transform: translateX(-50%); z-index: 8; width: 80%; max-width: 680px; pointer-events: none; font: 500 clamp(15px,2.4vw,22px)/1.35 system-ui, sans-serif; color: #fff; text-shadow: 0 2px 14px rgba(0,0,0,.9), 0 0 2px rgba(0,0,0,.8); display: flex; flex-direction: column; justify-content: flex-end; align-items: center; text-align: center; max-height: 2.8em; overflow: hidden; word-break: break-word; opacity: 0; transition: opacity .25s; }
.vo-subtitle.on { opacity: 1; }
.vo-subtitle .interim { opacity: .6; }`;
  const el = document.createElement('style'); el.textContent = css; document.head.appendChild(el);
}

/* ===================== Aura (the orb) ===================== */
export class VoiceOrb {
  constructor(target, opts = {}) {
    injectCSS();
    this.o = Object.assign({
      ballRadius: 32, threshold: 0.20, maxEdge: 20,
      spinIdle: 28, spinSpeak: 240,
      preamp: 2.4, highpass: 80, lowpass: 9000,
      position: [1, 2], subtitles: false, lang: 'en-US',
      borderRadius: 0, borderWidth: 4, colorFade: 0.6,
      closeTimeout: 2000, subtitleTimeout: 5000, subtitleMaxWords: 16,
      draggable: true, dismissible: true,
      autoMove: false, autoMoveContainer: null, avoidMargin: 14,
      gridMargin: [0.22, 0.18],
      onClose: null, onMove: null, onMode: null,
    }, opts);

    this.audio = new AudioReactor(this.o);
    this.mode = 'normal'; this._forced = null;
    this._ev = {};
    this._confirm = false;
    this._appear = 0; this._appearTo = 1; this._closing = false;
    this._kick = 0; this._angle = 0; this._edge = 0; this._act = 0;
    this._wAmp = WAVES.map(() => 0);
    this._desired = { x: 0, y: 0 }; this._obstacle = null; this._hlEl = null;

    if (getComputedStyle(target).position === 'static') target.style.position = 'relative';
    const root = document.createElement('div'); root.className = 'vo-root';
    const mk = (cls, parent) => { const d = document.createElement('div'); d.className = cls; (parent||root).appendChild(d); return d; };
    const canvas = document.createElement('canvas'); canvas.className = 'vo-canvas'; root.appendChild(canvas);
    const glow = mk('vo-glow'), border = mk('vo-border');
    this._rings = [glow, border].map(ring => {
      const spin = mk('vo-spin', ring);
      const g0 = mk('vo-grad', spin);
      g0.style.background = MODE.normal.grad; g0.style.opacity = '1';
      return { spin, grads: [g0], cur: 0 };  // 2nd layer created lazily on first mode change
    });
    const highlight = mk('vo-highlight'), hit = mk('vo-hit'), close = mk('vo-close');
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    const sub = mk('vo-subtitle');
    target.appendChild(root);

    Object.assign(this, { target, root, canvas, glow, border, hit, closeEl: close, subEl: sub, hlEl: highlight });
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.orb = { x: 0, y: 0, tx: 0, ty: 0, col: this.o.position[0], row: this.o.position[1] };
    this._W = 0; this._H = 0; this._DPR = 1;

    root.style.setProperty('--vo-fade', this.o.colorFade + 's');
    this.setBorderWidth(this.o.borderWidth);
    this.setBorderRadius(this.o.borderRadius);

    this._resize();
    this._ro = new ResizeObserver(() => this._resize()); this._ro.observe(target);

    // drag (free positioning) + tap (close confirm)
    this._drag = null;
    if (this.o.draggable || this.o.dismissible) {
      hit.addEventListener('pointerdown', (e) => {
        if (!this.o.draggable && !this.o.dismissible) return;
        e.preventDefault(); e.stopPropagation();
        this._drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false };
        try { hit.setPointerCapture(e.pointerId); } catch (err) {}
      });
      this._onPointerMove = (e) => {
        if (!this._drag || e.pointerId !== this._drag.id || !this.o.draggable) return;
        if (Math.hypot(e.clientX - this._drag.sx, e.clientY - this._drag.sy) > 5) this._drag.moved = true;
        if (this._drag.moved) { const b = this.target.getBoundingClientRect(); this._setDesired(e.clientX - b.left, e.clientY - b.top, false); }
      };
      this._onPointerUp = (e) => {
        if (!this._drag || e.pointerId !== this._drag.id) return;
        const moved = this._drag.moved; this._drag = null;
        if (!moved && this.o.dismissible) this._setConfirm(!this._confirm);
      };
      window.addEventListener('pointermove', this._onPointerMove);
      window.addEventListener('pointerup', this._onPointerUp);
      close.addEventListener('click', (e) => { e.stopPropagation(); this.close(); });
      this._onDocDown = (e) => { if (this._confirm && !this.root.contains(e.target)) this._setConfirm(false); };
      document.addEventListener('pointerdown', this._onDocDown, true);
    }

    if (this.o.autoMove) this.enableAutoMove();
    if (this.o.subtitles) this.showSubtitles(true);

    this._prev = (typeof performance !== 'undefined' ? performance.now() : 0);
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  // ---- control ----
  async enableMic()  { const r = await this.audio.enableMic(); if (this._wantSubs) this._startSpeech(); return r; }
  enableDemo() { this.audio.enableDemo(); }
  stop()       { this.audio.stop(); this._stopSpeech(); }
  setMode(mode) { this._forced = mode === 'normal' ? null : mode; this._applyMode(); return this; }
  moveTo(col, row) {
    col = clampI(col); row = clampI(row);
    const changed = col !== this.orb.col || row !== this.orb.row;
    this.orb.col = col; this.orb.row = row; this._target(false);
    if (changed) { if (this.o.onMove) this.o.onMove(col, row); this._emit('move', col, row); }
    return this;
  }
  moveToPoint(x, y, snap) { this._setDesired(x, y, snap); return this; }
  close() { if (this._closing || this._appearTo === 0) return; this._setConfirm(false); this._closing = true; this._appearTo = 0; return this; }
  open()  { this.root.style.display = ''; this._closing = false; this._appearTo = 1; return this; }
  highlight(el) { this._hlEl = el || null; this.hlEl.classList.toggle('on', !!el); this._syncHighlight(); this._emit('highlight', el); return this; }
  clearHighlight() { this._hlEl = null; this._obstacle = null; this.hlEl.classList.remove('on'); return this; }
  avoid(el) { return this.highlight(el); }
  showSubtitles(on) {
    this._wantSubs = !!on;
    if (!on) { this._stopSpeech(); this.subEl.classList.remove('on'); this.subEl.textContent = ''; }
    else if (this.audio.live && !this.audio.fake) this._startSpeech();
    return this;
  }

  // ---- configurable setters ----
  setBorderWidth(px)  { this.o.borderWidth = px; this.border.style.padding = px + 'px'; return this; }
  setBorderRadius(px) { this.o.borderRadius = px; this.border.style.borderRadius = px + 'px'; this.glow.style.borderRadius = px + 'px'; return this; }
  setThreshold(t)  { this.o.threshold = this.audio.threshold = t; return this; }
  setMaxEdge(px)   { this.o.maxEdge = px; return this; }
  setSpin(idle, speak) { if (idle != null) this.o.spinIdle = idle; if (speak != null) this.o.spinSpeak = speak; return this; }
  setColorFade(sec){ this.o.colorFade = sec; this.root.style.setProperty('--vo-fade', sec + 's'); return this; }
  setPalette(arr)  { if (arr && arr.length) { PALETTE.length = 0; arr.forEach(c => PALETTE.push(c)); } return this; }
  configure(patch) { Object.assign(this.o, patch || {}); return this; }

  // ---- getters ----
  getMode()        { return this.mode; }
  getLevel()       { return this.audio.level; }
  getBands()       { return { bass: this.audio.bass, mid: this.audio.mid, treble: this.audio.treble }; }
  getPosition()    { return { x: this.orb.x, y: this.orb.y, col: this.orb.col, row: this.orb.row }; }
  getHighlighted() { return this._hlEl; }
  isListening()    { return this.audio.live && !this.audio.fake; }
  isDemo()         { return this.audio.fake; }
  isOpen()         { return this._appearTo > 0; }
  getState()       { return { mode: this.mode, level: this.audio.level, bands: this.getBands(), position: this.getPosition(), listening: this.isListening(), demo: this.isDemo(), open: this.isOpen() }; }

  // ---- events ----
  on(ev, fn)  { (this._ev[ev] || (this._ev[ev] = [])).push(fn); return () => this.off(ev, fn); }
  off(ev, fn) { const a = this._ev[ev]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
  _emit(ev, ...a) { (this._ev[ev] || []).forEach(f => { try { f(...a); } catch (e) {} }); }

  destroy() {
    cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect();
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    document.removeEventListener('pointerdown', this._onDocDown, true);
    this.disableAutoMove();
    clearTimeout(this._closeTimer); clearTimeout(this._subTimer);
    this._stopSpeech(); this.audio.stop();
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
  }

  // ---- internals ----
  _applyMode() {
    const m = this._forced || 'normal';
    if (m === this.mode) return;
    this.mode = m;
    // cross-fade both rings to the new gradient (smooth, not a hard swap)
    const grad = (MODE[m] || MODE.normal).grad;
    for (const ring of this._rings) {
      if (ring.grads.length < 2) {            // lazily add the cross-fade layer
        const g1 = document.createElement('div'); g1.className = 'vo-grad'; g1.style.opacity = '0';
        ring.spin.appendChild(g1); ring.grads.push(g1);
      }
      const nxt = ring.cur ^ 1;
      ring.grads[nxt].style.background = grad;
      ring.grads[nxt].style.opacity = '1';
      ring.grads[ring.cur].style.opacity = '0';
      ring.cur = nxt;
    }
    if (this.o.onMode) this.o.onMode(m);
    this._emit('mode', m);
  }
  _setConfirm(on) {
    this._confirm = on;
    this.canvas.classList.toggle('vo-dim', on);
    this.closeEl.classList.toggle('on', on);
    clearTimeout(this._closeTimer);
    if (on && this.o.closeTimeout > 0) this._closeTimer = setTimeout(() => this._setConfirm(false), this.o.closeTimeout);
  }
  _resize() {
    const r = this.target.getBoundingClientRect();
    this._W = Math.max(1, r.width); this._H = Math.max(1, r.height);
    this._DPR = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 1.5);
    this.canvas.width = this._W * this._DPR; this.canvas.height = this._H * this._DPR;
    this.ctx.setTransform(this._DPR, 0, 0, this._DPR, 0, 0);
    this._target(this.orb.x === 0 && this.orb.y === 0);
  }
  _gridPos(col, row) {
    const R = this.o.ballRadius, W = this._W, H = this._H, gm = this.o.gridMargin;
    const mx = Math.max(R*2.2, Math.min(W*gm[0], 220)), my = Math.max(R*2.2, Math.min(H*gm[1], 200));
    return { x: [mx, W/2, W-mx][col], y: [my, H/2, H-my][row] };
  }
  enableAutoMove() {
    if (this._autoOn) return; this._autoOn = true;
    const c = this.o.autoMoveContainer || document;
    this._onContentClick = (e) => {
      if (this.root.contains(e.target)) return;
      const el = e.target;
      if (el === document.body || el === document.documentElement) { this.clearHighlight(); return; }
      this.highlight(el);
    };
    c.addEventListener('click', this._onContentClick, true);
  }
  disableAutoMove() {
    if (!this._autoOn) return; this._autoOn = false;
    (this.o.autoMoveContainer || document).removeEventListener('click', this._onContentClick, true);
  }
  _syncHighlight() {
    if (!this._hlEl || !this._hlEl.isConnected) { if (this._hlEl) this.clearHighlight(); return; }
    const base = this.target.getBoundingClientRect(), r = this._hlEl.getBoundingClientRect();
    const L = r.left - base.left, T = r.top - base.top;
    this.hlEl.style.left = L+'px'; this.hlEl.style.top = T+'px'; this.hlEl.style.width = r.width+'px'; this.hlEl.style.height = r.height+'px';
    this._obstacle = { left: L, top: T, right: L + r.width, bottom: T + r.height };
  }
  _setDesired(x, y, snap) {
    this._desired.x = x; this._desired.y = y;
    if (snap) { const c = this._constrain(x, y); this.orb.x = this.orb.tx = c.x; this.orb.y = this.orb.ty = c.y; }
  }
  _target(snap) { const p = this._gridPos(this.orb.col, this.orb.row); this._setDesired(p.x, p.y, snap); }
  _constrain(x, y) {
    const R = this.o.ballRadius + 6, W = this._W, H = this._H, cl = (v,a,b)=>v<a?a:v>b?b:v;
    x = cl(x, R, Math.max(R, W - R)); y = cl(y, R, Math.max(R, H - R));
    const ob = this._obstacle;
    if (ob) {
      const m = this.o.avoidMargin;
      const ex0 = ob.left - R - m, ey0 = ob.top - R - m, ex1 = ob.right + R + m, ey1 = ob.bottom + R + m;
      if (x > ex0 && x < ex1 && y > ey0 && y < ey1) {
        const cands = [{x:ex0,y},{x:ex1,y},{x,y:ey0},{x,y:ey1}].map(c => ({ x: cl(c.x,R,Math.max(R,W-R)), y: cl(c.y,R,Math.max(R,H-R)) }));
        const inside = (c) => c.x > ex0 && c.x < ex1 && c.y > ey0 && c.y < ey1;
        let valid = cands.filter(c => !inside(c)); if (!valid.length) valid = cands;
        const d2 = (c) => (c.x-x)*(c.x-x) + (c.y-y)*(c.y-y);
        valid.sort((a,b) => d2(a) - d2(b)); return valid[0];
      }
    }
    return { x, y };
  }

  _loop(now) {
    this._raf = requestAnimationFrame(this._loop);
    let dt = (now - this._prev) / 1000; this._prev = now;
    if (dt > 0.1) dt = 0.1;

    this._appear += (this._appearTo - this._appear) * (1 - Math.exp(-11 * dt));
    if (this._closing && this._appear < 0.02) {
      this._closing = false; this.root.style.display = 'none';
      this.audio.stop(); this._stopSpeech();
      if (this.o.onClose) this.o.onClose(); this._emit('close');
      return;
    }

    this._syncHighlight();
    const c = this._constrain(this._desired.x, this._desired.y);
    this.orb.tx = c.x; this.orb.ty = c.y;

    const A = this.audio; A.update(dt);
    const m = this.mode, ME = this.o.maxEdge;
    let act, spin, et;
    if (m === 'think')        { act = 0.30 + 0.50*(0.5+0.5*Math.sin(now*0.0024)); spin = 26 + act*30; et = ME*(0.30+0.35*(0.5+0.5*Math.sin(now*0.0024))); }
    else if (m === 'error')   { act = Math.max(0.55, A.live?A.level:0);  spin = 150 + act*160; et = ME*(0.65+0.35*Math.abs(Math.sin(now*0.006))); }
    else if (m === 'success') { act = 0.45 + 0.25*Math.sin(now*0.004);   spin = 70 + act*110; et = ME*(0.45+0.25*Math.sin(now*0.003)); }
    else if (m === 'warning') { act = 0.40 + 0.20*Math.sin(now*0.005);   spin = 55 + act*90;  et = ME*(0.40+0.25*Math.abs(Math.sin(now*0.004))); }
    else                      { act = A.live?A.level:0; spin = this.o.spinIdle + (A.live?A.level*this.o.spinSpeak:0); et = A.live?Math.min(1,A.level)*ME:0; }
    this._act = act;

    const ap = clamp01(this._appear);
    this._angle = (this._angle + spin * dt) % 360;
    this.root.style.setProperty('--vo-angle', this._angle.toFixed(2) + 'deg');
    this._edge += (et - this._edge) * (1 - Math.exp(-9 * dt));
    this.root.style.setProperty('--vo-edge', (this._edge * ap).toFixed(2) + 'px');
    this.glow.style.opacity = (0.85 * ap).toFixed(3);
    this.border.style.opacity = (0.8 * ap).toFixed(3);

    this.ctx.clearRect(0, 0, this._W, this._H);
    this._drawOrb(now, dt, ap);
  }

  _drawOrb(time, dt, ap) {
    const ctx = this.ctx, A = this.audio, R0 = this.o.ballRadius, m = this.mode, act = this._act;
    const isThink = m==='think', isError = m==='error', isSucc = m==='success', isWarn = m==='warning';
    const active = isThink || isError || isSucc || isWarn || A.live;
    const cfg = MODE[m] || MODE.normal;

    this._kick += (act - this._kick) * (1 - Math.exp(-(act > this._kick ? 16 : 5) * dt));
    const kick = this._kick;
    const ease = 1 - Math.exp(-9 * dt);
    this.orb.x += (this.orb.tx - this.orb.x) * ease; this.orb.y += (this.orb.ty - this.orb.y) * ease;

    const scale = easeOutBack(ap);
    const thinkPulse = isThink ? (1 + 0.16 * Math.sin(time * 0.0024)) : 1;
    const cx = this.orb.x, cy = this.orb.y + Math.sin(time*0.0016)*3 - (active ? kick*6 : 0);
    const R = R0 * scale * thinkPulse * (1 + (active ? kick*0.22 : 0.015*Math.sin(time*0.002)));

    const d = R*2, L = cx - R, T = cy - R;
    const setBox = (el) => { el.style.left = L+'px'; el.style.top = T+'px'; el.style.width = d+'px'; el.style.height = d+'px'; };
    setBox(this.hit); setBox(this.closeEl);
    this.hit.style.display = ap > 0.4 ? '' : 'none';
    if (R < 0.5) return;

    ctx.save(); ctx.globalAlpha = ap;
    let halo = ctx.createRadialGradient(cx, cy, R*0.5, cx, cy, R*1.9);
    halo.addColorStop(0, `rgba(${cfg.halo},${active ? 0.08+kick*0.22 : 0.06})`); halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, R*1.9, 0, Math.PI*2); ctx.fill();

    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.clip();
    ctx.globalCompositeOperation = 'source-over';
    const bc = cfg.base || ['10,14,38','20,32,74','52,92,165'];
    let base = ctx.createLinearGradient(cx, cy-R, cx, cy+R);
    base.addColorStop(0, `rgba(${bc[0]},1)`); base.addColorStop(0.55, `rgba(${bc[1]},1)`); base.addColorStop(1, `rgba(${bc[2]},1)`);
    ctx.fillStyle = base; ctx.fillRect(cx-R, cy-R, R*2, R*2);

    const bottom = cy + R, aEase = 1 - Math.exp(-10*dt);
    ctx.globalCompositeOperation = 'lighter';
    for (let wi = 0; wi < WAVES.length; wi++) {
      const wv = WAVES[wi]; let ampTarget, r, g, b, alpha;
      if (isThink) { ampTarget = R*(0.16+0.26*(0.5+0.5*Math.sin(time*0.0024+wi*1.3))); const c = lerpColor(wi*0.14+time*0.00028); r=c[0]|0;g=c[1]|0;b=c[2]|0;alpha=0.42; }
      else if (isError) { ampTarget = R*(0.10+0.30*(0.4+0.6*Math.abs(Math.sin(time*0.006)))); r=255;g=(70+40*Math.sin(time*0.01+wi))|0;b=70;alpha=0.34; }
      else if (isSucc)  { ampTarget = R*(0.10+0.20*(0.5+0.5*Math.sin(time*0.004+wi))); r=(90+40*Math.sin(time*0.006+wi))|0;g=240;b=150;alpha=0.32; }
      else if (isWarn)  { ampTarget = R*(0.10+0.20*(0.5+0.5*Math.sin(time*0.005+wi))); r=255;g=200;b=(80+40*Math.sin(time*0.007+wi))|0;alpha=0.32; }
      else {
        const bv = A.live ? (wv.band==='bass'?A.bass:wv.band==='mid'?A.mid:A.treble) : 0;
        ampTarget = R*(A.live ? (0.05+A.level*0.30+bv*0.55) : (0.05+0.04*Math.sin(time*0.002+wv.yo)));
        const accent = lerpColor(wv.yo+wv.fr*0.17+time*0.0002), mix = A.live ? Math.min(1, A.level*0.7+bv*1.2) : 0;
        r=(wv.col[0]+(accent[0]-wv.col[0])*mix)|0; g=(wv.col[1]+(accent[1]-wv.col[1])*mix)|0; b=(wv.col[2]+(accent[2]-wv.col[2])*mix)|0; alpha=0.22+bv*0.22;
      }
      this._wAmp[wi] += (ampTarget - this._wAmp[wi]) * aEase; const amp = this._wAmp[wi];
      const yB = cy + wv.yo*R, ph = time*wv.sp, N = 40, xs = new Array(N+1), ys = new Array(N+1);
      for (let i = 0; i <= N; i++) { const tx = i/N; xs[i] = cx - R + tx*R*2; ys[i] = yB + Math.sin(tx*Math.PI*2*wv.fr+ph)*amp*Math.sin(tx*Math.PI); }
      ctx.beginPath(); ctx.moveTo(xs[0], ys[0]);
      for (let i = 1; i < N; i++) ctx.quadraticCurveTo(xs[i], ys[i], (xs[i]+xs[i+1])/2, (ys[i]+ys[i+1])/2);
      ctx.lineTo(xs[N], ys[N]); ctx.lineTo(xs[N], bottom); ctx.lineTo(xs[0], bottom); ctx.closePath();
      const fg = ctx.createLinearGradient(0, yB-amp, 0, bottom);
      fg.addColorStop(0, `rgba(${r},${g},${b},${alpha})`); fg.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = fg; ctx.fill();
    }
    const core = ctx.createRadialGradient(cx, cy + R*0.1, 0, cx, cy, R*0.95);
    core.addColorStop(0, `rgba(${isError?'255,210,210':isSucc?'210,255,225':isWarn?'255,240,205':'210,235,255'},${0.08+kick*0.22})`);
    core.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, R*0.95, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(120,160,235,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  _startSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || this._rec) return;
    const rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = this.o.lang;
    rec.onresult = (e) => {
      let fin = '', itm = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t; else itm += t; }
      const max = this.o.subtitleMaxWords;
      if (fin) { const words = ((this._subFinal||'') + ' ' + fin).trim().split(/\s+/); this._subTruncated = words.length > max; this._subFinal = words.slice(-max).join(' '); }
      const lead = this._subTruncated ? '… ' : '';
      this.subEl.innerHTML = lead + (this._subFinal||'') + (itm ? ' <span class="interim">'+itm+'</span>' : '');
      this.subEl.classList.add('on');
      clearTimeout(this._subTimer);
      if (this.o.subtitleTimeout > 0) this._subTimer = setTimeout(() => { this.subEl.classList.remove('on'); this._subFinal = ''; this._subTruncated = false; }, this.o.subtitleTimeout);
      this._emit('transcript', this._subFinal, itm);
    };
    rec.onend = () => { if (this._rec) { try { rec.start(); } catch (e) {} } };
    try { rec.start(); } catch (e) {}
    this._rec = rec;
  }
  _stopSpeech() { if (this._rec) { const r = this._rec; this._rec = null; try { r.stop(); } catch (e) {} } this._subFinal = ''; }
}
function clampI(v) { v = v|0; return v<0?0:v>2?2:v; }

/** Alias: the orb is the headline component of Aura. */
export const Aura = VoiceOrb;
export default VoiceOrb;
