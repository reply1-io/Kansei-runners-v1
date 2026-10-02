// Road networks. Each network is a main road (closed loop or open point-to-point), optional side
// roads, and a racing line. Roads are built "turtle style" from arcs and straights, so every hairpin
// radius and grade is exact.
//   HOME_NET   the loop around the mountain in front of the cabin (free driving) + closed side roads
//   COURSES    the race courses: Kansei Pass (ultra-winding) and Switchback Ladder (straight, hairpin, repeat)
// Units are meters. The 2D home map uses map units: 1 map unit = U meters.
import { seeded } from './draw.js';

export const U = 0.088;           // meters per map unit (a 50-unit car on the map = 4.4 m)
export const ROAD_HALF = 4.2;     // two 4.2 m lanes
const CONNECTOR_HALF = 3.4;       // the roads out to the race courses
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
  { r: 80, turn: 25, grade: 0.07, mark: 'north' },
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

// Roads out to the race courses: where they leave the loop (a named mark, plus meters after it),
// which side, their first bends, and where that course's start line sits from there (`place`: the
// start is `d` m away at `a` degrees off the road's heading, the course heads `b` degrees off it,
// optionally mirrored). A smooth curve joins the bends to the start line.
const BRANCH_DEFS = [
  { id: 'lookout', name: 'Summit Lookout', to: 'pass', at: 'summit', offset: 30, side: -1, segs: [{ r: 40, turn: -25, grade: 0.03 }, { r: 60, turn: 40, grade: 0.02 }, { r: 50, turn: -20, grade: 0.01 }, { r: 120, turn: -15, grade: -0.02 }, { len: 60, grade: -0.03 }], place: { a: 0, d: 120, b: 70 } },
  { id: 'logging', name: 'Old Logging Road', to: 'yamabiko', at: 'logging', offset: 12, side: -1, segs: [{ r: 60, turn: 30, grade: -0.01 }, { r: 45, turn: -45, grade: 0.02 }, { r: 80, turn: 20, grade: 0.01 }, { r: 90, turn: -20, grade: 0.03 }, { len: 50, grade: 0.03 }], place: { a: -50, d: 120, b: -30 } },
  { id: 'town', name: 'Road to Town', to: 'canyon', at: 'valley', offset: 10, side: -1, segs: [{ r: 50, turn: -30, grade: -0.02 }, { r: 70, turn: 35, grade: -0.02 }, { r: 60, turn: -15, grade: -0.01 }, { r: 140, turn: 12, grade: 0 }, { len: 70, grade: 0 }], place: { a: 20, d: 170, b: -60, mirror: true } },
  { id: 'cliff', name: 'Cliff Road', to: 'ladder', at: 'north', offset: 20, side: -1, segs: [{ r: 45, turn: -30, grade: 0.02 }, { r: 70, turn: 30, grade: 0.03 }, { r: 90, turn: -15, grade: 0.02 }, { len: 70, grade: 0.01 }], place: { a: -40, d: 120, b: 20, mirror: true } },
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
      pts.push({ x, z, e, name: seg.name, half: seg.half, canyon: seg.canyon ? 1 : 0 });
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

// Road width (half, m) and canyon walls (0..1) per sample, eased in and out over ~30/80 m.
function smoothWidths(pts, defHalf) {
  const N = pts.length;
  const half = pts.map((p) => p.half ?? defHalf), can = pts.map((p) => p.canyon || 0);
  const avg = (arr, W, i) => { let sum = 0, n = 0; for (let j = Math.max(0, i - W); j <= Math.min(N - 1, i + W); j++) { sum += arr[j]; n++; } return sum / n; };
  for (let i = 0; i < N; i++) { pts[i].half = avg(half, 15, i); pts[i].canyon = avg(can, 40, i); }
}

// Turn a list of points into a road: distances, tangents, normals, grade, curvature, and lookups.
export function makeRoad(pts, loop) {
  const N = pts.length;
  const at = (i) => (loop ? pts[(i + N) % N] : pts[Math.max(0, Math.min(N - 1, i))]);
  for (const p of pts) { if (p.half === undefined) p.half = ROAD_HALF; if (!p.canyon) p.canyon = 0; }
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
        half: A.half + (B.half - A.half) * t, canyon: A.canyon,
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
      // Off the end of an open road, unless another road carries on from that end.
      const pastEnd = !loop && ((best === N - 1 && along > -1.5 && !road.joinedEnd) || (best === 0 && along < 1.5 && !road.joinedStart));
      return { i: best, p, lat, s: wrapS(p.s + along), dist: Math.sqrt(bd), pastEnd };
    },
  };
  return road;
}

// ---------- racing lines ----------
// Minimum-curvature line: an "elastic band" relaxed inside the road edges. It naturally goes
// wide - apex - wide through corners. Returns lateral offsets (m) per sample.
function optimalOffsets(road, margin = 1.15) {
  const S = road.samples, N = S.length, loop = road.loop;
  const lims = S.map((p) => Math.max(0.3, p.half - margin));
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
        off[i] = Math.max(-lims[i], Math.min(lims[i], off[i] + 0.6 * (target - off[i])));
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
  const best = road.bestLine;
  const off = S.map((p, i) => { const lim = Math.max(0.3, p.half - 1.1); return Math.max(-lim, Math.min(lim, q * best[i] + (1 - q) * Math.min(lane, p.half * 0.48))); });
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

// The first bends of each road out to a course (its own walk from the junction on the loop).
const BRANCH_STARTS = BRANCH_DEFS.map((d) => {
  const s0 = ROAD.marks[d.at] + d.offset;
  const j = ROAD.sampleAtS(s0);
  const h = Math.atan2(j.tz, j.tx) + d.side * (Math.PI / 2) * 0.85;
  const w = walk(d.segs, j.x, j.z, h, j.e);
  return { def: d, junctionS: s0, pts: [{ x: j.x, z: j.z, e: j.e }, ...w.pts], end: { x: w.x, z: w.z, h: w.h, e: w.e } };
});

// Back-compat helpers for the home loop (used by the 2D map).
export const sampleAtS = (s) => ROAD.sampleAtS(s);
export const nearestOnRoad = (x, z, hint, w) => ROAD.nearest(x, z, hint, w);

// ---------- race courses ----------
// Generated courses are built from blocks with a fixed seed so the layout is the same for everyone,
// and rejected/retried until no part of the road crowds another.

// Kansei Pass: esses, switchback pairs, 90s and sweepers, downhill all the way.
// Yamabiko (`climbs`): the same tight blocks on a narrower road that climbs and drops in big stages.
function windingSegments(rnd, targetLen, { half, climbs = false } = {}) {
  const segs = [];
  let h = 0, len = 0; // heading relative to the course's overall direction
  const R = (a, b) => a + rnd() * (b - a);
  const add = (seg) => { segs.push(half ? { ...seg, half } : seg); len += seg.len || (Math.abs(seg.turn) * Math.PI / 180) * seg.r; h += (seg.turn || 0); };
  // Climbs: up, down, up, down in four stages; otherwise always downhill.
  const grade = () => {
    if (!climbs) return -R(0.03, 0.09);
    const f = len / targetLen;
    return (f < 0.3 || (f > 0.55 && f < 0.72) ? 1 : -1) * R(0.07, 0.13);
  };
  // Pick a turn direction that tends to bring the heading back toward the course direction.
  const toward = () => (h > 50 ? -1 : h < -50 ? 1 : rnd() < 0.5 ? -1 : 1);
  while (len < targetLen) {
    const kind = rnd();
    const g = grade();
    if (kind < 0.32) {                          // esses: 3-4 sharp alternating corners
      let sign = toward();
      const n = 3 + Math.floor(rnd() * 2);
      for (let i = 0; i < n; i++) { add({ r: R(13, 24), turn: sign * R(65, 115), grade: g }); sign = -sign; }
    } else if (kind < (climbs ? 0.45 : 0.6)) {  // switchback pair: hairpin, short leg, hairpin back
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

// Kuroiwa Canyon: a wide, fast road of long flowing corners and only two hairpins. It climbs into the
// mountain, runs through a rock canyon in the middle, then drops out the other side.
function flowingSegments(rnd, targetLen) {
  const segs = [];
  let h = 0, len = 0, hairpins = 0;
  const R = (a, b) => a + rnd() * (b - a);
  const add = (seg) => { segs.push(seg); len += seg.len || (Math.abs(seg.turn) * Math.PI / 180) * seg.r; h += (seg.turn || 0); };
  const toward = () => (h > 80 ? -1 : h < -80 ? 1 : rnd() < 0.5 ? -1 : 1);
  while (len < targetLen) {
    const f = len / targetLen;
    const canyon = f > 0.38 && f < 0.64;
    const g = f < 0.38 ? R(0.02, 0.05) : canyon ? R(-0.01, 0.015) : -R(0.03, 0.06);
    const base = { grade: g, ...(canyon ? { canyon: true } : {}) };
    if (!canyon && hairpins < 2 && ((hairpins === 0 && f > 0.22) || (hairpins === 1 && f > 0.78))) {
      const sign = toward();                    // one of the two hairpins, with a long run-in
      add({ len: R(90, 140), ...base });
      add({ r: R(14, 17), turn: sign * R(150, 170), ...base, grade: g * 0.6, name: 'Hairpin' });
      add({ r: R(90, 130), turn: -sign * R(50, 70), ...base });
      hairpins++;
      continue;
    }
    const kind = rnd();
    if (kind < 0.3) {                           // long sweeper
      add({ r: R(140, 260), turn: toward() * R(25, 60), ...base });
    } else if (kind < 0.58) {                   // flowing S: left-right
      const sign = toward();
      add({ r: R(70, 140), turn: sign * R(30, 60), ...base });
      add({ r: R(70, 140), turn: -sign * R(30, 60), ...base });
    } else if (kind < 0.76) {                   // tightening corner
      const sign = toward();
      add({ r: R(130, 200), turn: sign * R(20, 35), ...base });
      add({ r: R(60, 85), turn: sign * R(35, 60), ...base });
    } else if (kind < 0.9) {                    // short straight into a fast kink
      add({ len: R(60, 140), ...base });
      add({ r: R(200, 320), turn: toward() * R(8, 18), ...base });
    } else {                                    // long double-apex
      const sign = toward();
      add({ r: R(90, 120), turn: sign * R(30, 45), ...base });
      add({ len: R(20, 40), ...base });
      add({ r: R(90, 120), turn: sign * R(30, 45), ...base });
    }
  }
  return segs;
}

// Switchback Ladder: a stack of three hairpins, a flowing run of S-bends across the face, a one-lane
// stretch along the cliff, a second stack (one leg with a fast kink in it), and S-bends to the finish.
function ladderSegments() {
  const HP = (r, turn) => ({ r, turn, grade: -0.04, name: 'Hairpin' });
  const ONE = 2.3; // one lane
  return [
    { len: 200, grade: -0.06 }, HP(11, 180),
    { len: 210, grade: -0.06 }, HP(10.5, -180),
    { len: 225, grade: -0.06 }, HP(12, 180),
    { len: 110, grade: -0.05 },
    // Flowing S-bends down across the face.
    { r: 55, turn: -90, grade: -0.05 },
    { r: 120, turn: 35, grade: -0.05 }, { r: 90, turn: -55, grade: -0.05 }, { r: 140, turn: 40, grade: -0.05 }, { r: 100, turn: -20, grade: -0.04 },
    { r: 65, turn: 90, grade: -0.04 },
    // One lane along the cliff.
    { len: 60, grade: -0.04, half: ONE }, { r: 70, turn: 22, grade: -0.05, half: ONE }, { r: 70, turn: -22, grade: -0.05, half: ONE },
    { len: 70, grade: -0.05, half: ONE }, { r: 85, turn: -16, grade: -0.05, half: ONE }, { r: 85, turn: 16, grade: -0.05, half: ONE }, { len: 60, grade: -0.04 },
    // Second stack.
    HP(10.5, -180),
    { len: 80, grade: -0.06 }, { r: 220, turn: 12, grade: -0.06 }, { r: 220, turn: -12, grade: -0.06 }, { len: 60, grade: -0.06 }, HP(11, 180),
    { len: 215, grade: -0.06 }, HP(11.5, -180),
    { len: 200, grade: -0.06 }, HP(10, 180),
    { len: 120, grade: -0.05 },
    // S-bends to the finish.
    { r: 80, turn: -50, grade: -0.04 }, { r: 120, turn: 45, grade: -0.04 }, { r: 150, turn: 5, grade: -0.03 }, { len: 110, grade: -0.02 },
  ];
}

// Does the road crowd itself anywhere? Parts more than 250 m apart along the road must stay `minGap`
// apart; nearby parts (the legs either side of a hairpin) only `nearGap`.
function crowded(pts, minGap, nearGap = minGap) {
  const CELLG = minGap, grid = new Map();
  pts.forEach((p, i) => { const k = `${Math.floor(p.x / CELLG)},${Math.floor(p.z / CELLG)}`; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
  for (let i = 0; i < pts.length; i += 2) {
    const p = pts[i], cx = Math.floor(p.x / CELLG), cz = Math.floor(p.z / CELLG);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      for (const j of grid.get(`${cx + a},${cz + b}`) || []) {
        const sep = Math.abs(j - i);
        if (sep < 70) continue;
        const gap = sep < 250 ? nearGap : minGap;
        if ((pts[j].x - p.x) ** 2 + (pts[j].z - p.z) ** 2 < gap * gap) return true;
      }
    }
  }
  return false;
}

// A course's shape in its own frame: starts at the origin heading +x at elevation 120.
function localCourse({ segments, generate, seed, targetLen, minGap, nearGap, half = ROAD_HALF }) {
  let segs = segments, pts;
  if (!segs) {
    for (let attempt = 0; attempt < 800; attempt++) {
      segs = generate(seeded(seed + attempt * 7919), targetLen);
      pts = walk(segs, 0, 0, 0, 120).pts;
      if (!crowded(pts, minGap, nearGap)) break;
    }
  } else pts = walk(segs, 0, 0, 0, 120).pts;
  pts = [{ x: 0, z: 0, e: 120 }, ...pts];
  smoothElevation(pts, 10, false);
  smoothWidths(pts, half);
  return { pts, segs };
}

// Move a course into the world: start at (x, z, e) heading h, optionally mirrored left-right.
function placePts(pts, { x, z, h, e, mirror = false }) {
  const c = Math.cos(h), sn = Math.sin(h), m = mirror ? -1 : 1;
  return pts.map((p) => ({ ...p, x: x + p.x * c - p.z * m * sn, z: z + p.x * sn + p.z * m * c, e: p.e - 120 + e }));
}

const COURSE_DEFS = {
  pass: { id: 'pass', name: 'Kansei Pass', generate: windingSegments, seed: 7, targetLen: 1650, minGap: 20 },
  ladder: { id: 'ladder', name: 'Switchback Ladder', segments: ladderSegments(), minGap: 18 },
  canyon: { id: 'canyon', name: 'Kuroiwa Canyon', generate: flowingSegments, seed: 23, targetLen: 8800, minGap: 70, nearGap: 26, half: 5.6 },
  yamabiko: { id: 'yamabiko', name: 'Yamabiko Mountain Road', generate: (rnd, L) => windingSegments(rnd, L, { half: 3.3, climbs: true }), seed: 41, targetLen: 4300, minGap: 22, nearGap: 18, half: 3.3, roadStyle: 'narrow' },
};
const LOCAL = Object.fromEntries(Object.entries(COURSE_DEFS).map(([k, d]) => [k, localCourse(d)]));

// Heights along a joining road: a smooth cubic over its length from e0 (leaving at grade g0) to e1
// (arriving at grade g1), so it meets both roads without a step or a kink. `tail` is any distance left
// between the last point and the road it meets.
function easeElevation(pts, e0, g0, e1, g1, tail = 0) {
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  const L = s[s.length - 1] + tail || 1;
  pts.forEach((p, i) => {
    const t = s[i] / L, t2 = t * t, t3 = t2 * t;
    p.e = (2 * t3 - 3 * t2 + 1) * e0 + (t3 - 2 * t2 + t) * L * g0 + (-2 * t3 + 3 * t2) * e1 + (t3 - t2) * L * g1;
  });
}

// The road from the end of a side road's first bends to a course's start line: a smooth curve that
// arrives lined up with the course, climbing or dropping evenly.
function connectorPts(E, S) {
  const pts = hermite({ x: E.x, z: E.z }, E.h, { x: S.x, z: S.z }, S.h);
  pts.forEach((p, i) => { p.e = E.e + (S.e - E.e) * ((i + 1) / (pts.length + 1)); p.half = CONNECTOR_HALF; });
  return pts;
}

// Test hook for laying the courses out (scratch scripts).
export const __layout = { LOCAL, placePts, connectorPts, makeRoad, BRANCH_STARTS, hermite };

// Where a road leaves (or joins) another one at an angle, its mouth flares out like a real junction:
// it widens over FLARE_LEN m from the other road's edge, and the renderer pins the flared edges onto
// that edge so its lines sweep round into it. Records `mouths` ({ road, at, s }: s = where the road
// clears the other one's edge).
const FLARE_W = 4;
export const FLARE_LEN = 14;
function flareMouths(conn, joins) {
  const S = conn.samples, N = S.length;
  conn.mouths = joins.map(({ road, at }) => {
    const order = at === 'start' ? [...S.keys()] : [...S.keys()].reverse();
    let edge = order[order.length - 1];
    for (const i of order) { const n = road.nearest(S[i].x, S[i].z, -1); if (n.dist > n.p.half + 0.2) { edge = i; break; } }
    const sEdge = S[edge].s;
    for (const p of S) {
      const d = at === 'start' ? p.s - sEdge : sEdge - p.s;
      if (d < FLARE_LEN) p.half += FLARE_W * (1 - Math.max(0, d) / FLARE_LEN) ** 2;
    }
    return { road, at, s: sEdge };
  });
  void N;
}

// ---------- the whole map ----------
// Everything is one connected world: the home loop, a road out from it to each course, and the
// courses themselves. Every road knows its id, name, surface style and whether its far end is closed.
const D2R = Math.PI / 180;
ROAD.id = 'home'; ROAD.name = 'Home loop'; ROAD.style = 'two';
const CONNECTORS = [], COURSE_ROADS = {};
export const COURSES = {};
for (const st of BRANCH_STARTS) {
  const d = st.def, def = COURSE_DEFS[d.to], E = st.end, P = d.place;
  const S = { x: E.x + Math.cos(E.h + P.a * D2R) * P.d, z: E.z + Math.sin(E.h + P.a * D2R) * P.d, h: E.h + P.b * D2R, e: E.e };
  // The connector: first bends, then the curve onto the course's first point.
  const cp = [...st.pts, ...connectorPts(E, S)];
  // Height: one smooth curve from the junction (level across the loop) onto the course's own slope.
  const lp = LOCAL[d.to].pts;
  easeElevation(cp, st.pts[0].e, 0, S.e + lp[0].e - 120, (lp[6].e - lp[0].e) / 6, Math.hypot(S.x - cp[cp.length - 1].x, S.z - cp[cp.length - 1].z));
  smoothWidths(cp, CONNECTOR_HALF);
  // Widen (or narrow) over the last 40 m to meet the course's width exactly.
  const endHalf = lp[0].half;
  cp.forEach((p, i) => { const t = Math.max(0, 1 - (cp.length - 1 - i) / 40); p.half = CONNECTOR_HALF + (endHalf - CONNECTOR_HALF) * t * t * (3 - 2 * t); });
  const conn = makeRoad(cp, false);
  Object.assign(conn, { id: d.id, name: d.name, to: d.to, style: 'two', junctionS: st.junctionS, joinedStart: true, joinedEnd: true });
  flareMouths(conn, [{ road: ROAD, at: 'start' }]);
  CONNECTORS.push(conn);
  // The course, moved into place.
  const local = LOCAL[d.to];
  const road = makeRoad(placePts(local.pts, { ...S, mirror: !!P.mirror }), false);
  road.bestLine = optimalOffsets(road);
  Object.assign(road, { id: d.to, name: def.name, style: def.roadStyle || 'two', closedEnd: true, joinedStart: true });
  COURSE_ROADS[d.to] = road;
  const startS = 30, finishS = road.length - 30;
  COURSES[d.to] = {
    id: d.to, name: def.name, home: false, worldId: 'world', road, roadStyle: def.roadStyle,
    lines: [startS, finishS], startS, finishS, gateway: d.id,
    hairpins: local.segs.filter((x) => x.name === 'Hairpin').length,
  };
}
// Keep the courses in the order of the Touge app.
const ORDER = ['pass', 'ladder', 'canyon', 'yamabiko'];
for (const k of ORDER) { const c = COURSES[k]; delete COURSES[k]; COURSES[k] = c; }

// ---------- the ring road ----------
// A big loop round the outside of the whole map, inside a tall rock wall. MAP RULE: every road on
// the map lives inside the ring; new roads go inside it, never outside.
// Its shape is a rounded rectangle (superellipse) RING_MARGIN m outside everything else, with long
// flowing bends layered on; its height follows the land inside it, plus some rise and fall.
const RING_MARGIN = 330;
function buildRing(inner) {
  const all = inner.flatMap((r) => r.samples);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of all) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ax = (x1 - x0) / 2 + RING_MARGIN, az = (z1 - z0) / 2 + RING_MARGIN;
  const raw = [];
  const M = 6000, n = 4;
  for (let i = 0; i < M; i++) {
    const t = (i / M) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
    const bx = Math.sign(c) * Math.abs(c) ** (2 / n) * ax, bz = Math.sign(sn) * Math.abs(sn) ** (2 / n) * az;
    // Bends: pushed in and out along the direction from the centre.
    const w = 60 + 70 * Math.sin(9 * t + 1) + 35 * Math.sin(23 * t + 2) + 16 * Math.sin(47 * t + 0.5);
    const L = Math.hypot(bx, bz) || 1;
    raw.push({ x: cx + bx + (bx / L) * w, z: cz + bz + (bz / L) * w });
  }
  // Even spacing, then smoothed (moving average round the loop) so no bend is tighter than intended.
  let pts = resample([...raw, raw[0]]).slice(0, -1);
  for (let pass = 0; pass < 3; pass++) {
    const N0 = pts.length, W = 30;
    pts = pts.map((_, i) => { let x = 0, z = 0; for (let k = -W; k <= W; k++) { const q = pts[(i + k + N0) % N0]; x += q.x; z += q.z; } return { x: x / (2 * W + 1), z: z / (2 * W + 1) }; });
  }
  pts = resample([...pts, pts[0]]).slice(0, -1);
  // Height: what the land inside is doing nearby (an inverse-distance blend of the inner roads), smoothed
  // out a lot, plus long rises and dips.
  const coarse = all.filter((_, i) => i % 9 === 0), N = pts.length;
  const base = [];
  for (let i = 0; i < N; i += 25) {
    const p = pts[i]; let ws = 0, es = 0;
    for (const q of coarse) { const w = 1 / ((q.x - p.x) ** 2 + (q.z - p.z) ** 2 + 1e4) ** 1.5; ws += w; es += w * q.e; }
    base.push(es / ws);
  }
  pts.forEach((p, i) => {
    const k = i / 25, a = Math.floor(k), f = k - a, b0 = base[a % base.length], b1 = base[(a + 1) % base.length];
    const t = (i / N) * Math.PI * 2;
    p.e = b0 + (b1 - b0) * f + 22 * Math.sin(5 * t + 0.7) + 9 * Math.sin(13 * t + 2.1);
    p.half = ROAD_HALF; p.canyon = 0;
  });
  smoothElevation(pts, 120, true);
  smoothElevation(pts, 40, true);
  const road = makeRoad(pts, true);
  Object.assign(road, { id: 'ring', name: 'Ring Road', style: 'two', center: { x: cx, z: cz } });
  // Which way is outward at each point (towards the wall).
  for (const p of road.samples) p.out = Math.sign((p.x - cx) * p.nx + (p.z - cz) * p.nz) || 1;
  return road;
}
export const RING = buildRing([ROAD, ...CONNECTORS, ...Object.values(COURSE_ROADS)]);

// Links out to the ring: from the home loop, and on from the far end of each course that runs out
// towards the edge. Each one meets the ring at a T-junction, at the nearby point that gives the
// shortest smooth road clear of every other road.
const RING_LINKS = [
  { id: 'ring-west', name: 'Ring Road West', from: { loop: 820, side: -1 } },
  { id: 'ring-north', name: 'Pass Ring Link', from: { course: 'pass' } },
  { id: 'ring-yamabiko', name: 'Yamabiko Ring Link', from: { course: 'yamabiko' } },
  { id: 'ring-east', name: 'Canyon Ring Link', from: { course: 'canyon' } },
];
function buildRingLinks() {
  const others = [ROAD, ...CONNECTORS, ...Object.values(COURSE_ROADS)];
  const CELL = 40, grid = new Map(), key = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
  for (const r of others) r.samples.forEach((p, i) => { if (i % 3) return; const k = key(p.x, p.z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push({ p, r }); });
  const clearOf = (pts, skip) => {
    for (let i = 0; i < pts.length; i += 3) {
      const q = pts[i], cxk = Math.floor(q.x / CELL), czk = Math.floor(q.z / CELL);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const o of grid.get(`${cxk + a},${czk + b}`) || []) {
        if (skip(o, i)) continue;
        if ((o.p.x - q.x) ** 2 + (o.p.z - q.z) ** 2 < 40 * 40) return false;
      }
    }
    return true;
  };
  const minR = (pts) => { let mr = Infinity; for (let i = 5; i < pts.length - 5; i++) { const a = pts[i - 5], b = pts[i], c = pts[i + 5]; let d = Math.atan2(c.z - b.z, c.x - b.x) - Math.atan2(b.z - a.z, b.x - a.x); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; mr = Math.min(mr, 10 / Math.max(1e-6, Math.abs(d))); } return mr; };
  const links = [];
  for (const L of RING_LINKS) {
    let start, startRoad, startHalf;
    if (L.from.loop !== undefined) {
      const j = ROAD.sampleAtS(L.from.loop);
      start = { x: j.x, z: j.z, e: j.e, h: Math.atan2(j.tz, j.tx) + L.from.side * (Math.PI / 2) * 0.85 };
      startRoad = ROAD; startHalf = CONNECTOR_HALF;
    } else {
      const c = COURSE_ROADS[L.from.course], e = c.samples[c.samples.length - 1];
      start = { x: e.x, z: e.z, e: e.e, h: Math.atan2(e.tz, e.tx) };
      startRoad = c; startHalf = e.half;
    }
    let best = null;
    for (let i = 0; i < RING.samples.length; i += 15) {
      const P = RING.samples[i], d = Math.hypot(P.x - start.x, P.z - start.z);
      if (d > 1300 || d < 120) continue;
      const end = { x: P.x, z: P.z, h: Math.atan2(P.nz * P.out, P.nx * P.out) };
      const mid = hermite(start, start.h, end, end.h);
      if (mid.length > (best ? best.pts.length : Infinity)) continue;
      if (Math.abs(P.e - start.e) / mid.length > 0.08) continue;
      if (minR([start, ...mid, end]) < 45) continue;
      if (!clearOf(mid, (o, k) => (o.r === startRoad && k < 40))) continue;
      best = { pts: mid, P, end };
    }
    if (!best) continue; // (no clean route from here)
    const cp = [{ x: start.x, z: start.z, e: start.e }, ...best.pts];
    cp.forEach((p, i) => { const t = Math.min(1, i / 40); p.half = startHalf + (CONNECTOR_HALF - startHalf) * t * t * (3 - 2 * t); p.canyon = 0; });
    // Height: carry on at the course's own slope (or level off the loop), easing to level at the ring.
    const g0 = L.from.loop !== undefined ? 0 : startRoad.samples[startRoad.samples.length - 1].grade;
    easeElevation(cp, start.e, g0, best.P.e, 0, Math.hypot(best.P.x - cp[cp.length - 1].x, best.P.z - cp[cp.length - 1].z));
    const link = makeRoad(cp, false);
    Object.assign(link, { id: L.id, name: L.name, style: 'two', joinedStart: true, joinedEnd: true, link: true });
    if (L.from.loop !== undefined) { link.junctionS = L.from.loop; flareMouths(link, [{ road: ROAD, at: 'start' }, { road: RING, at: 'end' }]); }
    else {
      flareMouths(link, [{ road: RING, at: 'end' }]);
      startRoad.joinedEnd = true; startRoad.closedEnd = false; // the course carries on to the ring
    }
    links.push(link);
  }
  return links;
}
const LINKS = buildRingLinks();

export const ALL_ROADS = [ROAD, ...CONNECTORS, ...ORDER.map((k) => COURSE_ROADS[k]), RING, ...LINKS];
for (const r of ALL_ROADS) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of r.samples) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  r.bbox = { x0, x1, z0, z1 };
}
// While driving, the road you're racing on (or the home loop) is the main road; all the others are
// `branches` you can drive onto.
for (const c of Object.values(COURSES)) c.branches = ALL_ROADS.filter((r) => r !== c.road);
export const HOME_NET = {
  id: 'home', worldId: 'world', home: true, road: ROAD, branches: ALL_ROADS.filter((r) => r !== ROAD),
  lines: [ROAD.startLineS],
};
// What the 3D world is built from: every road, and the painted start/finish lines.
export const WORLD = {
  id: 'world', home: true, roads: ALL_ROADS,
  lines: [{ road: ROAD, s: ROAD.startLineS }, ...ORDER.flatMap((k) => COURSES[k].lines.map((s) => ({ road: COURSES[k].road, s })))],
};

ROAD.bestLine = optimalOffsets(ROAD);

// Apexes: the tightest point of each real corner (radius under ~45 m), at least 30 m apart.
// `inside` is +1 when the corner turns towards the road's left normal (+lat), -1 otherwise.
// Used for the dirt cut-throughs (world3d) and the apex bonus markers (races).
export function apexesOf(road) {
  if (road.apexes) return road.apexes;
  const P = road.samples, N = P.length, out = [];
  for (let i = 0; i < N; i++) {
    const k = P[i].k;
    if (k < 1 / 45) continue;
    if (!road.loop && (P[i].s < 25 || P[i].s > road.length - 25)) continue;
    let peak = true;
    for (let j = -6; j <= 6 && peak; j++) {
      if (!j) continue;
      const q = road.loop ? P[(i + j + N) % N] : P[Math.max(0, Math.min(N - 1, i + j))];
      if (q.k > k || (q.k === k && j < 0)) peak = false;
    }
    if (!peak) continue;
    const last = out[out.length - 1];
    if (last && P[i].s - last.s < 30) { if (k > last.k) out[out.length - 1] = { s: P[i].s, i, k, inside: Math.sign(P[i].kSigned) || 1 }; continue; }
    out.push({ s: P[i].s, i, k, inside: Math.sign(P[i].kSigned) || 1 });
  }
  road.apexes = out;
  return out;
}

