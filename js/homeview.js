// The home screen: your cabin in the woods seen from above in 3D (same PS1-style renderer as driving),
// with your cars parked out front, traffic on the mountain road, and Select buttons next to each car.
import * as THREE from '../lib/three.module.min.js';
import { getRetro } from './ps1.js';
import { getWorld, makeCarMesh } from './world3d.js';
import { HOME_NET, ROAD, U } from './road.js';
import { HOME, PARKING, PARK_HEADING, parkingAssignments } from './map.js';

const TRAFFIC_COLORS = ['#c8ccd2', '#8c1c13', '#1d3557', '#e9c46a', '#2a9d8f', '#222222'];
const TRAFFIC_MODELS = ['volvo242', 'mb190e', 'e30', 'supra', 's180sx', 'r32', 'civic'];

export function createHomeView({ canvas, overlay, getCars, getActiveId, onTap, onSelect, buttonsEl }) {
  const retro = getRetro(canvas);
  const world = getWorld(HOME_NET);
  const scene = world.scene;
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 900);
  const f = HOME.focus;
  const center = new THREE.Vector3((f.x + f.w / 2) * U, 0, (f.y + f.h / 2) * U);
  let running = false, raf = 0, last = 0, time = 0;

  // Camera: high above the cabin, tilted a little so you see the fronts of things (north is up).
  function placeCamera() {
    retro.resize();
    camera.aspect = retro.aspect;
    const tanH = Math.tan((camera.fov * Math.PI) / 360);
    const needH = (f.h * U) / 2, needW = (f.w * U) / 2;
    const d = Math.max(needH / tanH, needW / (tanH * camera.aspect)) * 1.02;
    const tilt = 0.22; // radians off vertical
    camera.position.set(center.x, center.y + d * Math.cos(tilt), center.z + d * Math.sin(tilt));
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }

  // Parked cars (rebuilt when your cars change).
  let parked = [], parkedKey = '';
  function syncParked() {
    const spots = parkingAssignments(getCars(), getActiveId());
    const key = spots.map((x) => (x.car ? `${x.car.id}:${x.car.color}` : '-')).join('|');
    if (key === parkedKey) return spots;
    parkedKey = key;
    for (const p of parked) scene.remove(p);
    parked = spots.filter((x) => x.car).map(({ spot, car }) => {
      const m = makeCarMesh(car.color, car.modelId);
      m.group.position.set(spot.x * U, 0, spot.y * U);
      m.group.rotation.set(0, -PARK_HEADING, 0);
      scene.add(m.group);
      return m.group;
    });
    return spots;
  }

  // Occasional traffic on the road out front.
  const traffic = [];
  let trafficT = 1;
  function updateTraffic(dt) {
    trafficT -= dt;
    if (trafficT <= 0 && traffic.length < 3) {
      trafficT = 4 + Math.random() * 7;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const m = makeCarMesh(TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)], TRAFFIC_MODELS[Math.floor(Math.random() * TRAFFIC_MODELS.length)]);
      scene.add(m.group);
      traffic.push({ s: ROAD.homeS - dir * 260, dir, v: 14 + Math.random() * 8, mesh: m.group });
    }
    for (let i = traffic.length - 1; i >= 0; i--) {
      const t = traffic[i];
      t.s += t.v * t.dir * dt;
      if (Math.abs(ROAD.wrapDelta(t.s - ROAD.homeS)) > 280) { scene.remove(t.mesh); traffic.splice(i, 1); continue; }
      const p = ROAD.sampleAtS(t.s);
      const lane = 2.1 * t.dir;
      t.mesh.position.set(p.x + p.nx * lane, p.e, p.z + p.nz * lane);
      t.mesh.rotation.set(0, -(Math.atan2(p.tz, p.tx) + (t.dir < 0 ? Math.PI : 0)), 0);
    }
  }

  const toScreen = (x, y, z) => {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return { x: ((v.x + 1) / 2) * canvas.clientWidth, y: ((1 - v.y) / 2) * canvas.clientHeight };
  };

  // Select buttons next to each parked car.
  let btnKey = '';
  function syncButtons(spots) {
    if (!buttonsEl) return;
    const withCars = spots.filter((x) => x.car);
    const key = withCars.map((x) => x.car.id).join() + `|${canvas.clientWidth}x${canvas.clientHeight}`;
    if (key === btnKey) return;
    btnKey = key;
    buttonsEl.innerHTML = withCars.map(({ spot, car }) => {
      const p = toScreen((spot.x + spot.btn.dx) * U, 0.5, (spot.y + spot.btn.dy) * U);
      return `<button class="select-btn" data-select="${car.id}" style="left:${p.x}px;top:${p.y}px">Select</button>`;
    }).join('');
  }
  buttonsEl?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-select]');
    if (b) { e.stopPropagation(); onSelect?.(b.dataset.select); }
  });

  // Taps on the scene: a parked car, an empty spot, or the cabin.
  overlay.addEventListener('click', (e) => {
    if (!running || e.target.closest('button')) return;
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    for (const { spot, car, index } of parkingAssignments(getCars(), getActiveId())) {
      const p = toScreen(spot.x * U, 0.6, spot.y * U);
      if (Math.hypot(p.x - x, p.y - y) < 34) { onTap(car ? { type: 'car', carId: car.id, index } : { type: 'spot', index }); return; }
    }
    const cb = HOME.cabin;
    const a = toScreen(cb.x * U, 3, cb.y * U), b = toScreen((cb.x + cb.w) * U, 3, (cb.y + cb.h + 40) * U);
    if (x > Math.min(a.x, b.x) && x < Math.max(a.x, b.x) && y > Math.min(a.y, b.y) && y < Math.max(a.y, b.y)) onTap({ type: 'cabin' });
  });

  function loop(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now; time += dt;
    world.setNight(false);
    placeCamera();
    // The home camera sits much higher than the driving camera: push the haze out accordingly.
    const dist = camera.position.distanceTo(center);
    scene.fog.near = dist * 1.4; scene.fog.far = dist * 4;
    const spots = syncParked();
    updateTraffic(dt);
    if (world.fire) world.fire.light.intensity = 26 + Math.sin(time * 13) * 6 + Math.sin(time * 7.7) * 4;
    world.follow(camera);
    retro.render(scene, camera);
    syncButtons(spots);
    if (running) raf = requestAnimationFrame(loop);
  }

  return {
    start() { if (running) return; running = true; last = 0; parkedKey = ''; btnKey = ''; for (const p of parked) scene.add(p); raf = requestAnimationFrame(loop); },
    // While driving, the parked cars and traffic come out of the shared scene (driving places its own).
    stop() {
      running = false; cancelAnimationFrame(raf);
      for (const p of parked) scene.remove(p);
      for (const t of traffic) scene.remove(t.mesh);
      traffic.length = 0;
      if (buttonsEl) buttonsEl.innerHTML = '';
      btnKey = '';
    },
    toScreen,
  };
}
