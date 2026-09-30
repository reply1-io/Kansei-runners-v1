// 3D worlds for driving, one per road network (the cabin loop, each race course): terrain shaped
// around the roads, road surfaces, guardrails, barriers, forest, and (at home) the cabin/tent/driveway.
// Each world is built the first time it's needed and then reused.
import * as THREE from '../lib/three.module.min.js';
import { ROAD_HALF, RAIL_OFFSET, U } from './road.js';
import { HOME } from './map.js';
import { seeded } from './draw.js';

const m = (v) => v * U; // map units -> meters

// Drivable areas at the cabin, in meters (car center limits). They overlap so you can drive between them.
export const HOME_ZONES = [
  { x0: m(300), x1: m(360), z0: m(300), z1: m(422) }, // under the tent
  { x0: m(262), x1: m(398), z0: m(416), z1: m(492) }, // driveway pad
  { x0: m(306), x1: m(354), z0: m(480), z1: m(700) }, // lane down to the road
];
export const inHome = (x, z) => HOME_ZONES.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);

// ---------- terrain height ----------
const noise = (x, z) => Math.sin(x * 0.045) * Math.cos(z * 0.039) * 2.2 + Math.sin(x * 0.13 + z * 0.07) * 0.9 + Math.cos(z * 0.21 - x * 0.05) * 0.4;
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// Returns terrainAt(x, z) for a network: flattened next to its roads, slopes blended between road
// legs at different heights, rising hills farther away, and (at home) the flat cabin clearing.
function makeTerrain(net) {
  const ALL = [...net.road.samples, ...net.branches.flatMap((b) => b.samples)];
  const CELL = 12, grid = new Map();
  for (const p of ALL) {
    const k = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(p);
  }
  const coarse = ALL.filter((_, i) => i % 7 === 0);
  const CL = net.home ? { x: m(HOME.clearing.x), z: m(HOME.clearing.y), rx: m(HOME.clearing.rx), rz: m(HOME.clearing.ry) } : null;
  return function terrainAt(x, z) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    let nd = Infinity, ne = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const list = grid.get(`${cx + i},${cz + j}`);
      if (!list) continue;
      for (const p of list) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < nd) { nd = d; ne = p.e; } }
    }
    let ws = 0, es = 0, cmin = Infinity;
    for (const p of coarse) {
      const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d2 < cmin) cmin = d2;
      const w = 1 / Math.pow(d2 + 60, 1.6);
      ws += w; es += w * p.e;
    }
    const dc = Math.sqrt(cmin);
    const dn = Math.min(Math.sqrt(nd), dc);
    const far = es / ws + noise(x, z) * smooth(8, 40, dc) + 0.22 * Math.max(0, dc - 18);
    let h = nd < Infinity && dn < 30 ? ne + (far - ne) * smooth(ROAD_HALF + 1.2, ROAD_HALF + 16, dn) - 0.3 * (1 - smooth(ROAD_HALF, ROAD_HALF + 3, dn)) : far;
    let r = 9;
    if (CL) {
      r = Math.hypot((x - CL.x) / CL.rx, (z - CL.z) / CL.rz);
      h = -0.05 + (h + 0.05) * smooth(1.0, 1.5, r);
    }
    return { h, dRoad: dn, clearing: r };
  };
}

// ---------- materials / helpers ----------
function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#3a3c41'; g.fillRect(0, 0, 128, 256);
  const rnd = seeded(3);
  for (let i = 0; i < 1400; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)'; g.fillRect(rnd() * 128, rnd() * 256, 2, 2); }
  g.fillStyle = '#e8e6de'; g.fillRect(4, 0, 3, 256); g.fillRect(121, 0, 3, 256); // edge lines
  g.fillStyle = '#e1b12c'; g.fillRect(59, 0, 3, 256); g.fillRect(66, 0, 3, 256);   // double yellow
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ribbon(samples, offsetA, offsetB, yA, yB, { every = 1, withUV = false, closed = false, length = 0 } = {}) {
  const pos = [], uv = [], idx = [];
  const pts = samples.filter((_, i) => i % every === 0 || i === samples.length - 1);
  if (closed) pts.push({ ...pts[0], s: length });
  pts.forEach((p, i) => {
    pos.push(p.x + p.nx * offsetA, p.e + yA, p.z + p.nz * offsetA);
    pos.push(p.x + p.nx * offsetB, p.e + yB, p.z + p.nz * offsetB);
    if (withUV) uv.push(0, p.s / 8, 1, p.s / 8);
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (withUV) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Guardrail strip on one side, only where railed.
function railGeometry(net, side) {
  const S = net.road.samples, loop = net.road.loop;
  const pos = [], idx = [];
  let n = 0, prevOk = false;
  const end = loop ? S.length : S.length - 1;
  for (let i = 0; i <= end; i += 2) {
    const p = S[Math.min(i, S.length - 1) % S.length];
    const ok = net.isRailed(p.s, side);
    if (!ok) { prevOk = false; continue; }
    const o = side * (ROAD_HALF + RAIL_OFFSET);
    pos.push(p.x + p.nx * o, p.e + 0.45, p.z + p.nz * o, p.x + p.nx * o, p.e + 0.8, p.z + p.nz * o);
    if (prevOk) { const a = (n - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    n++; prevOk = true;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------- world ----------
const worlds = new Map();
export function getWorld(net) {
  if (!worlds.has(net.id)) worlds.set(net.id, buildWorld(net));
  return worlds.get(net.id);
}

function buildWorld(net) {
  const S = net.road.samples;
  const terrainAt = makeTerrain(net);
  const scene = new THREE.Scene();
  const sky = new THREE.Color('#7d8fa8');
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 60, 300);
  const hemi = new THREE.HemisphereLight('#c3d0ea', '#2c3a22', 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe0b5', 1.5);
  sun.position.set(-120, 160, 60);
  scene.add(sun);

  // Terrain grid covering the roads plus a margin.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of [...S, ...net.branches.flatMap((b) => b.samples)]) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  minX -= 130; maxX += 130; minZ -= 130; maxZ += 130;
  const STEPT = 5;
  const nx = Math.ceil((maxX - minX) / STEPT) + 1, nz = Math.ceil((maxZ - minZ) / STEPT) + 1;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
  const rnd = seeded(11);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = minX + i * STEPT, z = minZ + j * STEPT;
    const t = terrainAt(x, z);
    const k = (j * nx + i) * 3;
    pos[k] = x; pos[k + 1] = t.h; pos[k + 2] = z;
    const v = 0.85 + rnd() * 0.3;
    let c;
    if (t.dRoad < ROAD_HALF + 2.2) c = [0.36, 0.31, 0.24];          // dirt/gravel shoulder
    else if (t.clearing < 1.05) c = [0.25, 0.34, 0.18];              // clearing grass
    else c = [0.12, 0.2, 0.11];                                      // forest floor
    col[k] = c[0] * v; col[k + 1] = c[1] * v; col[k + 2] = c[2] * v;
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tg.setIndex(idx);
  tg.computeVertexNormals();
  scene.add(new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true })));

  // Road, shoulder, guardrails and posts.
  const closed = net.road.loop, length = net.road.length;
  scene.add(new THREE.Mesh(ribbon(S, -ROAD_HALF - 1.1, ROAD_HALF + 1.1, -0.02, -0.02, { every: 2, closed, length }), new THREE.MeshLambertMaterial({ color: '#6d6353' })));
  scene.add(new THREE.Mesh(ribbon(S, -ROAD_HALF, ROAD_HALF, 0.03, 0.03, { withUV: true, closed, length }), new THREE.MeshLambertMaterial({ map: roadTexture() })));
  const railMat = new THREE.MeshLambertMaterial({ color: '#b9bec6', side: THREE.DoubleSide });
  for (const side of [-1, 1]) scene.add(new THREE.Mesh(railGeometry(net, side), railMat));
  const postGeo = new THREE.BoxGeometry(0.14, 0.85, 0.14);
  const posts = [];
  for (let i = 0; i < S.length; i += 4) for (const side of [-1, 1]) if (net.isRailed(S[i].s, side)) posts.push([S[i], side]);
  const postMesh = new THREE.InstancedMesh(postGeo, new THREE.MeshLambertMaterial({ color: '#8a8f96' }), posts.length);
  const mtx = new THREE.Matrix4();
  posts.forEach(([p, side], i) => {
    const o = side * (ROAD_HALF + RAIL_OFFSET);
    mtx.makeTranslation(p.x + p.nx * o, p.e + 0.42, p.z + p.nz * o);
    postMesh.setMatrixAt(i, mtx);
  });
  scene.add(postMesh);

  // Side roads: narrower gravel with a "Road closed" barrier at the end.
  const branchMat = new THREE.MeshLambertMaterial({ color: '#7d7466' });
  for (const b of net.branches) {
    scene.add(new THREE.Mesh(ribbon(b.samples.slice(3), -b.half, b.half, 0.0, 0.0), branchMat));
    scene.add(barrier(b.samples[b.samples.length - 1], b.half));
  }
  // Open roads (race courses) are closed off at both ends.
  if (!closed) {
    scene.add(barrier(S[S.length - 1], ROAD_HALF + 1));
    scene.add(barrier(S[0], ROAD_HALF + 1));
  }

  // Start/finish lines (checkered strips across the road).
  for (const s of net.lines) scene.add(checkerLine(net.road, s));

  const lights = { hemi, sun, sky, fog: scene.fog };

  // Forest: instanced cones on a jittered grid, kept off the roads and out of the clearing.
  const trees = [];
  const trnd = seeded(99);
  const TS = 8.5;
  for (let z = minZ; z < maxZ; z += TS) for (let x = minX; x < maxX; x += TS) {
    const tx = x + (trnd() - 0.5) * TS * 0.9, tz = z + (trnd() - 0.5) * TS * 0.9;
    const t = terrainAt(tx, tz);
    if (t.dRoad < ROAD_HALF + 4 + trnd() * 3 || t.clearing < 1.12) continue;
    trees.push({ x: tx, z: tz, y: t.h, hgt: 9 + trnd() * 10, r: 2.2 + trnd() * 1.6, shade: 0.75 + trnd() * 0.4 });
  }
  const coneGeo = new THREE.ConeGeometry(1, 1, 7);
  coneGeo.translate(0, 0.5, 0);
  const treeMesh = new THREE.InstancedMesh(coneGeo, new THREE.MeshLambertMaterial({ color: '#ffffff' }), trees.length);
  const color = new THREE.Color();
  const q = new THREE.Quaternion();
  trees.forEach((t, i) => {
    mtx.compose(new THREE.Vector3(t.x, t.y + 1.6, t.z), q, new THREE.Vector3(t.r, t.hgt, t.r));
    treeMesh.setMatrixAt(i, mtx);
    color.setRGB(0.12 * t.shade, 0.3 * t.shade, 0.16 * t.shade);
    treeMesh.setColorAt(i, color);
  });
  scene.add(treeMesh);

  const fire = net.home ? buildHome(scene) : null;
  const skids = makeSkids(scene);
  return { scene, fire, skids, setNight: (on) => setNight(lights, on) };
}

// Day vs night: night is dark blue with short fog, so headlights do the work.
function setNight({ hemi, sun, sky, fog }, on) {
  hemi.intensity = on ? 0.32 : 1.25;
  hemi.color.set(on ? '#5d6f9c' : '#c3d0ea');
  sun.intensity = on ? 0.18 : 1.5;
  sun.color.set(on ? '#9fb3ff' : '#ffe0b5');
  sky.set(on ? '#0b1020' : '#7d8fa8');
  fog.color.copy(sky);
  fog.near = on ? 25 : 60;
  fog.far = on ? 150 : 300;
}

function barrier(p, half) {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 64; c.height = 16;
  const x = c.getContext('2d');
  for (let i = -2; i < 12; i++) { x.fillStyle = i % 2 ? '#f2f2f2' : '#d22'; x.beginPath(); x.moveTo(i * 8, 16); x.lineTo(i * 8 + 8, 16); x.lineTo(i * 8 + 16, 0); x.lineTo(i * 8 + 8, 0); x.fill(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, half * 2), [0, 1, 2, 3, 4, 5].map((i) => new THREE.MeshLambertMaterial(i === 0 || i === 1 ? { map: tex } : { color: '#ddd' })));
  board.position.y = 0.9;
  g.add(board);
  for (const side of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.1), new THREE.MeshLambertMaterial({ color: '#333' })); leg.position.set(0, 0.55, side * (half - 0.3)); g.add(leg); }
  g.position.set(p.x, p.e, p.z);
  g.rotation.y = -Math.atan2(p.tz, p.tx);
  return g;
}

// Skid marks: a ring buffer of small dark quads laid on the road.
function makeSkids(scene) {
  const MAX = 900;
  const geo = new THREE.PlaneGeometry(1, 0.28);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#0c0c0c', transparent: true, opacity: 0.5, depthWrite: false }), MAX);
  mesh.count = 0;
  mesh.frustumCulled = false;
  scene.add(mesh);
  let next = 0;
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
  return {
    add(x1, z1, x2, z2, y) {
      const len = Math.hypot(x2 - x1, z2 - z1);
      if (len < 0.05 || len > 3) return;
      q.setFromAxisAngle(up, -Math.atan2(z2 - z1, x2 - x1));
      mtx.compose(v.set((x1 + x2) / 2, y + 0.06, (z1 + z2) / 2), q, sc.set(len, 1, 1));
      mesh.setMatrixAt(next, mtx);
      next = (next + 1) % MAX;
      mesh.count = Math.max(mesh.count, next === 0 ? MAX : next);
      mesh.instanceMatrix.needsUpdate = true;
    },
    clear() { mesh.count = 0; next = 0; },
  };
}

function checkerLine(road, s) {
  const p = road.samples.find((q) => q.s >= s) || road.samples[road.samples.length - 1];
  const c = document.createElement('canvas');
  c.width = 64; c.height = 8;
  const g = c.getContext('2d');
  for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; g.fillRect(i * 4, j * 4, 4, 4); }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 1.2), new THREE.MeshLambertMaterial({ map: tex }));
  mesh.rotation.order = 'YXZ';
  mesh.rotation.y = -Math.atan2(p.nz, p.nx);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(p.x, p.e + 0.05, p.z);
  return mesh;
}

// Cabin, porch, tent, driveway, fire pit. Positions come from the 2D map layout.
function buildHome(scene) {
  const lam = (c, extra) => new THREE.MeshLambertMaterial({ color: c, ...extra });
  const box = (w, h, d, mat, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); scene.add(b); return b; };
  const flat = (x0, z0, w, d, mat, y = 0.02) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    p.rotation.x = -Math.PI / 2; p.position.set(x0 + w / 2, y, z0 + d / 2); scene.add(p);
  };
  const gravel = lam('#8a8171');
  const dw = HOME.driveway, ln = HOME.lane, tn = HOME.tent;
  flat(m(dw.x), m(dw.y), m(dw.w), m(dw.h), gravel);
  flat(m(ln.x), m(ln.y0 - 10), m(ln.w), m(ln.y1 - ln.y0 + 10), gravel, 0.015);
  flat(m(tn.x), m(tn.y), m(tn.w), m(tn.h), gravel);

  // Cabin: log walls, porch, gabled metal roof, stone chimney.
  const cb = HOME.cabin, W = m(cb.w), D = m(cb.h), cx = m(cb.x) + W / 2, cz = m(cb.y) + D / 2;
  box(W, 3.2, D, lam('#6b4a2e'), cx, 1.6, cz);
  const pr = HOME.porch;
  box(m(pr.w), 0.35, m(pr.h) + 0.5, lam('#7a5634'), m(pr.x) + m(pr.w) / 2, 0.18, m(pr.y) + m(pr.h) / 2);
  const pitch = 0.5, half = D / 2 + 0.8, slab = half / Math.cos(pitch);
  const roofMat = lam('#7b3b2c');
  for (const side of [-1, 1]) {
    const r = box(W + 1.6, 0.18, slab, roofMat, cx, 3.2 + Math.tan(pitch) * half / 2, cz + side * half / 2);
    r.rotation.x = side * pitch;
  }
  const ch = HOME.chimney;
  box(m(ch.s), 2.2, m(ch.s), lam('#8d8a84'), m(ch.x) + m(ch.s) / 2, 5.2, m(ch.y) + m(ch.s) / 2);
  const wp = HOME.woodpile;
  box(m(wp.w), 1.4, m(wp.h), lam('#8b6a45'), m(wp.x) + m(wp.w) / 2, 0.7, m(wp.y) + m(wp.h) / 2);

  // Carport tent: four poles and a translucent canvas gable roof.
  const tx0 = m(tn.x), tz0 = m(tn.y), tw = m(tn.w), td = m(tn.h);
  const poleMat = lam('#555');
  for (const [px, pz] of [[tx0, tz0], [tx0 + tw, tz0], [tx0, tz0 + td], [tx0 + tw, tz0 + td]]) box(0.1, 2.6, 0.1, poleMat, px, 1.3, pz);
  const canvasMat = lam('#cbbf9c', { transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  const tp = 0.35, th = tw / 2 / Math.cos(tp);
  for (const side of [-1, 1]) {
    const r = box(th, 0.05, td + 0.3, canvasMat, tx0 + tw / 2 + side * tw / 4, 2.6 + Math.tan(tp) * tw / 4, tz0 + td / 2);
    r.rotation.z = -side * tp;
  }

  // Fire pit with a flickering light.
  const f = HOME.firepit;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(m(f.r), 0.25, 6, 14), lam('#8d8a84'));
  ring.rotation.x = -Math.PI / 2; ring.position.set(m(f.x), 0.15, m(f.y)); scene.add(ring);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 6), new THREE.MeshBasicMaterial({ color: '#ff8a2a' }));
  flame.position.set(m(f.x), 0.6, m(f.y)); scene.add(flame);
  const light = new THREE.PointLight('#ff8a3a', 30, 22, 1.6);
  light.position.set(m(f.x), 1.5, m(f.y)); scene.add(light);
  return { flame, light };
}

// Low-poly car. Forward is +x. Returns the group plus the taillight material (for brake lights).
export function makeCarMesh(color) {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: '#1b2430' });
  const dark = new THREE.MeshLambertMaterial({ color: '#111' });
  const add = (geo, mat, x, y, z) => { const mm = new THREE.Mesh(geo, mat); mm.position.set(x, y, z); g.add(mm); return mm; };
  add(new THREE.BoxGeometry(4.4, 0.7, 1.8), body, 0, 0.62, 0);
  add(new THREE.BoxGeometry(2.2, 0.55, 1.56), glass, -0.3, 1.24, 0);
  add(new THREE.BoxGeometry(1.9, 0.08, 1.5), body, -0.35, 1.55, 0);
  const wheel = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10);
  wheel.rotateX(Math.PI / 2);
  for (const [x, z] of [[1.35, 0.82], [1.35, -0.82], [-1.35, 0.82], [-1.35, -0.82]]) add(wheel, dark, x, 0.34, z);
  const head = new THREE.MeshBasicMaterial({ color: '#fff4cc' });
  add(new THREE.BoxGeometry(0.06, 0.16, 0.36), head, 2.21, 0.72, 0.6);
  add(new THREE.BoxGeometry(0.06, 0.16, 0.36), head, 2.21, 0.72, -0.6);
  // Headlights (only switched on at night).
  const beam = new THREE.SpotLight('#fff1cf', 0, 70, 0.55, 0.5, 1.2);
  beam.position.set(2.0, 0.9, 0);
  beam.target.position.set(14, -1.5, 0);
  g.add(beam, beam.target);
  const tail = new THREE.MeshBasicMaterial({ color: '#6a0c0c' });
  add(new THREE.BoxGeometry(0.06, 0.14, 0.4), tail, -2.21, 0.75, 0.6);
  add(new THREE.BoxGeometry(0.06, 0.14, 0.4), tail, -2.21, 0.75, -0.6);
  // Soft fake shadow.
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.06; g.add(sh);
  g.rotation.order = 'YZX';
  return { group: g, tail, beam };
}
