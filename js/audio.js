// Synthesized car sounds with the Web Audio API (no sound files): engine note, tire squeal, impacts.
// Browsers only allow audio after a tap, so call unlockAudio() from any user gesture.

let ctx = null, master = null;
let muted = false;
try { muted = localStorage.getItem('kr-muted') === '1'; } catch (e) { /* storage blocked */ }

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { /* audio unavailable */ }
}

export const isMuted = () => muted;
export function setMuted(on) {
  muted = on;
  try { localStorage.setItem('kr-muted', on ? '1' : '0'); } catch (e) { /* ignore */ }
  if (master) master.gain.setTargetAtTime(on ? 0 : 0.9, ctx.currentTime, 0.05);
}

// Simple 5-speed gearbox model shared by the engine sound and the tachometer.
const GEARS = [0.24, 0.4, 0.57, 0.76, 1.0];
export function gearFor(speed, top, throttle = 0) {
  const r = Math.max(0, speed) / Math.max(1, top);
  let lo = 0, g = 0;
  while (g < GEARS.length - 1 && r > GEARS[g]) { lo = GEARS[g]; g++; }
  const frac = Math.min(1, (r - lo) / (GEARS[g] - lo));
  const rpm = speed < 0.5 ? 900 + throttle * 2200 : 2600 + frac * 4700 + throttle * 300;
  return { gear: speed < 0.5 && !throttle ? 'N' : String(g + 1), rpm };
}

// One car's worth of sound. update() is called every frame with the car's state.
export function carSound() {
  if (!ctx) return { update() {}, hit() {}, stop() {} };
  const t0 = ctx.currentTime;
  // Engine: saw + square an octave down, through a throttle-controlled lowpass.
  const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
  const o2 = ctx.createOscillator(); o2.type = 'square';
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
  const eg = ctx.createGain(); eg.gain.value = 0;
  const o2g = ctx.createGain(); o2g.gain.value = 0.5;
  o1.connect(lp); o2.connect(o2g); o2g.connect(lp); lp.connect(eg); eg.connect(master);
  // Tire squeal: a wobbling triangle tone.
  const sq = ctx.createOscillator(); sq.type = 'triangle'; sq.frequency.value = 780;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 9;
  const lfoG = ctx.createGain(); lfoG.gain.value = 40;
  lfo.connect(lfoG); lfoG.connect(sq.frequency);
  const sg = ctx.createGain(); sg.gain.value = 0;
  sq.connect(sg); sg.connect(master);
  for (const o of [o1, o2, sq, lfo]) o.start(t0);

  let rpmSm = 900;
  return {
    // speed and top in m/s, throttle 0..1, slip 0..1 (how hard the tires are sliding)
    update({ speed, top, throttle, slip }) {
      const now = ctx.currentTime;
      const { rpm } = gearFor(speed, top, throttle);
      rpmSm += (rpm - rpmSm) * 0.25;
      const f = (rpmSm / 60) * 2; // 4-cylinder firing frequency
      o1.frequency.setTargetAtTime(f, now, 0.02);
      o2.frequency.setTargetAtTime(f / 2, now, 0.02);
      lp.frequency.setTargetAtTime(500 + throttle * 1800 + rpmSm * 0.15, now, 0.05);
      eg.gain.setTargetAtTime(0.05 + throttle * 0.1, now, 0.05);
      sg.gain.setTargetAtTime(Math.min(1, slip) * 0.07, now, 0.04);
    },
    hit(strength) {
      const len = 0.18, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      const g = ctx.createGain(); g.gain.value = Math.min(0.6, strength * 0.06);
      src.connect(f); f.connect(g); g.connect(master); src.start();
    },
    stop() {
      const now = ctx.currentTime;
      eg.gain.setTargetAtTime(0, now, 0.05); sg.gain.setTargetAtTime(0, now, 0.05);
      for (const o of [o1, o2, sq, lfo]) o.stop(now + 0.3);
    },
  };
}
