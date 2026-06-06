// Type definitions for @dash-systems/aura

export type AuraMode = 'normal' | 'think' | 'error' | 'success' | 'warning';

export interface AuraOptions {
  ballRadius?: number;
  threshold?: number;
  maxEdge?: number;
  spinIdle?: number;
  spinSpeak?: number;
  preamp?: number;
  highpass?: number;
  lowpass?: number;
  position?: [number, number];
  subtitles?: boolean;
  lang?: string;
  borderRadius?: number;
  borderWidth?: number;
  colorFade?: number;
  closeTimeout?: number;
  subtitleTimeout?: number;
  subtitleMaxWords?: number;
  draggable?: boolean;
  dismissible?: boolean;
  autoMove?: boolean;
  autoMoveContainer?: Element | Document | null;
  avoidMargin?: number;
  gridMargin?: [number, number];
  onClose?: () => void;
  onMove?: (col: number, row: number) => void;
  onMode?: (mode: AuraMode) => void;
}

export interface AuraState {
  mode: AuraMode;
  level: number;
  bands: { bass: number; mid: number; treble: number };
  position: { x: number; y: number; col: number; row: number };
  listening: boolean;
  demo: boolean;
  open: boolean;
}

export class AudioReactor {
  constructor(opts?: Partial<AuraOptions>);
  level: number; bass: number; mid: number; treble: number; live: boolean; fake: boolean;
  enableMic(): Promise<void>;
  enableDemo(): void;
  stop(): void;
  update(dt: number): void;
}

export class VoiceOrb {
  constructor(target: HTMLElement, opts?: AuraOptions);
  audio: AudioReactor;
  // control
  enableMic(): Promise<void>;
  enableDemo(): void;
  stop(): void;
  setMode(mode: AuraMode): this;
  moveTo(col: number, row: number): this;
  moveToPoint(x: number, y: number, snap?: boolean): this;
  close(): this;
  open(): this;
  highlight(el: Element | null): this;
  clearHighlight(): this;
  avoid(el: Element | null): this;
  showSubtitles(on: boolean): this;
  // setters
  setBorderWidth(px: number): this;
  setBorderRadius(px: number): this;
  setThreshold(t: number): this;
  setMaxEdge(px: number): this;
  setSpin(idle?: number, speak?: number): this;
  setColorFade(sec: number): this;
  setPalette(colors: [number, number, number][]): this;
  configure(patch: Partial<AuraOptions>): this;
  // getters
  getMode(): AuraMode;
  getLevel(): number;
  getBands(): { bass: number; mid: number; treble: number };
  getPosition(): { x: number; y: number; col: number; row: number };
  getHighlighted(): Element | null;
  isListening(): boolean;
  isDemo(): boolean;
  isOpen(): boolean;
  getState(): AuraState;
  // events: 'mode' | 'move' | 'close' | 'highlight' | 'transcript'
  on(event: string, fn: (...args: any[]) => void): () => void;
  off(event: string, fn: (...args: any[]) => void): void;
  enableAutoMove(): void;
  disableAutoMove(): void;
  destroy(): void;
}

export const Aura: typeof VoiceOrb;
export default VoiceOrb;

// ---- generators (import from '@dash-systems/aura/gen') ----
export interface GenOptions {
  autoStart?: boolean;
  colors?: string[];
  label?: string;
  speed?: number;
  onComplete?: (payload: any) => void;
  onFail?: (message?: string) => void;
  bars?: number;
  lines?: number;
  tiles?: [number, number];
}
export interface Gen<P = any> {
  start(): this; stop(): this; setProgress(p: number): this; setLabel(t: string): this;
  setColors(c: string[]): this; reset(): this; complete(payload: P): this; fail(message?: string): this; destroy(): void;
}
export class ImageGen implements Gen<string> { constructor(el: HTMLElement, opts?: GenOptions); start(): this; stop(): this; setProgress(p: number): this; setLabel(t: string): this; setColors(c: string[]): this; reset(): this; complete(url: string): this; fail(message?: string): this; destroy(): void; }
export class SongGen  implements Gen<string | HTMLElement> { constructor(el: HTMLElement, opts?: GenOptions); start(): this; stop(): this; setProgress(p: number): this; setLabel(t: string): this; setColors(c: string[]): this; reset(): this; complete(payload: string | HTMLElement): this; fail(message?: string): this; destroy(): void; }
export class VideoGen implements Gen<string | HTMLVideoElement> { constructor(el: HTMLElement, opts?: GenOptions); start(): this; stop(): this; setProgress(p: number): this; setLabel(t: string): this; setColors(c: string[]): this; reset(): this; complete(payload: string | HTMLVideoElement): this; fail(message?: string): this; destroy(): void; }
export class TextGen  implements Gen<string | { text: string; type?: boolean }> { constructor(el: HTMLElement, opts?: GenOptions); start(): this; stop(): this; setProgress(p: number): this; setLabel(t: string): this; setColors(c: string[]): this; reset(): this; complete(payload: string | { text: string; type?: boolean }): this; fail(message?: string): this; destroy(): void; }
