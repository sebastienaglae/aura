/*!
 * Aura — React bindings.  © Dash Systems.
 * Import path: `@dash-systems/aura/react`
 *
 *   import { Aura, AuraImageGen } from '@dash-systems/aura/react';
 *   <Aura mode="think" source="mic" options={{ borderRadius: 24 }} />
 *   <AuraImageGen generating={loading} result={url} />
 */
import { useEffect, useRef } from 'react';
import { VoiceOrb } from './aura.js';
import { ImageGen, SongGen, VideoGen, TextGen } from './aura-gen.js';

/**
 * <Aura/> — the voice orb.
 * props: mode, source ('mic'|'demo'|'off'), options (VoiceOrb opts),
 *        onReady(orb), onMode, onMove, onClose, onTranscript, className, style
 */
export function Aura({ mode = 'normal', source = 'off', options, onReady, onMode, onMove, onClose, onTranscript, className, style, ...rest }) {
  const hostRef = useRef(null);
  const orbRef = useRef(null);
  const cbs = useRef({});
  cbs.current = { onMode, onMove, onClose, onTranscript };

  useEffect(() => {
    const orb = new VoiceOrb(hostRef.current, { ...options });
    orbRef.current = orb;
    const offs = [
      orb.on('mode', (m) => cbs.current.onMode && cbs.current.onMode(m)),
      orb.on('move', (c, r) => cbs.current.onMove && cbs.current.onMove(c, r)),
      orb.on('close', () => cbs.current.onClose && cbs.current.onClose()),
      orb.on('transcript', (f, i) => cbs.current.onTranscript && cbs.current.onTranscript(f, i)),
    ];
    if (onReady) onReady(orb);
    return () => { offs.forEach((f) => f()); orb.destroy(); };
  }, []); // eslint-disable-line

  useEffect(() => { orbRef.current && orbRef.current.setMode(mode || 'normal'); }, [mode]);
  useEffect(() => {
    const o = orbRef.current; if (!o) return;
    if (source === 'mic') o.enableMic().catch(() => {});
    else if (source === 'demo') o.enableDemo();
    else o.stop();
  }, [source]);

  return <div ref={hostRef} className={className} style={{ position: 'relative', ...style }} {...rest} />;
}

function makeGen(GenClass) {
  return function GenComponent({ generating = true, result = null, error = null, progress, options, onReady, className, style, ...rest }) {
    const hostRef = useRef(null);
    const genRef = useRef(null);
    useEffect(() => {
      const g = new GenClass(hostRef.current, { autoStart: generating, ...options });
      genRef.current = g; if (onReady) onReady(g);
      return () => g.destroy();
    }, []); // eslint-disable-line
    useEffect(() => { const g = genRef.current; if (!g) return; if (generating) g.reset(); else g.stop(); }, [generating]);
    useEffect(() => { const g = genRef.current; if (g && result != null) g.complete(result); }, [result]);
    useEffect(() => { const g = genRef.current; if (g && error != null && error !== false) g.fail(typeof error === 'string' ? error : undefined); }, [error]);
    useEffect(() => { const g = genRef.current; if (g && progress != null) g.setProgress(progress); }, [progress]);
    return <div ref={hostRef} className={className} style={{ position: 'relative', ...style }} {...rest} />;
  };
}

export const AuraImageGen = makeGen(ImageGen);
export const AuraSongGen = makeGen(SongGen);
export const AuraVideoGen = makeGen(VideoGen);
export const AuraTextGen = makeGen(TextGen);
