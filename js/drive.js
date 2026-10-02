// Driving with a chase camera. Two modes:
//   cruise: get in a car at the cabin and drive the home loop (and its side roads), park when done
//   race:   touge battle on a race course vs rivals in cars with exactly your car's numbers;
//           difficulty only changes how good their racing line is and how hard they commit to it
import * as THREE from '../lib/three.module.min.js';
import { HOME_NET, COURSES, lineVariant, apexesOf } from './road.js';
import { getWorld, makeCarMesh, inHome } from './world3d.js';
import { makeCockpit } from './carmodel.js';
import { PROBLEM_THRESHOLD, MODELS } from './data.js';
import { clamp } from './state.js';
import { carSound, unlockAudio, isMuted, setMuted, gearFor } from './audio.js';
import { getRetro, setAffine } from './ps1.js';
import { openFullMap } from './fullmap.js';

const G = 9.81;
const WHEELBASE = 2.5;
const CAR_LEN = 4.4;
const MPH = 2.237;
const RIVAL_COLORS = ['#f5f6fa', '#e84118', '#9c88ff', '#fbc531', '#00a8ff', '#4cd137'];
// Rivals get colors clearly different from yours so you can always tell who's who.
function rivalColors(mine) {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const m = rgb(mine);
  return RIVAL_COLORS.filter((c) => { const r = rgb(c); return Math.hypot(r[0] - m[0], r[1] - m[1], r[2] - m[2]) > 120; });
}
// Apex bonus markers and contact fines (races).
const APEX_BONUS = 50, APEX_HIT = 2.0;
const APEX_GEM = new THREE.OctahedronGeometry(0.45, 0);
const APEX_RING = new THREE.RingGeometry(1.2, 1.6, 20);
const TOUCH_SLOP = 36; // px: touches this close to a control count for it
const SMOKE_LIFE = 1.4;
let smokeTex = null;
function smokeTexture() {
  if (smokeTex) return smokeTex;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return (smokeTex = new THREE.CanvasTexture(c));
}
const HB_RADIUS = 15;
const RACE_WEAR = 3;     // % off every part per race
const CRUISE_WEAR = 0.05; // free driving wears parts at this fraction of the full rates // rivals pull the handbrake where their line is tighter than this

// Locked chase camera: fixed high up behind the car with a wide 90° view, looking down the road over the
// treetops so you can see the next corners (a narrower view loses bends off the sides of a tall phone screen).
// It never swings or lags; it turns exactly with the car. The car sits low in the frame, above the pedals.
const CAM = { height: 20, back: 9.5, ahead: 12.7, fov: 90, fovLandscape: 70 };
// Interior camera: from the driver's seat, a little wider than a real windscreen so corners stay in view.
const COCKPIT = { fov: 82, fovLandscape: 62 };
// Which camera you last used (a per-device preference).
const camPref = { get: () => { try { return localStorage.getItem('kr-cam') || 'chase'; } catch { return 'chase'; } }, set: (v) => { try { localStorage.setItem('kr-cam', v); } catch { /* private mode */ } } };

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
  // Grid: rivals staggered a car length apart on alternating sides; you start one slot behind the last.
  // Rival i: row floor(i/2), left/right lane, the right lane a half-row back. You start one row behind the last.
  const nRivals = race && !window.__krNoRivals ? difficulty.rivals.length : 0;
  const gridSlot = (i) => route.from - 2 - Math.floor(i / 2) * 6.5 - (i % 2) * 3.25;
  const gridBack = race ? (nRivals ? gridSlot(nRivals - 1) - 6.5 : route.from - 2) : 0;
  const P = { yr: 0, x: 0, z: 0, h: 0, vx: 0, vz: 0, steer: 0, hint: -1, e: 0, pitch: 0, roll: 0, drifting: false, sAbs: 0, lastL: null, lastR: null, slip: 0 };
  if (race) {
    // You start behind the rivals and have to get past.
    const st = sampleAtS(gridBack);
    P.x = st.x; P.z = st.z;
    P.h = Math.atan2(st.tz, st.tx);
    P.hint = st.i;
    P.sAbs = gridBack;
  } else {
    P.x = spot.x; P.z = spot.z; P.h = Math.PI / 2; // backed in, facing the road
    P.sAbs = road.nearest(P.x, P.z).s;
  }
  const playerMesh = makeCarMesh(car.color, car.modelId, { wheels: car.wheelColor });
  playerMesh.beam.intensity = night ? 400 : 0;
  addMesh(playerMesh.group);
  const cockpit = makeCockpit(car.color, playerMesh.dims);
  playerMesh.group.add(cockpit.group);
  const cockpitLook = new THREE.Object3D();
  cockpitLook.position.copy(cockpit.eye.position).add(new THREE.Vector3(12, -0.75, 0));
  cockpit.group.add(cockpitLook);
  let camMode = camPref.get();
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
      // The second rival is a touch less sharp than the first (except when both are flawless: `equalPair`).
      const weaker = i && !difficulty.equalPair;
      const q = Math.max(0, difficulty.line - (weaker ? 0.05 : 0));
      const jitter = (weaker ? 0.985 : 1) * (0.995 + Math.random() * 0.01);
      const commit = difficulty.commit * jitter, brakeCommit = difficulty.brake * jitter;
      const line = getLine(road, net.id, q);
      const palette = rivalColors(car.color);
      const mesh = makeCarMesh(palette[i % palette.length], car.modelId); // one-make race: same car as yours
      mesh.beam.intensity = night ? 400 : 0;
      addMesh(mesh.group);
      const s0 = gridSlot(i); // two-wide staggered grid, so they run nose to tail instead of tangling
      // Every race each rival drifts around the racing line in its own way (two slow random waves),
      // so their lines differ from race to race and leave gaps to pass without contact.
      const wander = [0, 1].map((k) => ({ amp: (k ? 0.5 : 1.0) + Math.random() * (k ? 0.5 : 0.7), len: k ? 35 + Math.random() * 25 : 90 + Math.random() * 70, ph: Math.random() * Math.PI * 2 }));
      rivals.push({
        wander, boost: false,
        name, spec: rs, skill: brakeCommit, line, prof: speedProfile(line, rs, commit, brakeCommit), mesh,
        d: lineDAtS(line, s0), sAbs: s0, v: 0, pass: 0, passTarget: 0, startLat: i % 2 ? 2.1 : -2.1, curLat: 0,
        yawOff: 0, finished: false, finishT: 0, x: 0, z: 0, e: 0, h: 0, hb: false, lastL: null, lastR: null,
        mistakeT: 0, mistakeOff: 0,
      });
    });
  }

  // ---- state ----
  // Wear. A race always costs every part exactly RACE_WEAR % (so racing never wrecks a healthy car;
  // only parts that were already bad can fail mid-race). Free driving wears parts gently with use
  // (CRUISE_WEAR x the rates below), plus real damage from hitting things.
  const wear = { engine: 0, trans: 0, susp: 0, brakes: 0, tires: 0, body: 0 };
  const W = race ? 1 : CRUISE_WEAR;
  const used = (k) => (race ? Math.min(wear[k], RACE_WEAR) : wear[k]);
  const input = { left: false, right: false, gas: false, brake: false, hb: false, axis: null };
  let time = race ? -3.2 : 0.01;
  let done = false, raf = 0, last = performance.now(), mapOpen = false;
  let message = '', messageT = 0, noPowerT = 0, engineBlown = false, blownT = 0, hitCool = 0, place = 0;
  let bonus = 0, apexHits = 0, contacts = 0; // race money: +$ per apex clipped (contacts are only counted)
  // ---- apex markers (races): clip the inside of each apex for a bonus ----
  const apexMarks = race ? apexesOf(road).filter((a) => a.s > route.from + 5 && a.s < route.to - 5).map((a) => {
    const q = sampleAtS(a.s), lat = a.inside * (q.half - 0.9);
    const x = q.x + q.nx * lat, z = q.z + q.nz * lat;
    const g = new THREE.Group();
    const gem = new THREE.Mesh(APEX_GEM, new THREE.MeshBasicMaterial({ color: '#ffd200' }));
    gem.position.y = 1.1; g.add(gem);
    const ring = new THREE.Mesh(APEX_RING, new THREE.MeshBasicMaterial({ color: '#ffd200', transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
    g.position.set(x, q.e, z);
    addMesh(g);
    return { s: a.s, x, z, g, gem, ring, state: 'open' };
  }) : [];
  function checkApexes() {
    for (const m of apexMarks) {
      if (m.state !== 'open') continue;
      if (Math.hypot(P.x - m.x, P.z - m.z) < APEX_HIT) {
        m.state = 'hit'; bonus += APEX_BONUS; apexHits++;
        m.gem.material.color.set('#2ecc71'); m.ring.material.color.set('#2ecc71');
        flash(`APEX +$${APEX_BONUS}`, 0.9);
      } else if (P.sAbs - m.s > 6) {
        m.state = 'missed'; m.gem.visible = false; m.ring.material.opacity = 0.25; m.ring.material.color.set('#888');
      }
    }
  }
  const flash = (msg, t = 1.5) => { message = msg; messageT = t; };
  if (!race) flash('Drive down the lane to the road', 2.5);
  const carModel = MODELS.find((m) => m.id === car.modelId);
  const sound = carSound({ cyl: carModel?.cyl, turbo: !!(carModel?.turbo || car.upgrades?.turbo > 0) });

  // ---- input ----
  const keyMap = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'gas', w: 'gas', arrowdown: 'brake', s: 'brake', ' ': 'hb', shift: 'hb' };
  const onKey = (e) => {
    if (mapOpen) return;
    if (e.key.toLowerCase() === 'c' && e.type === 'keydown' && !e.repeat) { toggleCam(); return; }
    if (e.key.toLowerCase() === 'm' && e.type === 'keydown' && !e.repeat) { showMap(); return; }
    const k = keyMap[e.key.toLowerCase()]; if (!k) return; input[k] = e.type === 'keydown'; e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  const pointers = new Map();
  const ctlButtons = hud.querySelectorAll('[data-ctl]');
  const syncInput = () => {
    for (const k of ['left', 'right', 'gas', 'brake', 'hb']) input[k] = false;
    for (const k of pointers.values()) input[k] = true;
    ctlButtons.forEach((b) => b.classList.toggle('on', input[b.dataset.ctl]));
  };
  // Mouse/pen: track each pointer. Touch is handled separately below.
  const down = (e) => { if (e.pointerType === 'touch') return; const b = e.target.closest('[data-ctl]'); if (!b) return; e.preventDefault(); pointers.set(e.pointerId, b.dataset.ctl); syncInput(); };
  const up = (e) => { if (pointers.delete(e.pointerId)) syncInput(); };
  hud.addEventListener('pointerdown', down);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  // Touch: on every touch change, work out which controls are held from ALL fingers currently on the
  // screen. A missed "finger up" (iOS gestures, going full screen, app switching) can't leave a pedal
  // stuck: the next touch change corrects it, and lifting every finger releases everything. A touch
  // that lands just outside a control (within TOUCH_SLOP px) counts for the nearest one.
  const onTouch = (e) => {
    if (mapOpen) return; // (the map takes touches while it's open)
    const rects = [...ctlButtons].map((b) => ({ k: b.dataset.ctl, r: b.getBoundingClientRect() }));
    const held = new Set();
    let ours = false;
    for (const t of e.touches) {
      let best = null, bd = Infinity;
      for (const z of rects) {
        const dx = Math.max(z.r.left - t.clientX, 0, t.clientX - z.r.right), dy = Math.max(z.r.top - t.clientY, 0, t.clientY - z.r.bottom);
        const d = Math.hypot(dx, dy);
        if (d < bd) { bd = d; best = z; }
      }
      if (best && bd <= TOUCH_SLOP) held.add(best.k);
    }
    for (const t of e.changedTouches) {
      for (const z of rects) if (t.clientX > z.r.left - TOUCH_SLOP && t.clientX < z.r.right + TOUCH_SLOP && t.clientY > z.r.top - TOUCH_SLOP && t.clientY < z.r.bottom + TOUCH_SLOP) ours = true;
    }
    if (ours && e.cancelable) e.preventDefault(); // no scrolling/zooming/long-press menus from the pedals
    for (const k of ['left', 'right', 'gas', 'brake', 'hb']) input[k] = held.has(k);
    for (const k of pointers.values()) input[k] = true; // a mouse button can still be held on desktop
    ctlButtons.forEach((b) => b.classList.toggle('on', input[b.dataset.ctl]));
  };
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) window.addEventListener(type, onTouch, { passive: false });
  // Leaving the app or the tab releases every control.
  const releaseAll = () => { pointers.clear(); syncInput(); };
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', releaseAll);
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
    retro.resize();
    camera.aspect = retro.aspect;
    const c = camMode === 'cockpit' ? COCKPIT : CAM;
    camera.fov = camera.aspect < 0.8 ? c.fov : c.fovLandscape;
    camera.near = camMode === 'cockpit' ? 0.05 : 0.3;
    camera.updateProjectionMatrix();
    // The cockpit is drawn at twice the resolution: from down at seat height the road ahead is far
    // away and small, so the chunky PS1 pixels made it hard to read.
    // (and with perspective-correct textures, so road lines up close stay straight).
    if (camMode === 'cockpit') { retro.setDetail(640, 1); setAffine(0); } else { retro.setDetail(); setAffine(1); }
  };
  // Chase or cockpit: in the cockpit your own car's body is hidden and the interior shown instead.
  const camBtn = hud.querySelector('[data-cam]');
  function setCam(mode) {
    camMode = mode;
    for (const o of playerMesh.group.children) if (o !== cockpit.group && !o.isLight && o !== playerMesh.beam.target) o.visible = mode !== 'cockpit';
    cockpit.group.visible = mode === 'cockpit';
    camBtn.textContent = mode === 'cockpit' ? '🎥' : '👁';
    camBtn.setAttribute('aria-label', mode === 'cockpit' ? 'Switch to chase camera' : 'Switch to cockpit camera');
    resize();
  }
  function toggleCam() { setCam(camMode === 'cockpit' ? 'chase' : 'cockpit'); camPref.set(camMode); }
  camBtn.addEventListener('click', toggleCam);
  setCam(camMode);
  window.addEventListener('resize', resize);

  // Which road is the car on, and how far can it go sideways before the trees / canyon wall?
  // No guardrails: past the road edge is dirt shoulder (slow, less grip), then the tree line.
  // `m` is always the main road (the course you're racing, or the home loop); `rd`/`n` is the road
  // you're actually on, which can be any road on the map.
  const home = (x, z) => net.home && inHome(x, z);
  // Trees 4.5 m past the edge; a canyon wall can stand closer; a bridge rail right at the edge.
  const limitOf = (n) => (n.p.bridge ? n.p.half + 0.3 : n.p.half + 4.5 - 2.9 * n.p.canyon);
  const hints = new Map();
  function where(x, z) {
    const m = road.nearest(x, z, P.hint);
    const mainLimit = limitOf(m);
    const mainOk = Math.abs(m.lat) <= mainLimit && m.dist < mainLimit + 2 && !m.pastEnd;
    let best = { kind: 'main', rd: road, m, n: m, lat: m.lat, dist: m.dist, limit: mainLimit, asphalt: Math.abs(m.lat) <= m.p.half && m.dist < 12, pastEnd: m.pastEnd, valid: mainOk };
    for (const b of net.branches) {
      const bb = b.bbox;
      if (x < bb.x0 - 40 || x > bb.x1 + 40 || z < bb.z0 - 40 || z > bb.z1 + 40) continue;
      const nb = b.nearest(x, z, hints.has(b) ? hints.get(b) : -1);
      hints.set(b, nb.i);
      if (nb.dist > 40) continue;
      const limit = limitOf(nb), ok = Math.abs(nb.lat) <= limit && !nb.pastEnd;
      // Prefer whichever valid road is nearest (or, if you're nowhere valid, the nearest road at all).
      if ((ok && (!best.valid || nb.dist < best.dist)) || (!best.valid && nb.dist < best.dist)) {
        best = { kind: 'branch', rd: b, m, n: nb, lat: nb.lat, dist: nb.dist, limit, asphalt: Math.abs(nb.lat) <= nb.p.half, pastEnd: nb.pastEnd, valid: ok };
      }
    }
    if (home(x, z)) best.valid = true;
    return best;
  }

  // ---- tire smoke (a small pool of soft sprites that grow, drift up and fade) ----
  let spinT = 0, smokeAcc = 0, smokeSide = 1, smokeNext = 0;
  const smoke = Array.from({ length: 48 }, () => {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture(), transparent: true, opacity: 0, depthWrite: false, color: '#e8e8e4' }));
    m.visible = false; addMesh(m);
    return { m, age: 99, vx: 0, vz: 0 };
  });
  function puff(x, y, z) {
    const p = smoke[smokeNext = (smokeNext + 1) % smoke.length];
    p.age = 0; p.m.position.set(x, y, z); p.m.visible = true;
    p.vx = P.vx * 0.6; p.vz = P.vz * 0.6; // carried along in the car's wake, then hangs in the air
  }
  function updateSmoke(dt) {
    for (const p of smoke) {
      if (p.age > SMOKE_LIFE) { p.m.visible = false; continue; }
      p.age += dt;
      const t = p.age / SMOKE_LIFE;
      p.m.scale.setScalar(0.9 + t * 2.6);
      p.m.position.x += p.vx * dt; p.m.position.z += p.vz * dt; p.vx *= 1 - dt * 1.5; p.vz *= 1 - dt * 1.5;
      p.m.position.y += dt * 0.6;
      p.m.material.opacity = 0.3 * (1 - t) * Math.min(1, t * 6); // light: never thick
    }
  }

  // ---- physics ----
  function stepPlayer(dt) {
    if (done) return;
    const w0 = where(P.x, P.z);
    P.hint = w0.m.i;
    const atHome = home(P.x, P.z);
    // Dirt and gravel are only slightly looser than asphalt, and barely slower.
    const surf = w0.asphalt ? { grip: 1, drag: 0 } : { grip: 0.9, drag: 0.04 };
    const rs = w0.rd.sampleAtS(w0.n.s);

    const target = typeof input.axis === 'number' ? clamp(input.axis, -1, 1) : (input.right ? 1 : 0) - (input.left ? 1 : 0);
    P.steer += (target - P.steer) * Math.min(1, dt * 9);
    let fx = Math.cos(P.h), fz = Math.sin(P.h);
    let vf = P.vx * fx + P.vz * fz;
    const speed = Math.hypot(P.vx, P.vz);
    const hb = input.hb && time > 0;
    // Hydraulic handbrake: it locks only the rear wheels. The rear steps out and the car rotates
    // (spins up quicker the faster you're going) while the front tires keep steering, so you don't
    // get thrown wide. The rotation has momentum: it builds while you hold it and carries on briefly
    // after you let go, so you catch the slide with steering and throttle like a real drift.
    const latCap = spec.lat * surf.grip * (hb ? 1.2 : 1);

    // Kinematic yaw from steering, capped by what the tires can hold. On power (RWD) the rear lets go a little.
    const maxAngle = 0.6 / (1 + speed / 16);
    let yaw = (vf / WHEELBASE) * Math.tan(P.steer * maxAngle);
    let k = 1.25;
    if (input.gas && spec.drive === 'RWD') k = 1.6;
    if (input.gas && spec.drive === 'FWD') k = 1.05;
    const yawCap = (spec.lat * surf.grip * k) / Math.max(Math.abs(vf), 4);
    yaw = clamp(yaw, -yawCap, yawCap);
    if (hb && vf > 3) {
      // Spin into the turn: the way you're steering, or else the way the car is already rotating.
      const dir = Math.sign(P.steer) || Math.sign(P.yr) || 0;
      const spin = dir * Math.min(2.8, 0.55 + vf * 0.085);
      P.yr += (yaw * 1.3 + spin - P.yr) * Math.min(1, dt * 7);
    } else {
      // Grip returns: the car's rotation settles back to what the steering asks for.
      P.yr += (yaw - P.yr) * Math.min(1, dt * (Math.abs(P.yr) > Math.abs(yaw) + 0.3 ? 3.5 : 25));
    }
    P.h += P.yr * dt;

    fx = Math.cos(P.h); fz = Math.sin(P.h);
    const rx = -fz, rz = fx;
    vf = P.vx * fx + P.vz * fz;
    let vl = P.vx * rx + P.vz * rz;

    const canPower = time > 0 && !engineBlown && noPowerT <= 0;
    if (input.gas && canPower) {
      vf += spec.accel * Math.max(0, 1 - (vf / spec.top) ** 2) * dt * (hb ? 0.4 : 1);
      wear.engine += dt * 0.12 * W * (1 + 0.6 * car.upgrades.turbo);
      wear.trans += dt * 0.06 * W;
    }
    if (input.brake && time > 0) {
      if (vf > 0.5) { vf = Math.max(0, vf - spec.brake * surf.grip * dt); if (speed > 8) wear.brakes += dt * 0.4 * W; }
      else vf = Math.max(-5, vf - 3 * dt);
    }
    if (hb && vf > 0) vf = Math.max(0, vf - 2.2 * dt); // locked rears drag a little
    // Gravity along the slope: uphill slows you, downhill pulls you.
    if (!atHome || w0.asphalt) vf -= G * rs.grade * (fx * rs.tx + fz * rs.tz) * dt;
    vf -= vf * (0.012 + (input.gas ? 0 : 0.06) + surf.drag) * dt;
    if (time <= 0) vf = 0;

    // Lateral grip: what the tires can't cancel becomes a slide.
    const cap = latCap * dt;
    P.drifting = (Math.abs(vl) > 1.3 && speed > 5) || (hb && speed > 4);
    if (Math.abs(vl) <= cap) vl = 0; else vl -= Math.sign(vl) * cap;
    if (P.drifting) { vf -= vf * 0.1 * dt; wear.tires += (Math.abs(vl) + (hb ? 2 : 0)) * dt * 0.02 * W; }
    wear.tires += speed * dt * 0.0004 * W;
    if (!w0.asphalt && !atHome && speed > 3) wear.susp += dt * 0.6 * W;
    P.slip = clamp(Math.abs(vl) / 6 + (hb && speed > 4 ? 0.5 : 0), 0, 1);

    P.vx = fx * vf + rx * vl;
    P.vz = fz * vf + rz * vl;
    const ox = P.x, oz = P.z;
    P.x += P.vx * dt; P.z += P.vz * dt;

    // Stay on something drivable: scrape along the tree line, bounce off barriers / cabin edges.
    const w1 = where(P.x, P.z);
    if (!w1.valid) {
      let into = speed;
      if (!home(ox, oz) && !w1.pastEnd) {
        const sp = w1.n.p, sg = Math.sign(w1.lat), over = Math.abs(w1.lat) - w1.limit;
        P.x -= sp.nx * over * sg; P.z -= sp.nz * over * sg;
        into = (P.vx * sp.nx + P.vz * sp.nz) * sg;
        if (into > 0) { P.vx -= sp.nx * sg * into * 1.25; P.vz -= sp.nz * sg * into * 1.25; }
        // Only a real impact costs speed (more the harder you hit); grazing lets you slide along and recover.
        if (into > 1) { const keep = 1 - Math.min(0.5, into * 0.04); P.vx *= keep; P.vz *= keep; }
      } else {
        P.x = ox; P.z = oz; P.vx *= -0.25; P.vz *= -0.25;
      }
      if (into > 3 && hitCool <= 0) {
        wear.body += into * 0.5; wear.susp += into * 0.15;
        flash(w1.pastEnd ? 'ROAD CLOSED' : w1.n.p.bridge ? 'Into the rail!' : w1.n.p.canyon > 0.5 ? 'Into the rock!' : 'Into the trees!', 0.8);
        sound.hit(into); hitCool = 0.5;
      }
    }

    // Boulders are solid: bounce off, losing speed (and a little body) on a real hit.
    const rock = world.rockHit(P.x, P.z, 1.0);
    if (rock) {
      P.x += rock.nx * rock.over; P.z += rock.nz * rock.over;
      const into = -(P.vx * rock.nx + P.vz * rock.nz);
      if (into > 0) { P.vx += rock.nx * into * 1.3; P.vz += rock.nz * into * 1.3; }
      if (into > 1) { const keep = 1 - Math.min(0.6, into * 0.05); P.vx *= keep; P.vz *= keep; }
      if (into > 3 && hitCool <= 0) {
        wear.body += into * 0.5; wear.susp += into * 0.2;
        flash('Hit a rock!', 0.8); sound.hit(into); hitCool = 0.5;
      }
    }

    // Progress along the loop (unwrapped), elevation and body attitude.
    const w2 = where(P.x, P.z);
    P.hint = w2.m.i;
    P.sAbs += road.wrapDelta(w2.m.s - P.sAbs);
    const inYard = home(P.x, P.z) && Math.abs(w2.m.lat) > w2.m.p.half + 2;
    const offRoad = !inYard && Math.abs(w2.lat) > w2.n.p.half + 0.3;
    const eTarget = inYard ? 0 : offRoad ? world.terrainAt(P.x, P.z).h : w2.rd.sampleAtS(w2.n.s).e;
    P.e += (eTarget - P.e) * (P.eSet ? Math.min(1, dt * 12) : 1); // snaps to the road on the first step
    P.eSet = true;
    const gAlong = inYard ? 0 : rs.grade * (fx * rs.tx + fz * rs.tz);
    P.pitch += (Math.atan(gAlong) - P.pitch) * Math.min(1, dt * 6);
    P.roll += (clamp(-vl * 0.012 - P.steer * speed * 0.0015, -0.08, 0.08) - P.roll) * Math.min(1, dt * 5);

    // Tire smoke: after the tires have been sliding/spinning for 2 s, a light haze from the rear wheels.
    const spinning = speed > 3 && (P.slip > 0.35 || P.drifting);
    spinT = spinning ? spinT + dt : Math.max(0, spinT - dt * 3);
    if (spinT >= 2 && spinning) {
      smokeAcc += dt * 16;
      while (smokeAcc >= 1) {
        smokeAcc -= 1;
        const side = (smokeSide = -smokeSide);
        puff(P.x - fx * 1.35 + rx * 0.75 * side, P.e + 0.35, P.z - fz * 1.35 + rz * 0.75 * side);
      }
    }

    // Skid marks from the rear wheels.
    if (P.drifting || (input.brake && speed > 12)) {
      const bx = P.x - fx * 1.35, bz = P.z - fz * 1.35;
      const L = [bx - rx * 0.8, bz - rz * 0.8], R = [bx + rx * 0.8, bz + rz * 0.8];
      if (P.lastL) { world.skids.add(P.lastL[0], P.lastL[1], L[0], L[1], P.e); world.skids.add(P.lastR[0], P.lastR[1], R[0], R[1], P.e); }
      P.lastL = L; P.lastR = R;
    } else P.lastL = P.lastR = null;

    // Failures from running bad parts hard.
    const engNow = car.cond.engine - used('engine');
    if (!engineBlown && input.gas && time > 0 && engNow < 25 && Math.random() < dt * 0.025 * (25 - engNow) / 5) {
      engineBlown = true; blownT = 2.5; wear.engine = car.cond.engine; flash('💥 ENGINE BLEW!', 3);
    }
    if (noPowerT <= 0 && input.gas && time > 0 && car.cond.trans - used('trans') < PROBLEM_THRESHOLD && Math.random() < dt * 0.12) {
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
        // Impossible: get 50 m clear and they find more power to come back at you (until within 15 m).
        if (difficulty.catchUp && time > 1) {
          const lead = P.sAbs - r.sAbs;
          if (!r.boost && lead > 50) { r.boost = true; flash(`${r.name} is coming back at you!`, 1.4); }
          else if (r.boost && lead < 15) r.boost = false;
        }
        if (r.boost) target *= 1.15;
        // Don't drive through whoever is in front: follow, and look for a way past.
        const ahead = [{ sAbs: P.sAbs, lat: playerLat, v: playerV }, ...rivals.filter((o) => o !== r).map((o) => ({ sAbs: o.sAbs, lat: o.curLat, v: o.v }))];
        r.passTarget = 0;
        // Racing room: if you're alongside, they hold a car's width off you instead of driving into you.
        const side = P.sAbs - r.sAbs;
        if (Math.abs(side) < 4.5 && Math.abs(playerLat - r.curLat) < 2.4) {
          const rh = S[i].half;
          r.passTarget = clamp(playerLat + (r.curLat >= playerLat ? 2.4 : -2.4), -rh + 1, rh - 1) - (r.curLat - r.pass);
        }
        for (const b of ahead) {
          const gap = b.sAbs - r.sAbs;
          if (gap > 0 && gap < 9 && Math.abs(b.lat - r.curLat) < 2.3) {
            target = Math.min(target, b.v + (gap - 5.5) * 1.5);
            r.passTarget = b.lat > r.curLat ? -2.4 : 2.4; // go for the other side
          }
        }
        if (r.mistakeT > 0) r.passTarget += r.mistakeOff;
        const pw = r.boost ? 1.8 : 1, top = r.spec.top * (r.boost ? 1.15 : 1);
        const a = r.spec.accel * pw * Math.max(0, 1 - (r.v / top) ** 2) - G * S[i].grade - 0.012 * r.v;
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
        else if (lx > 0) {
          // You're in front: the rival behind backs off to your speed. You never get shoved forward.
          r.d -= penX; r.v = Math.min(r.v, Math.max(0, Math.hypot(P.vx, P.vz) - 0.5));
        } else {
          // You ran into the back of it: you're held behind at its speed.
          P.x -= ch * penX; P.z -= sh * penX;
          const vf = P.vx * ch + P.vz * sh;
          if (vf > r.v) { P.vx -= ch * (vf - r.v); P.vz -= sh * (vf - r.v); }
        }
        if (hitCool <= 0) { wear.body += 0.8; hitCool = 0.5; contacts++; flash('Contact!', 0.6); sound.hit(3); }
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
    const wob = r.wander.reduce((sum, w) => sum + w.amp * Math.sin((r.d / w.len) * Math.PI * 2 + w.ph), 0);
    const hw = Math.max(1.2, c.half + (c2.half - c.half) * t - 1);
    const lat = clamp((1 - blend) * r.startLat + blend * (lineLat + wob) + r.pass, -hw, hw);
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

  const camTarget = new THREE.Vector3();
  function render() {
    for (const m of apexMarks) if (m.state === 'open') m.gem.rotation.y = time * 3;
    place3D(playerMesh.group, P.x, P.e, P.z, P.h, P.pitch, P.roll);
    playerMesh.tail.color.set(input.brake || input.hb ? '#ffffff' : night ? '#c07070' : '#8a5a5a');
    for (const r of rivals) {
      place3D(r.mesh.group, r.x, r.e, r.z, r.h, Math.atan(S[lineIndexAt(r.line, r.d).i].grade));
      r.mesh.tail.color.set(r.hb ? '#ffffff' : night ? '#c07070' : '#8a5a5a');
    }
    if (world.fire) world.fire.light.intensity = 26 + Math.sin(time * 13) * 6 + Math.sin(time * 7.7) * 4;

    if (camMode === 'cockpit') {
      // From the driver's seat: moves with the body (pitch and roll included); the wheel turns with you.
      cockpit.wheel.rotation.x = P.steer * 1.7; // right turns the top of the wheel to the right
      playerMesh.group.updateMatrixWorld(true);
      cockpit.eye.getWorldPosition(camera.position);
      camera.lookAt(cockpitLook.getWorldPosition(camTarget));
    } else {
      // Locked camera: rigidly behind the car.
      const cx = Math.cos(P.h), cz = Math.sin(P.h);
      camera.position.set(P.x - cx * CAM.back, P.e + CAM.height, P.z - cz * CAM.back);
      camera.lookAt(P.x + cx * CAM.ahead, P.e, P.z + cz * CAM.ahead);
    }
    world.follow(camera);
    world.update(performance.now() / 1000);
    retro.render(scene, camera);
    drawMinimap();
    sound.update({ speed: Math.hypot(P.vx, P.vz), top: spec.top, throttle: input.gas && time > 0 && !engineBlown ? 1 : 0, slip: P.slip });
  }

  // Minimap (2D). Racing: the whole course, with the route highlighted. Free driving: the roads
  // within MINI_R of you, centred on the car.
  const mini = hud.querySelector('[data-minimap]');
  const mctx = mini.getContext('2d');
  // Tap the minimap (or press M) for the whole map. The game pauses while it's open.
  async function showMap() {
    if (mapOpen || done) return;
    mapOpen = true; releaseAll();
    await openFullMap({ player: P, rivals, route: race ? route : null, routeRoad: road, ponds: world.landmarks.ponds });
    mapOpen = false; releaseAll(); last = performance.now();
  }
  mini.addEventListener('click', showMap);
  const MINI_R = 380;
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  for (const p of S) { bx0 = Math.min(bx0, p.x); bx1 = Math.max(bx1, p.x); bz0 = Math.min(bz0, p.z); bz1 = Math.max(bz1, p.z); }
  function drawMinimap() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = mini.clientWidth * dpr, H = mini.clientHeight * dpr;
    if (mini.width !== W) { mini.width = W; mini.height = H; }
    let X, Z, view;
    if (race) {
      const sc = Math.min((W - 12 * dpr) / (bx1 - bx0), (H - 12 * dpr) / (bz1 - bz0));
      const ox = (W - (bx1 - bx0) * sc) / 2, oz = (H - (bz1 - bz0) * sc) / 2;
      X = (x) => ox + (x - bx0) * sc; Z = (z) => oz + (z - bz0) * sc;
      view = { x0: bx0, x1: bx1, z0: bz0, z1: bz1 };
    } else {
      const sc = Math.min(W, H) / (2 * MINI_R);
      X = (x) => W / 2 + (x - P.x) * sc; Z = (z) => H / 2 + (z - P.z) * sc;
      view = { x0: P.x - MINI_R * W / Math.min(W, H), x1: P.x + MINI_R * W / Math.min(W, H), z0: P.z - MINI_R * H / Math.min(W, H), z1: P.z + MINI_R * H / Math.min(W, H) };
    }
    mctx.clearRect(0, 0, W, H);
    mctx.lineJoin = 'round';
    const inView = (r) => r.bbox.x1 > view.x0 && r.bbox.x0 < view.x1 && r.bbox.z1 > view.z0 && r.bbox.z0 < view.z1;
    const path = (pts, closed) => {
      mctx.beginPath();
      let pen = false;
      pts.forEach((p, i) => {
        if (i % 3 && i !== pts.length - 1) return;
        const vis = race || (p.x > view.x0 - 60 && p.x < view.x1 + 60 && p.z > view.z0 - 60 && p.z < view.z1 + 60);
        if (!vis) { pen = false; return; }
        if (pen) mctx.lineTo(X(p.x), Z(p.z)); else mctx.moveTo(X(p.x), Z(p.z));
        pen = true;
      });
      if (closed && race) mctx.closePath();
      mctx.stroke();
    };
    mctx.lineWidth = 2 * dpr; mctx.strokeStyle = race ? 'rgba(200,190,170,0.35)' : 'rgba(255,255,255,0.75)';
    for (const b of net.branches) if (inView(b)) path(b.samples, b.loop);
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
      if (rivals.length) {
        $('[data-gap-label]').textContent = 'GAP';
        const gap = Math.max(...rivals.map((r) => r.sAbs - route.from)) - my;
        $('[data-gap]').textContent = gap > 0 ? `-${Math.round(gap)}m` : `+${Math.round(-gap)}m`;
        $('[data-gap]').style.color = gap > 0 ? 'var(--bad)' : 'var(--good)';
      } else { // hot lap: no gap, show the record to beat
        $('[data-gap-label]').textContent = 'BEST';
        $('[data-gap]').textContent = event.best ? fmtTime(event.best) : '—';
        $('[data-gap]').style.color = '#fff';
      }
      $('[data-time]').textContent = time > 0 ? fmtTime(time) : '0:00.0';
      $('[data-togo]').textContent = `${Math.max(0, Math.round(route.to - route.from - my))} m to go\n${bonus < 0 ? '−' : '+'}$${Math.abs(bonus)} apex bonus`;
    }
    const msg = $('[data-msg]');
    if (race && time <= 0) msg.textContent = time < -2.2 ? '3' : time < -1.2 ? '2' : time < -0.2 ? '1' : 'GO!';
    else msg.textContent = messageT > 0 ? message : '';
    msg.classList.toggle('big', (race && time <= 0) || (messageT > 0 && message.length < 12));
    const eng = car.cond.engine - used('engine'), tir = car.cond.tires - used('tires');
    $('[data-warn]').textContent = [eng < 30 && '🔧 ENGINE', tir < 30 && '🛞 TIRES'].filter(Boolean).join('  ');
  }

  function loop(now) {
    const realDt = Math.max(0, (now - last) / 1000); // a frame stamped before startDrive ran can come out negative
    last = now;
    if (mapOpen) { sound.update({ speed: 0, top: spec.top, throttle: 0, slip: 0 }); raf = requestAnimationFrame(loop); return; }
    const steps = window.__krSimSpeed || 1; // test hook: run the sim faster than real time
    for (let n = 0; n < steps && !done; n++) {
      const dt = window.__krDt || Math.min(0.033, realDt); // test hook: fixed step
      time += dt;
      messageT -= dt; noPowerT -= dt; hitCool -= dt;
      stepPlayer(dt / 2); stepPlayer(dt / 2);
      stepRivals(dt);
      if (engineBlown) { blownT -= dt; if (blownT <= 0) finish(true); }
      if (race && !done && progress() >= route.to - route.from) { place = 1 + rivals.filter((r) => r.finished).length; finish(false); }
    }
    if (done) return; // finished (or moved on to another road) during this frame
    updateSmoke(Math.min(0.05, realDt));
    if (race && time > 0) checkApexes();
    if (!window.__krNoRender) render(); // test hook: simulate without drawing
    updateHud();
    if (!done) raf = requestAnimationFrame(loop);
  }

  function finish(dnf) {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    cleanup();
    // A race costs RACE_WEAR % of everything (a blown engine is still blown).
    const out = race ? Object.fromEntries(Object.keys(wear).map((k) => [k, RACE_WEAR])) : wear;
    if (engineBlown) out.engine = car.cond.engine;
    onExit({ mode, dnf: race ? dnf : false, place: dnf ? null : place, time, engineBlown, wear: out, bonus, apexHits, apexTotal: apexMarks.length, contacts });
  }

  function cleanup() {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) window.removeEventListener(type, onTouch);
    window.removeEventListener('blur', releaseAll);
    document.removeEventListener('visibilitychange', releaseAll);
    window.removeEventListener('resize', resize);
    hud.removeEventListener('pointerdown', down);
    exitBtn.removeEventListener('click', onExitBtn);
    muteBtn.removeEventListener('click', onMute);
    camBtn.removeEventListener('click', toggleCam);
    mini.removeEventListener('click', showMap);
    retro.setDetail(); setAffine(1); // the home screen shares the renderer
    ctlButtons.forEach((b) => b.classList.remove('on'));
    sound.stop();
    for (const o of added) scene.remove(o);
  }

  // Test/debug hook.
  window.__kr = { time: () => time, onRoad: () => { const w = where(P.x, P.z); return { id: w.rd.id, s: w.n.s, lat: w.lat, valid: w.valid }; }, smokeCount: () => smoke.filter((p) => p.m.visible).length, spinT: () => spinT, money: () => ({ bonus, apexHits, contacts }), apexMarks, player: P, rivals, input, spec, wear, race, route, road, net, bestLine: road.bestLine && getLine(road, net.id, 1), sampleAtS, progress };
  raf = requestAnimationFrame(loop);
}

export function fmtTime(t) {
  const mm = Math.floor(t / 60), s = t - mm * 60;
  return `${mm}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}
