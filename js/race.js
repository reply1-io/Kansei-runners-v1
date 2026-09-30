// Top-down race: arcade car physics, AI opponents on a speed profile, wear tracking.
import { TRACKS, PROBLEM_THRESHOLD } from './data.js';
import { clamp, rand } from './state.js';

const TRACK_SCALE = 2.2;
const SAMPLE_SPACING = 8;
const CAR_LEN = 38;
const CAR_WID = 19;
const RIVAL_NAMES = ['Takumi-ish', 'Ryo', 'Keisuke', 'Iketani', 'Sato', 'Mako', 'Rin', 'Kyoko', 'Bunta Jr.', 'Shingo'];
const RIVAL_COLORS = ['#f5f6fa', '#e84118', '#00a8ff', '#fbc531', '#9c88ff', '#4cd137'];
const MPH = 0.17; // px/s -> displayed mph

// ---------- Track geometry ----------

function buildTrack(def) {
  const pts = def.points.map(([x, y]) => [x * TRACK_SCALE, y * TRACK_SCALE]);
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / SAMPLE_SPACING));
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]) });
    }
  }
  // Put the start line at the end of the straightest stretch so the grid isn't in a corner.
  const N0 = out.length, heading = (i) => { const a = out[i], b = out[(i + 1) % N0]; return Math.atan2(b.y - a.y, b.x - a.x); };
  let bestStart = 0, bestTurn = Infinity;
  for (let i = 0; i < N0; i += 2) {
    let turn = 0;
    for (let j = -45; j < 10; j += 3) {
      let da = heading((i + j + 3 + N0) % N0) - heading((i + j + N0) % N0);
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      turn += Math.abs(da);
    }
    if (turn < bestTurn) { bestTurn = turn; bestStart = i; }
  }
  out.push(...out.splice(0, bestStart));

  // Cumulative distance, tangents, normals.
  let d = 0;
  for (let i = 0; i < out.length; i++) {
    const a = out[i], b = out[(i + 1) % out.length];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    a.d = d; a.seg = len; a.tx = dx / len; a.ty = dy / len; a.nx = -a.ty; a.ny = a.tx;
    d += len;
  }
  // Curvature from heading change over a window (smooths noise).
  const N = out.length, W = 6;
  for (let i = 0; i < N; i++) {
    const a = out[(i - W + N) % N], b = out[(i + W) % N];
    let da = Math.atan2(b.ty, b.tx) - Math.atan2(a.ty, a.tx);
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    out[i].k = Math.abs(da) / (2 * W * SAMPLE_SPACING);
  }
  return { ...def, samples: out, length: d, half: def.width / 2 };
}

function sampleAt(track, s) {
  const L = track.length;
  s = ((s % L) + L) % L;
  const S = track.samples;
  // Binary search on cumulative distance.
  let lo = 0, hi = S.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (S[mid].d <= s) lo = mid; else hi = mid - 1; }
  const a = S[lo], t = (s - a.d) / a.seg;
  return { x: a.x + a.tx * a.seg * t, y: a.y + a.ty * a.seg * t, tx: a.tx, ty: a.ty, nx: a.nx, ny: a.ny, idx: lo };
}

function nearest(track, x, y, hint) {
  const S = track.samples, N = S.length;
  let best = hint, bestD = Infinity;
  for (let o = -40; o <= 40; o++) {
    const i = (hint + o + N) % N, p = S[i];
    const dd = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (dd < bestD) { bestD = dd; best = i; }
  }
  const p = S[best];
  const lat = (x - p.x) * p.nx + (y - p.y) * p.ny;
  const along = (x - p.x) * p.tx + (y - p.y) * p.ty;
  return { idx: best, lat, s: p.d + clamp(along, 0, p.seg) };
}

// AI target speed at each sample: cornering limit, then a backward pass for braking zones.
function speedProfile(track, latCap, top, decel) {
  const S = track.samples, N = S.length;
  const v = S.map((p) => Math.min(top, Math.sqrt(latCap / Math.max(p.k, 1e-5))));
  for (let pass = 0; pass < 2; pass++) {
    for (let i = N - 1; i >= 0; i--) {
      const next = v[(i + 1) % N];
      v[i] = Math.min(v[i], Math.sqrt(next * next + 2 * decel * S[i].seg));
    }
  }
  return v;
}

function makeDecor(track) {
  const items = [];
  const S = track.samples;
  for (let i = 0; i < S.length; i += 6) {
    if (Math.random() < 0.55) continue;
    const side = Math.random() < 0.5 ? -1 : 1;
    const off = side * (track.half + rand(60, 380));
    const x = S[i].x + S[i].nx * off, y = S[i].y + S[i].ny * off;
    // Skip anything that would land on another part of the road.
    let ok = true;
    for (let j = 0; j < S.length; j += 4) {
      if ((S[j].x - x) ** 2 + (S[j].y - y) ** 2 < (track.half + 45) ** 2) { ok = false; break; }
    }
    if (ok) items.push({ x, y, r: rand(14, 34), shade: rand(0.75, 1.1) });
  }
  return items;
}

// ---------- Race ----------

export function startRace({ canvas, hud, car, perf, event, onFinish }) {
  const ctx = canvas.getContext('2d');
  const track = buildTrack(TRACKS[event.track]);
  const total = track.length * event.laps;
  const decor = makeDecor(track);

  // Opponents: fixed-line AI following a precomputed speed profile.
  const rivals = [];
  const names = [...RIVAL_NAMES].sort(() => Math.random() - 0.5);
  for (let i = 0; i < 3; i++) {
    const pace = event.aiPace * rand(0.95, 1.04);
    const top = (350 + 2400 * 0.13) * pace;
    rivals.push({
      name: names[i], color: RIVAL_COLORS[i % RIVAL_COLORS.length],
      s: -50 - i * 60, lane: (i % 2 ? 1 : -1) * 28, v: 0, pace, top,
      accel: 1800 * 0.13 * pace,
      profile: speedProfile(track, 900 * pace, top, 650 * pace),
      finished: false, finishTime: 0,
    });
  }

  // Player starts at the back of the grid.
  const startS = -50 - 3 * 60;
  const sp = sampleAt(track, startS);
  const player = {
    x: sp.x + sp.nx * 28, y: sp.y + sp.ny * 28,
    h: Math.atan2(sp.ty, sp.tx), vx: 0, vy: 0, steer: 0,
    idx: sp.idx, prog: startS, drifting: false,
  };

  const wear = { engine: 0, trans: 0, susp: 0, brakes: 0, tires: 0, body: 0 };
  const input = { left: false, right: false, gas: false, brake: false };
  const skids = [];
  const smoke = [];
  let time = -3.2; // countdown
  let last = performance.now();
  let done = false, raf = 0;
  let message = '', messageT = 0;
  let noPowerT = 0; // transmission pop-out
  let engineBlown = false, blownT = 0;
  let finishPlace = 0;
  let collisionCooldown = 0;

  const flash = (m, t = 1.6) => { message = m; messageT = t; };

  // ---- input ----
  const keyMap = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'gas', w: 'gas', ArrowDown: 'brake', s: 'brake', ' ': 'brake' };
  const onKey = (e) => {
    const k = keyMap[e.key] || keyMap[e.key.toLowerCase?.()];
    if (!k) return;
    input[k] = e.type === 'keydown';
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  const pointers = new Map();
  const ctlButtons = hud.querySelectorAll('[data-ctl]');
  const syncInput = () => {
    for (const k of ['left', 'right', 'gas', 'brake']) input[k] = false;
    for (const k of pointers.values()) input[k] = true;
    ctlButtons.forEach((b) => b.classList.toggle('on', input[b.dataset.ctl]));
  };
  const down = (e) => {
    const b = e.target.closest('[data-ctl]');
    if (!b) return;
    e.preventDefault();
    pointers.set(e.pointerId, b.dataset.ctl);
    syncInput();
  };
  const up = (e) => { if (pointers.delete(e.pointerId)) syncInput(); };
  hud.addEventListener('pointerdown', down);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);

  const retireBtn = hud.querySelector('[data-retire]');
  const onRetire = () => finish(true);
  retireBtn.addEventListener('click', onRetire);

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  };
  resize();
  window.addEventListener('resize', resize);

  // ---- simulation ----
  function stepPlayer(dt) {
    const p = player;
    const near = nearest(track, p.x, p.y, p.idx);
    p.idx = near.idx;
    const off = Math.abs(near.lat) > track.half;

    // Progress along the track, handling the wrap at the start line.
    let ds = near.s - (((p.prog % track.length) + track.length) % track.length);
    if (ds > track.length / 2) ds -= track.length;
    if (ds < -track.length / 2) ds += track.length;
    p.prog += ds;

    // Steering (smoothed so tapping feels analog).
    const target = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    p.steer += (target - p.steer) * Math.min(1, dt * 10);

    let fx = Math.cos(p.h), fy = Math.sin(p.h);
    let vf = p.vx * fx + p.vy * fy;
    const speed = Math.hypot(p.vx, p.vy);
    const turnScale = clamp(Math.abs(vf) / 170, 0, 1) * (1 - 0.45 * clamp(speed / perf.topSpeed, 0, 1));
    let turn = perf.turn;
    if (perf.drive === 'FWD' && input.gas) turn *= 0.9; // a little understeer
    p.h += p.steer * turn * turnScale * dt * Math.sign(vf || 1);

    fx = Math.cos(p.h); fy = Math.sin(p.h);
    const rx = -fy, ry = fx;
    vf = p.vx * fx + p.vy * fy;
    let vl = p.vx * rx + p.vy * ry;

    const canPower = time > 0 && !engineBlown && noPowerT <= 0;
    if (input.gas && canPower) {
      const top = perf.topSpeed * (off ? 0.55 : 1);
      vf += perf.accel * Math.max(0, 1 - (vf / top) ** 2) * dt * 1.6;
      wear.engine += dt * 0.14 * (1 + 0.6 * car.upgrades.turbo);
      wear.trans += dt * 0.07;
    }
    if (input.brake && time > 0) {
      if (vf > 15) { vf -= 720 * perf.brake * dt; wear.brakes += dt * 0.45; }
      else vf = Math.max(-160, vf - 260 * dt);
    }
    // Rolling resistance / aero, more on grass.
    vf -= vf * (0.04 + (input.gas ? 0 : 0.25) + (off ? 1.4 : 0)) * dt;
    if (time <= 0) vf = 0;

    // Lateral grip: whatever sideways velocity grip can't cancel becomes a slide.
    let cap = 950 * perf.grip * (off ? 0.55 : 1) * dt;
    if (perf.drive === 'RWD' && input.gas && speed > 220) cap *= 0.8; // power oversteer
    p.drifting = Math.abs(vl) > 70 && speed > 150;
    if (Math.abs(vl) <= cap) vl = 0; else vl -= Math.sign(vl) * cap;
    if (p.drifting) {
      wear.tires += Math.abs(vl) * dt * 0.0028;
      vf -= vf * 0.25 * dt; // scrubbing speed
    }
    wear.tires += speed * dt * 0.00006;
    if (off && speed > 60) { wear.susp += dt * 0.9; wear.tires += dt * 0.05; }

    p.vx = fx * vf + rx * vl;
    p.vy = fy * vf + ry * vl;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Barrier: can't go too far off the road.
    const n2 = nearest(track, p.x, p.y, p.idx);
    const limit = track.half + 70;
    if (Math.abs(n2.lat) > limit) {
      const s = track.samples[n2.idx];
      const sign = Math.sign(n2.lat);
      p.x -= s.nx * (Math.abs(n2.lat) - limit) * sign;
      p.y -= s.ny * (Math.abs(n2.lat) - limit) * sign;
      const hitSpeed = Math.abs(p.vx * s.nx + p.vy * s.ny);
      // Kill the velocity into the wall and scrub the rest.
      const into = p.vx * s.nx * sign + p.vy * s.ny * sign;
      if (into > 0) { p.vx -= s.nx * sign * into * 1.3; p.vy -= s.ny * sign * into * 1.3; }
      p.vx *= 0.8; p.vy *= 0.8;
      if (hitSpeed > 120 && collisionCooldown <= 0) {
        wear.body += hitSpeed * 0.012; wear.susp += hitSpeed * 0.004;
        flash('WALL!', 0.8); collisionCooldown = 0.5;
      }
    }

    // Skid marks from the rear wheels.
    if (p.drifting || (input.brake && speed > 300)) {
      const bx = p.x - fx * CAR_LEN * 0.35, by = p.y - fy * CAR_LEN * 0.35;
      for (const side of [-1, 1]) {
        const wx = bx + rx * side * CAR_WID * 0.45, wy = by + ry * side * CAR_WID * 0.45;
        const key = side < 0 ? 'lastL' : 'lastR';
        if (p[key]) skids.push([p[key][0], p[key][1], wx, wy]);
        p[key] = [wx, wy];
      }
      if (skids.length > 900) skids.splice(0, skids.length - 900);
      if (p.drifting && Math.random() < 0.6) smoke.push({ x: bx, y: by, r: 6, a: 0.35 });
    } else { p.lastL = p.lastR = null; }

    // Mechanical failures when you run a car on bad parts.
    const engineNow = car.cond.engine - wear.engine;
    if (!engineBlown && input.gas && time > 0 && engineNow < 25 && Math.random() < dt * 0.025 * (25 - engineNow) / 5) {
      engineBlown = true; blownT = 2.5;
      wear.engine = car.cond.engine; // it's toast
      flash('💥 ENGINE BLEW!', 3);
    }
    const transNow = car.cond.trans - wear.trans;
    if (noPowerT <= 0 && input.gas && time > 0 && transNow < PROBLEM_THRESHOLD && Math.random() < dt * 0.12) {
      noPowerT = 0.9; flash('Popped out of gear!', 1);
    }
    if (car.cond.brakes - wear.brakes < 20 && input.brake && speed > 300 && Math.random() < dt * 0.5) flash('Brake fade...', 0.8);
  }

  function stepRivals(dt) {
    for (const r of rivals) {
      if (time <= 0) break;
      const idx = sampleAt(track, r.s).idx;
      const target = Math.min(r.top, r.profile[idx]);
      if (r.v < target) r.v = Math.min(target, r.v + r.accel * dt * Math.max(0, 1 - (r.v / r.top) ** 2) * 1.6);
      else r.v = Math.max(target, r.v - 700 * r.pace * dt);
      r.s += r.v * dt;
      if (!r.finished && r.s >= total) { r.finished = true; r.finishTime = time; }

      // Car-to-car contact with the player.
      const pos = rivalPos(r);
      const dx = player.x - pos.x, dy = player.y - pos.y, dist = Math.hypot(dx, dy);
      if (dist < 32 && dist > 0) {
        const push = (32 - dist);
        player.x += (dx / dist) * push; player.y += (dy / dist) * push;
        player.vx *= 0.93; player.vy *= 0.93;
        r.v *= 0.97;
        if (collisionCooldown <= 0) { wear.body += 0.6; collisionCooldown = 0.5; flash('Contact!', 0.6); }
      }
    }
  }

  function rivalPos(r) {
    const a = sampleAt(track, r.s);
    return { x: a.x + a.nx * r.lane, y: a.y + a.ny * r.lane, h: Math.atan2(a.ty, a.tx) };
  }

  function standings() {
    const list = rivals.map((r) => ({ name: r.name, prog: r.s, finished: r.finished, ft: r.finishTime }));
    list.push({ name: 'You', prog: player.prog, me: true });
    list.sort((a, b) => b.prog - a.prog);
    return list;
  }

  // ---- rendering ----
  function drawCar(x, y, h, color, isPlayer) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-CAR_LEN / 2 + 3, -CAR_WID / 2 + 3, CAR_LEN, CAR_WID);
    ctx.fillStyle = color;
    roundRect(-CAR_LEN / 2, -CAR_WID / 2, CAR_LEN, CAR_WID, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,30,45,0.85)'; // windshield + rear glass
    ctx.fillRect(2, -CAR_WID / 2 + 3, 8, CAR_WID - 6);
    ctx.fillRect(-13, -CAR_WID / 2 + 3, 5, CAR_WID - 6);
    ctx.fillStyle = '#fff7c2';
    ctx.fillRect(CAR_LEN / 2 - 3, -CAR_WID / 2 + 2, 3, 4);
    ctx.fillRect(CAR_LEN / 2 - 3, CAR_WID / 2 - 6, 3, 4);
    ctx.fillStyle = input.brake && isPlayer ? '#ff2020' : '#8a1010';
    ctx.fillRect(-CAR_LEN / 2, -CAR_WID / 2 + 2, 2, 4);
    ctx.fillRect(-CAR_LEN / 2, CAR_WID / 2 - 6, 2, 4);
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function trackPath() {
    ctx.beginPath();
    const S = track.samples;
    ctx.moveTo(S[0].x, S[0].y);
    for (let i = 1; i < S.length; i++) ctx.lineTo(S[i].x, S[i].y);
    ctx.closePath();
  }

  function render() {
    const W = canvas.width, H = canvas.height;
    const dpr = W / canvas.clientWidth;
    const speed = Math.hypot(player.vx, player.vy);
    const zoom = dpr * clamp(Math.min(W, H) / dpr / 520, 0.7, 1.4) * (1.05 - 0.3 * clamp(speed / 900, 0, 1));

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = track.grass;
    ctx.fillRect(0, 0, W, H);

    ctx.translate(W / 2, H * 0.66);
    ctx.scale(zoom, zoom);
    ctx.rotate(-player.h - Math.PI / 2);
    ctx.translate(-player.x, -player.y);

    // Runoff, kerbs, road.
    ctx.lineJoin = 'round';
    trackPath();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = track.width + 140; ctx.stroke();
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = track.width + 18; ctx.stroke();
    ctx.setLineDash([26, 26]); ctx.strokeStyle = '#f1f1f1'; ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = track.road; ctx.lineWidth = track.width; ctx.stroke();
    ctx.setLineDash([30, 40]); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);

    // Start/finish line (checkered).
    const s0 = track.samples[0];
    ctx.save();
    ctx.translate(s0.x, s0.y);
    ctx.rotate(Math.atan2(s0.ty, s0.tx));
    const sq = 10;
    for (let i = 0; i * sq < track.width; i++) for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff';
      ctx.fillRect(j * sq - sq, -track.half + i * sq, sq, sq);
    }
    ctx.restore();

    // Skids.
    ctx.strokeStyle = 'rgba(10,10,10,0.4)'; ctx.lineWidth = 4; ctx.beginPath();
    for (const s of skids) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }
    ctx.stroke();

    // Trees / props.
    for (const d of decor) {
      ctx.fillStyle = `rgba(0,0,0,0.25)`;
      ctx.beginPath(); ctx.arc(d.x + 6, d.y + 6, d.r, 0, 7); ctx.fill();
      ctx.fillStyle = `rgb(${30 * d.shade},${80 * d.shade},${40 * d.shade})`;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill();
    }

    for (const r of rivals) { const p = rivalPos(r); drawCar(p.x, p.y, p.h, r.color, false); }
    drawCar(player.x, player.y, player.h, car.color, true);

    for (const s of smoke) {
      ctx.fillStyle = `rgba(220,220,220,${s.a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
    }

    drawMinimap(W, H, dpr);
  }

  // Precompute minimap bounds.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of track.samples) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }

  function drawMinimap(W, H, dpr) {
    const size = 110 * dpr, pad = 12 * dpr;
    const sc = size / Math.max(maxX - minX, maxY - minY);
    const ox = W - size - pad, oy = 64 * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(ox - 6 * dpr, oy - 6 * dpr, size + 12 * dpr, size + 12 * dpr);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    track.samples.forEach((p, i) => { const x = ox + (p.x - minX) * sc, y = oy + (p.y - minY) * sc; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath(); ctx.stroke();
    const dot = (x, y, c, r) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(ox + (x - minX) * sc, oy + (y - minY) * sc, r * dpr, 0, 7); ctx.fill(); };
    for (const r of rivals) { const p = rivalPos(r); dot(p.x, p.y, r.color, 3); }
    dot(player.x, player.y, '#ffd32a', 4.5);
  }

  const $ = (sel) => hud.querySelector(sel);
  function updateHud() {
    const st = standings();
    const pos = st.findIndex((x) => x.me) + 1;
    const lap = clamp(Math.floor(Math.max(0, player.prog) / track.length) + 1, 1, event.laps);
    $('[data-pos]').textContent = `${pos}/${st.length}`;
    $('[data-lap]').textContent = `${lap}/${event.laps}`;
    $('[data-time]').textContent = time > 0 ? fmtTime(time) : '0:00.0';
    $('[data-speed]').textContent = Math.round(Math.hypot(player.vx, player.vy) * MPH);
    const msg = $('[data-msg]');
    if (time <= 0) msg.textContent = time < -2.2 ? '3' : time < -1.2 ? '2' : time < -0.2 ? '1' : 'GO!';
    else msg.textContent = messageT > 0 ? message : '';
    msg.classList.toggle('big', time <= 0 || messageT > 0);
    const eng = car.cond.engine - wear.engine, tir = car.cond.tires - wear.tires;
    $('[data-warn]').textContent = [eng < 30 && '🔧 ENGINE', tir < 30 && '🛞 TIRES'].filter(Boolean).join('  ');
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (!done) {
      time += dt;
      if (time > 0 && time - dt <= 0) flash('GO!', 0.7);
      messageT -= dt; noPowerT -= dt; collisionCooldown -= dt;
      // Two physics substeps per frame for stability at high speed.
      stepPlayer(dt / 2); stepPlayer(dt / 2);
      stepRivals(dt);
      for (const s of smoke) { s.r += dt * 40; s.a -= dt * 0.5; }
      while (smoke.length && smoke[0].a <= 0) smoke.shift();
      if (smoke.length > 120) smoke.splice(0, smoke.length - 120);

      if (engineBlown) { blownT -= dt; if (blownT <= 0) finish(true); }
      if (player.prog >= total) {
        finishPlace = 1 + rivals.filter((r) => r.finished).length;
        finish(false);
      }
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
    onFinish({
      dnf, place: dnf ? null : finishPlace, time, engineBlown,
      wear, rivals: rivals.map((r) => r.name),
    });
  }

  function cleanup() {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    window.removeEventListener('resize', resize);
    hud.removeEventListener('pointerdown', down);
    retireBtn.removeEventListener('click', onRetire);
    ctlButtons.forEach((b) => b.classList.remove('on'));
  }

  // Debug/testing hook (used by automated playtests).
  window.__kr = { player, rivals, track, input, sampleAt: (s) => sampleAt(track, s) };

  raf = requestAnimationFrame(loop);
  return { abort: () => finish(true) };
}

export function fmtTime(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

