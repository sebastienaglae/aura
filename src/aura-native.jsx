/*!
 * Aura — React Native orb + frame (react-native-svg + Reanimated).  © Dash Systems.
 * Import path: `@sebastienaglae/aura/native`   VISUAL ONLY (no audio/STT).
 *
 * Perf notes: waves are a few lightweight STROKED lines (not per-frame filled
 * polygons), the rainbow frame is a STATIC gradient (only its glow width reacts),
 * and only the wave paths update per frame. Mode changes cross-fade colors.
 *
 *   import { AuraOrb, AuraFrame, useScreenCornerRadius } from '@sebastienaglae/aura/native';
 *   <AuraFrame mode="think" demo>{...}</AuraFrame>
 *   <AuraOrb mode="think" demo size={140} draggable />
 *
 * Peer deps: react-native-svg, react-native-reanimated
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, PanResponder, Platform } from 'react-native';
import Svg, { Defs, ClipPath, LinearGradient, RadialGradient, Stop, Circle, Path, G } from 'react-native-svg';
import Reanimated, {
  useSharedValue, useDerivedValue, useAnimatedProps, useFrameCallback, withTiming, interpolateColor,
} from 'react-native-reanimated';

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
const AnimatedPath = Reanimated.createAnimatedComponent(Path);

export const AURA_MODES = {
  normal:  { border: ['#ff2d6f','#ff7a00','#ffe000','#21d36a','#00d4ff','#3d6bff','#a93bff','#ff3bc4','#ff2d6f'],
             base: ['#0a0e26','#14204a','#345ca5'], halo: '#5abaff',
             waves: ['#6ea5ff','#9bd0ff','#cfe7ff','#ffffff'] },
  think:   { border: ['#6a5bff','#4d7bff','#00d4ff','#9b6bff','#6a5bff'],
             base: ['#0a0e26','#1a1c48','#3a3ca5'], halo: '#9696ff',
             waves: ['#8a7bff','#a9a0ff','#cfc6ff','#ffffff'] },
  error:   { border: ['#ff2d2d','#ff6a3d','#b30000','#ff5b5b','#ff2d2d'],
             base: ['#28080a','#560e12','#b42e2e'], halo: '#ff5a5a',
             waves: ['#ff6a6a','#ff9a9a','#ffc4c4','#ffffff'] },
  success: { border: ['#2bd576','#7CFF9B','#0b9e54','#56f0a0','#2bd576'],
             base: ['#082012','#0e4628','#28aa64'], halo: '#78ffaa',
             waves: ['#43e08a','#86f0b3','#c2f7d8','#ffffff'] },
  warning: { border: ['#ffb020','#ffd45e','#c77f00','#ffc94d','#ffb020'],
             base: ['#281c06','#50380c','#be8c28'], halo: '#ffcd6e',
             waves: ['#ffc24d','#ffd87a','#ffe9b0','#ffffff'] },
};
const WAVE_N = 4;   // number of wave lines

// best-effort hardware corner radius (RN/Expo has no JS API for it — override via prop)
export function useScreenCornerRadius() {
  return Platform.OS === 'ios' ? 44 : 32;
}

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
// 0..1 progress that animates whenever `mode` changes; keeps prev+cur for cross-fade
function useModeTransition(mode) {
  const [pair, setPair] = useState({ prev: mode, cur: mode });
  const t = useSharedValue(1);
  useEffect(() => {
    if (mode !== pair.cur) {
      setPair({ prev: pair.cur, cur: mode });
      t.value = 0;
      t.value = withTiming(1, { duration: 450 });
    }
  }, [mode]); // eslint-disable-line
  return { t, prev: pair.prev, cur: pair.cur };
}

/** AuraOrb — fixed-size orb; only the colored wave lines move. Optional drag. */
export function AuraOrb({ mode = 'normal', level = 0, demo = false, size = 140, width, height, draggable = false, style }) {
  const W = width ?? Math.round(size * 1.7);
  const H = height ?? Math.round(size * 1.7);
  const R = size / 2;
  const cx = W / 2, cy = H / 2;

  const clock = useClock();
  const energy = useEnergy(clock, level, demo);
  const { t, prev, cur } = useModeTransition(mode);
  const cfg = AURA_MODES[cur] || AURA_MODES.normal;
  const prevCfg = AURA_MODES[prev] || AURA_MODES.normal;

  const haloProps = useAnimatedProps(() => ({ opacity: 0.16 + energy.value * 0.2 }));

  // drag (built-in PanResponder; no extra dep). Hooks must be unconditional.
  const panPos = useRef(new Animated.ValueXY()).current;
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => draggable && (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3),
      onPanResponderGrant: () => { panPos.extractOffset(); },
      onPanResponderMove: Animated.event([null, { dx: panPos.x, dy: panPos.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => { panPos.flattenOffset(); },
    })
  ).current;

  const svg = (
    <Svg width={W} height={H} style={draggable ? undefined : style}>
      <Defs>
        <ClipPath id="aura-orb"><Circle cx={cx} cy={cy} r={R} /></ClipPath>
        <LinearGradient id="aura-base" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={cfg.base[0]} /><Stop offset="0.55" stopColor={cfg.base[1]} /><Stop offset="1" stopColor={cfg.base[2]} />
        </LinearGradient>
        <RadialGradient id="aura-halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={cfg.halo} stopOpacity="0.9" /><Stop offset="1" stopColor={cfg.halo} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <AnimatedCircle cx={cx} cy={cy} r={R * 1.5} fill="url(#aura-halo)" animatedProps={haloProps} />
      <Circle cx={cx} cy={cy} r={R} fill="url(#aura-base)" />
      <G clipPath="url(#aura-orb)">
        {Array.from({ length: WAVE_N }).map((_, i) => (
          <WaveLine key={i} i={i} clock={clock} energy={energy} t={t}
            prevCol={prevCfg.waves[i]} curCol={cfg.waves[i]} R={R} cx={cx} cy={cy} />
        ))}
      </G>
      <Circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(140,170,235,0.45)" strokeWidth={1} />
    </Svg>
  );

  if (!draggable) return svg;
  return (
    <Animated.View {...responder.panHandlers} style={[{ transform: panPos.getTranslateTransform() }, style]}>
      {svg}
    </Animated.View>
  );
}

function WaveLine({ i, clock, energy, t, prevCol, curCol, R, cx, cy }) {
  const props = useAnimatedProps(() => {
    'worklet';
    const e = energy.value;
    const amp = R * (0.06 + e * 0.34) * (1 - i * 0.12);
    const yB = cy + (-0.16 + i * 0.12) * R;            // spread the lines vertically
    const freq = 1.4 + i * 0.5;
    const ph = clock.value * (0.0016 + i * 0.0005) * (i % 2 ? -1 : 1);
    const N = 16;
    let d = `M ${cx - R} ${yB}`;
    for (let k = 0; k <= N; k++) {
      const tx = k / N;
      const x = cx - R + tx * R * 2;
      const win = Math.sin(tx * Math.PI);
      const y = yB + Math.sin(tx * Math.PI * 2 * freq + ph) * amp * win;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return { d, stroke: interpolateColor(t.value, [0, 1], [prevCol, curCol]) };
  });
  return <AnimatedPath animatedProps={props} fill="none" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" opacity={0.92} />;
}

/** AuraFrame — rainbow aura around the edge. Static rainbow (cheap) + reactive glow. */
export function AuraFrame({
  mode = 'normal', level = 0, demo = false,
  borderWidth = 4, borderRadius, glow = true, style, children,
}) {
  const sysR = useScreenCornerRadius();
  const radius = borderRadius != null ? borderRadius : sysR;
  const [dim, setDim] = useState({ w: 0, h: 0 });
  const clock = useClock();
  const energy = useEnergy(clock, level, demo);
  const { t, prev, cur } = useModeTransition(mode);
  const cfg = AURA_MODES[cur] || AURA_MODES.normal;
  const prevCfg = AURA_MODES[prev] || AURA_MODES.normal;

  // glow line thickens/brightens with energy (one cheap animated prop)
  const glowProps = useAnimatedProps(() => ({ strokeWidth: borderWidth * (2 + energy.value * 4), opacity: (0.1 + energy.value * 0.22) }));
  // cross-fade between previous and current palette on mode change
  const curOpacity = useAnimatedProps(() => ({ opacity: t.value }));

  const { w, h } = dim;
  const d = w > 0 ? roundedRect(borderWidth / 2, borderWidth / 2, w - borderWidth, h - borderWidth, radius) : '';

  return (
    <View style={[{ flex: 1 }, style]} onLayout={(e) => { const { width, height } = e.nativeEvent.layout; setDim({ w: width, h: height }); }}>
      {children}
      {w > 0 && (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="rb-cur" x1="0" y1="0" x2="1" y2="1">
              {cfg.border.map((c, i) => <Stop key={i} offset={i / (cfg.border.length - 1)} stopColor={c} />)}
            </LinearGradient>
            <LinearGradient id="rb-prev" x1="0" y1="0" x2="1" y2="1">
              {prevCfg.border.map((c, i) => <Stop key={i} offset={i / (prevCfg.border.length - 1)} stopColor={c} />)}
            </LinearGradient>
          </Defs>
          {/* soft glow (reacts to level) */}
          {glow && <AnimatedPath d={d} fill="none" stroke="url(#rb-cur)" strokeLinejoin="round" animatedProps={glowProps} />}
          {/* previous palette underneath, current crossfades in on mode change */}
          <Path d={d} fill="none" stroke="url(#rb-prev)" strokeWidth={borderWidth} strokeLinejoin="round" opacity={0.95} />
          <AnimatedPath d={d} fill="none" stroke="url(#rb-cur)" strokeWidth={borderWidth} strokeLinejoin="round" animatedProps={curOpacity} />
        </Svg>
      )}
    </View>
  );
}

function roundedRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
}

export default AuraOrb;
