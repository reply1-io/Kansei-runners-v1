// Road networks. Each network is a main road (closed loop or open point-to-point), optional side
// roads, and a racing line. Roads are built "turtle style" from arcs and straights, so every hairpin
// radius and grade is exact.
//   HOME_NET   the loop around the mountain in front of the cabin (free driving) + closed side roads
//   COURSES    the race courses: Kansei Pass (ultra-winding) and Switchback Ladder (straight, hairpin, repeat)
// Units are meters. The 2D home map uses map units: 1 map unit = U meters.
import { seeded } from './draw.js';

export const U = 0.088;           // meters per map unit (a 50-unit car on the map = 4.4 m)
export const ROAD_HALF = 4.2;     // two 4.2 m lanes
export const BRANCH_HALF = 3.2;   // side roads are narrower
const STEP = 1;                   // sample spacing (m)

// Where the driveway lane meets the home loop, in map units (see HOME in map.js). The loop leaves
// the cabin heading west (uphill) and comes back from the east.
const ANCHOR_MAP = { x: 330, y: 675 };
const ANCHOR_HEADING = Math.PI;

// turn: degrees (+ = heading angle increases, i.e. clockwise on the top-down map),
// r: arc radius (m), grade: climb per meter in the direction of travel.
const LOOP = [
  // Past the cabin and west along the valley floor toward the mountain.
  { r: 90, turn: -14, grade: 0.0 },
  { r: 90, turn: 20, grade: 0.01 },
  { r: 140, turn: -6, grade: 0.02 },
  { r: 200, turn: 10, grade: 0.03 },
  { r: 200, turn: -10, grade: 0.04 },
  { r: 60, turn: 20, grade: 0.05 },
  { r: 60, turn: -20, grade: 0.06 },
  // West face: a stack of four switchbacks.
  { r: 11, turn: 180, grade: 0.05, name: 'Hairpin 1' },
  { r: 110, turn: -12, grade: 0.09 },
  { r: 110, turn: 12, grade: 0.09 },
  { r: 35, turn: -30, grade: 0.08 },
  { r: 35, turn: 30, grade: 0.08 },
  { r: 100, turn: -8, grade: 0.09 },
  { r: 100, turn: 8, grade: 0.09 },
  { r: 10, turn: -180, grade: 0.05, name: 'Hairpin 2' },
  { r: 150, turn: 14, grade: 0.1 },
  { r: 150, turn: -14, grade: 0.1 },
  { r: 90, turn: 10, grade: 0.09 },
  { r: 90, turn: -10, grade: 0.09 },
  { r: 12, turn: 180, grade: 0.05, name: 'Hairpin 3' },
  { r: 70, turn: -25, grade: 0.07 },
  { r: 70, turn: 25, grade: 0.07 },
  { r: 120, turn: -7, grade: 0.08 },
  { r: 120, turn: 7, grade: 0.08 },
  { r: 9.5, turn: -180, grade: 0.04, name: 'Hairpin 4' },
  // Sweeping climb north to the ridge.
  { r: 40, turn: 50, grade: 0.06 },
  { r: 120, turn: -15, grade: 0.08 },
  { r: 120, turn: 15, grade: 0.08 },
  { r: 80, turn: 25, grade: 0.07 },
  { r: 150, turn: -12, grade: 0.08 },
  { r: 150, turn: 12, grade: 0.08 },
  { r: 60, turn: 15, grade: 0.07 },
  { r: 130, turn: -14, grade: 0.06 },
  { r: 130, turn: 14, grade: 0.05 },
  { r: 22, turn: 90, grade: 0.03, name: 'Ridge corner' },
  // Ridge run east: fast, flowing, over the summit.
  { r: 110, turn: 25, grade: 0.02 },
  { r: 80, turn: -40, grade: 0.02 },
  { r: 140, turn: 20, grade: 0.01, mark: 'summit' },
  { r: 100, turn: 18, grade: -0.01 },
  { r: 70, turn: -30, grade: -0.02 },
  { r: 160, turn: 12, grade: -0.02 },
  { r: 90, turn: -25, grade: -0.03 },
  { r: 120, turn: 20, grade: -0.03 },
  // East face: drop off the ridge and down three switchbacks.
  { r: 45, turn: 90, grade: -0.05 },
  { r: 130, turn: -10, grade: -0.08, mark: 'logging' },
  { r: 130, turn: 10, grade: -0.08 },
  { r: 30, turn: 90, grade: -0.07 },
  { r: 120, turn: -12, grade: -0.09 },
  { r: 120, turn: 12, grade: -0.09 },
  { r: 11, turn: -180, grade: -0.05, name: 'Hairpin 5' },
  { r: 110, turn: 12, grade: -0.09 },
  { r: 110, turn: -12, grade: -0.09 },
  { r: 40, turn: 30, grade: -0.08 },
  { r: 40, turn: -30, grade: -0.08 },
  { r: 10, turn: 180, grade: -0.05, name: 'Hairpin 6' },
  { r: 130, turn: -10, grade: -0.09 },
  { r: 130, turn: 10, grade: -0.09 },
  { r: 12, turn: -180, grade: -0.05, name: 'Hairpin 7' },
  // Fast sweepers down into the valley, then swing back west toward home.
  { r: 90, turn: 30, grade: -0.07 },
  { r: 70, turn: -35, grade: -0.07 },
  { r: 90, turn: 40, grade: -0.06 },
  { r: 60, turn: -30, grade: -0.06 },
  { r: 110, turn: 45, grade: -0.05 },
  { r: 90, turn: 60, grade: -0.04 },
  // Valley floor back toward the cabin: a chain of S-bends, no straights.
  { r: 120, turn: 40, grade: -0.03 },
  { r: 160, turn: -18, grade: -0.02 },
  { r: 110, turn: 22, grade: -0.02 },
  { r: 140, turn: -16, grade: -0.02 },
  { r: 100, turn: 20, grade: -0.02, mark: 'valley' },
  { r: 150, turn: -14, grade: -0.01 },
  { r: 90, turn: 18, grade: -0.01 },
];
// The last stretch back through the valley to the cabin is a smooth curve fitted to close the loop.

// Side roads: where they leave the loop (a named mark, plus meters after it), which side, and shape.
const BRANCH_DEFS = [
  { id: 'lookout', name: 'Summit Lookout', at: 'summit', offset: 30, side: -1, segs: [{ r: 40, turn: -25, grade: 0.03 }, { r: 60, turn: 40, grade: 0.02 }, { r: 50, turn: -20, grade: 0.01 }] },
  { id: 'logging', name: 'Old Logging Road', at: 'logging', offset: 12, side: -1, segs: [{ r: 60, turn: 30, grade: -0.01 }, { r: 45, turn: -45, grade: 0.02 }, { r: 80, turn: 20, grade: 0.01 }] },
  { id: 'town', name: 'Road to Town', at: 'valley', offset: 10, side: -1, segs: [{ r: 50, turn: -30, grade: -0.02 }, { r: 70, turn: 35, grade: -0.02 }, { r: 60, turn: -15, grade: -0.01 }] },
];

// Segments: { r, turn } is an arc (turn in degrees, + = clockwise on the top-down map),
// { len } is a straight. grade = climb per meter in the direction of travel.
function walk(segments, x, z, h, e = 0, marks = null) {
  const pts = [];
  for (const seg of segments) {
    if (marks && seg.mark) marks[seg.mark] = pts.length;
    const total = seg.len ? 0 : (seg.turn * Math.PI) / 180;
    const len = seg.len || Math.abs(total) * seg.r;
    const n = Math.max(2, Math.round(len / STEP));
    const dh = total / n, ds = len / n;
    for (let i = 0; i < n; i++) {
      h += dh / 2; x += Math.cos(h) * ds; z += Math.sin(h) * ds; h += dh / 2;
      e += seg.grade * ds;
      pts.push({ x, z, e, name: seg.name });
    }
  }
  return { pts, x, z, h, e };
}

// Cubic Hermite from (p0, heading h0) to (p1, heading h1): smooth, and curved unless perfectly aligned.
function hermite(p0, h0, p1, h1) {
  const L = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  const k = L * 1.1;
  const t0 = { x: Math.cos(h0) * k, z: Math.sin(h0) * k }, t1 = { x: Math.cos(h1) * k, z: Math.sin(h1) * k };
  const n = Math.round(L * 1.4);
  const raw = [];
  for (let i = 1; i < n; i++) {
    const t = i / n, t2 = t * t, t3 = t2 * t;
    const a = 2 * t3 - 3 * t2 + 1, b = t3 - 2 * t2 + t, c = -2 * t3 + 3 * t2, d = t3 - t2;
    raw.push({ x: a * p0.x + b * t0.x + c * p1.x + d * t1.x, z: a * p0.z + b * t0.z + c * p1.z + d * t1.z });
  }
  return resample([p0, ...raw, p1]).slice(1, -1);
}

function resample(pts) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    let d = STEP - carry;
    while (d <= L) { const t = d / L; out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }); d += STEP; }
    carry = L - (d - STEP);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function smoothElevation(pts, W, loop) {
  const N = pts.length, raw = pts.map((p) => p.e);
  for (let i = 0; i < N; i++) {
    let sum = 0, n = 0;
    for (let j = i - W; j <= i + W; j++) {
      const k = loop ? (j + N) % N : Math.max(0, Math.min(N - 1, j));
      sum += raw[k]; n++;
    }
    pts[i].e = sum / n;
  }
}

// Turn a list of points into a road: distances, tangents, normals, grade, curvature, and lookups.
export function makeRoad(pts, loop) {
  const N = pts.length;
  const at = (i) => (loop ? pts[(i + N) % N] : pts[Math.max(0, Math.min(N - 1, i))]);
  let s = 0;
  for (let i = 0; i < N; i++) {
    const p = pts[i];
    if (i > 0) s += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    p.s = s; p.i = i;
    const a = at(i - 1), b = at(i + 1);
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    p.tx = dx / L; p.tz = dz / L; p.nx = -p.tz; p.nz = p.tx;
  }
  const length = loop ? s + Math.hypot(pts[0].x - pts[N - 1].x, pts[0].z - pts[N - 1].z) : s;
  for (let i = 0; i < N; i++) {
    const a = at(i - 1), b = at(i + 1);
    pts[i].grade = (b.e - a.e) / Math.max(1e-6, loop ? 2 : Math.hypot(b.x - a.x, b.z - a.z));
    const W = 4, p0 = at(i - W), p1 = at(i + W);
    let da = Math.atan2(p1.tz, p1.tx) - Math.atan2(p0.tz, p0.tx);
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    pts[i].k = Math.abs(da) / (2 * W * STEP);
    pts[i].kSigned = da / (2 * W * STEP);
  }
  const wrapS = (v) => (loop ? ((v % length) + length) % length : Math.max(0, Math.min(length, v)));
  const road = {
    samples: pts, length, loop,
    wrapDelta: (d) => { if (!loop) return d; d = ((d % length) + length) % length; return d > length / 2 ? d - length : d; },
    // Interpolated point at distance s along the road.
    sampleAtS(v) {
      v = wrapS(v);
      let lo = 0, hi = N - 1;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pts[m].s <= v) lo = m; else hi = m - 1; }
      const A = pts[lo], B = loop ? pts[(lo + 1) % N] : pts[Math.min(lo + 1, N - 1)];
      const segLen = lo === N - 1 ? (loop ? length - A.s : 1) : B.s - A.s;
      const t = segLen > 0 ? Math.min(1, (v - A.s) / segLen) : 0;
      return {
        x: A.x + (B.x - A.x) * t, z: A.z + (B.z - A.z) * t, e: A.e + (B.e - A.e) * t,
        tx: A.tx, tz: A.tz, nx: A.nx, nz: A.nz, grade: A.grade, k: A.k, i: lo, t,
      };
    },
    // Nearest point, searching near `hint` so stacked switchback legs don't get confused.
    nearest(x, z, hint = -1, window = 70) {
      let best = 0, bd = Infinity;
      const scan = (i) => { const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } };
      if (hint >= 0) for (let o = -window; o <= window; o++) { const i = hint + o; if (loop) scan((i + N) % N); else if (i >= 0 && i < N) scan(i); }
      else for (let i = 0; i < N; i++) scan(i);
      if (hint >= 0 && bd > 30 * 30) return road.nearest(x, z, -1);
      const p = pts[best];
      const lat = (x - p.x) * p.nx + (z - p.z) * p.nz;
      const along = (x - p.x) * p.tx + (z - p.z) * p.tz;
      const pastEnd = !loop && ((best === N - 1 && along > -1.5) || (best === 0 && along < 1.5));
      return { i: best, p, lat, s: wrapS(p.s + along), dist: Math.sqrt(bd), pastEnd };
    },
  };
  return road;
}

// ---------- racing lines ----------
// Minimum-curvature line: an "elastic band" relaxed inside the road edges. It naturally goes
// wide - apex - wide through corners. Returns lateral offsets (m) per sample.
function optimalOffsets(road, margin = 1.15) {
  const S = road.samples, N = S.length, lim = ROAD_HALF - margin, loop = road.loop;
  const idx = (i) => (loop ? (i + N) % N : Math.max(0, Math.min(N - 1, i)));
  const off = new Float64Array(N);
  for (const k of [24, 14, 8, 4]) {
    for (let it = 0; it < 80; it++) {
      for (let i = 0; i < N; i++) {
        if (!loop && (i < 3 || i > N - 4)) continue;
        const ia = idx(i - k), ib = idx(i + k), a = S[ia], b = S[ib], c = S[i];
        const ax = a.x + a.nx * off[ia], az = a.z + a.nz * off[ia];
        const bx = b.x + b.nx * off[ib], bz = b.z + b.nz * off[ib];
        const target = ((ax + bx) / 2 - c.x) * c.nx + ((az + bz) / 2 - c.z) * c.nz;
        off[i] = Math.max(-lim, Math.min(lim, off[i] + 0.6 * (target - off[i])));
      }
    }
  }
  return off;
}

// A racing line at a given quality, blended between the optimal line (q = 1) and simply keeping to
// one lane (q = 0, `lane` meters from the center). Lane-keepers leave the other lane open to pass;
// the optimal line uses the whole road, which closes the doors. Worse lines are also slower.
export function lineVariant(road, q, lane = 2.0) {
  const S = road.samples, N = S.length, loop = road.loop;
  const best = road.bestLine, lim = ROAD_HALF - 1.1;
  const off = S.map((_, i) => Math.max(-lim, Math.min(lim, q * best[i] + (1 - q) * lane)));
  const pts = S.map((p, i) => ({ x: p.x + p.nx * off[i], z: p.z + p.nz * off[i], e: p.e, off: off[i] }));
  let d = 0;
  for (let i = 0; i < N; i++) {
    const p = pts[i], nx = loop ? pts[(i + 1) % N] : pts[Math.min(i + 1, N - 1)];
    p.d = d; p.seg = Math.hypot(nx.x - p.x, nx.z - p.z);
    d += p.seg;
  }
  const at = (i) => (loop ? pts[(i + N) % N] : pts[Math.max(0, Math.min(N - 1, i))]);
  for (let i = 0; i < N; i++) {
    const a = at(i - 3), b = pts[i], c = at(i + 3);
    const abx = b.x - a.x, abz = b.z - a.z, bcx = c.x - b.x, bcz = c.z - b.z, acx = c.x - a.x, acz = c.z - a.z;
    const cross = abx * bcz - abz * bcx;
    const k = (2 * cross) / (Math.hypot(abx, abz) * Math.hypot(bcx, bcz) * Math.hypot(acx, acz) || 1);
    b.k = Math.abs(k); b.kSigned = k;
  }
  const ks = pts.map((p) => p.k);
  for (let i = 0; i < N; i++) { let sum = 0; for (let j = -3; j <= 3; j++) sum += ks[loop ? (i + j + N) % N : Math.max(0, Math.min(N - 1, i + j))]; pts[i].k = sum / 7; }
  return { pts, length: d };
}

// ---------- the home loop ----------
function buildHomeLoop() {
  const ax = ANCHOR_MAP.x * U, az = ANCHOR_MAP.y * U;
  const marks = {};
  const w = walk(LOOP, ax, az, ANCHOR_HEADING, 0, marks);
  marks.close = w.pts.length;
  // Close the loop: curve from the end of the east descent back to the cabin, arriving heading west.
  const closing = hermite({ x: w.x, z: w.z }, w.h, { x: ax, z: az }, ANCHOR_HEADING);
  closing.forEach((p, i) => { p.e = w.e * (1 - (i + 1) / (closing.length + 1)); });
  let pts = [{ x: ax, z: az, e: 0 }, ...w.pts, ...closing];
  smoothElevation(pts, 15, true);
  // Start/finish line 9 m east of the driveway: rotate so index 0 sits there.
  const startIdx = pts.length - 9;
  pts = [...pts.slice(startIdx), ...pts.slice(0, startIdx)];
  const shift = (i) => (i + 1 + 9) % pts.length; // +1: the anchor point was prepended
  const road = makeRoad(pts, true);
  const markS = {};
  for (const k in marks) markS[k] = pts[shift(marks[k])].s;
  const e0 = pts[9].e;
  for (const p of pts) p.e -= e0; // the cabin sits at elevation 0
  road.homeS = pts[9].s;
  road.marks = markS;
  road.summitS = markS.summit;
  road.startLineS = 0;
  return road;
}

export const ROAD = buildHomeLoop();

function buildBranches(road) {
  return BRANCH_DEFS.map((d) => {
    const s0 = (d.at === 'end' ? road.length : road.marks[d.at]) + d.offset;
    const j = road.sampleAtS(s0);
    const h = Math.atan2(j.tz, j.tx) + d.side * (Math.PI / 2) * 0.85;
    const w = walk(d.segs, j.x, j.z, h, j.e);
    const br = makeRoad([{ x: j.x, z: j.z, e: j.e }, ...w.pts], false);
    return { ...d, ...br, junctionS: s0, half: BRANCH_HALF };
  });
}

export const BRANCHES = buildBranches(ROAD);

// Back-compat helpers for the home loop (used by the 2D map).
export const sampleAtS = (s) => ROAD.sampleAtS(s);
export const nearestOnRoad = (x, z, hint, w) => ROAD.nearest(x, z, hint, w);

// Nearest point on a side road (they're short, so a full scan is cheap).
export function nearestOnBranch(br, x, z) {
  return br.nearest(x, z, -1);
}

export const HOME_NET = {
  id: 'home', home: true, road: ROAD, branches: BRANCHES,
  lines: [ROAD.startLineS],
};

// ---------- race courses ----------
// Kansei Pass: generated from blocks (esses, switchback pairs, 90s, sweepers) with a fixed seed so the
// layout is the same for everyone, and rejected/retried until no part of the road crowds another.
function windingSegments(rnd, targetLen) {
  const segs = [];
  let h = 0, len = 0; // heading relative to the course's overall direction
  const R = (a, b) => a + rnd() * (b - a);
  const add = (seg) => { segs.push(seg); len += seg.len || (Math.abs(seg.turn) * Math.PI / 180) * seg.r; h += (seg.turn || 0); };
  const grade = () => -R(0.03, 0.09);
  // Pick a turn direction that tends to bring the heading back toward the course direction.
  const toward = () => (h > 50 ? -1 : h < -50 ? 1 : rnd() < 0.5 ? -1 : 1);
  while (len < targetLen) {
    const kind = rnd();
    const g = grade();
    if (kind < 0.32) {                          // esses: 3-4 sharp alternating corners
      let sign = toward();
      const n = 3 + Math.floor(rnd() * 2);
      for (let i = 0; i < n; i++) { add({ r: R(13, 24), turn: sign * R(65, 115), grade: g }); sign = -sign; }
    } else if (kind < 0.6) {                   // switchback pair: hairpin, short leg, hairpin back
      const sign = rnd() < 0.5 ? -1 : 1;
      add({ r: R(9, 12), turn: sign * 180, grade: g * 0.6, name: 'Hairpin' });
      add({ r: R(50, 80), turn: -sign * R(10, 25), grade: g });
      add({ r: R(9, 12), turn: -sign * 180, grade: g * 0.6, name: 'Hairpin' });
    } else if (kind < 0.8) {                    // square-ish 90s
      const sign = toward();
      add({ r: R(13, 20), turn: sign * 90, grade: g });
      add({ r: R(40, 70), turn: -sign * R(15, 30), grade: g });
      add({ r: R(13, 20), turn: -sign * R(60, 90), grade: g });
    } else if (kind < 0.88) {                   // fast sweeper
      add({ r: R(40, 60), turn: toward() * R(45, 75), grade: g });
    } else {                                    // single hairpin into a kink
      const sign = toward();
      add({ r: R(9.5, 12), turn: sign * 160, grade: g * 0.6, name: 'Hairpin' });
      add({ r: R(30, 50), turn: -sign * R(40, 70), grade: g });
    }
    add({ r: R(60, 110), turn: (rnd() < 0.5 ? -1 : 1) * R(5, 12), grade: g }); // short link, never straight
  }
  return segs;
}

// Switchback Ladder: nine straights joined by eight hairpins, down the face of the mountain.
function ladderSegments() {
  const segs = [];
  const legs = [230, 210, 240, 200, 225, 215, 235, 205, 220];
  const radii = [11, 10.5, 12, 10, 11.5, 10, 11, 10.5];
  legs.forEach((L, i) => {
    segs.push({ len: L, grade: -0.06 });
    if (i < radii.length) segs.push({ r: radii[i], turn: (i % 2 ? -1 : 1) * 180, grade: -0.04, name: 'Hairpin' });
  });
  return segs;
}

// Does the road crowd itself anywhere (non-neighboring parts closer than minGap)?
function crowded(pts, minGap) {
  const CELLG = minGap, grid = new Map();
  pts.forEach((p, i) => { const k = `${Math.floor(p.x / CELLG)},${Math.floor(p.z / CELLG)}`; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
  for (let i = 0; i < pts.length; i += 2) {
    const p = pts[i], cx = Math.floor(p.x / CELLG), cz = Math.floor(p.z / CELLG);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      for (const j of grid.get(`${cx + a},${cz + b}`) || []) {
        if (Math.abs(j - i) < 70) continue;
        if ((pts[j].x - p.x) ** 2 + (pts[j].z - p.z) ** 2 < minGap * minGap) return true;
      }
    }
  }
  return false;
}

function buildCourse({ id, name, segments, seed, targetLen, minGap }) {
  let segs = segments, pts;
  if (!segs) {
    for (let attempt = 0; attempt < 500; attempt++) {
      segs = windingSegments(seeded(seed + attempt * 7919), targetLen);
      pts = walk(segs, 0, 0, 0, 120).pts;
      if (!crowded(pts, minGap)) break;
    }
  } else pts = walk(segs, 0, 0, 0, 120).pts;
  pts = [{ x: 0, z: 0, e: 120 }, ...pts];
  smoothElevation(pts, 10, false);
  const road = makeRoad(pts, false);
  road.bestLine = optimalOffsets(road);
  const startS = 30, finishS = road.length - 30;
  return {
    id, name, home: false, road, branches: [],
    lines: [startS, finishS],
    startS, finishS,
    hairpins: segs.filter((x) => x.name === 'Hairpin').length,
  };
}

export const COURSES = {
  pass: buildCourse({ id: 'pass', name: 'Kansei Pass', seed: 7, targetLen: 1650, minGap: 20 }),
  ladder: buildCourse({ id: 'ladder', name: 'Switchback Ladder', segments: ladderSegments(), minGap: 18 }),
};

ROAD.bestLine = optimalOffsets(ROAD);
