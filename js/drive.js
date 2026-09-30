// Driving with a locked, near-top-down camera. Two modes:
//   cruise: get in a car at the cabin and drive the home loop (and its side roads), park when done
//   race:   touge battle on a race course vs rivals in cars with exactly your car's numbers;
//           difficulty only changes how good their racing line is and how hard they commit to it
import * as THREE from '../lib/three.module.min.js';
import { ROAD_HALF, RAIL_OFFSET, HOME_NET, COURSES, lineVariant } from './road.js';
import { getWorld, makeCarMesh, inHome } from './world3d.js';
import { PROBLEM_THRESHOLD } from './data.js';
import { clamp } from './state.js';
import { carSound, unlockAudio, isMuted, setMuted, gearFor } from './audio.js';
import { getRetro } from './ps1.js';

const G = 9.81;
const WHEELBASE = 2.5;
const CAR_HALF_W = 0.95;
const CAR_LEN = 4.4;
const MPH = 2.237;
const RIVAL_COLORS = ['#f5f6fa', '#e84118', '#9c88ff', '#fbc531', '#00a8ff', '#4cd137'];
// Rivals get colors clearly different from yours so you can always tell who's who.
function rivalColors(mine) {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const m = rgb(mine);
  return RIVAL_COLORS.filter((c) => { const r = rgb(c); return Math.hypot(r[0] - m[0], r[1] - m[1], r[2] - m[2]) > 120; });
}
const HB_RADIUS = 15; // rivals pull the handbrake where their line is tighter than this

// Locked camera: close above and just behind the car, tilted enough off vertical to see its rear,
// with a wide 90° field of view. (Looking ~60° down: the car sits in the lower third of the screen.)
const CAM = { height: 8.5, back: 2.0, ahead: 2.9, fov: 90, fovLandscape: 75 };

let retro = null, world = null, camera = null;

function ensure3D(canvas, net) {
  if (!retro) {
    retro = getRetro(canvas);
    camera = new THREE.PerspectiveCamera(90, 1, 0.3, 900);
  }
  world = getWorld(net);
}

// Convert game stats (from state.performance) to SI units for this sim.
export function carSpec(perf) {
  return {
    top: perf.topSpeed * 0.075,  // m/s
    accel: perf.accel * 0.028,   // m/s^2 at low speed
    brake: 9.0 * perf.brake,     // m/s^2
    lat: 9.5 * perf.grip,        // m/s^2 lateral grip on asphalt
    drive: perf.drive,
  };
}

// Rival lines are cached per course and line quality.
const lineCache = new Map();
function getLine(road, key, q) {
  const k = `${key}:${q}`;
  if (!lineCache.has(k)) lineCache.set(k, lineVariant(road, q));
  return lineCache.get(k);
}

export function startDrive({ canvas, hud, car, perf, rivalBase, mode, event, difficulty, parked = [], spot, onExit }) {
  unlockAudio();
  const race = mode === 'race';
  const net = race ? COURSES[event.course] : HOME_NET;
  ensure3D(canvas, net);
  const scene = world.scene;
  const spec = carSpec(perf);
  const road = net.road, S = road.samples, SN = S.length;
  const sampleAtS = (v) => road.sampleAtS(v);
  const route = race ? { from: net.startS, to: net.finishS } : null;
  const night = !!(race && event.night);

  // ---- racing line helpers (for the rivals) ----
  function lineIndexAt(line, d) {
    const LP = line.pts, LN = LP.length;
    d = road.loop ? ((d % line.length) + line.length) % line.length : Math.max(0, Math.min(line.length - 0.001, d));
    let lo = 0, hi = LN - 1;
    while (lo < hi) { const mm = (lo + hi + 1) >> 1; if (LP[mm].d <= d) lo = mm; else hi = mm - 1; }
    return { i: lo, t: LP[lo].seg > 0 ? Math.min(1, (d - LP[lo].d) / LP[lo].seg) : 0 };
  }
  function lineDAtS(line, v) {
    const p = sampleAtS(v);
    const next = S[Math.min(p.i + 1, SN - 1)];
    const segS = next.s - S[p.i].s || 1;
    return line.pts[p.i].d + Math.max(0, Math.min(1, (v - S[p.i].s) / segS)) * line.pts[p.i].seg;
  }
  // Speed a rival can carry at each point of its line: cornering limit (how much of the grip it
  // commits to) plus braking zones, which account for the slope.
  function speedProfile(line, rs, commit, brakeCommit = commit) {
    const LP = line.pts, LN = LP.length;
    const lat = rs.lat * commit, top = rs.top;
    const v = LP.map((p) => Math.min(top, Math.sqrt(lat / Math.max(p.k, 1e-4))));
    const passes = road.loop ? 2 : 1;
    for (let pass = 0; pass < passes; pass++) {
      for (let j = (road.loop ? 2 * LN : LN - 1) - 1; j >= 0; j--) {
        const i = j % LN, n = road.loop ? (i + 1) % LN : Math.min(i + 1, LN - 1);
        const dec = Math.max(2.5, rs.brake * brakeCommit + G * S[i].grade);
        v[i] = Math.min(v[i], Math.sqrt(v[n] * v[n] + 2 * dec * LP[i].seg));
      }
    }
    return v;
  }
  world.setNight(night);
  world.skids.clear();
  const added = [];
  const addMesh = (o) => { scene.add(o); added.push(o); return o; };

  // ---- player ----
  const P = { x: 0, z: 0, h: 0, vx: 0, vz: 0, steer: 0, hint: -1, e: 0, pitch: 0, roll: 0, drifting: false, sAbs: 0, lastL: null, lastR: null, slip: 0 };
  if (race) {
    // You start behind the rivals and have to get past.
    const st = sampleAtS(route.from - 11);
    P.x = st.x; P.z = st.z;
    P.h = Math.atan2(st.tz, st.tx);
    P.hint = st.i;
    P.sAbs = route.from - 11;
  } else {
    P.x = spot.x; P.z = spot.z; P.h = Math.PI / 2; // backed in, facing the road
    P.sAbs = road.nearest(P.x, P.z).s;
  }
  const playerMesh = makeCarMesh(car.color, car.modelId);
  playerMesh.beam.intensity = night ? 400 : 0;
  addMesh(playerMesh.group);
  for (const pc of parked) {
    const mm = makeCarMesh(pc.car.color, pc.car.modelId);
    mm.group.position.set(pc.x, 0, pc.z);
    mm.group.rotation.set(0, -Math.PI / 2, 0);
    addMesh(mm.group);
  }

  // ---- rivals: exactly your car (power-to-weight, grip, brakes). Difficulty = line + commitment ----
  const rivals = [];
  if (race) {
    const rs = carSpec(rivalBase || perf);
    (window.__krNoRivals ? [] : difficulty.rivals).forEach((name, i) => { // test hook: solo time trial
      // The second rival is a touch less sharp than the first.
      const q = Math.max(0, difficulty.line - i * 0.05);
      const jitter = (i ? 0.985 : 1) * (0.995 + Math.random() * 0.01);
      const commit = difficulty.commit * jitter, brakeCommit = difficulty.brake * jitter;
      const line = getLine(road, net.id, q);
      const palette = rivalColors(car.color);
      const mesh = makeCarMesh(palette[i % palette.length], car.modelId); // one-make race: same car as yours
      mesh.beam.intensity = night ? 400 : 0;
      addMesh(mesh.group);
      const s0 = route.from - 2;
      rivals.push({
        name, spec: rs, skill: brakeCommit, line, prof: speedProfile(line, rs, commit, brakeCommit), mesh,
        d: lineDAtS(line, s0), sAbs: s0, v: 0, pass: 0, passTarget: 0, startLat: i === 0 ? -2.1 : 2.1, curLat: 0,
        yawOff: 0, finished: false, finishT: 0, x: 0, z: 0, e: 0, h: 0, hb: false, lastL: null, lastR: null,
        mistakeT: 0, mistakeOff: 0,
      });
    });
  }

  // ---- state ----
  const wear = { engine: 0, trans: 0, susp: 0, brakes: 0, tires: 0, body: 0 };
  const input = { left: false, right: false, gas: false, brake: false, hb: false, axis: null };
  let time = race ? -3.2 : 0.01;
  let done = false, raf = 0, last = performance.now();
  let message = '', messageT = 0, noPowerT = 0, engineBlown = false, blownT = 0, hitCool = 0, place = 0;
  const flash = (msg, t = 1.5) => { message = msg; messageT = t; };
  if (!race) flash('Drive down the lane to the road', 2.5);
  const sound = carSound();

  // ---- input ----
  const keyMap = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'gas', w: 'gas', arrowdown: 'brake', s: 'brake', ' ': 'hb', shift: 'hb' };
  const onKey = (e) => { const k = keyMap[e.key.toLowerCase()]; if (!k) return; input[k] = e.type === 'keydown'; e.preventDefault(); };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  const pointers = new Map();
  const ctlButtons = hud.querySelectorAll('[data-ctl]');
  const syncInput = () => {
    for (const k of ['left', 'right', 'gas', 'brake', 'hb']) input[k] = false;
    for (const k of pointers.values()) input[k] = true;
    ctlButtons.forEach((b) => b.classList.toggle('on', input[b.dataset.ctl]));
  };
  const down = (e) => { const b = e.target.closest('[data-ctl]'); if (!b) return; e.preventDefault(); pointers.set(e.pointerId, b.dataset.ctl); syncInput(); };
  const up = (e) => { if (pointers.delete(e.pointerId)) syncInput(); };
  hud.addEventListener('pointerdown', down);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  const exitBtn = hud.querySelector('[data-exit]');
  exitBtn.textContent = race ? 'Retire' : '🏠 Park';
  const onExitBtn = () => finish(race);
  exitBtn.addEventListener('click', onExitBtn);
  const muteBtn = hud.querySelector('[data-mute]');
  const showMute = () => { muteBtn.textContent = isMuted() ? '🔇' : '🔊'; };
  const onMute = () => { unlockAudio(); setMuted(!isMuted()); showMute(); };
  showMute();
  muteBtn.addEventListener('click', onMute);
  hud.classList.toggle('cruise', !race);

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    void dpr;
    retro.resize();
    camera.aspect = retro.aspect;
    camera.fov = camera.aspect < 0.8 ? CAM.fov : CAM.fovLandscape;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  // Which road surface is the car on, and how far can it go sideways before a rail/tree/barrier?
  const home = (x, z) => net.home && inHome(x, z);
  function where(x, z) {
    const m = road.nearest(x, z, P.hint);
    const mainLimit = net.isRailed(m.s, Math.sign(m.lat) || 1) ? ROAD_HALF + RAIL_OFFSET - CAR_HALF_W : ROAD_HALF + 4.5;
    const mainOk = Math.abs(m.lat) <= mainLimit && m.dist < mainLimit + 2 && !m.pastEnd;
    let best = { kind: 'main', m, lat: m.lat, dist: m.dist, limit: mainLimit, asphalt: Math.abs(m.lat) <= ROAD_HALF && m.dist < 12, valid: mainOk };
    for (const b of net.branches) {
      const nb = b.nearest(x, z, -1);
      if (nb.dist > 40) continue;
      const ok = Math.abs(nb.lat) <= b.half + 1.5 && !nb.pastEnd;
      // Prefer the side road when you're on it (or when it's the only valid place you could be).
      if ((ok && (!mainOk || nb.dist < m.dist)) || (!mainOk && nb.dist < m.dist)) {
        best = { kind: 'branch', m, b, nb, lat: nb.lat, dist: nb.dist, limit: b.half + 1.5, asphalt: false, pastEnd: nb.pastEnd, e: nb.p.e, valid: ok };
      }
    }
    if (m.pastEnd && best.kind === 'main') best.pastEnd = true;
    if (home(x, z)) best.valid = true;
    return best;
  }

  // ---- physics ----
  function stepPlayer(dt) {
    const w0 = where(P.x, P.z);
    P.hint = w0.m.i;
    const atHome = home(P.x, P.z);
    const surf = w0.asphalt ? { grip: 1, drag: 0 } : atHome || w0.kind === 'branch' ? { grip: 0.75, drag: 0.25 } : { grip: 0.6, drag: 0.9 };
    const rs = sampleAtS(w0.m.s);

    const target = typeof input.axis === 'number' ? clamp(input.axis, -1, 1) : (input.right ? 1 : 0) - (input.left ? 1 : 0);
    P.steer += (target - P.steer) * Math.min(1, dt * 9);
    let fx = Math.cos(P.h), fz = Math.sin(P.h);
    let vf = P.vx * fx + P.vz * fz;
    const speed = Math.hypot(P.vx, P.vz);
    const hb = input.hb && time > 0;
    const latCap = spec.lat * surf.grip * (hb ? 0.45 : 1);

    // Kinematic yaw from steering, capped by what the tires can hold. On power (RWD) or with the
    // handbrake pulled the rear lets go and the car can rotate further than grip alone allows.
    const maxAngle = (hb ? 0.75 : 0.6) / (1 + speed / 16);
    let yaw = (vf / WHEELBASE) * Math.tan(P.steer * maxAngle) * (hb ? 1.8 : 1);
    let k = 1.25;
    if (input.gas && spec.drive === 'RWD') k = 1.6;
    if (input.gas && spec.drive === 'FWD') k = 1.05;
    if (hb) k = 3.2;
    const yawCap = (spec.lat * surf.grip * k) / Math.max(Math.abs(vf), 4);
    yaw = clamp(yaw, -yawCap, yawCap);
    P.h += yaw * dt;

    fx = Math.cos(P.h); fz = Math.sin(P.h);
    const rx = -fz, rz = fx;
    vf = P.vx * fx + P.vz * fz;
    let vl = P.vx * rx + P.vz * rz;

    const canPower = time > 0 && !engineBlown && noPowerT <= 0;
    if (input.gas && canPower) {
      vf += spec.accel * Math.max(0, 1 - (vf / spec.top) ** 2) * dt * (hb ? 0.4 : 1);
      wear.engine += dt * 0.12 * (1 + 0.6 * car.upgrades.turbo);
      wear.trans += dt * 0.06;
    }
    if (input.brake && time > 0) {
      if (vf > 0.5) { vf = Math.max(0, vf - spec.brake * surf.grip * dt); if (speed > 8) wear.brakes += dt * 0.4; }
      else vf = Math.max(-5, vf - 3 * dt);
    }
    if (hb && vf > 0) vf = Math.max(0, vf - 3.5 * dt);
    // Gravity along the slope: uphill slows you, downhill pulls you.
    if (!atHome || w0.asphalt) vf -= G * rs.grade * (fx * rs.tx + fz * rs.tz) * dt;
    vf -= vf * (0.012 + (input.gas ? 0 : 0.06) + surf.drag) * dt;
    if (time <= 0) vf = 0;

    // Lateral grip: what the tires can't cancel becomes a slide.
    const cap = latCap * dt;
    P.drifting = (Math.abs(vl) > 1.3 && speed > 5) || (hb && speed > 4);
    if (Math.abs(vl) <= cap) vl = 0; else vl -= Math.sign(vl) * cap;
    if (P.drifting) { vf -= vf * 0.1 * dt; wear.tires += (Math.abs(vl) + (hb ? 2 : 0)) * dt * 0.02; }
    wear.tires += speed * dt * 0.0004;
    if (!w0.asphalt && !atHome && w0.kind !== 'branch' && speed > 3) wear.susp += dt * 0.6;
    P.slip = clamp(Math.abs(vl) / 6 + (hb && speed > 4 ? 0.5 : 0), 0, 1);

    P.vx = fx * vf + rx * vl;
    P.vz = fz * vf + rz * vl;
    const ox = P.x, oz = P.z;
    P.x += P.vx * dt; P.z += P.vz * dt;

    // Stay on something drivable: slide along rails, bounce off barriers / cabin edges.
    const w1 = where(P.x, P.z);
    if (!w1.valid) {
      let into = speed;
      if (w1.kind === 'main' && !home(ox, oz) && !w1.pastEnd) {
        const sp = w1.m.p, sg = Math.sign(w1.lat), over = Math.abs(w1.lat) - w1.limit;
        P.x -= sp.nx * over * sg; P.z -= sp.nz * over * sg;
        into = (P.vx * sp.nx + P.vz * sp.nz) * sg;
        if (into > 0) { P.vx -= sp.nx * sg * into * 1.25; P.vz -= sp.nz * sg * into * 1.25; }
        P.vx *= 0.9; P.vz *= 0.9;
      } else {
        P.x = ox; P.z = oz; P.vx *= -0.25; P.vz *= -0.25;
      }
      if (into > 3 && hitCool <= 0) {
        const railed = w1.kind === 'main' && net.isRailed(w1.m.s, Math.sign(w1.lat));
        wear.body += into * 0.5; wear.susp += into * 0.15;
        flash(w1.pastEnd ? 'ROAD CLOSED' : railed ? 'GUARDRAIL!' : 'Into the trees!', 0.8);
        sound.hit(into); hitCool = 0.5;
      }
    }

    // Progress along the loop (unwrapped), elevation and body attitude.
    const w2 = where(P.x, P.z);
    P.hint = w2.m.i;
    P.sAbs += road.wrapDelta(w2.m.s - P.sAbs);
    const onBranch = w2.kind === 'branch';
    const inYard = home(P.x, P.z) && Math.abs(w2.m.lat) > ROAD_HALF + 2;
    const eTarget = inYard ? 0 : onBranch ? w2.e : sampleAtS(w2.m.s).e;
    P.e += (eTarget - P.e) * Math.min(1, dt * 12);
    const gAlong = inYard ? 0 : rs.grade * (fx * rs.tx + fz * rs.tz);
    P.pitch += (Math.atan(gAlong) - P.pitch) * Math.min(1, dt * 6);
    P.roll += (clamp(-vl * 0.012 - P.steer * speed * 0.0015, -0.08, 0.08) - P.roll) * Math.min(1, dt * 5);

    // Skid marks from the rear wheels.
    if (P.drifting || (input.brake && speed > 12)) {
      const bx = P.x - fx * 1.35, bz = P.z - fz * 1.35;
      const L = [bx - rx * 0.8, bz - rz * 0.8], R = [bx + rx * 0.8, bz + rz * 0.8];
      if (P.lastL) { world.skids.add(P.lastL[0], P.lastL[1], L[0], L[1], P.e); world.skids.add(P.lastR[0], P.lastR[1], R[0], R[1], P.e); }
      P.lastL = L; P.lastR = R;
    } else P.lastL = P.lastR = null;

    // Failures from running bad parts hard.
    const engNow = car.cond.engine - wear.engine;
    if (!engineBlown && input.gas && time > 0 && engNow < 25 && Math.random() < dt * 0.025 * (25 - engNow) / 5) {
      engineBlown = true; blownT = 2.5; wear.engine = car.cond.engine; flash('💥 ENGINE BLEW!', 3);
    }
    if (noPowerT <= 0 && input.gas && time > 0 && car.cond.trans - wear.trans < PROBLEM_THRESHOLD && Math.random() < dt * 0.12) {
      noPowerT = 0.9; flash('Popped out of gear!', 1);
    }
  }

  // Rivals drive the racing line flat out to their skill level, pull the handbrake through the
  // tightest hairpins, and try to go around you if you're in the way.
  function stepRivals(dt) {
    if (time <= 0) { for (const r of rivals) placeRival(r, 0); return; }
    const playerLat = road.nearest(P.x, P.z, P.hint).lat;
    const playerV = Math.hypot(P.vx, P.vz);
    for (const r of rivals) {
      const { i } = lineIndexAt(r.line, r.d);
      if (r.finished) r.v = Math.max(0, r.v - 6 * dt);
      else {
        let target = r.prof[i];
        // Now and then a rival gets a corner wrong: runs wide and scrubs speed, opening the inside.
        const lp = r.line.pts[i];
        if (r.mistakeT > 0) r.mistakeT -= dt;
        else if (time > 4 && lp.k > 1 / 35 && Math.random() < dt / difficulty.mistakeEvery) {
          r.mistakeT = 1.6 + Math.random() * 0.8;
          r.mistakeOff = -Math.sign(lp.kSigned) * (1.6 + Math.random());
          if (Math.hypot(r.x - P.x, r.z - P.z) < 45) flash(`${r.name} ran wide!`, 1.2);
        }
        if (r.mistakeT > 0) target *= 0.82;
        // Don't drive through whoever is in front: follow, and look for a way past.
        const ahead = [{ sAbs: P.sAbs, lat: playerLat, v: playerV }, ...rivals.filter((o) => o !== r).map((o) => ({ sAbs: o.sAbs, lat: o.curLat, v: o.v }))];
        r.passTarget = 0;
        // Racing room: if you're alongside, they hold a car's width off you instead of driving into you.
        const side = P.sAbs - r.sAbs;
        if (Math.abs(side) < 4.5 && Math.abs(playerLat - r.curLat) < 2.4) {
          r.passTarget = clamp(playerLat + (r.curLat >= playerLat ? 2.4 : -2.4), -ROAD_HALF + 1, ROAD_HALF - 1) - (r.curLat - r.pass);
        }
        for (const b of ahead) {
          const gap = b.sAbs - r.sAbs;
          if (gap > 0 && gap < 9 && Math.abs(b.lat - r.curLat) < 2.3) {
            target = Math.min(target, b.v + (gap - 5.5) * 1.5);
            r.passTarget = b.lat > r.curLat ? -2.4 : 2.4; // go for the other side
          }
        }
        if (r.mistakeT > 0) r.passTarget += r.mistakeOff;
        const a = r.spec.accel * Math.max(0, 1 - (r.v / r.spec.top) ** 2) - G * S[i].grade - 0.012 * r.v;
        if (r.v < target) r.v = Math.min(target, r.v + Math.max(a, 0.3) * dt);
        else r.v = Math.max(target, r.v - r.spec.brake * r.skill * dt);
        r.v = Math.max(0, r.v);
      }
      r.pass += (r.passTarget - r.pass) * Math.min(1, dt * 1.5);
      r.d += r.v * dt;
      placeRival(r, dt);
      if (!r.finished && r.sAbs - route.from >= route.to - route.from) { r.finished = true; r.finishT = time; }

      // Contact with the player (point vs the rival's box, resolved along the shallower axis).
      const ch = Math.cos(r.h), sh = Math.sin(r.h);
      const dx = P.x - r.x, dz = P.z - r.z;
      const lx = dx * ch + dz * sh, lz = -dx * sh + dz * ch;
      if (Math.abs(lx) < CAR_LEN && Math.abs(lz) < 1.9) {
        const penX = CAR_LEN - Math.abs(lx), penZ = 1.9 - Math.abs(lz);
        if (penZ < penX) {
          // Side by side: both cars get pushed apart.
          const sg = Math.sign(lz) || 1; P.x += -sh * sg * penZ * 0.55; P.z += ch * sg * penZ * 0.55;
          const latSide = Math.sign(r.curLat - road.nearest(P.x, P.z, P.hint).lat) || -sg;
          r.pass = clamp(r.pass + latSide * penZ * 0.45, -3.2, 3.2);
        }
        else { const sg = Math.sign(lx) || 1; P.x += ch * sg * penX; P.z += sh * sg * penX; }
        P.vx *= 0.95; P.vz *= 0.95; r.v *= 0.97;
        if (hitCool <= 0) { wear.body += 0.8; hitCool = 0.5; flash('Contact!', 0.6); sound.hit(3); }
      }
    }
  }

  function placeRival(r, dt) {
    const LP = r.line.pts, LN = LP.length;
    const { i, t } = lineIndexAt(r.line, r.d);
    const nxt = road.loop ? (i + 1) % LN : Math.min(i + 1, LN - 1);
    const a = LP[i], b = LP[nxt], c = S[i], c2 = S[nxt];
    // Start grid: blend from the grid slot onto the racing line over the first ~40 m.
    const blend = clamp((r.sAbs - (route.from - 2)) / 40, 0, 1);
    const lineLat = a.off + (b.off - a.off) * t;
    const lat = clamp((1 - blend) * r.startLat + blend * lineLat + r.pass, -ROAD_HALF + 1, ROAD_HALF - 1);
    r.curLat = lat;
    r.x = c.x + (c2.x - c.x) * t + c.nx * lat;
    r.z = c.z + (c2.z - c.z) * t + c.nz * lat;
    r.e = c.e + (c2.e - c.e) * t;
    const path = nxt === i ? Math.atan2(c.tz, c.tx) : Math.atan2(b.z - a.z, b.x - a.x);
    // Handbrake through the tightest hairpins: body rotates into the corner, rear lights flare.
    r.hb = !r.finished && a.k > 1 / HB_RADIUS && r.v > 5;
    const want = r.hb ? Math.sign(a.kSigned) * 0.5 : 0;
    r.yawOff += (want - r.yawOff) * Math.min(1, dt * 4);
    r.h = path + r.yawOff;
    const sNew = c.s + t * (road.loop ? (((c2.s - c.s) % road.length) + road.length) % road.length : c2.s - c.s);
    r.sAbs += road.wrapDelta(sNew - r.sAbs);
    if (r.hb && dt > 0) {
      const fx = Math.cos(r.h), fz = Math.sin(r.h), rx = -fz, rz = fx;
      const bx = r.x - fx * 1.35, bz = r.z - fz * 1.35;
      const L = [bx - rx * 0.8, bz - rz * 0.8], R = [bx + rx * 0.8, bz + rz * 0.8];
      if (r.lastL) { world.skids.add(r.lastL[0], r.lastL[1], L[0], L[1], r.e); world.skids.add(r.lastR[0], r.lastR[1], R[0], R[1], r.e); }
      r.lastL = L; r.lastR = R;
    } else r.lastL = r.lastR = null;
  }

  const progress = () => P.sAbs - route.from;

  // ---- rendering ----
  function place3D(group, x, e, z, h, pitch, roll = 0) {
    group.position.set(x, e, z);
    group.rotation.set(roll, -h, pitch);
  }

  function render() {
    place3D(playerMesh.group, P.x, P.e, P.z, P.h, P.pitch, P.roll);
    playerMesh.tail.color.set(input.brake || input.hb ? '#ffffff' : night ? '#c07070' : '#8a5a5a');
    for (const r of rivals) {
      place3D(r.mesh.group, r.x, r.e, r.z, r.h, Math.atan(S[lineIndexAt(r.line, r.d).i].grade));
      r.mesh.tail.color.set(r.hb ? '#ffffff' : night ? '#c07070' : '#8a5a5a');
    }
    if (world.fire) world.fire.light.intensity = 26 + Math.sin(time * 13) * 6 + Math.sin(time * 7.7) * 4;

    // Locked camera: rigidly aligned with the car, high above and slightly behind.
    const cx = Math.cos(P.h), cz = Math.sin(P.h);
    camera.position.set(P.x - cx * CAM.back, P.e + CAM.height, P.z - cz * CAM.back);
    camera.lookAt(P.x + cx * CAM.ahead, P.e, P.z + cz * CAM.ahead);
    world.follow(camera);
    retro.render(scene, camera);
    drawMinimap();
    sound.update({ speed: Math.hypot(P.vx, P.vz), top: spec.top, throttle: input.gas && time > 0 && !engineBlown ? 1 : 0, slip: P.slip });
  }

  // Minimap (2D) of the loop and its side roads, with this race's route highlighted.
  const mini = hud.querySelector('[data-minimap]');
  const mctx = mini.getContext('2d');
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  for (const p of [...S, ...net.branches.flatMap((b) => b.samples)]) { bx0 = Math.min(bx0, p.x); bx1 = Math.max(bx1, p.x); bz0 = Math.min(bz0, p.z); bz1 = Math.max(bz1, p.z); }
  function drawMinimap() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = mini.clientWidth * dpr, H = mini.clientHeight * dpr;
    if (mini.width !== W) { mini.width = W; mini.height = H; }
    const sc = Math.min((W - 12 * dpr) / (bx1 - bx0), (H - 12 * dpr) / (bz1 - bz0));
    const ox = (W - (bx1 - bx0) * sc) / 2, oz = (H - (bz1 - bz0) * sc) / 2;
    const X = (x) => ox + (x - bx0) * sc, Z = (z) => oz + (z - bz0) * sc;
    mctx.clearRect(0, 0, W, H);
    mctx.lineJoin = 'round';
    const path = (pts, closed) => {
      mctx.beginPath();
      pts.forEach((p, i) => { if (i % 3 && i !== pts.length - 1) return; if (i) mctx.lineTo(X(p.x), Z(p.z)); else mctx.moveTo(X(p.x), Z(p.z)); });
      if (closed) mctx.closePath();
      mctx.stroke();
    };
    mctx.lineWidth = 2 * dpr; mctx.strokeStyle = 'rgba(200,190,170,0.55)';
    for (const b of net.branches) path(b.samples, false);
    mctx.lineWidth = 3 * dpr; mctx.strokeStyle = 'rgba(255,255,255,0.75)';
    path(S, road.loop);
    if (race) {
      mctx.strokeStyle = '#ffd32a';
      mctx.beginPath();
      for (let s = route.from; s <= route.to; s += 8) { const q = sampleAtS(s); if (s === route.from) mctx.moveTo(X(q.x), Z(q.z)); else mctx.lineTo(X(q.x), Z(q.z)); }
      mctx.stroke();
    }
    const dot = (x, z, c, r) => { mctx.fillStyle = c; mctx.beginPath(); mctx.arc(X(x), Z(z), r * dpr, 0, 7); mctx.fill(); };
    if (net.home) { const hm = sampleAtS(road.homeS); dot(hm.x, hm.z, '#ff9f43', 3.5); }
    if (race) { const f = sampleAtS(route.to); dot(f.x, f.z, '#2ecc71', 4); }
    for (const r of rivals) dot(r.x, r.z, '#ff4d4d', 3.5);
    dot(P.x, P.z, '#fff', 4.5);
  }

  const $ = (sel) => hud.querySelector(sel);

  // GT-style tachometer: segmented rev arc with redline, big gear number and digital speed.
  const tach = hud.querySelector('[data-tach]'), tctx = tach.getContext('2d');
  let rpmShown = 900;
  function drawTach() {
    const W = 150, H = 112, sc = 2;
    if (tach.width !== W * sc || tach.height !== H * sc) { tach.width = W * sc; tach.height = H * sc; }
    const speed = Math.hypot(P.vx, P.vz);
    const g = gearFor(speed, spec.top, input.gas && time > 0 ? 1 : 0);
    rpmShown += (g.rpm - rpmShown) * 0.3;
    const c = tctx, FONT = '"Exo 2", "Arial Black", Arial, sans-serif';
    c.setTransform(sc, 0, 0, sc, 0, 0);
    c.clearRect(0, 0, W, H);
    const cx = 75, cy = 80, R = 64, a0 = Math.PI * 1.02, a1 = Math.PI * 1.98, MAX = 8000;
    c.lineWidth = 10;
    c.strokeStyle = 'rgba(5,11,34,0.7)';
    c.beginPath(); c.arc(cx, cy, R, a0, a1); c.stroke();
    for (let k = 0; k < 40; k++) {
      const rv = (k / 40) * MAX;
      const aa = a0 + (a1 - a0) * (k / 40), ab = a0 + (a1 - a0) * ((k + 0.7) / 40);
      const lit = rv < rpmShown;
      c.strokeStyle = rv >= 7000 ? (lit ? '#ff3b30' : '#6b1a16') : lit ? '#ffe14a' : '#34416a';
      c.beginPath(); c.arc(cx, cy, R, aa, ab); c.stroke();
    }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `italic 700 10px ${FONT}`; c.fillStyle = '#cfd8ea';
    for (let n = 1; n <= 8; n++) { const aa = a0 + (a1 - a0) * (n * 1000 / MAX); c.fillText(n, cx + Math.cos(aa) * (R - 15), cy + Math.sin(aa) * (R - 15)); }
    const outlined = (txt, x, y, font, fill) => { c.font = font; c.lineWidth = 4; c.strokeStyle = '#050b22'; c.strokeText(txt, x, y); c.fillStyle = fill; c.fillText(txt, x, y); };
    outlined(g.gear, cx, cy - 32, `italic 900 30px ${FONT}`, '#ffe14a');
    outlined(String(Math.round(speed * MPH)), cx - 8, cy - 4, `italic 800 22px ${FONT}`, '#ffffff');
    c.font = `italic 700 9px ${FONT}`; c.fillStyle = '#9fb0d6'; c.fillText('MPH', cx + 24, cy);
  }

  function updateHud() {
    drawTach();
    if (race) {
      const my = progress();
      const all = [{ me: true, prog: my }, ...rivals.map((r) => ({ prog: r.sAbs - route.from }))].sort((a, b) => b.prog - a.prog);
      $('[data-pos]').textContent = all.findIndex((x) => x.me) + 1;
      $('[data-pos-of]').textContent = `/${all.length}`;
      const gap = Math.max(...rivals.map((r) => r.sAbs - route.from)) - my;
      $('[data-gap]').textContent = gap > 0 ? `-${Math.round(gap)}m` : `+${Math.round(-gap)}m`;
      $('[data-gap]').style.color = gap > 0 ? 'var(--bad)' : 'var(--good)';
      $('[data-time]').textContent = time > 0 ? fmtTime(time) : '0:00.0';
      $('[data-togo]').textContent = `${Math.max(0, Math.round(route.to - route.from - my))} m to go`;
    }
    const msg = $('[data-msg]');
    if (race && time <= 0) msg.textContent = time < -2.2 ? '3' : time < -1.2 ? '2' : time < -0.2 ? '1' : 'GO!';
    else msg.textContent = messageT > 0 ? message : '';
    msg.classList.toggle('big', (race && time <= 0) || (messageT > 0 && message.length < 12));
    const eng = car.cond.engine - wear.engine, tir = car.cond.tires - wear.tires;
    $('[data-warn]').textContent = [eng < 30 && '🔧 ENGINE', tir < 30 && '🛞 TIRES'].filter(Boolean).join('  ');
  }

  function loop(now) {
    const realDt = (now - last) / 1000;
    last = now;
    const steps = window.__krSimSpeed || 1; // test hook: run the sim faster than real time
    for (let n = 0; n < steps && !done; n++) {
      const dt = Math.min(0.033, realDt);
      time += dt;
      messageT -= dt; noPowerT -= dt; hitCool -= dt;
      stepPlayer(dt / 2); stepPlayer(dt / 2);
      stepRivals(dt);
      if (engineBlown) { blownT -= dt; if (blownT <= 0) finish(true); }
      if (race && !done && progress() >= route.to - route.from) { place = 1 + rivals.filter((r) => r.finished).length; finish(false); }
    }
    render();
    updateHud();
    if (!done) raf = requestAnimationFrame(loop);
  }

  function finish(dnf) {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    cleanup();
    onExit({ mode, dnf: race ? dnf : false, place: dnf ? null : place, time, engineBlown, wear });
  }

  function cleanup() {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    window.removeEventListener('resize', resize);
    hud.removeEventListener('pointerdown', down);
    exitBtn.removeEventListener('click', onExitBtn);
    muteBtn.removeEventListener('click', onMute);
    ctlButtons.forEach((b) => b.classList.remove('on'));
    sound.stop();
    for (const o of added) scene.remove(o);
  }

  // Test/debug hook.
  window.__kr = { player: P, rivals, input, spec, wear, race, route, road, net, bestLine: road.bestLine && getLine(road, net.id, 1), sampleAtS, progress };
  raf = requestAnimationFrame(loop);
}

export function fmtTime(t) {
  const mm = Math.floor(t / 60), s = t - mm * 60;
  return `${mm}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}
