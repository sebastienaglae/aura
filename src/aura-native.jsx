/*!
 * Aura — React Native orb (react-native-svg + Reanimated).  © Dash Systems.
 * Import path: `@sebastienaglae/aura/native`
 *
 * VISUAL ONLY. No microphone, no speech-to-text, no audio dependency.
 * Built on react-native-svg so it runs in Expo Go (no custom dev build needed).
 *
 * You drive the look with props:
 *   - mode   'normal'|'think'|'error'|'success'|'warning'
 *   - level  0..1  (how "active" the orb is — wire it to anything)
 *   - demo   self-animate a believable envelope (pure math, no input)
 *
 * Peer deps: react-native-svg, react-native-reanimated
 *
 *   import { AuraOrb } from '@sebastienaglae/aura/native';
 *   <AuraOrb mode={thinking ? 'think' : 'normal'} level={activity} size={120} />
 *   <AuraOrb demo size={120} />
 */
import React from 'react';
import Svg, { Defs, ClipPath, LinearGradient, RadialGradient, Stop, Circle, Rect, Path, G } from 'react-native-svg';
import Animated, { useSharedValue, useDerivedValue, useAnimatedProps, useFrameCallback, withTiming } from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

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

export function AuraOrb({
  mode = 'normal', level = 0, demo = false, size = 120,
  width, height, borderWidth = 4, borderRadius = 22,
  spinIdle = 28, spinSpeak = 240, style,
}) {
  const W = width  ?? Math.round(size * 2.6);
  const H = height ?? Math.round(size * 2.6);
  const R = size / 2;
  const cx = W / 2, cy = H / 2;
  const isThink = mode === 'think';
  const cfg = AURA_MODES[mode] || AURA_MODES.normal;

  // frame clock (ms) + level → shared values
  const clock = useSharedValue(0);
  useFrameCallback((info) => { 'worklet'; clock.value = info.timeSinceFirstFrame; }, true);
  const prop = useSharedValue(0);
  prop.value = withTiming(Math.max(0, Math.min(1, level)), { duration: 90 });

  // effective energy 0..1 (prop or synthetic demo envelope — pure math, no audio)
  const energy = useDerivedValue(() => {
    'worklet';
    if (!demo) return prop.value;
    const t = clock.value / 1000;
    const burst  = Math.pow(0.5 + 0.5 * Math.sin(t * 7.3 + Math.sin(t * 2.1)), 4);
    const phrase = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.7));
    const tremor = 0.85 + 0.15 * Math.sin(t * 32);
    return Math.min(1, burst * phrase * tremor * 1.25);
  });

  // breathing radius
  const orbR = useDerivedValue(() => {
    'worklet';
    const think = isThink ? 1 + 0.14 * Math.sin(clock.value * 0.0024) : 1;
    const idle = 0.02 * Math.sin(clock.value * 0.002);
    return R * think * (1 + energy.value * 0.22 + idle);
  });

  const haloProps = useAnimatedProps(() => ({ r: orbR.value * 1.55, opacity: 0.16 + energy.value * 0.18 }));
  const bodyProps = useAnimatedProps(() => ({ r: orbR.value }));
  const clipProps = useAnimatedProps(() => ({ r: orbR.value }));
  const rimProps  = useAnimatedProps(() => ({ r: orbR.value }));
  const ringProps = useAnimatedProps(() => {
    'worklet';
    const dps = spinIdle + energy.value * spinSpeak;
    return { rotation: (clock.value * dps / 1000) % 360 };
  });

  return (
    <Svg width={W} height={H} style={style}>
      <Defs>
        <ClipPath id="aura-orb"><AnimatedCircle cx={cx} cy={cy} animatedProps={clipProps} /></ClipPath>
        {/* ring = rounded outer minus rounded inner (even-odd) */}
        <ClipPath id="aura-ring">
          <Path
            fillRule="evenodd"
            d={ringPath(borderWidth / 2, borderWidth / 2, W - borderWidth, H - borderWidth, borderRadius, borderWidth)}
          />
        </ClipPath>
        <LinearGradient id="aura-base" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={cfg.base[0]} /><Stop offset="0.55" stopColor={cfg.base[1]} /><Stop offset="1" stopColor={cfg.base[2]} />
        </LinearGradient>
        <RadialGradient id="aura-halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={cfg.halo} stopOpacity="0.9" /><Stop offset="1" stopColor={cfg.halo} stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="aura-rainbow" x1="0" y1="0" x2="1" y2="1">
          {cfg.border.map((c, i) => (
            <Stop key={i} offset={(i / (cfg.border.length - 1)).toString()} stopColor={c} />
          ))}
        </LinearGradient>
        {WAVES.map((wv, i) => (
          <LinearGradient key={i} id={`aura-w${i}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={wv.col} stopOpacity="0.85" /><Stop offset="1" stopColor={wv.col} stopOpacity="0" />
          </LinearGradient>
        ))}
      </Defs>

      {/* halo */}
      <AnimatedCircle cx={cx} cy={cy} fill="url(#aura-halo)" animatedProps={haloProps} />

      {/* orb body */}
      <AnimatedCircle cx={cx} cy={cy} fill="url(#aura-base)" animatedProps={bodyProps} />

      {/* waves, clipped to the orb disk */}
      <G clipPath="url(#aura-orb)">
        {WAVES.map((wv, i) => (
          <WaveSvg key={i} wv={wv} idx={i} clock={clock} energy={energy} orbR={orbR} cx={cx} cy={cy} R={R} />
        ))}
      </G>

      {/* rim */}
      <AnimatedCircle cx={cx} cy={cy} fill="none" stroke="rgba(120,160,235,0.4)" strokeWidth={1} animatedProps={rimProps} />

      {/* rotating rainbow border (big rainbow rect rotating, clipped to the ring) */}
      <G clipPath="url(#aura-ring)" opacity={0.9}>
        <AnimatedG originX={cx} originY={cy} animatedProps={ringProps}>
          <Rect x={cx - W} y={cy - H} width={W * 2} height={H * 2} fill="url(#aura-rainbow)" />
        </AnimatedG>
      </G>
    </Svg>
  );
}

function WaveSvg({ wv, idx, clock, energy, orbR, cx, cy, R }) {
  const props = useAnimatedProps(() => {
    'worklet';
    const r = orbR.value;
    const e = energy.value;
    const amp = r * (0.05 + e * 0.30 + e * 0.25 * wv.w + 0.03);
    const yB = cy + wv.yo * r;
    const ph = clock.value * wv.sp;
    const bottom = cy + r;
    const N = 26;
    let d = `M ${cx - r} ${yB}`;
    for (let i = 0; i <= N; i++) {
      const tx = i / N;
      const x = cx - r + tx * r * 2;
      const win = Math.sin(tx * Math.PI);
      const y = yB + Math.sin(tx * Math.PI * 2 * wv.fr + ph) * amp * win;
      d += ` L ${x} ${y}`;
    }
    d += ` L ${cx + r} ${bottom} L ${cx - r} ${bottom} Z`;
    return { d };
  });
  return <AnimatedPath animatedProps={props} fill={`url(#aura-w${idx})`} opacity={0.62} />;
}

// rounded-rect ring path (outer rounded rect + inner rounded rect, even-odd → donut)
function ringPath(x, y, w, h, r, bw) {
  const rr = (x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    return `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
  };
  return rr(x, y, w, h, r) + ' ' + rr(x + bw, y + bw, w - 2 * bw, h - 2 * bw, Math.max(0, r - bw));
}

export default AuraOrb;
