// Low-poly car models in the spirit of late-90s racing games: an extruded side profile with wheel
// arches, a glass greenhouse with a painted roof, textured lights/grille/rims and glossy paint.
// Forward is +x, up is +y. Each car model picks a body style (see MODELS in data.js).
import * as THREE from '../lib/three.module.min.js';
import { MODELS } from './data.js';
import { envCube, headlightTex, taillightTex, grilleTex, rimTex } from './textures.js';

// L length, W width, belt beltline height, nose/tail heights, hood/trunk lengths, roof height,
// windshield/rear-window rake, wb wheelbase. wing: 0 none, 1 lip, 2 tall.
const BODIES = {
  sedan:    { L: 4.6, W: 1.72, belt: 0.93, nose: 0.66, tail: 0.9, hood: 1.15, trunk: 0.95, roof: 1.42, ws: 0.6, rw: 0.5, wb: 2.62 },
  coupe:    { L: 4.45, W: 1.72, belt: 0.88, nose: 0.58, tail: 0.84, hood: 1.4, trunk: 0.8, roof: 1.3, ws: 0.78, rw: 0.85, wb: 2.52 },
  fastback: { L: 4.3, W: 1.7, belt: 0.86, nose: 0.55, tail: 0.82, hood: 1.45, trunk: 0.35, roof: 1.27, ws: 0.8, rw: 1.15, wb: 2.43 },
  hatch:    { L: 4.05, W: 1.68, belt: 0.92, nose: 0.62, tail: 0.95, hood: 1.02, trunk: 0.08, roof: 1.38, ws: 0.62, rw: 0.28, wb: 2.45 },
  roadster: { L: 3.95, W: 1.68, belt: 0.86, nose: 0.55, tail: 0.84, hood: 1.35, trunk: 0.85, roof: 0, ws: 0.35, rw: 0, wb: 2.27 },
  rally:    { L: 4.4, W: 1.74, belt: 0.95, nose: 0.66, tail: 0.92, hood: 1.15, trunk: 0.8, roof: 1.45, ws: 0.62, rw: 0.55, wb: 2.52, scoop: true },
  gt:       { L: 4.52, W: 1.81, belt: 0.86, nose: 0.55, tail: 0.86, hood: 1.5, trunk: 0.75, roof: 1.28, ws: 0.85, rw: 0.95, wb: 2.55 },
};

const WHEEL_R = 0.31, ARCH_R = 0.38, SILL = 0.3;

function sideProfile(b) {
  const xF = b.L / 2, xR = -b.L / 2, wf = b.wb / 2, wr = -b.wb / 2;
  const pts = [[xR + 0.12, SILL]];
  const arch = (xc) => {
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI - (i / 6) * Math.PI;
      pts.push([xc + Math.cos(a) * ARCH_R, SILL + Math.sin(a) * ARCH_R * 0.9]);
    }
  };
  arch(wr);
  arch(wf);
  pts.push([xF - 0.14, SILL], [xF, 0.42], [xF - 0.04, b.nose]);
  const wsBase = xF - b.hood, rwBase = xR + Math.max(b.trunk, 0.12);
  pts.push([wsBase, b.belt], [rwBase, b.belt], [xR + 0.06, b.tail], [xR, 0.46]);
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return { shape: s, wsBase, rwBase };
}

function extrude(shape, width, bevel = 0.05) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.computeVertexNormals();
  return g;
}

const detailMats = {};
function dm(key, make) { return detailMats[key] || (detailMats[key] = make()); }

export function makeCarMesh(color, modelId) {
  const model = MODELS.find((mm) => mm.id === modelId);
  const style = model?.body || 'coupe';
  const b = BODIES[style] || BODIES.coupe;
  const wing = model?.wing || 0;
  const g = new THREE.Group();
  const env = envCube();
  const paint = new THREE.MeshPhongMaterial({ color, shininess: 60, specular: '#3a3a3a', envMap: env, reflectivity: 0.12, combine: THREE.MixOperation });
  const glass = dm('glass', () => new THREE.MeshPhongMaterial({ color: '#0a111c', shininess: 100, specular: '#6f82a0', envMap: env, reflectivity: 0.22, combine: THREE.MixOperation }));
  const trim = dm('trim', () => new THREE.MeshLambertMaterial({ color: '#141414' }));
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };

  // Body shell with wheel arches.
  const { shape, wsBase, rwBase } = sideProfile(b);
  add(extrude(shape, b.W), paint);
  // Black bumpers front and rear, and a dark sill band, for that high-contrast late-90s look.
  const bumper = dm('bumper', () => new THREE.MeshLambertMaterial({ color: '#202226' }));
  add(new THREE.BoxGeometry(0.2, 0.2, b.W + 0.02), bumper, b.L / 2 - 0.06, 0.4, 0);
  add(new THREE.BoxGeometry(0.2, 0.2, b.W + 0.02), bumper, -b.L / 2 + 0.06, 0.42, 0);
  add(new THREE.BoxGeometry(b.L - 1.9, 0.1, b.W + 0.02), bumper, 0, SILL + 0.04, 0);

  // Greenhouse: glass with a painted roof panel.
  if (b.roof) {
    const roofF = wsBase - b.ws, roofR = rwBase + b.rw;
    const cab = new THREE.Shape();
    cab.moveTo(wsBase, b.belt - 0.02); cab.lineTo(roofF, b.roof); cab.lineTo(roofR, b.roof); cab.lineTo(rwBase, b.belt - 0.02); cab.closePath();
    add(extrude(cab, b.W - 0.26, 0.04), glass);
    add(new THREE.BoxGeometry(Math.max(0.3, roofF - roofR - 0.12), 0.05, b.W - 0.34), paint, (roofF + roofR) / 2, b.roof + 0.02, 0);
  } else {
    // Roadster: raked windshield and an open cockpit.
    const ws = add(new THREE.BoxGeometry(0.04, 0.34, b.W - 0.3), glass, wsBase - 0.08, b.belt + 0.15, 0);
    ws.rotation.z = 0.55;
    add(new THREE.BoxGeometry(1.0, 0.06, b.W - 0.45), trim, wsBase - 0.7, b.belt + 0.01, 0);
    for (const z of [-0.36, 0.36]) add(new THREE.BoxGeometry(0.12, 0.32, 0.4), trim, wsBase - 1.05, b.belt + 0.15, z);
  }

  // Lights, grille, mirrors.
  const xF = b.L / 2, xR = -b.L / 2;
  const head = dm('head', () => new THREE.MeshBasicMaterial({ map: headlightTex() }));
  for (const z of [-1, 1]) {
    const hl = add(new THREE.BoxGeometry(0.3, 0.05, 0.42), head, xF - 0.14, b.nose - 0.005, z * (b.W / 2 - 0.3));
    hl.rotation.z = -0.25;
  }
  add(new THREE.BoxGeometry(0.03, 0.1, b.W * 0.34), dm('grille', () => new THREE.MeshBasicMaterial({ map: grilleTex() })), xF + 0.01, 0.5, 0);
  const tail = new THREE.MeshBasicMaterial({ map: taillightTex(), color: '#8a5a5a' });
  for (const z of [-1, 1]) add(new THREE.BoxGeometry(0.04, 0.14, 0.5), tail, xR - 0.01, b.tail - 0.14, z * (b.W / 2 - 0.32));
  if (b.roof) for (const z of [-1, 1]) add(new THREE.BoxGeometry(0.14, 0.08, 0.12), paint, wsBase - 0.12, b.belt + 0.08, z * (b.W / 2 + 0.04));

  // Wings and scoops.
  if (b.scoop) add(new THREE.BoxGeometry(0.4, 0.06, 0.36), trim, xF - b.hood * 0.45, b.belt - 0.04 + (b.nose - b.belt) * 0.45 + 0.04, 0);
  if (wing) {
    const h = wing === 2 ? 0.3 : 0.12;
    add(new THREE.BoxGeometry(0.34, 0.035, b.W - 0.12), paint, xR + 0.26, b.tail + h, 0);
    for (const z of [-1, 1]) add(new THREE.BoxGeometry(0.08, h, 0.05), trim, xR + 0.3, b.tail + h / 2, z * (b.W / 2 - 0.3));
  }

  // Wheels: tire + textured rim facing out.
  const tire = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.22, 10);
  tire.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CircleGeometry(WHEEL_R * 0.72, 10);
  const rimMat = dm('rim', () => new THREE.MeshBasicMaterial({ map: rimTex() }));
  for (const x of [b.wb / 2, -b.wb / 2]) for (const z of [-1, 1]) {
    const zc = z * (b.W / 2 - 0.13);
    add(tire, trim, x, WHEEL_R, zc);
    const rim = add(rimGeo, rimMat, x, WHEEL_R, zc + z * 0.115);
    rim.rotation.y = z > 0 ? 0 : Math.PI;
  }

  // Soft blob shadow.
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(b.L + 0.4, b.W + 0.5), dm('shadow', () => new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.4, depthWrite: false })));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05; g.add(sh);

  // Headlight beams (switched on at night).
  const beam = new THREE.SpotLight('#fff1cf', 0, 70, 0.55, 0.5, 1.2);
  beam.position.set(xF - 0.2, 0.8, 0);
  beam.target.position.set(14, -1.5, 0);
  g.add(beam, beam.target);

  g.rotation.order = 'YZX';
  return { group: g, tail, beam, length: b.L };
}
