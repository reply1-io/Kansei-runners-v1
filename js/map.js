// Home map: a cabin in a clearing deep in the forest, a carport tent, a two-car driveway,
// and a winding two-lane road out front. Top-down, drawn procedurally on a canvas.
import { drawCar, roundRectPath, seeded } from './draw.js';
import { ROAD, ROAD_HALF, U } from './road.js';

// ---- Layout (world units). Tweak positions here. ----
export const HOME = {
  focus: { x: 170, y: 215, w: 520, h: 600 },         // what the camera always keeps in view
  clearing: { x: 455, y: 430, rx: 300, ry: 225 },
  cabin: { x: 440, y: 250, w: 200, h: 150 },
  porch: { x: 470, y: 400, w: 140, h: 44 },
  chimney: { x: 588, y: 268, s: 24 },
  tent: { x: 288, y: 292, w: 84, h: 110 },
  driveway: { x: 248, y: 406, w: 164, h: 96 },
  lane: { x: 294, w: 72, y0: 496, y1: 690 },           // gravel lane from driveway to the road
  firepit: { x: 548, y: 530, r: 18 },
  woodpile: { x: 652, y: 292, w: 26, h: 84 },
  // The road itself comes from js/road.js (the touge); the lane meets it at (330, 675).
};
const ROAD_W = (ROAD_HALF * 2) / U; // road width in map units

// Where owned cars park (backed in, facing the road). Spot 0 is under the tent (your selected car).
// btn: where that car's Select button sits, relative to the car.
export const PARKING = [
  { x: 330, y: 350, label: 'Tent', btn: { dx: -78, dy: 0 } },
  { x: 290, y: 454, label: 'Driveway', btn: { dx: -62, dy: 0 } },
  { x: 370, y: 454, label: 'Driveway', btn: { dx: 70, dy: 0 } },
];
const PARK_HEADING = Math.PI / 2;

const CAR = { len: 50, wid: 25 };
const PALETTE = {
  forestFloor: '#18221a',
  grass: '#3b5030', grassLight: '#46603a', grassDark: '#314427',
  dirt: '#5c4c37', gravel: '#8a8171', gravelDark: '#6f675a',
  asphalt: '#33353a', shoulder: '#4a3f30', line: '#e9e6dc', yellow: '#e1b12c',
  roof: '#7b3b2c', roofDark: '#5e2c21', deck: '#7a5634', deckDark: '#5c3f25',
  stone: '#8d8a84', canvasTent: 'rgba(205,192,156,0.62)',
};

// Park the selected car under the tent and the rest on the driveway.
export function parkingAssignments(cars, activeId) {
  const ordered = [...cars].sort((a, b) => (b.id === activeId) - (a.id === activeId));
  return PARKING.map((spot, i) => ({ spot, index: i, car: ordered[i] || null }));
}

export function createMap(canvas, { getCars, getActiveId, onTap, onSelect, buttonsEl }) {
  const ctx = canvas.getContext('2d');
  const road = ROAD.samples.map((p) => ({ x: p.x / U, y: p.z / U, nx: p.nx, ny: p.nz, tx: p.tx, ty: p.tz, d: p.s / U }));
  const roadLen = road[road.length - 1].d;
  const homeD = ROAD.homeS / U;
  const trees = makeTrees(road);
  const staticLayer = document.createElement('canvas');
  const cam = { s: 1, cx: 0, cy: 0, W: 0, H: 0, dpr: 1 };
  const smoke = [];
  const traffic = [];
  const ripples = [];
  let smokeT = 0, trafficT = 1.5, last = 0, raf = 0, running = false, time = 0;

  function resize() {
    cam.dpr = Math.min(window.devicePixelRatio || 1, 2);
    cam.W = canvas.width = Math.max(1, Math.round(canvas.clientWidth * cam.dpr));
    cam.H = canvas.height = Math.max(1, Math.round(canvas.clientHeight * cam.dpr));
    const f = HOME.focus;
    cam.s = Math.min(cam.W / f.w, cam.H / f.h, 2.4 * cam.dpr);
    cam.cx = f.x + f.w / 2;
    cam.cy = f.y + f.h / 2;
    staticLayer.width = cam.W;
    staticLayer.height = cam.H;
    drawStatic(staticLayer.getContext('2d'));
  }

  const applyCam = (c) => c.setTransform(cam.s, 0, 0, cam.s, cam.W / 2 - cam.cx * cam.s, cam.H / 2 - cam.cy * cam.s);
  const toWorld = (px, py) => ({
    x: (px * cam.dpr - cam.W / 2) / cam.s + cam.cx,
    y: (py * cam.dpr - cam.H / 2) / cam.s + cam.cy,
  });

  // ---------- static scenery (redrawn only on resize) ----------
  function drawStatic(c) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = PALETTE.forestFloor;
    c.fillRect(0, 0, cam.W, cam.H);
    applyCam(c);
    const rnd = seeded(7);

    // Clearing with grass variation.
    const cl = HOME.clearing;
    c.fillStyle = PALETTE.grass;
    c.beginPath(); c.ellipse(cl.x, cl.y, cl.rx, cl.ry, 0, 0, 7); c.fill();
    for (let i = 0; i < 260; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
      const x = cl.x + Math.cos(a) * cl.rx * r, y = cl.y + Math.sin(a) * cl.ry * r;
      c.fillStyle = rnd() < 0.5 ? PALETTE.grassLight : PALETTE.grassDark;
      c.globalAlpha = 0.45;
      c.beginPath(); c.ellipse(x, y, 8 + rnd() * 22, 5 + rnd() * 12, rnd() * 3, 0, 7); c.fill();
    }
    c.globalAlpha = 1;

    // Worn dirt around the fire pit and in front of the porch.
    const dirt = (x, y, rx, ry) => { c.fillStyle = PALETTE.dirt; c.globalAlpha = 0.7; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); c.globalAlpha = 1; };
    dirt(HOME.firepit.x, HOME.firepit.y, 52, 40);
    dirt(540, 462, 60, 18);

    // Gravel lane + driveway pad.
    const gravel = (x, y, w, h) => {
      c.fillStyle = PALETTE.gravel; roundRectPath(c, x, y, w, h, 10); c.fill();
      c.fillStyle = PALETTE.gravelDark;
      for (let i = 0; i < (w * h) / 40; i++) c.fillRect(x + rnd() * w, y + rnd() * h, 1.6, 1.6);
    };
    gravel(HOME.lane.x, HOME.lane.y0 - 10, HOME.lane.w, HOME.lane.y1 - HOME.lane.y0 + 10);
    const dw = HOME.driveway;
    gravel(dw.x, dw.y, dw.w, dw.h);
    gravel(HOME.tent.x + 4, HOME.tent.y + 6, HOME.tent.w - 8, HOME.tent.h - 6); // floor under the tent
    // Faint parking divider on the driveway.
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 2; c.setLineDash([8, 8]);
    c.beginPath(); c.moveTo(dw.x + dw.w / 2, dw.y + 10); c.lineTo(dw.x + dw.w / 2, dw.y + dw.h - 10); c.stroke();
    c.setLineDash([]);

    // Stepping stones from the porch steps to the driveway.
    c.fillStyle = PALETTE.stone;
    for (const [x, y] of [[520, 462], [490, 466], [460, 460], [432, 456]]) {
      c.beginPath(); c.ellipse(x, y, 9, 7, 0.3, 0, 7); c.fill();
    }

    // Road: dirt shoulder, asphalt, white edge lines, double yellow center.
    const strokeRoad = (offset, width, color, dash) => {
      c.beginPath();
      road.forEach((p, i) => { const x = p.x + p.nx * offset, y = p.y + p.ny * offset; i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash || []); c.stroke(); c.setLineDash([]);
    };
    c.lineJoin = 'round'; c.lineCap = 'round';
    strokeRoad(0, ROAD_W + 22, PALETTE.shoulder);
    strokeRoad(0, ROAD_W, PALETTE.asphalt);
    strokeRoad(-ROAD_W / 2 + 5, 2.5, PALETTE.line);
    strokeRoad(ROAD_W / 2 - 5, 2.5, PALETTE.line);
    strokeRoad(-2.5, 2, PALETTE.yellow);
    strokeRoad(2.5, 2, PALETTE.yellow);
    // Touge start/finish line in front of the cabin.
    const sl = sampleRoad(ROAD.startLineS / U);
    c.save();
    c.translate(sl.x, sl.y);
    c.rotate(Math.atan2(sl.ty, sl.tx));
    for (let i = 0; i * 8 < ROAD_W; i++) for (let j = 0; j < 2; j++) {
      c.fillStyle = (i + j) % 2 ? '#111' : '#eee';
      c.fillRect(-8 + j * 8, -ROAD_W / 2 + i * 8, 8, 8);
    }
    c.restore();

    drawFirepitStones(c);
    drawWoodpile(c, rnd);
    drawCabin(c);

    // Trees last so the forest edge overlaps the clearing.
    for (const t of trees) drawTree(c, t);

    // Deep-forest vignette.
    c.setTransform(1, 0, 0, 1, 0, 0);
    const g = c.createRadialGradient(cam.W / 2, cam.H / 2, Math.min(cam.W, cam.H) * 0.3, cam.W / 2, cam.H / 2, Math.max(cam.W, cam.H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,6,2,0.6)');
    c.fillStyle = g;
    c.fillRect(0, 0, cam.W, cam.H);
  }

  function drawCabin(c) {
    const { x, y, w, h } = HOME.cabin;
    const p = HOME.porch;
    // Porch deck with planks, posts and steps.
    c.fillStyle = PALETTE.deck; c.fillRect(p.x, p.y - 6, p.w, p.h + 6);
    c.strokeStyle = PALETTE.deckDark; c.lineWidth = 1.5;
    for (let px = p.x + 10; px < p.x + p.w; px += 10) { c.beginPath(); c.moveTo(px, p.y); c.lineTo(px, p.y + p.h); c.stroke(); }
    c.fillStyle = PALETTE.deckDark;
    c.fillRect(p.x + p.w / 2 - 22, p.y + p.h, 44, 8);
    c.fillRect(p.x + p.w / 2 - 22, p.y + p.h + 10, 44, 6);
    for (const px of [p.x + 2, p.x + p.w - 8]) c.fillRect(px, p.y + p.h - 8, 6, 6);
    // Two porch chairs.
    c.fillStyle = '#3d2a1b';
    c.fillRect(p.x + 16, p.y + 12, 16, 16);
    c.fillRect(p.x + p.w - 32, p.y + 12, 16, 16);

    // Roof shadow, then a gabled metal roof (ridge runs left-right).
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(x - 4, y + 6, w + 20, h + 8);
    c.fillStyle = PALETTE.roof; c.fillRect(x - 10, y - 10, w + 20, h / 2 + 10);
    c.fillStyle = PALETTE.roofDark; c.fillRect(x - 10, y + h / 2, w + 20, h / 2 + 10);
    c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 1.5;
    for (let sx = x - 10 + 12; sx < x + w + 10; sx += 12) { c.beginPath(); c.moveTo(sx, y - 10); c.lineTo(sx, y + h + 10); c.stroke(); }
    c.fillStyle = '#a0553f'; c.fillRect(x - 10, y + h / 2 - 3, w + 20, 6); // ridge cap
    // Stone chimney.
    const ch = HOME.chimney;
    c.fillStyle = PALETTE.stone; c.fillRect(ch.x, ch.y, ch.s, ch.s);
    c.fillStyle = '#1b1b1b'; c.fillRect(ch.x + 5, ch.y + 5, ch.s - 10, ch.s - 10);
  }

  function drawWoodpile(c, rnd) {
    const wp = HOME.woodpile;
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(wp.x + 3, wp.y + 4, wp.w, wp.h);
    for (let yy = wp.y + 6; yy < wp.y + wp.h; yy += 11) {
      for (let xx = wp.x + 6; xx < wp.x + wp.w; xx += 11) {
        c.fillStyle = rnd() < 0.5 ? '#b58b5a' : '#a47a4b';
        c.beginPath(); c.arc(xx, yy, 5.2, 0, 7); c.fill();
        c.strokeStyle = '#6b4a2a'; c.lineWidth = 1; c.stroke();
      }
    }
    // Chopping stump with an axe.
    c.fillStyle = '#8b6a45'; c.beginPath(); c.arc(wp.x + 13, wp.y + wp.h + 26, 11, 0, 7); c.fill();
    c.strokeStyle = '#5e4630'; c.lineWidth = 1.5; c.beginPath(); c.arc(wp.x + 13, wp.y + wp.h + 26, 6, 0, 7); c.stroke();
    c.strokeStyle = '#3a2a1a'; c.lineWidth = 3; c.beginPath(); c.moveTo(wp.x + 13, wp.y + wp.h + 26); c.lineTo(wp.x + 32, wp.y + wp.h + 40); c.stroke();
  }

  function drawFirepitStones(c) {
    const f = HOME.firepit;
    c.fillStyle = '#2a2420'; c.beginPath(); c.arc(f.x, f.y, f.r, 0, 7); c.fill();
    c.fillStyle = PALETTE.stone;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      c.beginPath(); c.ellipse(f.x + Math.cos(a) * f.r, f.y + Math.sin(a) * f.r, 6, 5, a, 0, 7); c.fill();
    }
    // Log benches.
    c.fillStyle = '#6e4d2e';
    roundRectPath(c, f.x - 26, f.y + 30, 52, 11, 5); c.fill();
    roundRectPath(c, f.x + 34, f.y - 22, 11, 44, 5); c.fill();
  }

  // ---------- dynamic layer ----------
  function sampleRoad(d) {
    let lo = 0, hi = road.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (road[m].d <= d) lo = m; else hi = m - 1; }
    const a = road[lo], b = road[Math.min(lo + 1, road.length - 1)];
    const t = b.d > a.d ? (d - a.d) / (b.d - a.d) : 0;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, tx: a.tx, ty: a.ty, nx: a.nx, ny: a.ny };
  }

  function update(dt) {
    time += dt;
    // Chimney smoke drifting east.
    smokeT -= dt;
    if (smokeT <= 0) {
      smokeT = 0.35;
      const ch = HOME.chimney;
      smoke.push({ x: ch.x + ch.s / 2, y: ch.y + ch.s / 2, r: 4, a: 0.3, vx: 10 + Math.random() * 8, vy: -4 - Math.random() * 6 });
    }
    for (const s of smoke) { s.x += s.vx * dt; s.y += s.vy * dt; s.r += dt * 7; s.a -= dt * 0.07; }
    while (smoke.length && smoke[0].a <= 0) smoke.shift();

    // Occasional traffic in both lanes (drives on the right).
    trafficT -= dt;
    if (trafficT <= 0) {
      trafficT = 4 + Math.random() * 7;
      const dir = Math.random() < 0.5 ? 1 : -1;
      traffic.push({
        d: homeD - dir * 1100, dir, speed: 170 + Math.random() * 110,
        color: ['#c8ccd2', '#8c1c13', '#1d3557', '#e9c46a', '#2a9d8f', '#222'][Math.floor(Math.random() * 6)],
      });
    }
    for (const t of traffic) t.d += t.dir * t.speed * dt;
    for (let i = traffic.length - 1; i >= 0; i--) if (Math.abs(traffic[i].d - homeD) > 1200 || traffic[i].d < 0 || traffic[i].d > roadLen) traffic.splice(i, 1);

    for (const r of ripples) r.t += dt;
    while (ripples.length && ripples[0].t > 0.6) ripples.shift();
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(staticLayer, 0, 0);
    applyCam(ctx);

    for (const t of traffic) {
      const p = sampleRoad(t.d);
      const h = Math.atan2(p.ty, p.tx) + (t.dir < 0 ? Math.PI : 0);
      drawCar(ctx, p.x + p.nx * 24 * t.dir, p.y + p.ny * 24 * t.dir, h, t.color, { len: 46, wid: 23, headlights: true });
    }

    // Fire: flickering glow and flames.
    const f = HOME.firepit;
    const flick = 0.85 + 0.15 * Math.sin(time * 11) * Math.sin(time * 7.3);
    const g = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, 70 * flick);
    g.addColorStop(0, 'rgba(255,160,60,0.45)');
    g.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, 70, 0, 7); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = time * 3 + i * 1.3;
      ctx.fillStyle = i % 2 ? '#ffb347' : '#ff6b1a';
      ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * 5, f.y + Math.sin(a * 1.3) * 5, 5 + 2 * Math.sin(a * 2), 0, 7); ctx.fill();
    }

    // Parked cars, with empty spots outlined.
    const spots = parkingAssignments(getCars(), getActiveId());
    for (const { spot, car } of spots) {
      if (car) drawCar(ctx, spot.x, spot.y, PARK_HEADING, car.color, { len: CAR.len, wid: CAR.wid });
      else {
        ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
        roundRectPath(ctx, spot.x - CAR.wid / 2 - 5, spot.y - CAR.len / 2 - 5, CAR.wid + 10, CAR.len + 10, 6);
        ctx.stroke(); ctx.setLineDash([]);
      }
    }
    drawTent(ctx);

    for (const s of smoke) {
      ctx.fillStyle = `rgba(200,200,200,${Math.max(0, s.a)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
    }
    for (const r of ripples) {
      ctx.strokeStyle = `rgba(255,211,42,${1 - r.t / 0.6})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(r.x, r.y, 10 + r.t * 60, 0, 7); ctx.stroke();
    }
  }

  // Carport tent: semi-transparent canvas roof so you can still see the car under it.
  function drawTent(c) {
    const t = HOME.tent;
    c.strokeStyle = 'rgba(230,225,210,0.5)'; c.lineWidth = 1;
    const corners = [[t.x, t.y], [t.x + t.w, t.y], [t.x, t.y + t.h], [t.x + t.w, t.y + t.h]];
    for (const [cx, cy] of corners) { // guy lines out to stakes
      const sx = cx + (cx === t.x ? -14 : 14), sy = cy + (cy === t.y ? -14 : 14);
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(sx, sy); c.stroke();
      c.fillStyle = '#ccc'; c.fillRect(sx - 1.5, sy - 1.5, 3, 3);
    }
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(t.x + 6, t.y + 8, t.w, t.h);
    c.fillStyle = PALETTE.canvasTent; c.fillRect(t.x, t.y, t.w / 2, t.h);
    c.fillStyle = 'rgba(170,158,125,0.62)'; c.fillRect(t.x + t.w / 2, t.y, t.w / 2, t.h);
    c.strokeStyle = 'rgba(90,80,60,0.8)'; c.lineWidth = 2;
    c.strokeRect(t.x, t.y, t.w, t.h);
    c.beginPath(); c.moveTo(t.x + t.w / 2, t.y); c.lineTo(t.x + t.w / 2, t.y + t.h); c.stroke(); // ridge
    c.fillStyle = '#333';
    for (const [cx, cy] of corners) { c.beginPath(); c.arc(cx, cy, 3, 0, 7); c.fill(); }
  }

  // ---------- input ----------
  function hitTest(w) {
    const spots = parkingAssignments(getCars(), getActiveId());
    for (const { spot, car, index } of spots) {
      if (Math.abs(w.x - spot.x) < CAR.wid / 2 + 12 && Math.abs(w.y - spot.y) < CAR.len / 2 + 12) {
        return car ? { type: 'car', carId: car.id, index } : { type: 'spot', index };
      }
    }
    const cb = HOME.cabin, p = HOME.porch;
    if ((w.x > cb.x - 10 && w.x < cb.x + cb.w + 10 && w.y > cb.y - 10 && w.y < cb.y + cb.h + 10) ||
        (w.x > p.x && w.x < p.x + p.w && w.y > p.y && w.y < p.y + p.h + 18)) return { type: 'cabin' };
    const t = HOME.tent;
    if (w.x > t.x && w.x < t.x + t.w && w.y > t.y && w.y < t.y + t.h) return { type: 'spot', index: 0 };
    return null;
  }

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const w = toWorld(e.clientX - r.left, e.clientY - r.top);
    const hit = hitTest(w);
    if (hit) { ripples.push({ x: w.x, y: w.y, t: 0 }); onTap(hit); }
  });

  // Select buttons next to each parked car (DOM, so they're real tappable buttons).
  let btnKey = '';
  function syncButtons() {
    if (!buttonsEl) return;
    const spots = parkingAssignments(getCars(), getActiveId()).filter((x) => x.car);
    const key = spots.map((x) => x.car.id).join() + `|${cam.W}x${cam.H}`;
    if (key === btnKey) return;
    btnKey = key;
    buttonsEl.innerHTML = spots.map(({ spot, car }) => {
      const p = worldToScreen(spot.x + spot.btn.dx, spot.y + spot.btn.dy);
      return `<button class="select-btn" data-select="${car.id}" style="left:${p.x}px;top:${p.y}px">Select</button>`;
    }).join('');
  }
  if (buttonsEl) buttonsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-select]');
    if (b && onSelect) onSelect(b.dataset.select);
  });

  const worldToScreen = (x, y) => ({ x: ((x - cam.cx) * cam.s + cam.W / 2) / cam.dpr, y: ((y - cam.cy) * cam.s + cam.H / 2) / cam.dpr });

  function loop(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    update(dt);
    render();
    syncButtons();
    if (running) raf = requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => { if (running) resize(); });

  return {
    start() {
      if (running) return;
      running = true; last = 0;
      resize();
      raf = requestAnimationFrame(loop);
    },
    stop() { running = false; cancelAnimationFrame(raf); },
    worldToScreen,
  };
}

// Dense forest everywhere except the clearing, the road and the lane.
function makeTrees(road) {
  const rnd = seeded(1337);
  const trees = [];
  const cl = HOME.clearing, half = ROAD_W / 2;
  const step = 44;
  for (let gy = -700; gy < 1700; gy += step) {
    for (let gx = -1000; gx < 2000; gx += step) {
      const x = gx + (rnd() - 0.5) * step * 0.9, y = gy + (rnd() - 0.5) * step * 0.9;
      const r = 18 + rnd() * 16;
      const ex = (x - cl.x) / cl.rx, ey = (y - cl.y) / cl.ry;
      if (ex * ex + ey * ey < 1.05) continue;
      const ln = HOME.lane;
      if (x > ln.x - 20 && x < ln.x + ln.w + 20 && y > ln.y0 - 20 && y < ln.y1) continue;
      let near = false;
      for (let i = 0; i < road.length; i += 2) {
        const dx = road[i].x - x, dy = road[i].y - y;
        if (dx * dx + dy * dy < (half + 16 + r * 0.4) ** 2) { near = true; break; }
      }
      if (near) continue;
      trees.push({ x, y, r, kind: rnd() < 0.8 ? 'pine' : 'leafy', shade: 0.8 + rnd() * 0.35, rot: rnd() * 6.28 });
    }
  }
  trees.sort((a, b) => a.y - b.y);
  return trees;
}

function drawTree(c, t) {
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath(); c.ellipse(t.x + t.r * 0.35, t.y + t.r * 0.45, t.r, t.r * 0.9, 0, 0, 7); c.fill();
  const col = (r, g, b) => `rgb(${Math.round(r * t.shade)},${Math.round(g * t.shade)},${Math.round(b * t.shade)})`;
  if (t.kind === 'pine') {
    // Layered star shapes read as a conifer seen from above.
    const layers = [[1, col(22, 58, 34)], [0.72, col(30, 76, 42)], [0.45, col(42, 96, 52)]];
    for (const [k, fill] of layers) {
      const R = t.r * k, pts = 9;
      c.fillStyle = fill;
      c.beginPath();
      for (let i = 0; i < pts * 2; i++) {
        const a = t.rot + (i / (pts * 2)) * Math.PI * 2, rr = i % 2 ? R * 0.68 : R;
        const x = t.x + Math.cos(a) * rr, y = t.y + Math.sin(a) * rr;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.closePath(); c.fill();
    }
  } else {
    c.fillStyle = col(40, 72, 36);
    for (let i = 0; i < 5; i++) {
      const a = t.rot + i * 1.26;
      c.beginPath(); c.arc(t.x + Math.cos(a) * t.r * 0.4, t.y + Math.sin(a) * t.r * 0.4, t.r * 0.62, 0, 7); c.fill();
    }
    c.fillStyle = col(58, 96, 48);
    c.beginPath(); c.arc(t.x - t.r * 0.15, t.y - t.r * 0.15, t.r * 0.45, 0, 7); c.fill();
  }
}
