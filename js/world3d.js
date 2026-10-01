// 3D worlds for driving, one per road network (the cabin loop, each race course): terrain shaped
// around the roads, road surfaces, barriers, forest, and (at home) the cabin/tent/driveway.
// Each world is built the first time it's needed and then reused.
import * as THREE from '../lib/three.module.min.js';
import { ROAD_HALF, U, apexesOf } from './road.js';
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
    const far = es / ws + noise(x, z) * smooth(8, 40, dc) + 0.22 * Math.max(0, dc - 18) + hills(x, z) * smooth(20, 90, dc);
    let h = nd < Infinity && dn < 30 ? ne + (far - ne) * smooth(ROAD_HALF + 1.2, ROAD_HALF + 16, dn) - 0.3 * (1 - smooth(ROAD_HALF, ROAD_HALF + 3, dn)) : far;
    let r = 9;
    if (CL) {
      r = Math.hypot((x - CL.x) / CL.rx, (z - CL.z) / CL.rz);
      h = -0.05 + (h + 0.05) * smooth(1.0, 1.5, r);
    }
    return { h, dRoad: dn, clearing: r };
  };
}

// ---------- geometry helpers ----------
function ribbon(samples, offsetA, offsetB, yA, yB, { every = 1, withUV = false, closed = false, length = 0, uAcross = 1, vPer = 8 } = {}) {
  const pos = [], uv = [], idx = [];
  const pts = samples.filter((_, i) => i % every === 0 || i === samples.length - 1);
  if (closed) pts.push({ ...pts[0], s: length });
  pts.forEach((p, i) => {
    pos.push(p.x + p.nx * offsetA, p.e + yA, p.z + p.nz * offsetA);
    pos.push(p.x + p.nx * offsetB, p.e + yB, p.z + p.nz * offsetB);
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
const worlds = new Map();
// How far the dirt cut-through on the inside of each apex reaches past the road edge (m).
export const APEX_CUT = 4.2;
// Real trees are planted out to this far from any road (m); beyond it the ground is shaded as canopy.
const TREE_REACH = 48;

export function getWorld(net) {
  if (!worlds.has(net.id)) worlds.set(net.id, buildWorld(net));
  return worlds.get(net.id);
}

function buildWorld(net) {
  const S = net.road.samples;
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

  // Terrain grid covering the roads plus a margin.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of [...S, ...net.branches.flatMap((b) => b.samples)]) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  minX -= 130; maxX += 130; minZ -= 130; maxZ += 130;
  // The ground itself reaches much further (fading into the fog) so you never see its edge.
  const GROUND = 340, gMinX = minX - GROUND, gMaxX = maxX + GROUND, gMinZ = minZ - GROUND, gMaxZ = maxZ + GROUND;
  const water = findWaterSites(net, baseTerrain, { minX, maxX, minZ, maxZ });
  carves = [...water.ponds.map((p) => ({ ...p, depth: 1.4 })), ...water.falls.map((f) => ({ x: f.bot.x, z: f.bot.z, r: 4.5, level: f.bot.h + 0.15, depth: 1.0 }))];
  const STEPT = 6;
  const nx = Math.ceil((gMaxX - gMinX) / STEPT) + 1, nz = Math.ceil((gMaxZ - gMinZ) / STEPT) + 1;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), tuv = new Float32Array(nx * nz * 2);
  const info = [];
  const rnd = seeded(11);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = gMinX + i * STEPT, z = gMinZ + j * STEPT;
    const t = terrainAt(x, z);
    const k = (j * nx + i) * 3;
    pos[k] = x; pos[k + 1] = t.h; pos[k + 2] = z;
    tuv[(j * nx + i) * 2] = x / 7; tuv[(j * nx + i) * 2 + 1] = z / 7;
    // Gentle light/dark variation across the ground; shaded forest floor under the trees. Far from the
    // roads (where no trees are planted, see TREE_REACH) it fades to dark canopy green, so the forest
    // still looks unbroken into the distance.
    const v = (0.82 + rnd() * 0.22) * (t.clearing < 1.05 ? 1.08 : 0.72);
    const far = t.clearing < 1.05 ? 0 : Math.min(1, Math.max(0, (t.dRoad - (TREE_REACH - 12)) / 12));
    col[k] = v * (1 - far * 0.55); col[k + 1] = v * (1 - far * 0.25); col[k + 2] = v * (1 - far * 0.6);
    info.push(t);
  }
  // Each triangle is grass, rock (steep cuts and banks) or dirt (road shoulders): hard edges, PS1 style.
  const groups = [[], [], []];
  const kind = (a, b, c) => {
    const ta = info[a], tb = info[b], tc = info[c];
    if (Math.max(ta.dRoad, tb.dRoad, tc.dRoad) < ROAD_HALF + 3.2) return 2;
    const hs = [pos[a * 3 + 1], pos[b * 3 + 1], pos[c * 3 + 1]];
    return Math.max(...hs) - Math.min(...hs) > STEPT * 1.15 ? 1 : 0;
  };
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    groups[kind(a, c, b)].push(a, c, b);
    groups[kind(b, c, d)].push(b, c, d);
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tg.setAttribute('uv', new THREE.BufferAttribute(tuv, 2));
  tg.setIndex([...groups[0], ...groups[1], ...groups[2]]);
  tg.addGroup(0, groups[0].length, 0);
  tg.addGroup(groups[0].length, groups[1].length, 1);
  tg.addGroup(groups[0].length + groups[1].length, groups[2].length, 2);
  tg.computeVertexNormals();
  scene.add(new THREE.Mesh(tg, [grassTex(), rockTex(), shoulderTex()].map((map) => new THREE.MeshLambertMaterial({ map, vertexColors: true }))));

  // Road and shoulder. No guardrails: run wide and you're in the dirt, then the trees.
  const closed = net.road.loop, length = net.road.length;
  scene.add(new THREE.Mesh(ribbon(S, -ROAD_HALF - 1.1, ROAD_HALF + 1.1, -0.02, -0.02, { every: 2, closed, length, withUV: true, uAcross: 3, vPer: 3 }), new THREE.MeshLambertMaterial({ map: shoulderTex() })));
  scene.add(new THREE.Mesh(ribbon(S, -ROAD_HALF, ROAD_HALF, 0.03, 0.03, { withUV: true, closed, length, vPer: 10 }), new THREE.MeshLambertMaterial({ map: roadTex() })));

  // Dirt cut-throughs on the inside of every apex: packed dirt you can clip to cut the corner.
  // Widest (APEX_CUT m) at the apex, tapering to nothing 14 m either side.
  const apexCuts = apexesOf(net.road).map((a) => {
    const pos = [], uv = [], idx = [], COLS = 7;
    let n = 0;
    for (let ds = -14; ds <= 14; ds += 1) {
      const q = net.road.sampleAtS(a.s + ds), w = APEX_CUT * (1 - (ds / 14) ** 2);
      for (let c = 0; c < COLS; c++) {
        const off = ROAD_HALF - 0.05 + (0.1 + w) * (c / (COLS - 1));
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
    const q = net.road.sampleAtS(a.s), off = (ROAD_HALF + APEX_CUT / 2) * a.inside;
    return { x: q.x + q.nx * off, z: q.z + q.nz * off };
  });

  // Side roads: narrower gravel with a "Road closed" barrier at the end.
  const branchMat = new THREE.MeshLambertMaterial({ map: gravelTex() });
  for (const b of net.branches) {
    scene.add(new THREE.Mesh(ribbon(b.samples.slice(3), -b.half, b.half, 0.0, 0.0, { withUV: true, uAcross: 2, vPer: 3 }), branchMat));
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
  // Trees near the road are shorter, so the chase camera can see over them into the next corner.
  const trees = [];
  const trnd = seeded(99);
  const TS = 3.6; // dense: the canopy closes over almost all the ground
  for (let z = minZ; z < maxZ; z += TS) for (let x = minX; x < maxX; x += TS) {
    const tx = x + (trnd() - 0.5) * TS * 0.9, tz = z + (trnd() - 0.5) * TS * 0.9;
    const t = terrainAt(tx, tz);
    if (t.dRoad < ROAD_HALF + 2.8 + trnd() * 1.2 || t.dRoad > TREE_REACH || t.clearing < 1.12) continue;
    if (apexCuts.some((c) => (c.x - tx) ** 2 + (c.z - tz) ** 2 < 64)) continue; // keep the apex cut-throughs clear
    if (nearWater(water, tx, tz, 10)) continue; // and an open glade round the ponds and waterfalls
    trees.push({ x: tx, z: tz, y: t.h, hgt: Math.min(9 + trnd() * 10, 2.5 + (t.dRoad - ROAD_HALF) * 0.55), r: 2.4 + trnd() * 1.4, shade: 0.75 + trnd() * 0.4 });
  }
  // Crossed-quad sprite trees, the classic late-90s way.
  const quad = (rot) => { const p = new THREE.PlaneGeometry(1, 1); p.translate(0, 0.5, 0); p.rotateY(rot); return p; };
  const crossGeo = mergeGeos([quad(0), quad(Math.PI / 2)]);
  const treeMeshes = [0, 1].map((v) => new THREE.InstancedMesh(crossGeo, new THREE.MeshLambertMaterial({ map: treeTex(v), alphaTest: 0.5, side: THREE.DoubleSide }), trees.length));
  const counts = [0, 0];
  const color = new THREE.Color(), mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  trees.forEach((t, i) => {
    const v = i % 2;
    q.setFromAxisAngle(up, (i * 1.3) % Math.PI);
    mtx.compose(new THREE.Vector3(t.x, t.y - 0.3, t.z), q, new THREE.Vector3(t.r * 2.4, t.hgt, t.r * 2.4));
    treeMeshes[v].setMatrixAt(counts[v], mtx);
    color.setScalar(t.shade);
    treeMeshes[v].setColorAt(counts[v]++, color);
  });
  treeMeshes.forEach((tm, v) => { tm.count = counts[v]; scene.add(tm); });
  // A flat crown on top of each tree for overhead views.
  const topGeo = new THREE.PlaneGeometry(1, 1); topGeo.rotateX(-Math.PI / 2);
  const tops = new THREE.InstancedMesh(topGeo, new THREE.MeshLambertMaterial({ map: treeTopTex(), alphaTest: 0.5 }), trees.length);
  trees.forEach((t, i) => {
    q.setFromAxisAngle(up, i * 0.7);
    mtx.compose(new THREE.Vector3(t.x, t.y + t.hgt * 0.62, t.z), q, new THREE.Vector3(t.r * 2.6, 1, t.r * 2.6));
    tops.setMatrixAt(i, mtx);
    color.setScalar(t.shade);
    tops.setColorAt(i, color);
  });
  scene.add(tops);

  const waterFx = buildWater(scene, water, terrainAt);
  buildRocks(scene, terrainAt, water, apexCuts, { minX, maxX, minZ, maxZ });
  const mountains = buildMountains(scene);


  const fire = net.home ? buildHome(scene) : null;
  const skids = makeSkids(scene);
  return {
    scene, fire, skids, terrainAt,
    setNight: (on) => { setNight(lights, on); skyMat.color.set(on ? '#1b2440' : '#ffffff'); },
    // Keep the sky panorama centered on the camera.
    follow: (cam) => {
      skyMesh.position.set(cam.position.x, cam.position.y + 40, cam.position.z);
      mountains.position.set(cam.position.x, cam.position.y, cam.position.z);
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
  const rnd = seeded(net.id === 'home' ? 31 : net.id.length * 17 + 3);
  const ponds = [], falls = [];
  const ok = (t) => t.clearing > 1.4;
  const far = (list, x, z, d) => list.every((p) => Math.hypot(p.x - x, p.z - z) > d);
  for (let tries = 0; tries < 6000 && (ponds.length < 3 || falls.length < 2); tries++) {
    const x = minX + rnd() * (maxX - minX), z = minZ + rnd() * (maxZ - minZ);
    const t = terrainAt(x, z);
    if (!ok(t)) continue;
    if (ponds.length < 3 && t.dRoad > 13 && t.dRoad < 28 && far(ponds, x, z, 110)) {
      const r = 6 + rnd() * 5;
      let lo = Infinity, hi = -Infinity;
      for (let a = 0; a < 6.28; a += 0.8) { const h = terrainAt(x + Math.cos(a) * r, z + Math.sin(a) * r).h; lo = Math.min(lo, h); hi = Math.max(hi, h); }
      if (hi - lo < 2.2) { ponds.push({ x, z, r, level: lo + 0.1 }); continue; }
    }
    if (falls.length < 2 && t.dRoad > 12 && t.dRoad < 32 && far(falls, x, z, 140) && far(ponds, x, z, 25)) {
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
function buildRocks(scene, terrainAt, water, apexCuts, { minX, maxX, minZ, maxZ }) {
  const rnd = seeded(5), rocks = [];
  const add = (x, z, s) => { const t = terrainAt(x, z); if (t.dRoad > ROAD_HALF + 5.4 && t.clearing > 1.15) rocks.push({ x, z, y: t.h, s }); };
  for (let z = minZ; z < maxZ; z += 10) for (let x = minX; x < maxX; x += 10) {
    const rx = x + (rnd() - 0.5) * 9, rz = z + (rnd() - 0.5) * 9;
    const t = terrainAt(rx, rz);
    if (t.dRoad > TREE_REACH + 40) continue;
    const slope = Math.abs(terrainAt(rx + 3, rz).h - terrainAt(rx - 3, rz).h) + Math.abs(terrainAt(rx, rz + 3).h - terrainAt(rx, rz - 3).h);
    if (rnd() < 0.05 + Math.min(0.5, slope * 0.08)) add(rx, rz, 0.5 + rnd() * (slope > 3 ? 2.6 : 1.4));
  }
  for (const p of water.ponds) for (let i = 0; i < 10; i++) { const a = rnd() * 6.28, d = p.r + 0.6 + rnd() * 2.5; add(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 0.5 + rnd() * 1.1); }
  for (const f of water.falls) for (let i = 0; i < 14; i++) {
    const u = rnd(), side = rnd() < 0.5 ? -1 : 1;
    const dx = f.bot.x - f.top.x, dz = f.bot.z - f.top.z, L = Math.hypot(dx, dz) || 1;
    add(f.top.x + dx * u - (dz / L) * side * (2.4 + rnd() * 2), f.top.z + dz * u + (dx / L) * side * (2.4 + rnd() * 2), 0.8 + rnd() * 1.8);
  }
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ map: rockTex(), flatShading: true }), Math.max(1, rocks.length));
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), color = new THREE.Color();
  rocks.forEach((r, i) => {
    q.setFromEuler(e.set(rnd() * 0.5, rnd() * 6.28, rnd() * 0.5));
    mtx.compose(new THREE.Vector3(r.x, r.y + r.s * 0.15, r.z), q, new THREE.Vector3(r.s * (0.8 + rnd() * 0.5), r.s * (0.5 + rnd() * 0.4), r.s * (0.8 + rnd() * 0.5)));
    mesh.setMatrixAt(i, mtx);
    color.setScalar(0.75 + rnd() * 0.35);
    mesh.setColorAt(i, color);
  });
  mesh.count = rocks.length;
  scene.add(mesh);
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
