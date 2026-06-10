/*!
 * Aura — React Native orb (Skia + Reanimated).  © Dash Systems.
 * Import path: `@sebastienaglae/aura/native`
 *
 * VISUAL ONLY. No microphone, no speech-to-text, no audio dependency is shipped.
 * You drive the look with two props:
 *   - mode   'normal'|'think'|'error'|'success'|'warning'
 *   - level  0..1  (how "active" the orb is — wire it to whatever you like)
 * …or set `demo` to let it self-animate a believable envelope (pure math, no audio).
 *
 * Peer deps (install in your app):
 *   @shopify/react-native-skia   react-native-reanimated
 *
 *   import { AuraOrb } from '@sebastienaglae/aura/native';
 *   <AuraOrb mode={thinking ? 'think' : 'normal'} level={activity} size={120} />
 *   <AuraOrb demo size={120} />            // self-animating preview, zero input
 */
import React, { useMemo } from 'react';
import {
  Canvas, Group, Path, RoundedRect, SweepGradient, LinearGradient,
  Circle, vec, Skia, Blur,
} from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, useFrameCallback, withTiming } from 'react-native-reanimated';

// ---- mode palettes ----
export const AURA_MODES = {
  normal:  { border: ['#ff2d6f','#ff7a00','#ffe000','#21d36a','#00d4ff','#3d6bff','#a93bff','#ff3bc4','#ff2d6f'],
             base: ['#0a0e26','#14204a','#345ca5'], halo: '#5abaff' },
  think:   { border: ['#6a5bff','#4d7bff','#00d4ff','#9b6bff','#6a5bff'],
             base: ['#0a0e26','#1a1c48','#3a3ca5'], halo: '#9696ff' },
  error:   { border: ['#ff2d2d','#ff6a3d','#b30000','#ff5b5b','#ff2d2d'],
             base: ['#28080a','#560e12','#b42e2e'], halo: '#ff5a5a' },
  success: { border: ['#2bd576','#7CFF9B','#0b9e54','#56f0a0','#2bd576'],
             base: ['#082012','#0e4628','#28aa64'], halo: '#78ffaa' },
  warning: { border: ['#ffb020','#ffd45e','#c77f00','#ffc94d','#ffb020'],
             base: ['#281c06','#50380c','#be8c28'], halo: '#ffcd6e' },
};

const WAVES = [
  { yo: -0.12, fr: 1.4, sp:  0.0016, w: 0.85 },
  { yo: -0.04, fr: 2.0, sp: -0.0023, w: 0.70 },
  { yo:  0.04, fr: 1.7, sp:  0.0027, w: 0.62 },
  { yo:  0.12, fr: 2.6, sp: -0.0020, w: 0.55 },
  { yo:  0.20, fr: 3.3, sp:  0.0031, w: 0.50 },
];
const WAVE_COLS = ['#6ea5ff','#96c8ff','#c3e1ff','#e1f2ff','#ffffff'];

/**
 * AuraOrb — voice-style reactive orb with a rotating rainbow frame. Visual only.
 * props: mode, level (0..1), demo, size, width, height,
 *        borderWidth, borderRadius, spinIdle, spinSpeak, style
 */
export function AuraOrb({
  mode = 'normal', level = 0, demo = false, size = 120,
  width, height, borderWidth = 4, borderRadius = 22,
  spinIdle = 28, spinSpeak = 240, style,
}) {
  const W = width  ?? Math.round(size * 2.6);
  const H = height ?? Math.round(size * 2.6);
  const R = size / 2;
  const cx = W / 2, cy = H / 2;

  const clock = useFrameClock();                  // ms since first frame (frame-rate independent)
  const prop = useSharedValue(0);
  prop.value = withTiming(Math.max(0, Math.min(1, level)), { duration: 90 });

  const isThink = mode === 'think';

  // effective "energy" 0..1 — either the prop, or a synthetic demo envelope (no audio)
  const energy = useDerivedValue(() => {
    'worklet';
    if (!demo) return prop.value;
    const t = clock.value / 1000;
    const burst  = Math.pow(0.5 + 0.5 * Math.sin(t * 7.3 + Math.sin(t * 2.1)), 4); // sharp syllable peaks
    const phrase = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.7));                   // phrasing/breaths
    const tremor = 0.85 + 0.15 * Math.sin(t * 32);
    return Math.min(1, burst * phrase * tremor * 1.25);
  });

  // rainbow rotation (rad), faster with energy
  const angle = useDerivedValue(() => {
    'worklet';
    const dps = spinIdle + energy.value * spinSpeak;
    return ((clock.value * dps / 1000) % 360) * Math.PI / 180;
  });
  const sweepTransform = useDerivedValue(() => [{ rotate: angle.value }]);

  // breathing radius: think-mode pulse + energy pulse + gentle idle
  const orbR = useDerivedValue(() => {
    'worklet';
    const think = isThink ? 1 + 0.14 * Math.sin(clock.value * 0.0024) : 1;
    const idle  = 0.02 * Math.sin(clock.value * 0.002);
    return R * think * (1 + energy.value * 0.22 + idle);
  });

  const clipCircle = useMemo(() => {
    const p = Skia.Path.Make(); p.addCircle(cx, cy, R * 1.25); return p;
  }, [cx, cy, R]);

  const cfg = AURA_MODES[mode] || AURA_MODES.normal;

  return (
    <Canvas style={[{ width: W, height: H }, style]}>
      {/* soft halo */}
      <Circle cx={cx} cy={cy} r={orbR} color={cfg.halo} opacity={0.18}>
        <Blur blur={size * 0.25} />
      </Circle>

      {/* orb body + waves, clipped to the circle */}
      <Group clip={clipCircle}>
        <OrbBody cx={cx} cy={cy} rDV={orbR} base={cfg.base} />
        {WAVES.map((wv, i) => (
          <Wave key={i} wv={wv} color={WAVE_COLS[i]} clock={clock} energy={energy}
                cx={cx} cy={cy} rDV={orbR} />
        ))}
      </Group>

      {/* rotating rainbow border */}
      <RoundedRect
        x={borderWidth / 2} y={borderWidth / 2}
        width={W - borderWidth} height={H - borderWidth} r={borderRadius}
        style="stroke" strokeWidth={borderWidth} opacity={0.85}
      >
        <SweepGradient c={vec(cx, cy)} colors={cfg.border} transform={sweepTransform} origin={vec(cx, cy)} />
      </RoundedRect>
    </Canvas>
  );
}

function OrbBody({ cx, cy, rDV, base }) {
  const path = useDerivedValue(() => {
    'worklet';
    const r = rDV.value;
    const p = Skia.Path.Make();
    p.addRect(Skia.XYWHRect(cx - r, cy - r, r * 2, r * 2));
    return p;
  });
  const start = useDerivedValue(() => vec(cx, cy - rDV.value));
  const end = useDerivedValue(() => vec(cx, cy + rDV.value));
  return (
    <Path path={path}>
      <LinearGradient start={start} end={end} colors={base} />
    </Path>
  );
}

function Wave({ wv, color, clock, energy, cx, cy, rDV }) {
  const path = useDerivedValue(() => {
    'worklet';
    const R = rDV.value;
    const e = energy.value;
    const amp = R * (0.05 + e * 0.30 + e * 0.25 * wv.w + 0.03);   // small idle amp even at rest
    const yB = cy + wv.yo * R;
    const ph = clock.value * wv.sp;
    const bottom = cy + R;
    const N = 28;
    const p = Skia.Path.Make();
    p.moveTo(cx - R, yB);
    for (let i = 0; i <= N; i++) {
      const tx = i / N;
      const x = cx - R + tx * R * 2;
      const win = Math.sin(tx * Math.PI);
      const y = yB + Math.sin(tx * Math.PI * 2 * wv.fr + ph) * amp * win;
      p.lineTo(x, y);
    }
    p.lineTo(cx + R, bottom);
    p.lineTo(cx - R, bottom);
    p.close();
    return p;
  });
  const start = useDerivedValue(() => vec(cx, cy - rDV.value));
  const end = useDerivedValue(() => vec(cx, cy + rDV.value));
  return (
    <Path path={path} opacity={0.62} blendMode="plus">
      <LinearGradient start={start} end={end} colors={[color, color + '00']} />
    </Path>
  );
}

// frame clock as a Reanimated shared value (ms)
function useFrameClock() {
  const t = useSharedValue(0);
  useFrameCallback((info) => { 'worklet'; t.value = info.timeSinceFirstFrame; }, true);
  return t;
}

export default AuraOrb;
