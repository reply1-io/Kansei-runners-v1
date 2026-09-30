// Low-poly models of the real cars, late-90s racing game style.
// The body is lofted: a rounded cross-section (with tumblehome and rounded shoulders) swept along the
// car, following each car's side profile, plan-view taper and wheel arches. The greenhouse is a
// narrower glass loft with a painted roof and pillars. On top go the details: seams, handles, trim,
// lights, grilles, plates, wipers, mirrors, exhausts, wheels. Dimensions are the real cars'.
// Forward is +x, up is +y, meters.
import * as THREE from '../lib/three.module.min.js';
import {
  envCube, headlightTex, taillightTex, grilleTex, roundLampTex, kidneyTex, volvoGrilleTex, mercGrilleTex,
  blackGrilleTex, rectLampTex, tailBarTex, roundTailTex, ribbedTailTex, plateTex, wheelTex,
} from './textures.js';

// Real factory dimensions (meters). L length, W width, H height, wb wheelbase, fo front overhang,
// track, tire radius (from the stock tire size), sill: rocker height off the ground.
// Side profile, as distances behind the FRONT AXLE: ws0 windshield base, ws1 top of windshield,
// rf1 back of the roof, sg end of the side glass (the C-pillar is painted from there back), rw0 base of the rear window (near the tail on liftbacks and hatches).
// Heights: nose (front edge), cowl (hood at the windshield), beltR (window line at the rear),
// tail (rear edge top). tumble: how far the roof sits in from the body sides.
// front/lights/tails/bumper/rim: detail styles. plate: 'us' or 'jp'. extras: optional details.
const CARS = {
  // 1987 BMW 325i coupe (US): 4325 x 1645 x 1380, wb 2570, track 1407/1415, 195/65R14. Profile measured off
  // side/front/rear photos: cabin set well back, long flat roof, low trunk, "diving board" bumpers
  // standing 10 cm proud of the body, black rocker trim, quad lamps in a full-width black panel.
  e30:      { L: 4.325, W: 1.645, H: 1.355, wb: 2.57, fo: 0.73, track: 1.41, tireR: 0.3, tireW: 0.195, sill: 0.18, bumperOut: 0.1, arch: 0.35,
              ws0: 0.55, ws1: 1.07, rf1: 2.46, rw0: 2.9, sg: 2.64, nose: 0.79, cowl: 0.91, beltR: 0.9, tail: 0.89, tumble: 0.2, taper: 0.08, doors: 2,
              rubY: 0.52, mirrorBack: 0.26, paintMirrors: true, tailY: 0.7, tailZ: 0.55, plateY: 0.69, lampZ: [0.43, 0.61],
              front: 'kidney', lights: 'quad', tails: 'rect', bumper: 'us', rim: 'mesh', plate: 'us', chromeTrim: true, rubStrip: true, exhausts: 2, extras: ['sunroof', 'antenna', 'markers', 'rocker', 'lamppanel'] },
  // 1980 Volvo 242: 4785 x 1710 x 1435, wb 2640, track 1420/1360, 185/70R14
  // Profile measured off side/front/rear photos: tall, square body; upright glass with a thin C-pillar;
  // high flat hood and trunk; black 5-mph bumpers 14 cm proud; chrome side strip; round lamps in square
  // black housings either side of the diagonal-bar grille.
  volvo242: { L: 4.785, W: 1.71, H: 1.435, wb: 2.64, fo: 0.88, track: 1.39, tireR: 0.308, tireW: 0.185, sill: 0.27, bumperOut: 0.14, arch: 0.36,
              ws0: 0.64, ws1: 1.04, rf1: 2.46, rw0: 2.82, sg: 2.62, nose: 0.85, cowl: 0.98, beltR: 1.0, tail: 0.99, tumble: 0.22, taper: 0.05, doors: 2,
              bumperYs: [0.475, 0.475, 0.16], chromeLine: 0.79, markerY: 0.71, fuelBack: 0.46, tailY: 0.64, tailZ: 0.63, plateY: 0.64, mirrorBack: 0.12,
              front: 'volvo', lights: 'volvo', tails: 'volvo', bumper: 'us', rim: 'turbine', plate: 'us', chromeTrim: true, extras: ['gutters', 'antenna', 'mudflaps', 'markers'] },
  // Mercedes-Benz 190E (W201): 4420 x 1678 x 1390, wb 2665, track 1445/1430, 185/65R15
  mb190e:   { L: 4.42, W: 1.678, H: 1.39, wb: 2.665, fo: 0.78, track: 1.44, tireR: 0.311, tireW: 0.185, sill: 0.21,
              ws0: 0.4, ws1: 1.2, rf1: 2.26, rw0: 2.86, sg: 2.48, nose: 0.72, cowl: 0.9, beltR: 0.98, tail: 1.0, tumble: 0.2, taper: 0.1, doors: 4,
              front: 'mercedes', lights: 'rect', tails: 'ribbed', bumper: 'cladding', rim: 'holes', plate: 'us', chromeTrim: true, extras: ['gutters', 'fogs'] },
  // Nissan 180SX: 4540 x 1690 x 1290, wb 2475, track 1465/1460, 195/60R15
  s180sx:   { L: 4.54, W: 1.69, H: 1.29, wb: 2.475, fo: 0.93, track: 1.46, tireR: 0.307, tireW: 0.195, sill: 0.18,
              ws0: 0.42, ws1: 1.28, rf1: 1.98, rw0: 3.3, sg: 2.52, nose: 0.6, cowl: 0.84, beltR: 0.94, tail: 0.94, tumble: 0.22, taper: 0.18, doors: 2,
              front: 'slot', lights: 'popup', tails: 'bar', bumper: 'body', rim: '5spoke', plate: 'jp', spoiler: 'lip', extras: ['markers'] },
  // Toyota Supra Turbo (A70): 4620 x 1745 x 1300, wb 2595, track 1480/1500, 225/50R16
  supra:    { L: 4.62, W: 1.745, H: 1.3, wb: 2.595, fo: 0.93, track: 1.49, tireR: 0.316, tireW: 0.225, sill: 0.18,
              ws0: 0.52, ws1: 1.36, rf1: 2.14, rw0: 3.4, sg: 2.78, nose: 0.6, cowl: 0.86, beltR: 0.95, tail: 0.95, tumble: 0.22, taper: 0.18, doors: 2,
              front: 'slot', lights: 'popup', tails: 'bar', bumper: 'body', rim: '5spoke', plate: 'jp', spoiler: 'lip', exhausts: 2, extras: ['antenna', 'markers'] },
  // Nissan Skyline GTS-t (R32) coupe: 4530 x 1695 x 1340, wb 2615, track 1460/1460, 205/60R15
  r32:      { L: 4.53, W: 1.695, H: 1.34, wb: 2.615, fo: 0.85, track: 1.46, tireR: 0.315, tireW: 0.205, sill: 0.19,
              ws0: 0.45, ws1: 1.26, rf1: 2.2, rw0: 2.88, sg: 2.46, nose: 0.66, cowl: 0.88, beltR: 0.96, tail: 0.96, tumble: 0.21, taper: 0.14, doors: 2,
              front: 'nissan', lights: 'slim', tails: 'quadround', bumper: 'body', rim: '5spoke', plate: 'jp', spoiler: 'small', extras: ['fogs'] },
  // 1999 Honda Civic Si hatch (EK): 4180 x 1695 x 1360, wb 2620, track 1475/1470, 195/55R15
  // Profile measured off side/front/rear photos: long sloping hood, windshield base well behind the
  // front axle, roof running almost to the tail, big roof spoiler, deep body-colour bumpers.
  civic:    { L: 4.18, W: 1.695, H: 1.36, wb: 2.62, fo: 0.87, track: 1.47, tireR: 0.298, tireW: 0.195, sill: 0.15, arch: 0.34,
              ws0: 0.47, ws1: 1.12, rf1: 2.45, rw0: 3.04, sg: 2.58, nose: 0.67, cowl: 0.86, beltR: 0.92, tail: 0.95, tumble: 0.26, taper: 0.12, doors: 2, hatch: true, frontPlate: false,
              bumperF: [0.31, 0.4], bumperR: [0.37, 0.34], intake: [0.82, 0.14, 0.3], lampSize: [0.31, 0.16], lampZ: 0.56, lampY: 0.62, grille: [0.77, 0.12, 0.58],
              tailY: 0.74, tailZ: 0.7, plateY: 0.7, exhaustZ: 0.4, exhaustY: 0.18, mirrorBack: 0.31, paintMirrors: true, markerF: 0.36,
              front: 'honda', lights: 'swept', tails: 'hatch', bumper: 'body', rim: 'holes', plate: 'us', spoiler: 'roof', extras: ['markers', 'antenna', 'rearwiper'] },
};

// Piecewise-linear lookup through sorted [x, y] points.
function piecewise(pts) {
  return (x) => {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1); }
    }
    return pts[pts.length - 1][1];
  };
}

// Sweep ring(x) (a list of [z, y] points, same count at every station) along the x stations.
function loft(xs, ring, { capStart = false, capEnd = false } = {}) {
  const pos = [], idx = [];
  const rings = xs.map((x) => ring(x));
  const n = rings[0].length;
  rings.forEach((r, i) => r.forEach(([z, y]) => pos.push(xs[i], y, z)));
  for (let i = 0; i < xs.length - 1; i++) {
    for (let k = 0; k < n - 1; k++) {
      const a = i * n + k, b = a + 1, c = a + n, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  // End caps get their own vertices so they shade flat.
  const cap = (i, flip) => {
    const base = pos.length / 3;
    rings[i].forEach(([z, y]) => pos.push(xs[i], y, z));
    const cz = rings[i].reduce((s, p) => s + p[0], 0) / n, cy = rings[i].reduce((s, p) => s + p[1], 0) / n;
    pos.push(xs[i], cy, cz);
    const c = base + n;
    for (let k = 0; k < n - 1; k++) flip ? idx.push(c, base + k + 1, base + k) : idx.push(c, base + k, base + k + 1);
    flip ? idx.push(c, base, base + n - 1) : idx.push(c, base + n - 1, base);
  };
  if (capStart) cap(0, false);
  if (capEnd) cap(xs.length - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const shared = {};
const once = (key, make) => shared[key] || (shared[key] = make());
const decal = (key, map, extra) => once(key, () => new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.4, ...extra }));

export function makeCarMesh(color, modelId) {
  const b = { ...(CARS[modelId] || CARS.e30) };
  const g = new THREE.Group();
  const env = envCube();
  const paint = new THREE.MeshPhongMaterial({ color, shininess: 60, specular: '#3a3a3a', envMap: env, reflectivity: 0.12, combine: THREE.MixOperation, side: THREE.DoubleSide });
  const glass = once('glass', () => new THREE.MeshPhongMaterial({ color: '#0a111c', shininess: 100, specular: '#6f82a0', envMap: env, reflectivity: 0.22, combine: THREE.MixOperation, side: THREE.DoubleSide }));
  const black = once('black', () => new THREE.MeshLambertMaterial({ color: '#141518' }));
  const plastic = once('plastic', () => new THREE.MeshLambertMaterial({ color: '#26282c' }));
  const chrome = once('chrome', () => new THREE.MeshPhongMaterial({ color: '#c9ced6', shininess: 120, specular: '#ffffff', envMap: env, reflectivity: 0.6, combine: THREE.MixOperation }));
  const alu = once('alu', () => new THREE.MeshLambertMaterial({ color: '#9ea4ab' }));
  const amber = once('amber', () => new THREE.MeshBasicMaterial({ color: '#f09a1a' }));
  const redLens = once('redlens', () => new THREE.MeshBasicMaterial({ color: '#a8141a' }));
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const box = (sx, sy, sz, mat, x, y, z) => add(new THREE.BoxGeometry(sx, sy, sz), mat, x, y, z);
  // Flat decal facing forward (+x), backward (-x) or sideways (±z).
  const face = (w, h, mat, x, y, z, dir = 'front') => {
    const m = add(new THREE.PlaneGeometry(w, h), mat, x, y, z);
    m.rotation.y = { front: Math.PI / 2, back: -Math.PI / 2, left: Math.PI, right: 0 }[dir];
    return m;
  };
  // A thin bar from p1 to p2 (for pillars, wipers, seams on slopes).
  const bar = (p1, p2, w, t, mat) => {
    const a = new THREE.Vector3(...p1), c = new THREE.Vector3(...p2);
    const m = add(new THREE.BoxGeometry(w, t, a.distanceTo(c)), mat);
    m.position.copy(a).add(c).multiplyScalar(0.5);
    m.lookAt(c);
    return m;
  };

  // Body extents; bumpers that stand proud of the body (bumperOut) reach the full length.
  const bo = b.bumperOut || 0, xF = b.L / 2 - bo, xR = -b.L / 2 + bo, W = b.W;
  const WHEEL_R = b.tireR, ARCH_R = b.arch || b.tireR + 0.07;
  const axF = b.L / 2 - b.fo, axR = axF - b.wb, axles = [axF, axR];
  const at = (d) => axF - d; // a distance behind the front axle -> x
  const wsBase = at(b.ws0), roofF = at(b.ws1), roofR = at(b.rf1), rwBase = Math.max(at(b.rw0), xR + 0.1);
  const liftback = rwBase < xR + 0.4;
  const beltAt = piecewise([[rwBase, b.beltR], [wsBase, b.cowl]]);
  b.belt = b.cowl; b.roof = b.H - 0.015;

  // ---- profile functions ----
  const top = piecewise(b.hatch
    ? [[xR, b.tail - 0.05], [rwBase, b.beltR], [wsBase, b.cowl], [xF - 0.14, b.nose], [xF, b.nose - 0.06]]
    : [[xR, b.tail - 0.06], [xR + 0.12, b.tail], [rwBase, b.beltR], [wsBase, b.cowl], [xF - 0.14, b.nose], [xF, b.nose - 0.06]]);
  const bottom = (x) => {
    let y = x > xF - 0.1 || x < xR + 0.1 ? b.sill + 0.05 : b.sill;
    for (const ax of axles) { const d = Math.abs(x - ax); if (d < ARCH_R) y = Math.max(y, WHEEL_R + Math.sqrt(ARCH_R * ARCH_R - d * d)); }
    return y;
  };
  const hw = (x) => { const u = Math.max(0, Math.min(1, (Math.abs(x) - (b.L / 2 - 0.55)) / 0.55)); return W / 2 - b.taper * u * u; };
  const roofLine = piecewise([[rwBase, b.beltR], [roofR, b.roof], [roofF, b.roof], [wsBase, b.cowl]]);
  const beltW = (x) => hw(x) - 0.07, roofW = (x) => hw(x) - b.tumble;

  // Stations: evenly spaced plus the key points, so edges land where they should.
  const xs = [];
  for (let i = 0; i <= 30; i++) xs.push(xR + ((xF - xR) * i) / 30);
  for (const ax of axles) xs.push(ax - ARCH_R, ax + ARCH_R, ax - ARCH_R * 0.7, ax + ARCH_R * 0.7);
  xs.push(wsBase, rwBase, xF - 0.14, xR + 0.12);
  const stations = [...new Set(xs.map((x) => +x.toFixed(4)))].sort((p, q) => p - q);

  // ---- body shell: rounded section, sides leaning in slightly, soft shoulders, crowned top ----
  const bodyRing = (x) => {
    const h = hw(x), t = top(x), bt = bottom(x), mid = Math.min(bt + 0.14, t - 0.13);
    const half = [[h - 0.05, bt], [h, mid], [h, t - 0.13], [h - 0.05, t - 0.035], [h - 0.17, t]];
    return [...half.map(([z, y]) => [-z, y]), [0, t + 0.015], ...half.reverse().map(([z, y]) => [z, y])];
  };
  add(loft(stations, bodyRing, { capStart: true, capEnd: true }), paint);
  // Dark arch liners / underbody (seen through the wheel arches).
  box(b.L - 0.7, 0.3, W - 0.5, black, 0, b.sill + 0.17, 0);

  // ---- greenhouse ----
  const gh = stations.filter((x) => x >= rwBase - 1e-6 && x <= wsBase + 1e-6);
  // Windshield, roof lining and rear window across the top; side glass ahead of the C-pillars, and
  // painted C-pillars (the greenhouse sides behind the side glass) — built apart so they never overlap.
  add(loft(gh, (x) => [[-roofW(x), roofLine(x)], [roofW(x), roofLine(x)]]), glass);
  const sgX = at(b.sg);
  const uniq = (list) => [...new Set(list.map((x) => +x.toFixed(4)))].sort((p, q) => p - q);
  const back = uniq([...gh.filter((x) => x < sgX), sgX]), fwd = uniq([sgX, ...gh.filter((x) => x > sgX)]);
  for (const s of [-1, 1]) {
    const side = (x) => (s > 0 ? [[beltW(x), beltAt(x) - 0.01], [roofW(x), roofLine(x)]] : [[-roofW(x), roofLine(x)], [-beltW(x), beltAt(x) - 0.01]]);
    add(loft(fwd, side), glass);
    add(loft(back, side), paint);
  }
  const rs = gh.filter((x) => x >= roofR - 0.02 && x <= roofF + 0.02);
  add(loft(rs, (x) => [[-(roofW(x) - 0.01), b.roof + 0.003], [-(roofW(x) - 0.08), b.roof + 0.035], [roofW(x) - 0.08, b.roof + 0.035], [roofW(x) - 0.01, b.roof + 0.003]], { capStart: true, capEnd: true }), paint);
  for (const s of [-1, 1]) {
    bar([wsBase - 0.02, b.belt, s * beltW(wsBase)], [roofF, b.roof, s * roofW(roofF)], 0.07, 0.07, paint);                  // A-pillar
  }
  const bX = roofR + (roofF - roofR) * (liftback ? 0.62 : b.doors === 4 ? 0.48 : 0.42);
  for (const s of [-1, 1]) {
    bar([bX, b.belt, s * beltW(bX)], [bX, b.roof, s * roofW(bX)], 0.09, 0.05, black);                                     // B-pillar
    bar([wsBase, b.cowl, s * (beltW(0) + 0.012)], [rwBase, b.beltR, s * (beltW(0) + 0.012)], 0.02, 0.025, b.chromeTrim ? chrome : black); // window trim
  }
  if (b.extras?.includes('gutters')) for (const s of [-1, 1]) box(roofF - roofR, 0.03, 0.03, chrome, (roofF + roofR) / 2, b.roof + 0.01, s * (roofW(0) + 0.01));
  if (b.extras?.includes('sunroof')) box(0.55, 0.012, 0.7, glass, roofF - 0.45, b.roof + 0.04, 0);

  // ---- top-surface details: hood/trunk seams, cowl, wipers ----
  const seam = (x0, x1, z) => {
    const n = 6;
    for (let i = 0; i < n; i++) { const a = x0 + ((x1 - x0) * i) / n, c = x0 + ((x1 - x0) * (i + 1)) / n; bar([a, top(a) + 0.012, z], [c, top(c) + 0.012, z], 0.014, 0.006, black); }
  };
  for (const s of [-1, 1]) seam(xF - 0.1, wsBase - 0.05, s * (hw(0) - 0.24));
  bar([xF - 0.1, top(xF - 0.1) + 0.012, -(hw(xF - 0.1) - 0.24)], [xF - 0.1, top(xF - 0.1) + 0.012, hw(xF - 0.1) - 0.24], 0.014, 0.006, black);
  if (!liftback) {
    for (const s of [-1, 1]) seam(xR + 0.1, rwBase - 0.04, s * (hw(0) - 0.24));
    bar([xR + 0.1, top(xR + 0.1) + 0.012, -(hw(xR + 0.1) - 0.24)], [xR + 0.1, top(xR + 0.1) + 0.012, hw(xR + 0.1) - 0.24], 0.014, 0.006, black);
  }
  box(0.08, 0.02, 2 * beltW(wsBase) - 0.1, black, wsBase - 0.03, b.belt + 0.012, 0);                                          // cowl vent
  for (const z of [-0.35, 0.25]) { const w = bar([wsBase - 0.05, b.belt + 0.03, z - 0.25], [wsBase - 0.12, b.belt + 0.05, z + 0.25], 0.02, 0.02, black); w.userData.wiper = true; }

  // ---- sides: door seams, handles, markers, rub strips ----
  const doorFront = Math.min(wsBase + 0.05, axF - ARCH_R - 0.08), doorRear = bX + (b.doors === 4 ? 0 : 0.05);
  const sideSeam = (x, s) => box(0.012, b.belt - 0.46, 0.01, black, x, (b.belt + 0.42) / 2, s * (hw(x) + 0.003));
  for (const s of [-1, 1]) {
    sideSeam(doorFront, s); sideSeam(doorRear, s);
    box(0.13, 0.03, 0.02, b.chromeTrim ? chrome : black, doorRear - 0.2, b.belt - 0.09, s * (hw(0) + 0.008));                  // handle
    if (b.doors === 4) {
      const rearDoorEnd = axR + ARCH_R + 0.05;
      sideSeam(rearDoorEnd, s);
      box(0.13, 0.03, 0.02, chrome, rearDoorEnd + 0.18, b.belt - 0.09, s * (hw(0) + 0.008));
    }
    if (b.chromeLine) box(xF - xR - 0.1, 0.03, 0.02, chrome, (xF + xR) / 2, b.chromeLine, s * (hw(0) + 0.008));
    if (b.rubStrip) box(axF - axR - 2 * ARCH_R - 0.1, 0.045, 0.02, black, (axF + axR) / 2, b.rubY || 0.64, s * (hw(0) + 0.008));
    if (b.extras?.includes('rocker')) box(axF - axR - 2 * ARCH_R - 0.04, 0.12, 0.03, black, (axF + axR) / 2, b.sill + 0.065, s * (hw(0) - 0.012));
    if (b.extras?.includes('markers')) {
      const mfx = b.markerF ? axF - b.markerF : b.markerY ? xF - 0.1 : xF - 0.28, mfy = b.markerY ?? (b.markerF ? 0.6 : 0.5);
      const mrx = b.markerY ? xR + 0.1 : xR + 0.28;
      box(0.1, 0.04, 0.012, amber, mfx, mfy, s * (hw(mfx) + 0.004));
      box(0.1, 0.04, 0.012, redLens, mrx, b.markerY ?? 0.52, s * (hw(mrx) + 0.004));
    }
    if (s > 0) { const fdx = axR - (b.fuelBack ?? 0.05); box(0.1, 0.1, 0.012, black, fdx, b.beltR - (b.fuelBack ? 0.28 : 0.14), hw(fdx) + 0.005); }                                       // fuel door (right side)
  }

  // ---- bumpers ----
  if (b.bumper === 'big') {
    for (const [x, s] of [[xF + 0.1, 1], [xR - 0.1, -1]]) { box(0.22, 0.16, W + 0.04, alu, x, 0.48, 0); box(0.23, 0.05, W + 0.05, black, x + s * 0.005, 0.48, 0); }
  } else if (b.bumper === 'us') {
    // US 5-mph "diving board" bumpers: black, standing proud of the body, wrapping round to the arches,
    // with a thin bright strip along the top.
    const [byF, byR, bh] = b.bumperYs || [0.485, 0.435, 0.13];
    for (const [x0, s, y] of [[xF, 1, byF], [xR, -1, byR]]) {
      const d = bo + 0.03, cx = x0 + s * (d / 2 - 0.03);
      box(d, bh, W + 0.02, plastic, cx, y, 0);
      box(d + 0.005, 0.012, W + 0.025, chrome, cx, y + bh / 2 - 0.01, 0);
      for (const z of [-1, 1]) box(0.34, bh, 0.05, plastic, x0 - s * 0.17, y, z * (W / 2 - 0.005));
    }
    if (b.lights !== 'volvo') for (const z of [-1, 1]) face(0.13, 0.05, amber, xF + bo + 0.005, byF, z * (W / 2 - 0.13)); // indicators
  } else if (b.bumper === 'cladding') {
    for (const x of [xF + 0.02, xR - 0.02]) box(0.14, 0.2, W - 0.06, alu, x, 0.44, 0);
    for (const s of [-1, 1]) box(b.wb - 0.8, 0.16, 0.04, alu, 0, 0.42, s * (hw(0) + 0.01));
  } else {
    const [fyB, fhB] = b.bumperF || [0.44, 0.2], [ryB, rhB] = b.bumperR || [0.44, 0.2], [iw, ih, iy] = b.intake || [W - 0.3, 0.05, 0.34];
    // Body-colour bumpers, nearly flush with the body so they read as its rounded lower half.
    box(0.1, fhB, 2 * hw(xF) - 0.01, paint, xF - 0.03, fyB, 0);
    box(0.1, rhB, 2 * hw(xR) - 0.01, paint, xR + 0.03, ryB, 0);
    box(0.1, ih, iw, black, xF + 0.02, iy, 0);
  }
  const bumperX = b.bumper === 'big' ? 0.22 : b.bumper === 'us' ? bo + 0.01 : 0.09;
  if (b.extras?.includes('mudflaps')) for (const ax of axles) for (const s of [-1, 1]) box(0.02, 0.22, 0.2, black, ax - ARCH_R - 0.02, 0.26, s * b.track / 2);

  // ---- front: grille, headlights, fogs, plate ----
  const fy = (0.46 + b.nose) / 2 + 0.03;
  const fx = xF + 0.012;
  if (b.front === 'kidney') face(0.3, 0.15, decal('kidney', kidneyTex()), fx, fy, 0);
  if (b.front === 'volvo') face(0.86, 0.25, decal('volvo', volvoGrilleTex()), fx, fy, 0);
  if (b.front === 'mercedes') face(0.34, 0.26, decal('merc', mercGrilleTex()), fx, fy + 0.02, 0);
  if (b.front === 'nissan') face(0.5, 0.1, decal('nissan', blackGrilleTex()), fx, fy, 0);
  if (b.front === 'honda') { const [gw, gh, gy] = b.grille || [0.44, 0.07, fy + 0.03]; face(gw, gh, decal('nissan', blackGrilleTex()), fx, gy, 0); }
  if (b.front === 'slot') face(0.6, 0.06, decal('slot', grilleTex()), xF + 0.03, 0.4, 0);
  if (b.extras?.includes('lamppanel')) face(W - 2 * b.taper - 0.06, 0.2, black, xF + 0.008, fy, 0);
  if (b.lights === 'quad') { const [a, c] = b.lampZ || [0.36, 0.54]; for (const z of [-c, -a, a, c]) face(0.155, 0.155, decal('lamp', roundLampTex()), fx, fy, z); }
  if (b.lights === 'volvo') for (const s of [-1, 1]) {
    // Round sealed-beam lamps in square black housings, clear-over-amber indicators outboard.
    face(0.27, 0.25, black, fx - 0.002, fy, s * 0.57);
    face(0.19, 0.19, decal('lamp', roundLampTex()), fx, fy, s * 0.57);
    face(0.09, 0.12, amber, fx, fy - 0.06, s * 0.77);
    face(0.09, 0.12, decal('lamprect', rectLampTex()), fx, fy + 0.06, s * 0.77);
  }
  if (b.lights === 'rect') for (const s of [-1, 1]) face(0.34, 0.16, decal('lamprect', rectLampTex()), fx, fy, s * (W / 2 - 0.3));
  if (b.lights === 'swept') { const [lw, lh] = b.lampSize || [0.42, 0.13]; for (const s of [-1, 1]) face(lw, lh, decal('lampslim', headlightTex()), fx - 0.02, b.lampY ?? fy + 0.02, s * (b.lampZ ?? W / 2 - 0.26)); }
  if (b.lights === 'slim') for (const s of [-1, 1]) face(0.4, 0.09, decal('lampslim', headlightTex()), fx, fy + 0.02, s * (W / 2 - 0.3));
  if (b.lights === 'popup') {
    // Closed pop-up headlights: lids set into the front of the hood, outlined by a dark seam.
    const lx = xF - 0.32, ly = top(lx);
    for (const s of [-1, 1]) {
      box(0.42, 0.02, 0.42, black, lx, ly + 0.012, s * (W / 2 - 0.34));
      box(0.38, 0.03, 0.38, paint, lx, ly + 0.024, s * (W / 2 - 0.34));
      face(0.26, 0.06, decal('amberlamp', rectLampTex()), xF + 0.03, 0.46, s * (W / 2 - 0.32));
    }
  }
  if (b.extras?.includes('fogs')) for (const s of [-1, 1]) face(0.1, 0.1, decal('lamp', roundLampTex()), xF + bumperX + 0.02, 0.4, s * (W / 2 - 0.42));
  if (b.frontPlate !== false) face(0.34, 0.12, decal(`plate-${b.plate}`, plateTex(b.plate)), xF + bumperX + 0.025, b.bumper === 'us' ? (b.bumperYs?.[0] ?? 0.485) : 0.42, 0);

  // ---- rear: taillights, plate, exhausts, spoiler ----
  const ty = b.tailY ?? b.tail - 0.14, bx = xR - 0.012;
  const tail = new THREE.MeshBasicMaterial({ map: taillightTex(), color: '#8a5a5a', transparent: true, alphaTest: 0.4 });
  const tailWith = (t) => { tail.map = t; return tail; };
  if (b.tails === 'rect') for (const s of [-1, 1]) face(0.46, 0.15, tailWith(taillightTex()), bx, ty, s * (b.tailZ ?? W / 2 - 0.3), 'back');
  if (b.tails === 'volvo') for (const s of [-1, 1]) face(0.33, 0.16, tailWith(taillightTex()), bx, ty, s * b.tailZ, 'back');
  if (b.tails === 'tall') for (const s of [-1, 1]) face(0.26, 0.26, tailWith(ribbedTailTex()), bx, ty - 0.04, s * (W / 2 - 0.2), 'back');
  if (b.tails === 'ribbed') for (const s of [-1, 1]) face(0.5, 0.2, tailWith(ribbedTailTex()), bx, ty, s * (W / 2 - 0.3), 'back');
  if (b.tails === 'bar') face(W - 2 * b.taper - 0.05, 0.12, tailWith(tailBarTex()), bx, ty, 0, 'back');
  if (b.tails === 'hatch') for (const s of [-1, 1]) {
    // Tall lamps in the rear corners, wrapping onto the sides.
    face(0.21, 0.32, tailWith(ribbedTailTex()), bx, b.tailY ?? b.tail - 0.24, s * (b.tailZ ?? W / 2 - 0.15), 'back');
    const sx = xR + 0.07;
    face(0.14, 0.3, tailWith(ribbedTailTex()), sx, b.tailY ?? b.tail - 0.24, s * (hw(sx) + 0.003), s > 0 ? 'right' : 'left');
  }
  if (b.tails === 'quadround') for (const z of [-0.6, -0.4, 0.4, 0.6]) face(0.17, 0.17, tailWith(roundTailTex()), bx, ty, z, 'back');
  face(0.34, 0.14, decal(`plate-${b.plate}`, plateTex(b.plate)), bx - 0.001, b.plateY ?? Math.min(ty - 0.16, 0.66), 0, 'back');
  const pipe = once('pipe', () => { const c = new THREE.CylinderGeometry(0.04, 0.04, 0.18, 8); c.rotateZ(Math.PI / 2); return c; });
  for (let i = 0; i < (b.exhausts || 1); i++) add(pipe, chrome, xR - 0.04 - bo * 0.7, b.exhaustY ?? 0.3, (b.exhausts === 2 ? -0.42 - i * 0.1 : b.exhaustZ ?? -0.45));
  if (b.spoiler === 'lip') box(0.16, 0.05, W - 0.4, paint, xR + 0.12, b.tail + 0.01, 0);
  if (b.spoiler === 'roof') {
    // Big roof spoiler overhanging the hatch glass, with a dark centre (the brake light).
    const sw = 2 * roofW(roofR) + 0.02;
    box(0.36, 0.045, sw, paint, roofR - 0.14, b.roof + 0.01, 0);
    box(0.06, 0.03, sw * 0.5, black, roofR - 0.3, b.roof - 0.02, 0);
    for (const z of [-1, 1]) box(0.3, 0.1, 0.04, paint, roofR - 0.12, b.roof - 0.03, z * (sw / 2 - 0.02));
  }
  if (b.extras?.includes('rearwiper')) bar([rwBase + 0.1, b.beltR + 0.07, 0.05], [rwBase + 0.28, b.beltR + 0.2, 0.42], 0.02, 0.02, black);
  if (b.spoiler === 'small') {
    box(0.26, 0.03, W - 0.25, paint, xR + 0.2, b.tail + 0.1, 0);
    for (const s of [-1, 1]) box(0.06, 0.1, 0.05, black, xR + 0.22, b.tail + 0.05, s * (W / 2 - 0.3));
  }
  if (b.extras?.includes('antenna')) add(once('antenna', () => new THREE.CylinderGeometry(0.006, 0.006, 0.7, 4)), black, ...(b.hatch ? [roofF - 0.25, b.roof + 0.3, -(roofW(roofF) - 0.05)] : [xR + 0.35, b.tail + 0.33, -(hw(xR + 0.35) - 0.12)]));

  // ---- mirrors ----
  for (const s of [-1, 1]) {
    const mx = wsBase - (b.mirrorBack || 0.12);
    box(0.1, 0.03, 0.08, black, mx, b.belt + 0.04, s * (hw(mx) + 0.02));
    box(0.14, 0.1, 0.1, b.chromeTrim && !b.paintMirrors ? black : paint, mx - 0.02, b.belt + 0.1, s * (hw(mx) + 0.07));
  }

  // ---- wheels: tire, brake disc, textured wheel face ----
  const tire = once(`tire-${WHEEL_R}-${b.tireW}`, () => { const t = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, b.tireW, 14); t.rotateX(Math.PI / 2); return t; });
  const faceGeo = once(`wheelface-${WHEEL_R}`, () => new THREE.CircleGeometry(WHEEL_R, 14));
  const disc = once('disc', () => new THREE.MeshLambertMaterial({ color: '#5a5e64' }));
  const wheelMat = decal(`wheel-${b.rim}`, wheelTex(b.rim));
  for (const ax of axles) for (const s of [-1, 1]) {
    const zc = s * b.track / 2;
    add(tire, black, ax, WHEEL_R, zc);
    const f = add(faceGeo, wheelMat, ax, WHEEL_R, zc + s * (b.tireW / 2 + 0.002));
    f.rotation.y = s > 0 ? 0 : Math.PI;
    const d = add(faceGeo, disc, ax, WHEEL_R, zc + s * 0.06);
    d.scale.setScalar(0.62); d.rotation.y = f.rotation.y;
  }

  // Soft blob shadow.
  const sh = new THREE.Mesh(once('shadowgeo', () => new THREE.PlaneGeometry(1, 1)), once('shadow', () => new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.4, depthWrite: false })));
  sh.scale.set(b.L + 0.4, W + 0.5, 1);
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05; g.add(sh);

  // Headlight beams (switched on at night).
  const beam = new THREE.SpotLight('#fff1cf', 0, 70, 0.55, 0.5, 1.2);
  beam.position.set(xF - 0.2, 0.8, 0);
  beam.target.position.set(14, -1.5, 0);
  g.add(beam, beam.target);

  g.rotation.order = 'YZX';
  return { group: g, tail, beam, length: b.L };
}
