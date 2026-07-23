import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const _canvas3d = document.getElementById('view');
const _scene = new THREE.Scene();
_scene.background = new THREE.Color(0xffffff);
(function loadCanvasBackgroundGradient(){
  // Gradient narrowed to near-imperceptible per feedback -- previously a
  // fairly visible cream-to-greige shift top to bottom; now a much
  // smaller delta between stops, reading as essentially flat while still
  // avoiding a perfectly uniform canvas-texture look.
  const w = 512, h = 512;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d');
  const vgrad = cx.createLinearGradient(0, 0, 0, h);
  vgrad.addColorStop(0, '#FBF9FA');
  vgrad.addColorStop(0.55, '#FAF7F8');
  vgrad.addColorStop(1, '#F8F5F6');
  cx.fillStyle = vgrad;
  cx.fillRect(0, 0, w, h);
  const rgrad = cx.createRadialGradient(w/2, h*0.42, 0, w/2, h*0.42, w*0.78);
  rgrad.addColorStop(0, 'rgba(255,255,255,0.25)');
  rgrad.addColorStop(0.6, 'rgba(255,255,255,0.06)');
  rgrad.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = rgrad;
  cx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _scene.background = tex;
})();

const _camera = new THREE.PerspectiveCamera(22, Math.max(1,_canvas3d.clientWidth)/Math.max(1,_canvas3d.clientHeight), 0.1, 5000);
const _renderer = new THREE.WebGLRenderer({canvas:_canvas3d, antialias:true, powerPreference:'high-performance'});
_renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
_renderer.toneMapping = THREE.ACESFilmicToneMapping;
_renderer.toneMappingExposure = 1.2;
_renderer.outputColorSpace = THREE.SRGBColorSpace;

const _ambientLight = new THREE.AmbientLight(0xffffff, 0.16);
_scene.add(_ambientLight);

// Key/fill lighting per studio spec: key at 45 deg to the left of camera,
// fill at 135 deg to the right at half intensity. Added as children of
// the camera (not the scene) so they hold their angle relative to the
// VIEW as the user orbits the piece with OrbitControls -- a photographer's
// softboxes don't move as the subject turns on a turntable, and this is
// the standard technique for reproducing that in an interactive viewer.
const _keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
_keyLight.position.set(Math.sin(THREE.MathUtils.degToRad(45)), 0.55, Math.cos(THREE.MathUtils.degToRad(45)));
_camera.add(_keyLight);
const _fillLight = new THREE.DirectionalLight(0xffffff, 0.68);
_fillLight.position.set(Math.sin(THREE.MathUtils.degToRad(135)), 0.35, Math.cos(THREE.MathUtils.degToRad(135)));
_camera.add(_fillLight);
_scene.add(_camera);

// Ground plane: invisible except where it catches a shadow, per spec
// ("10% opacity contact shadow"). ShadowMaterial is built for exactly
// this -- fully transparent except in shadowed areas.
_renderer.shadowMap.enabled = true;
_renderer.shadowMap.type = THREE.PCFSoftShadowMap;
_keyLight.castShadow = true;
_keyLight.shadow.mapSize.set(1024, 1024);
_keyLight.shadow.camera.near = 0.1;
_keyLight.shadow.camera.far = 50;
_keyLight.shadow.bias = -0.001;
const _groundPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.ShadowMaterial({ opacity: 0.10 })
);
_groundPlane.rotation.x = -Math.PI / 2;
_groundPlane.receiveShadow = true;
_scene.add(_groundPlane);

function createLightTentEnvironment(renderer){
  const envScene = new THREE.Scene();
  const white = new THREE.MeshBasicMaterial({ color: 0xf7f7f7, side: THREE.DoubleSide });
  const thinDark = new THREE.MeshBasicMaterial({ color: 0x5a5f66, side: THREE.DoubleSide });
  function panel(width, height, position, rotation, material){
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width,height), material);
    mesh.position.copy(position);
    mesh.rotation.set(rotation.x, rotation.y, rotation.z);
    envScene.add(mesh);
    return mesh;
  }
  panel(60, 60, new THREE.Vector3(0, 30, 0), new THREE.Euler(Math.PI/2, 0, 0), white);
  panel(60, 60, new THREE.Vector3(-30, 0, 0), new THREE.Euler(0, Math.PI/2, 0), white);
  panel(60, 60, new THREE.Vector3(30, 0, 0), new THREE.Euler(0, -Math.PI/2, 0), white);
  panel(60, 60, new THREE.Vector3(0, 0, -30), new THREE.Euler(0, 0, 0), white);
  panel(60, 60, new THREE.Vector3(0, 0, 30), new THREE.Euler(0, Math.PI, 0), white);
  panel(60, 60, new THREE.Vector3(0, -30, 0), new THREE.Euler(-Math.PI/2, 0, 0), white);
  panel(1.0, 50, new THREE.Vector3(-18, 0, 10), new THREE.Euler(0, Math.PI*0.35, 0), thinDark);
  panel(1.0, 50, new THREE.Vector3(18, 0, -8), new THREE.Euler(0, -Math.PI*0.3, 0), thinDark);
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const renderTarget = pmremGenerator.fromScene(envScene, 0.06);
  pmremGenerator.dispose();
  return renderTarget.texture;
}
_scene.environment = createLightTentEnvironment(_renderer);

function blurStudioHDRI(texture,radius=3){
  const image=texture&&texture.image;
  const data=image&&image.data;
  const width=image&&image.width;
  const height=image&&image.height;
  radius=Math.max(0,Math.round(radius||0));
  if(!data||!width||!height||radius<1)return texture;
  const isHalfFloat=data instanceof Uint16Array;
  const read=isHalfFloat?(v)=>THREE.DataUtils.fromHalfFloat(v):(v)=>v;
  const write=isHalfFloat?(v)=>THREE.DataUtils.toHalfFloat(v):(v)=>v;
  const channels=4;
  const temp=new Float32Array(width*height*3);
  const kernelSize=radius*2+1;
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      let sr=0,sg=0,sb=0;
      for(let k=-radius;k<=radius;k++){
        const sx=(x+k+width)%width;
        const si=(y*width+sx)*channels;
        sr+=Math.max(0,read(data[si])); sg+=Math.max(0,read(data[si+1])); sb+=Math.max(0,read(data[si+2]));
      }
      const ti=(y*width+x)*3;
      temp[ti]=sr/kernelSize; temp[ti+1]=sg/kernelSize; temp[ti+2]=sb/kernelSize;
    }
  }
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      let sr=0,sg=0,sb=0;
      for(let k=-radius;k<=radius;k++){
        const sy=Math.max(0,Math.min(height-1,y+k));
        const ti=(sy*width+x)*3;
        sr+=temp[ti]; sg+=temp[ti+1]; sb+=temp[ti+2];
      }
      const di=(y*width+x)*channels;
      data[di]=write(sr/kernelSize); data[di+1]=write(sg/kernelSize); data[di+2]=write(sb/kernelSize);
    }
  }
  texture.needsUpdate=true;
  return texture;
}
function softenStudioHDRI(texture){
  const image=texture&&texture.image;
  const data=image&&image.data;
  if(!data||data.length<4)return texture;
  const isHalfFloat=data instanceof Uint16Array;
  const read=isHalfFloat?(v)=>THREE.DataUtils.fromHalfFloat(v):(v)=>v;
  const write=isHalfFloat?(v)=>THREE.DataUtils.toHalfFloat(v):(v)=>v;
  const SHADOW_LIFT=0.052, MID_EXPOSURE=1.12, CONTRAST_POWER=0.80, HIGHLIGHT_COMPRESSION=0.085, MAX_SCALE=2.35;
  const WARM_R=1.028, WARM_G=1.006, WARM_B=0.966;
  for(let i=0;i<data.length;i+=4){
    const r=Math.max(0,read(data[i])), g=Math.max(0,read(data[i+1])), b=Math.max(0,read(data[i+2]));
    const luminance=Math.max(1e-6,0.2126*r+0.7152*g+0.0722*b);
    const lifted=SHADOW_LIFT+MID_EXPOSURE*Math.pow(luminance,CONTRAST_POWER);
    const adjusted=lifted/(1+HIGHLIGHT_COMPRESSION*lifted);
    const scale=Math.min(MAX_SCALE,adjusted/luminance);
    data[i]=write(r*scale*WARM_R); data[i+1]=write(g*scale*WARM_G); data[i+2]=write(b*scale*WARM_B);
  }
  texture.needsUpdate=true;
  return texture;
}
(function loadStudioEnvironmentPNG(){
  new THREE.TextureLoader().load(
    'https://raw.githubusercontent.com/carlosgvidal/AGDPAtelier/main/IMG_0705.jpeg',
    (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      const pmrem = new THREE.PMREMGenerator(_renderer);
      _scene.environment = pmrem.fromEquirectangular(texture).texture;
      pmrem.dispose();
      texture.dispose();
      console.log('AGDP: entorno PNG (IMG_0705) cargado como IBL — LDR, sin HDR real.');
    },
    undefined,
    (err) => { console.warn('AGDP: no se pudo cargar IMG_0705.jpeg, se queda la caja de luz de respaldo.', err); }
  );
})();

const _surfaceRng = window.SeededVariation.createGenerator('AGDP|silver-surface-v079');
// Second, independent generator dedicated to scratches. Kept separate
// from _surfaceRng (which drives the brushed-line pattern row-by-row)
// so that adding scratches never shifts the brushed lines' own
// randomness sequence -- each pass draws from its own stream, seeded
// off the same 'AGDP|silver-surface-v079' family for reproducibility
// across regenerations of the same piece.
const _scratchRng = window.SeededVariation.createGenerator('AGDP|silver-surface-v079|scratches');

// A shared scratch layout, generated once and reused by both the normal
// map (for the physical groove) and the roughness map (for the duller,
// more diffuse reflection a real micro-scratch produces) -- this is what
// keeps the two effects visually locked to the same scratches instead of
// drawing two unrelated random patterns that wouldn't line up.
function buildScratchLayout(canvasW, canvasH){
  // Real handling scratches on polished silver: sparse, short, varied in
  // angle and length, denser in a couple of loose clusters (where a piece
  // gets set down or slides against something) rather than perfectly
  // uniform across the whole surface -- an even scatter reads as a
  // texture/pattern rather than as incidental wear.
  const clusterCount = 2 + Math.floor(_scratchRng()*2);
  const clusters = [];
  for(let c=0;c<clusterCount;c++){
    clusters.push({ cx: _scratchRng()*canvasW, cy: _scratchRng()*canvasH, spread: canvasW*(0.10+_scratchRng()*0.14) });
  }
  const scratchCount = 16 + Math.floor(_scratchRng()*14);
  const scratches = [];
  for(let i=0;i<scratchCount;i++){
    // ~60% of scratches cluster around one of the loose "wear zones"
    // above; the rest scatter freely, so the result reads as organic
    // rather than as a repeating decorative motif.
    let x0, y0;
    if(_scratchRng()<0.6){
      const cl = clusters[Math.floor(_scratchRng()*clusters.length)];
      const ang = _scratchRng()*Math.PI*2, rad = _scratchRng()*cl.spread;
      x0 = cl.cx + Math.cos(ang)*rad;
      y0 = cl.cy + Math.sin(ang)*rad;
    } else {
      x0 = _scratchRng()*canvasW;
      y0 = _scratchRng()*canvasH;
    }
    const angle = _scratchRng()*Math.PI*2;
    // Two populations: mostly short, faint scrapes, with a few longer,
    // slightly deeper ones -- avoids every scratch reading as identical.
    const isLong = _scratchRng()<0.22;
    const len = isLong ? (28+_scratchRng()*46) : (5+_scratchRng()*18);
    // A slight curve (not a perfectly straight line) matches how a real
    // scratch drifts as a hand or object slides across a surface.
    const curve = (_scratchRng()-0.5)*len*0.35;
    const x1 = x0+Math.cos(angle)*len, y1 = y0+Math.sin(angle)*len;
    const midX = (x0+x1)/2 - Math.sin(angle)*curve;
    const midY = (y0+y1)/2 + Math.cos(angle)*curve;
    scratches.push({
      x0, y0, x1, y1, midX, midY,
      width: isLong ? (0.6+_scratchRng()*0.6) : (0.4+_scratchRng()*0.4),
      intensity: isLong ? (0.35+_scratchRng()*0.30) : (0.15+_scratchRng()*0.25)
    });
  }
  return scratches;
}
function paintScratchesOnContext(cx, scratches, mode){
  // mode 'normal': pushes a thin groove into the normal map (a highlight
  // on one side, a shadow on the other, along the scratch's own local
  // perpendicular) so it reads as a real physical dent under the studio
  // lighting instead of a flat painted mark.
  // mode 'roughness': a soft, low-alpha pass that lightens (roughens)
  // the roughness map along the same path, since a scratch disturbs the
  // mirror finish and scatters reflections more than the surrounding
  // brushed metal.
  for(const s of scratches){
    cx.beginPath();
    cx.moveTo(s.x0, s.y0);
    cx.quadraticCurveTo(s.midX, s.midY, s.x1, s.y1);
    if(mode==='normal'){
      const dx=s.x1-s.x0, dy=s.y1-s.y0;
      const len=Math.hypot(dx,dy)||1;
      const nx=-dy/len, ny=dx/len; // perpendicular to the scratch direction
      // Shadow lobe (channel encodes a normal tilt away from the surface
      // on one edge)...
      cx.strokeStyle = `rgba(${Math.round(128-nx*70*s.intensity)},${Math.round(128-ny*70*s.intensity)},255,${s.intensity})`;
      cx.lineWidth = s.width;
      cx.stroke();
      // ...and a thin bright counter-edge immediately alongside it, which
      // is what actually sells a real incised groove rather than a flat
      // painted line -- a true scratch has a raised lip catching light on
      // one side and a shadowed trough on the other.
      cx.save();
      cx.translate(nx*s.width*0.9, ny*s.width*0.9);
      cx.beginPath();
      cx.moveTo(s.x0, s.y0);
      cx.quadraticCurveTo(s.midX, s.midY, s.x1, s.y1);
      cx.strokeStyle = `rgba(${Math.round(128+nx*55*s.intensity)},${Math.round(128+ny*55*s.intensity)},255,${s.intensity*0.7})`;
      cx.lineWidth = Math.max(0.5, s.width*0.65);
      cx.stroke();
      cx.restore();
    } else {
      const v = 215+Math.round(_scratchRng()*35);
      cx.strokeStyle = `rgba(${v},${v},${v},${Math.min(0.55, s.intensity*0.85)})`;
      cx.lineWidth = s.width*1.15;
      cx.stroke();
    }
  }
}
function buildBrushedLinesNormalMap(){
  const w = 512, h = 512;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d');
  cx.fillStyle = 'rgb(128,128,255)'; cx.fillRect(0,0,w,h);
  for (let y=0; y<h; y++) {
    const jitter = Math.sin(y*2.7)*1.4 + (_surfaceRng()-0.5)*3.2;
    const alpha = 0.10 + _surfaceRng()*0.16;
    cx.strokeStyle = `rgba(${jitter>0?255:0},128,255,${alpha})`;
    cx.beginPath(); cx.moveTo(0, y+0.5); cx.lineTo(w, y+0.5); cx.lineWidth = 1; cx.stroke();
  }
  paintScratchesOnContext(cx, _scratchLayout, 'normal');
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 10);
  return tex;
}
function buildBrushedRoughnessMap(){
  const w = 512, h = 512;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d');
  cx.fillStyle = '#ffffff'; cx.fillRect(0,0,w,h);
  for (let y=0; y<h; y++) {
    const v = 200 + Math.round(_surfaceRng()*55);
    cx.strokeStyle = `rgba(${v},${v},${v},0.5)`;
    cx.beginPath(); cx.moveTo(0,y+0.5); cx.lineTo(w,y+0.5); cx.lineWidth=1; cx.stroke();
  }
  paintScratchesOnContext(cx, _scratchLayout, 'roughness');
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 10);
  return tex;
}
// Generated once, ahead of both maps, so the normal-map grooves and the
// roughness-map dulling always describe the exact same set of scratches
// at the exact same canvas coordinates.
const _scratchLayout = buildScratchLayout(512, 512);
const _material = new THREE.MeshPhysicalMaterial({
  color: 0xeeeeee, metalness: 1.0, roughness: 0.1, ior: 1.35, envMapIntensity: 0.736,
  clearcoat: 0,
  normalMap: buildBrushedLinesNormalMap(), normalScale: new THREE.Vector2(0.08, 0.08),
  roughnessMap: buildBrushedRoughnessMap(),
});
let _mesh3d = null;

// Initial product-presentation views. These transforms affect only the
// WebGL display: the generated mesh, audits and exported STL remain unchanged.
const AGDP_PRESENTATION_VIEWS=Object.freeze({
  // Angles below are derived directly from a formal camera/lighting spec
  // (pitch = elevation above horizontal, yaw = rotation around the
  // vertical axis from the piece's own front-facing direction), via
  // dy=sin(pitch), and the horizontal component split as
  // dx=sin(yaw)*cos(pitch), dz=cos(yaw)*cos(pitch) for pieces whose
  // front faces +Z (ring/pendant/cufflinks family), or with dx/dz
  // swapped for pieces whose front faces +X (choker/headpiece, per the
  // axis analysis done earlier for those two types specifically). Not
  // visually verified in this environment (no WebGL rendering
  // available) -- please check against real renders and describe any
  // remaining gap.
  ring:Object.freeze({
    // "Anillos" category: pitch 15-30 deg, yaw 30-45 deg (isometric 3/4,
    // shank + setting + table all visible at once). Using the midpoint
    // of each range: pitch 22, yaw 37.
    objectEulerDeg:[0,0,-6], cameraDirection:[0.56,0.38,0.74], framing:1.15
  }),
  pendant:Object.freeze({
    // "Pendientes, Dijes y Collares" category: pitch 0-10 deg (near
    // frontal), vertical hanging pose, exact symmetry. Using pitch 5,
    // yaw near 0 (a touch of asymmetry only).
    objectEulerDeg:[0,0,0], cameraDirection:[0.05,0.09,1.0], framing:1.17
  }),
  bangle:Object.freeze({
    // Same "Anillos" logic as ring (built the same way, front faces
    // +Z): pitch 22, yaw 40.
    objectEulerDeg:[0,0,8], cameraDirection:[0.60,0.38,0.71], framing:1.18
  }),
  cuffBracelet:Object.freeze({
    // Same as bangle, yaw 33 for slight visual distinction between the
    // two typologies.
    objectEulerDeg:[0,0,6], cameraDirection:[0.51,0.38,0.78], framing:1.18
  }),
  choker:Object.freeze({
    // Treated as "Collares" (necklace) category: pitch 0-10 deg, near
    // frontal, symmetric "V/U" of the open collar toward the viewer.
    // This type's front faces +X, not +Z (established earlier from the
    // construction code: t=0, the center of the arc, sits along +X) --
    // so pitch maps to dy as usual but the "frontal" component is dx,
    // not dz. Using pitch 6.
    objectEulerDeg:[-10,0,0], cameraDirection:[1,0.11,0.15], framing:1.18
  }),
  headpiece:Object.freeze({
    // Same "Collares" logic and same +X front axis as choker, pitch 8
    // (slightly more presence, appropriate for a tiara's higher crown).
    objectEulerDeg:[-14,0,0], cameraDirection:[1,0.14,0.15], framing:1.20
  }),
  cufflinks:Object.freeze({
    // No exact category in the spec for a small emblem/plaque piece;
    // treated like the pendant/dije category (front faces +Z, same
    // construction lineage via the shared band builder) but with a
    // little more yaw (15 deg) to show some depth/dimensionality, since
    // cufflinks are viewed more like a small object than a hanging,
    // perfectly symmetric pendant. Pitch 8.
    objectEulerDeg:[0,-8,0], cameraDirection:[0.26,0.14,0.96], framing:1.20
  }),
  earCuff:Object.freeze({
    // "Aretes / Pendientes cortos" category: pitch 10-15 deg, yaw 30 deg
    // (the spec's paired left/right +-30 deg is for showing a matched
    // pair together, which this tool doesn't render -- applying the same
    // single-piece angle). Built the same way as ring (front faces +Z).
    // Pitch 12.
    objectEulerDeg:[0,0,-10], cameraDirection:[0.49,0.21,0.85], framing:1.18
  }),
  default:Object.freeze({
    objectEulerDeg:[0,0,0], cameraDirection:[0.42,0.30,1], framing:1.20
  })
});
window.AGDP_PRESENTATION_VIEWS=AGDP_PRESENTATION_VIEWS;

function _presentationViewFor(nextMesh){
  const type=nextMesh&&nextMesh.audit&&nextMesh.audit.type;
  return AGDP_PRESENTATION_VIEWS[type]||AGDP_PRESENTATION_VIEWS.default;
}
function _degToRad3(values){
  return values.map(v=>THREE.MathUtils.degToRad(v||0));
}

let _controls = null;
function _createControls(){
  if(_controls) _controls.dispose();
  _controls = new OrbitControls(_camera, _renderer.domElement);
  _controls.enableDamping = true;
  _controls.dampingFactor = 0.08;
  _controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  _controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  _controls.enableRotate = true; _controls.enableZoom = true; _controls.enablePan = false;
  _controls.rotateSpeed = 1.0;
  // Keep the camera within a believable product-photography range: never
  // below the horizon (where a floor plane stops making visual sense) and
  // never fully overhead (where the floor's shadow reads as "behind" the
  // piece instead of beneath it).
  _controls.minPolarAngle = 0;
  _controls.maxPolarAngle = Math.PI;
  return _controls;
}
_createControls();
_camera.position.set(5.7, 4.2, 7.5);
_camera.lookAt(0,0,0);

function _resize(){
  const w = Math.max(1,_canvas3d.clientWidth), h = Math.max(1,_canvas3d.clientHeight);
  _camera.aspect = w/h; _camera.updateProjectionMatrix();
  _renderer.setSize(w, h, false);
}
window.AGDP_onCanvasResize = _resize;
window.addEventListener('resize', _resize);
_resize();

window.AGDP_setRenderMesh = function(nextMesh){
  if(_mesh3d){ _scene.remove(_mesh3d); _mesh3d.geometry.dispose(); _mesh3d=null; }
  const prevTarget = _controls.target.clone();
  const prevPos = _camera.position.clone();
  _createControls();
  _controls.target.copy(prevTarget);
  _camera.position.copy(prevPos);
  if(!nextMesh || !nextMesh.V || !nextMesh.V.length){ _controls.update(); return; }
  const positions = new Float32Array(nextMesh.V.length*3);
  for(let i=0;i<nextMesh.V.length;i++){ positions[i*3]=nextMesh.V[i][0]; positions[i*3+1]=nextMesh.V[i][1]; positions[i*3+2]=nextMesh.V[i][2]; }
  const indices = new Uint32Array(nextMesh.F.length*3);
  for(let i=0;i<nextMesh.F.length;i++){ indices[i*3]=nextMesh.F[i][0]; indices[i*3+1]=nextMesh.F[i][1]; indices[i*3+2]=nextMesh.F[i][2]; }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions,3));
  geometry.setIndex(new THREE.BufferAttribute(indices,1));
  geometry.computeVertexNormals();
  {
    let minY=Infinity, maxY=-Infinity;
    for(let i=0;i<nextMesh.V.length;i++){ const y=nextMesh.V[i][1]; if(y<minY)minY=y; if(y>maxY)maxY=y; }
    const spanY = Math.max(1e-6, maxY-minY);
    const uvs = new Float32Array(nextMesh.V.length*2);
    for(let i=0;i<nextMesh.V.length;i++){
      const x=nextMesh.V[i][0], y=nextMesh.V[i][1], z=nextMesh.V[i][2];
      uvs[i*2] = (Math.atan2(z,x)/(2*Math.PI))+0.5;
      uvs[i*2+1] = (y-minY)/spanY;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs,2));
  }
  geometry.center();
  _mesh3d = new THREE.Mesh(geometry, _material);
  _mesh3d.castShadow = true;
  const presentation=_presentationViewFor(nextMesh);
  const objectEuler=_degToRad3(presentation.objectEulerDeg||[0,0,0]);
  _mesh3d.rotation.set(objectEuler[0],objectEuler[1],objectEuler[2]);
  _scene.add(_mesh3d);

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const sphere=geometry.boundingSphere;
  const radius=Math.max(1,sphere?sphere.radius:10);
  // Ground plane sits just below the piece's bounding sphere -- a safe
  // lower bound regardless of the object's rotation, since nothing in
  // the mesh can extend further than its own bounding radius from center.
  _groundPlane.position.y = -radius * 1.02;

  _controls.target.set(0,0,0);
  const vFov=THREE.MathUtils.degToRad(_camera.fov);
  const hFov=2*Math.atan(Math.tan(vFov/2)*Math.max(0.35,_camera.aspect));
  const limitingFov=Math.min(vFov,hFov);
  const framing=Number.isFinite(presentation.framing)?presentation.framing:1.20;
  const fitDistance=(radius/Math.sin(Math.max(0.08,limitingFov/2)))*framing;
  const cameraDirection=presentation.cameraDirection||[0.42,0.30,1];
  const dir=new THREE.Vector3(cameraDirection[0],cameraDirection[1],cameraDirection[2]).normalize();
  _camera.position.copy(dir.multiplyScalar(fitDistance));
  _camera.near=Math.max(0.01, radius*0.015);
  _camera.far=fitDistance+radius*8;
  _camera.updateProjectionMatrix();
  _controls.minDistance=Math.max(radius*0.18, 0.35);
  _controls.maxDistance=fitDistance*5;
  _controls.update();
};

if(window.AGDP_pendingRenderMesh!==undefined){
  window.AGDP_setRenderMesh(window.AGDP_pendingRenderMesh);
  window.AGDP_pendingRenderMesh=undefined;
}

function _animate(){
  requestAnimationFrame(_animate);
  _controls.update();
  _renderer.render(_scene,_camera);
}
_animate();
