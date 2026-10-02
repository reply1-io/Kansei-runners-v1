// 3D worlds for driving, one per road network (the cabin loop, each race course): terrain shaped
// around the roads, road surfaces, barriers, forest, and (at home) the cabin/tent/driveway.
// Each world is built the first time it's needed and then reused.
import * as THREE from '../lib/three.module.min.js';
import { U, apexesOf, COURSES, WORLD } from './road.js';
import { HOME } from './map.js';
import { seeded } from './draw.js';
import { roadTex, shoulderTex, grassTex, rockTex, treeTex, treeTopTex, skyTex, logTex, roofTex, canvasTex, gravelTex, waterfallTex } from './textures.js';
export { makeCarMesh } from './carmodel.js';

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
// Big rolling hills away from the roads (they fade out within ~20 m of a road, so driving is unchanged).
const hills = (x, z) => 9 * Math.sin(x * 0.011 + 1.3) * Math.cos(z * 0.013 - 0.4) + 6 * Math.sin((x + z) * 0.008 + 2.1) + 4 * Math.cos(x * 0.021 - z * 0.017) + 7;
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// Canyon walls: height (m) above the road at u meters past the road edge. Steep rock rising to a rim,
// then the mountain keeps climbing gently. The wall itself is a high-res mesh along the road; the
// coarse terrain uses the same profile pushed back (CANYON_TUCK) so it always stays hidden behind it.
const CANYON_H = 38, WALL_U0 = 2.2, WALL_U1 = 17, CANYON_TUCK = 9;
export function canyonProfile(u) {
  if (u <= WALL_U0) return 0;
  if (u < WALL_U1) { const t = (u - WALL_U0) / (WALL_U1 - WALL_U0); return CANYON_H * (1 - (1 - t) ** 2); }
  return CANYON_H + 0.25 * Math.max(0, u - 45);
}
// How far from a road the ground is built (beyond it the land keeps rising, so its edge is a skyline).
const BAND = 400;

// Returns terrainAt(x, z) for a network: flattened next to its roads, slopes blended between road
// legs at different heights, rising hills farther away, canyon walls, and (at home) the flat cabin
// clearing. The far field (blended road heights + distance to the nearest road) is precomputed on a
// coarse grid, so each lookup is cheap however long the roads are.
function makeTerrain(net) {
  const ALL = net.roads.flatMap((r) => r.samples);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of ALL) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  // Road samples bucketed in 12 m cells (a flat array of lists, for quick lookups).
  const bucket = (list, size) => {
    const ox = minX - 2 * size, oz = minZ - 2 * size;
    const w = Math.ceil((maxX - ox) / size) + 3, h = Math.ceil((maxZ - oz) / size) + 3, cells = new Array(w * h);
    for (const p of list) { const k = Math.floor((p.z - oz) / size) * w + Math.floor((p.x - ox) / size); (cells[k] ||= []).push(p); }
    return { at: (cx, cz) => (cx < 0 || cz < 0 || cx >= w || cz >= h ? undefined : cells[cz * w + cx]), cx: (x) => Math.floor((x - ox) / size), cz: (z) => Math.floor((z - oz) / size) };
  };
  const CELL = 12, grid = bucket(ALL, CELL);
  // Far field on a 24 m grid: inverse-distance blend of the road heights within RAD (tapering to
  // nothing at RAD), and the distance to the nearest road. Roads are bucketed so each node only
  // looks at the roads near it.
  const coarse = ALL.filter((_, i) => i % 7 === 0);
  const CC = 100, RAD = 560, cgrid = bucket(coarse, CC);
  const FG = 24, PAD = BAND + 40, CR = Math.ceil(RAD / CC);
  const fx0 = minX - PAD, fz0 = minZ - PAD;
  const fnx = Math.ceil((maxX - minX + 2 * PAD) / FG) + 1, fnz = Math.ceil((maxZ - minZ + 2 * PAD) / FG) + 1;
  const F = { mean: new Float32Array(fnx * fnz), dist: new Float32Array(fnx * fnz), ce: new Float32Array(fnx * fnz), cc: new Float32Array(fnx * fnz), half: new Float32Array(fnx * fnz) };
  for (let j = 0; j < fnz; j++) for (let i = 0; i < fnx; i++) {
    const x = fx0 + i * FG, z = fz0 + j * FG, gx = cgrid.cx(x), gz = cgrid.cz(z);
    let ws = 0, es = 0, cmin = RAD * RAD, near = null;
    for (let a = -CR; a <= CR; a++) for (let b = -CR; b <= CR; b++) {
      const list = cgrid.at(gx + a, gz + b);
      if (!list) continue;
      for (const p of list) {
        const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d2 >= RAD * RAD) continue;
        if (d2 < cmin) { cmin = d2; near = p; }
        const t = 1 - d2 / (RAD * RAD), w = (t * t) / Math.pow(d2 + 60, 1.6);
        ws += w; es += w * p.e;
      }
    }
    const k = j * fnx + i;
    F.dist[k] = Math.sqrt(cmin);
    if (near) { F.mean[k] = es / ws; F.ce[k] = near.e; F.cc[k] = near.canyon || 0; F.half[k] = near.half; }
  }
  const far = (arr, x, z) => {
    const gx = Math.max(0, Math.min(fnx - 1.001, (x - fx0) / FG)), gz = Math.max(0, Math.min(fnz - 1.001, (z - fz0) / FG));
    const i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j, k = j * fnx + i;
    return (arr[k] * (1 - u) + arr[k + 1] * u) * (1 - v) + (arr[k + fnx] * (1 - u) + arr[k + fnx + 1] * u) * v;
  };
  // The ground dips under the road so its coarse triangles never poke through on sags, and the flat
  // strip reaches one grid step past the shoulder, so a triangle reaching up a hillside can't cover
  // the road edge.
  const SINK = 0.7, STEPT = 8, FLAT = STEPT * 0.6;
  const CL = net.home ? { x: m(HOME.clearing.x), z: m(HOME.clearing.y), rx: m(HOME.clearing.rx), rz: m(HOME.clearing.ry) } : null;
  const terrainAt = function terrainAt(x, z) {
    const cx = grid.cx(x), cz = grid.cz(z);
    let nd = Infinity, np = null;
    const scan = (i, j) => {
      const list = grid.at(cx + i, cz + j);
      if (list) for (const p of list) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < nd) { nd = d; np = p; } }
    };
    // The 3x3 cells around the point find any road within 12 m; the next ring out (to 24 m) is only
    // searched when nothing is that close but a road isn't far off either.
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) scan(i, j);
    if (nd > 144 && far(F.dist, x, z) < 40) for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (Math.abs(i) === 2 || Math.abs(j) === 2) scan(i, j);
    const de = Math.sqrt(nd), exact = de <= 24;
    const d = exact ? de : Math.max(24, far(F.dist, x, z));
    const half = exact ? np.half : far(F.half, x, z);
    const farH = far(F.mean, x, z) + noise(x, z) * smooth(8, 40, d) + 0.22 * Math.max(0, d - 18) + hills(x, z) * smooth(20, 90, d);
    const flat = FLAT + (exact ? np.apron || 0 : 0); // run-off areas are flat too
    let h = exact ? np.e + (farH - np.e) * smooth(half + 1.2 + flat, half + 16 + flat, d) - SINK * (1 - smooth(half + flat, half + 3 + flat, d)) : farH;
    const cc = exact ? np.canyon : far(F.cc, x, z);
    if (cc > 0.01) {
      const rise = canyonProfile(d - half - CANYON_TUCK);
      if (rise > 0) h += cc * Math.max(0, (exact ? np.e : far(F.ce, x, z)) + rise - h);
    }
    let r = 9;
    if (CL) {
      r = Math.hypot((x - CL.x) / CL.rx, (z - CL.z) / CL.rz);
      h = -0.05 + (h + 0.05) * smooth(1.0, 1.5, r);
    }
    // How far past the edge trees and boulders must stay: clear of any barrier, else 2.8 m.
    const clear = exact && np.clear !== undefined ? np.clear : 2.8;
    return { h, dRoad: d, clearing: r, half, canyon: cc, clear };
  };
  terrainAt.farDist = (x, z) => far(F.dist, x, z);
  terrainAt.STEPT = STEPT;
  return terrainAt;
}

// ---------- ground, forest and boulders, streamed in tiles ----------
// The map is cut into 320 m square tiles. A tile's ground (only where it's within BAND of a road),
// trees and boulders are built the first time the camera comes near it, a tile or two per frame, so
// the whole map never has to be built up front; tiles off screen aren't drawn. Each ground triangle is
// grass, rock (steep cuts and banks) or dirt (road shoulders): hard edges, PS1 style.
const TILE_CELLS = 40, VIEW = 900;
let treeAssets = null;
function makeTileStreamer(scene, terrainAt, { minX, maxX, minZ, maxZ }, { apexNear, water }) {
  const STEPT = terrainAt.STEPT, T = TILE_CELLS, SIZE = STEPT * T;
  const GROUND = 340, gx0 = minX - GROUND, gz0 = minZ - GROUND;
  const nti = Math.ceil((maxX + GROUND - gx0) / SIZE), ntj = Math.ceil((maxZ + GROUND - gz0) / SIZE);
  const mats = [grassTex(), rockTex(), shoulderTex()].map((map) => new THREE.MeshLambertMaterial({ map, vertexColors: true }));
  const hash = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
  // Tiles worth building at all (near some road), each built once.
  const todo = [];
  for (let tj = 0; tj < ntj; tj++) for (let ti = 0; ti < nti; ti++) {
    const x0 = gx0 + ti * SIZE, z0 = gz0 + tj * SIZE;
    if (terrainAt.farDist(x0 + SIZE / 2, z0 + SIZE / 2) <= BAND + SIZE * 0.75) todo.push({ ti, tj, x0, z0, cx: x0 + SIZE / 2, cz: z0 + SIZE / 2, done: false, stage: 0 });
  }
  if (!treeAssets) {
    const quad = (rot) => { const p = new THREE.PlaneGeometry(1, 1); p.translate(0, 0.5, 0); p.rotateY(rot); return p; };
    const topGeo = new THREE.PlaneGeometry(1, 1); topGeo.rotateX(-Math.PI / 2);
    treeAssets = {
      crossGeo: mergeGeos([quad(0), quad(Math.PI / 2)]),
      treeMats: [0, 1].map((v) => new THREE.MeshLambertMaterial({ map: treeTex(v), alphaTest: 0.5, side: THREE.DoubleSide })),
      topGeo, topMat: new THREE.MeshLambertMaterial({ map: treeTopTex(), alphaTest: 0.5 }),
      rockGeo: new THREE.IcosahedronGeometry(1, 0), rockMat: new THREE.MeshLambertMaterial({ map: rockTex(), flatShading: true }),
    };
  }

  function ground(tile) {
    const { x0, z0 } = tile;
    // Heights with a one-cell border, so normals match across tile edges.
    const W = T + 3, H = new Float32Array(W * W), info = new Array((T + 1) * (T + 1));
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
      const x = x0 + (i - 1) * STEPT, z = z0 + (j - 1) * STEPT;
      const inner = i >= 1 && j >= 1 && i <= T + 1 && j <= T + 1;
      const built = terrainAt.farDist(x, z) <= BAND;
      if (!built && !inner) { H[j * W + i] = NaN; continue; }
      const t = terrainAt(x, z);
      H[j * W + i] = t.h;
      if (inner && built) info[(j - 1) * (T + 1) + (i - 1)] = t;
    }
    const pos = [], col = [], uv = [], nor = [];
    let ymin = Infinity;
    for (let j = 0; j <= T; j++) for (let i = 0; i <= T; i++) {
      const k = (j + 1) * W + (i + 1), h = H[k];
      if (!Number.isNaN(h)) ymin = Math.min(ymin, h);
    }
    for (let j = 0; j <= T; j++) for (let i = 0; i <= T; i++) {
      const x = x0 + i * STEPT, z = z0 + j * STEPT, k = (j + 1) * W + (i + 1), h = H[k];
      pos.push(x, Number.isNaN(h) ? ymin : h, z);
      uv.push(x / 7, z / 7);
      const hl = H[k - 1], hr = H[k + 1], hd = H[k - W], hu = H[k + W];
      const dx = (Number.isNaN(hr) ? h : hr) - (Number.isNaN(hl) ? h : hl), dz = (Number.isNaN(hu) ? h : hu) - (Number.isNaN(hd) ? h : hd);
      const nl = Math.hypot(dx, 2 * STEPT, dz) || 1;
      nor.push(-dx / nl, (2 * STEPT) / nl, -dz / nl);
      // Gentle light/dark variation across the ground; shaded forest floor under the trees. Far from
      // the roads (where no trees are planted, see TREE_REACH) it fades to dark canopy green, so the
      // forest still looks unbroken into the distance.
      const t = info[j * (T + 1) + i];
      if (!t) { col.push(0, 0, 0); continue; }
      const v = (0.82 + hash(Math.round(x / STEPT), Math.round(z / STEPT)) * 0.22) * (t.clearing < 1.05 ? 1.08 : 0.72);
      const fade = t.clearing < 1.05 ? 0 : Math.min(1, Math.max(0, (t.dRoad - (TREE_REACH - 12)) / 12));
      col.push(v * (1 - fade * 0.55), v * (1 - fade * 0.25), v * (1 - fade * 0.6));
    }
    const groups = [[], [], []];
    const kind = (a, b, c) => {
      const ta = info[a], tb = info[b], tc = info[c];
      if (Math.max(ta.dRoad - ta.half, tb.dRoad - tb.half, tc.dRoad - tc.half) < 3.2 && ta.clear < 20) return 2; // (circuit run-off stays grass)
      const hs = [pos[a * 3 + 1], pos[b * 3 + 1], pos[c * 3 + 1]];
      return Math.max(...hs) - Math.min(...hs) > STEPT * 1.15 ? 1 : 0;
    };
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
      const a = j * (T + 1) + i, b = a + 1, c = a + T + 1, d = c + 1;
      if (!info[a] || !info[b] || !info[c] || !info[d]) continue;
      groups[kind(a, c, b)].push(a, c, b);
      groups[kind(b, c, d)].push(b, c, d);
    }
    if (!groups[0].length && !groups[1].length && !groups[2].length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex([...groups[0], ...groups[1], ...groups[2]]);
    g.addGroup(0, groups[0].length, 0);
    g.addGroup(groups[0].length, groups[1].length, 1);
    g.addGroup(groups[0].length + groups[1].length, groups[2].length, 2);
    g.computeBoundingSphere();
    scene.add(new THREE.Mesh(g, mats));
  }

  // Forest: crossed-quad sprite trees (the classic late-90s way) on a jittered grid, kept off the
  // roads, out of the clearing, off canyon walls (only up on the rim), clear of the apex cut-throughs
  // and in open glades round the water. Trees near the road are shorter, so the chase camera can see
  // over them into the next corner.
  function forest(tile, rnd) {
    const TS = 3.6, trees = []; // dense: the canopy closes over almost all the ground
    for (let z = tile.z0; z < tile.z0 + SIZE; z += TS) for (let x = tile.x0; x < tile.x0 + SIZE; x += TS) {
      const tx = x + (rnd() - 0.5) * TS * 0.9, tz = z + (rnd() - 0.5) * TS * 0.9;
      if (terrainAt.farDist(tx, tz) > TREE_REACH + 30) continue;
      const t = terrainAt(tx, tz);
      if (t.dRoad < t.half + t.clear + rnd() * 1.2 || t.dRoad > TREE_REACH || t.clearing < 1.12) continue;
      if (t.canyon > 0.25 && t.dRoad < t.half + 30) continue;
      if (apexNear(tx, tz) || nearWater(water, tx, tz, 10)) continue;
      trees.push({ x: tx, z: tz, y: t.h, hgt: Math.min(9 + rnd() * 10, 2.5 + (t.dRoad - t.half) * 0.55), r: 2.4 + rnd() * 1.4, shade: 0.75 + rnd() * 0.4 });
    }
    if (!trees.length) return;
    const { crossGeo, treeMats, topGeo, topMat } = treeAssets;
    const color = new THREE.Color(), mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v3 = new THREE.Vector3(), sc3 = new THREE.Vector3();
    [0, 1].forEach((v) => {
      const list = trees.filter((_, i) => i % 2 === v);
      if (!list.length) return;
      const tm = new THREE.InstancedMesh(crossGeo, treeMats[v], list.length);
      list.forEach((t, n) => {
        q.setFromAxisAngle(up, (n * 2.6 + v) % Math.PI);
        tm.setMatrixAt(n, mtx.compose(v3.set(t.x, t.y - 0.3, t.z), q, sc3.set(t.r * 2.4, t.hgt, t.r * 2.4)));
        tm.setColorAt(n, color.setScalar(t.shade));
      });
      tm.computeBoundingSphere();
      scene.add(tm);
    });
    // A flat crown on top of each tree for overhead views.
    const tops = new THREE.InstancedMesh(topGeo, topMat, trees.length);
    trees.forEach((t, n) => {
      q.setFromAxisAngle(up, n * 0.7);
      tops.setMatrixAt(n, mtx.compose(v3.set(t.x, t.y + t.hgt * 0.62, t.z), q, sc3.set(t.r * 2.6, 1, t.r * 2.6)));
      tops.setColorAt(n, color.setScalar(t.shade));
    });
    tops.computeBoundingSphere();
    scene.add(tops);
  }

  // Boulders scattered through the forest, more on steep ground.
  function boulders(tile, rnd) {
    const rocks = [];
    for (let z = tile.z0; z < tile.z0 + SIZE; z += 10) for (let x = tile.x0; x < tile.x0 + SIZE; x += 10) {
      const rx = x + (rnd() - 0.5) * 9, rz = z + (rnd() - 0.5) * 9, a = rnd(), b = rnd();
      if (terrainAt.farDist(rx, rz) > TREE_REACH + 60) continue;
      const t = terrainAt(rx, rz);
      if (t.dRoad > TREE_REACH + 40 || t.dRoad <= t.half + Math.max(5.4, t.clear + 1) || t.clearing <= 1.15 || t.canyon >= 0.25) continue;
      const slope = Math.abs(terrainAt(rx + 3, rz).h - terrainAt(rx - 3, rz).h) + Math.abs(terrainAt(rx, rz + 3).h - terrainAt(rx, rz - 3).h);
      if (a < 0.05 + Math.min(0.5, slope * 0.08)) rocks.push({ x: rx, z: rz, y: t.h, s: 0.5 + b * (slope > 3 ? 2.6 : 1.4) });
    }
    addRocks(scene, rocks, rnd);
  }

  // A tile is built in three steps (ground, trees, boulders), so streaming costs a step per frame.
  const STEPS = [ground, forest, boulders];
  function step(tile) {
    tile.rnd ||= seeded(1000 + tile.tj * 997 + tile.ti);
    STEPS[tile.stage++](tile, tile.rnd);
    if (tile.stage === STEPS.length) tile.done = true;
  }
  function build(tile) { while (!tile.done) step(tile); }
  return {
    // Build what's needed around (x, z): everything close at once (nothing missing on the first
    // frame), then the next nearest tile in view range a frame at a time.
    update(x, z) {
      let next = null, nd = Infinity;
      for (const t of todo) {
        if (t.done) continue;
        const d = Math.hypot(t.cx - x, t.cz - z);
        if (d < SIZE * 1.1) build(t);
        else if (d < VIEW && d < nd) { nd = d; next = t; }
      }
      if (next) step(next);
    },
    remaining: () => todo.filter((t) => !t.done).length,
  };
}

function addRocks(scene, rocks, rnd) {
  if (!rocks.length) return;
  const mesh = new THREE.InstancedMesh(treeAssets.rockGeo, treeAssets.rockMat, rocks.length);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), color = new THREE.Color();
  rocks.forEach((r, i) => {
    q.setFromEuler(e.set(rnd() * 0.5, rnd() * 6.28, rnd() * 0.5));
    mtx.compose(new THREE.Vector3(r.x, r.y + r.s * 0.15, r.z), q, new THREE.Vector3(r.s * (0.8 + rnd() * 0.5), r.s * (0.5 + rnd() * 0.4), r.s * (0.8 + rnd() * 0.5)));
    mesh.setMatrixAt(i, mtx);
    mesh.setColorAt(i, color.setScalar(0.75 + rnd() * 0.35));
  });
  mesh.computeBoundingSphere();
  scene.add(mesh);
}

// ---------- geometry helpers ----------
function ribbon(samples, offsetA, offsetB, yA, yB, { every = 1, withUV = false, closed = false, length = 0, uAcross = 1, vPer = 8 } = {}) {
  const pos = [], uv = [], idx = [];
  const pts = samples.filter((_, i) => i % every === 0 || i === samples.length - 1);
  if (closed) pts.push({ ...pts[0], s: length });
  const off = (o, p) => (typeof o === 'function' ? o(p) : o);
  pts.forEach((p, i) => {
    const oa = off(offsetA, p), ob = off(offsetB, p);
    pos.push(p.x + p.nx * oa, p.e + yA, p.z + p.nz * oa);
    pos.push(p.x + p.nx * ob, p.e + yB, p.z + p.nz * ob);
    if (withUV) uv.push(0, p.s / vPer, uAcross, p.s / vPer);
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (withUV) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------- world ----------
// How far the dirt cut-through on the inside of each apex reaches past the road edge (m).
export const APEX_CUT = 4.2;
// Real trees are planted out to this far from any road (m); beyond it the ground is shaded as canopy.
const TREE_REACH = 48;

// The whole map is one world (built the first time it's needed); every drive and the home screen
// share it.
let theWorld = null;
export function getWorld() {
  if (!theWorld) theWorld = buildWorld(WORLD);
  return theWorld;
}

function buildWorld(net) {
  const ROADS = net.roads, ALLS = ROADS.flatMap((r) => r.samples);
  const cutMat = new THREE.MeshLambertMaterial({ map: gravelTex(), color: '#b08a5a', side: THREE.DoubleSide });
  const baseTerrain = makeTerrain(net);
  // Ponds and plunge pools are carved into the ground (filled in below, once the bounds are known).
  let carves = [];
  const terrainAt = (x, z) => {
    const t = baseTerrain(x, z);
    for (const c of carves) {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < c.r + 8) t.h = Math.min(t.h, d < c.r ? c.level - c.depth * (1 - (d / c.r) ** 2) : c.level + (d - c.r) * 0.35);
    }
    return t;
  };
  terrainAt.farDist = baseTerrain.farDist;
  terrainAt.STEPT = baseTerrain.STEPT;
  const scene = new THREE.Scene();
  const sky = new THREE.Color('#8ea6b8'); // horizon haze: blue-grey mountain air, not white
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 150, 620);
  const hemi = new THREE.HemisphereLight('#e2ecff', '#56663a', 1.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff2da', 1.9);
  sun.position.set(-90, 200, 70);
  scene.add(sun);
  // Painted sky panorama on a big cylinder that follows the camera (see world.follow).
  const skyTexture = skyTex();
  skyTexture.wrapS = THREE.RepeatWrapping; skyTexture.repeat.set(2, 1);
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, fog: false, depthWrite: false, depthTest: false });
  const skyMesh = new THREE.Mesh(new THREE.CylinderGeometry(500, 500, 330, 24, 1, true), skyMat);
  skyMesh.renderOrder = -10;
  scene.add(skyMesh);

  // Bounds of all the roads plus a margin (trees, rocks, water are placed inside these).
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of ALLS) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  minX -= 130; maxX += 130; minZ -= 130; maxZ += 130;
  const water = findWaterSites(net, baseTerrain, { minX, maxX, minZ, maxZ });
  const farDist = baseTerrain.farDist;
  carves = [...water.ponds.map((p) => ({ ...p, depth: 1.4 })), ...water.falls.map((f) => ({ x: f.bot.x, z: f.bot.z, r: 4.5, level: f.bot.h + 0.15, depth: 1.0 }))];

  // Roads and shoulders. No guardrails: run wide and you're in the dirt, then the trees. The roads
  // out to the courses start a little under the home loop where they join it, so the two don't fight.
  const shoulderMat = new THREE.MeshLambertMaterial({ map: shoulderTex() });
  for (const r of ROADS) {
    const S = r.to ? r.samples.slice(3) : r.samples, closed = r.loop, length = r.length, dy = r.to ? -0.03 : 0;
    scene.add(new THREE.Mesh(ribbon(S, (p) => -p.half - 1.1, (p) => p.half + 1.1, -0.12 + dy, -0.12 + dy, { every: 2, closed, length, withUV: true, uAcross: 3, vPer: 3 }), shoulderMat));
    // The surface changes with the road: two lanes, a narrow mountain road, or a single lane.
    const style = (p) => (p.half < 2.8 ? 'lane' : r.style || 'two');
    if (closed) scene.add(new THREE.Mesh(ribbon(S, (p) => -p.half, (p) => p.half, 0.03, 0.03, { withUV: true, closed, length, vPer: 10 }), new THREE.MeshLambertMaterial({ map: roadTex(style(S[0])) })));
    else {
      for (let i0 = 0; i0 < S.length - 1;) {
        let i1 = i0 + 1;
        while (i1 < S.length - 1 && style(S[i1]) === style(S[i0])) i1++;
        scene.add(new THREE.Mesh(ribbon(S.slice(i0, i1 + 1), (p) => -p.half, (p) => p.half, 0.03 + dy, 0.03 + dy, { withUV: true, vPer: 10 }), new THREE.MeshLambertMaterial({ map: roadTex(style(S[i0])) })));
        i0 = i1;
      }
    }
  }

  // Dirt cut-throughs on the inside of every apex: packed dirt you can clip to cut the corner.
  // Widest (APEX_CUT m) at the apex, tapering to nothing 14 m either side.
  const apexCuts = ROADS.filter((road) => !road.track).flatMap((road) => apexesOf(road).map((a) => {
    const pos = [], uv = [], idx = [], COLS = 7;
    let n = 0;
    for (let ds = -14; ds <= 14; ds += 1) {
      const q = road.sampleAtS(a.s + ds), w = APEX_CUT * (1 - (ds / 14) ** 2);
      for (let c = 0; c < COLS; c++) {
        const off = q.half - 0.05 + (0.1 + w) * (c / (COLS - 1));
        const x = q.x + q.nx * off * a.inside, z = q.z + q.nz * off * a.inside;
        pos.push(x, Math.max(terrainAt(x, z).h, q.e - 0.25) + 0.07, z);
        uv.push(off / 2, (a.s + ds) / 2);
      }
      if (n) for (let c = 0; c < COLS - 1; c++) { const b = (n - 1) * COLS + c, d = b + COLS; idx.push(b, b + 1, d, b + 1, d + 1, d); }
      n++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, cutMat));
    const q = road.sampleAtS(a.s), off = (q.half + APEX_CUT / 2) * a.inside;
    return { x: q.x + q.nx * off, z: q.z + q.nz * off };
  }));

  for (const r of ROADS) if (r.track) buildTrackside(scene, r, terrainAt);

  for (const r of ROADS) {
    // Each road out to a course passes under a wooden arch with the course's name just before it.
    if (r.to) scene.add(gatewayArch(r.sampleAtS(r.length - 20), r.sampleAtS(r.length - 20).half + 1.2, COURSES[r.to].name));
    // The far end of each course is closed off.
    if (r.closedEnd) { const e = r.samples[r.samples.length - 1]; scene.add(barrier(e, e.half + 1)); }
  }

  // Start/finish lines (checkered strips across the road).
  for (const l of net.lines) scene.add(checkerLine(l.road, l.s));

  const lights = { hemi, sun, sky, fog: scene.fog };

  // Forest: instanced cones on a jittered grid, kept off the roads and out of the clearing.
  // Trees near the road are shorter, so the chase camera can see over them into the next corner.
  // No trees on canyon walls (only up on the rim).
  const apexCells = new Map(), ak = (i, j) => (i + 50000) * 100000 + (j + 50000);
  for (const c of apexCuts) { const k = ak(Math.floor(c.x / 16), Math.floor(c.z / 16)); (apexCells.get(k) || apexCells.set(k, []).get(k)).push(c); }
  const apexNear = (x, z) => {
    const i = Math.floor(x / 16), j = Math.floor(z / 16);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const c of apexCells.get(ak(i + a, j + b)) || []) if ((c.x - x) ** 2 + (c.z - z) ** 2 < 64) return true;
    return false;
  };
  const tiles = makeTileStreamer(scene, terrainAt, { minX, maxX, minZ, maxZ }, { apexNear, water });

  // Canyon walls: rock faces rising from the shoulder on both sides, built along the road.
  const canyonRocks = ROADS.flatMap((r) => buildCanyonWalls(scene, r, terrainAt));

  const waterFx = buildWater(scene, water, terrainAt);
  buildRocks(scene, terrainAt, water, canyonRocks);
  const mountains = buildMountains(scene);


  const fire = net.home ? buildHome(scene) : null;
  const skids = makeSkids(scene);
  return {
    scene, fire, skids, terrainAt,
    setNight: (on) => { setNight(lights, on); skyMat.color.set(on ? '#1b2440' : '#ffffff'); },
    // Keep the sky panorama centered on the camera, and build the ground around it as it moves.
    follow: (cam) => {
      skyMesh.position.set(cam.position.x, cam.position.y + 40, cam.position.z);
      mountains.position.set(cam.position.x, cam.position.y, cam.position.z);
      tiles.update(cam.position.x, cam.position.z);
    },
    // Per-frame animation (waterfalls flowing). t in seconds.
    update: (t) => waterFx.update(t),
  };
}

// Day vs night: night is dark blue with short fog, so headlights do the work.
function setNight({ hemi, sun, sky, fog }, on) {
  hemi.intensity = on ? 0.32 : 1.2;
  hemi.color.set(on ? '#5d6f9c' : '#e2ecff');
  sun.intensity = on ? 0.18 : 1.9;
  sun.color.set(on ? '#9fb3ff' : '#fff2da');
  sky.set(on ? '#0b1020' : '#8ea6b8');
  fog.color.copy(sky);
  fog.near = on ? 25 : 150;
  fog.far = on ? 150 : 620;
}

// Merge simple non-indexed-compatible geometries (positions, normals, uvs).
function mergeGeos(geos) {
  const parts = geos.map((g) => g.toNonIndexed());
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const size = parts[0].attributes[name].itemSize;
    const arr = new Float32Array(parts.reduce((n, g) => n + g.attributes[name].array.length, 0));
    let o = 0;
    for (const g of parts) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  return out;
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

// Closed tracks: barriers along both sides (tyre walls or concrete, with an opening where the access
// road comes in), red and white kerbs on the inside of the corners, and at Tsukuba a pit building,
// grandstand and the footbridge over Dunlop corner.
function buildTrackside(scene, road, terrainAt) {
  const S = road.samples, N = S.length;
  const interior = Math.sign(S.reduce((sum, p) => sum + p.kSigned, 0)) || 1; // which side is the infield
  const gap = (i, side) => (road.wallGaps || []).some((g) => g.side === side && i >= g.i0 && i <= g.i1);
  // Barriers: one strip per side, broken at the gaps.
  const tyreTex = (() => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = '#1d1d1f'; g.fillRect(0, 0, 32, 16);
    for (let i = 0; i < 4; i++) { g.fillStyle = '#2c2c30'; g.beginPath(); g.arc(4 + i * 8, 8, 3.2, 0, 7); g.fill(); }
    g.fillStyle = road.barrier === 'tyres' ? '#d8d8d8' : '#9a9890'; g.fillRect(0, 0, 32, 3);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const wallMat = road.barrier === 'tyres' ? new THREE.MeshLambertMaterial({ map: tyreTex, side: THREE.DoubleSide }) : new THREE.MeshLambertMaterial({ map: gravelTex(), color: '#e4e1d8', emissive: '#4a4844', side: THREE.DoubleSide });
  const H = road.barrier === 'tyres' ? 0.9 : 1.2;
  for (const side of [-1, 1]) {
    let pos = [], uv = [], idx = [], rows = 0;
    const flush = () => {
      if (rows > 1) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx); g.computeVertexNormals();
        scene.add(new THREE.Mesh(g, wallMat));
      }
      pos = []; uv = []; idx = []; rows = 0;
    };
    for (let i = 0; i <= N; i += 2) {
      const p = S[i % N];
      if (gap(i % N, side)) { flush(); continue; }
      const off = side * (p.half + p.wall), x = p.x + p.nx * off, z = p.z + p.nz * off;
      const y0 = Math.min(p.e, terrainAt(x, z).h) - 0.3;
      pos.push(x, y0, z, x, p.e + H, z);
      uv.push((i % N) / 2, 0, (i % N) / 2, 1);
      if (rows) { const a = (rows - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      rows++;
    }
    flush();
  }
  // Kerbs on the inside of every real corner.
  if (road.kerbs) {
    const c = document.createElement('canvas'); c.width = 8; c.height = 16;
    const g = c.getContext('2d'); g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 8, 16); g.fillStyle = '#d42020'; g.fillRect(0, 0, 8, 8);
    const kt = new THREE.CanvasTexture(c); kt.wrapS = kt.wrapT = THREE.RepeatWrapping; kt.magFilter = THREE.NearestFilter; kt.colorSpace = THREE.SRGBColorSpace;
    const kerbMat = new THREE.MeshLambertMaterial({ map: kt });
    let run = [];
    const emit = () => {
      if (run.length > 6) {
        const sg = Math.sign(run.reduce((sum, p) => sum + p.kSigned, 0));
        scene.add(new THREE.Mesh(ribbon(run, (p) => sg * (p.half - 0.4), (p) => sg * (p.half + 1.0), 0.06, 0.06, { withUV: true, vPer: 3 }), kerbMat));
      }
      run = [];
    };
    for (let i = 0; i < N; i++) {
      const p = S[i];
      if (Math.abs(p.kSigned) > 1 / 140 && (!run.length || Math.sign(run[0].kSigned) === Math.sign(p.kSigned))) run.push(p);
      else { emit(); if (Math.abs(p.kSigned) > 1 / 140) run.push(p); }
    }
    emit();
  }
  if (road.id !== 'tsukuba') return;
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
  const at = (s, lat) => { const q = road.sampleAtS(s); return { x: q.x + q.nx * lat, z: q.z + q.nz * lat, e: q.e, h: Math.atan2(q.tz, q.tx) }; };
  const box = (w, hgt, d, mat, p, y = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), mat); b.position.set(p.x, p.e + y + hgt / 2, p.z); b.rotation.y = -p.h; scene.add(b); return b; };
  // Pit building along the main straight, outside the barrier; grandstand across the track.
  const out = -interior * (S[0].half + S[0].wall + 9);
  box(150, 6, 12, lam('#e6e6e0'), at(road.startS - 20, out));
  box(152, 0.6, 14, lam('#2d5aa0'), at(road.startS - 20, out), 6);
  const stand = at(road.startS - 30, interior * (S[0].half + S[0].wall + 8));
  for (let k = 0; k < 5; k++) box(90, 0.9, 2.4, lam(k % 2 ? '#bdbdb5' : '#a7a7a0'), { ...stand, x: stand.x + Math.cos(stand.h + Math.PI / 2) * interior * k * 2.2, z: stand.z + Math.sin(stand.h + Math.PI / 2) * interior * k * 2.2 }, k * 0.9);
  // The footbridge over Dunlop corner: a yellow span on two towers.
  if (road.bridgeS !== undefined) {
    const q = road.sampleAtS(road.bridgeS), w = q.half + 4, yel = lam('#f2c400');
    const g = new THREE.Group();
    for (const sd of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(2, 7.5, 2), lam('#8c8c88')); t.position.set(0, 3.75, sd * w); g.add(t); }
    const span = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, w * 2 + 2), yel); span.position.y = 6.6; g.add(span);
    g.position.set(q.x, q.e, q.z); g.rotation.y = -Math.atan2(q.tz, q.tx);
    scene.add(g);
  }
}

// A timber arch over the road with the course name on a board, facing traffic.
function gatewayArch(p, half, name) {
  const g = new THREE.Group(), wood = new THREE.MeshLambertMaterial({ color: '#6b4a2c' });
  for (const side of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.4, 0.35), wood); post.position.set(0, 2.7, side * half); g.add(post); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, half * 2 + 1.2), wood); beam.position.y = 5.3; g.add(beam);
  const c = document.createElement('canvas'); c.width = 256; c.height = 48;
  const x = c.getContext('2d');
  x.fillStyle = '#20314a'; x.fillRect(0, 0, 256, 48); x.strokeStyle = '#e8d9b0'; x.lineWidth = 3; x.strokeRect(3, 3, 250, 42);
  x.fillStyle = '#f4ecd2'; x.font = 'bold 22px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(name.toUpperCase(), 128, 25, 236);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const boardW = Math.min(half * 2 - 0.4, 7);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.12, boardW * 48 / 256 * 1.6, boardW), [0, 1, 2, 3, 4, 5].map((i) => new THREE.MeshLambertMaterial(i === 0 || i === 1 ? { map: tex } : { color: '#20314a' })));
  board.position.y = 4.4; g.add(board);
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
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(p.half * 2, 1.2), new THREE.MeshLambertMaterial({ map: tex }));
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
  const gravel = new THREE.MeshLambertMaterial({ map: gravelTex() });
  const texRep = (t, rx, ry) => { const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; return c; };
  const dw = HOME.driveway, ln = HOME.lane, tn = HOME.tent;
  flat(m(dw.x), m(dw.y), m(dw.w), m(dw.h), gravel);
  flat(m(ln.x), m(ln.y0 - 10), m(ln.w), m(ln.y1 - ln.y0 + 10), gravel, 0.015);
  flat(m(tn.x), m(tn.y), m(tn.w), m(tn.h), gravel);

  // Cabin: log walls, porch, gabled metal roof, stone chimney.
  const cb = HOME.cabin, W = m(cb.w), D = m(cb.h), cx = m(cb.x) + W / 2, cz = m(cb.y) + D / 2;
  box(W, 3.2, D, new THREE.MeshLambertMaterial({ map: texRep(logTex(), 6, 1) }), cx, 1.6, cz);
  const pr = HOME.porch;
  box(m(pr.w), 0.35, m(pr.h) + 0.5, lam('#7a5634'), m(pr.x) + m(pr.w) / 2, 0.18, m(pr.y) + m(pr.h) / 2);
  const pitch = 0.5, half = D / 2 + 0.8, slab = half / Math.cos(pitch);
  const roofMat = new THREE.MeshLambertMaterial({ map: texRep(roofTex(), 5, 2) });
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
  // Semi-transparent (PS1-style) so you can see the car parked under it from above.
  const canvasMat = new THREE.MeshLambertMaterial({ map: canvasTex(), side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
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

// ---------- natural features: ponds, waterfalls, rocks, distant mountains ----------

// Ponds sit on flat ground 15-40 m off a road; waterfalls on the steepest drops 12-45 m off a road.
function findWaterSites(net, terrainAt, { minX, maxX, minZ, maxZ }) {
  const rnd = seeded(31);
  const ponds = [], falls = [];
  // About three ponds and two waterfalls per 2.5 km of road.
  const L = net.roads.reduce((sum, r) => sum + r.length, 0);
  const scale = Math.max(1, Math.round(L / 2500)), NP = 3 * scale, NF = 2 * scale;
  const ok = (t) => t.clearing > 1.4 && t.canyon < 0.1;
  const far = (list, x, z, d) => list.every((p) => Math.hypot(p.x - x, p.z - z) > d);
  for (let tries = 0; tries < 8000 * scale && (ponds.length < NP || falls.length < NF); tries++) {
    const x = minX + rnd() * (maxX - minX), z = minZ + rnd() * (maxZ - minZ);
    if (terrainAt.farDist(x, z) > 40) continue;
    const t = terrainAt(x, z);
    if (!ok(t)) continue;
    if (ponds.length < NP && t.dRoad > 13 && t.dRoad < 28 && far(ponds, x, z, 110)) {
      const r = 6 + rnd() * 5;
      let lo = Infinity, hi = -Infinity;
      for (let a = 0; a < 6.28; a += 0.8) { const h = terrainAt(x + Math.cos(a) * r, z + Math.sin(a) * r).h; lo = Math.min(lo, h); hi = Math.max(hi, h); }
      if (hi - lo < 2.2) { ponds.push({ x, z, r, level: lo + 0.1 }); continue; }
    }
    if (falls.length < NF && t.dRoad > 12 && t.dRoad < 32 && far(falls, x, z, 140) && far(ponds, x, z, 25)) {
      // Look for a big drop within 14 m in any direction.
      let best = null;
      for (let a = 0; a < 6.28; a += 0.4) {
        const bx = x + Math.cos(a) * 14, bz = z + Math.sin(a) * 14, tb = terrainAt(bx, bz);
        const drop = t.h - tb.h;
        if (drop > 4 && tb.dRoad > 9 && (!best || drop > best.drop)) best = { drop, bx, bz, h: tb.h };
      }
      if (best) falls.push({ x, z, top: { x, z, h: t.h }, bot: { x: best.bx, z: best.bz, h: best.h } });
    }
  }
  return { ponds, falls };
}

function nearWater(water, x, z, pad) {
  for (const p of water.ponds) if (Math.hypot(p.x - x, p.z - z) < p.r + pad) return true;
  for (const f of water.falls) {
    const ax = f.top.x, az = f.top.z, bx = f.bot.x, bz = f.bot.z;
    const L2 = (bx - ax) ** 2 + (bz - az) ** 2 || 1;
    const u = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / L2));
    if (Math.hypot(x - (ax + u * (bx - ax)), z - (az + u * (bz - az))) < 3 + pad) return true;
    if (Math.hypot(x - bx, z - bz) < 4.5 + pad) return true;
  }
  return false;
}

function buildWater(scene, water, terrainAt) {
  const pondMat = new THREE.MeshPhongMaterial({ color: '#2f6178', specular: '#bcd8ee', shininess: 90, transparent: true, opacity: 0.9 });
  const disc = (x, z, r, y) => { const g = new THREE.CircleGeometry(r, 18); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, pondMat); m.position.set(x, y, z); scene.add(m); };
  for (const p of water.ponds) disc(p.x, p.z, p.r + 3, p.level);
  const fallTex = waterfallTex();
  fallTex.wrapS = fallTex.wrapT = THREE.RepeatWrapping;
  const fallMat = new THREE.MeshBasicMaterial({ map: fallTex, side: THREE.DoubleSide });
  const foamMat = new THREE.MeshBasicMaterial({ color: '#eef6fb', transparent: true, opacity: 0.75 });
  for (const f of water.falls) {
    // A ribbon of falling water hugging the slope from the lip down into its plunge pool.
    const N = 10, W = 3.2, pos = [], uv = [], idx = [];
    const dx = f.bot.x - f.top.x, dz = f.bot.z - f.top.z, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L;
    let along = 0, prev = null;
    for (let i = 0; i <= N; i++) {
      const u = i / N, x = f.top.x + dx * u, z = f.top.z + dz * u;
      const y = Math.max(terrainAt(x, z).h, f.bot.h) + 0.45;
      if (prev) along += Math.hypot(x - prev.x, y - prev.y, z - prev.z);
      prev = { x, y, z };
      pos.push(x - nx * W / 2, y, z - nz * W / 2, x + nx * W / 2, y, z + nz * W / 2);
      uv.push(0, along / 3, 1, along / 3);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, fallMat));
    disc(f.bot.x, f.bot.z, 5.5, f.bot.h + 0.15);
    const foam = new THREE.Mesh(new THREE.RingGeometry(0.6, 2.4, 14), foamMat);
    foam.rotation.x = -Math.PI / 2; foam.position.set(f.bot.x, f.bot.h + 0.2, f.bot.z); scene.add(foam);
  }
  return { update: (t) => { fallTex.offset.y = (t * 1.6) % 1; } };
}

// Boulders: scattered through the forest (more on steep ground), round the ponds and beside the falls.
// Always outside the drivable area, so you never drive through one.
// Boulders round the ponds, beside the falls and at the foot of the canyon walls (the ones scattered
// through the forest come with each ground tile). Always outside the drivable area.
function buildRocks(scene, terrainAt, water, extra = []) {
  const rnd = seeded(5), rocks = [...extra];
  const add = (x, z, s) => { const t = terrainAt(x, z); if (t.dRoad > t.half + 5.4 && t.clearing > 1.15 && t.canyon < 0.25) rocks.push({ x, z, y: t.h, s }); };
  for (const p of water.ponds) for (let i = 0; i < 10; i++) { const a = rnd() * 6.28, d = p.r + 0.6 + rnd() * 2.5; add(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 0.5 + rnd() * 1.1); }
  for (const f of water.falls) for (let i = 0; i < 14; i++) {
    const u = rnd(), side = rnd() < 0.5 ? -1 : 1;
    const dx = f.bot.x - f.top.x, dz = f.bot.z - f.top.z, L = Math.hypot(dx, dz) || 1;
    add(f.top.x + dx * u - (dz / L) * side * (2.4 + rnd() * 2), f.top.z + dz * u + (dx / L) * side * (2.4 + rnd() * 2), 0.8 + rnd() * 1.8);
  }
  addRocks(scene, rocks, rnd);
}

// Rock walls either side of the road wherever it runs through a canyon (sample.canyon > 0). Each wall
// follows canyonProfile out to the rim; where the canyon fades in or out it blends into the ground.
// Returns boulders for the foot of the walls.
function buildCanyonWalls(scene, road, terrainAt) {
  const S = road.samples, out = [];
  if (!S.some((p) => p.canyon > 0.15)) return out;
  const US = [WALL_U0 - 0.4, 3, 4.2, 5.6, 7.2, 9, 11, 13.5, 16, 19, 24, 30];
  const rnd = seeded(61), mat = new THREE.MeshLambertMaterial({ map: rockTex(), vertexColors: true, side: THREE.DoubleSide });
  const jag = (x, z) => Math.sin(x * 0.31 + z * 0.17) * Math.cos(z * 0.27 - x * 0.11) * 1.6 + Math.sin(x * 0.9 - z * 0.7) * 0.5;
  for (const side of [-1, 1]) {
    const pos = [], uv = [], col = [], idx = [];
    let rows = 0, prevOk = false;
    for (let i = 0; i < S.length; i += 2) {
      const p = S[i], c = Math.min(1, p.canyon * 1.15);
      if (c < 0.15) { prevOk = false; continue; }
      US.forEach((u, k) => {
        const off = side * (p.half + u), x = p.x + p.nx * off, z = p.z + p.nz * off;
        const j = u > 3.5 && u < 26 ? jag(x, z) * Math.min(1, (u - 3.5) / 3) : 0;
        const wall = p.e + canyonProfile(u) + j;
        const y = Math.max(terrainAt(x, z).h + 0.1, terrainAt(x, z).h + (wall - terrainAt(x, z).h) * c);
        pos.push(x + p.nx * side * j * 0.4, y, z + p.nz * side * j * 0.4);
        uv.push(u / 4, p.s / 4);
        // Darker at the foot, with warm and cool bands of strata up the face.
        const shade = 0.78 + 0.4 * Math.min(1, u / WALL_U1) + j * 0.05, band = Math.sin((y - p.e) * 0.55 + x * 0.01) * 0.07;
        col.push(shade * (1.04 + band), shade * (0.98 + band * 0.5), shade * (0.9 - band * 0.3));
      });
      if (prevOk) for (let k = 0; k < US.length - 1; k++) { const a = (rows - 1) * US.length + k, b = rows * US.length + k; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      rows++; prevOk = true;
      // Fallen boulders at the foot of the wall.
      if (c > 0.6 && rnd() < 0.12) {
        const u = 3.6 + rnd() * 2.5, off = side * (p.half + u);
        out.push({ x: p.x + p.nx * off, z: p.z + p.nz * off, y: p.e + canyonProfile(u) * 0.5, s: 0.7 + rnd() * 1.4 });
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, mat));
  }
  return out;
}

// A hazy ring of snow-capped mountains on the horizon. It follows the camera (like the sky), so it
// always sits in the far distance.
function buildMountains(scene) {
  const rnd = seeded(77), group = new THREE.Group();
  const haze = new THREE.Color('#a9c3de'), rock = new THREE.Color('#5d6b7c'), snow = new THREE.Color('#f2f6fa');
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false });
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + rnd() * 0.15, h = 170 + rnd() * 110, rad = 110 + rnd() * 100;
    const g = new THREE.ConeGeometry(rad, h, 6 + Math.floor(rnd() * 3), 3).toNonIndexed();
    const pos = g.attributes.position, col = [];
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k) / h + 0.5; // 0 base .. 1 peak
      const c = (y > 0.72 ? snow.clone() : rock.clone().lerp(haze, 0.35 + (1 - y) * 0.4));
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.position.set(Math.cos(a) * (580 + rnd() * 60), -150 + h / 2, Math.sin(a) * (580 + rnd() * 60));
    m.rotation.y = rnd() * 6.28;
    group.add(m);
  }
  scene.add(group);
  return group;
}
