import React, { useState, useRef } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuraOrb, AuraFrame } from '../../src/aura-native';
import { ImageGenNative, SongGenNative, VideoGenNative, TextGenNative } from '../../src/aura-native-gen';

const MODES = ['normal', 'think', 'error', 'success', 'warning'];
const SAMPLE_TEXT =
  'Aura turns your AI pipeline into something people can feel. While the model thinks, the orb breathes; while it writes, the words appear.';

function Btn({ label, onPress, tint }) {
  return (
    <Pressable onPress={onPress} style={[styles.btn, tint && { borderColor: tint }]}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

function GenCard({ title, children, onGen, onFail }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardBox}>{children}</View>
      <View style={styles.cardRow}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn label="generate" onPress={onGen} />
          <Btn label="fail" onPress={onFail} tint="#ff6a6a" />
        </View>
      </View>
    </View>
  );
}

export default function App() {
  const [mode, setMode] = useState('normal');
  const [demo, setDemo] = useState(true);

  // generator state
  const [g, setG] = useState({
    image: { generating: false, result: null, error: null },
    song:  { generating: false, result: null, error: null },
    video: { generating: false, result: null, error: null },
    text:  { generating: false, result: null, error: null },
  });
  const timers = useRef({});
  const set = (k, v) => setG((s) => ({ ...s, [k]: { ...s[k], ...v } }));

  const run = (k, result) => {
    clearTimeout(timers.current[k]);
    set(k, { generating: true, result: null, error: null });
    timers.current[k] = setTimeout(() => set(k, { generating: false, result }), 2600);
  };
  const fail = (k) => {
    clearTimeout(timers.current[k]);
    set(k, { generating: true, result: null, error: null });
    timers.current[k] = setTimeout(() => set(k, { generating: false, error: `${k} generation failed` }), 1400);
  };

  return (
   <AuraFrame mode={mode} demo={demo} borderRadius={26} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <StatusBar style="light" />
      <Text style={styles.h1}>Aura</Text>
      <Text style={styles.tag}>DASH SYSTEMS · REACT NATIVE</Text>

      {/* main orb */}
      <View style={styles.orbWrap}>
        <AuraOrb mode={mode} demo={demo} size={150} />
      </View>

      <View style={styles.controls}>
        {MODES.map((m) => (
          <Btn key={m} label={m} onPress={() => setMode(m)} tint={mode === m ? '#4d7bff' : undefined} />
        ))}
        <Btn label={demo ? 'demo: on' : 'demo: off'} onPress={() => setDemo((d) => !d)} tint="#a93bff" />
      </View>

      {/* tiny gallery of all modes */}
      <View style={styles.gallery}>
        {MODES.map((m) => <AuraOrb key={m} mode={m} demo size={70} />)}
      </View>

      <Text style={styles.section}>Generators</Text>
      <GenCard title="Image"
        onGen={() => run('image', 'https://picsum.photos/seed/aura/600/400')}
        onFail={() => fail('image')}>
        <ImageGenNative {...g.image}
          result={g.image.result ? { uri: g.image.result } : null}
          style={styles.box} />
      </GenCard>

      <GenCard title="Song"
        onGen={() => run('song', <Centered text="♪ song ready" />)}
        onFail={() => fail('song')}>
        <SongGenNative {...g.song} colors={['#00d4ff', '#3d6bff', '#a93bff']} style={styles.box} />
      </GenCard>

      <GenCard title="Video"
        onGen={() => run('video', <Centered text="▶ video ready" />)}
        onFail={() => fail('video')}>
        <VideoGenNative {...g.video} colors={['#ff2d6f', '#ff7a00', '#ffe000']} style={styles.box} />
      </GenCard>

      <GenCard title="Text"
        onGen={() => run('text', SAMPLE_TEXT)}
        onFail={() => fail('text')}>
        <TextGenNative {...g.text} lines={5} style={[styles.box, { height: 120 }]} />
      </GenCard>

      <View style={{ height: 60 }} />
    </ScrollView>
   </AuraFrame>
  );
}

function Centered({ text }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0d18' }}>
      <Text style={{ color: '#9fb3ff', fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#06070c' },
  content: { padding: 20, paddingTop: 64, alignItems: 'center' },
  h1: { color: '#eef1ff', fontSize: 44, fontWeight: '700' },
  tag: { color: '#6b7396', fontSize: 11, letterSpacing: 3, marginTop: 4, marginBottom: 8 },
  orbWrap: { width: '100%', alignItems: 'center', marginVertical: 8 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 },
  section: { color: '#8b93b5', alignSelf: 'flex-start', marginTop: 28, marginBottom: 10, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' },
  card: { width: '100%', backgroundColor: '#0d101c', borderRadius: 16, borderWidth: 1, borderColor: '#1c2236', padding: 12, marginBottom: 16 },
  cardBox: { borderRadius: 12, overflow: 'hidden' },
  box: { height: 150 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  cardTitle: { color: '#eef1ff', fontWeight: '600', fontSize: 15 },
  btn: { borderWidth: 1, borderColor: '#2a3150', backgroundColor: '#161b30', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 },
  btnText: { color: '#eef1ff', fontWeight: '600', fontSize: 13 },
});
