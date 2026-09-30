// The one road in the game: a mountain touge that passes in front of the cabin.
// Built "turtle style" from straights and constant-radius arcs, so hairpin radii and grades are exact.
// Units are meters. The 2D home map uses map units: 1 map unit = U meters.

export const U = 0.088;           // meters per map unit (a 50-unit car on the map = 4.4 m)
export const ROAD_HALF = 4.2;     // two 4.2 m lanes
export const RAIL_OFFSET = 0.9;   // guardrail distance beyond the road edge
const STEP = 1;                   // sample spacing (m)

// Where the driveway lane meets the road, in map units (see HOME in map.js), and which way is uphill.
const ANCHOR_MAP = { x: 330, y: 675 };
const ANCHOR_HEADING = Math.PI;   // uphill direction at the cabin: west

// Toward the summit from the cabin. turn: degrees (+ curls toward -z/north when heading west),
// r: arc radius (m), len: straight length (m), grade: climb per meter going uphill.
const MOUNTAIN = [
  { r: 45, turn: -18, grade: 0.0 },     // the S in front of the cabin
  { r: 45, turn: 22, grade: 0.01 },
  { len: 45, grade: 0.03 },
  { r: 60, turn: 30, grade: 0.05 },     // sweeper into the climb
  { r: 45, turn: -30, grade: 0.06 },
  { len: 70, grade: 0.08 },
  { r: 11, turn: 180, grade: 0.05 },    // Hairpin 1
  { len: 55, grade: 0.09 },
  { r: 35, turn: -35, grade: 0.08 },    // quick S on the second leg
  { r: 35, turn: 35, grade: 0.08 },
  { len: 25, grade: 0.09 },
  { r: 10, turn: -180, grade: 0.05 },   // Hairpin 2
  { len: 105, grade: 0.1 },
  { r: 12, turn: 180, grade: 0.05 },    // Hairpin 3
  { len: 40, grade: 0.09 },
  { r: 70, turn: -25, grade: 0.07 },    // fast kink
  { r: 70, turn: 25, grade: 0.07 },
  { len: 15, grade: 0.08 },
  { r: 9.5, turn: -180, grade: 0.04 },  // Hairpin 4 (tightest)
  { len: 60, grade: 0.1 },
  { r: 22, turn: 90, grade: 0.07 },     // right-angle pair
  { len: 45, grade: 0.09 },
  { r: 22, turn: -90, grade: 0.07 },
  { len: 45, grade: 0.08 },
  { r: 11, turn: 180, grade: 0.05 },    // Hairpin 5
  { len: 60, grade: 0.07 },
  { r: 40, turn: -60, grade: 0.05 },
  { len: 50, grade: 0.03 },
  { len: 40, grade: 0.0 },              // summit lot
];

// From the cabin the other way: down into the valley (grades still measured going uphill).
const VALLEY = [
  { r: 45, turn: 22, grade: 0.0 },
  { r: 45, turn: -40, grade: 0.01 },
  { len: 25, grade: 0.01 },
  { r: 60, turn: 25, grade: 0.015 },
  { len: 120, grade: 0.02 },
];

function walk(segments, x, z, h, dir) {
  // dir = +1 walks uphill, -1 walks downhill from the anchor (turns mirrored so geometry is consistent).
  const pts = [];
  let e = 0;
  for (const seg of segments) {
    if (seg.len) {
      const n = Math.max(1, Math.round(seg.len / STEP));
      for (let i = 0; i < n; i++) {
        x += Math.cos(h) * STEP; z += Math.sin(h) * STEP; e += seg.grade * STEP * dir;
        pts.push({ x, z, e });
      }
    } else {
      const total = (seg.turn * Math.PI) / 180 * dir;
      const arcLen = Math.abs(total) * seg.r;
      const n = Math.max(2, Math.round(arcLen / STEP));
      const dh = total / n, ds = arcLen / n;
      for (let i = 0; i < n; i++) {
        h += dh / 2; x += Math.cos(h) * ds; z += Math.sin(h) * ds; h += dh / 2;
        e += seg.grade * ds * dir;
        pts.push({ x, z, e });
      }
    }
  }
  return pts;
}

function buildRoad() {
  const ax = ANCHOR_MAP.x * U, az = ANCHOR_MAP.y * U;
  const up = walk(MOUNTAIN, ax, az, ANCHOR_HEADING, 1);
  const down = walk(VALLEY, ax, az, ANCHOR_HEADING + Math.PI, -1);
  const pts = [...down.reverse(), { x: ax, z: az, e: 0 }, ...up];
  const homeIndex = down.length;

  // Smooth elevation so grade changes are gentle (no kinks at segment joins).
  const raw = pts.map((p) => p.e);
  const W = 15;
  for (let i = 0; i < pts.length; i++) {
    let s = 0, n = 0;
    for (let j = Math.max(0, i - W); j <= Math.min(pts.length - 1, i + W); j++) { s += raw[j]; n++; }
    pts[i].e = s / n;
  }
  const base = pts[homeIndex].e;
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    p.e -= base; // cabin sits at elevation 0
    if (i > 0) s += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    p.s = s;
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    p.tx = dx / L; p.tz = dz / L;
    p.nx = -p.tz; p.nz = p.tx;
    p.i = i;
  }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    pts[i].grade = (b.e - a.e) / (b.s - a.s || 1);
    // Curvature from heading change over a small window.
    const W2 = 4, p0 = pts[Math.max(0, i - W2)], p1 = pts[Math.min(pts.length - 1, i + W2)];
    let da = Math.atan2(p1.tz, p1.tx) - Math.atan2(p0.tz, p0.tx);
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    pts[i].k = Math.abs(da) / Math.max(1, p1.s - p0.s);
  }
  const homeS = pts[homeIndex].s;
  return {
    samples: pts,
    length: s,
    homeS,
    homeIndex,
    summitS: s - 25,     // race start/finish at the summit lot
    startLineS: homeS - 9, // race start/finish line just east of the driveway
  };
}

export const ROAD = buildRoad();

// Interpolated point at distance s along the road.
export function sampleAtS(s) {
  const S = ROAD.samples;
  s = Math.max(0, Math.min(ROAD.length, s));
  let lo = 0, hi = S.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (S[m].s <= s) lo = m; else hi = m - 1; }
  const a = S[lo], b = S[Math.min(lo + 1, S.length - 1)];
  const t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
  return {
    x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, e: a.e + (b.e - a.e) * t,
    tx: a.tx, tz: a.tz, nx: a.nx, nz: a.nz, grade: a.grade, k: a.k, i: lo,
  };
}

// Nearest sample, searching only near `hint` so stacked switchback legs don't get confused.
export function nearestOnRoad(x, z, hint = -1, window = 70) {
  const S = ROAD.samples;
  let lo = 0, hi = S.length - 1;
  if (hint >= 0) { lo = Math.max(0, hint - window); hi = Math.min(S.length - 1, hint + window); }
  let best = lo, bd = Infinity;
  for (let i = lo; i <= hi; i++) {
    const d = (S[i].x - x) ** 2 + (S[i].z - z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  if (hint >= 0 && bd > 30 * 30) return nearestOnRoad(x, z, -1);
  const p = S[best];
  const lat = (x - p.x) * p.nx + (z - p.z) * p.nz;
  const along = (x - p.x) * p.tx + (z - p.z) * p.tz;
  return { i: best, p, lat, s: p.s + along, dist: Math.sqrt(bd) };
}
