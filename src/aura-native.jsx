/*!
 * Aura — React Native orb (Skia + Reanimated).  © Dash Systems.
 * Import path: `@sebastienaglae/aura/native`
 *
 * RN has no DOM/canvas/CSS/Web-Audio, so this is a native re-implementation:
 *   - drawing      → @shopify/react-native-skia
 *   - frame loop   → react-native-skia useClock + react-native-reanimated
 *   - mic loudness → expo-av Recording metering (RN has no FFT, so `level` drives
 *                    the waves; pass your own `bands` if you have a native analyser)
 *
 * Peer deps (install in your app):
 *   @shopify/react-native-skia  react-native-reanimated  react-native-gesture-handler
 *   expo-av            (optional, only for the useAuraMic hook)
 *
 *   import { AuraOrb, useAuraMic } from '@sebastienaglae/aura/native';
 *   const level = useAuraMic(listening);
 *   <AuraOrb mode={thinking ? 'think' : 'normal'} level={level} size={120} />
 */
import React, { useMemo } from 'react';
import {
  Canvas, Group, Path, RoundedRect, SweepGradient, LinearGradient,
  Circle, vec, Skia, Blur,
} from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, withTiming, useFrameCallback } from 'react-native-reanimated';

// ---- mode palettes (hex; cross-faded via Reanimated) ----
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

// per-wave layout (mirrors the web version)
const WAVES = [
  { yo: -0.12, fr: 1.4, sp:  0.0016, w: 0.85 },
  { yo: -0.04, fr: 2.0, sp: -0.0023, w: 0.70 },
  { yo:  0.04, fr: 1.7, sp:  0.0027, w: 0.62 },
  { yo:  0.12, fr: 2.6, sp: -0.0020, w: 0.55 },
  { yo:  0.20, fr: 3.3, sp:  0.0031, w: 0.50 },
];
const WAVE_COLS = ['#6ea5ff','#96c8ff','#c3e1ff','#e1f2ff','#ffffff'];

/**
 * AuraOrb — voice-reactive orb with a rotating rainbow frame.
 * props:
 *   mode      'normal'|'think'|'error'|'success'|'warning'
 *   level     0..1 loudness (drives the waves/pulse) — feed useAuraMic() or your own
 *   size      orb diameter in px (default 120)
 *   width/height  canvas size (defaults to size*2.4 so the glow/border fit)
 *   borderWidth, borderRadius, spinIdle, spinSpeak, colorFade
 */
export function AuraOrb({
  mode = 'normal', level = 0, size = 120,
  width, height, borderWidth = 4, borderRadius = 22,
  spinIdle = 28, spinSpeak = 240, colorFade = 600, style,
}) {
  const W = width  ?? Math.round(size * 2.6);
  const H = height ?? Math.round(size * 2.6);
  const R = size / 2;
  const cx = W / 2, cy = H / 2;

  const clock = useFrameClock();              // ms, drives all motion (frame-rate independent)
  const lvl = useSharedValue(0);
  lvl.value = withTiming(Math.max(0, Math.min(1, level)), { duration: 90 });

  const cfg = AURA_MODES[mode] || AURA_MODES.normal;

  // border rotation (deg→rad), faster while "speaking"
  const angle = useDerivedValue(() => {
    'worklet';
    const dps = spinIdle + lvl.value * spinSpeak;
    return ((clock.value * dps / 1000) % 360) * Math.PI / 180;
  });
  const sweepTransform = useDerivedValue(() => [{ rotate: angle.value }]);

  // orb breathing pulse
  const orbR = useDerivedValue(() => {
    'worklet';
    const think = mode === 'think' ? 1 + 0.14 * Math.sin(clock.value * 0.0024) : 1;
    return R * think * (1 + lvl.value * 0.2);
  });

  const clipCircle = useMemo(() => {
    const p = Skia.Path.Make(); p.addCircle(cx, cy, R * 1.25); return p;
  }, [cx, cy, R]);

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
          <Wave key={i} wv={wv} color={WAVE_COLS[i]} clock={clock} lvl={lvl}
                cx={cx} cy={cy} rDV={orbR} />
        ))}
      </Group>

      {/* rotating rainbow border (rounded-rect stroke filled with a sweep gradient) */}
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
  // a filled rect (clipped to the orb) with a vertical base gradient
  const rect = useDerivedValue(() => {
    'worklet';
    const r = rDV.value;
    return Skia.XYWHRect(cx - r, cy - r, r * 2, r * 2);
  });
  const start = useDerivedValue(() => vec(cx, cy - rDV.value));
  const end = useDerivedValue(() => vec(cx, cy + rDV.value));
  return (
    <Path path={useDerivedValue(() => { 'worklet'; const p = Skia.Path.Make(); p.addRect(rect.value); return p; })}>
      <LinearGradient start={start} end={end} colors={base} />
    </Path>
  );
}

function Wave({ wv, color, clock, lvl, cx, cy, rDV }) {
  const path = useDerivedValue(() => {
    'worklet';
    const R = rDV.value;
    const amp = R * (0.06 + lvl.value * 0.30 + lvl.value * 0.25 * wv.w);
    const yB = cy + wv.yo * R;
    const ph = clock.value * wv.sp;
    const bottom = cy + R;
    const N = 28;
    const p = Skia.Path.Make();
    const x0 = cx - R;
    p.moveTo(x0, yB);
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
    <Path path={path} opacity={0.6} blendMode="plus">
      <LinearGradient start={start} end={end} colors={[color, color + '00']} />
    </Path>
  );
}

// small wrapper so callers don't import the Skia clock directly
function useFrameClock() {
  const t = useSharedValue(0);
  useFrameCallback((info) => { 'worklet'; t.value = info.timeSinceFirstFrame; }, true);
  return t;
}

/**
 * useAuraMic(active) — returns a smoothed loudness 0..1 from the device mic
 * using expo-av Recording metering. RN has no FFT, so this is overall level
 * (good enough to drive the orb). Requires `expo-av` + mic permission.
 */
export function useAuraMic(active) {
  const [level, setLevel] = React.useState(0);
  React.useEffect(() => {
    if (!active) { setLevel(0); return; }
    let rec, raf, peak = -60, stopped = false;
    (async () => {
      try {
        const { Audio } = await import('expo-av');
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        rec = new Audio.Recording();
        await rec.prepareToRecordAsync({
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          isMeteringEnabled: true,
        });
        rec.setProgressUpdateInterval(60);
        rec.setOnRecordingStatusUpdate((s) => {
          if (stopped || !s.isRecording || s.metering == null) return;
          // metering is dBFS (~-160..0). Map a useful speech window to 0..1.
          const db = s.metering;
          const norm = Math.max(0, Math.min(1, (db + 50) / 45));   // -50dB→0, -5dB→1
          setLevel((p) => p + (norm - p) * 0.35);                   // smooth
        });
        await rec.startAsync();
      } catch (e) { /* mic unavailable */ }
    })();
    return () => {
      stopped = true; cancelAnimationFrame(raf);
      if (rec) rec.stopAndUnloadAsync().catch(() => {});
    };
  }, [active]);
  return level;
}

export default AuraOrb;
