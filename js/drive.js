// Driving on the touge in a close 3/4 chase view. Two modes:
//   cruise: get in a car at the cabin and drive anywhere on the road, park when you're done
//   race:   touge battle vs 1-2 rivals, uphill (cabin -> summit) or downhill (summit -> cabin)
import * as THREE from '../lib/three.module.min.js';
import { ROAD, ROAD_HALF, RAIL_OFFSET, sampleAtS, nearestOnRoad, U } from './road.js';
import { buildWorld, makeCarMesh, inHome, isRailed } from './world3d.js';
import { PROBLEM_THRESHOLD } from './data.js';
import { clamp } from './state.js';

const G = 9.81;
const WHEELBASE = 2.5;
const CAR_HALF_W = 0.95;
const MPH = 2.237;
const RIVAL_COLORS = ['#f5f6fa', '#e84118', '#9c88ff'];

let renderer = null, world = null, camera = null;

function ensure3D(canvas) {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    camera = new THREE.PerspectiveCamera(58, 1, 0.5, 600);
  }
  if (!world) world = buildWorld();
}

// Convert game stats (from state.performance) to SI units for this sim.
function carSpec(perf) {
  return {
    top: perf.topSpeed * 0.075,           // m/s
    accel: perf.accel * 0.028,            // m/s^2 at low speed
    brake: 9.0 * perf.brake,              // m/s^2
    lat: 9.5 * perf.grip,                 // m/s^2 lateral grip on asphalt
    drive: perf.drive,
  };
}

export function startDrive({ canvas, hud, car, perf, mode, event, parked = [], spot, onExit }) {
  ensure3D(canvas);
  const scene = world.scene;
  const spec = carSpec(perf);
  const race = mode === 'race';
  const dir = race && event.dir === 'down' ? -1 : 1;
  const lineS = race ? (dir > 0 ? ROAD.startLineS : ROAD.summitS) : 0;
  const finishS = race ? (dir > 0 ? ROAD.summitS : ROAD.startLineS) : 0;
  const raceLen = Math.abs(finishS - lineS);
  const added = [];
  const addMesh = (o) => { scene.add(o); added.push(o); return o; };

  // ---- player ----
  const P = { x: 0, z: 0, h: 0, vx: 0, vz: 0, steer: 0, hint: -1, e: 0, pitch: 0, roll: 0, drifting: false };
  if (race) {
    const st = sampleAtS(lineS - dir * 7);
    P.x = st.x + st.nx * -2.1 * dir; P.z = st.z + st.nz * -2.1 * dir;
    P.h = Math.atan2(st.tz * dir, st.tx * dir);
    P.hint = st.i;
  } else {
    P.x = spot.x; P.z = spot.z; P.h = Math.PI / 2; // backed in, facing the road
  }
  const playerMesh = makeCarMesh(car.color);
  addMesh(playerMesh.group);

  // Cars left at the cabin.
  for (const pc of parked) {
    const mm = makeCarMesh(pc.car.color);
    mm.group.position.set(pc.x, 0, pc.z);
    mm.group.rotation.set(0, -Math.PI / 2, 0);
    addMesh(mm.group);
  }

  // ---- rivals ----
  const rivals = [];
  if (race) {
    event.rivals.forEach((name, i) => {
      const pace = event.aiPace * (i ? 0.97 : 1);
      const top = 48 * pace, lat = 9.5 * (0.55 + 0.55 * pace), decel = 8.5 * Math.min(1.15, pace + 0.1);
      // Target speed per sample: cornering limit, then a backward pass (in race direction) for braking zones.
      const Sm = ROAD.samples, prof = Sm.map((p) => Math.min(top, Math.sqrt(lat / Math.max(p.k, 1e-4))));
      const order = dir > 0 ? [...Sm.keys()].reverse() : [...Sm.keys()];
      let prev = null;
      for (const j of order) {
        if (prev !== null) prof[j] = Math.min(prof[j], Math.sqrt(prof[prev] ** 2 + 2 * decel * Math.abs(Sm[j].s - Sm[prev].s)));
        prev = j;
      }
      const mesh = makeCarMesh(RIVAL_COLORS[i % RIVAL_COLORS.length]);
      addMesh(mesh.group);
      rivals.push({
        name, pace, top, accel: 7.2 * pace, decel, prof, mesh,
        s: lineS - dir * (7 + i * 9), lat: (i === 0 ? 2.1 : 0) * dir, v: 0, finished: false, finishT: 0,
      });
    });
  }

  // ---- state ----
  const wear = { engine: 0, trans: 0, susp: 0, brakes: 0, tires: 0, body: 0 };
  const input = { left: false, right: false, gas: false, brake: false, axis: null };
  let time = race ? -3.2 : 0.01;
  let done = false, raf = 0, last = performance.now();
  let message = '', messageT = 0, noPowerT = 0, engineBlown = false, blownT = 0, hitCool = 0, place = 0;
  let camYaw = P.h;
  const flash = (msg, t = 1.5) => { message = msg; messageT = t; };
  if (!race) flash('Drive down the lane to the road', 2.5);

  // ---- input ----
  const keyMap = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'gas', w: 'gas', arrowdown: 'brake', s: 'brake', ' ': 'brake' };
  const onKey = (e) => { const k = keyMap[e.key.toLowerCase()]; if (!k) return; input[k] = e.type === 'keydown'; e.preventDefault(); };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  const pointers = new Map();
  const ctlButtons = hud.querySelectorAll('[data-ctl]');
  const syncInput = () => {
    for (const k of ['left', 'right', 'gas', 'brake']) input[k] = false;
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
  hud.classList.toggle('cruise', !race);

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(dpr);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    camera.fov = camera.aspect < 0.8 ? 64 : 52;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  // ---- physics ----
  function stepPlayer(dt) {
    const near = nearestOnRoad(P.x, P.z, P.hint);
    P.hint = near.i;
    const home = inHome(P.x, P.z);
    const railed = isRailed(near.s);
    const onAsphalt = Math.abs(near.lat) <= ROAD_HALF && near.dist < 12;
    const surf = onAsphalt ? { grip: 1, drag: 0 } : home ? { grip: 0.75, drag: 0.25 } : { grip: 0.6, drag: 0.9 };
    const rs = sampleAtS(near.s);

    // Digital buttons, or an analog axis (-1..1) if something sets input.axis (tilt, gamepad, tests).
    const target = typeof input.axis === 'number' ? clamp(input.axis, -1, 1) : (input.right ? 1 : 0) - (input.left ? 1 : 0);
    P.steer += (target - P.steer) * Math.min(1, dt * 9);
    let fx = Math.cos(P.h), fz = Math.sin(P.h);
    let vf = P.vx * fx + P.vz * fz;
    const speed = Math.hypot(P.vx, P.vz);
    const latCap = spec.lat * surf.grip;

    // Kinematic yaw from steering, capped by what the tires can hold (a bit more on power = drift).
    const maxAngle = 0.6 / (1 + speed / 16);
    let yaw = (vf / WHEELBASE) * Math.tan(P.steer * maxAngle);
    let k = 1.25;
    if (input.gas && spec.drive === 'RWD') k = 1.6;
    if (input.gas && spec.drive === 'FWD') k = 1.05;
    const yawCap = (latCap * k) / Math.max(Math.abs(vf), 4);
    yaw = clamp(yaw, -yawCap, yawCap);
    P.h += yaw * dt;

    fx = Math.cos(P.h); fz = Math.sin(P.h);
    const rx = -fz, rz = fx;
    vf = P.vx * fx + P.vz * fz;
    let vl = P.vx * rx + P.vz * rz;

    const canPower = time > 0 && !engineBlown && noPowerT <= 0;
    if (input.gas && canPower) {
      vf += spec.accel * Math.max(0, 1 - (vf / spec.top) ** 2) * dt;
      wear.engine += dt * 0.12 * (1 + 0.6 * car.upgrades.turbo);
      wear.trans += dt * 0.06;
    }
    if (input.brake && time > 0) {
      if (vf > 0.5) { vf = Math.max(0, vf - spec.brake * surf.grip * dt); if (speed > 8) wear.brakes += dt * 0.4; }
      else vf = Math.max(-5, vf - 3 * dt);
    }
    // Gravity along the slope: uphill slows you, downhill pulls you.
    if (!home || onAsphalt) vf -= G * rs.grade * (fx * rs.tx + fz * rs.tz) * dt;
    vf -= vf * (0.012 + (input.gas ? 0 : 0.06) + surf.drag) * dt;
    if (time <= 0) vf = 0;

    // Lateral grip: what the tires can't cancel becomes a slide.
    const cap = latCap * dt;
    P.drifting = Math.abs(vl) > 1.3 && speed > 5;
    if (Math.abs(vl) <= cap) vl = 0; else vl -= Math.sign(vl) * cap;
    if (P.drifting) { vf -= vf * 0.1 * dt; wear.tires += Math.abs(vl) * dt * 0.02; }
    wear.tires += speed * dt * 0.0004;
    if (!onAsphalt && !home && speed > 3) wear.susp += dt * 0.6;

    P.vx = fx * vf + rx * vl;
    P.vz = fz * vf + rz * vl;
    const ox = P.x, oz = P.z;
    P.x += P.vx * dt; P.z += P.vz * dt;

    // Where you're allowed to be: on the road (up to the rail / tree line) or in the cabin's drive areas.
    const n2 = nearestOnRoad(P.x, P.z, P.hint);
    const limit = isRailed(n2.s) ? ROAD_HALF + RAIL_OFFSET - CAR_HALF_W : ROAD_HALF + 4.5;
    const ok = inHome(P.x, P.z) || (Math.abs(n2.lat) <= limit && n2.dist < limit + 2);
    if (!ok) {
      const impact = speed;
      if (inHome(ox, oz)) {
        // Hit something at the cabin: stop and bounce back a little.
        P.x = ox; P.z = oz; P.vx *= -0.2; P.vz *= -0.2;
      } else {
        // Slide along the guardrail / tree line.
        const sp = n2.p, sg = Math.sign(n2.lat), over = Math.abs(n2.lat) - limit;
        P.x -= sp.nx * over * sg; P.z -= sp.nz * over * sg;
        const into = (P.vx * sp.nx + P.vz * sp.nz) * sg;
        if (into > 0) { P.vx -= sp.nx * sg * into * 1.25; P.vz -= sp.nz * sg * into * 1.25; }
        P.vx *= 0.9; P.vz *= 0.9;
        if (into > 3 && hitCool <= 0) { wear.body += into * 0.5; wear.susp += into * 0.15; flash(railed ? 'GUARDRAIL!' : 'Into the trees!', 0.8); hitCool = 0.5; }
      }
      if (inHome(ox, oz) && impact > 3 && hitCool <= 0) { wear.body += impact * 0.5; flash('Bump!', 0.6); hitCool = 0.5; }
    }

    // Elevation / body attitude for rendering.
    const n3 = nearestOnRoad(P.x, P.z, P.hint);
    const onRoadNow = !inHome(P.x, P.z) || Math.abs(n3.lat) < ROAD_HALF + 2;
    const eTarget = onRoadNow ? sampleAtS(n3.s).e : 0;
    P.e += (eTarget - P.e) * Math.min(1, dt * 12);
    const gAlong = onRoadNow ? rs.grade * (fx * rs.tx + fz * rs.tz) : 0;
    P.pitch += (Math.atan(gAlong) - P.pitch) * Math.min(1, dt * 6);
    P.roll += (clamp(-vl * 0.012 - P.steer * speed * 0.0015, -0.08, 0.08) - P.roll) * Math.min(1, dt * 5);

    // Failures from running bad parts hard.
    const engNow = car.cond.engine - wear.engine;
    if (!engineBlown && input.gas && time > 0 && engNow < 25 && Math.random() < dt * 0.025 * (25 - engNow) / 5) {
      engineBlown = true; blownT = 2.5; wear.engine = car.cond.engine; flash('💥 ENGINE BLEW!', 3);
    }
    if (noPowerT <= 0 && input.gas && time > 0 && car.cond.trans - wear.trans < PROBLEM_THRESHOLD && Math.random() < dt * 0.12) {
      noPowerT = 0.9; flash('Popped out of gear!', 1);
    }
  }

  function stepRivals(dt) {
    if (time <= 0) return;
    for (const r of rivals) {
      if (r.finished) { r.v = Math.max(0, r.v - 6 * dt); r.s += r.v * dt * dir; continue; }
      const p = sampleAtS(r.s);
      const target = Math.min(r.top, r.prof[p.i]);
      const a = r.accel * Math.max(0, 1 - (r.v / r.top) ** 2) - G * p.grade * dir;
      if (r.v < target) r.v = Math.min(target, r.v + Math.max(a, 0.4) * dt);
      else r.v = Math.max(target, r.v - r.decel * dt);
      r.s += r.v * dt * dir;
      if ((r.s - lineS) * dir >= raceLen) { r.finished = true; r.finishT = time; }
      // Contact with the player.
      const rp = rivalPos(r);
      const dx = P.x - rp.x, dz = P.z - rp.z, d = Math.hypot(dx, dz);
      if (d < 2.3 && d > 0) {
        P.x += (dx / d) * (2.3 - d); P.z += (dz / d) * (2.3 - d);
        P.vx *= 0.94; P.vz *= 0.94; r.v *= 0.97;
        if (hitCool <= 0) { wear.body += 0.8; hitCool = 0.5; flash('Contact!', 0.6); }
      }
    }
  }

  function rivalPos(r) {
    const a = sampleAtS(r.s);
    return { x: a.x + a.nx * r.lat, z: a.z + a.nz * r.lat, e: a.e, h: Math.atan2(a.tz * dir, a.tx * dir), pitch: Math.atan(a.grade * dir) };
  }

  const progress = () => (nearestOnRoad(P.x, P.z, P.hint).s - lineS) * dir;

  // ---- rendering ----
  function place3D(group, x, e, z, h, pitch, roll = 0) {
    group.position.set(x, e, z);
    group.rotation.set(roll, -h, pitch);
  }

  function render(dt) {
    place3D(playerMesh.group, P.x, P.e, P.z, P.h, P.pitch, P.roll);
    playerMesh.tail.color.set(input.brake ? '#ff2a2a' : '#6a0c0c');
    for (const r of rivals) { const p = rivalPos(r); place3D(r.mesh.group, p.x, p.e, p.z, p.h, p.pitch); }
    // Fire flicker at the cabin.
    world.fire.light.intensity = 26 + Math.sin(time * 13) * 6 + Math.sin(time * 7.7) * 4;

    // Close 3/4 chase camera, lagging the car's heading a little.
    let d = P.h - camYaw;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    camYaw += d * Math.min(1, dt * 3.2);
    const cx = Math.cos(camYaw), cz = Math.sin(camYaw);
    camera.position.set(P.x - cx * 7.8, P.e + 8.2, P.z - cz * 7.8);
    camera.lookAt(P.x + cx * 3, P.e + 0.6, P.z + cz * 3);
    renderer.render(scene, camera);
    drawMinimap();
  }

  // Minimap (2D) of the whole touge.
  const mini = hud.querySelector('[data-minimap]');
  const mctx = mini.getContext('2d');
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  for (const p of ROAD.samples) { bx0 = Math.min(bx0, p.x); bx1 = Math.max(bx1, p.x); bz0 = Math.min(bz0, p.z); bz1 = Math.max(bz1, p.z); }
  function drawMinimap() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = mini.clientWidth * dpr, H = mini.clientHeight * dpr;
    if (mini.width !== W) { mini.width = W; mini.height = H; }
    const sc = Math.min((W - 12 * dpr) / (bx1 - bx0), (H - 12 * dpr) / (bz1 - bz0));
    const ox = (W - (bx1 - bx0) * sc) / 2, oz = (H - (bz1 - bz0) * sc) / 2;
    const X = (x) => ox + (x - bx0) * sc, Z = (z) => oz + (z - bz0) * sc;
    mctx.clearRect(0, 0, W, H);
    mctx.lineWidth = 3 * dpr; mctx.strokeStyle = 'rgba(255,255,255,0.75)'; mctx.lineJoin = 'round';
    mctx.beginPath();
    ROAD.samples.forEach((p, i) => (i % 3 ? null : i ? mctx.lineTo(X(p.x), Z(p.z)) : mctx.moveTo(X(p.x), Z(p.z))));
    mctx.stroke();
    const dot = (x, z, c, r) => { mctx.fillStyle = c; mctx.beginPath(); mctx.arc(X(x), Z(z), r * dpr, 0, 7); mctx.fill(); };
    const home = sampleAtS(ROAD.homeS);
    dot(home.x, home.z, '#ff9f43', 3.5);
    if (race) { const f = sampleAtS(finishS); dot(f.x, f.z, '#fff', 3.5); }
    for (const r of rivals) { const p = rivalPos(r); dot(p.x, p.z, '#ff4d4d', 3.5); }
    dot(P.x, P.z, '#ffd32a', 4.5);
  }

  const $ = (sel) => hud.querySelector(sel);
  function updateHud() {
    const speed = Math.hypot(P.vx, P.vz);
    $('[data-speed]').textContent = Math.round(speed * MPH);
    if (race) {
      const my = progress();
      const all = [{ me: true, prog: my }, ...rivals.map((r) => ({ prog: (r.s - lineS) * dir, r }))].sort((a, b) => b.prog - a.prog);
      $('[data-pos]').textContent = `${all.findIndex((x) => x.me) + 1}/${all.length}`;
      const lead = rivals.reduce((best, r) => ((r.s - lineS) * dir > (best ? (best.s - lineS) * dir : -Infinity) ? r : best), null);
      const gap = lead ? (lead.s - lineS) * dir - my : 0;
      $('[data-gap]').textContent = gap > 0 ? `-${Math.round(gap)}m` : `+${Math.round(-gap)}m`;
      $('[data-gap]').style.color = gap > 0 ? 'var(--bad)' : 'var(--good)';
      $('[data-time]').textContent = time > 0 ? fmtTime(time) : '0:00.0';
      $('[data-togo]').textContent = `${Math.max(0, Math.round(raceLen - my))} m to go`;
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
      if (race && !done && progress() >= raceLen) { place = 1 + rivals.filter((r) => r.finished).length; finish(false); }
    }
    render(Math.min(0.033, realDt));
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
    ctlButtons.forEach((b) => b.classList.remove('on'));
    for (const o of added) scene.remove(o);
  }

  // Test/debug hook.
  window.__kr = { player: P, rivals, input, spec, wear, race, dir, lineS, finishS, road: ROAD, sampleAtS, nearestOnRoad, progress };
  raf = requestAnimationFrame(loop);
}

export function fmtTime(t) {
  const mm = Math.floor(t / 60), s = t - mm * 60;
  return `${mm}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

