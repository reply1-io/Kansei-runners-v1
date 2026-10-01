// PlayStation-era look (think Gran Turismo 2):
//  - the scene renders into a low-resolution buffer that's scaled up with hard, chunky pixels
//  - 15-bit color with ordered (Bayer) dithering
//  - vertices snap to the low-res pixel grid (the famous PS1 wobble)
//  - affine texture mapping (textures warp slightly across big polygons)
// One renderer and one full-screen canvas are shared by the home view and driving.
import * as THREE from '../lib/three.module.min.js';

const SNAP = { value: new THREE.Vector2(160, 120) };

// Patch three.js shader chunks once, before any material compiles.
function installPsxShaders() {
  const C = THREE.ShaderChunk;
  C.common += '\nuniform vec2 psxSnap;\n';
  C.uv_pars_vertex += '\n#ifdef USE_MAP\n\tvarying vec3 vMapAffine;\n#endif\n';
  C.uv_pars_fragment += '\n#ifdef USE_MAP\n\tvarying vec3 vMapAffine;\n#endif\n';
  C.project_vertex += `
  // PS1: snap to the low-res pixel grid.
  gl_Position.xy = floor( gl_Position.xy / gl_Position.w * psxSnap + 0.5 ) / psxSnap * gl_Position.w;
  #ifdef USE_MAP
    // PS1: affine (non perspective-correct) texture coordinates.
    vMapAffine = vec3( vMapUv * gl_Position.w, gl_Position.w );
  #endif
  `;
  C.map_fragment = C.map_fragment.replace('texture2D( map, vMapUv )', 'texture2D( map, vMapAffine.xy / vMapAffine.z )');
  // Every material gets the snap uniform.
  THREE.Material.prototype.onBeforeCompile = function (shader) { shader.uniforms.psxSnap = SNAP; };
}

const POST_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }';
// Post: PS1 15-bit colour with dithering, then a Sony VX1000 / VHS camcorder look (VHS = 1):
// slight fisheye bulge, red/blue fringing, colour bleeding sideways (VHS chroma is low-res), line
// wobble and a slow tracking band rolling up the picture, tape grain and a warm camcorder grade.
// Scanlines and the vignette are a page overlay (see #vhs in the CSS) so they cover the menus too.
const POST_FRAG = `
  uniform sampler2D tDiffuse;
  uniform vec2 res;
  uniform float time;
  uniform float vhs;
  varying vec2 vUv;
  float bayer4( vec2 p ) {
    int x = int( mod( p.x, 4.0 ) ), y = int( mod( p.y, 4.0 ) );
    int i = x + y * 4;
    int m[16] = int[16]( 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 );
    return float( m[i] ) / 16.0 - 0.5;
  }
  float hash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
  vec3 tex( vec2 uv ) { return linearToOutputTexel( texture2D( tDiffuse, clamp( uv, 0.0, 1.0 ) ) ).rgb; }
  void main() {
    vec2 uv = vUv;
    if ( vhs > 0.5 ) {
      // Lens: a gentle fisheye bulge, like a VX1000 with a wide-angle adapter.
      vec2 d = uv - 0.5;
      uv = 0.5 + d * ( 1.0 - 0.07 * dot( d, d ) * 4.0 ) * 0.985;
      // Tape: every line wobbles a little; a tracking band rolls slowly up the frame.
      float line = floor( uv.y * 240.0 );
      float wob = ( hash( vec2( line, floor( time * 30.0 ) ) ) - 0.5 ) * 0.0016;
      float band = fract( time * 0.07 );
      float inBand = smoothstep( 0.03, 0.0, abs( uv.y - band ) );
      wob += inBand * ( hash( vec2( line, time ) ) - 0.5 ) * 0.02;
      uv.x += wob;
    }
    vec3 c;
    if ( vhs > 0.5 ) {
      // Red/blue fringing plus sideways colour bleed (luma stays sharp, chroma smears).
      vec3 base = tex( uv );
      float r = tex( uv + vec2( 0.0035, 0.0 ) ).r, b = tex( uv - vec2( 0.0035, 0.0 ) ).b;
      vec3 blur = ( tex( uv - vec2( 0.006, 0.0 ) ) + base + tex( uv + vec2( 0.006, 0.0 ) ) ) / 3.0;
      float y = dot( base, vec3( 0.299, 0.587, 0.114 ) );
      vec3 chroma = vec3( r, blur.g, b ) - dot( vec3( r, blur.g, b ), vec3( 0.299, 0.587, 0.114 ) );
      c = y + chroma * 0.9;
      // Camcorder grade: a touch warm, lifted blacks, soft highlights.
      c = c * vec3( 1.04, 1.0, 0.94 ) * 0.94 + 0.035;
    } else c = tex( uv );
    // 15-bit color (32 levels per channel) with ordered dithering.
    vec2 px = floor( vUv * res );
    c = floor( c * 31.0 + 0.5 + bayer4( px ) * 0.9 ) / 31.0;
    if ( vhs > 0.5 ) {
      c += ( hash( gl_FragCoord.xy + fract( time ) * 100.0 ) - 0.5 ) * 0.07; // tape grain
      float band = fract( time * 0.07 );
      c += smoothstep( 0.012, 0.0, abs( vUv.y - band ) ) * 0.12;              // bright tracking line
    }
    gl_FragColor = vec4( c, 1.0 );
  }
`;

// VHS / VX1000 look on (default). Flip off with setVhs(false).
const VHS = { value: 1 };
const TIME = { value: 0 };
export const setVhs = (on) => { VHS.value = on ? 1 : 0; };

let installed = false;
let retro = null;

// The main full-screen view (home + driving) shares one instance.
export function getRetro(canvas) {
  if (!retro) retro = createRetro(canvas);
  return retro;
}

// A PS1-style renderer on any canvas. `lines` is roughly how many "PlayStation" lines tall the image is.
export function createRetro(canvas, { lines = 330, alpha = false, minPx = 2 } = {}) {
  if (!installed) { installPsxShaders(); installed = true; }
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  const rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
  const postMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: rt.texture }, res: { value: new THREE.Vector2(4, 4) }, time: TIME, vhs: VHS },
    vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false, toneMapped: false,
  });
  const postScene = new THREE.Scene();
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let cssW = 0, cssH = 0;

  const self = {
    renderer, canvas,
    width: 1, height: 1, aspect: 1, // low-res buffer size
    // Size the low-res buffer so the image is roughly `lines` "PlayStation" lines: chunky but readable.
    resize() {
      const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
      if (w === cssW && h === cssH) return false;
      cssW = w; cssH = h;
      renderer.setSize(w, h, false);
      const px = Math.max(minPx, Math.min(4, Math.round(Math.max(w, h * 0.75) / lines)));
      self.width = Math.ceil(w / px); self.height = Math.ceil(h / px);
      rt.setSize(self.width, self.height);
      postMat.uniforms.res.value.set(self.width, self.height);
      self.aspect = w / h;
      return true;
    },
    render(scene, camera) {
      self.resize();
      SNAP.value.set(self.width / 2, self.height / 2);
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      TIME.value = (performance.now() / 1000) % 1000;
      renderer.render(postScene, postCam);
    },
    dispose() { rt.dispose(); postMat.dispose(); renderer.dispose(); renderer.forceContextLoss(); },
  };
  return self;
}
