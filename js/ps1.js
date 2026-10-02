// PlayStation-era look (think Gran Turismo 2):
//  - the scene renders into a low-resolution buffer that's scaled up with hard, chunky pixels
//  - 15-bit color with ordered (Bayer) dithering
//  - vertices snap to the low-res pixel grid (the famous PS1 wobble)
//  - affine texture mapping (textures warp slightly across big polygons)
// One renderer and one full-screen canvas are shared by the home view and driving.
import * as THREE from '../lib/three.module.min.js';

const SNAP = { value: new THREE.Vector2(160, 120) };
// How much of the affine warp to use (1 = full PS1; 0 = perspective-correct, used from the cockpit,
// where the road is close and big polygons made the lines zigzag).
const AFFINE = { value: 1 };
export const setAffine = (v) => { AFFINE.value = v; };

// Patch three.js shader chunks once, before any material compiles.
function installPsxShaders() {
  const C = THREE.ShaderChunk;
  C.common += '\nuniform vec2 psxSnap;\nuniform float psxAffine;\nuniform float psxAffineMat;\n';
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
  // (Sprites never write vMapAffine, so they keep plain UVs.)
  C.map_fragment = C.map_fragment.replace('texture2D( map, vMapUv )', 'texture2D( map, vMapAffine.z > 0.0 ? mix( vMapUv, vMapAffine.xy / vMapAffine.z, psxAffine * psxAffineMat ) : vMapUv )');
  // Every material gets the snap uniform.
  // (A material can tone its own warp down with userData.affine, e.g. road markings.)
  THREE.Material.prototype.onBeforeCompile = function (shader) {
    shader.uniforms.psxSnap = SNAP; shader.uniforms.psxAffine = AFFINE;
    shader.uniforms.psxAffineMat = { value: this.userData.affine ?? 1 };
  };
  THREE.Material.prototype.customProgramCacheKey = function () { return `affine${this.userData.affine ?? 1}`; };
}

// The vertex stage also works out how much of the sun is actually in view (sampling the image round
// where the sun should be: trees, hills and the wall all cut it), once per vertex rather than per pixel.
const POST_VERT = `
  uniform sampler2D tDiffuse;
  uniform vec2 res;
  uniform vec2 sunUV;
  uniform float sunOn;
  varying vec2 vUv;
  varying float vSun;
  void main() {
    vUv = uv;
    float v = 0.0;
    if ( sunOn > 0.5 ) {
      for ( int i = -2; i <= 2; i++ ) for ( int j = -2; j <= 2; j++ ) {
        vec2 q = sunUV + vec2( float( i ), float( j ) ) * 1.2 / res;
        if ( q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0 ) continue;
        vec3 s = texture2D( tDiffuse, q ).rgb;
        v += smoothstep( 0.8, 0.96, min( s.r, min( s.g, s.b ) ) );
      }
    }
    vSun = v / 25.0;
    gl_Position = vec4( position.xy, 0.0, 1.0 );
  }`;
// Post: PS1 15-bit colour with dithering, then a Sony VX1000 / VHS camcorder look (VHS = 1):
// slight fisheye bulge, red/blue fringing, colour bleeding sideways (VHS chroma is low-res), fixed
// tape grain and a warm camcorder grade. Nothing in it moves.
// Scanlines and the vignette are a page overlay (see #vhs in the CSS) so they cover the menus too.
const POST_FRAG = `
  uniform sampler2D tDiffuse;
  uniform vec2 res;
  uniform float time;
  uniform float vhs;
  uniform vec2 sunUV;
  uniform float aspect;
  varying vec2 vUv;
  varying float vSun;
  // Shooting into the sun on a full-frame cinema camera: a hot core and bloom, a starburst off the
  // aperture blades, a chain of coloured ghosts across the frame, and veiling glare that lifts the
  // shadows and washes out the contrast. All of it fades as the sun goes behind something.
  vec3 sunFlare( vec3 c, vec2 uv ) {
    float vis = vSun;
    if ( vis < 0.002 ) return c;
    vec2 d = ( uv - sunUV ) * vec2( aspect, 1.0 );
    float r = length( d ), a = atan( d.y, d.x );
    vec3 warm = vec3( 1.0, 0.86, 0.62 );
    vec3 f = warm * ( 0.9 * exp( -r * 34.0 ) + 0.32 * exp( -r * 7.0 ) + 0.1 * exp( -r * 2.2 ) );
    // 14-point star from 7 blades, a little uneven like a real iris.
    float star = pow( abs( cos( a * 7.0 + 0.4 ) ), 90.0 ) * ( 0.7 + 0.3 * sin( a * 3.0 ) ) + 0.5 * pow( abs( cos( a * 7.0 + 1.97 ) ), 160.0 );
    f += vec3( 1.0, 0.93, 0.8 ) * star * exp( -r * 6.5 ) * 0.45;
    // Ghosts on the line from the sun through the middle of the frame.
    vec2 axis = vec2( 0.5 ) - sunUV;
    for ( int k = 0; k < 5; k++ ) {
      float t = k == 0 ? 0.42 : k == 1 ? 0.78 : k == 2 ? 1.18 : k == 3 ? 1.55 : 1.92;
      float rad = k == 0 ? 0.03 : k == 1 ? 0.075 : k == 2 ? 0.045 : k == 3 ? 0.12 : 0.06;
      vec3 tint = k == 0 ? vec3( 0.55, 1.0, 0.6 ) : k == 1 ? vec3( 0.95, 0.5, 0.9 ) : k == 2 ? vec3( 1.0, 0.75, 0.35 ) : k == 3 ? vec3( 0.4, 0.75, 1.0 ) : vec3( 0.7, 1.0, 0.8 );
      vec2 gp = ( uv - ( sunUV + axis * t ) ) * vec2( aspect, 1.0 );
      float gd = length( gp ) / rad;
      f += tint * ( smoothstep( 1.0, 0.82, gd ) * ( 0.35 + 0.65 * gd * gd ) ) * 0.1;
    }
    // Veiling glare: stronger the nearer the sun is to the middle of the frame.
    float near = 1.0 - smoothstep( 0.1, 0.85, length( ( sunUV - 0.5 ) * vec2( aspect, 1.0 ) ) );
    c = mix( c, c * 0.82 + warm * 0.16, vis * ( 0.45 + 0.4 * near ) );
    return c + f * vis;
  }
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
    c = sunFlare( c, vUv );
    // 15-bit color (32 levels per channel) with ordered dithering.
    vec2 px = floor( vUv * res );
    c = floor( c * 31.0 + 0.5 + bayer4( px ) * 0.9 ) / 31.0;
    if ( vhs > 0.5 ) {
      c += ( hash( floor( vUv * res ) ) - 0.5 ) * 0.05; // fixed tape grain (doesn't move)
    }
    gl_FragColor = vec4( c, 1.0 );
  }
`;

// VHS / VX1000 look on (default). Flip off with setVhs(false).
const VHS = { value: 1 };
const TIME = { value: 0 };
export const setVhs = (on) => { VHS.value = on ? 1 : 0; };

let installed = false;
const SUNV = new THREE.Vector3();
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
    uniforms: { tDiffuse: { value: rt.texture }, res: { value: new THREE.Vector2(4, 4) }, time: TIME, vhs: VHS, sunUV: { value: new THREE.Vector2() }, sunOn: { value: 0 }, aspect: { value: 1 } },
    vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false, toneMapped: false,
  });
  const postScene = new THREE.Scene();
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let cssW = 0, cssH = 0, curLines = lines, curMinPx = minPx;

  const self = {
    renderer, canvas,
    width: 1, height: 1, aspect: 1, // low-res buffer size
    // Size the low-res buffer so the image is roughly `lines` "PlayStation" lines: chunky but readable.
    resize() {
      const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
      if (w === cssW && h === cssH) return false;
      cssW = w; cssH = h;
      renderer.setSize(w, h, false);
      const px = Math.max(curMinPx, Math.min(4, Math.round(Math.max(w, h * 0.75) / curLines)));
      self.width = Math.ceil(w / px); self.height = Math.ceil(h / px);
      rt.setSize(self.width, self.height);
      postMat.uniforms.res.value.set(self.width, self.height);
      self.aspect = w / h;
      return true;
    },
    render(scene, camera) {
      self.resize();
      // Where the sun is on screen (scene.userData.sun.dir), for the lens flare.
      const sun = scene.userData.sun, U = postMat.uniforms;
      U.sunOn.value = 0; U.aspect.value = self.aspect;
      if (sun && sun.on && camera.isPerspectiveCamera) {
        camera.getWorldDirection(SUNV);
        if (SUNV.dot(sun.dir) > 0.2) {
          SUNV.copy(sun.dir).multiplyScalar(800).add(camera.position).project(camera);
          U.sunUV.value.set(SUNV.x * 0.5 + 0.5, SUNV.y * 0.5 + 0.5);
          U.sunOn.value = 1;
        }
      }
      SNAP.value.set(self.width / 2, self.height / 2);
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      TIME.value = (performance.now() / 1000) % 1000;
      renderer.render(postScene, postCam);
    },
    // Change the resolution (e.g. sharper from the cockpit, where the road is further away).
    setDetail(l = lines, m = minPx) {
      if (l === curLines && m === curMinPx) return;
      curLines = l; curMinPx = m; cssW = cssH = 0; self.resize();
    },
    dispose() { rt.dispose(); postMat.dispose(); renderer.dispose(); renderer.forceContextLoss(); },
  };
  return self;
}
