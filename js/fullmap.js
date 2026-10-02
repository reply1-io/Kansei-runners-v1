// The full map: tap the minimap while driving to open it (the game pauses). Every road on the map with
// its name, the lakes and ponds, the cabin, the rock wall round the ring, you (an arrow pointing the
// way you face) and any rivals. Drag to pan, pinch / mouse wheel / + − to zoom, ⌖ to centre on you,
// ⤢ to see everything again. On a tall screen the map turns sideways so the long map fills it.
import { ALL_ROADS, COURSES, ROAD, RING } from './road.js';

// One colour per race course; everything else (side roads, links) is grey.
const COURSE_COLORS = { pass: '#ff9f43', ladder: '#feca57', canyon: '#ff6b6b', yamabiko: '#48dbfb', kagami: '#ff7ab8', tengu: '#a29bfe', hayate: '#1dd1a1' };
const FONT = '"Exo 2", "Arial Black", Arial, sans-serif';

export function openFullMap({ player, rivals = [], route = null, routeRoad = null, ponds = [] }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'fullmap';
    el.innerHTML = `<canvas></canvas>
      <div class="fm-top"><b>MAP</b><span>${route ? 'Race paused' : 'Paused'}</span><button class="hud-exit" data-fm="close">✕ Close</button></div>
      <div class="fm-zoom"><button class="hud-exit" data-fm="in">＋</button><button class="hud-exit" data-fm="out">－</button><button class="hud-exit" data-fm="me">⌖</button><button class="hud-exit" data-fm="fit">⤢</button></div>
      <div class="fm-legend"><span><i style="background:#fff"></i>You</span>${rivals.length ? '<span><i style="background:#ff4d4d"></i>Rivals</span>' : ''}${route ? '<span><i style="background:#ffd32a"></i>Your race</span>' : ''}<span><i style="background:#3d7fb8"></i>Water</span></div>`;
    document.body.appendChild(el);
    const cv = el.querySelector('canvas'), ctx = cv.getContext('2d');

    // Map bounds: every road, plus room for the wall outside the ring.
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const r of ALL_ROADS) { x0 = Math.min(x0, r.bbox.x0); x1 = Math.max(x1, r.bbox.x1); z0 = Math.min(z0, r.bbox.z0); z1 = Math.max(z1, r.bbox.z1); }
    x0 -= 90; x1 += 90; z0 -= 90; z1 += 90;
    let W = 0, H = 0, dpr = 1, rot = false, scale = 1, minScale = 1, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    // World -> screen (CSS px) and back. Sideways (`rot`): the map is turned 90° clockwise.
    const toScreen = (x, z) => { const dx = (x - cx) * scale, dz = (z - cz) * scale; return rot ? [W / 2 - dz, H / 2 + dx] : [W / 2 + dx, H / 2 + dz]; };
    const panBy = (du, dv) => { if (rot) { cz += du / scale; cx -= dv / scale; } else { cx -= du / scale; cz -= dv / scale; } clampView(); };
    const fit = () => {
      const mw = x1 - x0, mh = z1 - z0;
      scale = minScale = Math.min((rot ? W : W) / (rot ? mh : mw), (rot ? H : H) / (rot ? mw : mh)) * 0.94;
      cx = (x0 + x1) / 2; cz = (z0 + z1) / 2;
    };
    const clampView = () => { cx = Math.max(x0, Math.min(x1, cx)); cz = Math.max(z0, Math.min(z1, cz)); };
    const zoomAt = (f, u = W / 2, v = H / 2) => {
      const ns = Math.max(minScale, Math.min(minScale * 40, scale * f));
      // Keep the point under (u, v) where it is.
      const du = u - W / 2, dv = v - H / 2;
      panBy(du, dv); scale = ns; panBy(-du, -dv);
      draw();
    };

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      rot = H > W * 1.1;
      fit(); draw();
    }

    function line(pts, width, color, step = 3) {
      ctx.lineWidth = width; ctx.strokeStyle = color;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += step) { const [u, v] = toScreen(pts[i].x, pts[i].z); if (i) ctx.lineTo(u, v); else ctx.moveTo(u, v); }
      const [u, v] = toScreen(pts[pts.length - 1].x, pts[pts.length - 1].z); ctx.lineTo(u, v);
      ctx.stroke();
    }
    function label(text, x, z, color, size = 12, dy = 0) {
      const [u, v0] = toScreen(x, z), v = v0 + dy;
      ctx.font = `italic 800 ${size}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(5,11,34,0.95)'; ctx.strokeText(text, u, v);
      ctx.fillStyle = color; ctx.fillText(text, u, v);
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0d1a14'; ctx.fillRect(0, 0, W, H);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const zoom = scale / minScale, rw = Math.max(1.5, Math.min(6, 1.4 * Math.sqrt(zoom)));
      // Inside the ring: forest green. The wall: a thick rocky band just outside it.
      const R = RING.samples;
      ctx.beginPath();
      for (let i = 0; i < R.length; i += 6) { const [u, v] = toScreen(R[i].x, R[i].z); if (i) ctx.lineTo(u, v); else ctx.moveTo(u, v); }
      ctx.closePath(); ctx.fillStyle = '#16301f'; ctx.fill();
      ctx.lineWidth = Math.max(6, 90 * scale); ctx.strokeStyle = '#4b4238'; ctx.stroke();
      // Water.
      ctx.fillStyle = '#3d7fb8';
      for (const p of ponds) { const [u, v] = toScreen(p.x, p.z); ctx.beginPath(); ctx.arc(u, v, Math.max(1.5, (p.r + 3) * scale), 0, 7); ctx.fill(); }
      // Roads: side roads and links, then the ring, the courses and the home loop on top.
      const courseIds = new Set(Object.keys(COURSES));
      for (const r of ALL_ROADS) if (!courseIds.has(r.id) && r !== RING && r !== ROAD) { line(r.samples, rw + 2, '#05080f'); line(r.samples, rw, '#b9c0cc'); }
      line([...R, R[0]], rw + 3, '#05080f'); line([...R, R[0]], rw + 1, '#e6e1d3');
      for (const id of courseIds) { const r = COURSES[id].road; line(r.samples, rw + 2, '#05080f'); line(r.samples, rw, COURSE_COLORS[id] || '#fff'); }
      line([...ROAD.samples, ROAD.samples[0]], rw + 2, '#05080f'); line([...ROAD.samples, ROAD.samples[0]], rw, '#ffffff');
      if (route && routeRoad) {
        const pts = [];
        for (let s = route.from; s <= route.to; s += 6) pts.push(routeRoad.sampleAtS(s));
        line(pts, rw + 3, '#ffd32a', 1);
        const st = routeRoad.sampleAtS(route.from), fn = routeRoad.sampleAtS(route.to);
        for (const [q, c] of [[st, '#ffffff'], [fn, '#2ecc71']]) { const [u, v] = toScreen(q.x, q.z); ctx.fillStyle = c; ctx.strokeStyle = '#05080f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(u, v, 5, 0, 7); ctx.fill(); ctx.stroke(); }
      }
      // Names: each course at its middle, the ring and the home loop.
      const big = zoom > 2.2 ? 14 : 12;
      for (const id of courseIds) { const r = COURSES[id].road, q = r.sampleAtS(r.length / 2); label(COURSES[id].name, q.x, q.z, COURSE_COLORS[id] || '#fff', big); }
      { const q = RING.sampleAtS(RING.length * 0.62); label('Ring Road', q.x, q.z, '#e6e1d3', big); }
      if (zoom > 2.2) for (const r of ALL_ROADS) if (!courseIds.has(r.id) && r !== RING && r !== ROAD && r.name) { const q = r.sampleAtS(r.length / 2); label(r.name, q.x, q.z, '#b9c0cc', 11); }
      const home = ROAD.sampleAtS(ROAD.homeS);
      label('🏠 Cabin', home.x, home.z, '#fff', big, -14);
      // Rivals, then you: an arrow pointing the way you're facing.
      for (const r of rivals) { const [u, v] = toScreen(r.x, r.z); ctx.fillStyle = '#ff4d4d'; ctx.strokeStyle = '#05080f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(u, v, 4.5, 0, 7); ctx.fill(); ctx.stroke(); }
      const [pu, pv] = toScreen(player.x, player.z);
      const a = player.h + (rot ? Math.PI / 2 : 0);
      ctx.save(); ctx.translate(pu, pv); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, 7); ctx.lineTo(-3, 0); ctx.lineTo(-7, -7); ctx.closePath();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#05080f'; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
      ctx.restore();
      // A soft ring round you so you can find yourself on the whole map.
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pu, pv, 16, 0, 7); ctx.stroke();
    }

    // Pan with one finger / the mouse, pinch with two.
    const pts = new Map();
    let pinch = 0;
    const onDown = (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const [p, q] = [...pts.values()]; pinch = Math.hypot(p.x - q.x, p.y - q.y); } };
    const onMove = (e) => {
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      if (pts.size === 1) { panBy(cur.x - prev.x, cur.y - prev.y); pts.set(e.pointerId, cur); draw(); return; }
      pts.set(e.pointerId, cur);
      const [p, q] = [...pts.values()], d = Math.hypot(p.x - q.x, p.y - q.y), r = cv.getBoundingClientRect();
      if (pinch > 0) zoomAt(d / pinch, (p.x + q.x) / 2 - r.left, (p.y + q.y) / 2 - r.top);
      pinch = d;
    };
    const onUp = (e) => { pts.delete(e.pointerId); pinch = 0; };
    const onWheel = (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - r.left, e.clientY - r.top); };
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('wheel', onWheel, { passive: false });
    const close = () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey, true);
      el.remove();
      resolve();
    };
    const onKey = (e) => { if (e.key === 'Escape' || e.key.toLowerCase() === 'm') { e.stopImmediatePropagation(); close(); } };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fm]');
      if (!b) return;
      const k = b.dataset.fm;
      if (k === 'close') close();
      else if (k === 'in') zoomAt(1.6);
      else if (k === 'out') zoomAt(1 / 1.6);
      else if (k === 'fit') { fit(); draw(); }
      else if (k === 'me') { cx = player.x; cz = player.z; scale = Math.max(scale, minScale * 6); draw(); }
    });
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKey, true);
    requestAnimationFrame(resize);
  });
}
