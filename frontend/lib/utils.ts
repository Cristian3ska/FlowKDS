import { AlertLevel, Ticket } from '@/types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = {
  get: (path: string) => fetch(`${API}${path}`).then(r => r.json()),
  post: (path: string, body: unknown) =>
    fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  put: (path: string, body: unknown) =>
    fetch(`${API}${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  patch: (path: string, body: unknown) =>
    fetch(`${API}${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  delete: (path: string) => fetch(`${API}${path}`, { method: 'DELETE' }).then(r => {
    if (r.status === 204) return {};
    return r.json();
  }),
};

export function getAlertLevel(ticket: Ticket, yellowThreshold = 300, redThreshold = 600): AlertLevel {
  const elapsedSeconds = (Date.now() - ticket.created_at) / 1000;
  if (elapsedSeconds >= redThreshold) return 'red';
  if (elapsedSeconds >= yellowThreshold) return 'yellow';
  return 'green';
}

export function formatElapsed(createdAt: number): string {
  const seconds = Math.floor((Date.now() - createdAt) / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatSeconds(seconds: number): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatPrepTime(seconds: number): string {
  if (!seconds) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export const ORDER_TYPE_LABELS: Record<string, string> = {
  'dine-in': 'Mesa',
  'takeout': 'Para Llevar',
  'delivery': 'Delivery',
  'vip': 'VIP',
};

export const ORDER_TYPE_COLORS: Record<string, string> = {
  'dine-in': '#6366f1',
  'takeout': '#06b6d4',
  'delivery': '#f59e0b',
  'vip': '#ec4899',
};

export const STATION_COLORS: Record<string, string> = {
  all:      '#6366f1',
  food:     '#f59e0b',
  bar:      '#8b5cf6',
  bar_hot:  '#ef4444',
  bar_cold: '#06b6d4',
};

export const STATION_LABELS: Record<string, string> = {
  all:      'Todas',
  food:     'Comida',
  bar:      'Barra',
  bar_hot:  'Calientes',
  bar_cold: 'Frías',
};


let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// ── Primitive helpers ────────────────────────────────────────────────────────

function makeGain(ctx: AudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

function playOsc(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType = 'sine',
  peakGain = 0.4,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.005); // fast attack
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

// ── NEW ORDER — Audio File (ready.mp3) ───────────────────────────────────────
function playNewOrderSound() {
  try {
    const audio = new Audio('/sounds/ready.mp3');
    audio.play().catch(e => console.warn('Audio play blocked:', e));
  } catch {
    // ignore
  }
}

// ── DELAYED — urgent two-tone alarm ─────────────────────────────────────────
// Three rapid low-high pulses, slightly distorted square-wave feel
function playDelayedSound(ctx: AudioContext) {
  const master = makeGain(ctx, 0.75);
  master.connect(ctx.destination);

  const now = ctx.currentTime;
  const pulseDur = 0.18;
  const gap      = 0.06;

  for (let i = 0; i < 3; i++) {
    const t = now + i * (pulseDur * 2 + gap);

    // Low tone
    playOsc(ctx, master, 380, t,               pulseDur, 'sawtooth', 0.30);
    playOsc(ctx, master, 380, t,               pulseDur, 'square',   0.15);

    // High tone immediately after
    playOsc(ctx, master, 760, t + pulseDur + 0.02, pulseDur, 'sawtooth', 0.30);
    playOsc(ctx, master, 760, t + pulseDur + 0.02, pulseDur, 'square',   0.15);
  }
}

// ── COMPLETE / DISPATCHED — ascending success chime ─────────────────────────
// Three rising notes: major-chord arpeggio (C-E-G-C')
function playCompleteSound(ctx: AudioContext) {
  const master = makeGain(ctx, 0.75);
  master.connect(ctx.destination);

  const now   = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  const step  = 0.13;

  notes.forEach((freq, i) => {
    const t = now + i * step;
    playOsc(ctx, master, freq,  t, 0.45 + i * 0.05, 'sine',     0.35);
    playOsc(ctx, master, freq * 2, t, 0.25,          'sine',     0.06); // octave shimmer
  });
}

// ── ITEM READY — short success pop ──────────────────────────────────────────
function playItemReadySound(ctx: AudioContext) {
  const master = makeGain(ctx, 0.4); 
  master.connect(ctx.destination);
  const now = ctx.currentTime;
  
  // High-pitch short success pop
  playOsc(ctx, master, 1200, now, 0.08, 'sine', 0.35);
  playOsc(ctx, master, 1800, now, 0.08, 'sine', 0.15);
}

// ── NEW SYNTH SOUNDS ────────────────────────────────────────────────────────
function playDigitalChime(ctx: AudioContext) {
  const master = makeGain(ctx, 0.4);
  master.connect(ctx.destination);
  const now = ctx.currentTime;
  playOsc(ctx, master, 880, now, 0.15, 'sine', 0.4);
  playOsc(ctx, master, 1108.73, now + 0.1, 0.4, 'sine', 0.4); // C#6
}

function playBubblePop(ctx: AudioContext) {
  const master = makeGain(ctx, 0.6);
  master.connect(ctx.destination);
  const now = ctx.currentTime;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  
  // Frequency drops rapidly
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
  
  // Gain pops quickly
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.6, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  
  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + 0.2);
}

function playBuzzer(ctx: AudioContext) {
  const master = makeGain(ctx, 0.4);
  master.connect(ctx.destination);
  const now = ctx.currentTime;
  // Harsh low frequency repeated twice
  playOsc(ctx, master, 150, now, 0.3, 'sawtooth', 0.5);
  playOsc(ctx, master, 150, now + 0.4, 0.6, 'sawtooth', 0.5);
}

function playSoftPing(ctx: AudioContext) {
  const master = makeGain(ctx, 0.6);
  master.connect(ctx.destination);
  const now = ctx.currentTime;
  playOsc(ctx, master, 1046.5, now, 0.6, 'triangle', 0.5); // high clean C6
}

// ── Public API ───────────────────────────────────────────────────────────────

export type SoundType = 'new_order' | 'delayed' | 'complete' | 'item_ready' | 'digital' | 'pop' | 'buzzer' | 'ping';

export const soundConfig = {
  new_order: 'new_order' as SoundType,
  delayed: 'delayed' as SoundType,
  complete: 'complete' as SoundType,
  item_ready: 'item_ready' as SoundType,
};

export function updateSoundConfig(config: Partial<typeof soundConfig>) {
  Object.assign(soundConfig, config);
}

export function playSound(type: SoundType) {
  try {
    const actualSound = soundConfig[type as keyof typeof soundConfig] || type;

    if (actualSound === 'new_order') {
      playNewOrderSound();
      return;
    }
    
    const ctx = getAudioContext();
    if (actualSound === 'delayed')    playDelayedSound(ctx);
    else if (actualSound === 'complete')   playCompleteSound(ctx);
    else if (actualSound === 'item_ready') playItemReadySound(ctx);
    else if (actualSound === 'digital')    playDigitalChime(ctx);
    else if (actualSound === 'pop')        playBubblePop(ctx);
    else if (actualSound === 'buzzer')     playBuzzer(ctx);
    else if (actualSound === 'ping')       playSoftPing(ctx);
  } catch { /* ignore audio errors in restricted environments */ }
}
