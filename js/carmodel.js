// Low-poly models of the real cars, in the style of late-90s racing games: an extruded side profile
// with wheel arches, a glass greenhouse with painted roof and pillars, and textured lights, grilles,
// bumpers and wheels. Proportions come from each car's real dimensions. Forward is +x, up is +y.
import * as THREE from '../lib/three.module.min.js';
import {
  envCube, headlightTex, taillightTex, grilleTex, roundLampTex, kidneyTex, volvoGrilleTex, mercGrilleTex,
  blackGrilleTex, rectLampTex, tailBarTex, roundTailTex, ribbedTailTex, rimStyleTex,
} from './textures.js';

// L length, W width, wb wheelbase (real, meters). nose/belt/tail: heights of the front edge, the
// beltline and the rear deck. hood/deck: lengths from the bumpers to the windshield / rear window.
// roof height, ws/rw: how far the windshield / rear window lean back.
// front: grille style; lights: headlight style; tails: taillight style; bumper: bumper style.
const CARS = {
  e30:      { L: 4.33, W: 1.65, wb: 2.57, nose: 0.74, belt: 0.93, tail: 0.93, hood: 1.22, deck: 0.98, roof: 1.37, ws: 0.52, rw: 0.42,
              front: 'kidney', lights: 'quad', tails: 'rect', bumper: 'chrome', rim: 'mesh', chromeTrim: true, rubStrip: true },
  volvo242: { L: 4.79, W: 1.71, wb: 2.64, nose: 0.8, belt: 0.96, tail: 0.97, hood: 1.28, deck: 1.1, roof: 1.43, ws: 0.42, rw: 0.3,
              front: 'volvo', lights: 'rect', tails: 'tall', bumper: 'big', rim: 'turbine', chromeTrim: true },
  mb190e:   { L: 4.42, W: 1.68, wb: 2.665, nose: 0.7, belt: 0.9, tail: 1.0, hood: 1.18, deck: 0.95, roof: 1.38, ws: 0.66, rw: 0.5,
              front: 'mercedes', lights: 'rect', tails: 'ribbed', bumper: 'cladding', rim: 'holes', chromeTrim: true },
  s180sx:   { L: 4.54, W: 1.69, wb: 2.475, nose: 0.6, belt: 0.84, tail: 0.9, hood: 1.42, deck: 0.1, roof: 1.27, ws: 0.82, rw: 1.4,
              front: 'slot', lights: 'popup', tails: 'bar', bumper: 'body', rim: '5spoke', spoiler: 'lip' },
  supra:    { L: 4.62, W: 1.745, wb: 2.595, nose: 0.6, belt: 0.86, tail: 0.92, hood: 1.55, deck: 0.12, roof: 1.3, ws: 0.85, rw: 1.3,
              front: 'slot', lights: 'popup', tails: 'bar', bumper: 'body', rim: '5spoke', spoiler: 'lip' },
  r32:      { L: 4.53, W: 1.695, wb: 2.615, nose: 0.66, belt: 0.9, tail: 0.95, hood: 1.35, deck: 0.82, roof: 1.34, ws: 0.76, rw: 0.72,
              front: 'nissan', lights: 'slim', tails: 'quadround', bumper: 'body', rim: '5spoke', spoiler: 'small' },
};

const WHEEL_R = 0.31, ARCH_R = 0.37, SILL = 0.3;

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
  pts.push([xF - 0.12, SILL], [xF, 0.44], [xF - 0.03, b.nose]);
  const wsBase = xF - b.hood, rwBase = xR + Math.max(b.deck, 0.1);
  pts.push([wsBase, b.belt], [rwBase, b.belt], [xR + 0.05, b.tail], [xR, 0.47]);
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

const shared = {};
const once = (key, make) => shared[key] || (shared[key] = make());
const basic = (key, map, extra) => once(key, () => new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.4, ...extra }));

export function makeCarMesh(color, modelId) {
  const b = CARS[modelId] || CARS.e30;
  const g = new THREE.Group();
  const env = envCube();
  const paint = new THREE.MeshPhongMaterial({ color, shininess: 60, specular: '#3a3a3a', envMap: env, reflectivity: 0.12, combine: THREE.MixOperation });
  const glass = once('glass', () => new THREE.MeshPhongMaterial({ color: '#0a111c', shininess: 100, specular: '#6f82a0', envMap: env, reflectivity: 0.22, combine: THREE.MixOperation }));
  const black = once('black', () => new THREE.MeshLambertMaterial({ color: '#16171a' }));
  const plastic = once('plastic', () => new THREE.MeshLambertMaterial({ color: '#26282c' }));
  const chrome = once('chrome', () => new THREE.MeshPhongMaterial({ color: '#c9ced6', shininess: 120, specular: '#ffffff', envMap: env, reflectivity: 0.6, combine: THREE.MixOperation }));
  const alu = once('alu', () => new THREE.MeshLambertMaterial({ color: '#9ea4ab' }));
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  // A flat decal facing forward (+x) or backward (-x).
  const face = (w, h, mat, x, y, z, back = false) => { const m = add(new THREE.PlaneGeometry(w, h), mat, x, y, z); m.rotation.y = back ? -Math.PI / 2 : Math.PI / 2; return m; };
  const xF = b.L / 2, xR = -b.L / 2, W = b.W;

  // Body shell.
  const { shape, wsBase, rwBase } = sideProfile(b);
  add(extrude(shape, W), paint);

  // Greenhouse: dark glass, painted roof panel, B-pillars.
  const roofF = wsBase - b.ws, roofR = rwBase + b.rw;
  const cab = new THREE.Shape();
  cab.moveTo(wsBase, b.belt - 0.02); cab.lineTo(roofF, b.roof); cab.lineTo(roofR, b.roof); cab.lineTo(rwBase, b.belt - 0.02); cab.closePath();
  add(extrude(cab, W - 0.24, 0.04), glass);
  add(new THREE.BoxGeometry(Math.max(0.3, roofF - roofR - 0.1), 0.05, W - 0.32), paint, (roofF + roofR) / 2, b.roof + 0.02, 0);
  const pillarX = roofR + (roofF - roofR) * (b.deck < 0.3 ? 0.62 : 0.5);
  for (const z of [-1, 1]) add(new THREE.BoxGeometry(0.1, b.roof - b.belt, 0.03), black, pillarX, (b.roof + b.belt) / 2, z * (W / 2 - 0.1));

  // Bumpers.
  if (b.bumper === 'big') {
    // Volvo's big aluminum-and-rubber safety bumpers.
    for (const [x, s] of [[xF + 0.1, 1], [xR - 0.1, -1]]) { add(new THREE.BoxGeometry(0.22, 0.16, W + 0.04), alu, x, 0.48, 0); add(new THREE.BoxGeometry(0.23, 0.05, W + 0.05), black, x + s * 0.005, 0.48, 0); }
  } else if (b.bumper === 'chrome') {
    for (const x of [xF + 0.02, xR - 0.02]) { add(new THREE.BoxGeometry(0.12, 0.14, W + 0.02), plastic, x, 0.45, 0); add(new THREE.BoxGeometry(0.13, 0.03, W + 0.03), chrome, x, 0.53, 0); }
  } else if (b.bumper === 'cladding') {
    for (const x of [xF + 0.02, xR - 0.02]) add(new THREE.BoxGeometry(0.14, 0.2, W + 0.02), alu, x, 0.44, 0);
    for (const z of [-1, 1]) add(new THREE.BoxGeometry(b.wb - 0.8, 0.16, 0.04), alu, 0, 0.42, z * (W / 2 + 0.01));
  } else {
    for (const x of [xF + 0.01, xR - 0.01]) add(new THREE.BoxGeometry(0.12, 0.2, W), paint, x, 0.44, 0);
    add(new THREE.BoxGeometry(0.1, 0.05, W - 0.2), black, xF + 0.02, 0.34, 0); // lower lip
  }
  if (b.chromeTrim) for (const z of [-1, 1]) add(new THREE.BoxGeometry(roofF - rwBase + 0.1, 0.025, 0.02), chrome, (roofF + rwBase) / 2 + 0.25, b.belt, z * (W / 2 - 0.05));
  if (b.rubStrip) for (const z of [-1, 1]) add(new THREE.BoxGeometry(b.L - 0.5, 0.05, 0.03), black, 0, 0.62, z * (W / 2 + 0.01));

  // Front: grille and headlights.
  const fy = (0.46 + b.nose) / 2 + 0.03;
  if (b.front === 'kidney') face(0.3, 0.15, basic('kidney', kidneyTex()), xF + 0.012, fy, 0);
  if (b.front === 'volvo') face(0.62, 0.22, basic('volvo', volvoGrilleTex()), xF + 0.012, fy, 0);
  if (b.front === 'mercedes') face(0.34, 0.26, basic('merc', mercGrilleTex()), xF + 0.012, fy + 0.02, 0);
  if (b.front === 'nissan') face(0.5, 0.1, basic('nissan', blackGrilleTex()), xF + 0.012, fy, 0);
  if (b.front === 'slot') face(0.6, 0.06, basic('slot', grilleTex()), xF + 0.03, 0.4, 0);
  if (b.lights === 'quad') for (const z of [-0.54, -0.36, 0.36, 0.54]) face(0.15, 0.15, basic('lamp', roundLampTex()), xF + 0.012, fy, z);
  if (b.lights === 'rect') for (const z of [-1, 1]) face(0.34, 0.16, basic('lamprect', rectLampTex()), xF + 0.012, fy, z * (W / 2 - 0.3));
  if (b.lights === 'slim') for (const z of [-1, 1]) face(0.4, 0.09, basic('lampslim', headlightTex()), xF + 0.012, fy + 0.02, z * (W / 2 - 0.3));
  if (b.lights === 'popup') {
    // Closed pop-up headlights: lids set into the front of the hood, outlined by a dark seam.
    for (const z of [-1, 1]) {
      add(new THREE.BoxGeometry(0.4, 0.02, 0.4), black, xF - 0.3, b.nose + 0.035, z * (W / 2 - 0.32));
      add(new THREE.BoxGeometry(0.36, 0.03, 0.36), paint, xF - 0.3, b.nose + 0.045, z * (W / 2 - 0.32));
      face(0.28, 0.06, basic('amber', rectLampTex()), xF + 0.03, 0.46, z * (W / 2 - 0.3));
    }
  }

  // Rear: taillights.
  const ty = b.tail - 0.14;
  const tail = new THREE.MeshBasicMaterial({ map: taillightTex(), color: '#8a5a5a', transparent: true, alphaTest: 0.4 });
  const tailWith = (tex) => { tail.map = tex; return tail; };
  if (b.tails === 'rect') for (const z of [-1, 1]) face(0.46, 0.14, tailWith(taillightTex()), xR - 0.012, ty, z * (W / 2 - 0.3), true);
  if (b.tails === 'tall') for (const z of [-1, 1]) face(0.26, 0.26, tailWith(ribbedTailTex()), xR - 0.012, ty - 0.04, z * (W / 2 - 0.2), true);
  if (b.tails === 'ribbed') for (const z of [-1, 1]) face(0.5, 0.2, tailWith(ribbedTailTex()), xR - 0.012, ty, z * (W / 2 - 0.3), true);
  if (b.tails === 'bar') face(W - 0.12, 0.12, tailWith(tailBarTex()), xR - 0.012, ty, 0, true);
  if (b.tails === 'quadround') for (const z of [-0.6, -0.4, 0.4, 0.6]) face(0.17, 0.17, tailWith(roundTailTex()), xR - 0.012, ty, z, true);

  // Spoilers.
  if (b.spoiler === 'lip') add(new THREE.BoxGeometry(0.16, 0.05, W - 0.3), paint, xR + 0.12, b.tail + 0.05, 0);
  if (b.spoiler === 'small') {
    add(new THREE.BoxGeometry(0.26, 0.03, W - 0.2), paint, xR + 0.2, b.tail + 0.1, 0);
    for (const z of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.1, 0.05), black, xR + 0.22, b.tail + 0.05, z * (W / 2 - 0.3));
  }

  // Mirrors.
  for (const z of [-1, 1]) add(new THREE.BoxGeometry(0.12, 0.08, 0.12), b.chromeTrim ? black : paint, wsBase - 0.14, b.belt + 0.1, z * (W / 2 + 0.05));

  // Wheels: tire plus a textured rim facing out.
  const tire = once('tire', () => { const t = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.2, 10); t.rotateX(Math.PI / 2); return t; });
  const rimGeo = once('rimgeo', () => new THREE.CircleGeometry(WHEEL_R * 0.74, 10));
  const rimMat = basic(`rim-${b.rim}`, rimStyleTex(b.rim), { transparent: false, alphaTest: 0 });
  for (const x of [b.wb / 2, -b.wb / 2]) for (const z of [-1, 1]) {
    const zc = z * (W / 2 - 0.12);
    add(tire, black, x, WHEEL_R, zc);
    const rim = add(rimGeo, rimMat, x, WHEEL_R, zc + z * 0.105);
    rim.rotation.y = z > 0 ? 0 : Math.PI;
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
