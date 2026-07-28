import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const AGDP_VIEWPORT_BUILD='2026-07-28-earrings-y90-framing14-v12';
window.AGDP_VIEWPORT_BUILD=AGDP_VIEWPORT_BUILD;
console.info('AGDP viewport build',AGDP_VIEWPORT_BUILD);

const _canvas3d = document.getElementById('view');
const _scene = new THREE.Scene();
_scene.background = new THREE.Color(0xffffff);
(function loadCanvasBackgroundGradient(){
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

const _keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
_keyLight.position.set(Math.sin(THREE.MathUtils.degToRad(45)), 0.55, Math.cos(THREE.MathUtils.degToRad(45)));
_camera.add(_keyLight);
const _fillLight = new THREE.DirectionalLight(0xffffff, 0.68);
_fillLight.position.set(Math.sin(THREE.MathUtils.degToRad(135)), 0.35, Math.cos(THREE.MathUtils.degToRad(135)));
_camera.add(_fillLight);
_scene.add(_camera);

_renderer.shadowMap.enabled = true;
_renderer.shadowMap.type = THREE.PCFSoftShadowMap;
_keyLight.castShadow = true;
_keyLight.shadow.mapSize.set(1024, 1024);
_keyLight.shadow.camera.near = 0.1;
_keyLight.shadow.camera.far = 50;
_keyLight.shadow.bias = -0.001;
function _createContactShadowTexture(){
  const size=256;
  const canvas=document.createElement('canvas');
  canvas.width=size; canvas.height=size;
  const ctx=canvas.getContext('2d');
  const gradient=ctx.createRadialGradient(size*.5,size*.5,0,size*.5,size*.5,size*.5);
  gradient.addColorStop(0,'rgba(40,32,36,0.18)');
  gradient.addColorStop(.42,'rgba(40,32,36,0.09)');
  gradient.addColorStop(1,'rgba(40,32,36,0)');
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,size,size);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
const _contactShadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1,1),
  new THREE.MeshBasicMaterial({
    map:_createContactShadowTexture(),
    transparent:true,
    opacity:.504,
    depthWrite:false,
    toneMapped:false
  })
);
_contactShadow.rotation.x=-Math.PI/2;
_contactShadow.renderOrder=-1;
_contactShadow.visible=false;
_scene.add(_contactShadow);

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
const _scratchRng = window.SeededVariation.createGenerator('AGDP|silver-surface-v079|scratches');

function buildScratchLayout(canvasW, canvasH){
  const clusterCount = 2 + Math.floor(_scratchRng()*2);
  const clusters = [];
  for(let c=0;c<clusterCount;c++){
    clusters.push({ cx: _scratchRng()*canvasW, cy: _scratchRng()*canvasH, spread: canvasW*(0.10+_scratchRng()*0.14) });
  }
  const scratchCount = 16 + Math.floor(_scratchRng()*14);
  const scratches = [];
  for(let i=0;i<scratchCount;i++){
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
    const isLong = _scratchRng()<0.22;
    const len = isLong ? (28+_scratchRng()*46) : (5+_scratchRng()*18);
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
  for(const s of scratches){
    cx.beginPath();
    cx.moveTo(s.x0, s.y0);
    cx.quadraticCurveTo(s.midX, s.midY, s.x1, s.y1);
    if(mode==='normal'){
      const dx=s.x1-s.x0, dy=s.y1-s.y0;
      const len=Math.hypot(dx,dy)||1;
      const nx=-dy/len, ny=dx/len;
      cx.strokeStyle = `rgba(${Math.round(128-nx*70*s.intensity)},${Math.round(128-ny*70*s.intensity)},255,${s.intensity})`;
      cx.lineWidth = s.width;
      cx.stroke();
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
const _scratchLayout = buildScratchLayout(512, 512);
const _material = new THREE.MeshPhysicalMaterial({
  color: 0xeeeeee, metalness: 1.0, roughness: 0.1, ior: 1.35, envMapIntensity: 0.736,
  clearcoat: 0,
  normalMap: buildBrushedLinesNormalMap(), normalScale: new THREE.Vector2(0.08, 0.08),
  roughnessMap: buildBrushedRoughnessMap(),
});
let _mesh3d = null;
let _presentationAccessory = null;

const AGDP_PRESENTATION_VIEWS=Object.freeze({
  ring:Object.freeze({
    // Same spatial presentation as the ear cuff. Keep the ring's existing
    // framing and vertical margin unchanged.
    objectEulerDeg:[0,-90,-10],
    cameraDirection:[0.49,0.21,0.85],
    framing:1.95,
    verticalOffset:-0.035
  }),
  pendant:Object.freeze({
    // Vertical jewellery-catalogue composition. The pendant remains frontal,
    // sits in the lower part of the canvas and is accompanied by a display-
    // only sample chain that is never included in the exported mesh.
    objectEulerDeg:[0,0,0],
    cameraDirection:[0.015,0.055,0.998],
    framing:3.15,
    verticalOffset:1.42,
    displayChain:true,
    chainTopSpan:2.15,
    chainRise:4.25
  }),
  bangle:Object.freeze({
    // Same spatial presentation as the ear cuff. Keep the bracelet's existing
    // framing and vertical margin unchanged.
    objectEulerDeg:[0,-90,-10],
    cameraDirection:[0.49,0.21,0.85],
    framing:1.274,
    verticalOffset:-0.035
  }),
  cuffBracelet:Object.freeze({
    // Same spatial presentation as the ear cuff. Keep the open bracelet's
    // existing framing and vertical margin unchanged.
    objectEulerDeg:[0,-90,-10],
    cameraDirection:[0.49,0.21,0.85],
    framing:1.232,
    verticalOffset:-0.025
  }),
  earCuff:Object.freeze({
    // Horizontal 90-degree turn to the left around the current local Y axis.
    objectEulerDeg:[0,-90,-10],
    cameraDirection:[0.49,0.21,0.85],
    framing:1.9116
  }),
  brooch:Object.freeze({
    // Same presentation axis as before, rotated an additional 180 degrees
    // so the clip orientation is inverted without changing camera or scale.
    objectEulerDeg:[0,-5,270],
    cameraDirection:[0.10,0.10,0.99],
    framing:1.846,
    verticalOffset:-0.015
  }),
  cufflinks:Object.freeze({
    // Preserve the incoming cufflink pose and spacing adjustment. Increase the
    // framing factor by 10% so the pair occupies 10% less of the canvas.
    framing:1.32
  }),
  hoopEarring:Object.freeze({
    // Presentation-only: rotate the complete native pair 90 degrees around Y
    // and add 1.4 framing space relative to the canvas.
    objectEulerDeg:[0,90,0],
    cameraDirection:[0,0,1],
    framing:1.4
  }),
  default:Object.freeze({
    objectEulerDeg:[0,0,0], cameraDirection:[0,0,1], framing:1.20
  })
});
window.AGDP_PRESENTATION_VIEWS=AGDP_PRESENTATION_VIEWS;

function _presentationViewFor(nextMesh){
  const type=_normalizedPresentationType(nextMesh);
  return AGDP_PRESENTATION_VIEWS[type]||AGDP_PRESENTATION_VIEWS.default;
}
function _degToRad3(values){
  return values.map(v=>THREE.MathUtils.degToRad(v||0));
}

function _disposeObject3D(root){
  if(!root)return;
  root.traverse(obj=>{
    if(obj.geometry&&obj.geometry.dispose)obj.geometry.dispose();
    if(obj.material){
      const materials=Array.isArray(obj.material)?obj.material:[obj.material];
      materials.forEach(material=>material&&material.dispose&&material.dispose());
    }
  });
}

function _estimatePendantBailOpening(geometry){
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const box=geometry.boundingBox;
  const position=geometry.getAttribute('position');
  if(!box||!position||position.count<24){
    return {x:0,y:box?box.max.y:0,z:0,confidence:0};
  }

  const totalHeight=Math.max(1e-6,box.max.y-box.min.y);
  const totalWidth=Math.max(1e-6,box.max.x-box.min.x);
  const slices=80;
  const sliceHalf=totalHeight/(slices*1.65);
  const profiles=[];

  // Measure only horizontal silhouette widths. The bail is the narrow upper
  // component; the pendant body is much wider. This separates the bail first,
  // before any attempt to estimate its opening.
  for(let s=0;s<slices;s++){
    const y=box.min.y+totalHeight*(s/(slices-1));
    let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,count=0;
    for(let i=0;i<position.count;i++){
      const py=position.getY(i);
      if(Math.abs(py-y)>sliceHalf)continue;
      const x=position.getX(i),z=position.getZ(i);
      minX=Math.min(minX,x); maxX=Math.max(maxX,x);
      minZ=Math.min(minZ,z); maxZ=Math.max(maxZ,z);
      count++;
    }
    profiles.push({
      y,count,minX,maxX,minZ,maxZ,
      width:(count>3&&Number.isFinite(minX)&&Number.isFinite(maxX))?maxX-minX:Infinity
    });
  }

  // Search from the top downward for a coherent narrow run. It must be
  // substantially narrower than the pendant body, which prevents body holes
  // or decorative voids from being mistaken for the bail.
  const narrowLimit=totalWidth*.46;
  let runStart=-1,runEnd=-1,bestRun=null;
  for(let i=profiles.length-1;i>=0;i--){
    const p=profiles[i];
    const narrow=p.count>=4&&Number.isFinite(p.width)&&p.width<narrowLimit;
    if(narrow){
      if(runEnd<0)runEnd=i;
      runStart=i;
    }else if(runEnd>=0){
      const span=profiles[runEnd].y-profiles[runStart].y;
      if(span>totalHeight*.035){
        bestRun={start:runStart,end:runEnd,span};
        break;
      }
      runStart=-1; runEnd=-1;
    }
  }
  if(!bestRun&&runEnd>=0){
    const span=profiles[runEnd].y-profiles[runStart].y;
    if(span>totalHeight*.035)bestRun={start:runStart,end:runEnd,span};
  }

  if(!bestRun){
    return {
      x:0,
      y:box.max.y-totalHeight*.10,
      z:(box.min.z+box.max.z)*.5,
      confidence:0
    };
  }

  const bailYMin=profiles[bestRun.start].y-sliceHalf;
  const bailYMax=profiles[bestRun.end].y+sliceHalf;
  const bailVertices=[];
  for(let i=0;i<position.count;i++){
    const y=position.getY(i);
    if(y>=bailYMin&&y<=bailYMax){
      bailVertices.push({
        x:position.getX(i),
        y,
        z:position.getZ(i)
      });
    }
  }

  if(bailVertices.length<12){
    return {
      x:0,
      y:(bailYMin+bailYMax)*.5,
      z:(box.min.z+box.max.z)*.5,
      confidence:.25
    };
  }

  let bailMinX=Infinity,bailMaxX=-Infinity,bailMinY=Infinity,bailMaxY=-Infinity;
  let bailMinZ=Infinity,bailMaxZ=-Infinity;
  for(const v of bailVertices){
    bailMinX=Math.min(bailMinX,v.x); bailMaxX=Math.max(bailMaxX,v.x);
    bailMinY=Math.min(bailMinY,v.y); bailMaxY=Math.max(bailMaxY,v.y);
    bailMinZ=Math.min(bailMinZ,v.z); bailMaxZ=Math.max(bailMaxZ,v.z);
  }

  // Estimate the centre of the aperture from the local bail bounds only.
  // For a toroidal/oval bail this is markedly more stable than any centre
  // derived from the complete pendant bounding box.
  const centreX=(bailMinX+bailMaxX)*.5;
  const centreY=(bailMinY+bailMaxY)*.5;
  const centreZ=(bailMinZ+bailMaxZ)*.5;

  return {
    x:centreX,
    y:centreY,
    z:centreZ,
    confidence:1,
    bailBounds:{
      minX:bailMinX,maxX:bailMaxX,
      minY:bailMinY,maxY:bailMaxY,
      minZ:bailMinZ,maxZ:bailMaxZ
    }
  };
}

function _createPendantDisplayChain(geometry,presentation){
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const box=geometry.boundingBox;
  const sphere=geometry.boundingSphere;
  if(!box||!sphere)return null;

  const radius=Math.max(1,sphere.radius);
  const opening=_estimatePendantBailOpening(geometry);
  const rise=radius*(Number.isFinite(presentation.chainRise)?presentation.chainRise:4.25);
  const topSpan=radius*(Number.isFinite(presentation.chainTopSpan)?presentation.chainTopSpan:2.15);
  const localBailWidth=opening.bailBounds
    ?Math.max(radius*.10,opening.bailBounds.maxX-opening.bailBounds.minX)
    :radius*.30;
  const localBailHeight=opening.bailBounds
    ?Math.max(radius*.10,opening.bailBounds.maxY-opening.bailBounds.minY)
    :radius*.24;
  const shoulderHalf=Math.max(radius*.07,localBailWidth*.62);
  const shoulderY=opening.y+localBailHeight*.72;

  const group=new THREE.Group();
  group.name='AGDP_Pendant_Display_Chain';
  group.userData.presentationOnly=true;

  const chainMaterial=new THREE.MeshPhysicalMaterial({
    color:0xe8e8e8,
    metalness:1,
    roughness:.21,
    envMapIntensity:.82,
    clearcoat:0
  });

  const linkGeometry=new THREE.TorusGeometry(radius*.038,radius*.0105,6,12);
  // The torus is scaled to an elongated link. Use a centre-to-centre
  // distance smaller than its projected length so neighbouring links overlap
  // slightly and read as a physically connected cable chain.
  const linkMajorRadius=radius*.038;
  const linkTubeRadius=radius*.0105;
  const projectedLinkLength=2*(linkMajorRadius+linkTubeRadius)*1.34;
  // Slightly less than half a link length: neighbouring links overlap enough
  // to read as one continuous cable chain even at tablet-scale zoom.
  const linkSpacing=projectedLinkLength*.46;

  // One uninterrupted V. Its nadir is the detected centre of the bail
  // opening, so the sample chain passes through the opening rather than
  // ending above it or acquiring an artificial vertical section.
  const chainCurve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(opening.x-topSpan,shoulderY+rise,opening.z),
    new THREE.Vector3(opening.x-topSpan*.43,shoulderY+rise*.47,opening.z-radius*.025),
    new THREE.Vector3(opening.x-shoulderHalf,shoulderY,opening.z),
    new THREE.Vector3(opening.x,opening.y,opening.z),
    new THREE.Vector3(opening.x+shoulderHalf,shoulderY,opening.z),
    new THREE.Vector3(opening.x+topSpan*.43,shoulderY+rise*.47,opening.z-radius*.025),
    new THREE.Vector3(opening.x+topSpan,shoulderY+rise,opening.z)
  ],false,'centripetal');

  const length=chainCurve.getLength();
  const count=Math.max(58,Math.min(240,Math.ceil(length/linkSpacing)+1));
  const curveLengths=chainCurve.getLengths(Math.max(200,count*3));

  function parameterAtDistance(distance){
    const target=THREE.MathUtils.clamp(distance,0,length);
    let low=0,high=curveLengths.length-1;
    while(low<high){
      const mid=(low+high)>>1;
      if(curveLengths[mid]<target)low=mid+1;
      else high=mid;
    }
    const index=Math.max(1,low);
    const before=curveLengths[index-1];
    const after=curveLengths[index];
    const alpha=(after>before)?(target-before)/(after-before):0;
    return ((index-1)+alpha)/(curveLengths.length-1);
  }

  for(let i=0;i<count;i++){
    const distance=(i/(count-1))*length;
    const t=parameterAtDistance(distance);
    const point=chainCurve.getPoint(t);
    const tangent=chainCurve.getTangent(t).normalize();

    const link=new THREE.Mesh(linkGeometry,chainMaterial);
    link.position.copy(point);
    link.scale.set(.66,1.34,1);

    // Keep every link's long axis tangent to the chain path. Alternate only
    // a restrained twist around that tangent so links interlock without
    // turning into detached edge-on rods.
    const tangentAngle=Math.atan2(tangent.y,tangent.x)-Math.PI/2;
    link.rotation.set(0,0,tangentAngle);
    const twist=(i%2===0)?THREE.MathUtils.degToRad(24):THREE.MathUtils.degToRad(-24);
    link.rotateOnAxis(new THREE.Vector3(0,1,0),twist);

    group.add(link);
  }

  return group;
}

function _ringHeroYaw(geometry){
  // The ring is generated around the Y axis. A uniform band contributes
  // almost the same radial envelope at every angle, while sculptural nodes,
  // crowns and relief extend farther from that axis. Measuring the strongest
  // radial envelope therefore gives a stable catalogue-facing direction
  // without depending on seed metadata or changing the geometry itself.
  const position=geometry&&geometry.getAttribute&&geometry.getAttribute('position');
  if(!position||position.count<16)return 0;

  const BIN_COUNT=96;
  const envelope=new Float64Array(BIN_COUNT);
  envelope.fill(-Infinity);

  for(let i=0;i<position.count;i++){
    const x=position.getX(i), z=position.getZ(i);
    const radial=Math.hypot(x,z);
    if(!Number.isFinite(radial)||radial<1e-6)continue;
    let angle=Math.atan2(x,z); // angle 0 faces the +Z camera direction
    if(angle<0)angle+=Math.PI*2;
    const bin=Math.min(BIN_COUNT-1,Math.floor(angle/(Math.PI*2)*BIN_COUNT));
    if(radial>envelope[bin])envelope[bin]=radial;
  }

  const finite=Array.from(envelope).filter(Number.isFinite).sort((a,b)=>a-b);
  if(finite.length<BIN_COUNT*.35)return 0;
  const baseline=finite[Math.floor(finite.length*.45)];
  const score=new Float64Array(BIN_COUNT);

  // Circular smoothing suppresses triangle-level noise and favours a
  // coherent high-volume sector rather than a single isolated vertex.
  const KERNEL=[1,2,3,4,5,4,3,2,1];
  const half=(KERNEL.length-1)/2;
  for(let i=0;i<BIN_COUNT;i++){
    let total=0, weight=0;
    for(let k=-half;k<=half;k++){
      const j=(i+k+BIN_COUNT)%BIN_COUNT;
      const value=Number.isFinite(envelope[j])?Math.max(0,envelope[j]-baseline):0;
      const kw=KERNEL[k+half];
      total+=value*kw;
      weight+=kw;
    }
    score[i]=total/weight;
  }

  let best=0;
  for(let i=1;i<BIN_COUNT;i++)if(score[i]>score[best])best=i;
  if(score[best]<=1e-5)return 0;

  const dominantAngle=((best+.5)/BIN_COUNT)*Math.PI*2;
  return -dominantAngle;
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



function _arrangePairedComponents(geometry,presentation){
  const position=geometry.getAttribute('position');
  if(!position||position.count<16)return null;

  // Split the complete pair spatially rather than by mesh connectivity.
  // The largest clear gap on X separates the left and right presentation pieces.
  const samples=[];
  for(let i=0;i<position.count;i++)samples.push({x:position.getX(i),i});
  samples.sort((a,b)=>a.x-b.x);

  const minSide=Math.max(8,Math.floor(samples.length*.15));
  let splitIndex=-1,bestGap=-Infinity;
  for(let i=minSide;i<=samples.length-minSide;i++){
    const gap=samples[i].x-samples[i-1].x;
    if(gap>bestGap){bestGap=gap;splitIndex=i;}
  }
  if(splitIndex<minSide||splitIndex>samples.length-minSide)return null;

  const threshold=(samples[splitIndex-1].x+samples[splitIndex].x)*.5;
  const groups=[[],[]];
  for(let i=0;i<position.count;i++)groups[position.getX(i)<=threshold?0:1].push(i);
  if(groups[0].length<8||groups[1].length<8)return null;

  const components=groups.map(vertices=>{
    let cx=0,cy=0,cz=0;
    for(const vi of vertices){cx+=position.getX(vi);cy+=position.getY(vi);cz+=position.getZ(vi);}
    const inv=1/vertices.length;
    return {vertices,cx:cx*inv,cy:cy*inv,cz:cz*inv};
  });

  const midpointX=(components[0].cx+components[1].cx)*.5;
  const beforeDistance=Math.abs(components[1].cx-components[0].cx);
  const spacingScale=Number.isFinite(presentation&&presentation.pairSpacingScale)
    ?presentation.pairSpacingScale:.82;
  for(let componentIndex=0;componentIndex<2;componentIndex++){
    const component=components[componentIndex];
    const targetCx=midpointX+(component.cx-midpointX)*spacingScale;
    const shiftX=targetCx-component.cx;

    // Translate each presentation piece toward the pair midpoint.
    for(const vi of component.vertices){
      position.setXYZ(vi,position.getX(vi)+shiftX,position.getY(vi),position.getZ(vi));
    }
  }

  position.needsUpdate=true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return {
    threshold,
    beforeDistance,
    afterDistance:beforeDistance*spacingScale,
    spacingScale,
    vertexCounts:[groups[0].length,groups[1].length]
  };
}

function _isStrictNativeEarring(nextMesh){
  const audit=nextMesh&&nextMesh.audit;
  const candidates=[
    audit&&audit.type,
    audit&&audit.typology,
    audit&&audit.productType,
    audit&&audit.category,
    nextMesh&&nextMesh.type,
    nextMesh&&nextMesh.typology,
    nextMesh&&nextMesh.productType,
    nextMesh&&nextMesh.category
  ];
  return candidates.some(value=>{
    const key=String(value||'').toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
    return key==='earring'||key==='earrings'||key==='hoopearring'||
      key==='hoopearrings'||key==='hoop'||key==='hoops'||
      key==='arete'||key==='aretes'||key==='pendientearete'||
      key==='pendientesaretes';
  });
}

function _normalizedPresentationType(nextMesh){
  const raw=nextMesh&&nextMesh.audit&&nextMesh.audit.type;
  const key=String(raw||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(key==='earcuff'||key==='earcuffs')return 'earCuff';
  if(key==='cufflink'||key==='cufflinks'||key==='mancuernilla'||key==='mancuernillas')return 'cufflinks';
  return raw;
}

window.AGDP_setRenderMesh = function(nextMesh){
  if(_mesh3d){ _scene.remove(_mesh3d); _mesh3d.geometry.dispose(); _mesh3d=null; }
  if(_presentationAccessory){
    _scene.remove(_presentationAccessory);
    _disposeObject3D(_presentationAccessory);
    _presentationAccessory=null;
  }
  const prevTarget = _controls.target.clone();
  const prevPos = _camera.position.clone();
  _createControls();
  _controls.target.copy(prevTarget);
  _camera.position.copy(prevPos);
  if(!nextMesh || !nextMesh.V || !nextMesh.V.length){ _contactShadow.visible=false; _controls.update(); return; }
  const positions = new Float32Array(nextMesh.V.length*3);
  for(let i=0;i<nextMesh.V.length;i++){ positions[i*3]=nextMesh.V[i][0]; positions[i*3+1]=nextMesh.V[i][1]; positions[i*3+2]=nextMesh.V[i][2]; }
  const indices = new Uint32Array(nextMesh.F.length*3);
  for(let i=0;i<nextMesh.F.length;i++){ indices[i*3]=nextMesh.F[i][0]; indices[i*3+1]=nextMesh.F[i][1]; indices[i*3+2]=nextMesh.F[i][2]; }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions,3));
  geometry.setIndex(new THREE.BufferAttribute(indices,1));

  const type=_normalizedPresentationType(nextMesh);
  const strictNativeEarring=_isStrictNativeEarring(nextMesh);
  if(type==='cufflinks'&&!strictNativeEarring){
    // Preserve the incoming mesh pose and move each complete cufflink only
    // along X, reducing the centre-to-centre separation by exactly 15%.
    _arrangePairedComponents(geometry,{pairSpacingScale:.85});
  }

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
  const presentation=strictNativeEarring
    ? AGDP_PRESENTATION_VIEWS.hoopEarring
    : _presentationViewFor(nextMesh);
  if(strictNativeEarring){
    // Earring geometry remains untouched. Only the Three.js display object is
    // rotated for presentation; no vertex, face, pair-spacing or scale edit.
    const objectEuler=_degToRad3(presentation.objectEulerDeg||[0,90,0]);
    _mesh3d.position.set(0,0,0);
    _mesh3d.rotation.set(objectEuler[0],objectEuler[1],objectEuler[2],'XYZ');
    _mesh3d.scale.set(1,1,1);
    _mesh3d.updateMatrix();
  }else{
    const objectEuler=_degToRad3(presentation.objectEulerDeg||[0,0,0]);
    _mesh3d.rotation.set(objectEuler[0],objectEuler[1],objectEuler[2]);
  }
  _scene.add(_mesh3d);

  if(!strictNativeEarring&&type==='pendant'&&presentation.displayChain){
    _presentationAccessory=_createPendantDisplayChain(geometry,presentation);
    if(_presentationAccessory){
      _presentationAccessory.rotation.copy(_mesh3d.rotation);
      _scene.add(_presentationAccessory);
    }
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const sphere=geometry.boundingSphere;
  const radius=Math.max(1,sphere?sphere.radius:10);
  const fitRadius=radius;

  // Position a very soft contact shadow directly below the already-oriented
  // display mesh. This is presentation-only and applies to every typology.
  _mesh3d.updateMatrixWorld(true);
  const worldBox=new THREE.Box3().setFromObject(_mesh3d);
  const worldSize=worldBox.getSize(new THREE.Vector3());
  const worldCenter=worldBox.getCenter(new THREE.Vector3());
  const shadowWidth=Math.max(worldSize.x,radius*.55);
  const shadowDepth=Math.max(worldSize.z,radius*.42);
  _contactShadow.position.set(worldCenter.x,worldBox.min.y-Math.max(radius*.012,.002),worldCenter.z);
  _contactShadow.scale.set(shadowWidth*1.08,shadowDepth*.72,1);
  _contactShadow.visible=true;

  const verticalOffset=Number.isFinite(presentation.verticalOffset)?presentation.verticalOffset:0;
  _controls.target.set(0,radius*verticalOffset,0);
  const vFov=THREE.MathUtils.degToRad(_camera.fov);
  const hFov=2*Math.atan(Math.tan(vFov/2)*Math.max(0.35,_camera.aspect));
  const limitingFov=Math.min(vFov,hFov);
  const framing=Number.isFinite(presentation.framing)?presentation.framing:1.20;
  const fitDistance=(fitRadius/Math.sin(Math.max(0.08,limitingFov/2)))*framing;
  const cameraDirection=presentation.cameraDirection||[0.42,0.30,1];
  const dir=new THREE.Vector3(cameraDirection[0],cameraDirection[1],cameraDirection[2]).normalize();
  const normalizedCameraDirection=dir.clone();
  _camera.position.copy(dir.multiplyScalar(fitDistance));
  _camera.near=Math.max(0.01, radius*0.015);
  _camera.far=fitDistance+radius*8;
  _camera.updateProjectionMatrix();
  _controls.minDistance=Math.max(radius*0.18, 0.35);
  _controls.maxDistance=fitDistance*5;
  window.AGDP_LAST_PRESENTATION_AUDIT={
    rawType:nextMesh&&nextMesh.audit&&nextMesh.audit.type,
    strictNativeEarring,
    normalizedType:type,
    meshRotation:[_mesh3d.rotation.x,_mesh3d.rotation.y,_mesh3d.rotation.z],
    meshQuaternion:[_mesh3d.quaternion.x,_mesh3d.quaternion.y,_mesh3d.quaternion.z,_mesh3d.quaternion.w],
    meshScale:[_mesh3d.scale.x,_mesh3d.scale.y,_mesh3d.scale.z],
    cameraDirection:[normalizedCameraDirection.x,normalizedCameraDirection.y,normalizedCameraDirection.z],
    controlsTarget:[_controls.target.x,_controls.target.y,_controls.target.z]
  };
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
