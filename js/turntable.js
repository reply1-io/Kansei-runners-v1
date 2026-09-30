// GT-style garage turntable: your car slowly spinning on a lit platform, PS1-rendered.
import * as THREE from '../lib/three.module.min.js';
import { createRetro } from './ps1.js';
import { makeCarMesh } from './carmodel.js';

let active = null;

export function mountTurntable(canvas, car) {
  if (active && active.canvas === canvas && active.key === `${car.id}:${car.color}`) return;
  unmountTurntable();
  const retro = createRetro(canvas, { lines: 200 });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a1638');
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#1a2244', 0.8));
  const key = new THREE.DirectionalLight('#ffffff', 1.6); key.position.set(4, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight('#7ec3ff', 0.9); rim.position.set(-5, 3, -4); scene.add(rim);
  // Platform: a dark disc with a bright ring, like a showroom turntable.
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.5, 0.18, 24), new THREE.MeshLambertMaterial({ color: '#1b2a57' }));
  disc.position.y = -0.09; scene.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.05, 4, 32), new THREE.MeshBasicMaterial({ color: '#ffd200' }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; scene.add(ring);
  const model = makeCarMesh(car.color, car.modelId);
  scene.add(model.group);
  const camera = new THREE.PerspectiveCamera(26, 2, 0.5, 100);
  let raf = 0, t = 0, last = performance.now();
  const loop = (now) => {
    if (!canvas.isConnected) { unmountTurntable(); return; }
    t += Math.min(0.05, (now - last) / 1000); last = now;
    retro.resize();
    camera.aspect = retro.aspect; camera.updateProjectionMatrix();
    camera.position.set(Math.cos(t * 0.5) * 9.5, 2.1, Math.sin(t * 0.5) * 9.5);
    camera.lookAt(0, 0.55, 0);
    retro.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  active = { canvas, key: `${car.id}:${car.color}`, stop: () => { cancelAnimationFrame(raf); retro.dispose(); } };
}

export function unmountTurntable() {
  if (active) { active.stop(); active = null; }
}
