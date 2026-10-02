// Porsche 911 Turbo (964), 1991-92: a body sculpted to the real car rather than built from the shared
// loft in carmodel.js, because the 911's shape doesn't fit it (raised front wings with the lamps in
// their noses, a fastback that runs from the screen header to the tail in one curve, wide rear hips).
//
// Dimensions: 4250 long, 1775 wide (Turbo body), 1290 high, wheelbase 2272, front overhang 880,
// track 1442 front / 1506 rear, 205/50 ZR17 front and 255/40 ZR17 rear.
// The body is one smooth surface: at each station along the car (d = meters behind the front axle) a
// cross-section of 17 control points (sill, side, shoulder, glass / wing / hip, roof / bonnet / lid,
// mirrored), interpolated with centripetal Catmull-Rom across the section and smooth profile curves
// along the car. Glass, shut lines and trim are laid on that surface as thin patches, so they follow
// its curves exactly.
import * as THREE from '../lib/three.module.min.js';
import { roundLampTex, plateTex } from './textures.js';

const FO = 0.88, WB = 2.272, RO = 4.25 - WB - FO; // overhangs
export const P964 = { L: 4.25, W: 1.775, H: 1.29, wb: WB, fo: FO, trackF: 1.442, trackR: 1.506, tireR: 0.318, tireWF: 0.205, tireWR: 0.255 };

// Smooth curve through [d, value] points (monotone cubic: no overshoot between them).
function curve(pts) {
  const n = pts.length, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx.push(xs[i + 1] - xs[i]); m.push((ys[i + 1] - ys[i]) / dx[i]); }
  t.push(m[0]);
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]));
  t.push(m[n - 2]);
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = dx[i], s = (x - xs[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * ys[i] + (s3 - 2 * s2 + s) * h * t[i] + (-2 * s3 + 3 * s2) * ys[i + 1] + (s3 - s2) * h * t[i + 1];
  };
}
const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const lerp2 = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];

// ---- side profile and plan (d: meters behind the front axle; nose at -0.88, tail at 3.37) ----
// Centre line over the top: bumper, bonnet, screen, roof, the fastback, engine lid, tail.
const yC = curve([[-0.88, 0.53], [-0.872, 0.56], [-0.85, 0.585], [-0.8, 0.62], [-0.74, 0.65], [-0.4, 0.712], [0, 0.757], [0.4, 0.795], [0.62, 0.818], [0.72, 0.832],
  [0.85, 0.925], [1.0, 1.022], [1.15, 1.112], [1.28, 1.19], [1.36, 1.232], [1.48, 1.274], [1.62, 1.294], [1.8, 1.292], [2.0, 1.266], [2.2, 1.196], [2.4, 1.118], [2.6, 1.035],
  [2.75, 0.982], [3.0, 0.925], [3.2, 0.887], [3.3, 0.866], [3.345, 0.845], [3.37, 0.815]]);
// The shoulder: tops of the front wings (higher than the bonnet), the window line, the rear hips.
const yS = curve([[-0.88, 0.545], [-0.872, 0.6], [-0.858, 0.7], [-0.84, 0.77], [-0.81, 0.798], [-0.7, 0.806], [-0.3, 0.81], [0.2, 0.816], [0.5, 0.826], [0.72, 0.83],
  [1.0, 0.832], [1.7, 0.842], [2.1, 0.856], [2.4, 0.862], [2.7, 0.866], [3.0, 0.852], [3.2, 0.838], [3.3, 0.828], [3.345, 0.812], [3.37, 0.79]]);
// Half width: narrow nose, front wings, doors, then the Turbo's wide rear hips.
const hw = curve([[-0.88, 0.6], [-0.872, 0.665], [-0.85, 0.722], [-0.82, 0.756], [-0.76, 0.786], [-0.6, 0.806], [-0.4, 0.814], [0, 0.822], [0.6, 0.82], [1.2, 0.815], [1.5, 0.82],
  [1.8, 0.86], [2.05, 0.892], [2.3, 0.9], [2.65, 0.893], [3.0, 0.87], [3.15, 0.85], [3.25, 0.822], [3.31, 0.788], [3.35, 0.745], [3.37, 0.69]]);
// Underside of the sill / bumpers (the wheel arches are cut on top of this).
const yLow = curve([[-0.88, 0.19], [-0.82, 0.165], [-0.5, 0.17], [0.5, 0.18], [1.8, 0.18], [3.0, 0.2], [3.25, 0.245], [3.37, 0.28]]);
// Roof edge (where the side glass meets the roof) behind the screen header.
const roofHalf = curve([[1.36, 0.535], [1.8, 0.55], [2.2, 0.565], [2.5, 0.59], [2.75, 0.585]]);
const roofDrop = curve([[1.36, 0.035], [2.0, 0.042], [2.6, 0.045]]);
const AX = [[0, 0.342], [WB, 0.35]]; // wheel arches: [d, radius]
const TIRE_R = P964.tireR;
const WS0 = 0.72, WS1 = 1.36; // screen base and header

function bottomAt(d) {
  let y = yLow(d);
  for (const [a, r] of AX) { const k = Math.abs(d - a); if (k < r) y = Math.max(y, TIRE_R + 0.01 + Math.sqrt(r * r - k * k)); }
  return y;
}

// The 8 control points of one side (z >= 0), outermost-bottom first, then the centre top.
function halfSection(d) {
  const h = hw(d), s = yS(d), c = yC(d), b = bottomAt(d);
  // The upper side rolls over into the shoulder: a big round shoulder on the front wings and the
  // rear hips, a tighter one along the doors.
  const roll = lerp(lerp(0.13, 0.085, sstep(0.3, 0.7, d)), 0.12, sstep(1.9, 2.4, d));
  const ym = Math.max(0.5, b + 0.09), y3 = Math.max(ym + 0.03, s - roll);
  const p0 = [h - 0.13, b], p1 = [h - 0.04, Math.min(b + 0.06, ym - 0.02)], p2 = [h, ym], p3 = [h - 0.01, y3];
  // Front: wing tops with a valley down to the bonnet.
  const F = [[h - 0.12, s - 0.012], [h - 0.225, s + 0.002], [h - 0.4, c - 0.018], [0.22, c - 0.006]];
  // Cabin: window line, side glass leaning in to the A-pillar / roof edge, roof.
  let P;
  if (d <= WS1) {
    const t = sstep(0, 1, (d - WS0) / (WS1 - WS0)) * 0.35 + Math.max(0, Math.min(1, (d - WS0) / (WS1 - WS0))) * 0.65;
    const foot = [h - 0.075, s], top = [roofHalf(WS1), yC(WS1) - roofDrop(WS1)];
    P = lerp2(foot, top, t);
  } else P = [roofHalf(Math.min(d, 2.75)), c - roofDrop(Math.min(d, 2.6))];
  const p4c = [h - 0.075, s];
  const mid = lerp2(p4c, P, 0.5);
  const A = [p4c, [mid[0] + 0.014, mid[1]], P, [P[0] * 0.5, c - 0.013]];
  // Rear: hips with the engine lid between them.
  const R = [[h - 0.15, s - 0.008], [h - 0.28, s - 0.014], [0.5, c - 0.035], [0.25, c - 0.008]];
  const wFA = sstep(0.42, 0.72, d), wAR = sstep(2.42, 2.82, d);
  const top4 = [0, 1, 2, 3].map((i) => lerp2(lerp2(F[i], A[i], wFA), R[i], wAR));
  return [p0, p1, p2, p3, ...top4, [0, c]];
}
// Full section, u = 0..16: left side bottom-up (z < 0), centre at u = 8, right side top-down.
function section(d) {
  const h = halfSection(d), centre = h[8], side = h.slice(0, 8);
  return [...side.map(([z, y]) => [-z, y]), centre, ...side.slice().reverse()];
}
// Centripetal Catmull-Rom through the section's points at parameter u.
function onSection(P, u) {
  const n = P.length, i = Math.max(0, Math.min(n - 2, Math.floor(u))), t = Math.min(1, u - i);
  const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
  const tj = (a, b) => Math.max(1e-4, Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5);
  const t0 = 0, t1 = t0 + (p0 === p1 ? 1e-4 : tj(p0, p1)), t2 = t1 + tj(p1, p2), t3 = t2 + (p3 === p2 ? 1e-4 : tj(p2, p3));
  const T = t1 + (t2 - t1) * t;
  const L = (a, b, ta, tb) => [((tb - T) * a[0] + (T - ta) * b[0]) / (tb - ta), ((tb - T) * a[1] + (T - ta) * b[1]) / (tb - ta)];
  const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
  const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
  return L(B1, B2, t1, t2);
}

export function build964(g, { paint, black: blackSolid, chrome, amber, add, face, wheels, env }) {
  // Layers laid on the body (trim, then glass) are pulled towards the camera in the depth test, so
  // they always draw over the paint under them, even with a coarse depth buffer.
  const onTop = (k) => ({ polygonOffset: true, polygonOffsetFactor: -k, polygonOffsetUnits: -4 * k });
  const glass = new THREE.MeshPhongMaterial({ color: '#0b1018', shininess: 90, specular: '#5a6a80', envMap: env, reflectivity: 0.1, combine: THREE.MixOperation, side: THREE.DoubleSide, ...onTop(3) });
  const black = new THREE.MeshLambertMaterial({ color: '#141518', side: THREE.DoubleSide, ...onTop(2) });
  const axF = P964.L / 2 - FO, xOf = (d) => axF - d;
  const secCache = new Map();
  const sec = (d) => { const k = d.toFixed(4); let s = secCache.get(k); if (!s) secCache.set(k, (s = section(d))); return s; };
  const S = (d, u) => { const [z, y] = onSection(sec(d), u); return [xOf(d), y, z]; };
  // Outward surface normal (finite differences), for laying patches on the body.
  const N = (d, u) => {
    const a = S(d - 0.01, u), b = S(d + 0.01, u), c = S(d, Math.max(0, u - 0.05)), e = S(d, Math.min(16, u + 0.05));
    const t1 = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), t2 = new THREE.Vector3(e[0] - c[0], e[1] - c[1], e[2] - c[2]);
    const n = t1.cross(t2).normalize();
    const p = S(d, u);
    if (n.y * (p[1] - 0.5) + n.z * p[2] < 0) n.negate();
    return n;
  };
  // A grid over (u, d) as one mesh.
  const grid = (us, dsFor, mat, off = 0) => {
    const pos = [], idx = [];
    const cols = dsFor(us[0]).length;
    us.forEach((u) => dsFor(u).forEach((d) => {
      const p = S(d, u);
      if (off) { const n = N(d, u); pos.push(p[0] + n.x * off, p[1] + n.y * off, p[2] + n.z * off); } else pos.push(...p);
    }));
    for (let i = 0; i < us.length - 1; i++) for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j, b = a + 1, c = a + cols, e = c + 1;
      idx.push(a, c, b, b, c, e);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    return add(geo, mat);
  };
  const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
  // A patch on the body: u from u0 to u1, and at each u, d from da(u) to db(u).
  const patch = (u0, u1, da, db, mat, off = 0.006, nu = 8, nd = 24) => grid(range(u0, u1, nu), (u) => range(da(u), db(u), nd), mat, off);
  const both = (fn) => { fn(1); fn(-1); }; // s = 1: the car's left (z < 0, u 0..8), s = -1: its right (mirrored u)
  const sideP = (s, u0, u1, da, db, mat, off, nu, nd) => (s > 0 ? patch(u0, u1, da, db, mat, off, nu, nd) : patch(16 - u1, 16 - u0, (u) => da(16 - u), (u) => db(16 - u), mat, off, nu, nd));

  // ---- the body shell ----
  const ds = [];
  for (let d = -0.88; d <= 3.37 + 1e-6; d += 0.04) ds.push(+d.toFixed(3));
  for (const [a, r] of AX) for (let k = -1; k <= 1; k += 0.125) ds.push(+(a + k * r).toFixed(4));
  const stations = [...new Set(ds)].filter((d) => d >= -0.88 && d <= 3.37).sort((p, q) => p - q);
  grid(range(0, 16, 64), () => stations, paint);
  // End caps (bumper faces), flat.
  for (const [d, dir] of [[-0.88, 1], [3.37, -1]]) {
    const ring = range(0, 16, 64).map((u) => onSection(sec(d), u)), x = xOf(d);
    const pos = [x, ring.reduce((s, p) => s + p[1], 0) / ring.length, 0], idx = [];
    ring.forEach(([z, y]) => pos.push(x, y, z));
    for (let k = 1; k < ring.length; k++) dir > 0 ? idx.push(0, k, k + 1) : idx.push(0, k + 1, k);
    idx.push(...(dir > 0 ? [0, ring.length, 1] : [0, 1, ring.length]));
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    add(geo, paint);
  }
  // Dark underside and wheel-arch liners, so you can't see through the arches.
  add(new THREE.BoxGeometry(4.0, 0.28, 1.36), blackSolid, axF - WB / 2 - 0.05, 0.36, 0);

  // ---- glass ----
  // Windscreen between the A-pillars.
  patch(6.12, 9.88, () => WS0 + 0.035, () => WS1 - 0.015, glass, 0.004, 16, 20);
  // Side glass: door window and the rear quarter window, whose back edge curves down with the fastback.
  const qEnd = (u) => { const s = Math.max(0, Math.min(1, (u - 4.12) / 1.74)); return 1.96 + 0.33 * Math.sqrt(1 - s * s); };
  both((s) => {
    sideP(s, 3.96, 5.97, () => WS0 + 0.02, (u) => qEnd(u) + 0.035, black, 0.003, 10, 30);          // rubber surround
    sideP(s, 4.12, 5.86, () => WS0 + 0.05, qEnd, glass, 0.005, 10, 30);
    sideP(s, 4.1, 5.88, () => 1.705, () => 1.735, black, 0.007, 6, 2);                          // door / quarter window divider
  });
  // Rear window, rounded at the corners.
  const rc = (u) => ((u - 8) / 1.85) ** 6;
  patch(6.12, 9.88, (u) => 1.96 + 0.06 * rc(u), (u) => 2.66 - 0.05 * rc(u), black, 0.003, 16, 12);
  patch(6.2, 9.8, (u) => 1.98 + 0.06 * rc(u), (u) => 2.64 - 0.05 * rc(u), glass, 0.005, 16, 12);

  // ---- shut lines ----
  const line = (u0, u1, d0, d1) => patch(u0, u1, () => d0, () => d1, black, 0.0035, Math.max(2, Math.round((u1 - u0) * 4)), 1);
  // Front lid: its outline on the body, a little narrower at the nose than at the scuttle, with
  // rounded front corners. Drawn as a thin strip following the surface.
  const uAtZ = (d, z) => { let lo = 8, hi = 3; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (Math.abs(onSection(sec(d), m)[0]) < z) lo = m; else hi = m; } return (lo + hi) / 2; };
  const seam = new THREE.MeshLambertMaterial({ color: '#4a4b50', side: THREE.DoubleSide, ...onTop(2) });
  const strip = (pts, w = 0.004) => {
    // pts: [d, z] along the line (z > 0, mirrored to both sides when `both`), laid on the left side's u
    const pos = [], idx = [];
    pts.forEach(([d, z], i) => {
      const u = uAtZ(d, z);
      for (const du of [-w * 6, w * 6]) { const p = S(d, u + du), n = N(d, u + du); pos.push(p[0] + n.x * 0.004, p[1] + n.y * 0.004, p[2] + n.z * 0.004); }
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    add(geo, seam);
    const m = add(geo, seam); m.scale.z = -1; // the other side
  };
  {
    const lidZ = (d) => lerp(0.425, 0.5, (d - -0.74) / (0.64 + 0.74));
    const side = [];
    for (let d = -0.7; d <= 0.64; d += 0.04) side.push([d, lidZ(d)]);
    strip(side);
    // the front edge, rounding off the corners into the middle
    const front = [];
    for (let k = 0; k <= 10; k++) { const t = k / 10, z = lidZ(-0.7) * (1 - t); front.push([-0.7 - 0.045 * Math.sin((t * Math.PI) / 2) ** 0.5 * (1 - 0.3 * t), Math.max(0.005, z)]); }
    strip(front);
  }
  line(uAtZ(0.65, 0.5), 16 - uAtZ(0.65, 0.5), 0.645, 0.655);
  // Engine lid (behind the rear window, under the spoiler) and the tail panel line.
  for (const u of [6.45, 9.55]) patch(u - 0.03, u + 0.03, () => 2.66, () => 3.3, black, 0.0035, 1, 14);
  line(6.45, 9.55, 2.655, 2.665); line(6.45, 9.55, 3.295, 3.305);
  both((s) => {
    // Door: front edge behind the front wheel, rear edge at the divider, along the sill.
    sideP(s, 1.0, 4.0, () => 0.43, () => 0.44, black, 0.003, 10, 1);
    sideP(s, 1.0, 4.0, () => 1.725, () => 1.735, black, 0.003, 10, 1);
    sideP(s, 1.0, 1.08, () => 0.44, () => 1.73, black, 0.003, 1, 16);
    // Bumper joins: front bumper behind the lamps, rear bumper under the lights.
    // Fuel flap on the left front wing (filler under it), just ahead of the screen.
    if (s > 0) sideP(s, 4.25, 4.8, () => 0.3, () => 0.43, black, 0.003, 3, 3);
  });

  // ---- surface helpers for parts ----
  // Point on a side at height y (searching the side of the section), pushed out by `out`.
  const sideAt = (d, y, s = 1, out = 0) => {
    let best = null;
    for (let u = 1; u <= 6; u += 0.02) { const p = onSection(sec(d), u); if (!best || Math.abs(p[1] - y) < Math.abs(best[1] - y)) best = p; }
    return [xOf(d), best[1], -s * (Math.abs(best[0]) + out)];
  };

  // ---- headlights: big round lamps standing forward in the noses of the wings, each in a thick
  // body-colour ring with a bright trim ring, looking straight ahead and tipped back a touch ----
  const lampMat = new THREE.MeshBasicMaterial({ map: roundLampTex(), transparent: true, alphaTest: 0.4 });
  const recess = new THREE.MeshLambertMaterial({ color: '#1d1f23' });
  both((s) => {
    const holder = new THREE.Group(); holder.position.set(xOf(-0.838), 0.675, -s * 0.59); holder.rotation.z = -0.12; g.add(holder);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.136, 0.12, 24), paint); ring.rotation.z = Math.PI / 2; ring.position.x = -0.03; holder.add(ring);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.108, 24), recess); hole.rotation.y = Math.PI / 2; hole.position.x = 0.031; holder.add(hole);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), lampMat); lens.rotation.y = Math.PI / 2; lens.position.x = 0.036; holder.add(lens);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.106, 0.007, 6, 24), chrome); trim.rotation.y = Math.PI / 2; trim.position.x = 0.034; holder.add(trim);
  });

  // ---- front bumper: the indicator / fog lamp units across its top corners (amber outboard), slim
  // black grille slats low down, the plate between ----
  const xF = xOf(-0.88);
  const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t; };
  const fogTex = canvasTex(32, 8, (x) => {
    x.fillStyle = '#1b1c20'; x.fillRect(0, 0, 32, 8);
    x.fillStyle = '#f29a1c'; x.fillRect(1, 1, 13, 6);                                   // indicator (outboard, left end)
    x.fillStyle = '#e9e7de'; x.fillRect(15, 1, 16, 6); x.fillStyle = '#c9c5b6'; for (let i = 17; i < 31; i += 3) x.fillRect(i, 1, 1, 6); // fog lamp
  });
  const fogMat = new THREE.MeshBasicMaterial({ map: fogTex });
  both((s) => {
    const f = face(0.3, 0.07, fogMat, xF + 0.004, 0.425, -s * 0.555);
    f.scale.x = -s;                                                                      // amber end outboard on both sides
    const w = sideAt(-0.83, 0.425, s, 0.004);
    face(0.08, 0.065, amber, w[0], w[1], w[2], s > 0 ? 'left' : 'right');
  });
  for (const y of [0.235, 0.275]) face(1.2, 0.022, black, xF + 0.004, y, 0);
  face(1.2, 0.07, recess, xF + 0.002, 0.255, 0);
  face(0.34, 0.12, new THREE.MeshBasicMaterial({ map: plateTex('jp'), transparent: true, alphaTest: 0.4 }), xF + 0.006, 0.335, 0);

  // ---- rear: the smoked-red light band right across the tail and round onto the hips, PORSCHE in
  // the middle, the lamps at its ends ----
  const xR = xOf(3.37);
  const tailTex = canvasTex(128, 16, (x) => {
    x.fillStyle = '#2a0b0d'; x.fillRect(0, 0, 128, 16);
    x.fillStyle = '#6e0f14'; x.fillRect(1, 1, 126, 14);
    for (const x0 of [2, 100]) { x.fillStyle = '#9e1218'; x.fillRect(x0, 2, 26, 12); x.fillStyle = '#c9c4bb'; x.fillRect(x0 + (x0 < 50 ? 18 : 2), 9, 6, 4); x.fillStyle = '#b8701a'; x.fillRect(x0 + (x0 < 50 ? 2 : 18), 9, 6, 4); }
    x.fillStyle = '#851118'; for (let i = 30; i < 98; i += 2) x.fillRect(i, 3, 1, 10);
    x.fillStyle = '#3a0809'; x.font = 'bold 9px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('PORSCHE', 64, 8.5);
  });
  const tail = new THREE.MeshBasicMaterial({ map: tailTex, color: '#8a5a5a', transparent: true, alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
  // The band follows the tail round its corners: laid on the body surface from hip to hip.
  {
    const yb = 0.735, hh = 0.06, pos = [], uv = [], idx = [];
    const pts = [];
    for (let k = 0; k <= 24; k++) {
      const u = 1.6 + (12.8 * k) / 24, d = 3.37 - 0.004;
      // walk round the tail: along the side of the hips, then across the back
      pts.push(u);
    }
    // Back face: a strip across the tail end.
    face(2 * hw(3.37) - 0.06, 2 * hh, tail, xR - 0.004, yb, 0, 'back');
    void pos; void uv; void idx; void pts;
    both((s) => {
      // The ends wrap round the corners onto the hips.
      for (const [d, w] of [[3.345, 0.06], [3.315, 0.06]]) { const p = sideAt(d, yb, s, 0.005); face(w, 2 * hh, tail, p[0], p[1], p[2], s > 0 ? 'left' : 'right'); }
    });
  }
  face(0.34, 0.14, new THREE.MeshBasicMaterial({ map: plateTex('jp'), transparent: true, alphaTest: 0.4 }), xR - 0.006, 0.47, 0, 'back');
  face(0.48, 0.17, black, xR - 0.004, 0.47, 0, 'back');      // plate recess
  // Twin tailpipes at each corner, under the bumper.
  const pipe = new THREE.CylinderGeometry(0.036, 0.036, 0.16, 10); pipe.rotateZ(Math.PI / 2);
  both((s) => { for (const dz of [0, 0.085]) add(pipe, chrome, xR - 0.03, 0.25, -s * (0.52 + dz)); });

  // ---- the whale tail (Turbo "tea tray"): a body-colour tray on a plinth over the engine lid, wider
  // at the back than the front, with raised edges, a louvred grille in its top and a black rubber lip
  // along the trailing edge ----
  {
    const d0 = 2.74, d1 = 3.39, wF = 0.55, wR = 0.78, top = 0.985, rise = 0.02;
    const yL = (d) => yC(Math.min(d, 3.36));
    const halfAt = (d) => lerp(wF, wR, (d - d0) / (d1 - d0)), topAt = (d) => top + rise * (d - d0) / (d1 - d0);
    // One closed shape: the plinth sides drop from the tray's edge to the lid.
    const ds = range(d0, d1, 12), pos = [], idx = [];
    ds.forEach((d) => {
      const w = halfAt(d), t = topAt(d), lid = yL(d) - 0.02;
      const ear = 0.05 * sstep(0.35, 1, (d - d0) / (d1 - d0)); // the edges sweep up into ears at the back
      for (const [z, y] of [[-w + 0.08, lid], [-w, t - 0.05], [-w - 0.01, t + 0.035 + ear], [-w + 0.1, t + 0.03], [w - 0.1, t + 0.03], [w + 0.01, t + 0.035 + ear], [w, t - 0.05], [w - 0.08, lid]]) pos.push(xOf(d), y, z);
    });
    const R = 8;
    for (let i = 0; i < ds.length - 1; i++) for (let k = 0; k < R - 1; k++) { const a = i * R + k, b = a + 1, c = a + R, e = c + 1; idx.push(a, c, b, b, c, e); }
    // Close the back (under the lip) and the front.
    for (const [i, flip] of [[0, false], [ds.length - 1, true]]) for (let k = 1; k < R - 1; k++) { const a = i * R, b = a + k, c = a + k + 1; flip ? idx.push(a, c, b) : idx.push(a, b, c); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setIndex(idx); tg.computeVertexNormals();
    add(tg, paint);
    // Louvred grille in the top of the tray.
    // slats run across the car (canvas columns lie across it once the plane is laid flat)
    const louvres = canvasTex(32, 32, (x) => { x.fillStyle = '#1c1c20'; x.fillRect(0, 0, 32, 32); x.fillStyle = '#55555c'; for (let i = 1; i < 32; i += 3) x.fillRect(i, 0, 1, 32); x.fillStyle = '#141416'; x.fillRect(0, 10, 32, 1); x.fillRect(0, 21, 32, 1); });
    const gw = 2 * halfAt(d0 + 0.3) - 0.42;
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(0.34, gw), new THREE.MeshLambertMaterial({ map: louvres, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }));
    gr.rotation.x = -Math.PI / 2; gr.position.set(xOf(d0 + 0.26), topAt(d0 + 0.26) + 0.032, 0); g.add(gr);
    // The rubber lip round the trailing edge.
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 2 * wR - 0.1), blackSolid); lip.position.set(xOf(d1) - 0.005, topAt(d1) + 0.02, 0); g.add(lip);
  }

  // ---- mirrors: the egg-shaped Turbo mirrors on stalks at the front of the door ----
  both((s) => {
    const base = sideAt(0.82, 0.84, s, 0);
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 0.08), blackSolid); stalk.position.set(base[0] - 0.03, 0.87, base[2] - s * 0.04); g.add(stalk);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), paint); head.scale.set(0.085, 0.05, 0.068); head.position.set(base[0] - 0.05, 0.9, base[2] - s * 0.11); g.add(head);
    const mg = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), black); mg.scale.set(1.1, 0.7, 1); mg.rotation.y = -Math.PI / 2; mg.scale.set(0.9, 0.6, 1); mg.position.set(base[0] - 0.136, 0.9, base[2] - s * 0.11); g.add(mg);
  });
  // ---- door handles, side repeaters, wipers, the bonnet crest ----
  both((s) => {
    const h = sideAt(1.5, 0.79, s, 0.006);
    add(new THREE.BoxGeometry(0.16, 0.025, 0.02), blackSolid, h[0], h[1], h[2]);
    const r = sideAt(0.56, 0.62, s, 0.003);
    face(0.07, 0.025, amber, r[0], r[1], r[2], s > 0 ? 'left' : 'right');
  });
  for (const z of [-0.32, 0.2]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.52), blackSolid); w.position.set(xOf(WS0 + 0.04), yC(WS0 + 0.04) + 0.02, z + 0.1); w.rotation.y = 0.12; g.add(w);
  }
  { const crest = new THREE.Mesh(new THREE.CircleGeometry(0.03, 10), new THREE.MeshBasicMaterial({ color: '#c9a640' })); crest.rotation.x = -Math.PI / 2 + 0.15; crest.position.set(xOf(-0.7), yC(-0.7) + 0.008, 0); g.add(crest); }
  // "turbo" script on the engine lid's tail panel.
  { const c = document.createElement('canvas'); c.width = 64; c.height = 16; const x = c.getContext('2d'); x.fillStyle = '#d8dbe0'; x.font = 'italic bold 12px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('turbo', 32, 8);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    face(0.16, 0.04, new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.3 }), xR - 0.005, 0.81, 0.42, 'back'); }

  // ---- wheels: staggered, wider at the back ----
  wheels([[axF, P964.trackF, P964.tireWF], [axF - WB, P964.trackR, P964.tireWR]]);

  const dims = { L: P964.L, W: P964.W, H: P964.H, cowl: yC(WS0), nose: yC(-0.8), xF, wsBase: xOf(WS0), roofF: xOf(WS1) };
  return { tail, dims, xF, xR };
}
