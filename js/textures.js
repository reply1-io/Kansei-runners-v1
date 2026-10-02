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
// Road surfaces: 'two' lanes (double yellow), 'narrow' mountain road (dashed white centre line),
// 'lane' (single lane, no centre line), 'plain' (bare asphalt, for junction patches).
export const roadTex = (kind = 'two') => tex(kind === 'two' ? 'road' : `road-${kind}`, 32, 64, (g, w, h, rnd) => {
  g.fillStyle = '#56565a'; g.fillRect(0, 0, w, h);
  noiseFill(g, w, h, rnd, ['#4b4b50', '#616166', '#44444a', '#6a6a6e'], 900);
  if (kind === 'two') {
    g.fillStyle = '#e8e8e0'; g.fillRect(1, 0, 1, h); g.fillRect(30, 0, 1, h);        // edge lines
    g.fillStyle = '#e8b830'; g.fillRect(14, 0, 1, h); g.fillRect(17, 0, 1, h);       // double yellow
    for (let y = 0; y < h; y += 7) px(g, 14 + Math.floor(rnd() * 4), y, '#56565a');  // worn paint
  } else if (kind === 'narrow') {
    g.fillStyle = '#d8d8cc'; g.fillRect(1, 0, 1, h); g.fillRect(30, 0, 1, h);
    g.fillRect(15, 0, 2, 26);                                                        // dashed centre line
    for (let y = 0; y < h; y += 5) { px(g, 1, y, '#56565a'); px(g, 30, y + 2, '#56565a'); px(g, 15 + Math.floor(rnd() * 2), Math.floor(rnd() * 26), '#56565a'); }
  } else if (kind === 'plain') {
    // bare asphalt (patches over junction mouths)
  } else {
    g.fillStyle = '#cfcfc4'; g.fillRect(1, 0, 1, h); g.fillRect(30, 0, 1, h);
    for (let y = 0; y < h; y += 4) { px(g, 1, y, '#56565a'); px(g, 30, y + 1, '#56565a'); }
    for (let i = 0; i < 40; i++) px(g, 4 + Math.floor(rnd() * 24), Math.floor(rnd() * h), '#3c3c40'); // patched cracks
  }
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

// EK9 Civic Type R headlight: a wedge of clear lens over two chrome reflectors, the amber indicator at
// the outer end (the texture runs inner -> outer edge, bottom -> top).
export const ek9LampTex = () => tex('ek9-lamp', 32, 12, (g) => {
  g.fillStyle = '#121418'; g.fillRect(0, 0, 32, 12);
  g.fillStyle = '#5d6774'; g.fillRect(1, 1, 30, 10);
  for (const [x, r] of [[7, 4.2], [16, 3.6]]) { g.fillStyle = '#b8c0ca'; g.beginPath(); g.arc(x, 6, r, 0, 7); g.fill(); g.fillStyle = '#fbf8e6'; g.beginPath(); g.arc(x, 6, r - 1.4, 0, 7); g.fill(); }
  g.fillStyle = '#f0a020'; g.fillRect(22, 2, 8, 7);
  g.fillStyle = '#c9d2dc'; g.fillRect(2, 1, 19, 1);
}, { repeat: false });

// ---- Real-car details (fronts, rears, wheels) ----
const lamp = (g, x, y, r, rim = '#9aa0a8', glass = '#fdf8d8') => {
  g.fillStyle = rim; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.fillStyle = glass; g.beginPath(); g.arc(x, y, r - 1, 0, 7); g.fill();
  g.fillStyle = '#ffffff'; g.fillRect(Math.round(x - r / 2), Math.round(y - r / 2), 1, 1);
};
export const roundLampTex = () => tex('lamp-round', 16, 16, (g) => { g.clearRect(0, 0, 16, 16); lamp(g, 8, 8, 7); }, { repeat: false });
export const kidneyTex = () => tex('kidney', 16, 8, (g) => {
  g.fillStyle = '#c9ced6'; g.fillRect(1, 0, 6, 8); g.fillRect(9, 0, 6, 8);
  g.fillStyle = '#15171a'; g.fillRect(2, 1, 4, 6); g.fillRect(10, 1, 4, 6);
  g.fillStyle = '#3c4048'; for (let x = 2; x < 14; x += 2) if (x !== 8) g.fillRect(x, 1, 1, 6);
}, { repeat: false });
export const mercGrilleTex = () => tex('merc-grille', 16, 16, (g) => {
  g.fillStyle = '#e1e5ea'; g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#16181c'; g.fillRect(2, 3, 12, 12);
  g.fillStyle = '#b8bec6'; for (let y = 4; y < 15; y += 2) g.fillRect(2, y, 12, 1);
  g.fillStyle = '#ffffff'; g.fillRect(7, 0, 2, 3); g.fillRect(6, 1, 4, 1);
}, { repeat: false });
export const blackGrilleTex = () => tex('black-grille', 32, 8, (g) => {
  g.fillStyle = '#101113'; g.fillRect(0, 0, 32, 8);
  g.fillStyle = '#2b2e33'; for (let x = 0; x < 32; x += 2) for (let y = (x / 2) % 2; y < 8; y += 2) g.fillRect(x, y, 1, 1);
}, { repeat: false });
export const rectLampTex = () => tex('lamp-rect', 16, 8, (g) => {
  g.fillStyle = '#9aa0a8'; g.fillRect(0, 0, 16, 8); g.fillStyle = '#fdf8d8'; g.fillRect(1, 1, 14, 6);
  g.fillStyle = '#d8d2b0'; for (let x = 2; x < 15; x += 3) g.fillRect(x, 1, 1, 6); g.fillStyle = '#f0a020'; g.fillRect(13, 1, 2, 6);
}, { repeat: false });
export const tailBarTex = () => tex('tail-bar', 32, 6, (g) => {
  g.fillStyle = '#1a0a0a'; g.fillRect(0, 0, 32, 6); g.fillStyle = '#c01818'; g.fillRect(1, 1, 30, 4);
  g.fillStyle = '#ff5a3a'; g.fillRect(2, 2, 11, 1); g.fillRect(19, 2, 11, 1); g.fillStyle = '#e8e8e8'; g.fillRect(13, 1, 6, 4);
}, { repeat: false });
export const roundTailTex = () => tex('tail-round', 16, 16, (g) => { g.clearRect(0, 0, 16, 16); lamp(g, 8, 8, 7, '#2a2a2a', '#c8141a'); g.fillStyle = '#ff6a50'; g.beginPath(); g.arc(8, 8, 3, 0, 7); g.fill(); }, { repeat: false });
export const ribbedTailTex = () => tex('tail-ribbed', 16, 8, (g) => {
  g.fillStyle = '#b8141a'; g.fillRect(0, 0, 16, 8); g.fillStyle = '#f0a020'; g.fillRect(0, 0, 16, 2);
  g.fillStyle = '#e8e8e8'; g.fillRect(0, 4, 16, 1); g.fillStyle = '#7a0d10'; for (let y = 1; y < 8; y += 2) g.fillRect(0, y, 16, 1);
}, { repeat: false });
export const rimStyleTex = (style) => tex(`rim-${style}`, 16, 16, (g) => {
  g.fillStyle = '#141414'; g.fillRect(0, 0, 16, 16);
  g.fillStyle = style === 'mesh' ? '#d4d7dc' : '#c8ccd2'; g.beginPath(); g.arc(8, 8, 6.5, 0, 7); g.fill();
  if (style === 'mesh') { g.fillStyle = '#6c7078'; for (let i = 3; i < 14; i += 2) { g.fillRect(i, 3, 1, 10); g.fillRect(3, i, 10, 1); } }
  if (style === 'holes') { g.fillStyle = '#5d6168'; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillRect(Math.round(8 + Math.cos(a) * 4.5), Math.round(8 + Math.sin(a) * 4.5), 1, 1); } }
  if (style === 'turbine') { g.strokeStyle = '#6d7178'; g.lineWidth = 1; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.moveTo(8, 8); g.lineTo(8 + Math.cos(a + 0.5) * 6, 8 + Math.sin(a + 0.5) * 6); g.stroke(); } }
  if (style === '5spoke') { g.fillStyle = '#4d5158'; for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.6; g.fillRect(Math.round(8 + Math.cos(a) * 4) - 1, Math.round(8 + Math.sin(a) * 4) - 1, 2, 2); } }
  g.fillStyle = '#e8ebef'; g.fillRect(7, 7, 2, 2);
}, { repeat: false });

// License plates: 'us' (white, dark blue characters, red state band) or 'jp' (white, green characters).
export const plateTex = (style) => tex(`plate-${style}`, 32, 16, (g) => {
  g.fillStyle = '#f4f4ee'; g.fillRect(0, 0, 32, 16);
  g.fillStyle = '#555'; g.fillRect(0, 0, 32, 1); g.fillRect(0, 15, 32, 1); g.fillRect(0, 0, 1, 16); g.fillRect(31, 0, 1, 16);
  const ink = style === 'jp' ? '#1f6b3a' : '#1c2a6b';
  if (style === 'us') { g.fillStyle = '#b3231e'; g.fillRect(2, 2, 28, 2); }
  g.fillStyle = ink;
  // Blocky characters.
  const glyphs = style === 'jp' ? [[4, 3, 3, 3], [9, 3, 2, 3], [20, 3, 4, 3], [3, 8, 5, 6], [10, 8, 5, 6], [17, 8, 5, 6], [24, 8, 5, 6]] : [[3, 6, 4, 7], [8, 6, 4, 7], [13, 6, 4, 7], [19, 6, 4, 7], [24, 6, 4, 7]];
  for (const [x, y, w, h] of glyphs) { g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y + Math.floor(h / 2), 1, Math.ceil(h / 2)); }
}, { repeat: false });

// Detailed wheel face: tire sidewall, rim lip, spokes/pattern, center cap, lug nuts.
export const wheelTex = (style) => tex(`wheel-${style}`, 32, 32, (g) => {
  g.clearRect(0, 0, 32, 32);
  g.fillStyle = '#18181a'; g.beginPath(); g.arc(16, 16, 15.5, 0, 7); g.fill();
  g.fillStyle = '#2a2a2e'; g.beginPath(); g.arc(16, 16, 14, 0, 7); g.fill();          // sidewall
  g.fillStyle = '#1c1c1f'; g.beginPath(); g.arc(16, 16, 12, 0, 7); g.fill();
  const face = style === 'mesh' ? '#d6d9de' : '#c8ccd2', dark = style === 'mesh' ? '#5d626a' : '#4a4e56';
  g.fillStyle = '#e6e9ee'; g.beginPath(); g.arc(16, 16, 11, 0, 7); g.fill();          // polished lip
  g.fillStyle = dark; g.beginPath(); g.arc(16, 16, 10, 0, 7); g.fill();
  g.fillStyle = face;
  if (style === 'mesh') {
    g.beginPath(); g.arc(16, 16, 10, 0, 7); g.fill();
    g.strokeStyle = dark; g.lineWidth = 1;
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.beginPath(); g.moveTo(16 + Math.cos(a) * 3, 16 + Math.sin(a) * 3); g.lineTo(16 + Math.cos(a + 0.6) * 10, 16 + Math.sin(a + 0.6) * 10); g.stroke(); g.beginPath(); g.moveTo(16 + Math.cos(a) * 3, 16 + Math.sin(a) * 3); g.lineTo(16 + Math.cos(a - 0.6) * 10, 16 + Math.sin(a - 0.6) * 10); g.stroke(); }
  } else if (style === 'holes') {
    g.beginPath(); g.arc(16, 16, 10, 0, 7); g.fill();
    g.fillStyle = dark; for (let i = 0; i < 15; i++) { const a = (i / 15) * Math.PI * 2; g.beginPath(); g.arc(16 + Math.cos(a) * 7.5, 16 + Math.sin(a) * 7.5, 1.3, 0, 7); g.fill(); }
  } else if (style === 'speedline') {
    // 3-piece split rim: wide polished lip, ten thin spokes, the red brake caliper showing through.
    g.fillStyle = '#c01818'; g.beginPath(); g.arc(16, 16, 8.5, -1.2, -0.2); g.arc(16, 16, 5, -0.2, -1.2, true); g.fill();
    g.fillStyle = face;
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.save(); g.translate(16, 16); g.rotate(a); g.fillRect(2.5, -0.7, 8, 1.4); g.restore(); }
    g.strokeStyle = '#eef1f4'; g.lineWidth = 2; g.beginPath(); g.arc(16, 16, 10, 0, 7); g.stroke();
  } else if (style === 'turbine') {
    g.beginPath(); g.arc(16, 16, 10, 0, 7); g.fill();
    g.fillStyle = dark; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.beginPath(); g.moveTo(16 + Math.cos(a) * 4, 16 + Math.sin(a) * 4); g.lineTo(16 + Math.cos(a + 0.35) * 9.5, 16 + Math.sin(a + 0.35) * 9.5); g.lineTo(16 + Math.cos(a + 0.5) * 9.5, 16 + Math.sin(a + 0.5) * 9.5); g.closePath(); g.fill(); }
  } else {
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; g.save(); g.translate(16, 16); g.rotate(a); g.fillRect(2, -1.6, 8.5, 3.2); g.restore(); }
  }
  g.fillStyle = '#9aa0a8'; g.beginPath(); g.arc(16, 16, 3, 0, 7); g.fill();
  g.fillStyle = '#2b2e33'; for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; g.fillRect(Math.round(16 + Math.cos(a) * 4.3) - 1, Math.round(16 + Math.sin(a) * 4.3) - 1, 2, 2); }
  g.fillStyle = '#e8ebef'; g.fillRect(15, 15, 2, 2);
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

// Falling water: bright vertical streaks over blue-white, scrolled downwards every frame.
export const waterfallTex = () => tex('waterfall', 16, 32, (g, w, h, rnd) => {
  g.fillStyle = '#9fc6dc'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = ['#e8f4fb', '#ffffff', '#7fb0cc', '#c9e3f1'][Math.floor(rnd() * 4)];
    g.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h), 1, 2 + Math.floor(rnd() * 6));
  }
});
