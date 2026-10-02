// Life round the cabin: chimney smoke, a dog doing its rounds, birds wheeling overhead, butterflies
// over the flower beds, laundry on the line, string lights over the fire pit, a picnic table and
// camp chairs, a shed with a project car under a tarp, a tire stack, a mailbox by the road.
// Everything sits outside the drivable areas (see HOME_ZONES in world3d.js). Positions in meters.
import * as THREE from '../lib/three.module.min.js';
import { U } from './road.js';
import { HOME } from './map.js';
import { seeded } from './draw.js';

const m = (v) => v * U;

export function buildHomeLife(scene, puffTex) {
  const rnd = seeded(808);
  const mats = new Map();
  const lam = (c) => mats.get(c) || mats.set(c, new THREE.MeshLambertMaterial({ color: c, flatShading: true })).get(c);
  const glow = (c) => new THREE.MeshBasicMaterial({ color: c });
  const box = (parent, w, h, d, mat, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); parent.add(b); return b; };
  const at = (x, z, rotY = 0) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g); return g; };
  const anim = [];

  const cb = HOME.cabin, cabX0 = m(cb.x), cabX1 = m(cb.x + cb.w), cabZ1 = m(cb.y + cb.h);
  const pr = HOME.porch, porchX0 = m(pr.x), porchX1 = m(pr.x + pr.w), porchZ1 = m(pr.y + pr.h);
  const fp = HOME.firepit, fx = m(fp.x), fz = m(fp.y);

  // ---- porch: posts, a rail, two rocking chairs (one rocking), a lantern by the door ----
  const wood = lam('#7a5634'), darkWood = lam('#4e3520');
  for (const px of [porchX0 + 0.15, porchX1 - 0.15]) box(scene, 0.18, 2.9, 0.18, wood, px, 1.6, porchZ1 - 0.1);
  box(scene, porchX1 - porchX0, 0.12, 0.12, wood, (porchX0 + porchX1) / 2, 3.05, porchZ1 - 0.1);
  const rocker = (x, phase) => {
    const g = at(x, porchZ1 - 1.6, Math.PI);
    const r = new THREE.Group(); r.position.y = 0.35; g.add(r);
    box(r, 0.6, 0.08, 0.55, darkWood, 0, 0.45, 0);
    box(r, 0.6, 0.75, 0.08, darkWood, 0, 0.85, -0.27).rotation.x = -0.2;
    for (const s of [-1, 1]) { const run = box(r, 0.05, 0.06, 0.85, darkWood, s * 0.27, 0.03, 0); run.rotation.x = 0.0; box(r, 0.05, 0.45, 0.05, darkWood, s * 0.27, 0.25, 0.2); box(r, 0.05, 0.45, 0.05, darkWood, s * 0.27, 0.25, -0.2); }
    if (phase !== null) anim.push((t) => { r.rotation.x = Math.sin(t * 1.7 + phase) * 0.12; });
  };
  rocker(porchX0 + 2.2, 0); rocker(porchX0 + 3.4, null);
  const lantern = box(scene, 0.22, 0.32, 0.22, glow('#ffd27a'), porchX0 + (porchX1 - porchX0) * 0.62, 2.2, cabZ1 + 0.15);
  void lantern;

  // ---- flower beds along the front of the cabin, with butterflies ----
  const flowerCols = ['#d83a4a', '#f2c230', '#9a4fd0', '#f08ab0', '#ffffff', '#ff8a2a'];
  const bed = (x0, x1) => {
    box(scene, x1 - x0, 0.22, 1.1, lam('#4a3324'), (x0 + x1) / 2, 0.11, cabZ1 + 0.6);
    const n = Math.round((x1 - x0) * 5);
    const geo = new THREE.IcosahedronGeometry(0.12, 0), stem = lam('#3f7a35');
    for (let i = 0; i < n; i++) {
      const x = x0 + 0.15 + rnd() * (x1 - x0 - 0.3), z = cabZ1 + 0.15 + rnd() * 0.9, h = 0.3 + rnd() * 0.35;
      box(scene, 0.04, h, 0.04, stem, x, 0.22 + h / 2, z);
      const f = new THREE.Mesh(geo, lam(flowerCols[Math.floor(rnd() * flowerCols.length)])); f.position.set(x, 0.24 + h, z); scene.add(f);
    }
  };
  bed(cabX0 + 0.3, porchX0 - 0.3); bed(porchX1 + 0.3, cabX1 - 0.3);
  const wingGeo = new THREE.PlaneGeometry(0.16, 0.12); wingGeo.translate(0.08, 0, 0); wingGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group(), col = new THREE.MeshBasicMaterial({ color: ['#ffffff', '#f2c230', '#ff8a2a', '#8fc8ff', '#ffffff'][i], side: THREE.DoubleSide });
    const wl = new THREE.Mesh(wingGeo, col), wr = new THREE.Mesh(wingGeo, col); wr.scale.x = -1;
    g.add(wl, wr); scene.add(g);
    const cx = i % 2 ? (cabX0 + porchX0) / 2 : (porchX1 + cabX1) / 2, ph = i * 1.9;
    anim.push((t) => {
      g.position.set(cx + Math.sin(t * 0.7 + ph) * 2.2, 0.9 + Math.sin(t * 2.3 + ph) * 0.35, cabZ1 + 1.2 + Math.sin(t * 0.53 + ph * 2) * 1.2);
      g.rotation.y = t * 0.7 + ph;
      const flap = Math.sin(t * 22 + ph) * 1.1; wl.rotation.z = flap; wr.rotation.z = -flap;
    });
  }

  // ---- fire pit: camp chairs, stumps, picnic table, string lights ----
  const chairCols = ['#2f6aa8', '#b8322c', '#3c7a3a'];
  [Math.PI * 0.62, Math.PI * 1.05, Math.PI * 1.45].forEach((a, i) => {
    const x = fx + Math.cos(a) * 3.1, z = fz + Math.sin(a) * 3.1;
    const g = at(x, z, Math.atan2(fx - x, fz - z));
    const cloth = lam(chairCols[i]), leg = lam('#2a2a2a');
    box(g, 0.6, 0.06, 0.5, cloth, 0, 0.45, 0);
    box(g, 0.6, 0.6, 0.06, cloth, 0, 0.78, -0.26).rotation.x = -0.22;
    for (const s of [-1, 1]) for (const d of [-1, 1]) box(g, 0.04, 0.48, 0.04, leg, s * 0.27, 0.22, d * 0.2);
    for (const s of [-1, 1]) box(g, 0.06, 0.04, 0.45, leg, s * 0.32, 0.62, 0);
  });
  for (const a of [Math.PI * 1.85, Math.PI * 0.2]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.45, 8), lam('#6b4a2c'));
    s.position.set(fx + Math.cos(a) * 3, 0.22, fz + Math.sin(a) * 3); scene.add(s);
  }
  {
    const g = at(fx + 6.2, fz - 0.4, 0.1);
    const plank = lam('#8a6640');
    box(g, 0.8, 0.08, 2.0, plank, 0, 0.76, 0);
    for (const s of [-1, 1]) {
      box(g, 0.3, 0.06, 2.0, plank, s * 0.68, 0.45, 0);
      for (const d of [-1, 1]) { const l = box(g, 0.08, 0.95, 0.08, plank, s * 0.3, 0.38, d * 0.75); l.rotation.z = s * 0.38; }
    }
    // A cooler and a lantern on the table.
    box(g, 0.45, 0.32, 0.3, lam('#c8322c'), -0.15, 0.96, -0.55);
    box(g, 0.47, 0.06, 0.32, lam('#f2f2ee'), -0.15, 1.14, -0.55);
    box(g, 0.14, 0.24, 0.14, glow('#ffd27a'), 0.1, 0.92, 0.5);
  }
  // String lights: porch corner -> pole -> pole -> porch corner, sagging between.
  const pole = (x, z) => { box(scene, 0.1, 3.0, 0.1, darkWood, x, 1.5, z); return new THREE.Vector3(x, 2.9, z); };
  const pts = [new THREE.Vector3(porchX1 - 0.15, 2.95, porchZ1 - 0.1), pole(fx + 7.2, fz + 3.8), pole(fx - 3.8, fz + 4.6), new THREE.Vector3(porchX0 + 0.15, 2.95, porchZ1 - 0.1)];
  const bulbGeo = new THREE.SphereGeometry(0.07, 5, 4), bulbCols = ['#ffe09a', '#ffc870', '#fff2c8'];
  const wire = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1], n = Math.max(6, Math.round(a.distanceTo(b) / 0.8));
    for (let i = 0; i <= n; i++) {
      const u = i / n, p = new THREE.Vector3().lerpVectors(a, b, u);
      p.y -= Math.sin(u * Math.PI) * 0.55;
      wire.push(p);
      if (i > 0 && i < n) { const bl = new THREE.Mesh(bulbGeo, glow(bulbCols[i % 3])); bl.position.copy(p).y -= 0.08; scene.add(bl); }
    }
  }
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: '#1e1a16' })));

  // ---- shed with a project car under a tarp ----
  {
    const sx = cabX1 + 5.6, sz = cabZ1 + 1.8, g = at(sx, sz, -0.08);
    box(g, 3.2, 2.3, 2.6, lam('#8b3a2a'), 0, 1.15, 0);
    box(g, 3.24, 0.12, 2.64, lam('#e8e2d4'), 0, 0.06, 0);
    for (const s of [-1, 1]) { const r = box(g, 3.6, 0.1, 1.75, lam('#4d4d50'), 0, 2.62, s * 0.72); r.rotation.x = s * 0.45; }
    box(g, 1.1, 1.8, 0.05, lam('#e8e2d4'), -0.6, 0.95, 1.31);
    box(g, 0.9, 1.65, 0.06, lam('#6e2a1e'), -0.6, 0.9, 1.33);
    box(g, 0.6, 0.45, 0.06, glow('#3a4a58'), 0.85, 1.4, 1.32);
    // A ladder leaning on the side.
    const lad = new THREE.Group(); lad.position.set(1.66, 0, -0.3); lad.rotation.z = 0.2; g.add(lad);
    for (const s of [-1, 1]) box(lad, 0.05, 2.4, 0.05, lam('#b0b4b8'), 0, 1.2, s * 0.22);
    for (let r = 0; r < 6; r++) box(lad, 0.04, 0.04, 0.44, lam('#b0b4b8'), 0, 0.3 + r * 0.38, 0);
    const car = at(sx + 0.2, sz + 4.6, 0.05);
    const tarp = lam('#4f6a43');
    box(car, 1.75, 0.7, 4.2, tarp, 0, 0.62, 0);
    const cab = box(car, 1.45, 0.55, 2.1, tarp, 0, 1.2, -0.25); cab.scale.set(1, 1, 1);
    for (const s of [-1, 1]) for (const d of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 10), lam('#151515'));
      w.rotation.z = Math.PI / 2; w.position.set(s * 0.8, 0.3, d * 1.3); car.add(w);
    }
    box(car, 0.15, 0.12, 0.8, lam('#c8b04a'), 0.9, 0.35, 2.3); // a bungee hanging off the tarp
  }

  // ---- tire stacks and a tool chest by the carport ----
  const tn = HOME.tent;
  const tireGeo = new THREE.TorusGeometry(0.31, 0.13, 6, 12); tireGeo.rotateX(Math.PI / 2);
  const tireMat = lam('#181818');
  [[m(tn.x) - 1.6, m(tn.y) + 1.4, 4], [m(tn.x) - 1.5, m(tn.y) + 2.6, 3]].forEach(([x, z, n]) => {
    for (let i = 0; i < n; i++) { const t = new THREE.Mesh(tireGeo, tireMat); t.position.set(x + (rnd() - 0.5) * 0.08, 0.13 + i * 0.26, z + (rnd() - 0.5) * 0.08); scene.add(t); }
  });
  {
    const g = at(m(tn.x + tn.w) + 0.75, m(tn.y) + 1.4, Math.PI / 2);
    box(g, 0.7, 1.0, 0.45, lam('#c42a22'), 0, 0.58, 0);
    for (let d = 0; d < 4; d++) box(g, 0.6, 0.02, 0.02, lam('#d8d8d8'), 0, 0.3 + d * 0.22, 0.235);
    for (const s of [-1, 1]) box(g, 0.06, 0.1, 0.06, lam('#222'), s * 0.3, 0.05, 0);
  }

  // ---- laundry line ----
  {
    const z = m(tn.y) + 0.3, x0 = m(tn.x) - 8, x1 = m(tn.x) - 3.4;
    for (const x of [x0, x1]) box(scene, 0.08, 2.1, 0.08, darkWood, x, 1.05, z);
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x0, 1.95, z), new THREE.Vector3((x0 + x1) / 2, 1.82, z), new THREE.Vector3(x1, 1.95, z)]), new THREE.LineBasicMaterial({ color: '#dcdcdc' })));
    const cloths = ['#f2f2ee', '#3c6fb4', '#d04a3a', '#f2d24a', '#f2f2ee'];
    cloths.forEach((c, i) => {
      const u = (i + 0.7) / (cloths.length + 0.4), w = 0.55 + rnd() * 0.35, h = 0.5 + rnd() * 0.45;
      const g = new THREE.Group(); g.position.set(x0 + (x1 - x0) * u, 1.9 - Math.sin(u * Math.PI) * 0.12, z); scene.add(g);
      const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, -h / 2, 0);
      g.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide })));
      anim.push((t) => { g.rotation.x = 0.12 + Math.sin(t * 1.9 + i * 0.8) * 0.13 + Math.sin(t * 3.7 + i) * 0.04; });
    });
  }

  // ---- mailbox at the end of the lane ----
  {
    const ln = HOME.lane, g = at(m(ln.x + ln.w) + 1.2, m(ln.y1) - 9, 0);
    box(g, 0.1, 1.1, 0.1, darkWood, 0, 0.55, 0);
    const mb = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 8, 1, false, 0, Math.PI), lam('#2c4a7a'));
    mb.rotation.x = Math.PI / 2; mb.rotation.z = Math.PI / 2; mb.position.set(0, 1.18, 0); g.add(mb);
    box(g, 0.34, 0.17, 0.5, lam('#2c4a7a'), 0, 1.1, 0);
    const flag = box(g, 0.03, 0.22, 0.08, lam('#d42a22'), 0.19, 1.3, 0.1);
    anim.push((t) => { flag.rotation.x = Math.sin(t * 0.4) > 0.6 ? -1.2 : 0; });
  }

  // ---- chimney and fire smoke ----
  const ch = HOME.chimney, chx = m(ch.x) + m(ch.s) / 2, chz = m(ch.y) + m(ch.s) / 2;
  const smoke = [];
  const addSmoke = (x, y, z, n, size, life, col) => {
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: col, transparent: true, depthWrite: false, opacity: 0 }));
      scene.add(sp); smoke.push({ sp, x, y, z, ph: i / n, size, life });
    }
  };
  addSmoke(chx, 6.4, chz, 9, 1.4, 7, '#d9d6d0');
  addSmoke(fx, 0.9, fz, 6, 0.8, 4, '#c9c4bc');
  anim.push((t) => {
    for (const s of smoke) {
      const a = ((t / s.life + s.ph) % 1);
      s.sp.position.set(s.x + a * a * 4.5 + Math.sin(t * 0.7 + s.ph * 9) * 0.3 * a, s.y + a * 6, s.z - a * 1.5);
      s.sp.scale.setScalar(s.size * (0.6 + a * 3.2));
      s.sp.material.opacity = 0.55 * Math.min(1, a * 6) * (1 - a);
    }
  });

  // ---- the dog: trots a loop round the yard, stops to sniff, wags ----
  {
    const fur = lam('#c48a3c'), dark = lam('#5a3a1a');
    const dog = new THREE.Group(); scene.add(dog);
    const body = box(dog, 0.28, 0.3, 0.72, fur, 0, 0.5, 0);
    const head = new THREE.Group(); head.position.set(0, 0.72, 0.42); dog.add(head);
    box(head, 0.24, 0.24, 0.26, fur, 0, 0, 0);
    box(head, 0.14, 0.12, 0.16, fur, 0, -0.05, 0.18);
    box(head, 0.06, 0.05, 0.04, dark, 0, -0.02, 0.27);
    for (const s of [-1, 1]) box(head, 0.06, 0.14, 0.04, dark, s * 0.11, 0.06, -0.04).rotation.z = s * 0.3;
    const tail = new THREE.Group(); tail.position.set(0, 0.6, -0.36); dog.add(tail);
    box(tail, 0.05, 0.05, 0.3, fur, 0, 0.06, -0.12).rotation.x = 0.6;
    const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([s, d]) => {
      const l = new THREE.Group(); l.position.set(s * 0.1, 0.38, d * 0.26); dog.add(l);
      box(l, 0.08, 0.38, 0.08, fur, 0, -0.19, 0);
      return { l, ph: (s * d > 0 ? 0 : Math.PI) };
    });
    void body;
    // The loop: round the fire pit and table, past the porch and the shed.
    const route = [[fx - 4.8, fz + 1.5], [fx - 2.5, fz - 4.4], [porchX1 + 1.2, porchZ1 + 2.2], [cabX1 + 4.2, cabZ1 + 3.2], [fx + 9.5, fz + 3.2], [fx + 3, fz + 6.4], [fx - 3.6, fz + 6]]
      .map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(route, true), L = curve.getLength();
    let u = 0, last = 0, pause = 0, nextPause = 6;
    const p = new THREE.Vector3(), tg = new THREE.Vector3();
    anim.push((t) => {
      const dt = Math.min(0.1, Math.max(0, t - (last || t))); last = t;
      let walking = true;
      if (pause > 0) { pause -= dt; walking = false; } else if ((nextPause -= dt) <= 0) { pause = 2.5 + rnd() * 3; nextPause = 7 + rnd() * 8; }
      if (walking) u = (u + (dt * 1.3) / L) % 1;
      curve.getPointAt(u, p); curve.getTangentAt(u, tg);
      dog.position.set(p.x, 0, p.z);
      dog.rotation.y = Math.atan2(tg.x, tg.z);
      for (const { l, ph } of legs) l.rotation.x = walking ? Math.sin(t * 11 + ph) * 0.55 : 0;
      dog.position.y = walking ? Math.abs(Math.sin(t * 11)) * 0.03 : 0;
      head.rotation.x = walking ? 0.05 : 0.45 + Math.sin(t * 6) * 0.08; // nose down, sniffing
      tail.rotation.y = Math.sin(t * (walking ? 9 : 14)) * 0.7;
    });
  }

  // ---- birds wheeling over the clearing ----
  {
    const cl = HOME.clearing, cx = m(cl.x), cz = m(cl.y);
    const bwing = new THREE.PlaneGeometry(0.55, 0.22); bwing.translate(0.27, 0, 0); bwing.rotateX(-Math.PI / 2);
    const bmat = new THREE.MeshBasicMaterial({ color: '#2a2a2e', side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group(), wl = new THREE.Mesh(bwing, bmat), wr = new THREE.Mesh(bwing, bmat); wr.scale.x = -1;
      g.add(wl, wr); box(g, 0.1, 0.08, 0.4, bmat, 0, 0, 0); scene.add(g);
      const R = 18 + i * 6, h = 20 + i * 3, sp = 0.18 + i * 0.03, ph = i * 1.3, dir = i % 2 ? 1 : -1;
      anim.push((t) => {
        const a = dir * t * sp + ph;
        g.position.set(cx + Math.cos(a) * R, h + Math.sin(t * 0.5 + ph) * 2, cz + Math.sin(a) * R * 0.8);
        g.rotation.y = -a + (dir > 0 ? Math.PI : 0); g.rotation.z = dir * 0.25;
        const glide = Math.sin(t * 0.3 + ph) > 0.2, flap = glide ? 0.12 : Math.sin(t * 9 + ph) * 0.6;
        wl.rotation.z = flap; wr.rotation.z = -flap;
      });
    }
  }

  return { update: (t) => { for (const f of anim) f(t); } };
}
