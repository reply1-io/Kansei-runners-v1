// The road network: one closed touge loop that passes in front of the cabin, plus side roads that
// branch off it (closed for now; they end at a barrier). Built "turtle style" from arcs only, so there
// are no dead-straight sections, and every hairpin radius and grade is exact.
// Units are meters. The 2D home map uses map units: 1 map unit = U meters.

export const U = 0.088;           // meters per map unit (a 50-unit car on the map = 4.4 m)
export const ROAD_HALF = 4.2;     // two 4.2 m lanes
export const RAIL_OFFSET = 0.9;   // guardrail distance beyond the road edge
export const BRANCH_HALF = 3.2;   // side roads are narrower
const STEP = 1;                   // sample spacing (m)

// Where the driveway lane meets the road, in map units (see HOME in map.js). The loop leaves the
// cabin heading west (uphill) and comes back from the east.
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

function walk(segments, x, z, h, e = 0, marks = null) {
  const pts = [];
  for (const seg of segments) {
    if (marks && seg.mark) marks[seg.mark] = pts.length;
    const total = (seg.turn * Math.PI) / 180;
    const arcLen = Math.abs(total) * seg.r;
    const n = Math.max(2, Math.round(arcLen / STEP));
    const dh = total / n, ds = arcLen / n;
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

// Fill in distance, tangents, normals, grade and curvature. `loop` wraps neighbors around.
function finish(pts, loop) {
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
    pts[i].grade = (b.e - a.e) / 2;
    const W = 4, p0 = at(i - W), p1 = at(i + W);
    let da = Math.atan2(p1.tz, p1.tx) - Math.atan2(p0.tz, p0.tx);
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    pts[i].k = Math.abs(da) / (2 * W * STEP);
    pts[i].kSigned = da / (2 * W * STEP);
  }
  return length;
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

function buildLoop() {
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
  const length = finish(pts, true);
  const markS = {};
  for (const k in marks) markS[k] = pts[shift(marks[k])].s;
  const e0 = pts[9].e;
  for (const p of pts) p.e -= e0; // the cabin sits at elevation 0
  return { samples: pts, length, loop: true, homeS: pts[9].s, marks: markS };
}

export const ROAD = buildLoop();
ROAD.summitS = ROAD.marks.summit;
ROAD.startLineS = 0;
// Guardrails on the mountain; open shoulders through the valley near the cabin.
ROAD.railed = (s) => s > 60 && s < ROAD.marks.close + 40;

// Racing routes, all run in the loop's direction. Distances are along the loop from the start line.
export const ROUTES = {
  up: { name: 'Uphill', from: 0, to: ROAD.summitS, desc: 'cabin → summit' },
  down: { name: 'Downhill', from: ROAD.summitS, to: ROAD.length, desc: 'summit → cabin' },
  loop: { name: 'Full loop', from: 0, to: ROAD.length, desc: 'cabin → around the mountain → cabin' },
};

function buildBranches() {
  return BRANCH_DEFS.map((d) => {
    const s0 = (d.at === 'end' ? ROAD.length : ROAD.marks[d.at]) + d.offset;
    const j = sampleAtS(s0);
    const h = Math.atan2(j.tz, j.tx) + d.side * (Math.PI / 2) * 0.85;
    const w = walk(d.segs, j.x, j.z, h, j.e);
    const pts = [{ x: j.x, z: j.z, e: j.e }, ...w.pts];
    const length = finish(pts, false);
    return { ...d, samples: pts, length, junctionS: s0, half: BRANCH_HALF };
  });
}

const wrapS = (s) => ((s % ROAD.length) + ROAD.length) % ROAD.length;

// Interpolated point at distance s along the loop (wraps).
export function sampleAtS(s) {
  const S = ROAD.samples;
  s = wrapS(s);
  let lo = 0, hi = S.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (S[m].s <= s) lo = m; else hi = m - 1; }
  const a = S[lo], b = S[(lo + 1) % S.length];
  const segLen = lo === S.length - 1 ? ROAD.length - a.s : b.s - a.s;
  const t = segLen > 0 ? (s - a.s) / segLen : 0;
  return {
    x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, e: a.e + (b.e - a.e) * t,
    tx: a.tx, tz: a.tz, nx: a.nx, nz: a.nz, grade: a.grade, k: a.k, i: lo,
  };
}

// Nearest point on the loop, searching near `hint` so stacked switchback legs don't get confused.
export function nearestOnRoad(x, z, hint = -1, window = 70) {
  const S = ROAD.samples, N = S.length;
  let best = 0, bd = Infinity;
  const scan = (i) => { const d = (S[i].x - x) ** 2 + (S[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } };
  if (hint >= 0) for (let o = -window; o <= window; o++) scan((hint + o + N) % N);
  else for (let i = 0; i < N; i++) scan(i);
  if (hint >= 0 && bd > 30 * 30) return nearestOnRoad(x, z, -1);
  const p = S[best];
  const lat = (x - p.x) * p.nx + (z - p.z) * p.nz;
  const along = (x - p.x) * p.tx + (z - p.z) * p.tz;
  return { i: best, p, lat, s: wrapS(p.s + along), dist: Math.sqrt(bd) };
}

export const BRANCHES = buildBranches();

// Nearest point on a side road (they're short, so a full scan is cheap).
export function nearestOnBranch(br, x, z) {
  const S = br.samples;
  let best = 0, bd = Infinity;
  for (let i = 0; i < S.length; i++) { const d = (S[i].x - x) ** 2 + (S[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } }
  const p = S[best];
  const lat = (x - p.x) * p.nx + (z - p.z) * p.nz;
  const along = (x - p.x) * p.tx + (z - p.z) * p.tz;
  const pastEnd = best === S.length - 1 && along > -1.5; // the "Road closed" barrier
  return { i: best, p, lat, dist: Math.sqrt(bd), pastEnd };
}

// ---------- racing line ----------
// Minimum-curvature line: an "elastic band" relaxed inside the road edges. It naturally goes
// wide - apex - wide through corners. Offsets are lateral (m) from the centerline, per sample.
function buildRacingLine(margin = 1.15) {
  const S = ROAD.samples, N = S.length, lim = ROAD_HALF - margin;
  const off = new Float64Array(N);
  for (const k of [24, 14, 8, 4]) {
    for (let it = 0; it < 80; it++) {
      for (let i = 0; i < N; i++) {
        const a = S[(i - k + N) % N], b = S[(i + k) % N], c = S[i];
        const ax = a.x + a.nx * off[(i - k + N) % N], az = a.z + a.nz * off[(i - k + N) % N];
        const bx = b.x + b.nx * off[(i + k) % N], bz = b.z + b.nz * off[(i + k) % N];
        const target = ((ax + bx) / 2 - c.x) * c.nx + ((az + bz) / 2 - c.z) * c.nz;
        off[i] = Math.max(-lim, Math.min(lim, off[i] + 0.6 * (target - off[i])));
      }
    }
  }
  // Positions, curvature and distance along the line.
  const pts = S.map((p, i) => ({ x: p.x + p.nx * off[i], z: p.z + p.nz * off[i], e: p.e, off: off[i] }));
  let d = 0;
  for (let i = 0; i < N; i++) {
    const p = pts[i], q = pts[(i + 1) % N];
    p.d = d; p.seg = Math.hypot(q.x - p.x, q.z - p.z);
    d += p.seg;
  }
  for (let i = 0; i < N; i++) {
    const a = pts[(i - 3 + N) % N], b = pts[i], c = pts[(i + 3) % N];
    // Curvature from the circle through three points.
    const abx = b.x - a.x, abz = b.z - a.z, bcx = c.x - b.x, bcz = c.z - b.z, acx = c.x - a.x, acz = c.z - a.z;
    const cross = abx * bcz - abz * bcx;
    const k = (2 * cross) / (Math.hypot(abx, abz) * Math.hypot(bcx, bcz) * Math.hypot(acx, acz) || 1);
    b.k = Math.abs(k); b.kSigned = k;
  }
  // Light smoothing of curvature so speed targets don't flicker.
  const ks = pts.map((p) => p.k);
  for (let i = 0; i < N; i++) { let s = 0; for (let j = -3; j <= 3; j++) s += ks[(i + j + N) % N]; pts[i].k = s / 7; }
  return { pts, length: d };
}

export const RACING_LINE = buildRacingLine();
