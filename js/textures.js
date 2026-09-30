// Small pixel-art textures drawn in code, sampled with hard (nearest) filtering like on the PS1.
import * as THREE from '../lib/three.module.min.js';
import { seeded } from './draw.js';

const cache = new Map();

function tex(key, w, h, draw, { repeat = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g, w, h, seeded(key.length * 977 + w * 13 + h));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  // Hard texels up close; nearest-mip in the distance so far textures don't sparkle.
  t.minFilter = THREE.NearestMipmapNearestFilter;
  t.generateMipmaps = true;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  cache.set(key, t);
  return t;
}

const px = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
const noiseFill = (g, w, h, rnd, colors, n) => { for (let i = 0; i < n; i++) px(g, Math.floor(rnd() * w), Math.floor(rnd() * h), colors[Math.floor(rnd() * colors.length)]); };

// Road: u runs across the road (0..1 = edge to edge), v along it.
export const roadTex = () => tex('road', 32, 64, (g, w, h, rnd) => {
  g.fillStyle = '#56565a'; g.fillRect(0, 0, w, h);
  noiseFill(g, w, h, rnd, ['#4b4b50', '#616166', '#44444a', '#6a6a6e'], 900);
  g.fillStyle = '#e8e8e0'; g.fillRect(1, 0, 1, h); g.fillRect(30, 0, 1, h);        // edge lines
  g.fillStyle = '#e8b830'; g.fillRect(14, 0, 1, h); g.fillRect(17, 0, 1, h);       // double yellow
  for (let y = 0; y < h; y += 7) px(g, 14 + Math.floor(rnd() * 4), y, '#56565a');  // worn paint
});

export const shoulderTex = () => tex('shoulder', 32, 32, (g, w, h, rnd) => {
  g.fillStyle = '#7a6a52'; g.fillRect(0, 0, w, h);
  noiseFill(g, w, h, rnd, ['#6a5a44', '#8a7a60', '#5d503d', '#948468'], 500);
});

export const grassTex = () => tex('grass', 64, 64, (g, w, h, rnd) => {
  g.fillStyle = '#4f7a34'; g.fillRect(0, 0, w, h);
  noiseFill(g, w, h, rnd, ['#46702e', '#5a8a3a', '#3e6428', '#66943f', '#557f35'], 2400);
  for (let i = 0; i < 70; i++) { const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h); g.fillStyle = '#3a5c26'; g.fillRect(x, y, 1, 2); }
});

export const rockTex = () => tex('rock', 64, 64, (g, w, h, rnd) => {
  g.fillStyle = '#7d7a72'; g.fillRect(0, 0, w, h);
  noiseFill(g, w, h, rnd, ['#6e6b64', '#8c8980', '#65625b', '#969388'], 2000);
  g.strokeStyle = '#4f4c46';
  for (let i = 0; i < 14; i++) { g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 14; y += rnd() * 8; g.lineTo(x, y); } g.stroke(); }
});

export const railTex = () => tex('rail', 16, 16, (g, w, h) => {
  g.fillStyle = '#b8bcc4'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e4e7ec'; g.fillRect(0, 3, w, 2);
  g.fillStyle = '#8a8e96'; g.fillRect(0, 8, w, 2);
  g.fillStyle = '#e4e7ec'; g.fillRect(0, 11, w, 1);
  g.fillStyle = '#6a6e76'; g.fillRect(0, 14, w, 2);
  g.fillStyle = '#555'; g.fillRect(7, 6, 2, 2);
});

// Pine tree sprite with transparent background (used on crossed billboards).
export const treeTex = (variant = 0) => tex(`tree${variant}`, 32, 64, (g, w, h, rnd) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#4a3222'; g.fillRect(14, 54, 4, 10);
  const greens = variant ? ['#1f4a2a', '#2a5c33', '#357040', '#1a3f24'] : ['#27502c', '#316236', '#3d7442', '#203f25'];
  for (let tier = 0; tier < 5; tier++) {
    const top = 2 + tier * 10, bottom = top + 18, half = 4 + tier * 2.6;
    for (let y = top; y < Math.min(bottom, 57); y++) {
      const k = (y - top) / (bottom - top), wid = half * k + 1;
      for (let x = Math.floor(16 - wid); x < Math.ceil(16 + wid); x++) {
        const shade = x < 16 ? 2 : x > 18 ? 0 : 1;
        px(g, x, y, rnd() < 0.18 ? greens[3] : greens[shade]);
      }
    }
  }
}, { repeat: false });

// Pine seen from above: a round, layered star shape (so trees don't look like X's from overhead).
export const treeTopTex = () => tex('treetop', 32, 32, (g, w, h, rnd) => {
  g.clearRect(0, 0, w, h);
  const layers = [[15, '#1f4526'], [11, '#2b5a31'], [7, '#377040'], [3, '#46844d']];
  for (const [R, col] of layers) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x - 15.5, dy = y - 15.5, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
      const edge = R * (0.8 + 0.2 * Math.cos(a * 9));
      if (r < edge) px(g, x, y, rnd() < 0.15 ? '#1a3a20' : col);
    }
  }
}, { repeat: false });

export const logTex = () => tex('logs', 32, 32, (g, w, h, rnd) => {
  for (let y = 0; y < h; y += 4) {
    g.fillStyle = y % 8 ? '#7a5234' : '#6b4629'; g.fillRect(0, y, w, 4);
    g.fillStyle = '#4a2f1b'; g.fillRect(0, y + 3, w, 1);
    g.fillStyle = '#916443'; g.fillRect(0, y, w, 1);
  }
  noiseFill(g, w, h, rnd, ['#5e3d24', '#8a5e3c'], 120);
});

export const roofTex = () => tex('roof', 32, 32, (g, w, h, rnd) => {
  g.fillStyle = '#8a3c2c'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 4) { g.fillStyle = '#6d2e21'; g.fillRect(x, 0, 1, h); g.fillStyle = '#a24b38'; g.fillRect(x + 1, 0, 1, h); }
  noiseFill(g, w, h, rnd, ['#7a3526', '#94432f'], 80);
});

export const canvasTex = () => tex('canvas', 16, 16, (g, w, h, rnd) => {
  g.fillStyle = '#c9bc98'; g.fillRect(0, 0, w, h);
  noiseFill(g, w, h, rnd, ['#bcaf8b', '#d4c8a6'], 60);
});

export const gravelTex = () => tex('gravel', 32, 32, (g, w, h, rnd) => {
  g.fillStyle = '#8e8676'; g.fillRect(0, 0, w, h);
  noiseFill(g, w, h, rnd, ['#7a7263', '#a39b8a', '#6c6558', '#b3ab99'], 600);
});

// Painted sky panorama: gradient, clouds, distant blue mountain ranges and a dark treeline.
export const skyTex = () => tex('sky', 512, 128, (g, w, h, rnd) => {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#2f5fbf'); grad.addColorStop(0.55, '#7fa8de'); grad.addColorStop(0.8, '#cfe0f0'); grad.addColorStop(1, '#dfe8ee');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 22; i++) {
    const cx = rnd() * w, cy = 12 + rnd() * 45, n = 4 + Math.floor(rnd() * 5);
    for (let k = 0; k < n; k++) { g.fillStyle = k % 2 ? '#f4f7fb' : '#e2eaf4'; g.beginPath(); g.ellipse(cx + (rnd() - 0.5) * 30, cy + (rnd() - 0.5) * 5, 8 + rnd() * 12, 3 + rnd() * 4, 0, 0, 7); g.fill(); }
  }
  const ridge = (base, amp, color, step, seedOff) => {
    g.fillStyle = color; g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += step) {
      const t = (x / w) * Math.PI * 2;
      const y = base - amp * (0.55 + 0.45 * Math.sin(t * 3 + seedOff) * Math.cos(t * 5 + seedOff * 2)) - rnd() * amp * 0.25;
      g.lineTo(x, y);
    }
    g.lineTo(w, h); g.closePath(); g.fill();
  };
  ridge(98, 40, '#8ea3c0', 4, 0.3);
  ridge(106, 30, '#6f86a5', 3, 1.7);
  // Snow caps on the farthest range.
  ridge(112, 18, '#4f6582', 3, 2.9);
  // Dark forest treeline.
  g.fillStyle = '#2c4a2e';
  for (let x = 0; x < w; x += 2) { const hh = 6 + rnd() * 8 + (x % 6 === 0 ? 4 : 0); g.fillRect(x, h - 12 - hh, 2, hh + 12); }
});

// Car details.
export const headlightTex = () => tex('headlight', 8, 4, (g) => { g.fillStyle = '#fffbe0'; g.fillRect(0, 0, 8, 4); g.fillStyle = '#c9c4a0'; g.fillRect(0, 3, 8, 1); g.fillStyle = '#ffffff'; g.fillRect(1, 1, 3, 1); }, { repeat: false });
export const taillightTex = () => tex('taillight', 8, 4, (g) => { g.fillStyle = '#c01818'; g.fillRect(0, 0, 8, 4); g.fillStyle = '#ff5a3a'; g.fillRect(1, 1, 6, 1); g.fillStyle = '#f0a020'; g.fillRect(6, 0, 2, 4); }, { repeat: false });
export const grilleTex = () => tex('grille', 16, 4, (g) => { g.fillStyle = '#18181a'; g.fillRect(0, 0, 16, 4); g.fillStyle = '#3a3a40'; for (let x = 0; x < 16; x += 2) g.fillRect(x, 0, 1, 4); }, { repeat: false });
export const rimTex = () => tex('rim', 16, 16, (g) => {
  g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#c8ccd2'; g.beginPath(); g.arc(8, 8, 6, 0, 7); g.fill();
  g.fillStyle = '#6d7178';
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.fillRect(Math.round(8 + Math.cos(a) * 3.5) - 1, Math.round(8 + Math.sin(a) * 3.5) - 1, 2, 2); }
  g.fillStyle = '#e8ebef'; g.fillRect(7, 7, 2, 2);
}, { repeat: false });

// Environment map for glossy paint: sky above, horizon haze, ground below.
let env = null;
export function envCube() {
  if (env) return env;
  const face = (top, mid, bottom) => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 32);
    grad.addColorStop(0, top); grad.addColorStop(0.5, mid); grad.addColorStop(1, bottom);
    g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
    return c;
  };
  const side = face('#6f9ad8', '#e6eef6', '#4a5a3a');
  const imgs = [side, side, face('#5b86cc', '#6f9ad8', '#8fb2e2'), face('#3a4a2c', '#3a4a2c', '#3a4a2c'), side, side];
  env = new THREE.CubeTexture(imgs);
  env.colorSpace = THREE.SRGBColorSpace;
  env.needsUpdate = true;
  return env;
}
