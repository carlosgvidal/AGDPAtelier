import Module from 'manifold-3d';

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
const AGDP_MIN_WALL_MM = 0.8;
const AGDP_STRUCTURAL_WALL_MM = 1.3;

function meshToManifold(wasm, V, F) {
  const { Manifold, Mesh } = wasm;
  const positions = new Float32Array(V.length * 3);
  for (let i = 0; i < V.length; i++) { positions[i*3]=V[i][0]; positions[i*3+1]=V[i][1]; positions[i*3+2]=V[i][2]; }
  const triangles = new Uint32Array(F.length * 3);
  for (let i = 0; i < F.length; i++) { triangles[i*3]=F[i][0]; triangles[i*3+1]=F[i][1]; triangles[i*3+2]=F[i][2]; }
  const mesh = new Mesh({ numProp: 3, vertProperties: positions, triVerts: triangles });
  return new Manifold(mesh);
}
function manifoldToMesh(manifoldObj) {
  const out = manifoldObj.getMesh();
  const V = [], F = [];
  for (let i = 0; i < out.vertProperties.length; i += 3) V.push([out.vertProperties[i], out.vertProperties[i+1], out.vertProperties[i+2]]);
  for (let i = 0; i < out.triVerts.length; i += 3) F.push([out.triVerts[i], out.triVerts[i+1], out.triVerts[i+2]]);
  return { V, F };
}
function unionAll(wasm, manifolds) {
  const { Manifold } = wasm;
  let list = manifolds.filter(m => m && !m.isEmpty());
  if (list.length === 0) return Manifold.cube([0.001,0.001,0.001], true);
  while (list.length > 1) {
    const next = [];
    for (let i = 0; i < list.length; i += 2) {
      if (i + 1 < list.length) next.push(Manifold.union(list[i], list[i+1]));
      else next.push(list[i]);
    }
    list = next;
  }
  return list[0];
}
function cylinderBetween(wasm, p0, p1, radius, segments) {
  const { Manifold } = wasm;
  const dx=p1[0]-p0[0], dy=p1[1]-p0[1], dz=p1[2]-p0[2];
  const len = Math.hypot(dx,dy,dz) || 1e-6;
  const cyl = Manifold.cylinder(len, radius, radius, segments || 16, true);
  const ux=dx/len, uy=dy/len, uz=dz/len;
  const thetaDeg = Math.acos(clamp(uz,-1,1)) * 180/Math.PI;
  const phiDeg = Math.atan2(uy,ux) * 180/Math.PI;
  const rotated = cyl.rotate([0,thetaDeg,0]).rotate([0,0,phiDeg]);
  const mid=[(p0[0]+p1[0])/2,(p0[1]+p1[1])/2,(p0[2]+p1[2])/2];
  return rotated.translate(mid);
}
function sphereAt(wasm, center, radius, segments) {
  const { Manifold } = wasm;
  return Manifold.sphere(radius, segments || 20).translate(center);
}
function radialBlock(wasm, t, r, z, radialDepth, tangentWidth, height) {
  const { Manifold } = wasm;
  const box = Manifold.cube([radialDepth, tangentWidth, height], true);
  const angleDeg = t * 180/Math.PI;
  const rotated = box.rotate([0,0,angleDeg]);
  const cx = r*Math.cos(t), cy = r*Math.sin(t);
  return rotated.translate([cx, cy, z]);
}
function taperedProngMesh(t, r, z, tangentWidth, axialHeight, protrusion) {
  const er=[Math.cos(t),Math.sin(t),0], et=[-Math.sin(t),Math.cos(t),0];
  const ht=tangentWidth/2, hz=axialHeight/2;
  const base = [
    [r*er[0]-ht*et[0], r*er[1]-ht*et[1], z-hz],
    [r*er[0]+ht*et[0], r*er[1]+ht*et[1], z-hz],
    [r*er[0]+ht*et[0], r*er[1]+ht*et[1], z+hz],
    [r*er[0]-ht*et[0], r*er[1]-ht*et[1], z+hz],
  ];
  const apex=[(r+protrusion)*er[0], (r+protrusion)*er[1], z];
  const V=[...base, apex];
  const F=[[0,2,1],[0,3,2],[0,1,4],[1,2,4],[2,3,4],[3,0,4]];
  return {V,F};
}
function tubeAlongPathMesh(points, radius, ringSegN, closed) {
  ringSegN = Math.max(ringSegN||8,6);
  const n = points.length;
  const V=[], F=[];
  function tri(a,b,c){F.push([a,b,c]);}
  const tangents=[];
  for(let i=0;i<n;i++){
    const prev=points[closed?(i-1+n)%n:Math.max(0,i-1)], next=points[closed?(i+1)%n:Math.min(n-1,i+1)];
    const d=[next[0]-prev[0],next[1]-prev[1],next[2]-prev[2]];
    const l=Math.hypot(d[0],d[1],d[2])||1;
    tangents.push([d[0]/l,d[1]/l,d[2]/l]);
  }
  function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
  function norm(a){const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];}
  let ref=[0,0,1]; if(Math.abs(tangents[0][2])>0.9) ref=[1,0,0];
  let e1=norm(cross(ref,tangents[0])), e2=cross(tangents[0],e1);
  const rings=[];
  for(let i=0;i<n;i++){
    if(i>0){
      const tn=tangents[i], dot=e1[0]*tn[0]+e1[1]*tn[1]+e1[2]*tn[2];
      const proj=[e1[0]-tn[0]*dot,e1[1]-tn[1]*dot,e1[2]-tn[2]*dot];
      e1=norm(proj); e2=cross(tn,e1);
    }
    const ring=[];
    for(let k=0;k<ringSegN;k++){
      const ang=2*Math.PI*k/ringSegN, c=Math.cos(ang), s=Math.sin(ang);
      ring.push(V.length);
      V.push([points[i][0]+radius*(e1[0]*c+e2[0]*s), points[i][1]+radius*(e1[1]*c+e2[1]*s), points[i][2]+radius*(e1[2]*c+e2[2]*s)]);
    }
    rings.push(ring);
  }
  const segCount = closed?n:n-1;
  for(let i=0;i<segCount;i++){
    const a=rings[i], b=rings[(i+1)%n];
    for(let k=0;k<ringSegN;k++){
      const kp=(k+1)%ringSegN;
      tri(a[k],a[kp],b[kp]); tri(a[k],b[kp],b[k]);
    }
  }
  if(!closed){
    const capA=V.length; V.push(points[0].slice());
    for(let k=0;k<ringSegN;k++){const kp=(k+1)%ringSegN; tri(capA,rings[0][kp],rings[0][k]);}
    const capB=V.length; V.push(points[n-1].slice());
    for(let k=0;k<ringSegN;k++){const kp=(k+1)%ringSegN; tri(capB,rings[n-1][k],rings[n-1][kp]);}
  }
  return {V,F};
}
function simpleAnnularBandMesh(innerR, outerR, zCenter, width, seg, arcRad, closed) {
  arcRad = arcRad===undefined ? 2*Math.PI : arcRad;
  closed = closed===undefined ? true : closed;
  const half = width/2;
  const thetaN = closed ? seg : seg+1;
  const V=[], F=[], outer=[], inner=[];
  for (let i=0; i<thetaN; i++) {
    outer[i]=[]; inner[i]=[];
    const t = -arcRad/2 + arcRad*(i/seg), ct=Math.cos(t), st=Math.sin(t);
    for (let j=0; j<=1; j++) {
      const z = zCenter + (-half + width*j);
      outer[i][j]=V.length; V.push([outerR*ct, outerR*st, z]);
      inner[i][j]=V.length; V.push([innerR*ct, innerR*st, z]);
    }
  }
  function q(a,b,c,d){F.push([a,b,c]);F.push([a,c,d]);}
  for (let i=0;i<seg;i++) {
    const ip=closed?(i+1)%seg:i+1;
    q(outer[i][0],outer[ip][0],outer[ip][1],outer[i][1]);
    q(inner[i][0],inner[i][1],inner[ip][1],inner[ip][0]);
    q(outer[i][0],inner[i][0],inner[ip][0],outer[ip][0]);
    q(outer[i][1],outer[ip][1],inner[ip][1],inner[i][1]);
    if (!closed && i===0) q(outer[i][0],outer[i][1],inner[i][1],inner[i][0]);
    if (!closed && i===seg-1) q(outer[ip][1],outer[ip][0],inner[ip][0],inner[ip][1]);
  }
  return {V,F};
}
function taperedBridgeMesh(y0, y1, z0, th, w0, w1, steps) {
  const V=[], F=[], rows=[];
  for (let s=0;s<=steps;s++) {
    const u=s/steps, y=y0+(y1-y0)*u, w=w0+(w1-w0)*u;
    const zhalf=th*.50*(.92+.08*Math.cos(Math.PI*(u-.5)));
    const base=V.length;
    V.push([-w/2,y,z0-zhalf],[w/2,y,z0-zhalf],[w/2,y,z0+zhalf],[-w/2,y,z0+zhalf]);
    rows[s]=[base,base+1,base+2,base+3];
  }
  for (let s=0;s<steps;s++) {
    const a=rows[s], b=rows[s+1];
    F.push([a[0],b[0],b[1]]);F.push([a[0],b[1],a[1]]);
    F.push([a[1],b[1],b[2]]);F.push([a[1],b[2],a[2]]);
    F.push([a[2],b[2],b[3]]);F.push([a[2],b[3],a[3]]);
    F.push([a[3],b[3],b[0]]);F.push([a[3],b[0],a[0]]);
  }
  const a=rows[0], b=rows[steps];
  F.push([a[0],a[1],a[2]]);F.push([a[0],a[2],a[3]]);
  F.push([b[0],b[2],b[1]]);F.push([b[0],b[3],b[2]]);
  return {V,F};
}
function spike3DMesh(base, dir, baseR, length, segN) {
  segN = Math.max(segN||10, 6);
  const l = Math.hypot(dir[0],dir[1],dir[2])||1;
  const d = [dir[0]/l, dir[1]/l, dir[2]/l];
  let up=[0,0,1]; if (Math.abs(d[2])>0.9) up=[1,0,0];
  function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
  function norm(a){const ln=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/ln,a[1]/ln,a[2]/ln];}
  const e1=norm(cross(up,d)), e2=cross(d,e1);
  const V=[], F=[];
  const ringIdx=V.length;
  for (let k=0;k<segN;k++) {
    const ang=2*Math.PI*k/segN, c=Math.cos(ang), s=Math.sin(ang);
    V.push([base[0]+baseR*(e1[0]*c+e2[0]*s), base[1]+baseR*(e1[1]*c+e2[1]*s), base[2]+baseR*(e1[2]*c+e2[2]*s)]);
  }
  const apex=V.length; V.push([base[0]+d[0]*length, base[1]+d[1]*length, base[2]+d[2]*length]);
  const baseCenter=V.length; V.push(base.slice());
  for (let k=0;k<segN;k++) {
    const kp=(k+1)%segN;
    F.push([ringIdx+k, ringIdx+kp, apex]);
    F.push([baseCenter, ringIdx+kp, ringIdx+k]);
  }
  return {V,F};
}
function domeShellMesh(rimRFn, heightFn, seg, radSeg, indentFn) {
  const V=[], F=[];
  const top=[], bot=[];
  let apex=-1, botCenter=-1;
  for (let i=0;i<seg;i++) {
    top[i]=[]; bot[i]=[];
    const t=2*Math.PI*i/seg, ct=Math.cos(t), st=Math.sin(t);
    const rOut=rimRFn(t), hOut=heightFn(t);
    for (let j=0;j<=radSeg;j++) {
      const u=j/radSeg, phi=u*Math.PI/2;
      let rho0=rOut*Math.sin(phi), zTop0=hOut*Math.cos(phi);
      if (indentFn) { const ind=indentFn(t,u); rho0=Math.max(0,rho0-ind.dr); zTop0=zTop0-ind.dz; }
      if (j===0) {
        if (apex<0) { apex=V.length; V.push([0,0,heightFn(0)]); }
        top[i][j]=apex;
        if (botCenter<0) { botCenter=V.length; V.push([0,0,0]); }
        bot[i][j]=botCenter;
      } else {
        top[i][j]=V.length; V.push([rho0*ct, rho0*st, zTop0]);
        bot[i][j]=V.length; V.push([rOut*Math.sin(phi)*ct, rOut*Math.sin(phi)*st, 0]);
      }
    }
  }
  function q(a,b,c,d){F.push([a,c,b]);F.push([a,d,c]);}
  for (let i=0;i<seg;i++) {
    const ip=(i+1)%seg;
    F.push([top[i][0], top[i][1], top[ip][1]]);
    F.push([bot[i][0], bot[ip][1], bot[i][1]]);
    for (let j=1;j<radSeg;j++) {
      q(top[i][j],top[ip][j],top[ip][j+1],top[i][j+1]);
      q(bot[i][j],bot[i][j+1],bot[ip][j+1],bot[ip][j]);
    }
    q(top[i][radSeg],top[ip][radSeg],bot[ip][radSeg],bot[i][radSeg]);
  }
  const topGrid = [];
  for (let i=0;i<seg;i++) { topGrid[i]=[]; for (let j=0;j<=radSeg;j++) topGrid[i][j]=V[top[i][j]]; }
  return {V,F,topGrid};
}
function insertedRingManifold(wasm, origin, ex, ey, ez, ri, ro, thickness, segN) {
  const { Manifold } = wasm;
  const outer = Manifold.cylinder(thickness, ro, ro, segN || 48, true);
  const inner = Manifold.cylinder(thickness * 1.4, ri, ri, segN || 48, true);
  let ring = Manifold.difference(outer, inner);
  const nx=ez[0],ny=ez[1],nz=ez[2];
  const thetaDeg = Math.acos(clamp(nz,-1,1)) * 180/Math.PI;
  const phiDeg = Math.atan2(ny,nx) * 180/Math.PI;
  ring = ring.rotate([0,thetaDeg,0]).rotate([0,0,phiDeg]);
  return ring.translate(origin);
}
function rasterizeTextMaskNode(lines, cellsWide, cellsHigh) {
  return Array.from({length:cellsWide},()=>Array(cellsHigh).fill(false));
}
function curvedInteriorHallmarkMesh(innerR, comfortDepth, half, tCenter, tHalfSpan, uMin, uMax, engraveDepth, embedDepth, lines, rasterFn) {
  const cellsWide = Math.max(60, Math.round(tHalfSpan*2*40));
  const cellsHigh = Math.max(20, Math.round((uMax-uMin)*half*2*14));
  const mask = rasterFn(lines, cellsWide, cellsHigh);
  const front=[], back=[];
  const V=[], F=[];
  for(let i=0;i<=cellsWide;i++){front[i]=[];back[i]=[];
    for(let j=0;j<=cellsHigh;j++){
      const ui=i/cellsWide, uj=uMin+(uMax-uMin)*(j/cellsHigh);
      const t=tCenter-tHalfSpan+2*tHalfSpan*ui;
      const z=-half+2*half*uj;
      const riHere=innerR+comfortDepth*(z/Math.max(.001,half))*(z/Math.max(.001,half));
      const ci0=Math.max(0,i-1),ci1=Math.min(cellsWide-1,i);
      const cj0=Math.max(0,j-1),cj1=Math.min(cellsHigh-1,j);
      let inked=false;
      for(let ci=ci0;ci<=ci1&&!inked;ci++)for(let cj=cj0;cj<=cj1;cj++){if(mask[ci]&&mask[ci][cj]){inked=true;break;}}
      const ct=Math.cos(t), st=Math.sin(t);
      const rFront=riHere+(inked?engraveDepth:0);
      const rBack=riHere+embedDepth;
      front[i][j]=V.length; V.push([rFront*ct,rFront*st,z]);
      back[i][j]=V.length; V.push([rBack*ct,rBack*st,z]);
    }
  }
  function q(a,b,c,d){F.push([a,b,c]);F.push([a,c,d]);}
  for(let i=0;i<cellsWide;i++)for(let j=0;j<cellsHigh;j++){
    q(front[i][j],front[i][j+1],front[i+1][j+1],front[i+1][j]);
    q(back[i][j+1],back[i][j],back[i+1][j],back[i+1][j+1]);
  }
  for(let j=0;j<cellsHigh;j++){
    q(front[0][j],back[0][j],back[0][j+1],front[0][j+1]);
    q(front[cellsWide][j+1],back[cellsWide][j+1],back[cellsWide][j],front[cellsWide][j]);
  }
  for(let i=0;i<cellsWide;i++){
    q(front[i][0],front[i+1][0],back[i+1][0],back[i][0]);
    q(front[i][cellsHigh],back[i][cellsHigh],back[i+1][cellsHigh],front[i+1][cellsHigh]);
  }
  return {V,F};
}
function removeFloatingComponents(V,F,keepCount){
  keepCount=Math.max(1,keepCount||1);
  const vertFaces=new Map();
  for(let fi=0;fi<F.length;fi++){for(const v of F[fi]){let arr=vertFaces.get(v);if(!arr){arr=[];vertFaces.set(v,arr);}arr.push(fi);}}
  const parent=new Int32Array(F.length).fill(-1).map((_,i)=>i);
  function find(x){while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x;}
  function unite(a,b){a=find(a);b=find(b);if(a!==b)parent[b]=a;}
  for(const arr of vertFaces.values()){for(let i=1;i<arr.length;i++)unite(arr[0],arr[i]);}
  const compMap=new Map();
  for(let i=0;i<F.length;i++){const r=find(i);if(!compMap.has(r))compMap.set(r,[]);compMap.get(r).push(i);}
  const comps=Array.from(compMap.values());
  comps.sort((a,b)=>b.length-a.length);
  const keep=new Set();
  const largest=comps.length?comps[0].length:0;
  let retained=0;
  const discarded=[];
  for(let i=0;i<comps.length;i++){
    if(i>0&&comps[i].length<largest*0.12){ discarded.push({triangles:comps[i].length, fractionOfLargest:largest?comps[i].length/largest:0}); continue; }
    if(retained>=keepCount){ discarded.push({triangles:comps[i].length, fractionOfLargest:largest?comps[i].length/largest:0}); continue; }
    for(const fi of comps[i])keep.add(fi);
    retained++;
  }
  const outF=[];
  for(let i=0;i<F.length;i++) if(keep.has(i)) outF.push(F[i]);
  const used=new Uint8Array(V.length);
  outF.forEach(f=>{used[f[0]]=1;used[f[1]]=1;used[f[2]]=1;});
  const remap=new Int32Array(V.length).fill(-1);
  const NV=[];
  for(let i=0;i<V.length;i++){if(used[i]){remap[i]=NV.length;NV.push(V[i]);}}
  const NF=outF.map(f=>[remap[f[0]],remap[f[1]],remap[f[2]]]);
  return {V:NV,F:NF,discarded,totalComponents:comps.length,retainedComponents:retained};
}

function cellularHoleField(p,seg,zSeg){
  const cols=Math.round(clamp(10+p.holes*1.5,10,20));
  const rows=Math.round(clamp(3+p.frames*2,3,6));
  const angular=(p.faceting||0)>=0.22;
  const rng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|cellular');
  const safeZoneStart=0.20*zSeg, safeZoneSpan=0.60*zSeg;
  const seeds=[];
  for(let a=0;a<cols;a++)for(let b=0;b<rows;b++){
    const jitterI=(rng()*2-1)*0.32,jitterJ=(rng()*2-1)*0.30;
    seeds.push({ci:(a+0.5+jitterI)*(seg/cols),cj:safeZoneStart+(b+0.5+jitterJ)*(safeZoneSpan/rows)});
  }
  const cellSpacingI=seg/cols,cellSpacingJ=safeZoneSpan/rows;
  const wallFrac=0.44+rng()*0.08;
  function dist(i,j,s){
    let di=Math.abs(i-s.ci);di=Math.min(di,seg-di);
    const dj=j-s.cj;
    if(angular)return Math.max(di/cellSpacingI,Math.abs(dj)/cellSpacingJ);
    return Math.hypot(di/cellSpacingI,dj/cellSpacingJ);
  }
  return function(i,j){
    const u=(j+0.5)/zSeg;
    if(u<0.15||u>0.85)return false;
    let best=Infinity;
    for(const s of seeds){const d=dist(i,j,s);if(d<best)best=d;}
    return best<(1-wallFrac);
  };
}
function repairSolidConnectivity(hole,seg,zSeg,innerR,bandWidth){
  const compId=Array.from({length:seg},()=>Array(zSeg).fill(-1));
  const comps=[];
  for(let i=0;i<seg;i++)for(let j=0;j<zSeg;j++){
    if(hole[i][j]||compId[i][j]!==-1)continue;
    const stack=[[i,j]];compId[i][j]=comps.length;
    const cells=[];
    while(stack.length){
      const cur=stack.pop(),ci=cur[0],cj=cur[1];cells.push(cur);
      const neigh=[[(ci+1)%seg,cj],[(ci-1+seg)%seg,cj],[ci,cj+1],[ci,cj-1]];
      for(let k=0;k<neigh.length;k++){
        const ni=neigh[k][0],nj=neigh[k][1];
        if(nj<0||nj>=zSeg)continue;
        if(hole[ni][nj]||compId[ni][nj]!==-1)continue;
        compId[ni][nj]=comps.length;stack.push([ni,nj]);
      }
    }
    comps.push(cells);
  }
  if(comps.length<=1)return;
  comps.sort((a,b)=>b.length-a.length);
  function boundaryCells(cells){
    const out=[];
    for(const c of cells){
      const i=c[0],j=c[1];
      const neigh=[[(i+1)%seg,j],[(i-1+seg)%seg,j],[i,j+1],[i,j-1]];
      let onEdge=false;
      for(let k=0;k<neigh.length;k++){const ni=neigh[k][0],nj=neigh[k][1];if(nj<0||nj>=zSeg||hole[ni][nj]){onEdge=true;break;}}
      if(onEdge)out.push(c);
    }
    return out.length?out:cells;
  }
  const MIN_BRIDGE_MM=1.1;
  const mmPerAngularCell=innerR?(2*Math.PI*innerR)/seg:0.3;
  const mmPerAxialCell=bandWidth?bandWidth/zSeg:0.3;
  const radiusI=Math.max(1,Math.ceil(MIN_BRIDGE_MM/mmPerAngularCell/2));
  const radiusJ=Math.max(1,Math.ceil(MIN_BRIDGE_MM/mmPerAxialCell/2));
  function unholeNeighborhood(ci,cj){
    for(let di=-radiusI;di<=radiusI;di++){
      const ni=((ci+di)%seg+seg)%seg;
      for(let dj=-radiusJ;dj<=radiusJ;dj++){
        const nj=cj+dj;
        if(nj<0||nj>=zSeg)continue;
        hole[ni][nj]=false;
      }
    }
  }
  const mainBoundary=boundaryCells(comps[0]);
  for(let ci=1;ci<comps.length;ci++){
    const otherBoundary=boundaryCells(comps[ci]);
    let best=null,bestD=Infinity;
    for(const a of mainBoundary){
      for(const b of otherBoundary){
        let di=Math.abs(a[0]-b[0]);di=Math.min(di,seg-di);
        const dj=a[1]-b[1];
        const d=di*di+dj*dj;
        if(d<bestD){bestD=d;best=[a,b];}
      }
    }
    if(!best)continue;
    const a=best[0],b=best[1];
    let curI=a[0],curJ=a[1];
    unholeNeighborhood(curI,curJ);
    let remI=b[0]-curI;if(Math.abs(remI)>seg/2)remI=remI>0?remI-seg:remI+seg;
    let remJ=b[1]-curJ;
    let guard=seg+zSeg+4;
    while((remI!==0||remJ!==0)&&guard-->0){
      if(Math.abs(remI)>=Math.abs(remJ)&&remI!==0){
        curI=((curI+(remI>0?1:-1))%seg+seg)%seg;remI+=remI>0?-1:1;
      }else if(remJ!==0){
        curJ+=remJ>0?1:-1;remJ+=remJ>0?-1:1;
      }else if(remI!==0){
        curI=((curI+(remI>0?1:-1))%seg+seg)%seg;remI+=remI>0?-1:1;
      }
      curJ=Math.max(0,Math.min(zSeg-1,curJ));
      unholeNeighborhood(curI,curJ);
    }
  }
}
function facetedRadius(t, rBase, facetCount, facetDepth) {
  if (facetCount <= 0 || facetDepth <= 0) return rBase;
  const period = 2 * Math.PI / facetCount;
  let u = t % period; if (u < 0) u += period; u /= period;
  const rampFrac = .24;
  let depth;
  if (u < rampFrac) depth = u / rampFrac;
  else if (u > 1 - rampFrac) depth = (1 - u) / rampFrac;
  else depth = 1;
  return rBase - facetDepth * (1 - depth);
}


async function buildBandGeometryManifold(wasm, p, opts) {
  const closed = opts.closed, seg = p.segments, zSeg = Math.max(44, Math.min(96, Math.round(p.segments/3.5)));
  const innerR = opts.innerD/2, bandW = opts.width, half = bandW/2;
  const arcRad = closed ? Math.PI*2 : (Math.PI*2 - (opts.opening||0)*Math.PI/180);
  const thetaN = closed ? seg : seg+1;
  const isKnot = false;

  if (isKnot) {
    const strandCount = Math.max(2, Math.round(clamp(p.holes||2,2,4)));
    const strandR = Math.max(AGDP_MIN_WALL_MM*0.95, bandW*0.12);
    const windR = innerR + strandR*1.9;
    const windCount = Math.max(2, Math.round(clamp((p.frames||0)*4,2,5)));
    const pathSegN = Math.max(140, seg);
    const parts = [];
    for (let s=0; s<strandCount; s++) {
      const phase = 2*Math.PI*s/strandCount;
      const points = [];
      for (let k=0; k<pathSegN; k++) {
        const u = k/pathSegN;
        const t = closed ? 2*Math.PI*u : (-arcRad/2 + arcRad*u);
        const axialWobble = Math.sin(windCount*t+phase)*half*0.62;
        const radialWobble = Math.cos(windCount*t+phase)*strandR*0.85;
        const rr = windR + radialWobble;
        points.push([rr*Math.cos(t), rr*Math.sin(t), axialWobble]);
      }
      const strandMesh = tubeAlongPathMesh(points, strandR, 10, closed);
      parts.push(meshToManifold(wasm, strandMesh.V, strandMesh.F));
    }
    if (!closed) {
      const ballR = Math.max(AGDP_MIN_WALL_MM*1.1, strandR*1.3);
      [-arcRad/2, arcRad/2].forEach(te => {
        const ct=Math.cos(te), st=Math.sin(te);
        parts.push(sphereAt(wasm, [windR*ct, windR*st, 0], ballR, 14));
      });
    }
    const beadCount = Math.round(clamp((p.rivets||0)+(p.nodes||0),0,4));
    for (let k=0;k<beadCount;k++) {
      const u = (k+0.5)/Math.max(1,beadCount);
      const t = closed ? 2*Math.PI*u : (-arcRad/2 + arcRad*u);
      const axialWobble = Math.sin(windCount*t)*half*0.62;
      const radialWobble = Math.cos(windCount*t)*strandR*0.85;
      const rr = windR + radialWobble;
      const beadR = Math.max(AGDP_MIN_WALL_MM*0.6, strandR*0.85);
      const embed = beadR*0.6;
      const cx=rr*Math.cos(t), cy=rr*Math.sin(t);
      const nx=Math.cos(t), ny=Math.sin(t);
      parts.push(sphereAt(wasm, [cx+nx*(beadR-embed), cy+ny*(beadR-embed), axialWobble], beadR, 12));
    }
    {
      const featureWeightsK=p.featureWeights||{};
      const pathWeightK={
        cageLattice: Math.max(featureWeightsK.cage||0, featureWeightsK.lattice||0),
        vesselDome: Math.max(featureWeightsK.vessel||0, featureWeightsK.dome||0),
        wrapped: featureWeightsK.wrapped||0,
        cellular: featureWeightsK.cellular||0,
      };
      const accentRngK = window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|full-vocabulary-knot');
      Object.keys(pathWeightK).forEach((pathKey,index)=>{
        const intensity = clamp(Math.max(0.14, pathWeightK[pathKey]), 0.14, 1.0);
        const instances = intensity>=0.55 ? 2 : 1;
        const basePhase = accentRngK()*Math.PI*2;
        const spread = Math.PI*2/5;
        for(let inst=0; inst<instances; inst++){
          const t = basePhase + index*spread + inst*0.6 + accentRngK()*0.2;
          const ct=Math.cos(t), st=Math.sin(t);
          const rr = windR + strandR*(1.6+intensity*1.4);
          const z = (inst%2?1:-1)*half*0.35;
          if(pathKey==='vesselDome'){
            const bigR=Math.max(AGDP_MIN_WALL_MM*1.0,strandR*(1.1+1.2*intensity));
            parts.push(sphereAt(wasm,[rr*ct,rr*st,z],bigR,14));
          }else if(pathKey==='cageLattice'){
            const barR=Math.max(AGDP_MIN_WALL_MM*0.65,strandR*(0.55+0.5*intensity));
            const halfSpan=half*(0.18+0.16*intensity);
            parts.push(cylinderBetween(wasm,[rr*ct,rr*st,z-halfSpan],[rr*ct,rr*st,z+halfSpan],barR,12));
            parts.push(sphereAt(wasm,[rr*ct,rr*st,z-halfSpan],barR*1.3,10));
            parts.push(sphereAt(wasm,[rr*ct,rr*st,z+halfSpan],barR*1.3,10));
          }else if(pathKey==='wrapped'){
            const bumpR=Math.max(AGDP_MIN_WALL_MM*0.7,strandR*(0.9+0.9*intensity));
            parts.push(sphereAt(wasm,[rr*ct,rr*st,z],bumpR,14));
          }else if(pathKey==='cellular'){
            const sr=Math.max(AGDP_MIN_WALL_MM*0.6,strandR*(0.75+0.7*intensity));
            const anchor=[windR*ct,windR*st,z];
            const center=[rr*ct,rr*st,z];
            parts.push(sphereAt(wasm,center,sr,12));
            parts.push(cylinderBetween(wasm,anchor,center,sr*0.55,10));
          }
        }
      });
    }
    const result = unionAll(wasm, parts);
    return { manifold: result, bandW };
  }

  const computedWall = AGDP_STRUCTURAL_WALL_MM*(0.95+p.architectural*0.85+p.sideRelief*3.4);
  const baseWall = Math.max(AGDP_STRUCTURAL_WALL_MM, opts.type==='choker'?(p.chokerWallMm||computedWall):opts.type==='headpiece'?(p.headWallMm||computedWall):opts.type==='comb'?(p.combBodyWallMm||computedWall):computedWall);
  const facetCount = p.forcedSides!==undefined ? (p.forcedSides>0?Math.round(p.forcedSides):0) : (p.faceting>0.14?Math.round(clamp(6+p.faceting*44,6,48)):0);
  const facetDepth = facetCount<=0?0:(p.forcedSides!==undefined ? Math.min(baseWall*0.68, 0.55+Math.max(0,6-facetCount)*0.11+p.faceting*0.5) : Math.min(baseWall*0.55, 0.28+p.faceting*1.05));
  const coverageOffset = (p.articulationOffset||0)*Math.PI/180;
  const coverageHalf = p.crown ? Math.max(0.35,(p.crownArc||64)*Math.PI/180/2*1.35) : Math.PI;
  const coverageCore = coverageHalf*0.72;
  function coverageMask(t) {
    if (!p.crown) return 1;
    const d = Math.abs(wrap(t-coverageOffset));
    if (d<=coverageCore) return 1;
    if (d>=coverageHalf) return 0;
    return 1-(d-coverageCore)/(coverageHalf-coverageCore);
  }
  // Structural rail/post emphasis is now a continuous quantity, not a
  // topology switch: every ring/bangle/cuff/choker/headpiece is built from
  // the same single continuous surface, and higher lattice+cage intensity
  // simply adds more and thicker structural posts on top of it — never a
  // separate, unrelated rail-based construction. This is what actually
  // removes the "two families" split: one topology, one spectrum.
  const lattice = featureIntensity(p,'lattice');
  const cage = featureIntensity(p,'cage');
  const postIntensity = p.holes>=2 ? clamp((lattice+cage)/1.6, 0, 1) : 0;
  const grooveCount = Math.round(clamp(p.railCount||0,0,2));
  const grooveDepth = grooveCount>0 ? Math.min(baseWall*0.4, 0.22+p.sideRelief*2.6) : 0;
  const grooveWidth = Math.max(0.25, bandW*0.055);
  function grooveMask(z) {
    if (grooveCount<=0) return 0;
    let m=0;
    for (let k=0;k<grooveCount;k++) {
      const u = grooveCount===1?.5:k/(grooveCount-1);
      const zk = -half*0.55+half*1.1*u;
      const d = z-zk;
      m = Math.max(m, Math.exp(-(d*d)/(2*grooveWidth*grooveWidth)));
    }
    return m;
  }
  const zoneMassActive = ((p.featureWeights?.vessel||0)>.18 || ((p.organic||0)>=0.40&&(p.asymmetry||0)>=0.25));
  const zoneCenter = (p.articulationOffset||0)*Math.PI/180;
  const zoneWidthA = Math.max(0.35,(p.crownArc||64)*Math.PI/180*0.55);
  const zoneWidthB = zoneWidthA*0.62;
  const zoneSecondOffset = zoneWidthA*0.95;
  const zoneMassDepth = zoneMassActive ? Math.min(baseWall*2.0, 0.5+p.surfaceRelief*5.5+p.organic*2.0) : 0;
  function zoneMassMask(t) {
    if (!zoneMassActive) return 0;
    const d1 = wrap(t-zoneCenter);
    const lobeA = Math.exp(-(d1*d1)/(2*zoneWidthA*zoneWidthA));
    const d2 = wrap(t-(zoneCenter+zoneSecondOffset));
    const lobeB = Math.exp(-(d2*d2)/(2*zoneWidthB*zoneWidthB))*0.60;
    return Math.min(1.25, lobeA+lobeB);
  }
  const comfortActive = opts.type==='ring';
  const comfortDepth = comfortActive ? Math.min(baseWall*0.28, 0.30) : 0;

  const V=[], outer=[], inner=[];
  const lateralOpsActive = opts.type==='ring'||opts.type==='bangle'||opts.type==='cuffBracelet'||opts.type==='earCuff'||opts.type==='choker'||opts.type==='headpiece'||opts.type==='pendantAnnularCore';
  const lateralSeg = lateralOpsActive ? Math.max(10,Math.min(24,Math.round(zSeg/3))) : 1;
  const lateralTop = lateralOpsActive ? [] : null;
  const lateralBottom = lateralOpsActive ? [] : null;
  const nominalOuterRadius = innerR + comfortDepth + baseWall;
  function outerOperationField(t,z){
    const rFaceBase = facetedRadius(t, nominalOuterRadius, facetCount, facetDepth*coverageMask(t));
    const axialTaper = 1-Math.pow(Math.abs(z/Math.max(.001,half)),1.4)*0.55;
    return rFaceBase - grooveDepth*grooveMask(z) + zoneMassDepth*zoneMassMask(t)*axialTaper - nominalOuterRadius;
  }
  for (let i=0;i<thetaN;i++) {
    outer[i]=[]; inner[i]=[];
    const t = -arcRad/2+arcRad*(i/seg), ct=Math.cos(t), st=Math.sin(t);
    const rFaceBase = facetedRadius(t, nominalOuterRadius, facetCount, facetDepth*coverageMask(t));
    const massHere = zoneMassMask(t);
    for (let j=0;j<=zSeg;j++) {
      const z = -half+bandW*j/zSeg;
      const axialTaper = 1-Math.pow(Math.abs(z/Math.max(.001,half)),1.4)*0.55;
      let rFace = rFaceBase - grooveDepth*grooveMask(z) + zoneMassDepth*massHere*axialTaper;
      const baseInnerRadius = innerR + comfortDepth*(z/Math.max(.001,half))*(z/Math.max(.001,half));
      const radialField = rFace - nominalOuterRadius;
      const ri = opts.type==='pendantAnnularCore'
        ? baseInnerRadius + radialField
        : baseInnerRadius;
      rFace = Math.max(rFace, ri+AGDP_STRUCTURAL_WALL_MM);
      outer[i][j]=V.length; V.push([rFace*ct, rFace*st, z]);
      inner[i][j]=V.length; V.push([ri*ct, ri*st, z]);
    }
    if(lateralOpsActive){
      lateralTop[i]=[]; lateralBottom[i]=[];
      lateralTop[i][0]=inner[i][zSeg];
      lateralBottom[i][0]=inner[i][0];
      lateralTop[i][lateralSeg]=outer[i][zSeg];
      lateralBottom[i][lateralSeg]=outer[i][0];
      const topInnerR=Math.hypot(V[inner[i][zSeg]][0],V[inner[i][zSeg]][1]);
      const topOuterR=Math.hypot(V[outer[i][zSeg]][0],V[outer[i][zSeg]][1]);
      const bottomInnerR=Math.hypot(V[inner[i][0]][0],V[inner[i][0]][1]);
      const bottomOuterR=Math.hypot(V[outer[i][0]][0],V[outer[i][0]][1]);
      for(let k=1;k<lateralSeg;k++){
        const u=k/lateralSeg;
        const envelope=Math.sin(Math.PI*u);
        const virtualZ=-half+bandW*u;
        const lateralField=outerOperationField(t,virtualZ)*envelope;
        const rt=topInnerR+(topOuterR-topInnerR)*u;
        const rb=bottomInnerR+(bottomOuterR-bottomInnerR)*u;
        lateralTop[i][k]=V.length; V.push([rt*ct,rt*st,half+lateralField]);
        lateralBottom[i][k]=V.length; V.push([rb*ct,rb*st,-half-lateralField]);
      }
    }
  }
  const hole = Array.from({length:seg}, () => Array(zSeg).fill(false));
  const cellularActive = p.holes>0 && ((p.featureWeights?.cellular||0)>.16);
  if (p.holes>0 && cellularActive) {
    for (let i=0;i<seg;i++) for (let j=0;j<zSeg;j++) hole[i][j] = false;
  } else if (p.holes>0) {
    const slotCount = Math.round(clamp(p.holes,1,8));
    const slotPeriod = Math.max(3, Math.floor(seg/slotCount));
    const rawSlotWidth = Math.max(1, Math.round(slotPeriod*0.18));
    const minSolidSegs = Math.max(2, Math.round(seg*0.015));
    const slotWidth = Math.min(rawSlotWidth, Math.max(1, slotPeriod-minSolidSegs));
    const slotRows = Math.round(clamp(1+p.frames*2,1,3));
    for (let i=0;i<seg;i++) {
      const inSlotCol = (i%slotPeriod)<slotWidth;
      if (!inSlotCol) continue;
      if (p.crown) {
        const t = -arcRad/2+arcRad*(i/seg);
        if (coverageMask(t)>0.35) continue;
      }
      for (let j=0;j<zSeg;j++) {
        const u = (j+.5)/zSeg;
        if (u<0.18||u>0.82) continue;
        let inRow=false;
        for (let r=0;r<slotRows;r++) {
          const rowCenter=(r+1)/(slotRows+1);
          if (Math.abs(u-rowCenter)<(0.24/slotRows)) inRow=true;
        }
        hole[i][j]=inRow;
      }
    }
  }
  if (!closed) { for (let j=0;j<zSeg;j++) { hole[0][j]=false; hole[seg-1][j]=false; } }

  const F=[];
  function q(a,b,c,d){F.push([a,b,c]);F.push([a,c,d]);}
  for (let i=0;i<seg;i++) { const ip=closed?(i+1)%seg:i+1; for (let j=0;j<zSeg;j++) {
    if (!hole[i][j]) { q(outer[i][j],outer[ip][j],outer[ip][j+1],outer[i][j+1]); q(inner[i][j],inner[i][j+1],inner[ip][j+1],inner[ip][j]); }
    if (!lateralOpsActive&&!closed&&i===0&&!hole[i][j]) q(outer[i][j],outer[i][j+1],inner[i][j+1],inner[i][j]);
    if (!lateralOpsActive&&!closed&&i===seg-1&&!hole[i][j]) q(outer[ip][j+1],outer[ip][j],inner[ip][j],inner[ip][j+1]);
    if (!lateralOpsActive&&j===0&&!hole[i][j]) q(outer[i][0],inner[i][0],inner[ip][0],outer[ip][0]);
    if (!lateralOpsActive&&j===zSeg-1&&!hole[i][j]) q(outer[i][zSeg],outer[ip][zSeg],inner[ip][zSeg],inner[i][zSeg]);
    if (hole[i][j]) {
      const im=closed?(i-1+seg)%seg:i-1, jn=j-1, jp=j+1;
      if (im<0||!hole[im][j]) q(outer[i][j],inner[i][j],inner[i][j+1],outer[i][j+1]);
      if (!hole[(i+1)%seg]?.[j]||(!closed&&i===seg-1)) q(outer[ip][j+1],inner[ip][j+1],inner[ip][j],outer[ip][j]);
      if (jn<0||!hole[i][jn]) q(outer[ip][j],inner[ip][j],inner[i][j],outer[i][j]);
      if (jp>=zSeg||!hole[i][jp]) q(outer[i][j+1],inner[i][j+1],inner[ip][j+1],outer[ip][j+1]);
    }
  }}
  if(lateralOpsActive){
    for(let i=0;i<seg;i++){
      const ip=closed?(i+1)%seg:i+1;
      for(let k=0;k<lateralSeg;k++){
        q(lateralTop[i][k+1],lateralTop[ip][k+1],lateralTop[ip][k],lateralTop[i][k]);
        q(lateralBottom[i][k],lateralBottom[ip][k],lateralBottom[ip][k+1],lateralBottom[i][k+1]);
      }
    }
    if(!closed){
      function capOpenEnd(i, reverse){
        const loop=[];
        if(!reverse){
          // Inicio del arco: recorrer el perímetro en sentido opuesto a las
          // aristas de frontera de las superficies adyacentes.
          for(let j=0;j<=zSeg;j++) loop.push(outer[i][j]);
          for(let k=lateralSeg-1;k>=0;k--) loop.push(lateralTop[i][k]);
          for(let j=zSeg-1;j>=0;j--) loop.push(inner[i][j]);
          for(let k=1;k<lateralSeg;k++) loop.push(lateralBottom[i][k]);
        }else{
          // Final del arco: la orientación exterior es la inversa.
          for(let j=zSeg;j>=0;j--) loop.push(outer[i][j]);
          for(let k=lateralSeg-1;k>=0;k--) loop.push(lateralBottom[i][k]);
          for(let j=1;j<=zSeg;j++) loop.push(inner[i][j]);
          for(let k=1;k<lateralSeg;k++) loop.push(lateralTop[i][k]);
        }
        const unique=[];
        for(const index of loop){
          if(unique.length===0||unique[unique.length-1]!==index) unique.push(index);
        }
        if(unique.length>2&&unique[0]===unique[unique.length-1]) unique.pop();
        const center=[0,0,0];
        for(const index of unique){
          center[0]+=V[index][0];center[1]+=V[index][1];center[2]+=V[index][2];
        }
        center[0]/=unique.length;center[1]/=unique.length;center[2]/=unique.length;
        const centerIndex=V.length;V.push(center);
        for(let n=0;n<unique.length;n++){
          F.push([centerIndex,unique[n],unique[(n+1)%unique.length]]);
        }
      }
      capOpenEnd(0,false);
      capOpenEnd(seg,true);
    }
  }

  const surfaceR = innerR+baseWall;
  const localSurfaceBase = t => facetedRadius(t, surfaceR, facetCount, facetDepth);
  const localSurfaceR = t => localSurfaceBase(t)+zoneMassDepth*zoneMassMask(t);
  const localSurfaceRZ = (t,z) => {
    const axialTaper = 1-Math.pow(Math.abs(z/Math.max(.001,half)),1.4)*0.55;
    const riHere = innerR+comfortDepth*(z/Math.max(.001,half))*(z/Math.max(.001,half));
    const raw = localSurfaceBase(t)-grooveDepth*grooveMask(z)+zoneMassDepth*zoneMassMask(t)*axialTaper;
    return Math.max(raw, riHere+AGDP_STRUCTURAL_WALL_MM);
  };
  const embedAt = t => { const w=localSurfaceR(t)-innerR; return Math.max(0.18, w*0.98); };
  const embedAtZ = (t,z) => { const w=localSurfaceRZ(t,z)-innerR; return Math.max(0.18, w*0.98); };

  let bodyManifold = meshToManifold(wasm, V, F);
  const decorations = [];

  const ribCount = cellularActive ? 0 : Math.round(clamp(p.architectural*6.2,0,7));
  if (ribCount>0) {
    const ribHeight = Math.max(AGDP_MIN_WALL_MM*0.65, AGDP_MIN_WALL_MM*0.52+p.surfaceRelief*8);
    const ribWidth = Math.max(AGDP_MIN_WALL_MM*0.95, bandW*0.095);
    for (let k=0;k<ribCount;k++) {
      const t = -arcRad/2+arcRad*((k+.5)/ribCount);
      const cov = coverageMask(t);
      if (cov<=0.02) continue;
      decorations.push(radialBlock(wasm, t, localSurfaceRZ(t,0)+ribHeight*cov/2-embedAtZ(t,0), 0, ribHeight*cov, ribWidth, bandW*0.82));
    }
  }
  // Posts scale continuously with postIntensity — zero at low intensity
  // (a clean continuous surface, indistinguishable from the old
  // non-lattice look), growing gradually to several thick struts at high
  // intensity (the old lattice look), all as an addition to the same
  // surface rather than a swapped-in separate topology.
  const postCount = Math.round(postIntensity*6.4);
  if (postCount>0) {
    const postDepth = Math.max(AGDP_MIN_WALL_MM*1.2, baseWall*(0.45+0.55*postIntensity));
    const postWidth = Math.max(AGDP_MIN_WALL_MM*1.05, baseWall*(0.38+0.5*postIntensity));
    for (let k=0;k<postCount;k++) {
      const t = -arcRad/2+arcRad*(k/postCount)+(closed?0:arcRad/(postCount*2));
      decorations.push(radialBlock(wasm, t, localSurfaceRZ(t,0)+postDepth/2-embedAtZ(t,0), 0, postDepth, postWidth, bandW*(0.72+0.22*postIntensity)));
    }
  }

  const pinCount = cellularActive ? 0 : Math.round(p.screws||0);
  if (pinCount>0) {
    const pinR = Math.max(AGDP_MIN_WALL_MM*0.35, baseWall*0.16);
    for (let k=0;k<pinCount;k++) {
      const u = pinCount===1?.5:k/(pinCount-1);
      const t = -arcRad/2+arcRad*(0.15+0.7*u);
      const ct=Math.cos(t), st=Math.sin(t);
      const rInner=innerR, rOuter=localSurfaceRZ(t,0)+pinR*0.8;
      decorations.push(cylinderBetween(wasm, [rInner*ct,rInner*st,0], [rOuter*ct,rOuter*st,0], pinR, 12));
    }
  }
  const rivetCount = cellularActive ? 0 : Math.round(p.rivets||0);
  if (rivetCount>0) {
    const rivetR = Math.max(AGDP_MIN_WALL_MM*0.3, baseWall*0.13);
    for (let k=0;k<rivetCount;k++) {
      const u = rivetCount===1?.5:k/(rivetCount-1);
      const t = -arcRad/2+arcRad*(0.2+0.6*u);
      const ct=Math.cos(t), st=Math.sin(t);
      const rivetZ = (k%2?1:-1)*bandW*0.22;
      const localEmbed = Math.min(embedAtZ(t,rivetZ), rivetR*0.9);
      const rOut = localSurfaceRZ(t,rivetZ)+rivetR-localEmbed;
      decorations.push(sphereAt(wasm, [rOut*ct,rOut*st,rivetZ], rivetR, 10));
    }
  }
  const plainBody = facetCount===0 && p.holes<=0 && (p.architectural||0)*10<0.5;
  const insertRingMode = !closed && plainBody && Math.round(p.nodes||0)>=1;
  if (insertRingMode) {
    const t0=0, ct0=Math.cos(t0), st0=Math.sin(t0);
    const surfaceHere = localSurfaceRZ(t0,0);
    const ringOuterR = Math.max(AGDP_MIN_WALL_MM*1.4, baseWall*1.9+p.nodeVolume*0.9);
    const ringInnerR = Math.max(AGDP_MIN_WALL_MM*0.7, ringOuterR-baseWall*1.1);
    const ringThickness = Math.max(AGDP_MIN_WALL_MM*0.8, baseWall*0.6);
    const ex=[-st0,ct0,0], ey=[0,0,1], ez=[ct0,st0,0];
    const overlapMargin = Math.min(ringOuterR*0.3, baseWall*0.5);
    const originRadial = surfaceHere+ringOuterR-overlapMargin;
    const origin=[originRadial*ct0, originRadial*st0, 0];
    decorations.push(insertedRingManifold(wasm, origin, ex, ey, ez, ringInnerR, ringOuterR, ringThickness, 40));
  }
  const nodeCount = (insertRingMode||cellularActive) ? 0 : Math.max(0, Math.round(p.nodes||0));
  if (nodeCount>0) {
    const cov = (p.articulationCoverage||120)*Math.PI/180;
    for (let k=0;k<nodeCount;k++) {
      const u = nodeCount===1?.5:k/(nodeCount-1);
      const t = (p.articulationOffset||0)*Math.PI/180-cov/2+cov*u;
      const sr = Math.max(AGDP_MIN_WALL_MM*0.7, 0.45+p.nodeVolume*.3);
      const nodeZ = (k%2?1:-1)*bandW*0.18;
      const localEmbed = Math.min(embedAtZ(t,nodeZ), sr*0.9);
      const rr = localSurfaceRZ(t,nodeZ)+sr-localEmbed;
      decorations.push(sphereAt(wasm, [rr*Math.cos(t), rr*Math.sin(t), nodeZ], sr, 14));
    }
  }
  if (closed && (opts.type==='ring'||opts.type==='bangle')) {
    const hallmarkArcMm = 8.5;
    const tHalfSpan = Math.min(Math.PI*0.4, (hallmarkArcMm/2)/Math.max(innerR,3));
    const engraveDepth = 0.34;
    const embedDepthHallmark = Math.max(0.5, baseWall*0.85);
    const hallmarkMesh = curvedInteriorHallmarkMesh(innerR, comfortDepth, half, 0, tHalfSpan, 0.08, 0.92, engraveDepth, embedDepthHallmark, ['A','GROSS','DOMESTIC','PRODUCT.\u00AE','925'], rasterizeTextMaskNode);
    decorations.push(meshToManifold(wasm, hallmarkMesh.V, hallmarkMesh.F));
  }
  if (!closed) {
    const tEnd0=-arcRad/2, tEnd1=arcRad/2;
    [tEnd0, tEnd1].forEach(te => {
      const ct=Math.cos(te), st=Math.sin(te);
      const wallHere = localSurfaceRZ(te,0)-innerR;
      const ballR = Math.max(AGDP_MIN_WALL_MM*1.1, wallHere*0.62);
      const rCenter = innerR+ballR;
      decorations.push(sphereAt(wasm, [rCenter*ct, rCenter*st, 0], ballR, 14));
    });
  }

  const featureWeights=p.featureWeights||{};
  const floors={lattice:.24,vessel:.18,cellular:.22};
  const accentRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|transversal-subtractive-v106');
  const voidCutters=[];
  const applyTransversalCuts = true;
  const phase=(p.compositionSignature?.phaseA||0)+accentRng()*Math.PI*2;

  const latticeI=clamp(Math.max(floors.lattice,featureWeights.lattice||0),floors.lattice,1);
  const vesselI=clamp(Math.max(floors.vessel,featureWeights.vessel||0),floors.vessel,1);
  const cellularI=clamp(Math.max(floors.cellular,featureWeights.cellular||0),floors.cellular,1);

  if (applyTransversalCuts) {
  {
    const t=phase+1.18,ct=Math.cos(t),st=Math.sin(t);
    const tangential=Math.max(AGDP_MIN_WALL_MM*1.25,baseWall*(.75+.42*latticeI));
    const axial=Math.max(AGDP_MIN_WALL_MM*1.35,bandW*(.16+.14*latticeI));
    const radial=Math.max(baseWall*4,AGDP_MIN_WALL_MM*5);
    const centerR=innerR+baseWall*.72;
    voidCutters.push(wasm.Manifold.cube([radial,tangential,axial],true)
      .rotate([0,0,t*180/Math.PI]).translate([centerR*ct,centerR*st,0]));
  }

  {
    const t=phase+2.42,ct=Math.cos(t),st=Math.sin(t);
    const sr=Math.max(AGDP_MIN_WALL_MM*.95,baseWall*(.17+.12*vesselI));
    const rr=localSurfaceRZ(t,0)-sr*.22;
    voidCutters.push(sphereAt(wasm,[rr*ct,rr*st,0],sr,18));
  }

  {
    const t=phase+5.72,ct=Math.cos(t),st=Math.sin(t);
    const sr=Math.max(AGDP_MIN_WALL_MM*.82,baseWall*(.14+.10*cellularI));
    const z=bandW*.08*(p.compositionSignature?.polarity||1);
    const rr=localSurfaceRZ(t,z)-sr*.18;
    voidCutters.push(sphereAt(wasm,[rr*ct,rr*st,z],sr,16));
  }
  }

  if(voidCutters.length){
    try{ bodyManifold=wasm.Manifold.difference(bodyManifold,unionAll(wasm,voidCutters)); }
    catch(err){ console.warn('AGDP: operación transversal omitida por seguridad topológica',err); }
  }

  // Ruptura literal: el loop principal se interrumpe de verdad — una
  // muesca real cortada en la superficie, nunca hasta atravesarla — y se
  // recompone mediante un puente curvo explícito que salta por encima de
  // la cicatriz. Esto es una consecuencia geométrica, no un parámetro más
  // extremo: la pieza conserva la evidencia de la interrupción.
  if (p.mutation && p.mutation.active && p.mutation.mode==='rupture' && closed) {
    const sv=p.mutation.severity;
    const ruptureRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|rupture-scar');
    const rt=ruptureRng()*Math.PI*2;
    const ct=Math.cos(rt), st=Math.sin(rt);
    const surfaceHere=localSurfaceRZ(rt,0);
    // La muesca nunca llega a innerR — se detiene mucho antes, dejando
    // siempre material de sobra hacia la piel.
    const notchDepth=Math.min(baseWall*0.55*(0.4+0.6*sv), baseWall*0.62);
    const notchWidth=Math.max(AGDP_MIN_WALL_MM*1.6, baseWall*(0.85+0.55*sv));
    const notchAxial=Math.min(bandW*0.92, bandW-AGDP_MIN_WALL_MM*2);
    const notchCenterR=surfaceHere-notchDepth*0.5;
    try{
      const notchCutter=wasm.Manifold.cube([notchDepth*2.4, notchWidth, notchAxial], true)
        .rotate([0,0,rt*180/Math.PI]).translate([notchCenterR*ct, notchCenterR*st, 0]);
      bodyManifold=wasm.Manifold.difference(bodyManifold, notchCutter);
    }catch(err){ console.warn('AGDP: ruptura omitida por seguridad topológica',err); }
    // El puente: más ancho que la propia muesca, para garantizar solape
    // real en ambos lados, y proud de la superficie para leerse como una
    // reparación visible, no un remiendo oculto.
    const bridgeR=Math.max(AGDP_MIN_WALL_MM*1.35, baseWall*(0.42+0.30*sv));
    const bridgeOuterR=surfaceHere+bridgeR*0.55;
    const angularHalfSpan=(notchWidth*1.7)/(2*Math.max(surfaceHere,10));
    const bridgePts=[];
    const bridgeSamples=7;
    for(let s=0;s<=bridgeSamples;s++){
      const a=rt-angularHalfSpan+2*angularHalfSpan*(s/bridgeSamples);
      bridgePts.push([bridgeOuterR*Math.cos(a), bridgeOuterR*Math.sin(a), 0]);
    }
    const bridgeMesh=tubeAlongPathMesh(bridgePts, bridgeR, 14, false);
    decorations.push(meshToManifold(wasm, bridgeMesh.V, bridgeMesh.F));
  }

  // Hipertrofia literal: una masa adquiere escala anormal en un punto real
  // de la superficie, y el lado opuesto se adelgaza para compensar — el
  // resto de la pieza se ve obligado a ceder, no solo un número más alto.
  if (p.mutation && p.mutation.active && p.mutation.mode==='hypertrophy') {
    const sv=p.mutation.severity;
    const hRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|hypertrophy');
    const ht=hRng()*Math.PI*2;
    const hct=Math.cos(ht), hst=Math.sin(ht);
    const hSurface=localSurfaceRZ(ht,0);
    const massR=Math.max(baseWall*1.4, baseWall*(1.8+2.2*sv));
    const embed=massR*0.35;
    const massCenterR=hSurface+massR-embed;
    decorations.push(sphereAt(wasm,[massCenterR*hct, massCenterR*hst, 0], massR, 22));
    const oppositeT=ht+Math.PI;
    const oppCt=Math.cos(oppositeT), oppSt=Math.sin(oppositeT);
    const oppSurface=localSurfaceRZ(oppositeT,0);
    // El adelgazamiento nunca compromete el mínimo estructural — la
    // compensación es real pero sigue siendo fabricable.
    const thinDepth=Math.min(baseWall*0.30*sv, baseWall*0.35);
    const thinWidth=baseWall*2.4;
    try{
      const thinCutter=wasm.Manifold.cube([thinDepth*2.2, thinWidth, bandW*0.7], true)
        .rotate([0,0,oppositeT*180/Math.PI]).translate([(oppSurface-thinDepth*0.5)*oppCt,(oppSurface-thinDepth*0.5)*oppSt,0]);
      bodyManifold=wasm.Manifold.difference(bodyManifold, thinCutter);
    }catch(err){ console.warn('AGDP: hipertrofia (adelgazamiento) omitida por seguridad topológica',err); }
  }

  // Erosión literal: varios vacíos reales, mayores y más numerosos que el
  // sistema de vacíos habitual, que consumen estructura en vez de
  // decorarla.
  if (p.mutation && p.mutation.active && p.mutation.mode==='erosion') {
    const sv=p.mutation.severity;
    const eRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|erosion');
    const erosionCutters=[];
    const count=2+Math.round(sv*4);
    for(let k=0;k<count;k++){
      const et=eRng()*Math.PI*2;
      const ect=Math.cos(et), est=Math.sin(et);
      const ez=(eRng()*2-1)*bandW*0.38;
      const esr=Math.max(AGDP_MIN_WALL_MM*1.1, baseWall*(0.55+0.65*sv)*(0.7+0.6*eRng()));
      const esurf=localSurfaceRZ(et,ez);
      const erAdj=esurf-esr*0.15;
      erosionCutters.push(sphereAt(wasm,[erAdj*ect, erAdj*est, ez], esr, 16));
    }
    try{ bodyManifold=wasm.Manifold.difference(bodyManifold, unionAll(wasm, erosionCutters)); }
    catch(err){ console.warn('AGDP: erosión omitida por seguridad topológica',err); }
  }

  // Desplazamiento literal: el centro semántico se fuerza al borde extremo
  // real del arco, no a una zona moderadamente descentrada.
  if (p.mutation && p.mutation.active && p.mutation.mode==='displacement') {
    const sv=p.mutation.severity;
    const dRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|displacement');
    const edgeT = closed ? (dRng()<0.5?-1:1)*(Math.PI*0.92) : (dRng()<0.5? -arcRad/2*0.94 : arcRad/2*0.94);
    const ect=Math.cos(edgeT), est=Math.sin(edgeT);
    const esurf=localSurfaceRZ(edgeT,0);
    const dMassR=Math.max(baseWall*1.3, baseWall*(1.5+1.3*sv));
    const embed=dMassR*0.4;
    const centerR=esurf+dMassR-embed;
    decorations.push(sphereAt(wasm,[centerR*ect, centerR*est, 0], dMassR, 20));
  }

  // Compresión literal: un lado real se aplasta hacia el eje mientras el
  // opuesto se expande — una deformación de malla, no un cambio de
  // relieve. El riesgo se encuentra con la resistencia aquí mismo: ningún
  // vértice puede quedar más cerca del interior que el mínimo
  // estructural, sin importar cuánto empuje la severidad.
  if (p.mutation && p.mutation.active && p.mutation.mode==='compression') {
    const sv=p.mutation.severity;
    try{
      const mesh=manifoldToMesh(bodyManifold);
      const cRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|compression');
      const axisT=cRng()*Math.PI*2;
      const rMin=innerR+AGDP_STRUCTURAL_WALL_MM*0.9;
      for(const v of mesh.V){
        const vt=Math.atan2(v[1],v[0]);
        const rel=Math.cos(vt-axisT);
        const scale=1+(rel>=0?-0.22*sv*rel:0.16*sv*(-rel));
        const newX=v[0]*scale, newY=v[1]*scale;
        const rNew=Math.hypot(newX,newY);
        if(rNew<rMin && rNew>1e-6){
          const fix=rMin/rNew;
          v[0]=newX*fix; v[1]=newY*fix;
        }else{
          v[0]=newX; v[1]=newY;
        }
      }
      bodyManifold=meshToManifold(wasm, mesh.V, mesh.F);
    }catch(err){ console.warn('AGDP: compresión omitida por seguridad topológica',err); }
  }

  // Proliferación literal: la regla local (un nodo pequeño) se repite
  // hasta volverse colonia concentrada en una sola zona, no dispersa de
  // manera pareja.
  if (p.mutation && p.mutation.active && p.mutation.mode==='proliferation') {
    const sv=p.mutation.severity;
    const pRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|proliferation');
    const colonyT=pRng()*Math.PI*2;
    const colonyCount=6+Math.round(sv*10);
    const colonySpan=Math.PI*0.22*(0.6+0.4*sv);
    for(let k=0;k<colonyCount;k++){
      const t=colonyT+(pRng()*2-1)*colonySpan;
      const ct=Math.cos(t), st=Math.sin(t);
      const z=(pRng()*2-1)*bandW*0.4;
      const surf=localSurfaceRZ(t,z);
      const r=Math.max(AGDP_MIN_WALL_MM*0.5, baseWall*(0.16+0.10*pRng()));
      const embed=r*0.5;
      const rr=surf+r-embed;
      decorations.push(sphereAt(wasm,[rr*ct,rr*st,z], r, 10));
    }
  }

  // Inversión literal: donde habría vacío aparece masa sólida, y donde
  // habría continuidad se abre un vacío real — un cambio de polaridad
  // local concreto, no solo un intercambio de pesos.
  if (p.mutation && p.mutation.active && p.mutation.mode==='inversion') {
    const sv=p.mutation.severity;
    const iRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|inversion');
    const invT=iRng()*Math.PI*2;
    const ict=Math.cos(invT), ist=Math.sin(invT);
    const invSurf=localSurfaceRZ(invT,0);
    const massR=Math.max(baseWall*1.1, baseWall*(1.2+0.8*sv));
    const embed=massR*0.4;
    const massCenterR=invSurf+massR-embed;
    decorations.push(sphereAt(wasm,[massCenterR*ict, massCenterR*ist, 0], massR, 18));
    const voidT=invT+Math.PI*0.5+iRng()*0.3;
    const vct=Math.cos(voidT), vst=Math.sin(voidT);
    const voidSurf=localSurfaceRZ(voidT,0);
    const voidR=Math.max(AGDP_MIN_WALL_MM*1.2, baseWall*(0.7+0.5*sv));
    try{
      const voidCutter=sphereAt(wasm,[(voidSurf-voidR*0.2)*vct,(voidSurf-voidR*0.2)*vst,0], voidR, 16);
      bodyManifold=wasm.Manifold.difference(bodyManifold, voidCutter);
    }catch(err){ console.warn('AGDP: inversión omitida por seguridad topológica',err); }
  }

  const allParts = [bodyManifold, ...decorations];
  let result = unionAll(wasm, allParts);
  if (opts.type==='cuffBracelet'){
    // Real wrists are wider (mediolateral) than deep (anteroposterior);
    // a circular arc with a gap does not match that cross-section. The
    // whole solid is scaled elliptically post-construction, which keeps
    // every wall-thickness and connector guarantee already built into the
    // circular geometry intact.
    result = result.scale([0.85, 1.20, 1]);
  }
  return { manifold: result, bandW };
}



function featureIntensity(p,key,fallback=.35){ return clamp((p.featureWeights&&Number.isFinite(p.featureWeights[key]))?p.featureWeights[key]:fallback,0,1); }

/* =========================================================================
   STRUCTURAL KIT
   The one shared layer every typology's geometry consults for the
   operations that kept being reinvented, slightly differently, in each
   builder — which is exactly what let the same class of bug (piercing,
   floating decorations, inconsistent "solid/volumetric/lattice" meaning)
   surface repeatedly in different places. This does not merge the several
   different mesh topologies into one impossible function — a comb, a
   clip, and a ring are genuinely different shapes — but it does mean
   every one of them computes clearance, embedding, connecting veins, the
   mandatory event-mass, and treatment intensities the same way, once.
   ========================================================================= */
const StructuralKit = (()=>{
  function skinFloor(innerR, wall, ergonomicSlack){
    return innerR + wall*1.05 + (ergonomicSlack||0);
  }
  function embedInward(radialCenter, ownRadius, fraction){
    return radialCenter - ownRadius*(fraction==null?0.55:fraction);
  }
  function connectAnchorsWithVein(wasm, anchors, intensity, wallRef, extraRadiusMul){
    const parts=[];
    const r=Math.max(AGDP_MIN_WALL_MM*0.62, wallRef*(.09+.16*clamp(intensity,0,1)))*(extraRadiusMul||1);
    for(let i=0;i<anchors.length-1;i++){
      parts.push(cylinderBetween(wasm,anchors[i],anchors[i+1],r,14));
    }
    return parts;
  }
  function buildEventMass(wasm, center, scaleRef, dome, vessel){
    const r = scaleRef*(0.145+0.05*dome+0.04*vessel);
    return flattenedNodeAt(wasm, center, r*(1.15+.20*vessel), r*(0.85+.18*dome), r*(0.92+.24*dome), 24);
  }
  function treatmentMultipliers(treatment){
    if (treatment==='solid') return { thicknessBoost:1.55, crossBracing:0, massCount:0 };
    if (treatment==='volumetric') return { thicknessBoost:1.15, crossBracing:0, massCount:2 };
    return { thicknessBoost:1.0, crossBracing:1, massCount:1 }; // lattice
  }
  return Object.freeze({ skinFloor, embedInward, connectAnchorsWithVein, buildEventMass, treatmentMultipliers });
})();
window.StructuralKit = StructuralKit;

async function makeHoopFaceManifold(wasm, p, outerR, hoopWidth) {
  const baseWallEstimate = Math.max(AGDP_STRUCTURAL_WALL_MM, AGDP_STRUCTURAL_WALL_MM*(0.95+p.architectural*0.85+p.sideRelief*3.4));
  const innerRHoop = Math.max(outerR*0.35, outerR-baseWallEstimate);
  const pForFace = p;
  const { manifold } = await buildBandGeometryManifold(wasm, pForFace, { type:'hoopFace', innerD:innerRHoop*2, width:hoopWidth, closed:true, opening:0 });
  return { manifold, frameHalfW: outerR, frameHalfH: outerR, barR: hoopWidth*0.15 };
}
async function makeCageFaceManifold(wasm, p, outerR, hoopWidth) {
  const frameWidth = Math.max(hoopWidth*0.55, AGDP_STRUCTURAL_WALL_MM*1.3);
  const pFrame = Object.assign({}, p, {holes:0,railCount:Math.min(1,p.railCount||0)});
  const { manifold: frameManifold } = await buildBandGeometryManifold(wasm, pFrame, { type:'cageFrame', innerD:(outerR-frameWidth)*2, width:hoopWidth*0.6, closed:true, opening:0 });
  const barR = Math.max(AGDP_MIN_WALL_MM*1.05, hoopWidth*0.15);
  const capR = barR*1.35;
  const bridgeHalfLen = Math.max(barR*2, outerR-frameWidth*0.45);
  const parts = [frameManifold];
  parts.push(cylinderBetween(wasm, [-bridgeHalfLen,0,0], [bridgeHalfLen,0,0], barR, 16));
  [-bridgeHalfLen, bridgeHalfLen].forEach(x => {
    parts.push(cylinderBetween(wasm, [x,-capR*1.6,0], [x,capR*1.6,0], capR, 14));
    parts.push(sphereAt(wasm, [x,-capR*1.6,0], capR, 12));
    parts.push(sphereAt(wasm, [x,capR*1.6,0], capR, 12));
  });
  const manifold = unionAll(wasm, parts);
  return { manifold, frameHalfW: outerR, frameHalfH: outerR, barR };
}
function makeVesselFaceManifold(wasm, p, outerR, height) {
  const seg = Math.max(80, Math.round(p.segments*0.6)), radSeg = Math.max(24, Math.min(48, Math.round(p.segments/6)));
  const asym = clamp(p.asymmetry||0, 0, .58);
  const tiltAngle = (p.articulationOffset||0)*Math.PI/180;
  function rimR(t) { return outerR*(1+0.20*asym*Math.cos(t-tiltAngle)-0.12*asym*Math.cos(2*(t-tiltAngle))); }
  function heightAt(t) { return height*(1-0.35*asym*Math.cos(t-tiltAngle)); }
  const shell = domeShellMesh(rimR, heightAt, seg, radSeg, null);
  const parts = [meshToManifold(wasm, shell.V, shell.F)];
  const sphereCount = Math.max(1, Math.min(2, Math.round(p.nodes||1)));
  for (let k=0; k<sphereCount; k++) {
    const uPos = 0.24+0.09*k;
    const phi = uPos*Math.PI/2;
    const rOut = rimR(tiltAngle), hOut = heightAt(tiltAngle);
    const rho = rOut*Math.sin(phi), zBase = hOut*Math.cos(phi);
    const sphereR = Math.max(AGDP_MIN_WALL_MM*1.1, (k===0?1:0.22)*(outerR*0.36+p.nodeVolume*0.75));
    const embed = sphereR*0.42;
    const cx = rho*Math.cos(tiltAngle)*0.55, cy = rho*Math.sin(tiltAngle)*0.55;
    parts.push(sphereAt(wasm, [cx,cy,zBase+sphereR-embed], sphereR, 16));
  }
  const manifold = unionAll(wasm, parts);
  return { manifold, outerR, domeHeight: height };
}
function makeDomeFaceManifold(wasm, p, outerR, domeHeight) {
  const seg = Math.max(80, Math.round(p.segments*0.6)), radSeg = Math.max(24, Math.min(48, Math.round(p.segments/6)));
  const sunburstCount = Math.round(clamp(6+p.faceting*10,6,16));
  const grooveDepth = Math.min(domeHeight*0.14, 0.32+p.faceting*0.75);
  const grooveWidth = 0.10;
  function g2(x,s){s=Math.max(1e-6,s);return Math.exp(-(x*x)/(2*s*s));}
  function wrapA(a){while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;}
  function sunburstMask(t) { let m=0; for(let k=0;k<sunburstCount;k++){const tk=2*Math.PI*k/sunburstCount; m=Math.max(m, g2(wrapA(t-tk), grooveWidth));} return m; }
  function indentFn(t,u) {
    const sm = sunburstMask(t);
    const fadeIn = Math.min(1, u/0.15);
    return { dr: grooveDepth*sm*fadeIn*0.7, dz: grooveDepth*sm*fadeIn*0.5 };
  }
  const shell = domeShellMesh(()=>outerR, ()=>domeHeight, seg, radSeg, indentFn);
  const parts = [meshToManifold(wasm, shell.V, shell.F)];
  const bumpCount = Math.max(0, Math.round(p.nodes||0));
  for (let k=0;k<bumpCount;k++) {
    const ang = (k/Math.max(1,bumpCount))*2*Math.PI*2.4+(p.variation?.phaseA||0);
    const uPos = 0.35+0.45*((k*0.618034)%1);
    const iIdx = ((Math.round((ang/(2*Math.PI))*seg)%seg)+seg)%seg;
    const jIdx = Math.max(1, Math.min(radSeg, Math.round(uPos*radSeg)));
    const realPt = shell.topGrid[iIdx][jIdx];
    const bumpR = Math.max(AGDP_MIN_WALL_MM*0.6, 0.5+p.nodeVolume*0.25);
    const embed = bumpR*0.55;
    const rhoHere = Math.hypot(realPt[0], realPt[1]);
    const nrm = rhoHere>1e-6 ? [realPt[0]/rhoHere, realPt[1]/rhoHere] : [1,0];
    const phi = uPos*Math.PI/2;
    const nx = Math.sin(phi)*nrm[0], ny = Math.sin(phi)*nrm[1], nz = Math.cos(phi);
    parts.push(sphereAt(wasm, [realPt[0]+nx*(bumpR-embed), realPt[1]+ny*(bumpR-embed), realPt[2]+nz*(bumpR-embed)], bumpR, 12));
  }
  const manifold = unionAll(wasm, parts);
  return { manifold, outerR, domeHeight };
}
function makeWrappedSphereFaceManifold(wasm, p, outerR) {
  const sphereR = outerR*0.72;
  const parts = [sphereAt(wasm, [0,0,0], sphereR, 24)];
  const strandCount = Math.max(3, Math.round(clamp((p.frames||0)*6,3,7)));
  const strandR = Math.max(AGDP_MIN_WALL_MM*0.55, sphereR*0.09);
  const pathSegN = 40;
  function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
  function norm(a){const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];}
  for (let s=0;s<strandCount;s++) {
    const tiltT = Math.PI*s/strandCount+(p.variation?.phaseA||0);
    const tiltP = Math.PI*0.5*((s%2)?0.32:0.68)+(p.variation?.phaseB||0)*0.15;
    const axis = [Math.sin(tiltP)*Math.cos(tiltT), Math.sin(tiltP)*Math.sin(tiltT), Math.cos(tiltP)];
    let up=[0,0,1]; if (Math.abs(axis[2])>0.9) up=[1,0,0];
    const e1=norm(cross(up,axis)), e2=cross(axis,e1);
    const wrapR = sphereR*(0.99+0.04*((s*0.37)%1));
    const points=[];
    for (let k=0;k<pathSegN;k++) {
      const ang=2*Math.PI*k/pathSegN;
      points.push([wrapR*(e1[0]*Math.cos(ang)+e2[0]*Math.sin(ang)), wrapR*(e1[1]*Math.cos(ang)+e2[1]*Math.sin(ang)), wrapR*(e1[2]*Math.cos(ang)+e2[2]*Math.sin(ang))]);
    }
    const strandMesh = tubeAlongPathMesh(points, strandR, 10, true);
    parts.push(meshToManifold(wasm, strandMesh.V, strandMesh.F));
  }
  const spikeCount = Math.max(1, Math.round(p.spikes||1));
  for (let k=0;k<spikeCount;k++) {
    const ang1 = 2*Math.PI*((k*0.618034)%1)+(p.variation?.phaseC||0);
    const ang2 = Math.PI*(0.25+0.5*((k*0.381966)%1));
    const dir = [Math.sin(ang2)*Math.cos(ang1), Math.sin(ang2)*Math.sin(ang1), Math.cos(ang2)];
    const spikeLen = Math.max(AGDP_MIN_WALL_MM*1.5, sphereR*(0.32+0.24*((k*0.271)%1)));
    const baseR = Math.max(AGDP_MIN_WALL_MM*0.7, sphereR*0.12);
    const embed = baseR*0.5;
    const base = [dir[0]*(sphereR-embed), dir[1]*(sphereR-embed), dir[2]*(sphereR-embed)];
    const spikeMesh = spike3DMesh(base, dir, baseR, spikeLen+embed, 10);
    parts.push(meshToManifold(wasm, spikeMesh.V, spikeMesh.F));
  }
  const manifold = unionAll(wasm, parts);
  return { manifold, outerR: sphereR };
}

function makeSpatialFramePendantFace(wasm,p,outerR,th){
  const w=outerR*(1.28+0.30*(p.gestureIntensity||.7));
  const h=outerR*(1.48+0.38*(p.gestureIntensity||.7));
  const z=Math.max(1.5,(p.frontBackOffset||th*.55));
  const barR=Math.max(AGDP_MIN_WALL_MM*0.92,th*.115);
  const skew=(p.compositionSignature?.polarity||1)*w*(.12+.13*(p.asymmetry||0));
  const front=[[-w*.53,-h*.43,z],[w*.43,-h*.50,z],[w*.55,h*.38,z],[-w*.35+skew,h*.50,z]];
  const back=[[-w*.42,-h*.50,-z],[w*.55,-h*.35,-z],[w*.38,h*.52,-z],[-w*.55+skew*.55,h*.35,-z]];
  const parts=[];
  function edgeLoop(points,r){for(let i=0;i<4;i++)parts.push(cylinderBetween(wasm,points[i],points[(i+1)%4],r,18));}
  edgeLoop(front,barR*1.08); edgeLoop(back,barR*.92);
  for(let i=0;i<4;i++)parts.push(cylinderBetween(wasm,front[i],back[i],barR*.78,16));
  const polarity=p.compositionSignature?.polarity||1;
  parts.push(cylinderBetween(wasm,front[polarity>0?0:1],front[polarity>0?2:3],barR*.72,16));
  parts.push(cylinderBetween(wasm,back[polarity>0?1:0],back[polarity>0?3:2],barR*.62,16));
  const node=front[polarity>0?2:3];
  parts.push(sphereAt(wasm,node,barR*1.65,16));
  return {manifold:unionAll(wasm,parts),frameHalfW:w*.58,frameHalfH:h*.56,barR,kind:'spatialFrame',attachPoint:node,attachR:barR*1.65};
}
function makePiercedSlabPendantFace(wasm,p,outerR,th){
  const {Manifold}=wasm;
  const w=outerR*(1.22+0.28*(p.gestureIntensity||.7));
  const h=outerR*(1.48+0.34*(p.gestureIntensity||.7));
  const d=Math.max(3.2,th*(.72+.28*(p.gestureIntensity||.7)));
  const angle=(p.compositionSignature?.polarity||1)*(7+15*(p.asymmetry||0));
  let slab=Manifold.cube([w,h,d],true).rotate([0,0,angle]);
  const voidW=w*(.34+.12*(p.organic||0));
  const voidH=h*(.42+.10*(p.longitudinal||0));
  const xOff=(p.compositionSignature?.polarity||1)*w*(.09+.10*(p.asymmetry||0));
  const voidBox=Manifold.cube([voidW,voidH,d*1.8],true).rotate([0,0,-angle*.7]).translate([xOff,0,0]);
  slab=Manifold.difference(slab,voidBox);
  const parts=[slab];
  const z=d*.58, r=Math.max(AGDP_MIN_WALL_MM*.8,d*.11);
  parts.push(cylinderBetween(wasm,[-w*.46,-h*.34,z],[w*.42,h*.28,z],r,16));
  parts.push(cylinderBetween(wasm,[-w*.34,h*.43,-z],[w*.48,-h*.22,-z],r*.88,16));
  const nodeCenter=[xOff+w*.20,h*.20,z];
  parts.push(sphereAt(wasm,nodeCenter,r*1.55,16));
  return {manifold:unionAll(wasm,parts),frameHalfW:w*.56,frameHalfH:h*.56,barR:r,kind:'piercedSlab',attachPoint:nodeCenter,attachR:r*1.55};
}
function makeFoldedTotemPendantFace(wasm,p,outerR,th){
  const {Manifold}=wasm;
  const h=outerR*1.75,w=outerR*1.05,d=Math.max(3.4,th*.72);
  const polarity=(p.compositionSignature?.polarity||1);
  const spine=Manifold.cube([w*.28,h,d],true).rotate([0,0,polarity*8]);
  const wingA=Manifold.cube([w*.88,h*.34,d*.70],true).rotate([16,-18,polarity*24]).translate([w*.18,h*.18,d*.36]);
  const wingB=Manifold.cube([w*.76,h*.30,d*.62],true).rotate([-14,20,polarity*-28]).translate([-w*.20,-h*.20,-d*.34]);
  const parts=[spine,wingA,wingB];
  const r=Math.max(AGDP_MIN_WALL_MM*.82,d*.12);
  parts.push(cylinderBetween(wasm,[-w*.34,-h*.42,0],[w*.36,h*.40,0],r,18));
  const tiltRad=polarity*8*Math.PI/180;
  const nodeCenter=[-(h*.46)*Math.sin(tiltRad), (h*.46)*Math.cos(tiltRad), 0];
  const nodeR=Math.max(AGDP_MIN_WALL_MM*1.1, r*1.7);
  parts.push(sphereAt(wasm,nodeCenter,nodeR,16));
  return {manifold:unionAll(wasm,parts),frameHalfW:w*.58,frameHalfH:h*.54,barR:r,kind:'foldedTotem',attachPoint:nodeCenter,attachR:nodeR};
}

// Seed-informed weighted choice: never uniform, always biased by the
// piece's own continuous field, so the base type is a consequence of the
// seed's DNA rather than a coin flip layered on top of it.
function weightedPick(rng, weights){
  const keys = Object.keys(weights);
  const total = keys.reduce((s,k)=>s+Math.max(0,weights[k]),0) || 1;
  let r = rng()*total;
  for (const k of keys){
    r -= Math.max(0,weights[k]);
    if (r<=0) return k;
  }
  return keys[keys.length-1];
}

// The one shared surface-treatment decision every typology consults with
// the same criteria: how solid, how voluminous, or how lattice-like a
// piece's secondary body reads. Ring, comb, money clip, cufflinks — any
// builder that needs this question answered asks it the same way, from
// the same underlying intensities, rather than inventing its own weights
// per category. What differs between categories is only how each one's
// geometry expresses the answer, never how the answer is decided.
function pickStructuralTreatment(p, tag){
  const lattice=featureIntensity(p,'lattice'), dome=featureIntensity(p,'dome'), vessel=featureIntensity(p,'vessel');
  const rng = window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|'+tag+'|structural-treatment');
  return weightedPick(rng, {
    solid: 0.34+(1-lattice)*0.35,
    volumetric: 0.30+(dome+vessel)*0.28,
    lattice: 0.22+lattice*0.55
  });
}

// A flat/faceted plate base — the pendant is a slab, not a hoop. Thickness
// and eccentricity come from the same continuous fields as everything
// else (architectural, asymmetry), never a bare unmodified primitive
// (Regla 8).
function makePlateFaceManifold(wasm, p, outerR, th){
  const { Manifold } = wasm;
  const asym = clamp(p.asymmetry||0, 0, .46);
  const plateTh = Math.max(AGDP_STRUCTURAL_WALL_MM*1.6, th*0.55);
  const segN = Math.max(24, Math.round((p.segments||160)*0.3));
  let plate = Manifold.cylinder(plateTh, outerR, outerR, segN, true);
  plate = plate.scale([1+asym*0.22, 1-asym*0.16, 1]);
  return { manifold: plate, frameHalfW: outerR, frameHalfH: outerR, barR: Math.max(AGDP_MIN_WALL_MM, plateTh*0.3), outerR, domeHeight: plateTh };
}

async function makeFaceManifold(wasm, p, outerR, th, domeHeight) {
  const fw=p.featureWeights||{};
  const baseRng = window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|pendant-base-type');
  const baseWeights = {
    hoop:    0.30+(fw.cage||0.3)*0.55,
    plate:   0.28+Math.max(0,(fw.continuity||0.7)-0.5)*0.9,
    dome:    0.22+(fw.dome||0.3)*0.85,
    vessel:  0.22+(fw.vessel||0.3)*0.85,
    wrapped: 0.18+(fw.wrapped||0.3)*0.85
  };
  const baseType = weightedPick(baseRng, baseWeights);
  let base;
  if (baseType==='plate') base = makePlateFaceManifold(wasm,p,outerR,th);
  else if (baseType==='dome') base = makeDomeFaceManifold(wasm,p,outerR,domeHeight);
  else if (baseType==='vessel') base = makeVesselFaceManifold(wasm,p,outerR,domeHeight);
  else if (baseType==='wrapped') base = makeWrappedSphereFaceManifold(wasm,p,outerR);
  else base = await makeHoopFaceManifold(wasm,p,outerR,th);

  const parts=[base.manifold];
  const effR = base.outerR || outerR;
  const domeI=featureIntensity(p,'dome'), vesselI=featureIntensity(p,'vessel');
  const cageI=featureIntensity(p,'cage'), wrappedI=featureIntensity(p,'wrapped');
  const interI=featureIntensity(p,'interweave');
  const frontZ=Math.max(th*.08,domeHeight*(.10+.38*domeI));
  // Accents still apply on top of whichever base was chosen — the same
  // continuous vocabulary, regardless of category or base type.
  if(domeI>.08 && baseType!=='dome'){
    const rr=effR*(.32+.28*domeI);
    parts.push(sphereAt(wasm,[0,0,frontZ],rr,22).scale([1,1,.42+.30*domeI]));
  }
  if(vesselI>.08 && baseType!=='vessel'){
    const rr=effR*(.22+.25*vesselI);
    const polarity=(p.variation?.offset||0)>=0?1:-1;
    parts.push(sphereAt(wasm,[polarity*effR*.22,-effR*.10,frontZ*.76],rr,20).scale([1.18,.86,.48+.22*vesselI]));
  }
  if(cageI>.08){
    const barR=Math.max(AGDP_MIN_WALL_MM*.9,th*(.07+.07*cageI));
    const span=effR*(.52+.24*cageI);
    parts.push(cylinderBetween(wasm,[-span,0,0],[span,0,0],barR,14));
    parts.push(cylinderBetween(wasm,[0,-span,0],[0,span,0],barR,14));
  }
  if(wrappedI>.08 && baseType!=='wrapped'){
    const count=2+Math.round(wrappedI*2);
    for(let i=0;i<count;i++){
      const a=(p.variation?.phaseB||0)+i*Math.PI*2/count;
      const rr=effR*(.66+.08*Math.sin(a*2));
      const nr=Math.max(AGDP_MIN_WALL_MM*.9,effR*(.055+.045*wrappedI));
      parts.push(sphereAt(wasm,[Math.cos(a)*rr,Math.sin(a)*rr,th*.08],nr,14));
    }
  }
  if(interI>.12){
    const r=Math.max(AGDP_MIN_WALL_MM*.75,th*(.055+.05*interI));
    const span=effR*.72;
    parts.push(cylinderBetween(wasm,[-span*.72,-span*.38,th*.04],[span*.72,span*.38,th*.04],r,12));
    parts.push(cylinderBetween(wasm,[-span*.72,span*.38,th*.04],[span*.72,-span*.38,th*.04],r,12));
  }
  return {manifold:unionAll(wasm,parts),frameHalfW:base.frameHalfW||effR,frameHalfH:base.frameHalfH||effR,barR:base.barR||Math.max(AGDP_MIN_WALL_MM,th*.15),kind:baseType,outerR:effR,domeHeight:base.domeHeight||domeHeight};
}

function addFullVocabularyAccentsGeneric(wasm,parts,p,scaleRef,seedTag,faceKind,nearestFaceVertex,reservedVolumes){
  const weights=p.featureWeights||{};
  const floors={lattice:.24,vessel:.18,cellular:.22};
  const rng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|'+seedTag+'|subtractive-vocabulary');
  const voidCutters=[];
  const reserved=reservedVolumes||[];

  function distancePointSegment(point,a,b){
    const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];
    const ap=[point[0]-a[0],point[1]-a[1],point[2]-a[2]];
    const den=ab[0]*ab[0]+ab[1]*ab[1]+ab[2]*ab[2]||1;
    const t=clamp((ap[0]*ab[0]+ap[1]*ab[1]+ap[2]*ab[2])/den,0,1);
    return Math.hypot(point[0]-(a[0]+ab[0]*t),point[1]-(a[1]+ab[1]*t),point[2]-(a[2]+ab[2]*t));
  }
  function outsideReserved(point,radius){
    return reserved.every(zone=>{
      if(zone.type==='box'){
        const c=zone.center||[0,0,0],h=zone.half||[0,0,0];
        return Math.abs(point[0]-c[0])>h[0]+radius||Math.abs(point[1]-c[1])>h[1]+radius||Math.abs(point[2]-c[2])>h[2]+radius;
      }
      if(zone.type==='capsule'){
        return distancePointSegment(point,zone.a||[0,0,0],zone.b||[0,0,0])>(zone.radius||0)+radius;
      }
      const c=zone.center||[0,0,0],safe=(zone.radius||0)+radius;
      return Math.hypot(point[0]-c[0],point[1]-c[1],point[2]-c[2])>safe;
    });
  }
  function targetAt(angle,radial=.46,zBias=0){
    const desired=[Math.cos(angle)*scaleRef*radial,Math.sin(angle)*scaleRef*radial,zBias*scaleRef];
    return nearestFaceVertex?nearestFaceVertex(desired):desired;
  }

  const phase=rng()*Math.PI*2;
  const intensity={};
  Object.keys(floors).forEach(k=>intensity[k]=clamp(Math.max(floors[k],weights[k]||0),floors[k],1));

  {
    const center=targetAt(phase+1.18,.34,0);
    const w=scaleRef*(.10+.065*intensity.lattice);
    const h=scaleRef*(.14+.080*intensity.lattice);
    if(outsideReserved(center,Math.max(w,h)*.55)){
      const d=Math.max(scaleRef*1.35,AGDP_MIN_WALL_MM*10);
      voidCutters.push(wasm.Manifold.cube([w,h,d],true).rotate([0,0,(phase+1.18)*180/Math.PI]).translate(center));
    }
  }

  {
    const center=targetAt(phase+2.42,.36,.01);
    const r=Math.max(AGDP_MIN_WALL_MM*1.05,scaleRef*(.055+.032*intensity.vessel));
    if(outsideReserved(center,r))voidCutters.push(sphereAt(wasm,center,r,18));
  }

  {
    const c1=targetAt(phase+5.72,.35,-.015),c2=targetAt(phase+6.02,.35,.02);
    const r=Math.max(AGDP_MIN_WALL_MM*.88,scaleRef*(.043+.028*intensity.cellular));
    if(outsideReserved(c1,r))voidCutters.push(sphereAt(wasm,c1,r,16));
    if(intensity.cellular>.56&&outsideReserved(c2,r*.68))voidCutters.push(sphereAt(wasm,c2,r*.68,14));
  }
  return voidCutters;
}
async function makePendantManifold(wasm, p) {
  /* AGDP v0.180 — pendant derived from the proven annular topology.
     The outer body uses the same continuous closed-band construction as a
     ring. The central void is functional as a sculptural field rather than
     a finger aperture, and every interior member is embedded into the band. */
  const {Manifold}=wasm;
  const targetEnvelope=clamp(p.mainSize||28,23.5,40);
  const targetDepth=clamp(p.bandWidth||4.8,3.6,7.2);
  const rng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|pendant-annular-v180');
  const I=(p.loadGraph&&p.loadGraph.intensities)||{bridge:.35,void:.25,node:.35,suspension:.3,continuity:.75,organism:.5};
  const polarity=(p.compositionSignature?.polarity||1);
  const longitudinal=clamp(p.longitudinal||0,0,1);
  const architectural=clamp(p.architectural||0,0,1);
  const organic=clamp(p.organic||0,0,1);

  const outerR=targetEnvelope*.5;
  const annularWall=clamp(targetEnvelope*(.105+.035*architectural+.025*I.node),3.2,6.2);
  const innerR=Math.max(outerR-annularWall,outerR*.48);
  const bandWidth=Math.max(targetDepth,(p.minFeature||.8)*3.2);
  const ringParams=Object.assign({},p,{
    type:'pendantAnnularCore',
    mainSize:innerR*2,
    bandWidth,
    holes:Math.min(2,p.holes||0),
    railCount:Math.min(2,p.railCount||0),
    crown:false,
    spikes:0,
    opening:0
  });
  const built=await buildBandGeometryManifold(wasm,ringParams,{
    type:'pendantAnnularCore',innerD:innerR*2,width:bandWidth,closed:true,opening:0
  });
  let core=built.manifold;

  // Give the pendant an upright, non-repetitive silhouette without changing
  // its closed annular topology. The deformation is applied to the complete
  // core, so the result remains one continuous skin.
  const sx=clamp(.82+.12*(1-longitudinal)+.04*rng(),.82,.98);
  const sy=clamp(1.02+.20*longitudinal+.06*rng(),1.02,1.25);
  core=core.scale([sx,sy,1]);

  const parts=[core];
  const innerX=innerR*sx;
  const innerY=innerR*sy;
  const embed=Math.max(annularWall*.68,(p.minFeature||.8)*1.7);
  const memberR=Math.max((p.minFeature||.8)*.9,annularWall*(.16+.08*I.bridge));
  function anchor(angle,z=0){
    return [Math.cos(angle)*(innerX+embed),Math.sin(angle)*(innerY+embed),z];
  }
  function addMember(a,b,r=memberR){
    // Endpoints penetrate the annular body by `embed`, guaranteeing a true
    // volumetric union rather than tangent contact.
    parts.push(cylinderBetween(wasm,a,b,r,20));
  }

  // The main annulus carries the same generated radial field on its outer
  // and inner surfaces. No independent members are added inside the void.
  const phase=(p.variation?.phaseA||0)+polarity*(.18+.22*rng());
  const mode=(p.compositionSignature?.cadence||0)%4;

  // Suspension grows from the upper arc. Two shoulders and a crown overlap
  // the annular core deeply; the chain tunnel is cut only after union.
  const passageR=Math.max(.85,p.chainFitRadiusMm!=null?p.chainFitRadiusMm:1.35);
  const topY=outerR*sy;
  const shoulderX=Math.max(annularWall*.55,outerR*sx*.18);
  const shoulderY=topY-annularWall*.48;
  const tunnelWall=Math.max(AGDP_STRUCTURAL_WALL_MM,(p.minFeature||.8)*1.45,annularWall*.30);
  const crownOuterR=Math.max(passageR+tunnelWall,annularWall*1.28);
  const crownCenter=[0,topY+Math.max(crownOuterR*.78,annularWall*1.30),0];

  // The shoulders must never terminate on the tunnel axis.  In v0.191 both
  // members converged at crownCenter, so the later subtraction could erase
  // their entire overlap with the crown and isolate the suspension ring.
  // They now enter the lower flanks, outside the protected tunnel envelope.
  const flankX=Math.min(crownOuterR*.58,passageR+tunnelWall*.62);
  const flankY=crownCenter[1]-Math.sqrt(Math.max(0,crownOuterR*crownOuterR-flankX*flankX))*.72;
  const shoulderR=Math.max(memberR*1.30,annularWall*.30,tunnelWall*.58);
  addMember([-shoulderX,shoulderY,0],[-flankX,flankY,0],shoulderR);
  addMember([ shoulderX,shoulderY,0],[ flankX,flankY,0],shoulderR);

  const crown=Manifold.cylinder(bandWidth,crownOuterR,crownOuterR,48,true)
    .scale([1,.88+.08*organic,1]).translate(crownCenter);
  parts.push(crown);

  // A continuous saddle below the tunnel creates a guaranteed load path
  // between both shoulders and the crown after subtraction.  Its centreline
  // remains below the passage by at least one structural wall thickness.
  const saddleY=crownCenter[1]-passageR-tunnelWall*.82;
  const saddleHalf=Math.max(flankX,shoulderR*1.25);
  parts.push(cylinderBetween(
    wasm,
    [-saddleHalf,saddleY,0],
    [ saddleHalf,saddleY,0],
    Math.max(shoulderR*.92,tunnelWall*.62),
    28
  ));

  let manifold=unionAll(wasm,parts);
  let mesh=manifoldToMesh(manifold);
  let preflight=validate(mesh.V,mesh.F,{type:'pendant-annular-preflight',minFeature:p.minFeature||.8,printProfile:p.printProfile||'silverPolished'});
  if(preflight.components!==1||!preflight.manifoldOK)throw new Error('AGDP annular pendant core failed continuity validation');

  const tunnelHalf=crownOuterR+Math.max(tunnelWall,bandWidth*.75);
  const passage=cylinderBetween(wasm,[-tunnelHalf,crownCenter[1],0],[tunnelHalf,crownCenter[1],0],passageR,128);
  manifold=Manifold.difference(manifold,passage);

  const finalMesh=manifoldToMesh(manifold);
  const finalAudit=validate(finalMesh.V,finalMesh.F,{type:'pendant',minFeature:p.minFeature||.8,printProfile:p.printProfile||'silverPolished'});
  if(!finalAudit.ok||finalAudit.components!==1)throw new Error('AGDP annular pendant failed structural validation');

  p.pendantBodyEnvelopeMm=targetEnvelope;
  p.pendantBodyWidthMm=finalAudit.bounds.dim[0];
  p.pendantBodyHeightMm=finalAudit.bounds.dim[1];
  p.pendantBodyDepthMm=finalAudit.bounds.dim[2];
  p.pendantSuspension='integratedIntoAnnularCore';
  p.pendantPassageDiameterMm=passageR*2;
  p.pendantTotalHeightMm=finalAudit.bounds.dim[1];
  p.pendantBaseGeometry='ringDerivedClosedAnnularCore';
  p.pendantStructuralMode=mode;
  p.pendantInteriorVariation='mirroredOuterSurfaceField';
  p.pendantContinuityStrategy='singleAnnularSkinWithMatchedInnerOuterField';
  p.pendantPreflightComponents=preflight.components;
  return {manifold};
}

async function makeCufflinksManifold(wasm, p) {
  /* AGDP v0.197 — closed cufflink unit with positive-determinant duplication.
     Every primitive is a closed manifold and every junction has deliberate
     volumetric overlap. No negative scaling is used, so triangle winding is
     preserved for both members of the pair. */
  const {Manifold}=wasm;
  const targetEnvelope=clamp(p.mainSize||20,15,25);
  const targetDepth=clamp(p.bandWidth||4.8,3.2,7.0);
  const rng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|cufflink-annular-v197');
  const I=(p.loadGraph&&p.loadGraph.intensities)||{bridge:.35,void:.25,node:.35,suspension:.3,continuity:.75,organism:.5};
  const longitudinal=clamp(p.longitudinal||0,0,1);
  const architectural=clamp(p.architectural||0,0,1);
  const minFeature=Math.max(.8,p.minFeature||.8);

  const outerR=targetEnvelope*.5;
  const r=outerR;
  const annularWall=clamp(targetEnvelope*(.115+.030*architectural+.020*I.node),2.4,4.2);
  const innerR=Math.max(outerR-annularWall,outerR*.46);
  const th=Math.max(targetDepth,minFeature*3.2);
  const crownParams=Object.assign({},p,{
    type:'pendantAnnularCore',mainSize:innerR*2,bandWidth:th,
    // Cufflinks must survive three sequential strict manifold checks
    // (crown, unit, pair) at a small scale (15-25mm). Perforations and
    // mutations are the primary source of topology failures at this
    // scale, so they are disabled here entirely rather than gambled on
    // per seed: a plain, reliable crown by construction, not by luck.
    holes:0,railCount:Math.min(1,p.railCount||0),
    crown:false,spikes:0,opening:0,
    mutation:{active:false,severity:0,mode:null}
  });
  const built=await buildBandGeometryManifold(wasm,crownParams,{
    type:'pendantAnnularCore',innerD:innerR*2,width:th,closed:true,opening:0
  });
  const sx=clamp(.86+.09*(1-longitudinal)+.03*rng(),.86,.98);
  const sy=clamp(1.00+.14*longitudinal+.04*rng(),1.00,1.18);
  const crown=built.manifold.scale([sx,sy,1]);

  const crownMesh=manifoldToMesh(crown);
  const crownAudit=validate(crownMesh.V,crownMesh.F,{
    type:'cufflink-annular-crown',minFeature,printProfile:p.printProfile||'silverPolished'
  });
  if(!crownAudit.manifoldOK||crownAudit.components!==1||!crownAudit.finite){
    throw new Error('AGDP cufflink annular crown is not a closed manifold');
  }

  /* Full-footprint posterior closure. The cap is dimensioned from the
     already deformed crown bounds, not from the nominal pre-deformation
     radii. It therefore covers the complete projected silhouette of every
     seed, closes the annular opening, and buries all -Z lateral relief while
     leaving the +Z crown surface available for the AGDP operations. */
  const capDepth=Math.max(2.2,th*.46,minFeature*2.4);
  const rearFaceZ=-th*.5;
  const posteriorFlattenZ=-Math.max(minFeature*.22,th*.08);
  const capTopZ=posteriorFlattenZ;
  const capBottomZ=rearFaceZ-capDepth*.58;
  const capHeight=capTopZ-capBottomZ;
  const capCenterZ=(capTopZ+capBottomZ)*.5;
  const footprintOverlap=Math.max(minFeature*.48,AGDP_STRUCTURAL_WALL_MM*.32);
  const crownHalfX=Math.max(Math.abs(crownAudit.bounds.min[0]),Math.abs(crownAudit.bounds.max[0]));
  const crownHalfY=Math.max(Math.abs(crownAudit.bounds.min[1]),Math.abs(crownAudit.bounds.max[1]));
  const capHalfX=crownHalfX+footprintOverlap;
  const capHalfY=crownHalfY+footprintOverlap;
  const capFill=Manifold.cylinder(capHeight,1,1,160,true)
    .scale([capHalfX,capHalfY,1]).translate([0,0,capCenterZ]);

  const structuralParts=[crown,capFill];

  function box(cx,cy,cz,dx,dy,dz){
    return Manifold.cube([dx,dy,dz],true).translate([cx,cy,cz]);
  }
  function cylZ(cx,cy,rad,z0,z1){
    return cylinderBetween(wasm,[cx,cy,z0],[cx,cy,z1],rad,48);
  }

  /* Closed posterior finding. All joints overlap by at least one structural
     wall, preventing isolated components after boolean evaluation. */
  const postRadius=Math.max(1.3,minFeature*.9);
  const postLength=17.0;
  const postCurvatureRadius=34.0;
  const postTiltRad=4*Math.PI/180;
  const rootRadius=Math.max(2.15,postRadius*2.25,minFeature*1.7);
  const rootDepth=Math.max(3.4,minFeature*3.0);
  const toggleLength=19.0,toggleWidth=4.2,toggleThickness=3.0;
  function cufflinkPostPoint(s){
    const half=postLength*.5;
    const sagitta=postCurvatureRadius-Math.sqrt(Math.max(0,postCurvatureRadius*postCurvatureRadius-half*half));
    const x=Math.tan(postTiltRad)*postLength*s+sagitta*4*s*(1-s);
    return [x,0,rearFaceZ-postLength*s];
  }
  function addFinding(target){
    const root=cufflinkPostPoint(0);
    target.push(cylZ(0,0,rootRadius,rearFaceZ-rootDepth,rearFaceZ+minFeature*.55));
    target.push(sphereAt(wasm,[0,0,rearFaceZ-minFeature*.35],rootRadius,24));
    const segments=14;
    let previous=[root[0],root[1],rearFaceZ-rootDepth*.42];
    for(let i=1;i<=segments;i++){
      const raw=cufflinkPostPoint(i/segments);
      const current=[raw[0],raw[1],raw[2]-rootDepth*.18];
      target.push(cylinderBetween(wasm,previous,current,postRadius,24));
      if(i<segments)target.push(sphereAt(wasm,current,postRadius*1.04,16));
      previous=current;
    }
    const pivot=previous;
    const hingeRadius=Math.max(1.7,postRadius*1.8);
    target.push(sphereAt(wasm,pivot,hingeRadius,24));
    target.push(box(pivot[0],pivot[1],pivot[2],toggleLength,toggleWidth,toggleThickness));
    target.push(box(pivot[0],pivot[1],pivot[2]+toggleThickness*.62,5.4,5.0,3.2));
  }
  addFinding(structuralParts);

  if(featureIntensity(p,'interweave')>.58){
    const spokeR=Math.max(minFeature*.72,th*.11);
    structuralParts.push(cylinderBetween(wasm,[0,0,rearFaceZ+minFeature*.2],[r*.72,0,rearFaceZ+minFeature*.2],spokeR,18));
  }

  let unit=unionAll(wasm,structuralParts);

  /* Optional mutations are embedded deeply into the front skin. If a boolean
     does not remain closed, only that optional addition is discarded. */
  if(p.mutation&&p.mutation.active){
    const baseMesh=manifoldToMesh(unit);
    const frontVerts=baseMesh.V.filter(v=>v[2]>th*.05);
    const pool=frontVerts.length?frontVerts:baseMesh.V;
    const mutationParts=[unit];
    if(p.mutation.mode==='hypertrophy'&&pool.length){
      const hRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|cufflink-hypertrophy-v197');
      const target=pool[Math.floor(hRng()*pool.length)].slice();
      const massR=Math.max(th*.8,th*(1.0+1.0*p.mutation.severity));
      target[2]-=massR*.42;
      mutationParts.push(sphereAt(wasm,target,massR,24));
    }else if(p.mutation.mode==='proliferation'&&pool.length){
      const pRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|cufflink-proliferation-v197');
      const anchor=pool[Math.floor(pRng()*pool.length)];
      const colonyCount=4+Math.round(p.mutation.severity*5);
      for(let k=0;k<colonyCount;k++){
        const rr=Math.max(minFeature*.82,th*(.12+.055*pRng()));
        const jitter=th*.42;
        const pt=[anchor[0]+(pRng()*2-1)*jitter,anchor[1]+(pRng()*2-1)*jitter,
          Math.max(th*.02,anchor[2]+(pRng()*2-1)*jitter*.28)-rr*.48];
        mutationParts.push(sphereAt(wasm,pt,rr,16));
      }
    }
    if(mutationParts.length>1){
      const mutated=unionAll(wasm,mutationParts);
      const mm=manifoldToMesh(mutated);
      const ma=validate(mm.V,mm.F,{type:'cufflink-mutated-unit',minFeature,printProfile:p.printProfile||'silverPolished'});
      if(ma.manifoldOK&&ma.components===1&&ma.finite)unit=mutated;
    }
  }

  const unitMesh=manifoldToMesh(unit);
  const unitAudit=validate(unitMesh.V,unitMesh.F,{
    type:'cufflink-unit',minFeature,printProfile:p.printProfile||'silverPolished'
  });
  if(!unitAudit.manifoldOK||unitAudit.components!==1||!unitAudit.finite){
    throw new Error('AGDP cufflink unit is not a single closed manifold');
  }

  const unitBounds=bounds(unitMesh.V);
  const minimumClearGapMm=12.0;
  const pairSpacing=Math.max(unitBounds.dim[0]+minimumClearGapMm,r*3.15,th*3.8);
  const leftUnit=unit.translate([-pairSpacing/2,0,0]);
  /* Identical translated copy: avoids the negative determinant and reversed
     winding introduced by scale([-1,1,1]) in v0.195. */
  const rightUnit=unit.translate([pairSpacing/2,0,0]);
  const manifold=Manifold.union(leftUnit,rightUnit);

  const pairMesh=manifoldToMesh(manifold);
  const pairAudit=validate(pairMesh.V,pairMesh.F,{
    type:'cufflinks',minFeature,printProfile:p.printProfile||'silverPolished',
    allowConstructiveOverlap:true,allowedSolids:2
  });
  if(!pairAudit.manifoldOK||pairAudit.components!==2||!pairAudit.finite){
    throw new Error('AGDP cufflink pair is not two closed consistently oriented solids');
  }

  p.cufflinkPairCenterSpacingMm=pairSpacing;
  p.cufflinkMinimumClearGapMm=minimumClearGapMm;
  p.cufflinkUnitComponents=unitAudit.components;
  p.cufflinkPairComponents=pairAudit.components;
  p.cufflinkCapFootprintMm=[capHalfX*2,capHalfY*2];
  p.cufflinkCapClosure='fullDeformedFootprint';
  p.cufflinkDnaSurface='+ZFrontOnly';
  return {manifold};
}

function addOpenBandVolumetricField(wasm,manifold,p,kind){
  const parts=[manifold];
  const fw=p.featureWeights||{};
  const dome=featureIntensity(p,'dome'),vessel=featureIntensity(p,'vessel');
  const lattice=featureIntensity(p,'lattice'),wrapped=featureIntensity(p,'wrapped');
  const cage=featureIntensity(p,'cage'),inter=featureIntensity(p,'interweave');
  const continuity=featureIntensity(p,'continuity');
  // The volumetric field is generated in the same undeformed coordinate
  // system as the open band. The complete union is warped afterward, so
  // anchors, roots, veins and wrapped paths remain embedded in one mesh.
  const innerR=Math.max(8,(p.mainSize||100)/2);
  const bandW=Math.max(8,p.bandWidth||40);
  const wall=kind==='headpiece'?Math.max(2.6,p.headWallMm||3.2):Math.max(3.8,p.chokerWallMm||4.8);
  const skinFloorR = StructuralKit.skinFloor(innerR, wall, 0);
  const rng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|'+kind+'-volumetric-field');
  const frontSpan=kind==='headpiece' ? (.62+.34*wrapped) : (.48+.38*vessel);
  const count=3+Math.round((dome+vessel+cage)*2.2);
  const anchors=[];
  const anchorU=[];
  // One shared formula for any point along the arc, sampled either at an
  // anchor's own position or densely in between for the connecting vein —
  // so the vein can actually follow the curvature instead of drawing a
  // straight chord across it.
  function pointAtU(u){
    const t=(-frontSpan/2+frontSpan*u)*Math.PI;
    const front=(1+Math.cos(t))*.5;
    const surfaceR=innerR+wall*(.50+.18*continuity)+bandW*(.015+.02*vessel)*front;
    const radial=Math.max(skinFloorR, surfaceR);
    const zBase=bandW*((u-.5)*(.16+.10*inter));
    const lift=bandW*(.02+.05*dome)*Math.pow(front,1.25);
    return { t, surfaceR, radial, zBase, lift };
  }
  for(let i=0;i<count;i++){
    const u=count===1?.5:i/(count-1);
    const {t, surfaceR, radial, zBase, lift} = pointAtU(u);
    const rr=bandW*(.058+.055*dome+.048*vessel)*(0.92+0.18*rng());
    // Embedded enough to guarantee overlap, but not so deep that the node
    // reads as flat — real outward presence, not a sunken disc.
    const embedded = Math.max(skinFloorR, StructuralKit.embedInward(radial, rr, 0.65));
    const p0=[embedded*Math.cos(t),embedded*Math.sin(t),zBase+lift];
    anchors.push(p0);
    anchorU.push(u);
    parts.push(flattenedNodeAt(wasm,p0,rr*(1.05+.45*vessel),rr*(.78+.22*wrapped),rr*(.92+.48*dome),20));
    // Root connector: a short, thick bridge from a point directly on the
    // band's own real surface (same angle, same z) to the anchor's
    // center — this is what actually guarantees the anchor reads as
    // rising out of the mesh's edge rather than floating near it,
    // regardless of how the embed math alone works out.
    const rootSurfacePoint=[surfaceR*Math.cos(t),surfaceR*Math.sin(t),zBase];
    parts.push(cylinderBetween(wasm, rootSurfacePoint, p0, rr*0.62, 14));
  }
  {
    const veinIntensity=clamp(Math.max(lattice,cage),0,1);
    const veinR=Math.max(AGDP_MIN_WALL_MM*0.62, wall*(.09+.16*veinIntensity));
    const samplesPerSpan=6;
    for(let i=0;i<anchors.length-1;i++){
      const u0=anchorU[i], u1=anchorU[i+1];
      const pts=[anchors[i]];
      for(let s=1;s<samplesPerSpan;s++){
        const u=u0+(u1-u0)*(s/samplesPerSpan);
        const {t, radial, zBase, lift} = pointAtU(u);
        // Same embed ratio as the anchors themselves, interpolated, so the
        // vein rides along the surface the whole way instead of cutting
        // a straight line between the two embedded centers.
        const localRR=bandW*(.058+.055*dome+.048*vessel);
        const embedded=Math.max(skinFloorR, StructuralKit.embedInward(radial, localRR, 0.65));
        pts.push([embedded*Math.cos(t),embedded*Math.sin(t),zBase+lift]);
      }
      pts.push(anchors[i+1]);
      const veinMesh=tubeAlongPathMesh(pts, veinR, 10, false);
      parts.push(meshToManifold(wasm, veinMesh.V, veinMesh.F));
    }
  }
  if(wrapped>.18){
    const paths=1+Math.round(wrapped*2);
    for(let k=0;k<paths;k++){
      const pts=[];
      const seg=24;
      for(let i=0;i<seg;i++){
        const u=i/(seg-1),t=(-frontSpan/2+frontSpan*u)*Math.PI;
        const radial=Math.max(skinFloorR, innerR+wall*.72+bandW*(.05+.04*vessel)*Math.sin(Math.PI*u));
        const z=bandW*(.16*Math.sin(Math.PI*2*u+(p.variation?.phaseB||0)+k*1.4)+.12*(k-(paths-1)/2));
        pts.push([radial*Math.cos(t),radial*Math.sin(t),z]);
      }
      const tube=tubeAlongPathMesh(pts,Math.max(AGDP_MIN_WALL_MM*.72,wall*(.13+.08*wrapped)),10,false);
      parts.push(meshToManifold(wasm,tube.V,tube.F));
    }
  }
  return unionAll(wasm,parts);
}

function applyChokerErgonomics(wasm, manifold, p){
  const mesh=manifoldToMesh(manifold);
  if(!mesh.V.length)return manifold;

  // Shared cervical fit field for the whole neck family. The interior fit
  // follows a low torque seat: broad, comparatively flat in front, rising
  // through the sides and higher at the nape. Exterior volume is allowed to
  // expand independently so formal variation never deforms the body surface.
  const ratio=clamp(p.chokerDepthRatio||0.82,0.78,0.86);
  const frontHeight=Math.max(1,p.bandWidth||34);
  const rearRatio=clamp(p.chokerRearHeightRatio||0.58,0.38,0.82);
  const frontDrop=Math.max(0,p.chokerFrontDropMm||8);
  const rearLift=Math.max(0,p.chokerRearLiftMm||4);
  const projection=clamp(p.chokerFrontProjection||0,0,0.13);

  const radii=mesh.V.map(v=>Math.hypot(v[0],v[1])).sort((a,b)=>a-b);
  const centerR=radii[Math.floor(radii.length*.5)]||1;
  const halfHeight=Math.max(1,frontHeight*.5);
  const deg=Math.PI/180;

  function smooth01(x){x=clamp(x,0,1);return x*x*(3-2*x);}

  for(const v of mesh.V){
    const originalR=Math.hypot(v[0],v[1])||1e-6;
    const t=Math.atan2(v[1],v[0]);
    const absT=Math.abs(wrap(t));

    // Regional weights: a stable frontal platform, progressive lateral
    // transition and a distinct posterolateral/nape zone.
    const frontPlateau=1-smooth01((absT-48*deg)/(34*deg));
    const rear=smooth01((absT-104*deg)/(60*deg));
    const side=clamp(1-frontPlateau-rear,0,1);

    // Modified cervical plan rather than a simple ellipse. The front is
    // slightly broadened and flattened; posterior curvature tightens.
    const frontBroadening=1+0.030*frontPlateau;
    const rearTightening=1-0.018*rear;
    let x=v[0]*frontBroadening*rearTightening;
    let y=v[1]*ratio*(1-0.012*rear);

    let r=Math.hypot(x,y)||1e-6;
    const ux=x/r, uy=y/r;
    let dr=originalR-centerR;

    // Height distribution follows the common ergonomic surface. The front
    // remains full-height; the rear progressively reduces according to the
    // selected profile without changing the shared cervical seat.
    const heightScale=rearRatio+(1-rearRatio)*(frontPlateau+side*.58);
    let zLocal=v[2]*heightScale;

    // Rotate the section in the radial/Z plane: outward at the throat,
    // neutral at the sides, inward at the nape. This prevents the upper edge
    // from pressing the throat and lets the lower edge settle at the base of
    // the neck.
    const sectionTilt=(8*frontPlateau-10*rear)*deg;
    const cs=Math.cos(sectionTilt), sn=Math.sin(sectionTilt);
    const drRot=dr*cs-zLocal*sn;
    const zRot=dr*sn+zLocal*cs;
    dr=drRot;
    zLocal=zRot;

    // LOVE-derived sagittal seat: low frontal platform, progressive lateral
    // rise and a higher nape. Side rise makes the change visibly anatomical
    // instead of a nearly planar cosine displacement.
    const sideRise=2.8*Math.pow(side,1.25);
    const centerShift=-frontDrop*frontPlateau+sideRise+rearLift*rear;

    // Regional clearance is applied to the whole section, while sculptural
    // projection affects only the exterior half. The inner surface therefore
    // remains stable across seeds and across torque/cervical/sculptural modes.
    const clearance=1.8*frontPlateau+0.6*side+1.4*rear;
    const outerMask=smooth01((dr+halfHeight*.08)/(halfHeight*.58));
    const exteriorProjection=centerR*projection*frontPlateau*outerMask;
    r=Math.max(1,centerR+dr+clearance+exteriorProjection);

    v[0]=ux*r;
    v[1]=uy*r;
    v[2]=zLocal+centerShift;
  }
  return meshToManifold(wasm,mesh.V,mesh.F);
}


function applyHeadErgonomics(wasm, manifold, p){
  const mesh=manifoldToMesh(manifold);
  if(!mesh.V.length)return manifold;

  const ratio=clamp(p.headDepthRatio||1.18,1.05,1.38);
  const frontHeight=Math.max(1,p.bandWidth||48);
  const sideRatio=clamp(p.headSideHeightRatio||0.46,0.22,0.72);
  const rearRatio=clamp(p.headRearHeightRatio||0.24,0.12,0.55);
  const crownRise=Math.max(0,p.headCrownRiseMm||12);
  const templeDrop=Math.max(0,p.headTempleDropMm||8);
  const projection=clamp(p.headFrontProjection||0,0,0.10);

  const radii=mesh.V.map(v=>Math.hypot(v[0],v[1])).sort((a,b)=>a-b);
  const centerR=radii[Math.floor(radii.length*.5)]||1;
  const halfHeight=Math.max(1,frontHeight*.5);
  const deg=Math.PI/180;

  function smooth01(x){x=clamp(x,0,1);return x*x*(3-2*x);}

  for(const v of mesh.V){
    const originalR=Math.hypot(v[0],v[1])||1e-6;
    const t=Math.atan2(v[1],v[0]);
    const absT=Math.abs(wrap(t));

    // Four anatomical regions along the placement arc: frontal support,
    // frontotemporal transition, parietal support and terminal release.
    const front=1-smooth01((absT-34*deg)/(34*deg));
    const terminal=smooth01((absT-116*deg)/(48*deg));
    const lateral=clamp(1-front-terminal,0,1);
    const temple=Math.sin(Math.PI*clamp((absT-38*deg)/(96*deg),0,1));

    // Triaxial cranial plan. The frontal segment is slightly flatter and
    // broader, while the posterolateral segment tightens instead of being a
    // uniformly scaled ellipse.
    const frontalBroadening=1+0.022*front;
    const temporalRelease=1+0.012*temple;
    const posteriorTightening=1-0.018*terminal;
    let x=v[0]*frontalBroadening*temporalRelease*posteriorTightening;
    let y=v[1]*ratio*(1-0.010*front-0.014*terminal);

    let r=Math.hypot(x,y)||1e-6;
    let ux=x/r, uy=y/r;
    let dr=originalR-centerR;

    // Independent height distribution: full frontal height, gradual lateral
    // reduction and a lighter terminal section.
    const heightScale=clamp(
      rearRatio+(1-rearRatio)*front+sideRatio*lateral*(1-terminal*.45),
      0.14,1
    );
    let zLocal=v[2]*heightScale;

    // The section follows the local cranial normal. It leans slightly back at
    // the front and progressively outward toward the temporal endpoints.
    const sectionTilt=(-6*front+8*lateral+12*terminal)*deg;
    const cs=Math.cos(sectionTilt), sn=Math.sin(sectionTilt);
    const drRot=dr*cs-zLocal*sn;
    const zRot=dr*sn+zLocal*cs;
    dr=drRot;
    zLocal=zRot;

    // Inclined placement plane and regional seat: elevated frontal placement,
    // continuous parietal rise, controlled temporal descent and lifted ends.
    const placementTilt=15*deg;
    const sagittalShift=Math.sin(placementTilt)*(x-centerR*.12)*.18;
    const parietalRise=crownRise*Math.pow(lateral,1.35)*(0.58+0.42*front);
    const temporalSink=templeDrop*Math.pow(temple,1.45)*(0.34+0.66*terminal);
    const terminalLift=3.2*Math.pow(terminal,1.7);
    const centerShift=sagittalShift+parietalRise-temporalSink+terminalLift;

    // Regional clearance protects the frontotemporal area. Formal projection
    // is restricted to the exterior half, leaving the inner contact surface
    // stable regardless of seed-driven morphology.
    const clearance=3.2*front+4.4*temple+2.8*lateral+5.2*terminal;
    const outerMask=smooth01((dr+halfHeight*.06)/(halfHeight*.56));
    const exteriorProjection=centerR*projection*Math.pow(front,1.55)*outerMask;

    // The final segment flares laterally and turns outward, preventing the
    // rigid ends from converging against the temples or the area above the ear.
    const flareAngle=9*deg*Math.pow(terminal,1.55);
    const sideSign=t>=0?1:-1;
    const ca=Math.cos(sideSign*flareAngle), sa=Math.sin(sideSign*flareAngle);
    const fx=ux*ca-uy*sa;
    const fy=ux*sa+uy*ca;
    ux=fx; uy=fy;

    r=Math.max(1,centerR+dr+clearance+exteriorProjection);
    v[0]=ux*r;
    v[1]=uy*r;
    v[2]=zLocal+centerShift;
  }
  return meshToManifold(wasm,mesh.V,mesh.F);
}


function ellipticalSegmentBetween(wasm,p0,p1,rx,ry,segments){
  const { Manifold }=wasm;
  const dx=p1[0]-p0[0],dy=p1[1]-p0[1],dz=p1[2]-p0[2];
  const len=Math.hypot(dx,dy,dz)||1e-6;
  let solid=Manifold.cylinder(len,1,1,segments||16,true).scale([rx,ry,1]);
  const thetaDeg=Math.acos(clamp(dz/len,-1,1))*180/Math.PI;
  const phiDeg=Math.atan2(dy,dx)*180/Math.PI;
  solid=solid.rotate([0,thetaDeg,0]).rotate([0,0,phiDeg]);
  return solid.translate([(p0[0]+p1[0])/2,(p0[1]+p1[1])/2,(p0[2]+p1[2])/2]);
}

function flattenedNodeAt(wasm,center,rx,ry,rz,segments){
  const { Manifold }=wasm;
  return Manifold.sphere(1,segments||18).scale([rx,ry,rz]).translate(center);
}

function makeCombManifold(wasm,p){
  const width=Math.max(80,p.mainSize||110);
  const topH=Math.max(35,p.combTopHeightMm||50);
  const toothL=Math.max(25,p.combToothLengthMm||35);
  const toothCount=Math.max(5,Math.round(p.combToothCount||8));
  const bodyR=Math.max(2.35,(p.combBodyWallMm||4)/2*1.35);
  const toothT=Math.max(1.25,(p.combToothDiameterMm||2.8)/2);
  const depth=Math.max(7,p.combDepthMm||10);
  const arch=Math.max(3,p.combArchMm||7);
  const cranialCurve=Math.max(4,p.combCranialCurveMm||8);
  const insertionAngle=(p.combInsertionAngleDeg||16)*Math.PI/180;
  const toothSweep=Math.max(4,p.combToothSweepMm||7);
  const tipReturn=Math.max(1.5,p.combTipReturnMm||2.5);
  const rng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|comb-continuous-field');
  const fw=p.featureWeights||{};
  const lattice=featureIntensity(p,'lattice'),cellular=featureIntensity(p,'cellular');
  const vessel=featureIntensity(p,'vessel'),dome=featureIntensity(p,'dome');
  const wrapped=featureIntensity(p,'wrapped'),cage=featureIntensity(p,'cage');
  const inter=featureIntensity(p,'interweave'),continuity=featureIntensity(p,'continuity');
  const parts=[];
  const n=34;
  const upper=[],lower=[],mid=[];
  // The upper body's treatment is the same shared structural-treatment
  // decision every typology consults — solid (thick, unbroken), volumetric
  // (soft mass lobes), or lattice (crossed members) — the teeth stay the
  // generative focus regardless of which one the seed picks.
  const upperBodyMode=pickStructuralTreatment(p, 'comb-upper-body');
  const combTreatmentMul = StructuralKit.treatmentMultipliers(upperBodyMode);
  const solidBoost = combTreatmentMul.thicknessBoost;
  // Where the crest's mass concentrates is itself seed-driven — not
  // always a symmetric bulge centered on the comb, which is what made
  // every generation read as the same silhouette.
  const crestPeakU = 0.30+0.42*rng();
  const crestWidth = 0.30+0.20*rng();
  for(let i=0;i<n;i++){
    const u=i/(n-1),x=-width/2+width*u,nx=x/(width/2);
    const archWave=Math.sin(Math.PI*u);
    const asym=(p.asymmetry||0)*3.2*Math.sin(2*Math.PI*u+(p.variation?.phaseA||0));
    const skullY=cranialCurve*(1-nx*nx);
    const zLower=toothL*.08+arch*archWave+asym*.18;
    const volumeLift=topH*(.10*dome+.08*vessel)*Math.pow(archWave,1.35);
    const localH=topH*(.34+.48*archWave+.12*continuity+.08*vessel*Math.sin(Math.PI*u+(p.variation?.phaseB||0)));
    const y=depth*.16+skullY+depth*.16*vessel*archWave;
    lower.push([x,y,zLower]);
    upper.push([x,y+depth*(.08+.16*dome)*archWave,zLower+localH+volumeLift]);
    mid.push([x,y+depth*.08*archWave,zLower+localH*(.42+.14*Math.sin(2*Math.PI*u+(p.variation?.phaseC||0)))]);
  }
  for(let i=0;i<n-1;i++){
    parts.push(ellipticalSegmentBetween(wasm,lower[i],lower[i+1],bodyR*(1.00+.18*continuity),bodyR*.72,16));
    // El cuerpo superior ahora es una masa real y continua — no una
    // versión apenas más gruesa de la red de tubos delgados que ya usa el
    // riel inferior. El grosor es sustancialmente mayor (varias veces
    // bodyR) y se afina hacia los extremos, leyendo como una cresta
    // escultórica genuina en toda circunstancia, no solo en modo volumen.
    {
      const q=(i+0.5)/(n-1);
      const distFromPeak=(q-crestPeakU)/crestWidth;
      const taperEdge=Math.exp(-distFromPeak*distFromPeak*1.3);
      const crestRX=topH*(0.20+0.05*dome+0.04*vessel)*solidBoost*(0.42+0.58*taperEdge);
      const crestRY=topH*(0.15+0.04*dome)*solidBoost*(0.42+0.58*taperEdge);
      parts.push(ellipticalSegmentBetween(wasm,upper[i],upper[i+1],crestRX,crestRY,18));
    }
    if(upperBodyMode!=='lattice'){
      // La zona media, entre el riel inferior y la cresta, se rellena con
      // masa real en vez de quedar vacía salvo por cruces ocasionales —
      // es justamente la franja que se veía como un tejido delgado sin
      // sentido en vez de una pieza escultórica continua.
      const midR=bodyR*(0.72+0.18*dome+0.14*vessel)*(upperBodyMode==='volumetric'?1.15:1.0);
      parts.push(ellipticalSegmentBetween(wasm,lower[i],mid[i],midR,midR*.82,14));
      parts.push(ellipticalSegmentBetween(wasm,mid[i],upper[i],midR*.92,midR*.76,14));
    }
    if(upperBodyMode==='lattice' && lattice>.16 && (i%Math.max(2,5-Math.round(lattice*3))===0||i===n-2)){
      const j=Math.min(n-1,i+2);
      parts.push(ellipticalSegmentBetween(wasm,lower[i],upper[j],bodyR*(.66+.22*lattice),bodyR*.52,14));
      parts.push(ellipticalSegmentBetween(wasm,upper[i],lower[j],bodyR*(.62+.20*inter),bodyR*.48,14));
    }
    if(upperBodyMode==='lattice' && cage>.22 && i%4===1){
      parts.push(ellipticalSegmentBetween(wasm,mid[i],mid[Math.min(n-1,i+2)],bodyR*(.48+.24*cage),bodyR*.42,12));
    }
  }
  if(upperBodyMode==='lattice' && wrapped>.18){
    const strands=1+Math.round(wrapped*2);
    for(let sIdx=0;sIdx<strands;sIdx++){
      const pts=[];
      for(let i=0;i<n;i++){
        const q=i/(n-1),mix=.30+.28*sIdx/Math.max(1,strands-1)+.12*Math.sin(q*Math.PI*2+(p.variation?.phaseB||0)+sIdx);
        pts.push([
          lower[i][0],
          lower[i][1]+depth*(.04+.08*wrapped)*Math.sin(Math.PI*q+sIdx),
          lower[i][2]+(upper[i][2]-lower[i][2])*clamp(mix,.18,.78)
        ]);
      }
      const mesh=tubeAlongPathMesh(pts,Math.max(AGDP_MIN_WALL_MM*.72,bodyR*(.38+.20*wrapped)),10,false);
      parts.push(meshToManifold(wasm,mesh.V,mesh.F));
    }
  }
  parts.push(flattenedNodeAt(wasm,lower[0],bodyR*1.35,bodyR*.88,bodyR*1.05,16));
  parts.push(flattenedNodeAt(wasm,lower[n-1],bodyR*1.35,bodyR*.88,bodyR*1.05,16));
  const nodeCount=upperBodyMode==='solid' ? 0 : Math.max(2,Math.round(2+cellular*4+inter*2));
  for(let k=0;k<nodeCount;k++){
    const u=(k+1)/(nodeCount+1),idx=Math.round(u*(n-1));
    const z=lower[idx][2]+(upper[idx][2]-lower[idx][2])*(.28+.48*rng());
    const rr=bodyR*(.82+.52*cellular+.22*rng());
    parts.push(flattenedNodeAt(wasm,[lower[idx][0],lower[idx][1]+rr*.12,z],rr*(1.0+.18*vessel),rr*(.62+.18*dome),rr*(.82+.20*continuity),16));
  }
  // El evento de masa obligatorio (Regla 7), construido por la misma
  // función compartida que cualquier otra tipología usaría para su propio
  // centro semántico.
  {
    const idx=Math.round(clamp(crestPeakU,0,1)*(n-1));
    const center=[upper[idx][0],upper[idx][1]+depth*.08,upper[idx][2]-topH*.04];
    parts.push(StructuralKit.buildEventMass(wasm, center, topH, dome, vessel));
  }

  // Mutación de la peineta: siempre sobre la cresta/cuerpo superior — los
  // dientes son funcionales y nunca se tocan.
  if (p.mutation && p.mutation.active){
    const sv=p.mutation.severity;
    if(p.mutation.mode==='hypertrophy'){
      const hRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|comb-hypertrophy');
      const idx=Math.floor(hRng()*n);
      const massR=topH*(0.16+0.18*sv);
      parts.push(flattenedNodeAt(wasm,upper[idx],massR*(1.2+.2*vessel),massR*(0.85+.2*dome),massR*(0.95+.2*dome),22));
    }else if(p.mutation.mode==='erosion'){
      const eRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|comb-erosion');
      const cutters=[];
      const count=2+Math.round(sv*4);
      for(let k=0;k<count;k++){
        const idx=Math.floor(eRng()*n);
        const vr=Math.max(1.0, topH*(0.09+0.09*sv));
        cutters.push(sphereAt(wasm,mid[idx],vr,14));
      }
      if(cutters.length){
        try{ const merged=unionAll(wasm,parts); parts.length=0; parts.push(wasm.Manifold.difference(merged,unionAll(wasm,cutters))); }
        catch(err){ console.warn('AGDP: erosión de peineta omitida por seguridad topológica',err); }
      }
    }else if(p.mutation.mode==='proliferation'){
      const pRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|comb-proliferation');
      const anchorIdx=Math.floor(pRng()*n);
      const anchor=upper[anchorIdx];
      const colonyCount=6+Math.round(sv*8);
      for(let k=0;k<colonyCount;k++){
        const jitter=topH*0.22;
        const pt=[anchor[0]+(pRng()*2-1)*jitter, anchor[1]+(pRng()*2-1)*jitter*0.5, anchor[2]+(pRng()*2-1)*jitter*0.6];
        const r=Math.max(0.5, topH*(0.03+0.025*pRng()));
        parts.push(flattenedNodeAt(wasm,pt,r,r*0.85,r*0.9,10));
      }
    }
  }
  if(upperBodyMode==='volumetric' || (upperBodyMode==='lattice' && (dome>.20||vessel>.20))){
    const lobes=(upperBodyMode==='volumetric'?2:1)+Math.round(Math.max(dome,vessel)*2);
    for(let k=0;k<lobes;k++){
      const u=.24+.52*(lobes===1?.5:k/(lobes-1)),idx=Math.round(u*(n-1));
      const rr=topH*(upperBodyMode==='volumetric'?0.085:0.055)*(1+dome+vessel*0.8);
      parts.push(flattenedNodeAt(wasm,[upper[idx][0],upper[idx][1]+depth*.05,upper[idx][2]-rr*.45],rr*(1.1+.25*vessel),rr*(.72+.22*dome),rr*(.80+.30*dome),20));
    }
  }

  const usable=width-18;
  for(let k=0;k<toothCount;k++){
    const x0=-usable/2+usable*(toothCount===1?.5:k/(toothCount-1));
    const u=(x0+width/2)/width,idx=Math.max(0,Math.min(n-1,Math.round(u*(n-1))));
    const lateral=x0/(usable/2||1),root=[x0,lower[idx][1],lower[idx][2]+bodyR*.18];
    const rootWidth=Math.max(2.25,bodyR*(1.05+.18*cage));
    const shaftWidth=Math.max(1.35,toothT*(.88+.16*continuity));
    const flat=Math.max(.72,toothT*(.50+.10*dome));
    const lean=Math.tan(insertionAngle)*toothL,sideConverge=-lateral*(1.4+1.0*wrapped),sway=(rng()-.5)*(0.4+0.5*inter);
    const pts=[root],steps=6;
    for(let j=1;j<=steps;j++){
      const q=j/steps,ease=q*q*(3-2*q);
      pts.push([x0+sideConverge*ease+sway*q,root[1]-lean*q+toothSweep*Math.sin(Math.PI*q)*(.72+.28*Math.abs(lateral)),root[2]-toothL*q-1.2*Math.sin(Math.PI*q)*Math.abs(lateral)]);
    }
    pts[steps][1]+=tipReturn;
    for(let j=0;j<steps;j++){
      const q=j/steps,rx=rootWidth*(1-q)+shaftWidth*q,ry=(bodyR*.72)*(1-q)+flat*q;
      parts.push(ellipticalSegmentBetween(wasm,pts[j],pts[j+1],rx,ry,16));
    }
    parts.push(flattenedNodeAt(wasm,root,rootWidth*1.08,bodyR*.82,rootWidth*.92,16));
    parts.push(flattenedNodeAt(wasm,pts[steps],shaftWidth*1.05,flat*1.05,shaftWidth*.92,16));
  }
  return {manifold:unionAll(wasm,parts),bandW:topH};
}

// Shared by every clip-like typology (universal clip, money clip, any
// future one): the seed picks among three genuinely different visible
// masses — continuous (via the same makeFaceManifold pendants and
// cufflinks use), amorphous, or a rotated slab with lobes — built once
// here instead of being reinvented, slightly differently, per typology.
async function buildThreeModeFace(wasm, p, faceW, faceH, faceTh, rng){
  const { Manifold } = wasm;
  const faceChoice=Math.floor(rng()*3);
  let face;
  if(faceChoice===0){
    const faceR=Math.min(faceW,faceH)/2;
    const faceParams=Object.assign({},p,{
      type:'threeModeFace',mainSize:faceR*2,bandWidth:faceTh,
      pendantArchitecture:'radial',crown:false,
      holes:Math.max(0,p.holes||0)
    });
    face=(await makeFaceManifold(wasm,faceParams,faceR,faceTh,Math.max(faceTh*.85,faceR*.55))).manifold;
    face=face.scale([faceW/(faceR*2),faceH/(faceR*2),1]);
  }else if(faceChoice===1){
    const sx=faceW/16, sy=faceH/16;
    const polarity=(p.compositionSignature?.polarity||1);
    const a=sphereAt(wasm,[-3.8*sx,1.0*sy,0],7.4*Math.min(sx,sy),28).scale([1.20,.90,.50]);
    const b=sphereAt(wasm,[3.6*sx,-1.6*sy,0],6.6*Math.min(sx,sy),26).scale([1.16,.96,.54]);
    const c=sphereAt(wasm,[.6*sx,2.4*sy,faceTh*.07],5.2*Math.min(sx,sy),24).scale([1.02,1.00,.46]);
    const notch=sphereAt(wasm,[polarity*6.2*sx,-2.6*sy,0],3.2*Math.min(sx,sy),22).scale([1.08,.9,.75]);
    face=Manifold.difference(unionAll(wasm,[a,b,c]),notch);
  }else{
    const rot=(p.compositionSignature?.polarity||1)*(5+9*rng());
    let slab=Manifold.cube([faceW*.86,faceH*.79,faceTh],true).rotate([0,0,rot]);
    const lobe1=sphereAt(wasm,[faceW*.26,faceH*.14,0],faceH*.31,24).scale([1.20,.85,.55]);
    const lobe2=sphereAt(wasm,[-faceW*.28,-faceH*.16,0],faceH*.27,22).scale([.98,1.00,.52]);
    const voidCut=Manifold.cube([faceW*.18,faceH*.35,faceTh*1.8],true).rotate([0,0,-17]).translate([-faceW*.07,faceH*.045,0]);
    face=Manifold.difference(unionAll(wasm,[slab,lobe1,lobe2]),voidCut);
  }
  return face.translate([0,0,faceTh*.45]);
}

async function makeUniversalClipManifold(wasm,p){
  const { Manifold }=wasm;
  const mechL=Math.max(34,p.clipLengthMm||36);
  const mechW=Math.max(6.4,p.clipWidthMm||7.2);
  const T=Math.max(1.8,p.clipThicknessMm||2.0);
  const gap=Math.max(2.4,p.clipGapMm||2.8);
  const springL=Math.min(mechL-4,Math.max(30,p.clipSpringLengthMm||32));
  const rng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|universal-clip-face');
  const parts=[];
  const capsule=(a,b,r)=>unionAll(wasm,[cylinderBetween(wasm,a,b,r,24),sphereAt(wasm,a,r,20),sphereAt(wasm,b,r,20)]);

  const faceW=clamp((p.clipFaceWidthMm||32)*(0.90+rng()*.22),27,38);
  const faceH=clamp((p.clipFaceHeightMm||30)*(0.88+rng()*.26),25,37);
  const faceTh=Math.max(3.6,T*1.9);
  const face=await buildThreeModeFace(wasm, p, faceW, faceH, faceTh, rng);

  // La distancia del mecanismo se calcula desde la superficie posterior real
  // de la cara generada. Así, una cara abombada o amorfa nunca invade la garganta.
  const faceMesh=manifoldToMesh(face);
  const faceBounds=bounds(faceMesh.V);
  const faceBackZ=faceBounds.min[2];
  const plateT=Math.max(1.6,T);
  const zBack=faceBackZ-plateT*.50+0.08;
  const zRear=faceBackZ-gap-T*.50;
  parts.push(face);

  // Mutación de clip: hipertrofia sobre la cara frontal — el mecanismo ya
  // calculó su holgura desde la cara original, así que un bulto frontal
  // nunca invade la garganta trasera.
  if (p.mutation && p.mutation.active && p.mutation.mode==='hypertrophy'){
    const sv=p.mutation.severity;
    const hRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|clip-hypertrophy');
    const fx=(hRng()*2-1)*faceW*0.28, fy=(hRng()*2-1)*faceH*0.28;
    const massR=Math.max(faceTh*0.9, faceTh*(1.0+0.9*sv));
    parts.push(sphereAt(wasm,[fx,fy,faceTh*0.35+massR*0.3],massR,20));
  }

  // Placa posterior de unión, completamente oculta por la cara visible.
  const backW=Math.min(faceW*.58,mechL+4);
  const backH=Math.min(faceH*.34,mechW+3.0);
  const backPlate=Manifold.cube([backW,backH,plateT],true).translate([0,0,zBack]);
  parts.push(backPlate);

  // El mecanismo se contiene dentro de la propia huella de la cara —
  // antes su brazo se extendía casi tanto como el ancho completo de la
  // cara, proyectándose visiblemente más allá de su silueta y leyendo
  // como una pieza separada en vez de un mecanismo integrado detrás de
  // la masa.
  const mechSpan=Math.min(mechL, faceW*0.74);
  const rearX0=-mechSpan/2+2.0, rearX1=rearX0+Math.min(springL, mechSpan-4);
  parts.push(Manifold.cube([rearX1-rearX0,mechW*.38,T*.80],true).translate([(rearX0+rearX1)/2,0,zRear]));
  parts.push(capsule([rearX0,0,zRear],[rearX0+2.0,0,zRear],mechW*.20));
  parts.push(capsule([rearX1-2.0,0,zRear],[rearX1,0,zRear],mechW*.20));

  const bendPts=[];
  const bendR=(gap+T)*.48;
  const cx=rearX0, cz=(zBack+zRear)/2;
  for(let i=0;i<=12;i++){
    const a=Math.PI/2+Math.PI*i/12;
    bendPts.push([cx+bendR*Math.cos(a),0,cz+bendR*Math.sin(a)]);
  }
  const bendMesh=tubeAlongPathMesh(bendPts,Math.max(.70,T*.36),12,false);
  parts.push(meshToManifold(wasm,bendMesh.V,bendMesh.F));
  // Punta simple: una sola curva continua con extremo redondeado — el
  // mismo catálogo de herrajes reales usa un cierre deliberadamente
  // simple, no una cadena de tres segmentos que aquí se leía como ruido
  // visual.
  const tipR=Math.max(0.85,mechW*.19);
  const tipPts=[];
  const tipBendR=2.4;
  const tipCx=rearX1-tipBendR, tipCz=zRear;
  for(let i=0;i<=10;i++){
    const a=Math.PI*i/10;
    tipPts.push([tipCx+tipBendR*Math.cos(a),0,tipCz+tipBendR*Math.sin(a)*0.85]);
  }
  const tipMesh=tubeAlongPathMesh(tipPts,tipR,14,false);
  parts.push(meshToManifold(wasm,tipMesh.V,tipMesh.F));
  parts.push(sphereAt(wasm,tipPts[tipPts.length-1],tipR*1.05,20));

  // Dos apoyos cortos vinculan el mecanismo con la placa posterior, sin atravesar la cara.
  parts.push(cylinderBetween(wasm,[-backW*.30,0,zBack],[-backW*.30,0,zRear],Math.max(1.0,T*.52),18));
  parts.push(cylinderBetween(wasm,[ backW*.30,0,zBack],[ backW*.30,0,zRear],Math.max(1.0,T*.52),18));

  p.clipFaceWidthMm=faceW;
  p.clipFaceHeightMm=faceH;
  p.clipEffectiveClearanceMm=gap;
  p.clipFaceBackZMm=faceBackZ;
  return {manifold:unionAll(wasm,parts),bandW:Math.max(faceW,faceH)};
}


async function makeMoneyClipManifold(wasm,p){
  const { Manifold }=wasm;
  const L=clamp(p.moneyClipLengthMm||55,48,64);
  const W=clamp(p.moneyClipWidthMm||23,18,28);
  const T=clamp(p.moneyClipThicknessMm||2.0,1.8,2.4);
  const gap=clamp(p.moneyClipGapMm||3.8,2.6,5.2);
  // El radio funcional deriva de la separación real entre las dos láminas.
  // Esto mantiene el retorno cerrado y continuo en todas las tallas.
  const returnR=Math.max(T*.72,(gap+T)/2);
  const requestedRearL=Math.max(L*.72,p.moneyClipRearLengthMm||L-8);
  const rng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|money-clip-face');
  const parts=[];
  const capsule=(a,b,r)=>unionAll(wasm,[cylinderBetween(wasm,a,b,r,24),sphereAt(wasm,a,r,20),sphereAt(wasm,b,r,20)]);

  // El frente usa la misma función compartida que el clip universal —
  // no una copia propia con constantes ligeramente distintas — adaptada
  // a las proporciones alargadas del money clip vía faceL/faceW.
  const faceL=clamp(L*(0.90+rng()*.10),40,60);
  const faceW=clamp(W*(0.86+rng()*.16),16,26);
  const faceTh=Math.max(3.4,T*1.9);
  const face=await buildThreeModeFace(wasm, p, faceL, faceW, faceTh, rng);

  // La distancia del mecanismo se calcula desde la superficie posterior
  // real de la cara generada, igual que en el clip universal — así una
  // cara abombada o amorfa nunca invade la garganta ni queda descentrada.
  const faceMesh=manifoldToMesh(face);
  const faceBounds=bounds(faceMesh.V);
  const faceBackZ=faceBounds.min[2];
  parts.push(face);

  // Mutación de money clip: hipertrofia sobre la cara frontal — el brazo
  // trasero ya midió su holgura desde la cara original, la masa nunca
  // invade la capacidad útil para el billete.
  if (p.mutation && p.mutation.active && p.mutation.mode==='hypertrophy'){
    const sv=p.mutation.severity;
    const hRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|moneyclip-hypertrophy');
    const fx=(hRng()*2-1)*faceL*0.30, fy=(hRng()*2-1)*faceW*0.28;
    const massR=Math.max(faceTh*0.85, faceTh*(0.95+0.85*sv));
    parts.push(sphereAt(wasm,[fx,fy,faceTh*0.4+massR*0.3],massR,20));
  }

  // Punteras redondeadas discretas en los extremos, ancladas a la cara real.
  const tipR=Math.max(1.7,W*.095);
  [[-faceL*.47,0],[faceL*.47,0]].forEach(([x,y])=>{
    parts.push(flattenedNodeAt(wasm,[x,y,faceBackZ+tipR*.6],tipR,tipR*.82,tipR*.7,20));
  });

  // Brazo posterior elástico, paralelo al frente y con garganta útil
  // constante, medida desde la superficie posterior real de la cara —
  // nunca desde un z=0 asumido.
  const rearZ=faceBackZ-gap-T*.5;
  const x0=-L/2+returnR+1.0;
  const maxRearEnd=L/2-2.2;
  const rearL=Math.min(requestedRearL,maxRearEnd-x0);
  const x1=x0+rearL;
  const rear=Manifold.cube([rearL,W*.54,T],true).translate([(x0+x1)/2,0,rearZ]);
  parts.push(rear);

  // Placa posterior de unión, oculta detrás de la cara.
  const backW=Math.min(faceL*.62,rearL+6);
  const backH=Math.min(faceW*.58,W*.7);
  const plateT=Math.max(1.6,T);
  const zBack=faceBackZ-plateT*.5+0.08;
  const backPlate=Manifold.cube([backW,backH,plateT],true).translate([0,0,zBack]);
  parts.push(backPlate);
  parts.push(cylinderBetween(wasm,[-backW*.30,0,zBack],[-backW*.30,0,rearZ],Math.max(0.85,T*.44),18));
  parts.push(cylinderBetween(wasm,[ backW*.30,0,zBack],[ backW*.30,0,rearZ],Math.max(0.85,T*.44),18));

  // Retorno en U construido desde la separación efectiva entre frente y brazo.
  // Sus extremos coinciden exactamente con zBack y rearZ, por lo que no quedan
  // segmentos truncados ni uniones parciales al aumentar la talla.
  const bend=[];
  const centerZ=(zBack+rearZ)/2;
  const bendR=Math.abs(zBack-rearZ)*.5;
  for(let i=0;i<=24;i++){
    const a=Math.PI/2+Math.PI*i/24;
    bend.push([x0+bendR*Math.cos(a),0,centerZ+bendR*Math.sin(a)]);
  }
  const bendMesh=tubeAlongPathMesh(bend,Math.max(0.92,T*.50),18,false);
  parts.push(meshToManifold(wasm,bendMesh.V,bendMesh.F));

  // Punta de presión completa, redondeada y contenida dentro de la longitud nominal.
  const p0=[x1-5.2,0,rearZ];
  const p1=[x1-2.2,0,rearZ+.62];
  const p2=[Math.min(L/2-0.8,x1+1.4),0,rearZ+1.35];
  const pr=Math.max(1.35,T*.72);
  parts.push(capsule(p0,p1,pr));
  parts.push(capsule(p1,p2,pr*.94));
  parts.push(sphereAt(wasm,p2,pr,28));

  p.moneyClipLengthMm=L;
  p.moneyClipWidthMm=W;
  p.moneyClipThicknessMm=T;
  p.moneyClipGapMm=gap;
  p.moneyClipReturnRadiusMm=returnR;
  p.moneyClipRearLengthMm=rearL;
  return {manifold:unionAll(wasm,parts),bandW:Math.max(faceL,faceW)};
}

const AGDP_SILVER_HOLLOWING=Object.freeze({
  source:'Shapeways Silver design guidelines · consulted 2026-07-19',
  polishedMinimumWallMm:0.8,
  conservativeShellWallMm:Object.freeze({
    choker:1.6,
    headpiece:1.5,
    bangle:1.7,
    cuffBracelet:1.8
  }),
  escapeHoleDiameterMm:2.4,
  escapeHoleCount:2,
  thresholdsGrams:Object.freeze({
    ring:Object.freeze({hollowAt:Infinity,rejectAbove:38}),
    pendant:Object.freeze({hollowAt:Infinity,rejectAbove:110}),
    bangle:Object.freeze({hollowAt:125,rejectAbove:190}),
    cuffBracelet:Object.freeze({hollowAt:115,rejectAbove:180}),
    chokerTorque:Object.freeze({hollowAt:95,rejectAbove:150}),
    chokerSculptural:Object.freeze({hollowAt:75,rejectAbove:120}),
    chokerCervical:Object.freeze({hollowAt:145,rejectAbove:220}),
    headpiece:Object.freeze({hollowAt:60,rejectAbove:90}),
    cufflinks:Object.freeze({hollowAt:Infinity,rejectAbove:60}),
    earCuff:Object.freeze({hollowAt:Infinity,rejectAbove:28})
  })
});
window.AGDP_SILVER_HOLLOWING=AGDP_SILVER_HOLLOWING;

function silverWeightProfileKey(p){
  if(p.type!=='choker')return p.type;
  if(p.chokerProfile==='torque')return 'chokerTorque';
  if(p.chokerProfile==='cervical')return 'chokerCervical';
  return 'chokerSculptural';
}
function manifoldBounds(manifold){
  const mesh=manifoldToMeshHelper(manifold);
  return {mesh,b:bounds(mesh.V)};
}
function applyConservativeSilverHollowing(wasm,manifold,p){
  // DISABLED: the escape-hole placement heuristic below picks "low"
  // vertices by z-coordinate without regard to whether that point sits on
  // a rail, node, or relief feature — it was producing perforations that
  // read as visual defects rather than deliberate drainage holes, on
  // exactly the types (bangle/choker/headpiece/cuffBracelet) where it was
  // reported. Disabled at the single entry point below rather than
  // rewriting the CSG logic blind; the function body is left intact so it
  // can be re-enabled once hole placement is redesigned and verified
  // against real renders.
  p.silverHollowingApplied=false;
  return manifold;

  const profileKey=silverWeightProfileKey(p);
  const limits=AGDP_SILVER_HOLLOWING.thresholdsGrams[profileKey]||{hollowAt:Infinity,rejectAbove:Infinity};
  const before=manifoldBounds(manifold);
  const initialWeight=silverWeightGrams(meshVolumeMm3(before.mesh.V,before.mesh.F));
  p.silverWeightBeforeHollowingG=initialWeight;
  p.silverWeightProfile=profileKey;
  p.silverWeightLimitG=limits.rejectAbove;
  p.silverHollowingApplied=false;

  const wall=AGDP_SILVER_HOLLOWING.conservativeShellWallMm[p.type];
  if(!wall || initialWeight<limits.hollowAt)return manifold;

  const b=before.b,dim=b.dim;
  // A scaled internal duplicate is only allowed when every axis contains a
  // generous cavity: at least two walls plus a further 2.4 mm working core.
  if(dim.some(d=>d<wall*2+2.4))return manifold;
  const center=[(b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2];
  const scale=dim.map(d=>clamp((d-2*wall)/d,.15,.94));
  let inner=manifold.translate(center.map(v=>-v)).scale(scale).translate(center);
  let hollowed;
  try{ hollowed=wasm.Manifold.difference(manifold,inner); }
  catch(e){ return manifold; }

  // Two opposing 2.4 mm escape holes exceed Shapeways' 2.0 mm multiple-hole
  // minimum. They are placed through low, opposite sides of the shell and
  // directed radially so they reach the scaled cavity without crossing the
  // wearable contact surface more than necessary.
  const candidates=before.mesh.V.slice().sort((a,bv)=>a[2]-bv[2]);
  const low=candidates.slice(0,Math.max(24,Math.floor(candidates.length*.12)));
  function pick(side){
    const set=low.filter(v=>side<0?v[0]<center[0]:v[0]>=center[0]);
    const pool=set.length?set:low;
    return pool.reduce((best,v)=>Math.hypot(v[0],v[1])>Math.hypot(best[0],best[1])?v:best,pool[0]);
  }
  const holeR=AGDP_SILVER_HOLLOWING.escapeHoleDiameterMm/2;
  const cutters=[];
  [-1,1].forEach(side=>{
    const v=pick(side); if(!v)return;
    const rr=Math.hypot(v[0],v[1])||1;
    const ux=v[0]/rr,uy=v[1]/rr;
    const p0=[v[0]+ux*(wall*1.8),v[1]+uy*(wall*1.8),v[2]];
    const p1=[v[0]-ux*(wall*3.2),v[1]-uy*(wall*3.2),v[2]];
    cutters.push(cylinderBetween(wasm,p0,p1,holeR,24));
  });
  if(cutters.length===2){
    try{ hollowed=wasm.Manifold.difference(hollowed,unionAll(wasm,cutters)); }
    catch(e){ return manifold; }
  }else return manifold;

  const after=manifoldBounds(hollowed);
  const finalWeight=silverWeightGrams(meshVolumeMm3(after.mesh.V,after.mesh.F));
  // Do not accept a boolean operation that saves too little material or
  // produces an implausibly aggressive reduction. Both indicate that the
  // internal copy did not behave as a reliable shell for this morphology.
  const reduction=1-finalWeight/Math.max(initialWeight,1e-6);
  if(!Number.isFinite(finalWeight)||reduction<.18||reduction>.82)return manifold;
  const topo=topologyAudit(after.mesh.V,after.mesh.F);
  if(!topo.manifoldOK)return manifold;

  p.silverHollowingApplied=true;
  p.silverShellWallMm=wall;
  p.silverEscapeHoleDiameterMm=AGDP_SILVER_HOLLOWING.escapeHoleDiameterMm;
  p.silverEscapeHoleCount=2;
  p.silverWeightAfterHollowingG=finalWeight;
  p.silverWeightReductionRatio=reduction;
  return hollowed;
}

async function makeMeshManifoldEntry(wasm, inputParams){
  const p = window.GenerationLayers.compile(Object.assign({}, inputParams));
  let manifold;
  if (p.type==='pendant') {
    ({manifold} = await makePendantManifold(wasm, p));
  } else if (p.type==='cufflinks') {
    ({manifold} = await makeCufflinksManifold(wasm, p));
  } else {
    const topology = p.topology;
    const type = p.type==='ring'?'ring':p.type;
    ({manifold} = await buildBandGeometryManifold(wasm, p, {
      type, innerD:p.mainSize, width:p.bandWidth,
      closed: topology.closed, opening: topology.closed?0:topology.opening
    }));
    if(p.type==='choker'){
      manifold=addOpenBandVolumetricField(wasm,manifold,p,'choker');
      manifold=applyChokerErgonomics(wasm,manifold,p);
    }else if(p.type==='headpiece'){
      manifold=addOpenBandVolumetricField(wasm,manifold,p,'headpiece');
      manifold=applyHeadErgonomics(wasm,manifold,p);
    }
  }
  manifold=applyConservativeSilverHollowing(wasm,manifold,p);
  let { V, F } = manifoldToMeshHelper(manifold);
  // Manifold-3d is a WASM module: it does not garbage-collect like normal
  // JS objects. Every top-level manifold produced by a generation attempt
  // (successful or discarded by the retry loop) must be explicitly freed
  // here, once its mesh data (V/F) has been extracted, or its memory is
  // never reclaimed for the lifetime of the page — across many
  // generations this silently exhausts the WASM heap until the engine
  // stops working. `manifold` itself is never referenced again after this
  // point in this function, so deleting it here is always safe.
  if (manifold && typeof manifold.delete === 'function') {
    try { manifold.delete(); } catch (e) { /* already freed or not disposable; ignore */ }
  }
  const connected = removeFloatingComponents(V, F, p.type==='cufflinks'?2:1);
  V = connected.V; F = connected.F;
  if(connected.discarded && connected.discarded.length){
    console.warn('AGDP: '+connected.discarded.length+' componente(s) descartado(s) de '+connected.totalComponents+' total — ', connected.discarded);
  }
  const extra = {
    type:p.type, innerD:(p.type==='ring'||p.type==='bangle'||p.type==='earCuff')?p.mainSize:(p.type==='cuffBracelet'?p.mainSize*0.85:0),
    bandW:p.bandWidth, holeCells:0, printProfile:p.printProfile, minFeature:p.minFeature,
    maxRelief:p.surfaceRelief+p.sideRelief, spikes:0, hinges:p.hinges,
    allowConstructiveOverlap:true, booleanUnion:true, allowedSolids:p.type==='cufflinks'?2:1
  };
  const audit = window.validate(V, F, extra);
  const weightLimits=AGDP_SILVER_HOLLOWING.thresholdsGrams[silverWeightProfileKey(p)]||{rejectAbove:Infinity};
  audit.weightLimitG=weightLimits.rejectAbove;
  audit.weightOK=audit.silverG<=weightLimits.rejectAbove;
  audit.hollowingApplied=!!p.silverHollowingApplied;
  audit.shellWallMm=p.silverShellWallMm||null;
  audit.escapeHoleDiameterMm=p.silverEscapeHoleDiameterMm||null;
  audit.escapeHoleCount=p.silverEscapeHoleCount||0;
  audit.weightBeforeHollowingG=p.silverWeightBeforeHollowingG||audit.silverG;
  if(!audit.weightOK){
    audit.ok=false;
    audit.warning='FALLA: masa de plata superior al límite ergonómico y económico';
  }
  audit.discardedComponents = connected.discarded||[];
  return { V, F, audit, bandW: extra.bandW||0, innerR:(extra.innerD||0)/2 };
}
function manifoldToMeshHelper(manifoldObj){
  const out = manifoldObj.getMesh();
  const V = [], F = [];
  for (let i = 0; i < out.vertProperties.length; i += 3) V.push([out.vertProperties[i], out.vertProperties[i+1], out.vertProperties[i+2]]);
  for (let i = 0; i < out.triVerts.length; i += 3) F.push([out.triVerts[i], out.triVerts[i+1], out.triVerts[i+2]]);
  return { V, F };
}

let _wasmReady = null;
function ensureWasm(){
  if(!_wasmReady){
    _wasmReady = Module().then(wasm => { wasm.setup(); return wasm; });
  }
  return _wasmReady;
}
window.makeMeshManifold = async function(inputParams){
  const wasm = await ensureWasm();
  return makeMeshManifoldEntry(wasm, inputParams);
};
window.AGDP_MANIFOLD_PRELOAD = ensureWasm();



