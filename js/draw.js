// Shared canvas drawing helpers (used by the home map and the race).

export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Top-down car. Heading h is in radians, 0 = pointing along +x.
export function drawCar(ctx, x, y, h, color, { len = 38, wid = 19, braking = false, headlights = false } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(h);
  if (headlights) {
    const g = ctx.createRadialGradient(len * 0.5, 0, 2, len * 0.5 + len, 0, len * 1.2);
    g.addColorStop(0, 'rgba(255,240,190,0.35)');
    g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(len / 2, -wid * 0.3);
    ctx.lineTo(len * 2.1, -wid * 1.3);
    ctx.lineTo(len * 2.1, wid * 1.3);
    ctx.lineTo(len / 2, wid * 0.3);
    ctx.fill();
  }
  const k = len / 38; // detail scale
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-len / 2 + 3 * k, -wid / 2 + 3 * k, len, wid);
  ctx.fillStyle = color;
  roundRectPath(ctx, -len / 2, -wid / 2, len, wid, 5 * k);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,45,0.85)'; // windshield + rear glass
  ctx.fillRect(2 * k, -wid / 2 + 3 * k, 8 * k, wid - 6 * k);
  ctx.fillRect(-13 * k, -wid / 2 + 3 * k, 5 * k, wid - 6 * k);
  ctx.fillStyle = '#fff7c2';
  ctx.fillRect(len / 2 - 3 * k, -wid / 2 + 2 * k, 3 * k, 4 * k);
  ctx.fillRect(len / 2 - 3 * k, wid / 2 - 6 * k, 3 * k, 4 * k);
  ctx.fillStyle = braking ? '#ff2020' : '#8a1010';
  ctx.fillRect(-len / 2, -wid / 2 + 2 * k, 2 * k, 4 * k);
  ctx.fillRect(-len / 2, wid / 2 - 6 * k, 2 * k, 4 * k);
  ctx.restore();
}

// Small seeded RNG so procedural scenery is identical every visit.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Catmull-Rom through control points, sampled every `step` units. Open path (not a loop).
export function smoothPath(points, step = 8) {
  const pts = [points[0], ...points, points[points.length - 1]];
  const out = [];
  for (let i = 1; i < pts.length - 2; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let s = 0; s < n; s++) {
      const t = s / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]) });
    }
  }
  out.push({ x: points[points.length - 1][0], y: points[points.length - 1][1] });
  let d = 0;
  for (let i = 0; i < out.length; i++) {
    const a = out[i], b = out[Math.min(i + 1, out.length - 1)], prev = out[Math.max(i - 1, 0)];
    const dx = b.x - prev.x, dy = b.y - prev.y, len = Math.hypot(dx, dy) || 1;
    a.tx = dx / len; a.ty = dy / len; a.nx = -a.ty; a.ny = a.tx;
    if (i > 0) d += Math.hypot(a.x - out[i - 1].x, a.y - out[i - 1].y);
    a.d = d;
  }
  return out;
}
