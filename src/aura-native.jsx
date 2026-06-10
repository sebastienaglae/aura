/*!
 * Aura — React Native orb + frame (react-native-svg + Reanimated).  © Dash Systems.
 * Import path: `@sebastienaglae/aura/native`
 *
 * VISUAL ONLY. No microphone, no speech-to-text, no audio dependency.
 * Runs in Expo Go (react-native-svg). Drive it with `mode`, `level` (0..1), or `demo`.
 *
 *   import { AuraOrb, AuraFrame } from '@sebastienaglae/aura/native';
 *   <AuraFrame mode="think" demo>{...your screen...}</AuraFrame>   // rainbow aura around the edge
 *   <AuraOrb mode="think" level={activity} size={140} />            // the orb
 *
 * Peer deps: react-native-svg, react-native-reanimated
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, ClipPath, LinearGradient, RadialGradient, Stop, Circle, Path, G } from 'react-native-svg';
import Animated, { useSharedValue, useDerivedValue, useAnimatedProps, useFrameCallback, withTiming } from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

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
  { yo: -0.12, fr: 1.4, sp:  0.0016, w: 0.85, col: '#6ea5ff' },
  { yo: -0.04, fr: 2.0, sp: -0.0023, w: 0.70, col: '#96c8ff' },
  { yo:  0.04, fr: 1.7, sp:  0.0027, w: 0.62, col: '#c3e1ff' },
  { yo:  0.12, fr: 2.6, sp: -0.0020, w: 0.55, col: '#e1f2ff' },
  { yo:  0.20, fr: 3.3, sp:  0.0031, w: 0.50, col: '#ffffff' },
];

// frame clock (ms) as a shared value
function useClock() {
  const t = useSharedValue(0);
  useFrameCallback((info) => { 'worklet'; t.value = info.timeSinceFirstFrame; }, true);
  return t;
}
function useEnergy(clock, level, demo) {
  const prop = useSharedValue(0);
  prop.value = withTiming(Math.max(0, Math.min(1, level)), { duration: 90 });
  return useDerivedValue(() => {
    'worklet';
    if (!demo) return prop.value;
    const t = clock.value / 1000;
    const burst = Math.pow(0.5 + 0.5 * Math.sin(t * 7.3 + Math.sin(t * 2.1)), 4);
    const phrase = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.7));
    const tremor = 0.85 + 0.15 * Math.sin(t * 32);
    return Math.min(1, burst * phrase * tremor * 1.25);
  });
}

/**
 * AuraOrb — the orb. FIXED size (no zoom); only the internal waves move.
 * props: mode, level (0..1), demo, size, width, height, style
 */
export function AuraOrb({ mode = 'normal', level = 0, demo = false, size = 140, width, height, style }) {
  const W = width ?? Math.round(size * 1.7);
  const H = height ?? Math.round(size * 1.7);
  const R = size / 2;
  const cx = W / 2, cy = H / 2;
  const cfg = AURA_MODES[mode] || AURA_MODES.normal;

  const clock = useClock();
  const energy = useEnergy(clock, level, demo);
  const haloProps = useAnimatedProps(() => ({ opacity: 0.16 + energy.value * 0.2 }));

  return (
    <Svg width={W} height={H} style={style}>
      <Defs>
        <ClipPath id="aura-orb"><Circle cx={cx} cy={cy} r={R} /></ClipPath>
        <LinearGradient id="aura-base" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={cfg.base[0]} /><Stop offset="0.55" stopColor={cfg.base[1]} /><Stop offset="1" stopColor={cfg.base[2]} />
        </LinearGradient>
        <RadialGradient id="aura-halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={cfg.halo} stopOpacity="0.9" /><Stop offset="1" stopColor={cfg.halo} stopOpacity="0" />
        </RadialGradient>
        {WAVES.map((wv, i) => (
          <LinearGradient key={i} id={`aura-w${i}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={wv.col} stopOpacity="0.85" /><Stop offset="1" stopColor={wv.col} stopOpacity="0" />
          </LinearGradient>
        ))}
      </Defs>

      {/* fixed-size halo — only its opacity reacts (no zoom) */}
      <AnimatedCircle cx={cx} cy={cy} r={R * 1.5} fill="url(#aura-halo)" animatedProps={haloProps} />
      {/* orb body (fixed) */}
      <Circle cx={cx} cy={cy} r={R} fill="url(#aura-base)" />
      {/* waves, clipped to the disk */}
      <G clipPath="url(#aura-orb)">
        {WAVES.map((wv, i) => (
          <WaveSvg key={i} wv={wv} idx={i} clock={clock} energy={energy} R={R} cx={cx} cy={cy} />
        ))}
      </G>
      {/* rim */}
      <Circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(140,170,235,0.45)" strokeWidth={1} />
    </Svg>
  );
}

function WaveSvg({ wv, idx, clock, energy, R, cx, cy }) {
  const props = useAnimatedProps(() => {
    'worklet';
    const e = energy.value;
    const amp = R * (0.05 + e * 0.32 + e * 0.25 * wv.w + 0.03);
    const yB = cy + wv.yo * R;
    const ph = clock.value * wv.sp;
    const bottom = cy + R;
    const N = 26;
    let d = `M ${cx - R} ${yB}`;
    for (let i = 0; i <= N; i++) {
      const tx = i / N;
      const x = cx - R + tx * R * 2;
      const win = Math.sin(tx * Math.PI);
      const y = yB + Math.sin(tx * Math.PI * 2 * wv.fr + ph) * amp * win;
      d += ` L ${x} ${y}`;
    }
    d += ` L ${cx + R} ${bottom} L ${cx - R} ${bottom} Z`;
    return { d };
  });
  return <AnimatedPath animatedProps={props} fill={`url(#aura-w${idx})`} opacity={0.62} />;
}

/**
 * AuraFrame — the "aura around the edge". Wrap your screen/content with it.
 * A rainbow border line + a soft inner glow hug the container; the rainbow
 * sweeps (gradient rotation) and the glow thickness grows with `level`.
 * props: mode, level (0..1), demo, borderWidth, borderRadius, glow, style, children
 */
export function AuraFrame({
  mode = 'normal', level = 0, demo = false,
  borderWidth = 4, borderRadius = 28, glow = true, style, children,
}) {
  const [dim, setDim] = useState({ w: 0, h: 0 });
  const clock = useClock();
  const energy = useEnergy(clock, level, demo);
  const cfg = AURA_MODES[mode] || AURA_MODES.normal;

  // sweep the rainbow by rotating the gradient DIRECTION via numeric x1/y1/x2/y2
  // (gradientTransform expects an array natively — passing a string crashes RN-SVG)
  const gradProps = useAnimatedProps(() => {
    'worklet';
    const dps = 28 + energy.value * 240;
    const a = ((clock.value * dps / 1000) % 360) * Math.PI / 180;
    const r = 0.7, cxg = 0.5, cyg = 0.5;
    return {
      x1: cxg + Math.cos(a) * r, y1: cyg + Math.sin(a) * r,
      x2: cxg - Math.cos(a) * r, y2: cyg - Math.sin(a) * r,
    };
  });
  // glow line thickens with energy
  const glowProps = useAnimatedProps(() => ({ strokeWidth: borderWidth * (2.2 + energy.value * 4), opacity: 0.12 + energy.value * 0.22 }));

  const { w, h } = dim;
  const outer = w > 0 ? roundedRect(borderWidth / 2, borderWidth / 2, w - borderWidth, h - borderWidth, borderRadius) : '';

  return (
    <View style={[{ flex: 1 }, style]} onLayout={(e) => { const { width, height } = e.nativeEvent.layout; setDim({ w: width, h: height }); }}>
      {children}
      {w > 0 && (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <AnimatedLinearGradient id="frame-rb" x1="0" y1="0" x2="1" y2="1" animatedProps={gradProps}>
              {cfg.border.map((c, i) => <Stop key={i} offset={i / (cfg.border.length - 1)} stopColor={c} />)}
            </AnimatedLinearGradient>
          </Defs>
          {/* soft glow (wide, faint, reacts to level) */}
          {glow && <AnimatedPath d={outer} fill="none" stroke="url(#frame-rb)" strokeLinejoin="round" animatedProps={glowProps} />}
          {/* crisp rainbow border line — always visible */}
          <Path d={outer} fill="none" stroke="url(#frame-rb)" strokeWidth={borderWidth} strokeLinejoin="round" opacity={0.95} />
        </Svg>
      )}
    </View>
  );
}

// rounded-rect path
function roundedRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
}

export default AuraOrb;
