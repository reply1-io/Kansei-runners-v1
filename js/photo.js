// Marketplace photos: each listing's car parked in the seller's driveway, PS1-rendered once and cached.
// Every seller gets their own house (siding colour, door, bushes), and rough cars look dirtier.
import * as THREE from '../lib/three.module.min.js';
import { createRetro } from './ps1.js';
import { makeCarMesh } from './carmodel.js';
import { seeded } from './draw.js';
import { grassTex, gravelTex } from './textures.js';

const cache = new Map(); // key -> data URL
let retro = null, canvas = null, queue = Promise.resolve();

const SIDING = ['#e8e0cf', '#c9d6df', '#d9c7a3', '#b8c4a8', '#f0ece2', '#a7b6c2', '#c98f6b', '#8e9aa6'];
const DOORS = ['#f4f4f0', '#e3dccb', '#7a5a3a', '#4b5866'];

function setup() {
  canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:-10000px;top:0;width:360px;height:225px;pointer-events:none';
  document.body.appendChild(canvas);
  retro = createRetro(canvas, { lines: 210, minPx: 1 });
}

// A car photo for a listing: resolves to a JPEG data URL. `key` picks the seller's house.
export function carPhoto(car, key) {
  const id = `${key}:${car.color}:${car.wheelColor || ''}`;
  if (cache.has(id)) return Promise.resolve(cache.get(id));
  queue = queue.then(() => {
    if (cache.has(id)) return cache.get(id);
    if (!retro) setup();
    const url = shoot(car, key);
    cache.set(id, url);
    return url;
  });
  return queue;
}

function shoot(car, key) {
  let h = 0;
  for (const c of String(key)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = seeded(h || 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a9cbe9');
  scene.add(new THREE.HemisphereLight('#eef4ff', '#5a6b3a', 1.0));
  const sun = new THREE.DirectionalLight('#fff3dc', 1.5); sun.position.set(6, 9, 4); scene.add(sun);
  const disposables = [];
  const mesh = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); scene.add(m); disposables.push(geo, mat); return m; };

  // Lawn, concrete driveway running from the street up to the garage.
  const grass = grassTex();
  mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({ map: grass, color: '#9fbf74' }), 0, 0, 0).rotation.x = -Math.PI / 2;
  mesh(new THREE.PlaneGeometry(4.6, 14), new THREE.MeshLambertMaterial({ map: gravelTex(), color: '#d6d3ca', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 0, 0.08, 1.5).rotation.x = -Math.PI / 2;
  // House with a garage door at the top of the driveway.
  const siding = SIDING[Math.floor(rnd() * SIDING.length)];
  mesh(new THREE.BoxGeometry(14, 3.2, 6), new THREE.MeshLambertMaterial({ color: siding }), 2.5, 1.6, -8.5);
  const roof = mesh(new THREE.BoxGeometry(14.6, 0.4, 7.2), new THREE.MeshLambertMaterial({ color: rnd() < 0.5 ? '#4a3a32' : '#3b4048' }), 2.5, 3.6, -8.5);
  roof.rotation.x = 0.12;
  mesh(new THREE.BoxGeometry(3.4, 2.3, 0.1), new THREE.MeshLambertMaterial({ color: DOORS[Math.floor(rnd() * DOORS.length)] }), 0, 1.15, -5.45);
  for (let i = 1; i < 4; i++) mesh(new THREE.BoxGeometry(3.4, 0.04, 0.12), new THREE.MeshLambertMaterial({ color: '#8a8a86' }), 0, i * 0.58, -5.43);
  for (const wx of [4.5, 7.5]) mesh(new THREE.BoxGeometry(1.4, 1.1, 0.08), new THREE.MeshLambertMaterial({ color: '#2b3d55' }), wx, 1.8, -5.45);
  // A few bushes along the house.
  const bush = new THREE.MeshLambertMaterial({ color: '#3f6b2e' });
  for (let i = 0; i < 4; i++) mesh(new THREE.IcosahedronGeometry(0.5 + rnd() * 0.35, 0), bush, -3 - rnd() * 2.5 + (i % 2) * 7.5, 0.4, -4.8 + rnd() * 0.6);

  // The car, a little grubby if it's been neglected.
  const grime = Math.max(0, 1 - (car.cond?.body ?? 100) / 100) * 0.4;
  const color = new THREE.Color(car.color).lerp(new THREE.Color('#6b5a45'), grime);
  const model = makeCarMesh(`#${color.getHexString()}`, car.modelId, { wheels: car.wheelColor });
  model.group.rotation.y = -Math.PI / 2 + 0.2; // nose down the driveway towards the street (and the camera)
  model.group.position.set(0, 0, -0.5);
  scene.add(model.group);

  const cam = new THREE.PerspectiveCamera(38, 1.6, 0.5, 120);
  const side = rnd() < 0.5 ? -1 : 1;
  cam.position.set(side * 4.6, 1.9, 6.2);
  cam.lookAt(0, 0.6, -0.8);
  retro.render(scene, cam);
  const url = canvas.toDataURL('image/jpeg', 0.85);
  for (const d of disposables) d.dispose?.();
  return url;
}
