# Aura

[![CI](https://github.com/sebastienaglae/aura/actions/workflows/ci.yml/badge.svg)](https://github.com/sebastienaglae/aura/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**A Dash Systems product.** A voice-reactive orb + a set of colorful *generative-AI* loading
animations (image, song, video, text) with success **and failure** states. Web (canvas) +
React + **React Native**, framework-agnostic, dependency-free core.

> Repo: **`sebastienaglae/aura`** · package: **`@sebastienaglae/aura`**

> Aura is **UI only** — it never calls an AI service. You wire it to your own pipeline:
> drive the orb's mode/level and play a generator while your model works, then reveal the result.

Published to **GitHub Packages**. Point the scope at GitHub once in your project `.npmrc`,
then install:

```ini
# .npmrc
@sebastienaglae:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}   # a PAT with read:packages
```
```bash
npm i @sebastienaglae/aura
```

---

## The orb

```html
<div id="stage" style="position:fixed; inset:0;"></div>
```
```js
import { VoiceOrb } from '@sebastienaglae/aura';

const orb = new VoiceOrb(document.getElementById('stage'), {
  threshold: 0.20,     // ignore the bottom 20% of loudness → silence is eventless
  borderRadius: 22,    // rounded rainbow frame
  autoMove: true,      // click a page element → highlight it; orb stays out of it
});

await orb.enableMic();        // or orb.enableDemo()
orb.setMode('think');         // smooth cross-fade to the "thinking" palette
```

- **Native-fast audio** — filtering + FFT run on the browser's `BiquadFilterNode` +
  `AnalyserNode` (compiled C++, off the main thread). Only a tiny RMS loop is JS. No WASM needed.
- **Frame-rate independent** — everything is delta-time based; identical at 30/60/120 fps.
- **Noise gate + bounded auto-gain** — normal speech fills the range on any mic; quiet
  background never trips it.
- **Smooth color transitions** — mode changes cross-fade the border **and** glow gradient
  between two layers (no hard color swap). Tune with `colorFade`.
- **Drag & dismiss** — drag the orb anywhere; click it then click the **×** to close
  (auto-hides after `closeTimeout`).
- **Highlight-and-avoid** — with `autoMove`, clicking any element highlights it (one at a
  time) and the orb keeps its circle outside it; falls back to best-effort if there's no clear spot.
- **Subtitles** — live `SpeechRecognition` captions, leading "…", bottom-anchored, cleared
  after `subtitleTimeout`.

### Options

| option | default | meaning |
|---|---|---|
| `ballRadius` | `32` | orb radius (px, fixed) |
| `threshold` | `0.20` | ignore bottom 20% of loudness |
| `maxEdge` | `20` | border-glow max thickness (px), 0→max with voice |
| `borderWidth` | `4` | rainbow line thickness (px) |
| `borderRadius` | `0` | rounded frame corners (px) |
| `colorFade` | `0.6` | seconds to cross-fade colors between modes |
| `spinIdle` / `spinSpeak` | `28` / `240` | rainbow spin (deg/s) idle / extra at full volume |
| `preamp`/`highpass`/`lowpass` | `2.4`/`80`/`9000` | input gain / filter cutoffs (Hz) |
| `position` | `[1,2]` | initial `[col,row]` of the 3×3 grid |
| `gridMargin` | `[0.22,0.18]` | grid inset (fraction of w/h) |
| `draggable` | `true` | allow dragging the orb |
| `dismissible` | `true` | click → × → close |
| `closeTimeout` | `2000` | ms the × stays before auto-hiding (0 = never) |
| `autoMove` | `false` | click element → highlight + avoid |
| `autoMoveContainer` | `null` | element to watch (default `document`) |
| `avoidMargin` | `14` | px gap kept from the obstacle |
| `subtitles` | `false` | start captions on |
| `lang` | `'en-US'` | recognition language |
| `subtitleMaxWords` / `subtitleTimeout` | `16` / `5000` | caption window / clear delay (ms) |
| `onMode` / `onMove` / `onClose` | `null` | callbacks |

### Control & getters (fully programmatic)

```js
orb.setMode('error'); orb.moveTo(2,0); orb.moveToPoint(x,y); orb.open(); orb.close();
orb.highlight(el); orb.clearHighlight(); orb.showSubtitles(true);
orb.setBorderRadius(24); orb.setBorderWidth(6); orb.setColorFade(0.8);
orb.setThreshold(0.25); orb.setMaxEdge(28); orb.setSpin(20,300); orb.setPalette([[255,0,128],…]);
orb.configure({ ...patch });

orb.getMode();        // 'think'
orb.getLevel();       // 0..1
orb.getBands();       // { bass, mid, treble }
orb.getPosition();    // { x, y, col, row }
orb.isListening();    // mic active
orb.getState();       // everything at once
```

### Events

```js
const off = orb.on('mode',  m => …);
orb.on('move',  (col,row) => …);
orb.on('close', () => …);
orb.on('transcript', (finalText, interim) => …);
off(); // unsubscribe
```

---

## Generative-AI animations

Play a lively colorful placeholder while your model generates, then reveal the result.

```js
import { ImageGen, SongGen, VideoGen, TextGen } from '@sebastienaglae/aura/gen';

const g = new ImageGen(document.getElementById('thumb'), {
  colors: ['#ff2d6f', '#7a5bff', '#00d4ff'],
});

const url = await myAI.generateImage(prompt);   // your backend
g.complete(url);                                 // fades the image in
```

Every generator shares: `start()` · `stop()` · `setProgress(0..1)` · `setLabel(text)` ·
`reset()` · `complete(payload)` · **`fail(message?)`** · `destroy()`, plus `onComplete(payload)`
/ `onFail(message)` options and `colors` / `label` / `speed`.

```js
try   { g.complete(await ai.generate(prompt)); }   // reveal result
catch { g.fail('Could not generate'); }            // red shake + message
```

| class | animation | `complete(payload)` reveals |
|---|---|---|
| `ImageGen` | resolving mosaic of colored tiles + photo glyph | image URL → `<img>` |
| `SongGen` | equalizer bars + baseline + note glyph | audio URL → `<audio>`, or a DOM node |
| `VideoGen` | scanlines + pulsing play glyph | video URL → `<video>`, or a node |
| `TextGen` | shimmering skeleton lines | string → typed-in text (`{text,type:false}` to skip) |

All four also show a **red shake + message** on `fail()`. In React, pass `error` (and optional
`progress`): `<AuraImageGen generating={loading} result={url} error={err} />`.

---

## React

```jsx
import { Aura, AuraImageGen } from '@sebastienaglae/aura/react';

function Assistant({ thinking, micOn }) {
  return (
    <>
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:40 }}>
        <Aura
          mode={thinking ? 'think' : 'normal'}
          source={micOn ? 'mic' : 'off'}
          options={{ borderRadius: 24, autoMove: true }}
          onTranscript={(t) => console.log(t)}
        />
      </div>
      <AuraImageGen generating={isLoading} result={imageUrl} style={{ height: 240 }} />
    </>
  );
}
```

`<Aura>` props: `mode`, `source` (`'mic'|'demo'|'off'`), `options`, `onReady(orb)`, `onMode`,
`onMove`, `onClose`, `onTranscript`. Generator components (`AuraImageGen`, `AuraSongGen`,
`AuraVideoGen`, `AuraTextGen`) take `generating`, `result`, `options`, `onReady`.

---

## React Native

A native re-implementation of the **visuals** (no DOM/canvas/CSS): the orb is drawn with
**Skia** and animated with **Reanimated**. **No microphone, speech-to-text, or audio
dependency is shipped** — you drive the look with props. Import from
`@sebastienaglae/aura/native`.

```bash
# peer deps in your app (no audio libs)
npm i @shopify/react-native-skia react-native-reanimated expo-linear-gradient
```
```jsx
import { AuraOrb } from '@sebastienaglae/aura/native';
import { ImageGenNative, TextGenNative } from '@sebastienaglae/aura/native/gen';

function Assistant({ thinking, activity, loading, imageUrl, err }) {
  return (
    <>
      {/* drive `level` (0..1) from anything: a stream, a timer, a value… */}
      <AuraOrb mode={thinking ? 'think' : 'normal'} level={activity} size={120} borderRadius={24} />

      {/* …or let it self-animate with zero input */}
      <AuraOrb demo size={120} />

      <ImageGenNative generating={loading} result={imageUrl} error={err}
                      style={{ height: 220, borderRadius: 16 }} />
    </>
  );
}
```

- `<AuraOrb>` — props `mode`, **`level`** (0..1), **`demo`** (self-animating, no input),
  `size`, **`draggable`**, **`lite`**, `style`. Fixed size; the colored wave lines move and
  change color per mode (cross-faded). Drawn with stroked lines (cheap), not filled polygons.
- `<AuraFrame mode level demo lite borderWidth borderRadius glow>` — rainbow aura around the
  edge. `borderRadius` defaults to `useScreenCornerRadius()`.
- Generators `ImageGenNative` / `SongGenNative` / `VideoGenNative` / `TextGenNative` —
  props `generating`, `result`, `error`, `colors`, `style`; same busy → reveal → red fail.

**Lite mode (weak phones):** pass `lite` to `AuraOrb`/`AuraFrame` — fewer wave lines, fewer
points, no per-frame color cross-fade, no glow. Much cheaper per frame.

**Device corner radius:** `useScreenCornerRadius(override?)` returns a per-platform fallback
in pure JS (RN has no JS API for the hardware radius). To get the **real** value, link a tiny
native module named `AuraCorner` exposing `getCornerRadius()` — the example ships one as an
Expo local module (`examples/expo/modules/aura-corner`, reads Android's system
`rounded_corner_radius`). It returns the true radius in a dev-client/standalone build and
falls back automatically in Expo Go.

> Web-only features (DOM highlight-and-avoid, `SpeechRecognition` subtitles) are **not** in
> the native build by design.

---

## Repo layout

```
src/                the published package (only this + README + LICENSE ship)
  aura.js             web orb + audio engine
  aura-gen.js         web generative-AI animations
  aura-react.jsx      React (web) bindings
  aura-native.jsx     React Native orb (Skia + Reanimated) — visual only
  aura-native-gen.jsx React Native generators
  index.js / index.d.ts
demo/               local demos (NOT published)
.github/workflows/  CI + Release
```

Run the demos with any static server, e.g. `npx serve` then open `/demo/index.html`.

## CI / CD & releasing

Two GitHub Actions workflows:

- **CI** (`ci.yml`) — on every push/PR to `main`: syntax check, an ESM import smoke test
  (exports present), and `npm pack --dry-run`.
- **Release** (`release.yml`) — on a pushed tag `v*.*.*` **or** a manual run:
  1. resolves the version **from the tag** (`v1.2.3` → `1.2.3`) or the manual input,
  2. publishes to **GitHub Packages**,
  3. creates a GitHub Release with generated notes (and the tag, on manual runs),
  4. **prunes every older version, keeping only the latest** (`min-versions-to-keep: 1`).

Two ways to release:

```bash
# tag-driven
git tag v1.2.3 && git push origin v1.2.3
```
…or **Actions → Release → Run workflow** and enter `1.2.3` (no tag needed — it's created for you).

No secrets to configure: it uses the built-in `GITHUB_TOKEN` (`permissions: packages: write`).
If your org blocks `GITHUB_TOKEN` from deleting package versions, enable it in
*Org → Packages settings* (or the prune step no-ops via `continue-on-error`).

**Dependabot** (`.github/dependabot.yml`) keeps the GitHub Actions up to date weekly.
