import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const _canvas3d = document.getElementById('view');
const _scene = new THREE.Scene();
_scene.background = new THREE.Color(0xffffff);
(function loadCanvasBackgroundGradient(){
  // Warmer, more particular neutral than a plain near-white: a soft cream
  // top easing into a warm greige toward the bottom, where the floor and
  // its shadow live — closer to the seamless-paper look of the reference,
  // built from this brand's own cream/taupe palette rather than a generic
  // studio white.
  const w = 512, h = 512;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d');
  const vgrad = cx.createLinearGradient(0, 0, 0, h);
  vgrad.addColorStop(0, '#FBF8F3');
  vgrad.addColorStop(0.55, '#F6F0E8');
  vgrad.addColorStop(1, '#E7DDD0');
  cx.fillStyle = vgrad;
  cx.fillRect(0, 0, w, h);
  const rgrad = cx.createRadialGradient(w/2, h*0.42, 0, w/2, h*0.42, w*0.78);
  rgrad.addColorStop(0, 'rgba(255,253,250,0.55)');
  rgrad.addColorStop(0.6, 'rgba(255,253,250,0.12)');
  rgrad.addColorStop(1, 'rgba(255,253,250,0)');
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
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 10);
  return tex;
}
const _material = new THREE.MeshPhysicalMaterial({
  color: 0xffffff, metalness: 0.90, roughness: 0.0875, envMapIntensity: 0.736,
  clearcoat: 0, reflectivity: 0.64,
  normalMap: buildBrushedLinesNormalMap(), normalScale: new THREE.Vector2(0.08, 0.08),
  roughnessMap: buildBrushedRoughnessMap(),
});
let _mesh3d = null;

// Initial product-presentation views. These transforms affect only the
// WebGL display: the generated mesh, audits and exported STL remain unchanged.
const AGDP_PRESENTATION_VIEWS=Object.freeze({
  ring:Object.freeze({
    objectEulerDeg:[-18,0,-7], cameraDirection:[0.12,0.22,1], framing:1.15
  }),
  pendant:Object.freeze({
    objectEulerDeg:[0,-7,0], cameraDirection:[-0.18,0.10,1], framing:1.17
  }),
  bangle:Object.freeze({
    objectEulerDeg:[0,0,8], cameraDirection:[-0.72,0.28,1], framing:1.18
  }),
  cuffBracelet:Object.freeze({
    objectEulerDeg:[0,0,6], cameraDirection:[-0.78,0.30,1], framing:1.18
  }),
  choker:Object.freeze({
    objectEulerDeg:[-4,0,0], cameraDirection:[0,0.10,1], framing:1.16
  }),
  headpiece:Object.freeze({
    objectEulerDeg:[-3,0,0], cameraDirection:[-0.18,0.12,1], framing:1.18
  }),
  cufflinks:Object.freeze({
    objectEulerDeg:[-10,-8,0], cameraDirection:[-0.45,0.28,1], framing:1.20
  }),
  earCuff:Object.freeze({
    objectEulerDeg:[0,0,-10], cameraDirection:[-0.58,0.24,1], framing:1.18
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
  const presentation=_presentationViewFor(nextMesh);
  const objectEuler=_degToRad3(presentation.objectEulerDeg||[0,0,0]);
  _mesh3d.rotation.set(objectEuler[0],objectEuler[1],objectEuler[2]);
  _scene.add(_mesh3d);

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const sphere=geometry.boundingSphere;
  const radius=Math.max(1,sphere?sphere.radius:10);

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


