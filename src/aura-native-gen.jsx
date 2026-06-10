/*!
 * Aura — React Native generators (image / song / video / text).  © Dash Systems.
 * Import path: `@sebastienaglae/aura/native/gen`
 *
 * Colorful "generating…" placeholders for native, mirroring the web generators:
 * an animated gradient + shimmer while busy, a reveal of the result, and a red
 * fail state. UI only — drive `generating` / `result` / `error` from your app.
 *
 * Peer deps: react-native-reanimated, expo-linear-gradient
 * VISUAL ONLY — no audio/speech deps. To reveal a video, pass your own player
 * element as `result` (e.g. an <expo-video>/<Video> you already use in your app).
 *
 *   <ImageGenNative generating={loading} result={url} error={err} style={{height:200}} />
 */
import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing, cancelAnimation,
} from 'react-native-reanimated';

const DEFAULT_COLORS = ['#ff2d6f', '#ff7a00', '#ffe000', '#21d36a', '#00d4ff', '#3d6bff', '#a93bff'];
const AGradient = Animated.createAnimatedComponent(LinearGradient);

// flowing colorful background + a sliding shimmer; shared by the generators
function GenStage({ colors = DEFAULT_COLORS, children, glyph }) {
  const shift = useSharedValue(0);
  const sweep = useSharedValue(-1);
  useEffect(() => {
    shift.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.ease) }), -1, true);
    sweep.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }), -1, false);
    return () => { cancelAnimation(shift); cancelAnimation(sweep); };
  }, []);
  const bg = useAnimatedStyle(() => ({ transform: [{ translateX: (shift.value - 0.5) * 60 }, { scale: 1.4 }] }));
  const sw = useAnimatedStyle(() => ({ transform: [{ translateX: sweep.value * 400 }, { rotate: '12deg' }], opacity: 0.5 }));
  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, bg]}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[styles.sweep, sw]} pointerEvents="none" />
      {glyph}
      {children}
    </>
  );
}

// indeterminate loading bar
function LoadBar({ colors }) {
  const x = useSharedValue(-1);
  useEffect(() => { x.value = withRepeat(withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.cubic) }), -1, false); return () => cancelAnimation(x); }, []);
  const s = useAnimatedStyle(() => ({ left: `${x.value * 100}%` }));
  return (
    <View style={styles.loadTrack} pointerEvents="none">
      <Animated.View style={[styles.loadFill, s]}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

// fade-in reveal wrapper for the result
function Reveal({ show, children }) {
  const o = useSharedValue(0);
  useEffect(() => { o.value = withTiming(show ? 1 : 0, { duration: 450 }); }, [show]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  if (!show) return null;
  return <Animated.View style={[StyleSheet.absoluteFill, s]}>{children}</Animated.View>;
}

// red shake + icon, fades the busy layers behind it (opaque)
function FailOverlay({ shown }) {
  const x = useSharedValue(0);
  useEffect(() => { if (shown) x.value = withSequence(withTiming(-7, { duration: 60 }), withTiming(6, { duration: 60 }), withTiming(-4, { duration: 60 }), withTiming(0, { duration: 60 })); }, [shown]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  if (!shown) return null;
  return (
    <Animated.View style={[styles.fail, s]}>
      <View style={styles.failIcon}><Text style={styles.failMark}>!</Text></View>
    </Animated.View>
  );
}

function Frame({ style, children }) {
  return <View style={[styles.frame, style]}>{children}</View>;
}

/* ---- Image ---- */
export function ImageGenNative({ generating = true, result, error, colors, style }) {
  const failed = error != null && error !== false;
  return (
    <Frame style={style}>
      {generating && !result && !failed && (
        <GenStage colors={colors}><LoadBar colors={colors || DEFAULT_COLORS} /></GenStage>
      )}
      <Reveal show={!!result && !failed}>
        {result ? <Image source={typeof result === 'string' ? { uri: result } : result} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      </Reveal>
      <FailOverlay shown={failed} />
    </Frame>
  );
}

/* ---- Song (equalizer bars) ---- */
export function SongGenNative({ generating = true, result, error, colors = DEFAULT_COLORS, bars = 22, style }) {
  const failed = error != null && error !== false;
  return (
    <Frame style={style}>
      {generating && !result && !failed && (
        <GenStage colors={colors}>
          <View style={styles.eq}>
            {Array.from({ length: bars }).map((_, i) => <Bar key={i} i={i} colors={colors} />)}
          </View>
        </GenStage>
      )}
      <Reveal show={!!result && !failed}>{result || null}</Reveal>
      <FailOverlay shown={failed} />
    </Frame>
  );
}
function Bar({ i, colors }) {
  const h = useSharedValue(0.2);
  useEffect(() => {
    h.value = withRepeat(withTiming(1, { duration: 650 + (i % 5) * 110, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(h);
  }, []);
  const s = useAnimatedStyle(() => ({ transform: [{ scaleY: h.value }] }));
  return (
    <Animated.View style={[styles.bar, s]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

/* ---- Video ---- */
export function VideoGenNative({ generating = true, result, error, colors, style }) {
  const failed = error != null && error !== false;
  return (
    <Frame style={style}>
      {generating && !result && !failed && (
        <GenStage colors={colors} glyph={<View style={styles.play} pointerEvents="none" />}>
          <LoadBar colors={colors || DEFAULT_COLORS} />
        </GenStage>
      )}
      <Reveal show={!!result && !failed}>{result || null}</Reveal>
      <FailOverlay shown={failed} />
    </Frame>
  );
}

/* ---- Text ---- */
export function TextGenNative({ generating = true, result, error, colors, lines = 4, style }) {
  const failed = error != null && error !== false;
  return (
    <Frame style={[{ minHeight: 90 }, style]}>
      {generating && !result && !failed && (
        <GenStage colors={colors}>
          <View style={styles.lines}>
            {Array.from({ length: lines }).map((_, i) => (
              <SkeletonLine key={i} colors={colors || DEFAULT_COLORS} last={i === lines - 1} />
            ))}
          </View>
        </GenStage>
      )}
      <Reveal show={!!result && !failed}>
        <View style={styles.textWrap}><Text style={styles.text}>{typeof result === 'string' ? result : ''}</Text></View>
      </Reveal>
      <FailOverlay shown={failed} />
    </Frame>
  );
}
function SkeletonLine({ colors, last }) {
  const o = useSharedValue(0.5);
  useEffect(() => { o.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true); return () => cancelAnimation(o); }, []);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[styles.line, { width: last ? '52%' : '92%' }, s]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'relative', overflow: 'hidden', borderRadius: 16, backgroundColor: '#07080f' },
  sweep: { position: 'absolute', top: -40, bottom: -40, width: 120, backgroundColor: 'rgba(255,255,255,0.35)' },
  loadTrack: { position: 'absolute', left: '9%', right: '9%', bottom: 12, height: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  loadFill: { position: 'absolute', top: 0, bottom: 0, width: '38%', borderRadius: 4, overflow: 'hidden' },
  eq: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: '9%', gap: 4 },
  bar: { flex: 1, maxWidth: 10, height: '55%', borderRadius: 6, overflow: 'hidden' },
  lines: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', padding: '8%', gap: 11 },
  line: { height: 12, borderRadius: 7, overflow: 'hidden' },
  textWrap: { flex: 1, padding: '8%', backgroundColor: '#07080f' },
  text: { color: '#f4f6ff', fontSize: 16, lineHeight: 24, fontWeight: '500' },
  play: { position: 'absolute', alignSelf: 'center', top: '42%', width: 0, height: 0, borderTopWidth: 14, borderBottomWidth: 14, borderLeftWidth: 22, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: 'rgba(255,255,255,0.92)' },
  fail: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3a0a0c' },
  failIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 2.5, borderColor: '#ff6a6a', alignItems: 'center', justifyContent: 'center' },
  failMark: { color: '#ff6a6a', fontSize: 22, fontWeight: '800' },
});

export const GEN_NATIVE = { ImageGenNative, SongGenNative, VideoGenNative, TextGenNative };
