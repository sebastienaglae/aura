# Aura

**A Dash Systems product.** A voice-reactive orb + a set of colorful *generative-AI* loading
animations (image, song, video, text). Framework-agnostic, dependency-free, with optional
React bindings.

> Aura is **UI only** — it never calls an AI service. You wire it to your own pipeline:
> drive the orb's mode/level and play a generator while your model works, then reveal the result.

```bash
npm i @dash-systems/aura
```

---

## The orb

```html
<div id="stage" style="position:fixed; inset:0;"></div>
```
```js
import { VoiceOrb } from '@dash-systems/aura';

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
import { ImageGen, SongGen, VideoGen, TextGen } from '@dash-systems/aura/gen';

const g = new ImageGen(document.getElementById('thumb'), {
  colors: ['#ff2d6f', '#7a5bff', '#00d4ff'],
});

const url = await myAI.generateImage(prompt);   // your backend
g.complete(url);                                 // fades the image in
```

Every generator shares: `start()` · `stop()` · `setProgress(0..1)` · `setLabel(text)` ·
`reset()` · `complete(payload)` · `destroy()`, plus an `onComplete(payload)` option and
`colors` / `label` / `speed`.

| class | animation | `complete(payload)` reveals |
|---|---|---|
| `ImageGen` | flowing gradient mesh + shimmer sweep + grain | image URL → `<img>` |
| `SongGen` | colorful equalizer bars | audio URL → `<audio>`, or a DOM node |
| `VideoGen` | scanlines + pulsing play glyph | video URL → `<video>`, or a node |
| `TextGen` | shimmering skeleton lines | string → typed-in text (`{text,type:false}` to skip) |

---

## React

```jsx
import { Aura, AuraImageGen } from '@dash-systems/aura/react';

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

## Repo layout

```
src/            the published package
  aura.js         orb + audio engine
  aura-gen.js     generative-AI animations
  aura-react.jsx  React bindings
  index.js / index.d.ts
demo/           local demos (NOT published)
  index.html      controls + generators
  example.html    fake site showing highlight-and-avoid
```

Run the demos with any static server, e.g. `npx serve` then open `/demo/index.html`.
