// Every sound is synthesised with WebAudio, so there are no audio files to load.
let ctx = null;
let master = null;
let muted = false;
let noiseBuf = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.55;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.55;
}

function tone({ type = 'sine', f0 = 440, f1 = f0, dur = 0.2, vol = 0.3, delay = 0, attack = 0.005 }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

function noise({ dur = 0.3, vol = 0.3, type = 'bandpass', f0 = 1000, f1 = f0, q = 1, delay = 0, attack = 0.005 }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + dur + 0.05);
}

export const sfx = {
  click() { tone({ type: 'square', f0: 880, f1: 660, dur: 0.05, vol: 0.12 }); },
  tick() { tone({ type: 'square', f0: 1200, dur: 0.03, vol: 0.08 }); },
  whack(quality = 1) {
    noise({ dur: 0.12, vol: 0.5, type: 'highpass', f0: 2500, f1: 1200 });
    tone({ type: 'triangle', f0: 180, f1: 60, dur: 0.16, vol: 0.5 });
    if (quality >= 1) tone({ type: 'sine', f0: 2400, f1: 2200, dur: 0.35, vol: 0.18, delay: 0.01 });
  },
  shank() { tone({ type: 'sawtooth', f0: 300, f1: 80, dur: 0.3, vol: 0.25 }); noise({ dur: 0.15, vol: 0.3, f0: 600 }); },
  coin() { tone({ type: 'square', f0: 988, dur: 0.07, vol: 0.12 }); tone({ type: 'square', f0: 1319, dur: 0.18, vol: 0.12, delay: 0.07 }); },
  crate() { [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.09, vol: 0.1, delay: i * 0.06 })); },
  bad() { [392, 330, 262].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.14, vol: 0.12, delay: i * 0.1 })); },
  honk() {
    tone({ type: 'sawtooth', f0: 420, f1: 300, dur: 0.22, vol: 0.28 });
    tone({ type: 'sawtooth', f0: 430, f1: 280, dur: 0.28, vol: 0.28, delay: 0.25 });
  },
  baa() {
    if (!ctx) return;
    const o = tone({ type: 'sawtooth', f0: 520, f1: 380, dur: 0.6, vol: 0.2 });
    if (!o) return;
    const lfo = ctx.createOscillator(); const lg = ctx.createGain();
    lfo.frequency.value = 22; lg.gain.value = 30;
    lfo.connect(lg).connect(o.frequency); lfo.start(); lfo.stop(ctx.currentTime + 0.65);
  },
  moo() { tone({ type: 'sawtooth', f0: 150, f1: 110, dur: 0.9, vol: 0.25, attack: 0.1 }); },
  bonk() { tone({ type: 'square', f0: 260, f1: 90, dur: 0.18, vol: 0.3 }); noise({ dur: 0.08, vol: 0.2, f0: 900 }); },
  wham() { tone({ type: 'triangle', f0: 120, f1: 40, dur: 0.4, vol: 0.6 }); noise({ dur: 0.3, vol: 0.4, type: 'lowpass', f0: 1200, f1: 200 }); },
  thwack() { noise({ dur: 0.25, vol: 0.35, f0: 700, f1: 300, q: 2 }); },
  splash() { noise({ dur: 0.7, vol: 0.45, type: 'lowpass', f0: 3000, f1: 300, attack: 0.01 }); tone({ type: 'sine', f0: 600, f1: 120, dur: 0.25, vol: 0.2 }); },
  sizzle() { noise({ dur: 1.2, vol: 0.35, type: 'highpass', f0: 3000, f1: 5000, attack: 0.02 }); },
  thud(v = 1) { tone({ type: 'sine', f0: 140, f1: 60, dur: 0.12, vol: Math.min(0.35, 0.08 + v * 0.01) }); },
  sand() { noise({ dur: 0.35, vol: 0.3, type: 'lowpass', f0: 1800, f1: 400 }); },
  boing() { tone({ type: 'sine', f0: 180, f1: 720, dur: 0.35, vol: 0.35 }); tone({ type: 'sine', f0: 720, f1: 300, dur: 0.25, vol: 0.2, delay: 0.3 }); },
  whoosh() { noise({ dur: 1, vol: 0.4, f0: 300, f1: 3000, q: 1.5, attack: 0.1 }); },
  zoom() { tone({ type: 'sawtooth', f0: 300, f1: 1600, dur: 0.4, vol: 0.18 }); tone({ type: 'sine', f0: 600, f1: 2400, dur: 0.4, vol: 0.15 }); },
  rocket() { noise({ dur: 0.9, vol: 0.45, type: 'lowpass', f0: 600, f1: 2500, attack: 0.02 }); tone({ type: 'sawtooth', f0: 90, f1: 300, dur: 0.8, vol: 0.2 }); },
  ufo() {
    if (!ctx) return;
    const o = tone({ type: 'sine', f0: 600, f1: 900, dur: 1.5, vol: 0.25, attack: 0.1 });
    if (!o) return;
    const lfo = ctx.createOscillator(); const lg = ctx.createGain();
    lfo.frequency.value = 9; lg.gain.value = 120;
    lfo.connect(lg).connect(o.frequency); lfo.start(); lfo.stop(ctx.currentTime + 1.6);
  },
  tornado() { noise({ dur: 2, vol: 0.4, f0: 200, f1: 900, q: 0.7, attack: 0.3 }); },
  cheer(big = false) {
    noise({ dur: big ? 2.6 : 1.6, vol: big ? 0.35 : 0.22, f0: 1400, f1: 1100, q: 0.6, attack: 0.25 });
    for (let i = 0; i < (big ? 18 : 8); i++) noise({ dur: 0.04, vol: 0.12, type: 'highpass', f0: 2000, delay: 0.2 + Math.random() * (big ? 2 : 1.2) });
  },
  groan() { tone({ type: 'sawtooth', f0: 220, f1: 140, dur: 1.1, vol: 0.12, attack: 0.15 }); noise({ dur: 1, vol: 0.12, type: 'lowpass', f0: 500, f1: 300, attack: 0.2 }); },
  fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone({ type: 'square', f0: f, dur: i === 5 ? 0.5 : 0.14, vol: 0.12, delay: i * 0.13 })); },
  buy() { tone({ type: 'square', f0: 1319, dur: 0.06, vol: 0.12 }); tone({ type: 'square', f0: 1760, dur: 0.15, vol: 0.12, delay: 0.06 }); },
  nope() { tone({ type: 'square', f0: 160, dur: 0.18, vol: 0.15 }); },
};
