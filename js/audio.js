// Synthesized car sounds with the Web Audio API (no sound files): engine (tone, exhaust pulses,
// intake), tire squeal, impacts.
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

// The engine's tone, one wave per two firings. Full-order harmonics (the firing pulses) carry the
// note; weaker half-order ones make it lumpy and uneven, like a real engine rather than a buzzer.
function engineWave() {
  const N = 40, re = new Float32Array(N), im = new Float32Array(N);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let n = 1; n < N; n++) {
    const amp = n % 2 === 0 ? 1 / (n / 2) ** 1.25 : 0.45 / (n / 2) ** 1.1;
    const ph = rnd() * Math.PI * 2;
    re[n] = amp * Math.cos(ph); im[n] = amp * Math.sin(ph);
  }
  return ctx.createPeriodicWave(re, im);
}

// Soft clipping: rounds off the peaks for a little grit without the fizz of hard distortion.
function softClip(k) {
  const ws = ctx.createWaveShaper(), n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
  ws.curve = c; ws.oversample = '2x';
  return ws;
}

// One car's worth of sound. update() is called every frame with the car's state.
// cyl: cylinder count (an inline-6 fires 1.5x as often as a 4 at the same rpm, so it sounds smoother).
export function carSound({ cyl = 4 } = {}) {
  if (!ctx) return { update() {}, hit() {}, stop() {} };
  const t0 = ctx.currentTime;
  const out = ctx.createGain(); out.gain.value = 0; out.connect(master);
  out.gain.setTargetAtTime(1, t0, 0.3);

  // Engine tone -> gentle saturation -> lowpass that opens up with throttle and revs.
  const tone = ctx.createOscillator(); tone.setPeriodicWave(engineWave());
  const drive = softClip(2.2);
  const toneLp = ctx.createBiquadFilter(); toneLp.type = 'lowpass'; toneLp.Q.value = 0.5;
  const toneG = ctx.createGain(); toneG.gain.value = 0;
  tone.connect(drive); drive.connect(toneLp); toneLp.connect(toneG); toneG.connect(out);

  // Exhaust: low noise throbbing at the firing rate (each pulse a little "puff").
  const ex = noise();
  const exBp = ctx.createBiquadFilter(); exBp.type = 'lowpass'; exBp.Q.value = 0.7;
  const exPulse = ctx.createGain(); exPulse.gain.value = 0.5;
  const pulse = ctx.createOscillator(); pulse.type = 'sine';
  const pulseDepth = ctx.createGain(); pulseDepth.gain.value = 0.5;
  pulse.connect(pulseDepth); pulseDepth.connect(exPulse.gain);
  const exG = ctx.createGain(); exG.gain.value = 0;
  ex.connect(exBp); exBp.connect(exPulse); exPulse.connect(exG); exG.connect(out);

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

  const srcs = [tone, pulse, ex, intake, tire];
  for (const o of srcs) o.start(t0);

  let rpmSm = 900, thrSm = 0;
  return {
    // speed and top in m/s, throttle 0..1, slip 0..1 (how hard the tires are sliding)
    update({ speed, top, throttle, slip }) {
      const now = ctx.currentTime;
      const { rpm } = gearFor(speed, top, throttle);
      rpmSm += (rpm - rpmSm) * 0.2;
      thrSm += (throttle - thrSm) * 0.15;
      const fire = (rpmSm / 60) * (cyl / 2); // firing pulses per second
      tone.frequency.setTargetAtTime(fire / 2, now, 0.02);
      pulse.frequency.setTargetAtTime(fire, now, 0.02);
      // Brighter and louder on throttle; darker and quieter on overrun, never shrill. The filters never
      // close below ~400 Hz so the engine's body still comes through small phone speakers.
      toneLp.frequency.setTargetAtTime(Math.min(2200, 420 + fire * (2 + thrSm * 3)), now, 0.05);
      toneG.gain.setTargetAtTime(0.1 + thrSm * 0.1, now, 0.05);
      exBp.frequency.setTargetAtTime(Math.min(1000, 220 + fire * 1.6), now, 0.05);
      exG.gain.setTargetAtTime(0.14 + thrSm * 0.22, now, 0.05);
      inBp.frequency.setTargetAtTime(300 + rpmSm * 0.12, now, 0.05);
      inG.gain.setTargetAtTime(thrSm * 0.03 * (rpmSm / 7000), now, 0.08);
      tG.gain.setTargetAtTime(Math.min(1, slip) * Math.min(1, speed / 6) * 0.22, now, 0.05);
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
