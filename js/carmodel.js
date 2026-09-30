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

// L length, W width, wb wheelbase. nose/belt/tail: heights of the front edge, beltline and rear deck.
// hood/deck: lengths from the ends to the windshield / rear window base. roof height; ws/rw: windshield
// and rear-window lean. taper: how much the corners round in from above. doors: 2 or 4.
// front/lights/tails/bumper/rim: detail styles. plate: 'us' or 'jp'. extras: optional details.
const CARS = {
  e30:      { L: 4.33, W: 1.65, wb: 2.57, nose: 0.74, belt: 0.93, tail: 0.93, hood: 1.22, deck: 0.98, roof: 1.37, ws: 0.52, rw: 0.42, taper: 0.12, doors: 2,
              front: 'kidney', lights: 'quad', tails: 'rect', bumper: 'chrome', rim: 'mesh', plate: 'us', chromeTrim: true, rubStrip: true, extras: ['sunroof', 'antenna', 'markers'] },
  volvo242: { L: 4.79, W: 1.71, wb: 2.64, nose: 0.8, belt: 0.96, tail: 0.97, hood: 1.28, deck: 1.1, roof: 1.43, ws: 0.42, rw: 0.3, taper: 0.05, doors: 2,
              front: 'volvo', lights: 'rect', tails: 'tall', bumper: 'big', rim: 'turbine', plate: 'us', chromeTrim: true, extras: ['gutters', 'antenna', 'mudflaps', 'markers'] },
  mb190e:   { L: 4.42, W: 1.68, wb: 2.665, nose: 0.7, belt: 0.9, tail: 1.0, hood: 1.18, deck: 0.95, roof: 1.38, ws: 0.66, rw: 0.5, taper: 0.1, doors: 4,
              front: 'mercedes', lights: 'rect', tails: 'ribbed', bumper: 'cladding', rim: 'holes', plate: 'us', chromeTrim: true, extras: ['gutters', 'fogs'] },
  s180sx:   { L: 4.54, W: 1.69, wb: 2.475, nose: 0.6, belt: 0.84, tail: 0.9, hood: 1.42, deck: 0.1, roof: 1.27, ws: 0.82, rw: 1.4, taper: 0.2, doors: 2,
              front: 'slot', lights: 'popup', tails: 'bar', bumper: 'body', rim: '5spoke', plate: 'jp', spoiler: 'lip', extras: ['markers'] },
  supra:    { L: 4.62, W: 1.745, wb: 2.595, nose: 0.6, belt: 0.86, tail: 0.92, hood: 1.55, deck: 0.12, roof: 1.3, ws: 0.85, rw: 1.3, taper: 0.2, doors: 2,
              front: 'slot', lights: 'popup', tails: 'bar', bumper: 'body', rim: '5spoke', plate: 'jp', spoiler: 'lip', exhausts: 2, extras: ['antenna', 'markers'] },
  r32:      { L: 4.53, W: 1.695, wb: 2.615, nose: 0.66, belt: 0.9, tail: 0.95, hood: 1.35, deck: 0.82, roof: 1.34, ws: 0.76, rw: 0.72, taper: 0.15, doors: 2,
              front: 'nissan', lights: 'slim', tails: 'quadround', bumper: 'body', rim: '5spoke', plate: 'jp', spoiler: 'small', extras: ['fogs'] },
};

const WHEEL_R = 0.31, ARCH_R = 0.38, SILL = 0.3;

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
  const b = CARS[modelId] || CARS.e30;
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

  const xF = b.L / 2, xR = -b.L / 2, W = b.W;
  const wsBase = xF - b.hood, rwBase = xR + Math.max(b.deck, 0.16);
  const roofF = wsBase - b.ws, roofR = rwBase + b.rw;
  const axles = [b.wb / 2, -b.wb / 2];

  // ---- profile functions ----
  const top = piecewise([[xR, b.tail - 0.06], [xR + 0.12, b.tail], [rwBase, b.belt], [wsBase, b.belt], [xF - 0.14, b.nose], [xF, b.nose - 0.06]]);
  const bottom = (x) => {
    let y = Math.abs(x) > b.L / 2 - 0.16 ? 0.37 : SILL;
    for (const ax of axles) { const d = Math.abs(x - ax); if (d < ARCH_R) y = Math.max(y, SILL + Math.sqrt(ARCH_R * ARCH_R - d * d) * 0.95); }
    return y;
  };
  const hw = (x) => { const u = Math.max(0, Math.min(1, (Math.abs(x) - (b.L / 2 - 0.55)) / 0.55)); return W / 2 - b.taper * u * u; };
  const roofLine = piecewise([[rwBase, b.belt], [roofR, b.roof], [roofF, b.roof], [wsBase, b.belt]]);
  const beltW = (x) => hw(x) - 0.07, roofW = (x) => hw(x) - 0.3;

  // Stations: evenly spaced plus the key points, so edges land where they should.
  const xs = [];
  for (let i = 0; i <= 30; i++) xs.push(xR + (b.L * i) / 30);
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
  box(b.L - 0.7, 0.34, W - 0.5, black, 0, 0.5, 0);

  // ---- greenhouse ----
  const gh = stations.filter((x) => x >= rwBase && x <= wsBase);
  add(loft(gh, (x) => [[-beltW(x), b.belt - 0.01], [-roofW(x), roofLine(x)], [roofW(x), roofLine(x)], [beltW(x), b.belt - 0.01]]), glass);
  const rs = gh.filter((x) => x >= roofR - 0.02 && x <= roofF + 0.02);
  add(loft(rs, (x) => [[-(roofW(x) - 0.01), b.roof + 0.003], [-(roofW(x) - 0.08), b.roof + 0.035], [roofW(x) - 0.08, b.roof + 0.035], [roofW(x) - 0.01, b.roof + 0.003]], { capStart: true, capEnd: true }), paint);
  const liftback = b.deck < 0.3;
  for (const s of [-1, 1]) {
    bar([wsBase - 0.02, b.belt, s * beltW(wsBase)], [roofF, b.roof, s * roofW(roofF)], 0.07, 0.07, paint);                  // A-pillar
    bar([roofR, b.roof, s * roofW(roofR)], [rwBase + 0.02, b.belt, s * beltW(rwBase)], liftback ? 0.07 : 0.24, 0.07, paint); // C-pillar
  }
  const bX = roofR + (roofF - roofR) * (liftback ? 0.62 : b.doors === 4 ? 0.48 : 0.42);
  for (const s of [-1, 1]) {
    bar([bX, b.belt, s * beltW(bX)], [bX, b.roof, s * roofW(bX)], 0.09, 0.05, black);                                     // B-pillar
    box(wsBase - rwBase, 0.025, 0.02, b.chromeTrim ? chrome : black, (wsBase + rwBase) / 2, b.belt, s * (beltW(0) + 0.012)); // window trim
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
  const doorFront = wsBase + 0.05, doorRear = bX + (b.doors === 4 ? 0 : 0.05);
  const sideSeam = (x, s) => box(0.012, b.belt - 0.46, 0.01, black, x, (b.belt + 0.42) / 2, s * (hw(x) + 0.003));
  for (const s of [-1, 1]) {
    sideSeam(doorFront, s); sideSeam(doorRear, s);
    box(0.13, 0.03, 0.02, b.chromeTrim ? chrome : black, doorRear - 0.2, b.belt - 0.09, s * (hw(0) + 0.008));                  // handle
    if (b.doors === 4) {
      const rearDoorEnd = rwBase + 0.35;
      sideSeam(rearDoorEnd, s);
      box(0.13, 0.03, 0.02, chrome, rearDoorEnd + 0.12, b.belt - 0.09, s * (hw(0) + 0.008));
    }
    if (b.rubStrip) box(b.L - 0.6, 0.045, 0.02, black, 0, 0.64, s * (hw(0) + 0.008));
    if (b.extras?.includes('markers')) {
      box(0.1, 0.04, 0.012, amber, xF - 0.28, 0.5, s * (hw(xF - 0.28) + 0.004));
      box(0.1, 0.04, 0.012, redLens, xR + 0.28, 0.52, s * (hw(xR + 0.28) + 0.004));
    }
    box(0.1, 0.1, 0.012, black, rwBase + 0.25, b.belt - 0.12, s > 0 ? hw(0) + 0.005 : -99);                                    // fuel door (right side)
  }

  // ---- bumpers ----
  if (b.bumper === 'big') {
    for (const [x, s] of [[xF + 0.1, 1], [xR - 0.1, -1]]) { box(0.22, 0.16, W + 0.04, alu, x, 0.48, 0); box(0.23, 0.05, W + 0.05, black, x + s * 0.005, 0.48, 0); }
  } else if (b.bumper === 'chrome') {
    for (const x of [xF + 0.02, xR - 0.02]) { box(0.12, 0.14, W - 0.04, plastic, x, 0.45, 0); box(0.13, 0.03, W - 0.03, chrome, x, 0.53, 0); }
  } else if (b.bumper === 'cladding') {
    for (const x of [xF + 0.02, xR - 0.02]) box(0.14, 0.2, W - 0.06, alu, x, 0.44, 0);
    for (const s of [-1, 1]) box(b.wb - 0.8, 0.16, 0.04, alu, 0, 0.42, s * (hw(0) + 0.01));
  } else {
    for (const x of [xF + 0.01, xR - 0.01]) box(0.12, 0.2, W - 2 * b.taper, paint, x, 0.44, 0);
    box(0.1, 0.05, W - 0.3, black, xF + 0.02, 0.34, 0);
  }
  const bumperX = b.bumper === 'big' ? 0.22 : 0.09;
  if (b.extras?.includes('mudflaps')) for (const ax of axles) for (const s of [-1, 1]) box(0.02, 0.22, 0.2, black, ax - ARCH_R - 0.02, 0.26, s * (hw(ax) - 0.12));

  // ---- front: grille, headlights, fogs, plate ----
  const fy = (0.46 + b.nose) / 2 + 0.03;
  const fx = xF + 0.012;
  if (b.front === 'kidney') face(0.3, 0.15, decal('kidney', kidneyTex()), fx, fy, 0);
  if (b.front === 'volvo') face(0.62, 0.22, decal('volvo', volvoGrilleTex()), fx, fy, 0);
  if (b.front === 'mercedes') face(0.34, 0.26, decal('merc', mercGrilleTex()), fx, fy + 0.02, 0);
  if (b.front === 'nissan') face(0.5, 0.1, decal('nissan', blackGrilleTex()), fx, fy, 0);
  if (b.front === 'slot') face(0.6, 0.06, decal('slot', grilleTex()), xF + 0.03, 0.4, 0);
  if (b.lights === 'quad') for (const z of [-0.54, -0.36, 0.36, 0.54]) face(0.15, 0.15, decal('lamp', roundLampTex()), fx, fy, z);
  if (b.lights === 'rect') for (const s of [-1, 1]) face(0.34, 0.16, decal('lamprect', rectLampTex()), fx, fy, s * (W / 2 - 0.3));
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
  face(0.34, 0.12, decal(`plate-${b.plate}`, plateTex(b.plate)), xF + bumperX + 0.025, 0.42, 0);

  // ---- rear: taillights, plate, exhausts, spoiler ----
  const ty = b.tail - 0.14, bx = xR - 0.012;
  const tail = new THREE.MeshBasicMaterial({ map: taillightTex(), color: '#8a5a5a', transparent: true, alphaTest: 0.4 });
  const tailWith = (t) => { tail.map = t; return tail; };
  if (b.tails === 'rect') for (const s of [-1, 1]) face(0.46, 0.14, tailWith(taillightTex()), bx, ty, s * (W / 2 - 0.3), 'back');
  if (b.tails === 'tall') for (const s of [-1, 1]) face(0.26, 0.26, tailWith(ribbedTailTex()), bx, ty - 0.04, s * (W / 2 - 0.2), 'back');
  if (b.tails === 'ribbed') for (const s of [-1, 1]) face(0.5, 0.2, tailWith(ribbedTailTex()), bx, ty, s * (W / 2 - 0.3), 'back');
  if (b.tails === 'bar') face(W - 2 * b.taper - 0.05, 0.12, tailWith(tailBarTex()), bx, ty, 0, 'back');
  if (b.tails === 'quadround') for (const z of [-0.6, -0.4, 0.4, 0.6]) face(0.17, 0.17, tailWith(roundTailTex()), bx, ty, z, 'back');
  face(0.34, 0.14, decal(`plate-${b.plate}`, plateTex(b.plate)), bx - 0.001, Math.min(ty - 0.16, 0.66), 0, 'back');
  const pipe = once('pipe', () => { const c = new THREE.CylinderGeometry(0.04, 0.04, 0.18, 8); c.rotateZ(Math.PI / 2); return c; });
  for (let i = 0; i < (b.exhausts || 1); i++) add(pipe, chrome, xR - 0.04, 0.3, (b.exhausts === 2 ? -0.42 - i * 0.1 : -0.45));
  if (b.spoiler === 'lip') box(0.16, 0.05, W - 0.4, paint, xR + 0.12, b.tail + 0.05, 0);
  if (b.spoiler === 'small') {
    box(0.26, 0.03, W - 0.25, paint, xR + 0.2, b.tail + 0.1, 0);
    for (const s of [-1, 1]) box(0.06, 0.1, 0.05, black, xR + 0.22, b.tail + 0.05, s * (W / 2 - 0.3));
  }
  if (b.extras?.includes('antenna')) add(once('antenna', () => new THREE.CylinderGeometry(0.006, 0.006, 0.7, 4)), black, xR + 0.35, b.tail + 0.33, -(hw(xR + 0.35) - 0.12));

  // ---- mirrors ----
  for (const s of [-1, 1]) {
    box(0.1, 0.03, 0.08, black, wsBase - 0.12, b.belt + 0.04, s * (hw(wsBase) + 0.02));
    box(0.14, 0.1, 0.1, b.chromeTrim ? black : paint, wsBase - 0.14, b.belt + 0.11, s * (hw(wsBase) + 0.08));
  }

  // ---- wheels: tire, brake disc, textured wheel face ----
  const tire = once('tire', () => { const t = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.2, 14); t.rotateX(Math.PI / 2); return t; });
  const faceGeo = once('wheelface', () => new THREE.CircleGeometry(WHEEL_R, 14));
  const disc = once('disc', () => new THREE.MeshLambertMaterial({ color: '#5a5e64' }));
  const wheelMat = decal(`wheel-${b.rim}`, wheelTex(b.rim));
  for (const ax of axles) for (const s of [-1, 1]) {
    const zc = s * (hw(ax) - 0.12);
    add(tire, black, ax, WHEEL_R, zc);
    const f = add(faceGeo, wheelMat, ax, WHEEL_R, zc + s * 0.102);
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
