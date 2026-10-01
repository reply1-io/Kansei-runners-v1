// Synthesized car sounds with the Web Audio API (no sound files): engine (synthesized exhaust-pulse
// loops crossfaded by rpm), intake, tire squeal, impacts.
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
      // Limiter on the way out, so loud moments (turbo flutter, crashes) never clip and crackle.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -1.5; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.12;
      master.connect(limiter); limiter.connect(ctx.destination);
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

// A looping buffer of white noise, shared by the exhaust, intake and tire sounds.
let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  return src;
}

// ---- Engine: synthesized exhaust recordings ----
// Like a racing game's engine sounds, but rendered in code instead of recorded: at a few rpm points
// we build a short loop of the actual exhaust pulses (one pressure "thump" plus a little noise per
// cylinder firing, each cylinder slightly different), run through the resonances of an exhaust pipe.
// While driving, the loops play sped up or slowed down to the current rpm and crossfade between
// neighbours, so the pipe's character stays put while the firing rate changes, as in a real car.
const LOOP_RPMS = [1000, 2600, 4800, 7400];
const loopCache = {};

// RBJ bandpass (0 dB peak) over a whole buffer.
function bandpass(x, sr, f, q) {
  const w = (2 * Math.PI * f) / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
  const b0 = al / a0, b2 = -al / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - al) / a0;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

function renderEngineLoop(cyl, rpm) {
  const sr = ctx.sampleRate;
  const cycle = 120 / rpm;                             // one 4-stroke cycle (two revolutions)
  const cycles = Math.max(4, Math.round(0.5 / cycle)); // ~half a second, so the loop isn't a buzz
  const len = Math.round(cycles * cycle * sr), fires = cycles * cyl, gap = len / fires;
  // Each cylinder has its own strength and slightly uneven spacing: that's what makes it burble.
  let seed = 1234 + cyl * 77;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cylAmp = [], cylOff = [];
  for (let c = 0; c < cyl; c++) { cylAmp.push(0.78 + rnd() * 0.44); cylOff.push((rnd() - 0.5) * 0.12); }
  const perFire = [];
  for (let f = 0; f < fires; f++) perFire.push([0.88 + rnd() * 0.24, (rnd() - 0.5) * 0.04]);
  // Pulses get sharper at high rpm.
  const hard = Math.min(1, rpm / 7400);
  const tr = 0.0004, td = 0.0032 - 0.0016 * hard, tn = 0.0018;
  const pulseLen = Math.round(0.012 * sr);
  const x = new Float32Array(len * 2);
  for (let pass = 0; pass < 2; pass++) {             // render twice and keep the 2nd: a seamless loop
    let ns = 99;
    const nr = () => ((ns = (ns * 48271) % 2147483647) / 2147483647) * 2 - 1;
    for (let f = 0; f < fires; f++) {
      const c = f % cyl, [amp, jit] = perFire[f];
      const t0 = Math.round(pass * len + (f + cylOff[c] + jit) * gap);
      const A = cylAmp[c] * amp;
      for (let i = 0; i < pulseLen; i++) {
        const u = i / sr, j = t0 + i;
        if (j >= 0 && j < x.length) x[j] += A * (Math.exp(-u / td) - Math.exp(-u / tr) + 0.35 * nr() * Math.exp(-u / tn));
      }
    }
  }
  // Exhaust pipe and muffler: a few broad resonances, plus a bit of rasp up top.
  const bands = [[85, 1.1, 1.0], [170, 1.4, 0.7], [340, 1.8, 0.45], [620, 1.6, 0.25], [1500, 1.0, 0.08 + 0.1 * hard]];
  const y = new Float32Array(x.length);
  for (const [f, q, g] of bands) { const b = bandpass(x, sr, f, q); for (let i = 0; i < y.length; i++) y[i] += b[i] * g; }
  const out = y.subarray(len, len * 2);
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (out[i] / (peak || 1)) * 0.9;
  return buf;
}

const engineLoops = (cyl) => loopCache[cyl] || (loopCache[cyl] = LOOP_RPMS.map((r) => renderEngineLoop(cyl, r)));

// One car's worth of sound. update() is called every frame with the car's state.
// cyl: cylinder count (an inline-6 fires 1.5x as often as a 4 at the same rpm, so it sounds smoother).
// turbo: true for factory-turbo cars and cars with a turbo kit: lifting off after building boost
// gives a compressor-surge flutter ("stu-tu-tu-tu").
export function carSound({ cyl = 4, turbo = false } = {}) {
  if (!ctx) return { update() {}, hit() {}, stop() {} };
  const t0 = ctx.currentTime;
  const out = ctx.createGain(); out.gain.value = 0; out.connect(master);
  out.gain.setTargetAtTime(1, t0, 0.3);

  // Engine: the rpm loops -> load filter (bright on throttle, muffled off it) -> level.
  const load = ctx.createBiquadFilter(); load.type = 'lowpass'; load.Q.value = 0.6; load.frequency.value = 1200;
  const engG = ctx.createGain(); engG.gain.value = 0;
  load.connect(engG); engG.connect(out);
  const loops = engineLoops(cyl).map((buffer) => {
    const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(g); g.connect(load);
    return { src, g };
  });

  // Intake: a soft whoosh on throttle.
  const intake = noise();
  const inBp = ctx.createBiquadFilter(); inBp.type = 'bandpass'; inBp.Q.value = 0.8;
  const inG = ctx.createGain(); inG.gain.value = 0;
  intake.connect(inBp); inBp.connect(inG); inG.connect(out);

  // Tire squeal: narrow-band noise, like rubber scrubbing, not a whistle.
  const tire = noise();
  const tBp = ctx.createBiquadFilter(); tBp.type = 'bandpass'; tBp.frequency.value = 1150; tBp.Q.value = 6;
  const tBp2 = ctx.createBiquadFilter(); tBp2.type = 'bandpass'; tBp2.frequency.value = 1700; tBp2.Q.value = 5;
  const tG = ctx.createGain(); tG.gain.value = 0;
  tire.connect(tBp); tire.connect(tBp2); tBp.connect(tG); tBp2.connect(tG); tG.connect(out);

  const srcs = [...loops.map((l) => l.src), intake, tire];
  for (const o of srcs) o.start(t0);

  // Turbo flutter: a cute, soft, unhurried "stu... tu... tu... tu". A tiny breath of air, then a few
  // rounded puffs (slow swell in and out, no sharp edges), each gliding down a little in pitch like a
  // soft "tu". Rolled off above ~1.6 kHz.
  function flutter(strength) {
    const now = ctx.currentTime, src = noise();
    const tu = ctx.createBiquadFilter(); tu.type = 'bandpass'; tu.Q.value = 1.6;
    const soft = ctx.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 1600; soft.Q.value = 0.4;
    const tuG = ctx.createGain(), g = ctx.createGain();
    tuG.gain.value = 2.6; g.gain.value = 0;
    src.connect(tu); tu.connect(tuG); tuG.connect(soft); soft.connect(g); g.connect(out);
    // "s": a tiny, soft breath first.
    const hiss = noise(), hb = ctx.createBiquadFilter(), hg = ctx.createGain();
    hb.type = 'bandpass'; hb.frequency.value = 1500; hb.Q.value = 0.7; hg.gain.value = 0;
    hiss.connect(hb); hb.connect(hg); hg.connect(out);
    hg.gain.setValueAtTime(0, now); hg.gain.linearRampToValueAtTime(0.025 * strength, now + 0.04); hg.gain.setTargetAtTime(0, now + 0.05, 0.03);
    hiss.start(now); hiss.stop(now + 0.25);
    // "tu... tu... tu...": slow, rounded puffs.
    let t = now + 0.09, gap = 0.13;
    const n = 4 + Math.round(strength * 2);
    for (let k = 0; k < n; k++) {
      const a = (0.32 + 0.22 * strength) * (1 - k / (n + 1.5));
      const f = 900 - k * 45;
      tu.frequency.setValueAtTime(f * 1.12, t); tu.frequency.exponentialRampToValueAtTime(f * 0.78, t + gap * 0.7);
      g.gain.setValueAtTime(0, t); g.gain.setTargetAtTime(a, t, 0.018); g.gain.setTargetAtTime(0, t + 0.05, 0.03);
      t += gap; gap *= 1.07;
    }
    src.start(now); src.stop(t + 0.15);
    engG.gain.cancelScheduledValues(now); engG.gain.setValueAtTime(engG.gain.value * 0.85, now);
    duckUntil = now + 0.25;
  }
  let duckUntil = 0;
  let boost = 0, lastT = t0, lastThr = 0;

  let rpmSm = 900, thrSm = 0;
  return {
    // speed and top in m/s, throttle 0..1, slip 0..1 (how hard the tires are sliding)
    update({ speed, top, throttle, slip }) {
      const now = ctx.currentTime;
      const { rpm } = gearFor(speed, top, throttle);
      rpmSm += (rpm - rpmSm) * 0.2;
      thrSm += (throttle - thrSm) * 0.15;
      if (turbo) {
        const dt = Math.min(0.1, now - lastT);
        // Boost builds on throttle above ~3,000 rpm and leaks away off it.
        boost = throttle > 0.5 && rpmSm > 2600 ? Math.min(1, boost + dt * 1.6) : Math.max(0, boost - dt * 0.8);
        if (lastThr > 0.5 && throttle < 0.5 && boost > 0.25) { flutter(boost); boost = 0; }
        lastT = now; lastThr = throttle;
      }
      // Crossfade the two loops either side of the current rpm (equal power, in log-rpm).
      let k = 0;
      while (k < LOOP_RPMS.length - 2 && rpmSm > LOOP_RPMS[k + 1]) k++;
      const u = Math.min(1, Math.max(0, Math.log(rpmSm / LOOP_RPMS[k]) / Math.log(LOOP_RPMS[k + 1] / LOOP_RPMS[k])));
      loops.forEach((l, i) => {
        const w = i === k ? Math.cos((u * Math.PI) / 2) : i === k + 1 ? Math.sin((u * Math.PI) / 2) : 0;
        l.g.gain.setTargetAtTime(w, now, 0.03);
        l.src.playbackRate.setTargetAtTime(rpmSm / LOOP_RPMS[i], now, 0.02);
      });
      load.frequency.setTargetAtTime(700 + thrSm * 3800 + rpmSm * 0.15, now, 0.05);
      if (now > duckUntil) engG.gain.setTargetAtTime(0.16 + thrSm * 0.2, now, 0.05);
      inBp.frequency.setTargetAtTime(300 + rpmSm * 0.12, now, 0.05);
      inG.gain.setTargetAtTime(thrSm * 0.025 * (rpmSm / 7000), now, 0.08);
      tG.gain.setTargetAtTime(Math.min(1, slip) * Math.min(1, speed / 6) * 0.2, now, 0.05);
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
      out.gain.setTargetAtTime(0, now, 0.05);
      for (const o of srcs) o.stop(now + 0.3);
    },
  };
}
