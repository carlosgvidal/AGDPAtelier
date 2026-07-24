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
  try {
    return new Manifold(mesh);
  } finally {
    if (mesh && typeof mesh.delete === 'function') mesh.delete();
  }
}

function manifoldToMesh(manifoldObj) {
  const out = manifoldObj.getMesh();
  try {
    const V = [], F = [];
    for (let i = 0; i < out.vertProperties.length; i += 3) V.push([out.vertProperties[i], out.vertProperties[i+1], out.vertProperties[i+2]]);
    for (let i = 0; i < out.triVerts.length; i += 3) F.push([out.triVerts[i], out.triVerts[i+1], out.triVerts[i+2]]);
    return { V, F };
  } finally {
    if (out && typeof out.delete === 'function') out.delete();
  }
}

function unionAll(wasm, manifolds) {
  const { Manifold } = wasm;
  let list = manifolds.filter(m => m && !m.isEmpty());
  if (list.length === 0) return Manifold.cube([0.001,0.001,0.001], true);
  while (list.length > 1) {
    const next = [];
    for (let i = 0; i < list.length; i += 2) {
      if (i + 1 < list.length) {
        const merged = Manifold.union(list[i], list[i+1]);
        try{ list[i].delete(); }catch(e){}
        try{ list[i+1].delete(); }catch(e){}
        next.push(merged);
      }
      else next.push(list[i]);
    }
    list = next;
  }
  return list[0];
}

function safeDifference(wasm, a, b) {
  const result = wasm.Manifold.difference(a, b);
  try{ a.delete(); }catch(e){}
  try{ b.delete(); }catch(e){}
  return result;
}

function wedgeCutterMesh(t0, t1, radius, height){
  const cx0=radius*Math.cos(t0), cy0=radius*Math.sin(t0);
  const cx1=radius*Math.cos(t1), cy1=radius*Math.sin(t1);
  const hz=height/2;
  const V=[[0,0,-hz],[cx0,cy0,-hz],[cx1,cy1,-hz],[0,0,hz],[cx0,cy0,hz],[cx1,cy1,hz]];
  const F=[[0,1,2],[3,5,4],[0,2,5],[0,5,3],[0,3,4],[0,4,1],[1,4,5],[1,5,2]];
  return {V,F};
}

function dovetailPrismMesh(anchor, radialDir, tangentDir, baseHalfW, tipHalfW, railHeight, zLen, zCenterOffset){
  const hz = zLen/2;
  const z0 = zCenterOffset - hz, z1 = zCenterOffset + hz;
  function corner(halfW, height, zOff, sign){
    return [
      anchor[0] + tangentDir[0]*halfW*sign + radialDir[0]*height,
      anchor[1] + tangentDir[1]*halfW*sign + radialDir[1]*height,
      anchor[2] + zOff
    ];
  }
  const V = [
    corner(baseHalfW, 0, z0, -1), corner(baseHalfW, 0, z0, 1),
    corner(tipHalfW, railHeight, z0, 1), corner(tipHalfW, railHeight, z0, -1),
    corner(baseHalfW, 0, z1, -1), corner(baseHalfW, 0, z1, 1),
    corner(tipHalfW, railHeight, z1, 1), corner(tipHalfW, railHeight, z1, -1)
  ];
  const F = [
    [0,1,2],[0,2,3],
    [4,6,5],[4,7,6],
    [0,4,5],[0,5,1],
    [1,5,6],[1,6,2],
    [2,6,7],[2,7,3],
    [3,7,4],[3,4,0]
  ];
  return {V,F};
}

function buildDovetailRailFull(wasm, anchor, wall, zMin, zMax){
  const rr = Math.hypot(anchor[0],anchor[1])||1;
  const radialDir = [anchor[0]/rr, anchor[1]/rr, 0];
  const tangentDir = [-radialDir[1], radialDir[0], 0];
  const baseHalfW = wall*0.9, tipHalfW = wall*1.5, railHeight = wall*1.9;
  const margin = Math.max(1.0, wall*0.5);
  const railLen = Math.max(4, (zMax-zMin) - 2*margin);
  const zCenter = (zMin+zMax)/2 - anchor[2];
  const mesh = dovetailPrismMesh(anchor, radialDir, tangentDir, baseHalfW, tipHalfW, railHeight, railLen, zCenter);
  return meshToManifold(wasm, mesh.V, mesh.F);
}

function cutDovetailGrooveFull(wasm, segmentManifold, anchor, wall, zMin, zMax){
  const rr = Math.hypot(anchor[0],anchor[1])||1;
  const radialDir = [anchor[0]/rr, anchor[1]/rr, 0];
  const tangentDir = [-radialDir[1], radialDir[0], 0];
  const baseHalfW = wall*0.9+0.25, tipHalfW = wall*1.5+0.25, railHeight = wall*1.9+0.3;
  const margin = Math.max(1.0, wall*0.5);
  const railLen = Math.max(4, (zMax-zMin) - 2*margin);
  const zCenter = (zMin+zMax)/2 - anchor[2];
  const mesh = dovetailPrismMesh(anchor, radialDir, tangentDir, baseHalfW, tipHalfW, railHeight, railLen+1.0, zCenter);
  const cutter = meshToManifold(wasm, mesh.V, mesh.F);
  return safeDifference(wasm, segmentManifold, cutter);
}

function findCutFaceAnchor(V, targetAngle, tol){
  tol = tol||0.02;
  const candidates = V.filter(v=>Math.abs(Math.atan2(v[1],v[0])-targetAngle)<tol);
  if(candidates.length===0) return null;
  let sumR=0, minZ=Infinity, maxZ=-Infinity;
  candidates.forEach(v=>{ const r=Math.hypot(v[0],v[1]); sumR+=r; if(v[2]<minZ)minZ=v[2]; if(v[2]>maxZ)maxZ=v[2]; });
  const r = sumR/candidates.length, z=(minZ+maxZ)/2;
  const point = [r*Math.cos(targetAngle), r*Math.sin(targetAngle), z];
  return { point, minZ, maxZ };
}

function splitIntoHookedSegments(wasm, manifold, wall){
  const { Manifold } = wasm;
  const mesh = manifoldToMesh(manifold);
  const angles = mesh.V.map(v=>Math.atan2(v[1],v[0]));
  const minA = Math.min(...angles), maxA = Math.max(...angles);
  const span = (maxA-minA)/3;
  const cutEps = 0.0001743;
  const cutAngles = [minA, minA+span+cutEps, minA+2*span-cutEps, maxA];
  const approxRadius = Math.max(30, mesh.V.reduce((s,v)=>s+Math.hypot(v[0],v[1]),0)/mesh.V.length);
  const gapEps = 0.4/approxRadius;
  const R = 300, H = 300;
  const segments = [];
  const segBounds = [
    [cutAngles[0], cutAngles[1]-gapEps],
    [cutAngles[1]+gapEps, cutAngles[2]-gapEps],
    [cutAngles[2]+gapEps, cutAngles[3]]
  ];
  for(let s=0;s<3;s++){
    const wc = wedgeCutterMesh(segBounds[s][0], segBounds[s][1], R, H);
    const wedge = meshToManifold(wasm, wc.V, wc.F);
    segments.push(Manifold.intersection(manifold, wedge));
    try{ wedge.delete(); }catch(e){}
  }
  try{ manifold.delete(); }catch(e){}
  {
    const m0 = manifoldToMesh(segments[0]);
    const anchor = findCutFaceAnchor(m0.V, cutAngles[1]-gapEps, gapEps*3+0.02);
    if(anchor){
      const old = segments[0];
      const railGeo = buildDovetailRailFull(wasm, anchor.point, wall, anchor.minZ, anchor.maxZ);
      segments[0] = Manifold.union(old, railGeo);
      try{ old.delete(); }catch(e){}
      try{ railGeo.delete(); }catch(e){}
    }
    const m1 = manifoldToMesh(segments[1]);
    const anchorB = findCutFaceAnchor(m1.V, cutAngles[1]+gapEps, gapEps*3+0.02);
    if(anchorB){
      segments[1] = cutDovetailGrooveFull(wasm, segments[1], anchorB.point, wall, anchorB.minZ, anchorB.maxZ);
    }
  }
  {
    const m1 = manifoldToMesh(segments[1]);
    const anchor = findCutFaceAnchor(m1.V, cutAngles[2]-gapEps, gapEps*3+0.02);
    if(anchor){
      const old = segments[1];
      const railGeo = buildDovetailRailFull(wasm, anchor.point, wall, anchor.minZ, anchor.maxZ);
      segments[1] = Manifold.union(old, railGeo);
      try{ old.delete(); }catch(e){}
      try{ railGeo.delete(); }catch(e){}
    }
    const m2 = manifoldToMesh(segments[2]);
    const anchorB = findCutFaceAnchor(m2.V, cutAngles[2]+gapEps, gapEps*3+0.02);
    if(anchorB){
      segments[2] = cutDovetailGrooveFull(wasm, segments[2], anchorB.point, wall, anchorB.minZ, anchorB.maxZ);
    }
  }
  return segments;
}

function concatenateSegmentMeshes(segmentManifolds){
  let V = [], F = [], offset = 0;
  for(const seg of segmentManifolds){
    const m = manifoldToMesh(seg);
    V = V.concat(m.V);
    F = F.concat(m.F.map(f=>[f[0]+offset, f[1]+offset, f[2]+offset]));
    offset += m.V.length;
  }
  return { V, F };
}

function identicalFacingPairMesh(unitV, unitF, centerSpacing){
  const rad=d=>d*Math.PI/180;
  const rotateX=(v,a)=>{const c=Math.cos(a),sn=Math.sin(a);return [v[0],v[1]*c-v[2]*sn,v[1]*sn+v[2]*c];};
  const rotateY=(v,a)=>{const c=Math.cos(a),sn=Math.sin(a);return [v[0]*c+v[2]*sn,v[1],-v[0]*sn+v[2]*c];};
  const rotateZ=(v,a)=>{const c=Math.cos(a),sn=Math.sin(a);return [v[0]*c-v[1]*sn,v[0]*sn+v[1]*c,v[2]];};
  const pose=(v,rx,ry,rz)=>rotateZ(rotateY(rotateX(v,rad(rx)),rad(ry)),rad(rz));

  const half=centerSpacing*.54;
  const leftV=unitV.map(v=>{
    const r=pose(v,-5,-40,-5);
    return [r[0]-half,r[1]-1.5,r[2]+1.8];
  });
  const rightV=unitV.map(v=>{
    const r=pose(v,2,-10,3);
    return [r[0]+half,r[1]+1.0,r[2]-0.8];
  });
  const offset=leftV.length;
  const leftF=unitF.map(f=>[f[0],f[1],f[2]]);
  const rightF=unitF.map(f=>[f[0]+offset,f[1]+offset,f[2]+offset]);
  return {V:leftV.concat(rightV),F:leftF.concat(rightF)};
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

function variableEllipticalTubeMesh(points, radii, ringSegN, closed){
  ringSegN=Math.max(Math.round(ringSegN||8),8);
  closed=!!closed;
  if(!Array.isArray(points)||!Array.isArray(radii)||points.length!==radii.length||points.length<(closed?3:2)){
    throw new Error('variableEllipticalTubeMesh: invalid path/radii input');
  }

  const cleanPoints=[];
  const cleanRadii=[];
  const EPS2=1e-12;
  for(let i=0;i<points.length;i++){
    const q=points[i];
    const r=radii[i];
    if(!q||q.length<3||!r||r.length<2||!q.every(Number.isFinite)||!r.every(Number.isFinite)){
      throw new Error('variableEllipticalTubeMesh: non-finite sample');
    }
    if(cleanPoints.length){
      const a=cleanPoints[cleanPoints.length-1];
      const dx=q[0]-a[0],dy=q[1]-a[1],dz=q[2]-a[2];
      if(dx*dx+dy*dy+dz*dz<=EPS2){
        cleanRadii[cleanRadii.length-1]=[Math.max(cleanRadii[cleanRadii.length-1][0],r[0]),Math.max(cleanRadii[cleanRadii.length-1][1],r[1])];
        continue;
      }
    }
    cleanPoints.push([q[0],q[1],q[2]]);
    cleanRadii.push([Math.max(1e-4,r[0]),Math.max(1e-4,r[1])]);
  }
  if(cleanPoints.length<(closed?3:2)) throw new Error('variableEllipticalTubeMesh: collapsed path');

  const n=cleanPoints.length,V=[],F=[];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const length=a=>Math.hypot(a[0],a[1],a[2]);
  const norm=a=>{const l=length(a);return l>1e-12?[a[0]/l,a[1]/l,a[2]/l]:null;};
  const tangents=[];
  for(let i=0;i<n;i++){
    const prev=cleanPoints[closed?(i-1+n)%n:Math.max(0,i-1)];
    const next=cleanPoints[closed?(i+1)%n:Math.min(n-1,i+1)];
    let t=norm([next[0]-prev[0],next[1]-prev[1],next[2]-prev[2]]);
    if(!t){
      const fallback=i>0?tangents[i-1]:norm([cleanPoints[1][0]-cleanPoints[0][0],cleanPoints[1][1]-cleanPoints[0][1],cleanPoints[1][2]-cleanPoints[0][2]]);
      t=fallback||[1,0,0];
    }
    tangents.push(t);
  }

  let ref=Math.abs(tangents[0][2])<0.85?[0,0,1]:[0,1,0];
  let e1=norm(cross(ref,tangents[0]))||[1,0,0];
  let e2=norm(cross(tangents[0],e1))||[0,1,0];
  const rings=[];
  for(let i=0;i<n;i++){
    if(i>0){
      const t0=tangents[i-1],t1=tangents[i];
      const axis=cross(t0,t1);
      const sinA=length(axis),cosA=clamp(dot(t0,t1),-1,1);
      if(sinA>1e-10){
        const k=[axis[0]/sinA,axis[1]/sinA,axis[2]/sinA];
        const rotate=v=>{
          const kv=cross(k,v),kd=dot(k,v),one=1-cosA;
          return [v[0]*cosA+kv[0]*sinA+k[0]*kd*one,v[1]*cosA+kv[1]*sinA+k[1]*kd*one,v[2]*cosA+kv[2]*sinA+k[2]*kd*one];
        };
        e1=rotate(e1);
      }else if(cosA<0){
        e1=[-e1[0],-e1[1],-e1[2]];
      }
      const projected=[e1[0]-t1[0]*dot(e1,t1),e1[1]-t1[1]*dot(e1,t1),e1[2]-t1[2]*dot(e1,t1)];
      e1=norm(projected)||norm(cross(Math.abs(t1[2])<0.85?[0,0,1]:[0,1,0],t1))||[1,0,0];
      e2=norm(cross(t1,e1))||[0,1,0];
    }
    const rx=cleanRadii[i][0],ry=cleanRadii[i][1],ring=[];
    for(let k=0;k<ringSegN;k++){
      const a=2*Math.PI*k/ringSegN,c=Math.cos(a),sn=Math.sin(a);
      ring.push(V.length);
      V.push([
        cleanPoints[i][0]+e1[0]*c*rx+e2[0]*sn*ry,
        cleanPoints[i][1]+e1[1]*c*rx+e2[1]*sn*ry,
        cleanPoints[i][2]+e1[2]*c*rx+e2[2]*sn*ry
      ]);
    }
    rings.push(ring);
  }
  const segCount=closed?n:n-1;
  for(let i=0;i<segCount;i++){
    const a=rings[i],b=rings[(i+1)%n];
    for(let k=0;k<ringSegN;k++){
      const kp=(k+1)%ringSegN;
      F.push([a[k],a[kp],b[kp]],[a[k],b[kp],b[k]]);
    }
  }
  if(!closed){
    const capA=V.length;V.push(cleanPoints[0].slice());
    const capB=V.length;V.push(cleanPoints[n-1].slice());
    for(let k=0;k<ringSegN;k++){
      const kp=(k+1)%ringSegN;
      F.push([capA,rings[0][kp],rings[0][k]]);
      F.push([capB,rings[n-1][k],rings[n-1][kp]]);
    }
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

function annularPrismMesh(origin, ex, ey, ez, innerU, innerV, outerU, outerV, thickness, segN) {
  const seg=Math.max(64,Math.round(segN||96));
  const half=thickness*.5;
  const V=[],F=[];
  const frontOuter=[],frontInner=[],backOuter=[],backInner=[];
  const point=(u,v,w)=>[
    origin[0]+ex[0]*u+ey[0]*v+ez[0]*w,
    origin[1]+ex[1]*u+ey[1]*v+ez[1]*w,
    origin[2]+ex[2]*u+ey[2]*v+ez[2]*w
  ];
  for(let i=0;i<seg;i++){
    const a=2*Math.PI*i/seg,c=Math.cos(a),sn=Math.sin(a);
    frontOuter.push(V.length);V.push(point(outerU*c,outerV*sn, half));
    frontInner.push(V.length);V.push(point(innerU*c,innerV*sn, half));
    backOuter.push(V.length);V.push(point(outerU*c,outerV*sn,-half));
    backInner.push(V.length);V.push(point(innerU*c,innerV*sn,-half));
  }
  const q=(a,b,c,d)=>{F.push([a,b,c],[a,c,d]);};
  for(let i=0;i<seg;i++){
    const j=(i+1)%seg;
    q(frontOuter[i],frontOuter[j],frontInner[j],frontInner[i]);
    q(backOuter[i],backInner[i],backInner[j],backOuter[j]);
    q(frontOuter[i],backOuter[i],backOuter[j],frontOuter[j]);
    q(frontInner[i],frontInner[j],backInner[j],backInner[i]);
  }
  return {V,F};
}

function roundedRectFrameMesh(origin, outerW, outerH, innerW, innerH, depth, cornerSegments) {
  const cs=Math.max(10,Math.round(cornerSegments||18));
  const halfD=Math.max(depth*.5,AGDP_MIN_WALL_MM*.5);
  const outerCorner=Math.max(AGDP_MIN_WALL_MM*.18,Math.min(outerW,outerH)*.035);
  const innerCorner=Math.max(AGDP_MIN_WALL_MM*.16,Math.min(innerW,innerH)*.045);
  function loop(w,h,r){
    const pts=[];
    const cx=w*.5-r, cy=h*.5-r;
    const centers=[[cx,cy],[-cx,cy],[-cx,-cy],[cx,-cy]];
    const starts=[0,Math.PI*.5,Math.PI,Math.PI*1.5];
    for(let q=0;q<4;q++){
      for(let k=0;k<cs;k++){
        const a=starts[q]+(k/(cs))*Math.PI*.5;
        pts.push([centers[q][0]+r*Math.cos(a),centers[q][1]+r*Math.sin(a)]);
      }
    }
    return pts;
  }
  const outer=loop(outerW,outerH,outerCorner);
  const inner=loop(innerW,innerH,innerCorner);
  const n=outer.length,V=[],F=[];
  const of=[],ob=[],inf=[],inb=[];
  for(let i=0;i<n;i++){
    of.push(V.length);V.push([origin[0]+outer[i][0],origin[1]+outer[i][1],origin[2]+halfD]);
    ob.push(V.length);V.push([origin[0]+outer[i][0],origin[1]+outer[i][1],origin[2]-halfD]);
    inf.push(V.length);V.push([origin[0]+inner[i][0],origin[1]+inner[i][1],origin[2]+halfD]);
    inb.push(V.length);V.push([origin[0]+inner[i][0],origin[1]+inner[i][1],origin[2]-halfD]);
  }
  const q=(a,b,c,d)=>{F.push([a,b,c],[a,c,d]);};
  for(let i=0;i<n;i++){
    const j=(i+1)%n;
    q(of[i],of[j],inf[j],inf[i]);
    q(ob[i],inb[i],inb[j],ob[j]);
    q(of[i],ob[i],ob[j],of[j]);
    q(inf[i],inf[j],inb[j],inb[i]);
  }
  return {V,F};
}

function rectilinearFrameMeshYZ(origin, outerW, outerH, innerW, innerH, depth) {
  const hx=Math.max(depth*.5,AGDP_MIN_WALL_MM*.5);
  const ow=Math.max(outerW*.5,AGDP_MIN_WALL_MM);
  const oh=Math.max(outerH*.5,AGDP_MIN_WALL_MM);
  const iw=Math.max(innerW*.5,AGDP_MIN_WALL_MM*.25);
  const ih=Math.max(innerH*.5,AGDP_MIN_WALL_MM*.25);
  const V=[],F=[];
  const frontOuter=[],frontInner=[],backOuter=[],backInner=[];
  const outer=[[-ow,-oh],[ow,-oh],[ow,oh],[-ow,oh]];
  const inner=[[-iw,-ih],[iw,-ih],[iw,ih],[-iw,ih]];
  const add=(x,zy)=>{V.push([origin[0]+x,origin[1]+zy[1],origin[2]+zy[0]]);return V.length-1;};
  for(let i=0;i<4;i++){
    frontOuter.push(add(hx,outer[i]));
    frontInner.push(add(hx,inner[i]));
    backOuter.push(add(-hx,outer[i]));
    backInner.push(add(-hx,inner[i]));
  }
  const q=(a,b,c,d)=>{F.push([a,b,c],[a,c,d]);};
  for(let i=0;i<4;i++){
    const j=(i+1)%4;
    q(frontOuter[i],frontOuter[j],frontInner[j],frontInner[i]);
    q(backOuter[i],backInner[i],backInner[j],backOuter[j]);
    q(frontOuter[i],backOuter[i],backOuter[j],frontOuter[j]);
    q(frontInner[i],frontInner[j],backInner[j],backInner[i]);
  }
  return {V,F};
}

function refinedRectilinearFrameMeshYZ(origin, outerW, outerH, innerW, innerH, depth, cornerSegments) {
  const cs=Math.max(8,Math.round(cornerSegments||12));
  const hx=Math.max(depth*.5,AGDP_MIN_WALL_MM*.5);
  const wallZ=Math.max((outerW-innerW)*.5,AGDP_MIN_WALL_MM);
  const wallY=Math.max((outerH-innerH)*.5,AGDP_MIN_WALL_MM);
  const outerR=Math.min(Math.max(AGDP_MIN_WALL_MM*.22,Math.min(wallZ,wallY)*.32),Math.min(outerW,outerH)*.075);
  const innerR=Math.min(Math.max(AGDP_MIN_WALL_MM*.18,outerR*.72),Math.min(innerW,innerH)*.08);
  function loop(w,h,r){
    const pts=[];
    const cz=w*.5-r, cy=h*.5-r;
    const centers=[[cz,cy],[-cz,cy],[-cz,-cy],[cz,-cy]];
    const starts=[0,Math.PI*.5,Math.PI,Math.PI*1.5];
    for(let q=0;q<4;q++){
      for(let k=0;k<cs;k++){
        const a=starts[q]+(k/cs)*Math.PI*.5;
        pts.push([centers[q][0]+r*Math.cos(a),centers[q][1]+r*Math.sin(a)]);
      }
    }
    return pts;
  }
  const outer=loop(outerW,outerH,outerR);
  const inner=loop(innerW,innerH,innerR);
  const n=outer.length,V=[],F=[];
  const pfO=[],pfI=[],pbO=[],pbI=[];
  const add=(x,zy)=>{V.push([origin[0]+x,origin[1]+zy[1],origin[2]+zy[0]]);return V.length-1;};
  for(let i=0;i<n;i++){
    pfO.push(add(hx,outer[i])); pfI.push(add(hx,inner[i]));
    pbO.push(add(-hx,outer[i])); pbI.push(add(-hx,inner[i]));
  }
  const q=(a,b,c,d)=>{F.push([a,b,c],[a,c,d]);};
  for(let i=0;i<n;i++){
    const j=(i+1)%n;
    q(pfO[i],pfO[j],pfI[j],pfI[i]);
    q(pbO[i],pbI[i],pbI[j],pbO[j]);
    q(pfO[i],pbO[i],pbO[j],pfO[j]);
    q(pfI[i],pfI[j],pbI[j],pbI[i]);
  }
  return {V,F};
}

function rectilinearFrameManifoldYZ(wasm, origin, outerW, outerH, innerW, innerH, depth) {
  const { Manifold } = wasm;
  const wallZ = Math.max((outerW-innerW)*.5, AGDP_MIN_WALL_MM);
  const wallY = Math.max((outerH-innerH)*.5, AGDP_MIN_WALL_MM);
  const x = origin[0], y = origin[1], z = origin[2];
  return unionAll(wasm, [
    Manifold.cube([depth, wallY, outerW], true).translate([x, y+(outerH-wallY)*.5, z]),
    Manifold.cube([depth, wallY, outerW], true).translate([x, y-(outerH-wallY)*.5, z]),
    Manifold.cube([depth, innerH, wallZ], true).translate([x, y, z+(outerW-wallZ)*.5]),
    Manifold.cube([depth, innerH, wallZ], true).translate([x, y, z-(outerW-wallZ)*.5])
  ]);
}

function organicNodeAt(wasm, center, radius, segments, seedPhase) {
  const {Manifold}=wasm;
  const phase=Number.isFinite(seedPhase)?seedPhase:(center[0]*.173+center[1]*.117+center[2]*.071);
  const e=.026+.012*(.5+.5*Math.sin(phase));
  const sx=1+e, sy=1-e*.28, sz=1/(sx*sy);
  const localSegments=Math.max(48,Math.round(segments||0));
  return Manifold.sphere(radius,localSegments).scale([sx,sy,sz]).translate(center);
}

function insertedRingManifold(wasm, origin, ex, ey, ez, ri, ro, thickness, segN) {
  const mesh=annularPrismMesh(origin,ex,ey,ez,ri,ri,ro,ro,thickness,segN);
  return meshToManifold(wasm,mesh.V,mesh.F);
}

function canonicalizeMeshForValidation(V,F,tolerance){
  const tol=Math.max(1e-7,Number.isFinite(tolerance)?tolerance:1e-5);
  const inv=1/tol;
  const buckets=new Map();
  const remap=new Int32Array(V.length);
  const NV=[];
  function key(v){return Math.round(v[0]*inv)+','+Math.round(v[1]*inv)+','+Math.round(v[2]*inv);}
  for(let i=0;i<V.length;i++){
    const v=V[i];
    const k=key(v);
    let idx=buckets.get(k);
    if(idx===undefined){idx=NV.length;buckets.set(k,idx);NV.push([v[0],v[1],v[2]]);}
    remap[i]=idx;
  }
  const NF=[];
  const seen=new Set();
  let removedDegenerate=0,removedDuplicate=0;
  for(const f of F){
    const a=remap[f[0]],b=remap[f[1]],c=remap[f[2]];
    if(a===b||b===c||c===a){removedDegenerate++;continue;}
    const va=NV[a],vb=NV[b],vc=NV[c];
    const abx=vb[0]-va[0],aby=vb[1]-va[1],abz=vb[2]-va[2];
    const acx=vc[0]-va[0],acy=vc[1]-va[1],acz=vc[2]-va[2];
    const cx=aby*acz-abz*acy,cy=abz*acx-abx*acz,cz=abx*acy-aby*acx;
    if(cx*cx+cy*cy+cz*cz<1e-20){removedDegenerate++;continue;}
    const sorted=[a,b,c].sort((x,y)=>x-y);
    const fk=sorted[0]+','+sorted[1]+','+sorted[2];
    if(seen.has(fk)){removedDuplicate++;continue;}
    seen.add(fk);NF.push([a,b,c]);
  }
  const used=new Uint8Array(NV.length);
  for(const f of NF){used[f[0]]=used[f[1]]=used[f[2]]=1;}
  const compact=new Int32Array(NV.length).fill(-1),CV=[];
  for(let i=0;i<NV.length;i++)if(used[i]){compact[i]=CV.length;CV.push(NV[i]);}
  const CF=NF.map(f=>[compact[f[0]],compact[f[1]],compact[f[2]]]);
  return {V:CV,F:CF,weldedVertices:V.length-CV.length,removedDegenerate,removedDuplicate};
}

function diagnoseClosedTriangleMesh(V,F,label){
  const report={
    label:String(label||'mesh'), vertices:Array.isArray(V)?V.length:0,
    triangles:Array.isArray(F)?F.length:0, finite:true, invalidIndices:0,
    degenerateTriangles:0, boundaryEdges:0, nonManifoldEdges:0,
    connectedComponents:0, signedVolumeMm3:0, ok:false
  };
  if(!Array.isArray(V)||!Array.isArray(F)||V.length===0||F.length===0) return report;
  const edgeUse=new Map();
  const vertFaces=new Map();
  const parent=new Int32Array(F.length);
  for(let i=0;i<F.length;i++) parent[i]=i;
  const find=x=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x;};
  const unite=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
  const edge=(a,b)=>a<b?a+','+b:b+','+a;
  let signed6=0;
  for(let fi=0;fi<F.length;fi++){
    const f=F[fi];
    if(!f||f.length<3){report.invalidIndices++;continue;}
    const a=f[0],b=f[1],c=f[2];
    if(!Number.isInteger(a)||!Number.isInteger(b)||!Number.isInteger(c)||a<0||b<0||c<0||a>=V.length||b>=V.length||c>=V.length){report.invalidIndices++;continue;}
    const va=V[a],vb=V[b],vc=V[c];
    if(!va||!vb||!vc||!va.every(Number.isFinite)||!vb.every(Number.isFinite)||!vc.every(Number.isFinite)){report.finite=false;continue;}
    const ab=[vb[0]-va[0],vb[1]-va[1],vb[2]-va[2]],ac=[vc[0]-va[0],vc[1]-va[1],vc[2]-va[2]];
    const cr=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    if(a===b||b===c||c===a||cr[0]*cr[0]+cr[1]*cr[1]+cr[2]*cr[2]<1e-20) report.degenerateTriangles++;
    signed6 += va[0]*(vb[1]*vc[2]-vb[2]*vc[1])-va[1]*(vb[0]*vc[2]-vb[2]*vc[0])+va[2]*(vb[0]*vc[1]-vb[1]*vc[0]);
    for(const [u,v] of [[a,b],[b,c],[c,a]]) edgeUse.set(edge(u,v),(edgeUse.get(edge(u,v))||0)+1);
    for(const v of [a,b,c]){let arr=vertFaces.get(v);if(!arr){arr=[];vertFaces.set(v,arr);}arr.push(fi);}
  }
  for(const n of edgeUse.values()){if(n===1)report.boundaryEdges++;else if(n!==2)report.nonManifoldEdges++;}
  for(const arr of vertFaces.values()) for(let i=1;i<arr.length;i++) unite(arr[0],arr[i]);
  const roots=new Set();
  for(let i=0;i<F.length;i++) roots.add(find(i));
  report.connectedComponents=roots.size;
  report.signedVolumeMm3=signed6/6;
  report.ok=report.finite&&report.invalidIndices===0&&report.degenerateTriangles===0&&report.boundaryEdges===0&&report.nonManifoldEdges===0&&report.connectedComponents===1&&Math.abs(report.signedVolumeMm3)>1e-8;
  return report;
}

function diagnoseManifoldStage(manifold,label){
  try{
    const mesh=manifoldToMesh(manifold);
    const report=diagnoseClosedTriangleMesh(mesh.V,mesh.F,label);
    const prefix=report.ok?'AGDP haircomb diagnostic ✓':'AGDP haircomb diagnostic ✗';
    (report.ok?console.info:console.error)(prefix,label,report);
    return report;
  }catch(error){
    const report={label:String(label||'manifold'),ok:false,exception:String(error&&error.message||error)};
    console.error('AGDP haircomb diagnostic ✗',label,report);
    return report;
  }
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
        parts.push(sphereAt(wasm, [windR*ct, windR*st, 0], ballR, 24));
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
      parts.push(sphereAt(wasm, [cx+nx*(beadR-embed), cy+ny*(beadR-embed), axialWobble], beadR, 24));
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
            parts.push(sphereAt(wasm,[rr*ct,rr*st,z],bigR,24));
          }else if(pathKey==='cageLattice'){
            const barR=Math.max(AGDP_MIN_WALL_MM*0.65,strandR*(0.55+0.5*intensity));
            const halfSpan=half*(0.18+0.16*intensity);
            parts.push(cylinderBetween(wasm,[rr*ct,rr*st,z-halfSpan],[rr*ct,rr*st,z+halfSpan],barR,24));
            parts.push(sphereAt(wasm,[rr*ct,rr*st,z-halfSpan],barR*1.3,24));
            parts.push(sphereAt(wasm,[rr*ct,rr*st,z+halfSpan],barR*1.3,24));
          }else if(pathKey==='wrapped'){
            const bumpR=Math.max(AGDP_MIN_WALL_MM*0.7,strandR*(0.9+0.9*intensity));
            parts.push(sphereAt(wasm,[rr*ct,rr*st,z],bumpR,24));
          }else if(pathKey==='cellular'){
            const sr=Math.max(AGDP_MIN_WALL_MM*0.6,strandR*(0.75+0.7*intensity));
            const anchor=[windR*ct,windR*st,z];
            const center=[rr*ct,rr*st,z];
            parts.push(sphereAt(wasm,center,sr,24));
            parts.push(cylinderBetween(wasm,anchor,center,sr*0.55,24));
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
      const capAxialSlack = Math.max(AGDP_MIN_WALL_MM*0.4, (topOuterR-topInnerR)*0.18);
      for(let k=1;k<lateralSeg;k++){
        const u=k/lateralSeg;
        const envelope=Math.sin(Math.PI*u);
        const virtualZ=-half+bandW*u;
        const rawField=outerOperationField(t,virtualZ)*envelope;
        const lateralField = capAxialSlack * Math.tanh(rawField / Math.max(1e-6, capAxialSlack));
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
          for(let j=0;j<=zSeg;j++) loop.push(outer[i][j]);
          for(let k=lateralSeg-1;k>=0;k--) loop.push(lateralTop[i][k]);
          for(let j=zSeg-1;j>=0;j--) loop.push(inner[i][j]);
          for(let k=1;k<lateralSeg;k++) loop.push(lateralBottom[i][k]);
        }else{
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

  const postCount = Math.round(postIntensity*6.4);
  if (postCount>0) {
    const postDepth = Math.max(AGDP_MIN_WALL_MM*1.2, baseWall*(0.45+0.55*postIntensity));
    const postWidth = Math.max(AGDP_MIN_WALL_MM*1.05, baseWall*(0.38+0.5*postIntensity));
    for (let k=0;k<postCount;k++) {
      const t = -arcRad/2+arcRad*(k/postCount)+(closed?0:arcRad/(postCount*2));
      decorations.push(radialBlock(wasm, t, localSurfaceRZ(t,0)+postDepth/2-embedAtZ(t,0), 0, postDepth, postWidth, bandW*(0.72+0.22*postIntensity)));
    }
  }

  const pinCount = (cellularActive || opts.type==='choker' || opts.type==='headpiece') ? 0 : Math.round(p.screws||0);
  if (pinCount>0) {
    const pinR = Math.max(AGDP_MIN_WALL_MM*0.35, baseWall*0.16);
    for (let k=0;k<pinCount;k++) {
      const u = pinCount===1?.5:k/(pinCount-1);
      const t = -arcRad/2+arcRad*(0.15+0.7*u);
      const ct=Math.cos(t), st=Math.sin(t);
      const embed = Math.min(embedAtZ(t,0), pinR*2.2);
      const rInner=localSurfaceRZ(t,0)-embed, rOuter=localSurfaceRZ(t,0)+pinR*0.8;
      decorations.push(cylinderBetween(wasm, [rInner*ct,rInner*st,0], [rOuter*ct,rOuter*st,0], pinR, 24));
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
      decorations.push(organicNodeAt(wasm,[rOut*ct,rOut*st,rivetZ],rivetR,12,t));
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
    decorations.push(insertedRingManifold(wasm, origin, ex, ey, ez, ringInnerR, ringOuterR, ringThickness, 96));
  }
  const nodeCount = (insertRingMode||cellularActive) ? 0 : Math.max(0, Math.round(p.nodes||0));
  if (nodeCount>0) {
    const cov = (p.articulationCoverage||120)*Math.PI/180;
    for (let k=0;k<nodeCount;k++) {
      const u = nodeCount===1?.5:k/(nodeCount-1);
      const t = (p.articulationOffset||0)*Math.PI/180-cov/2+cov*u;
      const sr = Math.max(AGDP_MIN_WALL_MM*0.7, 0.45+p.nodeVolume*.3);
      const nodeZ = (k%2?1:-1)*bandW*0.18;
      const localEmbed = Math.min(embedAtZ(t,nodeZ), sr*0.95);
      const rr = localSurfaceRZ(t,nodeZ)+sr-localEmbed;
      decorations.push(organicNodeAt(wasm,[rr*Math.cos(t),rr*Math.sin(t),nodeZ],sr,12,t+k*.73));
    }
  }

  if (!closed) {
    const tEnd0=-arcRad/2, tEnd1=arcRad/2;
    [tEnd0, tEnd1].forEach(te => {
      const ct=Math.cos(te), st=Math.sin(te);
      const wallHere = localSurfaceRZ(te,0)-innerR;
      const ballR = Math.max(AGDP_MIN_WALL_MM*1.1, wallHere*0.62);
      const rCenter = innerR+ballR*1.15;
      decorations.push(organicNodeAt(wasm,[rCenter*ct,rCenter*st,0],ballR,12,te));
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
      voidCutters.push(sphereAt(wasm,[rr*ct,rr*st,0],sr,24));
    }

    {
      const t=phase+5.72,ct=Math.cos(t),st=Math.sin(t);
      const sr=Math.max(AGDP_MIN_WALL_MM*.82,baseWall*(.14+.10*cellularI));
      const z=bandW*.08*(p.compositionSignature?.polarity||1);
      const rr=localSurfaceRZ(t,z)-sr*.18;
      voidCutters.push(sphereAt(wasm,[rr*ct,rr*st,z],sr,24));
    }
  }

  if(voidCutters.length){
    try{ bodyManifold=safeDifference(wasm,bodyManifold,unionAll(wasm,voidCutters)); }
    catch(err){ console.warn('AGDP: operación transversal omitida por seguridad topológica',err); }
  }

  if (p.mutation && p.mutation.active && p.mutation.mode==='rupture' && closed) {
    const sv=p.mutation.severity;
    const ruptureRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|rupture-scar');
    const rt=ruptureRng()*Math.PI*2;
    const ct=Math.cos(rt), st=Math.sin(rt);
    const surfaceHere=localSurfaceRZ(rt,0);
    const notchDepth=Math.min(baseWall*0.55*(0.4+0.6*sv), baseWall*0.62);
    const notchWidth=Math.max(AGDP_MIN_WALL_MM*1.6, baseWall*(0.85+0.55*sv));
    const notchAxial=Math.min(bandW*0.92, bandW-AGDP_MIN_WALL_MM*2);
    const notchCenterR=surfaceHere-notchDepth*0.5;
    try{
      const notchCutter=wasm.Manifold.cube([notchDepth*2.4, notchWidth, notchAxial], true)
        .rotate([0,0,rt*180/Math.PI]).translate([notchCenterR*ct, notchCenterR*st, 0]);
      bodyManifold=safeDifference(wasm,bodyManifold, notchCutter);
    }catch(err){ console.warn('AGDP: ruptura omitida por seguridad topológica',err); }

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

  if (p.mutation && p.mutation.active && p.mutation.mode==='hypertrophy') {
    const sv=p.mutation.severity;
    const hRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|hypertrophy');
    const ht=hRng()*Math.PI*2;
    const hct=Math.cos(ht), hst=Math.sin(ht);
    const hSurface=localSurfaceRZ(ht,0);
    const massR=Math.max(baseWall*1.4, baseWall*(1.8+2.2*sv));
    const embed=massR*0.35;
    const massCenterR=hSurface+massR-embed;
    decorations.push(organicNodeAt(wasm,[massCenterR*hct,massCenterR*hst,0],massR,12,ht));
    const oppositeT=ht+Math.PI;
    const oppCt=Math.cos(oppositeT), oppSt=Math.sin(oppositeT);
    const oppSurface=localSurfaceRZ(oppositeT,0);
    const thinDepth=Math.min(baseWall*0.30*sv, baseWall*0.35);
    const thinWidth=baseWall*2.4;
    try{
      const thinCutter=wasm.Manifold.cube([thinDepth*2.2, thinWidth, bandW*0.7], true)
        .rotate([0,0,oppositeT*180/Math.PI]).translate([(oppSurface-thinDepth*0.5)*oppCt,(oppSurface-thinDepth*0.5)*oppSt,0]);
      bodyManifold=safeDifference(wasm,bodyManifold, thinCutter);
    }catch(err){ console.warn('AGDP: hipertrofia (adelgazamiento) omitida por seguridad topológica',err); }
  }

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
      erosionCutters.push(sphereAt(wasm,[erAdj*ect, erAdj*est, ez], esr, 24));
    }
    try{ bodyManifold=safeDifference(wasm,bodyManifold, unionAll(wasm, erosionCutters)); }
    catch(err){ console.warn('AGDP: erosión omitida por seguridad topológica',err); }
  }

  if (p.mutation && p.mutation.active && p.mutation.mode==='displacement') {
    const sv=p.mutation.severity;
    const dRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|displacement');
    const edgeT = closed ? (dRng()<0.5?-1:1)*(Math.PI*0.92) : (dRng()<0.5? -arcRad/2*0.94 : arcRad/2*0.94);
    const ect=Math.cos(edgeT), est=Math.sin(edgeT);
    const esurf=localSurfaceRZ(edgeT,0);
    const dMassR=Math.max(baseWall*1.3, baseWall*(1.5+1.3*sv));
    const embed=dMassR*0.4;
    const centerR=esurf+dMassR-embed;
    decorations.push(organicNodeAt(wasm,[centerR*ect,centerR*est,0],dMassR,12,edgeT));
  }

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
      const oldBody = bodyManifold;
      bodyManifold=meshToManifold(wasm, mesh.V, mesh.F);
      try{ oldBody.delete(); }catch(e){}
    }catch(err){ console.warn('AGDP: compresión omitida por seguridad topológica',err); }
  }

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
      decorations.push(organicNodeAt(wasm,[rr*ct,rr*st,z],r,12,t+k*.41));
    }
  }

  if (p.mutation && p.mutation.active && p.mutation.mode==='inversion') {
    const sv=p.mutation.severity;
    const iRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|inversion');
    const invT=iRng()*Math.PI*2;
    const ict=Math.cos(invT), ist=Math.sin(invT);
    const invSurf=localSurfaceRZ(invT,0);
    const massR=Math.max(baseWall*1.1, baseWall*(1.2+0.8*sv));
    const embed=massR*0.4;
    const massCenterR=invSurf+massR-embed;
    decorations.push(organicNodeAt(wasm,[massCenterR*ict,massCenterR*ist,0],massR,12,invT));
    const voidT=invT+Math.PI*0.5+iRng()*0.3;
    const vct=Math.cos(voidT), vst=Math.sin(voidT);
    const voidSurf=localSurfaceRZ(voidT,0);
    const voidR=Math.max(AGDP_MIN_WALL_MM*1.2, baseWall*(0.7+0.5*sv));
    try{
      const voidCutter=sphereAt(wasm,[(voidSurf-voidR*0.2)*vct,(voidSurf-voidR*0.2)*vst,0], voidR, 24);
      bodyManifold=safeDifference(wasm,bodyManifold, voidCutter);
    }catch(err){ console.warn('AGDP: inversión omitida por seguridad topológica',err); }
  }

  const allParts = [bodyManifold, ...decorations];
  let result = unionAll(wasm, allParts);
  if (opts.type==='cuffBracelet'){
    result = result.scale([0.85, 1.20, 1]);
  }
  return { manifold: result, bandW };
}

function featureIntensity(p,key,fallback=.35){ return clamp((p.featureWeights&&Number.isFinite(p.featureWeights[key]))?p.featureWeights[key]:fallback,0,1); }

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
      parts.push(cylinderBetween(wasm,anchors[i],anchors[i+1],r,24));
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
    return { thicknessBoost:1.0, crossBracing:1, massCount:1 };
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
  parts.push(cylinderBetween(wasm, [-bridgeHalfLen,0,0], [bridgeHalfLen,0,0], barR, 24));
  [-bridgeHalfLen, bridgeHalfLen].forEach(x => {
    parts.push(cylinderBetween(wasm, [x,-capR*1.6,0], [x,capR*1.6,0], capR, 24));
    parts.push(sphereAt(wasm, [x,-capR*1.6,0], capR, 24));
    parts.push(sphereAt(wasm, [x,capR*1.6,0], capR, 24));
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
    const embed = sphereR*0.68;
    const cx = rho*Math.cos(tiltAngle)*0.55, cy = rho*Math.sin(tiltAngle)*0.55;
    parts.push(sphereAt(wasm, [cx,cy,zBase+sphereR-embed], sphereR, 24));
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
    parts.push(sphereAt(wasm, [realPt[0]+nx*(bumpR-embed), realPt[1]+ny*(bumpR-embed), realPt[2]+nz*(bumpR-embed)], bumpR, 24));
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
  function edgeLoop(points,r){for(let i=0;i<4;i++)parts.push(cylinderBetween(wasm,points[i],points[(i+1)%4],r,24));}
  edgeLoop(front,barR*1.08); edgeLoop(back,barR*.92);
  for(let i=0;i<4;i++)parts.push(cylinderBetween(wasm,front[i],back[i],barR*.78,24));
  const polarity=p.compositionSignature?.polarity||1;
  parts.push(cylinderBetween(wasm,front[polarity>0?0:1],front[polarity>0?2:3],barR*.72,24));
  parts.push(cylinderBetween(wasm,back[polarity>0?1:0],back[polarity>0?3:2],barR*.62,24));
  const node=front[polarity>0?2:3];
  parts.push(sphereAt(wasm,node,barR*1.65,24));
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
  slab=safeDifference(wasm,slab,voidBox);
  const parts=[slab];
  const z=d*.58, r=Math.max(AGDP_MIN_WALL_MM*.8,d*.11);
  parts.push(cylinderBetween(wasm,[-w*.46,-h*.34,z],[w*.42,h*.28,z],r,24));
  parts.push(cylinderBetween(wasm,[-w*.34,h*.43,-z],[w*.48,-h*.22,-z],r*.88,24));
  const nodeCenter=[xOff+w*.20,h*.20,z];
  parts.push(sphereAt(wasm,nodeCenter,r*1.55,24));
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
  parts.push(cylinderBetween(wasm,[-w*.34,-h*.42,0],[w*.36,h*.40,0],r,24));
  const tiltRad=polarity*8*Math.PI/180;
  const nodeCenter=[-(h*.46)*Math.sin(tiltRad), (h*.46)*Math.cos(tiltRad), 0];
  const nodeR=Math.max(AGDP_MIN_WALL_MM*1.1, r*1.7);
  parts.push(sphereAt(wasm,nodeCenter,nodeR,24));
  return {manifold:unionAll(wasm,parts),frameHalfW:w*.58,frameHalfH:h*.54,barR:r,kind:'foldedTotem',attachPoint:nodeCenter,attachR:nodeR};
}

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

function pickStructuralTreatment(p, tag){
  const lattice=featureIntensity(p,'lattice'), dome=featureIntensity(p,'dome'), vessel=featureIntensity(p,'vessel');
  const rng = window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|'+tag+'|structural-treatment');
  return weightedPick(rng, {
    solid: 0.34+(1-lattice)*0.35,
    volumetric: 0.30+(dome+vessel)*0.28,
    lattice: 0.22+lattice*0.55
  });
}

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

  if(domeI>.08 && baseType!=='dome'){
    const rr=effR*(.32+.28*domeI);
    parts.push(sphereAt(wasm,[0,0,frontZ],rr,24).scale([1,1,.42+.30*domeI]));
  }
  if(vesselI>.08 && baseType!=='vessel'){
    const rr=effR*(.22+.25*vesselI);
    const polarity=(p.variation?.offset||0)>=0?1:-1;
    parts.push(sphereAt(wasm,[polarity*effR*.22,-effR*.10,frontZ*.76],rr,24).scale([1.18,.86,.48+.22*vesselI]));
  }
  if(cageI>.08){
    const barR=Math.max(AGDP_MIN_WALL_MM*.9,th*(.07+.07*cageI));
    const span=effR*(.52+.24*cageI);
    parts.push(cylinderBetween(wasm,[-span,0,0],[span,0,0],barR,24));
    parts.push(cylinderBetween(wasm,[0,-span,0],[0,span,0],barR,24));
  }
  if(wrappedI>.08 && baseType!=='wrapped'){
    const count=2+Math.round(wrappedI*2);
    for(let i=0;i<count;i++){
      const a=(p.variation?.phaseB||0)+i*Math.PI*2/count;
      const rr=effR*(.66+.08*Math.sin(a*2));
      const nr=Math.max(AGDP_MIN_WALL_MM*.9,effR*(.055+.045*wrappedI));
      parts.push(sphereAt(wasm,[Math.cos(a)*rr,Math.sin(a)*rr,th*.08],nr,24));
    }
  }
  if(interI>.12){
    const r=Math.max(AGDP_MIN_WALL_MM*.75,th*(.055+.05*interI));
    const span=effR*.72;
    parts.push(cylinderBetween(wasm,[-span*.72,-span*.38,th*.04],[span*.72,span*.38,th*.04],r,24));
    parts.push(cylinderBetween(wasm,[-span*.72,span*.38,th*.04],[span*.72,-span*.38,th*.04],r,24));
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
    if(outsideReserved(center,r))voidCutters.push(sphereAt(wasm,center,r,24));
  }

  {
    const c1=targetAt(phase+5.72,.35,-.015),c2=targetAt(phase+6.02,.35,.02);
    const r=Math.max(AGDP_MIN_WALL_MM*.88,scaleRef*(.043+.028*intensity.cellular));
    if(outsideReserved(c1,r))voidCutters.push(sphereAt(wasm,c1,r,24));
    if(intensity.cellular>.56&&outsideReserved(c2,r*.68))voidCutters.push(sphereAt(wasm,c2,r*.68,24));
  }
  return voidCutters;
}

async function makePendantManifold(wasm, p) {
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

  const sx=1, sy=1;
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
    parts.push(cylinderBetween(wasm,a,b,r,32));
  }

  const phase=(p.variation?.phaseA||0)+polarity*(.18+.22*rng());
  const mode=(p.compositionSignature?.cadence||0)%4;

  const passageR=Math.max(.85,p.chainFitRadiusMm!=null?p.chainFitRadiusMm:1.35);
  const topY=outerR*sy;
  const tunnelWall=Math.max(AGDP_STRUCTURAL_WALL_MM,(p.minFeature||.8)*1.45,annularWall*.30);
  const crownOuterR=Math.max(passageR+tunnelWall,annularWall*1.28);

  const frameOuterW=Math.min(crownOuterR*1.72,bandWidth*.94);
  const frameOuterH=crownOuterR*2.48;
  const lateralWall=Math.max(AGDP_STRUCTURAL_WALL_MM,(p.minFeature||.8)*1.08);
  const frameInnerW=Math.max(AGDP_MIN_WALL_MM*.8,Math.min(passageR*1.84,frameOuterW-lateralWall*2));
  const frameInnerH=passageR*2.26;
  const frameOverlap=Math.max(annularWall*.42,(p.minFeature||.8)*.55);

  const crownCenter=[0,topY+frameOuterH*.5-frameOverlap,0];
  const frameDepth=Math.max(annularWall*.72,(p.minFeature||.8)*1.35);
  const bailManifold=rectilinearFrameManifoldYZ(
    wasm,
    crownCenter,
    frameOuterW,
    frameOuterH,
    frameInnerW,
    frameInnerH,
    frameDepth
  );
  parts.push(bailManifold);

  let manifold=unionAll(wasm,parts);
  let mesh=manifoldToMesh(manifold);
  let preflight=validate(mesh.V,mesh.F,{type:'pendant-annular-preflight',minFeature:p.minFeature||.8,printProfile:p.printProfile||'silverPolished'});
  if(preflight.components!==1||!preflight.manifoldOK)throw new Error('AGDP annular pendant core failed continuity validation');

  const finalMesh=manifoldToMesh(manifold);
  const finalAudit=validate(finalMesh.V,finalMesh.F,{type:'pendant',minFeature:p.minFeature||.8,printProfile:p.printProfile||'silverPolished'});
  if(!finalAudit.ok||finalAudit.components!==1)throw new Error('AGDP annular pendant failed structural validation');

  p.pendantBodyEnvelopeMm=targetEnvelope;
  p.pendantBodyWidthMm=finalAudit.bounds.dim[0];
  p.pendantBodyHeightMm=finalAudit.bounds.dim[1];
  p.pendantBodyDepthMm=finalAudit.bounds.dim[2];
  p.pendantSuspension='integratedLateralRectilinearFrameNoPosts';
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
    holes:0,railCount:Math.min(1,p.railCount||0),
    crown:false,spikes:0,opening:0,
    mutation:{active:false,severity:0,mode:null},
    asymmetry:Math.min(p.asymmetry||0,0.18),
    featureWeights:Object.freeze(Object.assign({},p.featureWeights||{},{vessel:Math.min((p.featureWeights&&p.featureWeights.vessel)||0,0.15)}))
  });
  const built=await buildBandGeometryManifold(wasm,crownParams,{
    type:'pendantAnnularCore',innerD:innerR*2,width:th,closed:true,opening:0
  });
  const sx=1, sy=1;
  const crown=built.manifold.scale([sx,sy,1]);

  const crownMesh=manifoldToMesh(crown);
  const crownAudit=validate(crownMesh.V,crownMesh.F,{
    type:'cufflink-annular-crown',minFeature,printProfile:p.printProfile||'silverPolished'
  });
  if(!crownAudit.manifoldOK||crownAudit.components!==1||!crownAudit.finite){
    throw new Error('AGDP cufflink annular crown is not a closed manifold');
  }

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

  const postRadius=Math.max(2.60,minFeature*.9);
  const postLength=21.0;
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
    target.push(sphereAt(wasm,[0,0,rearFaceZ-minFeature*.35],rootRadius,32));

    const segments=14;
    const postPathPts=[[root[0],root[1],rearFaceZ-rootDepth*.42]];
    for(let i=1;i<=segments;i++){
      const raw=cufflinkPostPoint(i/segments);
      postPathPts.push([raw[0],raw[1],raw[2]-rootDepth*.18]);
    }
    const postRadii=postPathPts.map(()=>[postRadius,postRadius]);
    const postMesh=variableEllipticalTubeMesh(postPathPts, postRadii, 24, false);
    target.push(meshToManifold(wasm, postMesh.V, postMesh.F));
    const pivot=postPathPts[postPathPts.length-1];
    const hingeRadius=Math.max(1.7,postRadius*1.8);
    target.push(sphereAt(wasm,pivot,hingeRadius,32));
    target.push(box(pivot[0],pivot[1],pivot[2],toggleLength,toggleWidth,toggleThickness));
    target.push(box(pivot[0],pivot[1],pivot[2]+toggleThickness*.62,5.4,5.0,3.2));
  }
  addFinding(structuralParts);

  if(featureIntensity(p,'interweave')>.58){
    const spokeR=Math.max(minFeature*.72,th*.11);
    structuralParts.push(cylinderBetween(wasm,[0,0,rearFaceZ+minFeature*.2],[r*.72,0,rearFaceZ+minFeature*.2],spokeR,24));
  }

  let unit=unionAll(wasm,structuralParts);

  if(p.mutation&&p.mutation.active){
    const baseMesh=manifoldToMesh(unit);
    const frontVerts=baseMesh.V.filter(v=>v[2]>th*.05);
    const pool=frontVerts.length?frontVerts:baseMesh.V;
    const mutationParts=[meshToManifold(wasm,baseMesh.V,baseMesh.F)];
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
        mutationParts.push(sphereAt(wasm,pt,rr,24));
      }
    }
    if(mutationParts.length>1){
      const mutated=unionAll(wasm,mutationParts);
      const mm=manifoldToMesh(mutated);
      const ma=validate(mm.V,mm.F,{type:'cufflink-mutated-unit',minFeature,printProfile:p.printProfile||'silverPolished'});
      if(ma.manifoldOK&&ma.components===1&&ma.finite){
        const oldUnit=unit;
        unit=mutated;
        try{ oldUnit.delete(); }catch(e){}
      } else {
        try{ mutated.delete(); }catch(e){}
      }
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
  const leftUnit=meshToManifold(wasm,unitMesh.V,unitMesh.F).translate([-pairSpacing/2,0,0]);
  const rightUnit=meshToManifold(wasm,unitMesh.V,unitMesh.F).translate([pairSpacing/2,0,0]);
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

  const innerR=Math.max(8,(p.mainSize||100)/2);
  const bandW=Math.max(8,p.bandWidth||40);
  const wall=kind==='headpiece'?Math.max(2.6,p.headWallMm||3.2):Math.max(3.8,p.chokerWallMm||4.8);
  const skinFloorR = StructuralKit.skinFloor(innerR, wall, 0);
  const rng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|'+kind+'-volumetric-field');
  const frontSpan=kind==='headpiece' ? (.62+.34*wrapped) : (.48+.38*vessel);
  const count=3+Math.round((dome+vessel+cage)*2.2);
  const anchors=[];
  const anchorU=[];

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
    const embedded = Math.max(skinFloorR, StructuralKit.embedInward(radial, rr, 0.65));
    const p0=[embedded*Math.cos(t),embedded*Math.sin(t),zBase+lift];
    anchors.push(p0);
    anchorU.push(u);
    parts.push(flattenedNodeAt(wasm,p0,rr*(1.05+.45*vessel),rr*(.78+.22*wrapped),rr*(.92+.48*dome),8));

    const rootSurfacePoint=[surfaceR*Math.cos(t),surfaceR*Math.sin(t),zBase];
    parts.push(cylinderBetween(wasm, rootSurfacePoint, p0, rr*0.62, 8));
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
  try{ manifold.delete(); }catch(e){}

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

    const frontPlateau=1-smooth01((absT-48*deg)/(34*deg));
    const rear=smooth01((absT-104*deg)/(60*deg));
    const side=clamp(1-frontPlateau-rear,0,1);

    const frontBroadening=1+0.030*frontPlateau;
    const rearTightening=1-0.018*rear;
    let x=v[0]*frontBroadening*rearTightening;
    let y=v[1]*ratio*(1-0.012*rear);

    let r=Math.hypot(x,y)||1e-6;
    const ux=x/r, uy=y/r;
    let dr=originalR-centerR;

    const heightScale=rearRatio+(1-rearRatio)*(frontPlateau+side*.58);
    let zLocal=v[2]*heightScale;

    const sectionTilt=(8*frontPlateau-10*rear)*deg;
    const cs=Math.cos(sectionTilt), sn=Math.sin(sectionTilt);
    const drRot=dr*cs-zLocal*sn;
    const zRot=dr*sn+zLocal*cs;
    dr=drRot;
    zLocal=zRot;

    const sideRise=2.8*Math.pow(side,1.25);
    const centerShift=-frontDrop*frontPlateau+sideRise+rearLift*rear;

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
  try{ manifold.delete(); }catch(e){}

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

    const front=1-smooth01((absT-34*deg)/(34*deg));
    const terminal=smooth01((absT-116*deg)/(48*deg));
    const lateral=clamp(1-front-terminal,0,1);
    const temple=Math.sin(Math.PI*clamp((absT-38*deg)/(96*deg),0,1));

    const frontalBroadening=1+0.022*front;
    const temporalRelease=1+0.012*temple;
    const posteriorTightening=1-0.018*terminal;
    let x=v[0]*frontalBroadening*temporalRelease*posteriorTightening;
    let y=v[1]*ratio*(1-0.010*front-0.014*terminal);

    let r=Math.hypot(x,y)||1e-6;
    let ux=x/r, uy=y/r;
    let dr=originalR-centerR;

    const heightScale=clamp(
      rearRatio+(1-rearRatio)*front+sideRatio*lateral*(1-terminal*.45),
      0.14,1
    );
    let zLocal=v[2]*heightScale;

    const sectionTilt=(-6*front+8*lateral+12*terminal)*deg;
    const cs=Math.cos(sectionTilt), sn=Math.sin(sectionTilt);
    const drRot=dr*cs-zLocal*sn;
    const zRot=dr*sn+zLocal*cs;
    dr=drRot;
    zLocal=zRot;

    const placementTilt=15*deg;
    const sagittalShift=Math.sin(placementTilt)*(x-centerR*.12)*.18;
    const parietalRise=crownRise*Math.pow(lateral,1.35)*(0.58+0.42*front);
    const temporalSink=templeDrop*Math.pow(temple,1.45)*(0.34+0.66*terminal);
    const terminalLift=3.2*Math.pow(terminal,1.7);
    const centerShift=sagittalShift+parietalRise-temporalSink+terminalLift;

    const clearance=3.2*front+4.4*temple+2.8*lateral+5.2*terminal;
    const outerMask=smooth01((dr+halfHeight*.06)/(halfHeight*.56));
    const exteriorProjection=centerR*projection*Math.pow(front,1.55)*outerMask;

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

// =============================================================================
// HAIR COMB (peineta) — CORREGIDO
// =============================================================================
function makeHairCombManifold(wasm,p){
  const WIDTH_MM=clamp(Number.isFinite(p.mainSize)?p.mainSize:110,95,120);

  function piecewiseByWidth(v95,v110,v120){
    if(WIDTH_MM<=110){
      const q=clamp((WIDTH_MM-95)/15,0,1);
      return v95+(v110-v95)*q;
    }
    const q=clamp((WIDTH_MM-110)/10,0,1);
    return v110+(v120-v110)*q;
  }

  const CROWN_HEIGHT_MM=clamp(
    Number.isFinite(p.combTopHeightMm)?p.combTopHeightMm:piecewiseByWidth(45,52,60),
    45,60
  );
  const CROWN_DEPTH_MM=piecewiseByWidth(3.5,4.0,4.5);

  const TOOTH_LENGTH_MM=piecewiseByWidth(38,44,50);
  const TOOTH_COUNT=Math.round(piecewiseByWidth(7,8,9));
  const TOOTH_DIAMETER_MM=piecewiseByWidth(2.5,2.8,3.0);
  const ROOT_TRANSITION_MM=piecewiseByWidth(5.0,5.8,6.6);
  const SKULL_SAG_MM=piecewiseByWidth(6.0,8.0,11.0);
  const TOOTH_SWEEP_MM=piecewiseByWidth(5.0,7.0,9.5);
  const SIDE_MARGIN_MM=piecewiseByWidth(6.5,8.0,9.0);
  const TOOTH_SPAN_MM=WIDTH_MM-2*SIDE_MARGIN_MM;
  const TOOTH_SPACING_MM=TOOTH_COUNT>1?TOOTH_SPAN_MM/(TOOTH_COUNT-1):0;

  const X_SEG=112;
  const Z_SEG=28;
  const parts=[];
  const hairCombDiagnostics=[];
  const recordStage=(manifold,label)=>{const r=diagnoseManifoldStage(manifold,label);hairCombDiagnostics.push(r);return r;};
  const seed=String(p.seed||'AGDP');
  const rng=window.SeededVariation.createGenerator(seed+'|haircomb-crown-v8');

  const cellular=featureIntensity(p,'cellular');
  const lattice=featureIntensity(p,'lattice');
  const cage=featureIntensity(p,'cage');
  const wrapped=featureIntensity(p,'wrapped');
  const inter=featureIntensity(p,'interweave');
  const continuity=featureIntensity(p,'continuity');
  const vessel=featureIntensity(p,'vessel');
  const dome=featureIntensity(p,'dome');
  const treatment=pickStructuralTreatment(p,'haircomb-crown-v8');

  const faceting=clamp(p.faceting||0,0,1);
  const sideRelief=clamp(p.sideRelief||0,0,1);
  const surfaceRelief=clamp(p.surfaceRelief||0,0,.35);
  const organic=clamp(p.organic||0,0,1);
  const architectural=clamp(p.architectural||0,0,1);
  const asymmetry=clamp(p.asymmetry||0,0,1);
  const railCount=Math.round(clamp(p.railCount||0,0,3));
  const nodeCount=Math.round(clamp(p.nodes||0,0,7));
  const spikeCount=Math.round(clamp(p.spikes||0,0,8));
  const holeCount=Math.round(clamp(p.holes||0,0,8));
  const frameIntensity=clamp(p.frames||0,0,1);
  const rivetCount=Math.round(clamp(p.rivets||0,0,10));

  const phaseA=rng()*Math.PI*2;
  const phaseB=rng()*Math.PI*2;
  const phaseC=rng()*Math.PI*2;
  const peakX=(-.30+.60*rng())*WIDTH_MM;
  const peakSpread=WIDTH_MM*(.12+.16*rng());
  const secondaryX=(-.36+.72*rng())*WIDTH_MM;
  const secondarySpread=WIDTH_MM*(.08+.13*rng());
  const tertiaryX=(-.40+.80*rng())*WIDTH_MM;
  const tertiarySpread=WIDTH_MM*(.07+.10*rng());

  function smooth01(x){
    x=clamp(x,0,1);
    return x*x*(3-2*x);
  }

  function contactY(x){
    const n=clamp(x/(WIDTH_MM*.5),-1,1);
    return SKULL_SAG_MM*(1-n*n);
  }

  function lowerZ(x){
    const n=clamp(x/(WIDTH_MM*.5),-1,1);
    return 2.0+2.2*(1-n*n);
  }

  function topZ(x){
    const n=clamp(x/(WIDTH_MM*.5),-1,1);
    const center=Math.pow(Math.max(0,1-n*n),.63);
    const shoulderAmp=1.5+2.1*architectural;
    const shoulders=
      shoulderAmp*Math.exp(-Math.pow((n-.57)/.18,2))+
      shoulderAmp*Math.exp(-Math.pow((n+.57)/.18,2));
    const massA=(2.0+4.4*vessel+3.0*dome)*Math.exp(-Math.pow((x-peakX)/peakSpread,2));
    const massB=(1.0+2.8*organic)*Math.exp(-Math.pow((x-secondaryX)/secondarySpread,2));
    const asym=asymmetry*(2.0+2.6*organic)*Math.sin(Math.PI*(n+1)*.5+phaseA)*(1-n*n);
    return lowerZ(x)+ROOT_TRANSITION_MM+
      CROWN_HEIGHT_MM*(.25+.75*center)+shoulders+massA+.55*massB+asym;
  }

  function gaussian2(u,t,cu,ct,su,st){
    const du=(u-cu)/Math.max(.001,su);
    const dt=(t-ct)/Math.max(.001,st);
    return Math.exp(-(du*du+dt*dt)*1.7);
  }

  function crownOperationField(x,t){
    const u=clamp((x/WIDTH_MM)+.5,0,1);
    const nx=(x-peakX)/(peakSpread||1);
    const sx=(x-secondaryX)/(secondarySpread||1);
    const tx=(x-tertiaryX)/(tertiarySpread||1);
    const massA=Math.exp(-nx*nx*1.20);
    const massB=Math.exp(-sx*sx*1.45);
    const massC=Math.exp(-tx*tx*1.75);

    const facetSides=Math.max(4,Math.round(5+faceting*15));
    const facetWave=Math.pow(Math.abs(Math.cos(Math.PI*facetSides*u+phaseA)),6);
    const facetField=(facetWave-.34)*(0.25+1.15*faceting);

    let grooveField=0;
    for(let k=0;k<railCount;k++){
      const ct=railCount===1?.5:(k+1)/(railCount+1);
      const d=(t-ct)/(0.026+0.026*sideRelief);
      grooveField-=Math.exp(-d*d*1.7)*(0.30+1.25*sideRelief);
    }

    const zonedMass=
      massA*(.55+2.2*vessel+1.4*dome)+
      massB*(.25+1.4*organic)+
      massC*(.15+.9*asymmetry);

    const diagA=.5+.5*Math.sin(2*Math.PI*(2.2*u+1.55*t)+phaseA);
    const diagB=.5+.5*Math.sin(2*Math.PI*(2.2*u-1.45*t)+phaseB);
    const latticeField=Math.pow(Math.max(diagA,diagB),5.4);
    const cageField=
      Math.pow(.5+.5*Math.cos(2*Math.PI*(3.0*u)+phaseC),7.0)*
      Math.pow(.5+.5*Math.cos(2*Math.PI*(2.0*t)+phaseA),5.0);
    const interweaveField=Math.pow(diagA*diagB,1.65);
    const wrappedField=Math.pow(.5+.5*Math.sin(2*Math.PI*(3.5*t+.72*u)+phaseB),4.2);
    const continuityField=.5+.5*Math.sin(2*Math.PI*(1.0*u+.70*t)+phaseC);

    let cellField=0;
    const cells=Math.max(3,4+holeCount+Math.round(cellular*3));
    for(let i=0;i<cells;i++){
      const cu=(i+.5)/cells;
      const ct=.20+.60*(.5+.5*Math.sin(i*2.27+phaseA));
      cellField+=gaussian2(u,t,cu,ct,.055+.018*cellular,.10+.035*cellular);
    }
    cellField=clamp(cellField,0,1.8);

    const frameU=Math.exp(-Math.pow((Math.abs(u-.5)-.34)/(.025+.025*frameIntensity),2));
    const frameT=Math.exp(-Math.pow((Math.abs(t-.5)-.31)/(.026+.024*frameIntensity),2));
    const frameField=Math.max(frameU,frameT);

    let nodeField=0;
    const nodes=Math.max(nodeCount,rivetCount>0?Math.min(6,rivetCount):0);
    for(let i=0;i<nodes;i++){
      const cu=(i+1)/(nodes+1);
      const ct=.28+.44*((i%2)?1:0);
      nodeField+=gaussian2(u,t,cu,ct,.030+.018*(1-organic),.055+.025*organic);
    }

    let spikeField=0;
    const spikes=Math.max(spikeCount,Math.round(2.5*architectural));
    for(let i=0;i<spikes;i++){
      const cu=(i+1)/(spikes+1);
      const d=(u-cu)/(.018+.012*(1-architectural));
      const vertical=Math.exp(-Math.pow((t-.70)/(.11+.04*organic),2));
      spikeField+=Math.exp(-d*d*1.8)*vertical;
    }

    let vocabulary=0;
    if(treatment==='solid'){
      vocabulary=
        1.20*zonedMass+
        .70*continuity*continuityField+
        .35*wrapped*wrappedField+
        .30*lattice*latticeField;
    }else if(treatment==='volumetric'){
      vocabulary=
        1.55*zonedMass+
        .80*dome*massA+
        .65*vessel*massB+
        .48*cellular*cellField+
        .32*wrapped*wrappedField;
    }else{
      vocabulary=
        (.80+1.60*lattice)*latticeField+
        (.45+1.25*cage)*cageField+
        1.10*inter*interweaveField+
        .65*wrapped*wrappedField+
        .40*cellular*cellField+
        .40*zonedMass;
    }

    vocabulary +=
      facetField+
      grooveField+
      (0.45+1.25*frameIntensity)*frameField+
      (0.32+1.20*clamp(p.nodeVolume||0,0,2)/2)*nodeField+
      (0.24+1.05*clamp(p.spikeHeight||0,0,3)/3)*spikeField;

    const recess=
      .60*cellular*Math.max(0,cellField-.62)+
      .55*Math.max(0,-grooveField);

    const maxRaise=CROWN_DEPTH_MM*(1.05+1.20*surfaceRelief+0.42*architectural);
    const maxRecess=CROWN_DEPTH_MM*.38;
    return clamp(vocabulary*maxRaise*.33-recess*maxRecess,-maxRecess,maxRaise);
  }

  const TOP_SURFACE_SEG=12;
  const SIDE_SURFACE_SEG=TOP_SURFACE_SEG;
  function toothBondFade(t){ return smooth01(clamp(t/.14,0,1)); }
  function exteriorYField(x,t){ return toothBondFade(t)*crownOperationField(x,t); }
  function topZField(x,d){
    const depthMask=smooth01(clamp(d,0,1));
    const field=crownOperationField(x,.82+.18*depthMask);
    return field*.52*depthMask;
  }
  function sideXField(side,t,d){
    const depthMask=smooth01(clamp(d,0,1));
    const x=side<0?-WIDTH_MM*.5:WIDTH_MM*.5;
    const field=crownOperationField(x,clamp(t,0,1));
    return side*field*.46*depthMask*toothBondFade(t);
  }

  function orientClosedMesh(V,F){
    let signed6=0;
    for(const f of F){
      const a=V[f[0]],b=V[f[1]],c=V[f[2]];
      signed6 +=
        a[0]*(b[1]*c[2]-b[2]*c[1])-
        a[1]*(b[0]*c[2]-b[2]*c[0])+
        a[2]*(b[0]*c[1]-b[1]*c[0]);
    }
    if(signed6<0){
      for(let i=0;i<F.length;i++) F[i]=[F[i][0],F[i][2],F[i][1]];
    }
    return {V,F};
  }

  // CONSTRUCCIÓN DE LA CORONA CON ORIENTACIÓN CORREGIDA
  {
    const V=[],F=[];
    const inner=Array.from({length:X_SEG+1},()=>Array(Z_SEG+1));
    const outer=Array.from({length:X_SEG+1},()=>Array(Z_SEG+1));

    for(let i=0;i<=X_SEG;i++){
      const u=i/X_SEG;
      const x=-WIDTH_MM*.5+WIDTH_MM*u;
      const zb=lowerZ(x);
      const zt=Math.max(zb+ROOT_TRANSITION_MM,topZ(x));
      const cy=contactY(x);
      for(let j=0;j<=Z_SEG;j++){
        const t=j/Z_SEG;
        const z=zb+(zt-zb)*t;
        inner[i][j]=V.length;
        V.push([x,cy-CROWN_DEPTH_MM*.5,z]);

        const sideBand=.10;
        const leftBlend=1-smooth01(clamp(u/sideBand,0,1));
        const rightBlend=1-smooth01(clamp((1-u)/sideBand,0,1));
        const topBlend=smooth01(clamp((t-.82)/.18,0,1));
        const sideOffset=sideXField(-1,t,1)*leftBlend+sideXField(1,t,1)*rightBlend;
        const topOffset=topZField(x,1)*topBlend;
        outer[i][j]=V.length;
        V.push([
          x+sideOffset,
          cy+CROWN_DEPTH_MM*.5+exteriorYField(x,t),
          z+topOffset
        ]);
      }
    }

    const q=(a,b,c,d)=>{F.push([a,b,c],[a,c,d]);};
    for(let i=0;i<X_SEG;i++){
      for(let j=0;j<Z_SEG;j++){
        // CORRECCIÓN 1: Sentido de rotación invertido en inner para apuntar hacia afuera (-Y)
        q(inner[i][j], inner[i+1][j], inner[i+1][j+1], inner[i][j+1]);
        q(outer[i][j], outer[i][j+1], outer[i+1][j+1], outer[i+1][j]);
      }
    }

    const lowerGrid=Array.from({length:X_SEG+1},()=>Array(SIDE_SURFACE_SEG+1));
    for(let i=0;i<=X_SEG;i++){
      const x=-WIDTH_MM*.5+WIDTH_MM*(i/X_SEG);
      const cy=contactY(x);
      const zb=lowerZ(x);
      for(let k=0;k<=SIDE_SURFACE_SEG;k++){
        if(k===0){ lowerGrid[i][k]=inner[i][0]; continue; }
        if(k===SIDE_SURFACE_SEG){ lowerGrid[i][k]=outer[i][0]; continue; }
        const d=k/SIDE_SURFACE_SEG;
        lowerGrid[i][k]=V.length;
        V.push([x,cy-CROWN_DEPTH_MM*.5+CROWN_DEPTH_MM*d,zb]);
      }
    }
    for(let i=0;i<X_SEG;i++){
      for(let k=0;k<SIDE_SURFACE_SEG;k++){
        q(lowerGrid[i][k],lowerGrid[i+1][k],lowerGrid[i+1][k+1],lowerGrid[i][k+1]);
      }
    }

    const topGrid=Array.from({length:X_SEG+1},()=>Array(TOP_SURFACE_SEG+1));
    for(let i=0;i<=X_SEG;i++){
      const u=i/X_SEG;
      const x=-WIDTH_MM*.5+WIDTH_MM*u;
      const zb=lowerZ(x);
      const zt=Math.max(zb+ROOT_TRANSITION_MM,topZ(x));
      const cy=contactY(x);
      for(let k=0;k<=TOP_SURFACE_SEG;k++){
        if(k===0){ topGrid[i][k]=inner[i][Z_SEG]; continue; }
        if(k===TOP_SURFACE_SEG){ topGrid[i][k]=outer[i][Z_SEG]; continue; }
        const d=k/TOP_SURFACE_SEG;
        const sideBand=.10;
        const leftBlend=1-smooth01(clamp(u/sideBand,0,1));
        const rightBlend=1-smooth01(clamp((1-u)/sideBand,0,1));
        const sideOffset=(sideXField(-1,1,d)*leftBlend+sideXField(1,1,d)*rightBlend);
        topGrid[i][k]=V.length;
        V.push([
          x+sideOffset,
          cy-CROWN_DEPTH_MM*.5+CROWN_DEPTH_MM*d+exteriorYField(x,1)*d,
          zt+topZField(x,d)
        ]);
      }
    }
    for(let i=0;i<X_SEG;i++){
      for(let k=0;k<TOP_SURFACE_SEG;k++){
        q(topGrid[i][k],topGrid[i+1][k],topGrid[i+1][k+1],topGrid[i][k+1]);
      }
    }

    // CORRECCIÓN 3: Sincronización estricta de parches laterales
    for(const side of [-1,1]){
      const i=side<0?0:X_SEG;
      const x=side<0?-WIDTH_MM*.5:WIDTH_MM*.5;
      const zb=lowerZ(x);
      const zt=Math.max(zb+ROOT_TRANSITION_MM,topZ(x));
      const cy=contactY(x);
      const sideGrid=Array.from({length:Z_SEG+1},()=>Array(SIDE_SURFACE_SEG+1));
      for(let j=0;j<=Z_SEG;j++){
        const t=j/Z_SEG;
        const z=zb+(zt-zb)*t;
        for(let k=0;k<=SIDE_SURFACE_SEG;k++){
          if(j===0){ sideGrid[j][k]=lowerGrid[i][k]; continue; }
          if(j===Z_SEG){ sideGrid[j][k]=topGrid[i][k]; continue; }
          if(k===0){ sideGrid[j][k]=inner[i][j]; continue; }
          if(k===SIDE_SURFACE_SEG){ sideGrid[j][k]=outer[i][j]; continue; }
          const d=k/SIDE_SURFACE_SEG;
          const topBlend=smooth01(clamp((t-.82)/.18,0,1));
          sideGrid[j][k]=V.length;
          V.push([
            x+sideXField(side,t,d),
            cy-CROWN_DEPTH_MM*.5+CROWN_DEPTH_MM*d+exteriorYField(x,t)*d,
            z+topZField(x,d)*topBlend
          ]);
        }
      }
      for(let j=0;j<Z_SEG;j++){
        for(let k=0;k<SIDE_SURFACE_SEG;k++){
          if(side<0) q(sideGrid[j][k],sideGrid[j][k+1],sideGrid[j+1][k+1],sideGrid[j+1][k]);
          else q(sideGrid[j][k],sideGrid[j+1][k],sideGrid[j+1][k+1],sideGrid[j][k+1]);
        }
      }
    }

    const mesh=orientClosedMesh(V,F);
    const crownManifold=meshToManifold(wasm,mesh.V,mesh.F);
    recordStage(crownManifold,'haircomb/crown-source');
    parts.push(crownManifold);
  }

  // CONSTRUCCIÓN DE DIENTES CON NORMALES EN TAPAS CORREGIDAS
  function makeToothMesh(xRoot,lateral){
    const rings=21,seg=32;
    const V=[],F=[],R=[];
    const zRoot=lowerZ(xRoot)+ROOT_TRANSITION_MM*.58;
    const yRoot=contactY(xRoot)-CROWN_DEPTH_MM*.42;
    const fan=lateral*piecewiseByWidth(2.0,2.8,3.6);

    for(let i=0;i<rings;i++){
      const u=i/(rings-1);
      const ease=smooth01(u);
      const x=xRoot+fan*ease;
      const y=yRoot-TOOTH_SWEEP_MM*(.16*u+.84*u*u);
      const z=zRoot-TOOTH_LENGTH_MM*u;
      const r0=TOOTH_DIAMETER_MM*.5;
      const r1=Math.max(.70,r0*.48);
      const taper=Math.pow(u,.90);
      const rx=r0*(1-taper)+r1*taper;
      const ry=rx*.82;
      R[i]=[];
      for(let k=0;k<seg;k++){
        const a=2*Math.PI*k/seg;
        R[i][k]=V.length;
        V.push([x+rx*Math.cos(a),y+ry*Math.sin(a),z]);
      }
    }

    for(let i=0;i<rings-1;i++){
      for(let k=0;k<seg;k++){
        const j=(k+1)%seg;
        F.push([R[i][k],R[i][j],R[i+1][j]]);
        F.push([R[i][k],R[i+1][j],R[i+1][k]]);
      }
    }

    // CORRECCIÓN 2A: Tapa superior (raíz) orientada hacia el exterior (+Z)
    const root=V.length;
    V.push([xRoot,yRoot,zRoot]);
    for(let k=0;k<seg;k++){
      const j=(k+1)%seg;
      F.push([root,R[0][k],R[0][j]]);
    }

    // CORRECCIÓN 2B: Tapa inferior (punta) orientada hacia el exterior (-Z)
    const tip=V.length;
    V.push([
      xRoot+fan,
      yRoot-TOOTH_SWEEP_MM,
      zRoot-TOOTH_LENGTH_MM-.90
    ]);
    for(let k=0;k<seg;k++){
      const j=(k+1)%seg;
      F.push([R[rings-1][k],R[rings-1][j],tip]);
    }
    return orientClosedMesh(V,F);
  }

  for(let i=0;i<TOOTH_COUNT;i++){
    const x=-TOOTH_SPAN_MM*.5+i*TOOTH_SPACING_MM;
    const lateral=x/(TOOTH_SPAN_MM*.5||1);
    const mesh=makeToothMesh(x,lateral);
    const toothManifold=meshToManifold(wasm,mesh.V,mesh.F);
    recordStage(toothManifold,'haircomb/tooth-'+(i+1)+'-source');
    parts.push(toothManifold);
  }

  p.hairCombWidthMm=WIDTH_MM;
  p.hairCombCrownHeightMm=CROWN_HEIGHT_MM;
  p.hairCombCrownDepthMm=CROWN_DEPTH_MM;
  p.hairCombToothCount=TOOTH_COUNT;
  p.hairCombToothSpacingMm=TOOTH_SPACING_MM;
  p.hairCombToothLengthMm=TOOTH_LENGTH_MM;
  p.hairCombToothRootDiameterMm=TOOTH_DIAMETER_MM;
  p.hairCombToothTipDiameterMm=Math.max(1.40,TOOTH_DIAMETER_MM*.48);
  p.hairCombRootTransitionMm=ROOT_TRANSITION_MM;
  p.hairCombCranialSagMm=SKULL_SAG_MM;
  p.hairCombToothSweepMm=TOOTH_SWEEP_MM;
  p.hairCombDecorationZone='crownExteriorTopAndSides';
  p.hairCombStructuralTreatment=treatment;
  p.hairCombOperationVocabulary='fullRingCircumferenceVocabulary';
  p.hairCombCurvatureAxis='Y';
  p.hairCombCrownCurvatureDirection='positiveYConvex';
  p.hairCombToothCurvatureDirection='negativeYTowardHead';
  p.hairCombGeneratorVersion='haircomb-v10-diagnostic';

  let assembled=parts.shift();
  recordStage(assembled,'haircomb/assembly-crown');
  for(let i=0;i<parts.length;i++){
    const tooth=parts[i];
    let merged;
    try{
      merged=wasm.Manifold.union(assembled,tooth);
    }catch(error){
      hairCombDiagnostics.push({label:'haircomb/union-tooth-'+(i+1),ok:false,exception:String(error&&error.message||error)});
      try{assembled.delete();}catch(e){}
      try{tooth.delete();}catch(e){}
      for(let j=i+1;j<parts.length;j++)try{parts[j].delete();}catch(e){}
      p.hairCombDiagnostics=hairCombDiagnostics;
      throw new Error('AGDP haircomb union failed at tooth '+(i+1)+': '+String(error&&error.message||error));
    }
    try{assembled.delete();}catch(e){}
    try{tooth.delete();}catch(e){}
    assembled=merged;
    const report=recordStage(assembled,'haircomb/union-tooth-'+(i+1));
    if(!report.ok){
      for(let j=i+1;j<parts.length;j++)try{parts[j].delete();}catch(e){}
      p.hairCombDiagnostics=hairCombDiagnostics;
      throw new Error('AGDP haircomb topology failed after tooth '+(i+1)+'; inspect console report');
    }
  }
  p.hairCombDiagnostics=hairCombDiagnostics;
  p.hairCombFirstFailedStage=(hairCombDiagnostics.find(r=>!r.ok)||{}).label||null;
  return {manifold:assembled,bandW:CROWN_HEIGHT_MM};
}

function makeHoopEarringManifold(wasm, p){
  const HOOP_BODY_MIN_OD_MM = 14;
  const HOOP_BODY_MAX_OD_MM = 35;
  const HOOP_BODY_DEFAULT_OD_MM = 24;
  const HOOK_TIP_R_MM = 0.45;
  const HOOK_SHAFT_R_MM = 0.58;
  const HOOK_ROOT_R_MM = 1.00;
  const HOOK_ROOT_OVERLAP_MM = 1.50;
  const HOOK_MIN_OVERLAP_VOLUME_MM3 = 0.45;
  const HOOK_RISE_MM = 6.2;
  const HOOK_BEND_R_MM = 5.2;
  const HOOK_INSERTION_MM = 12.0;
  const HOOK_TAIL_FLARE_MM = 0.9;
  const BODY_SPAN_MM = clamp(Number.isFinite(p.mainSize)?p.mainSize:HOOP_BODY_DEFAULT_OD_MM, HOOP_BODY_MIN_OD_MM, HOOP_BODY_MAX_OD_MM);
  const BODY_DEPTH_MM = clamp(p.bandWidth||4.8, 3.6, 7.2);

  return (async () => {
    const I=(p.loadGraph&&p.loadGraph.intensities)||{bridge:.35,void:.25,node:.35,suspension:.3,continuity:.75,organism:.5};
    const architectural=clamp(p.architectural||0,0,1);
    const outerR=BODY_SPAN_MM*.5;
    const annularWall=clamp(BODY_SPAN_MM*(.105+.035*architectural+.025*I.node),3.2,6.2);
    const innerR=Math.max(outerR-annularWall,outerR*.48);
    const bandWidth=Math.max(BODY_DEPTH_MM,(p.minFeature||.8)*3.2);
    const ringParams=Object.assign({},p,{
      type:'pendantAnnularCore', mainSize:innerR*2, bandWidth,
      holes:Math.min(2,p.holes||0), railCount:Math.min(1,p.railCount||0),
      nodes:0, rivets:0, screws:0, crown:false, spikes:0, opening:0
    });
    const built=await buildBandGeometryManifold(wasm,ringParams,{
      type:'pendantAnnularCore',innerD:innerR*2,width:bandWidth,closed:true,opening:0
    });
    let bodyManifold=built.manifold.rotate([0,90,0]);

    const earringNodeCount=Math.max(0,Math.round(p.nodes||0));
    if(earringNodeCount>0){
      const cov=clamp((p.articulationCoverage||120)*Math.PI/180,0.35,Math.PI*1.65);
      const center=(p.articulationOffset||0)*Math.PI/180;
      const nodeParts=[];
      for(let k=0;k<earringNodeCount;k++){
        const u=earringNodeCount===1?.5:k/(earringNodeCount-1);
        const t=center-cov*.5+cov*u;
        const nodeR=Math.max(AGDP_MIN_WALL_MM*.78,0.50+(p.nodeVolume||0)*.28);
        const depthOffset=(k%2?1:-1)*bandWidth*.14;
        const radialDir=[0,Math.sin(t),-Math.cos(t)];
        const anchorR=outerR-nodeR*.72;
        const bridgeR=outerR-nodeR*.18;
        const nodeCenterR=outerR+nodeR*.28;
        const anchor=[depthOffset,radialDir[1]*anchorR,radialDir[2]*anchorR];
        const bridge=[depthOffset,radialDir[1]*bridgeR,radialDir[2]*bridgeR];
        const nodeCenter=[depthOffset,radialDir[1]*nodeCenterR,radialDir[2]*nodeCenterR];
        nodeParts.push(sphereAt(wasm,anchor,nodeR*.78,48));
        nodeParts.push(sphereAt(wasm,bridge,nodeR*.88,48));
        nodeParts.push(organicNodeAt(wasm,nodeCenter,nodeR,48,t+k*.73));
      }
      const nodeAssembly=unionAll(wasm,nodeParts);
      const mergedBody=wasm.Manifold.union(bodyManifold,nodeAssembly);
      try{ bodyManifold.delete(); }catch(e){}
      try{ nodeAssembly.delete(); }catch(e){}
      bodyManifold=mergedBody;
    }

    const rootInnerY=innerR+Math.max(annularWall*.24,HOOK_ROOT_OVERLAP_MM*.55);
    const rootExitY=innerR+annularWall*.72;
    const hookPts=[];
    const hookRadii=[];
    const rootSteps=12;
    for(let i=0;i<=rootSteps;i++){
      const q=i/rootSteps;
      const eased=q*q*(3-2*q);
      hookPts.push([
        0,
        rootInnerY+(rootExitY-rootInnerY)*eased,
        HOOK_ROOT_OVERLAP_MM*.22*Math.sin(Math.PI*q)
      ]);
      const r=HOOK_ROOT_R_MM+(HOOK_SHAFT_R_MM-HOOK_ROOT_R_MM)*eased*.38;
      hookRadii.push([r,r]);
    }
    const riseY=outerR+HOOK_RISE_MM;
    const riseSteps=22;
    for(let i=1;i<=riseSteps;i++){
      const q=i/riseSteps;
      const eased=q*q*(3-2*q);
      hookPts.push([0,rootExitY+(riseY-rootExitY)*q,0]);
      const startR=HOOK_ROOT_R_MM+(HOOK_SHAFT_R_MM-HOOK_ROOT_R_MM)*.38;
      const r=startR+(HOOK_SHAFT_R_MM-startR)*eased;
      hookRadii.push([r,r]);
    }
    const bendCenter=[HOOK_BEND_R_MM,riseY,0];
    const bendSteps=48;
    for(let i=1;i<=bendSteps;i++){
      const q=i/bendSteps;
      const a=Math.PI-Math.PI*q;
      hookPts.push([bendCenter[0]+HOOK_BEND_R_MM*Math.cos(a),bendCenter[1]+HOOK_BEND_R_MM*Math.sin(a),0]);
      const r=HOOK_SHAFT_R_MM+(HOOK_TIP_R_MM*1.12-HOOK_SHAFT_R_MM)*q;
      hookRadii.push([r,r]);
    }
    const tailStart=hookPts[hookPts.length-1];
    const tailSteps=24;
    for(let i=1;i<=tailSteps;i++){
      const q=i/tailSteps;
      const eased=q*q*(3-2*q);
      hookPts.push([tailStart[0]+HOOK_TAIL_FLARE_MM*eased,tailStart[1]-HOOK_INSERTION_MM*q,0]);
      const r=HOOK_TIP_R_MM*1.12+(HOOK_TIP_R_MM-HOOK_TIP_R_MM*1.12)*q;
      hookRadii.push([r,r]);
    }
    const hookMesh=variableEllipticalTubeMesh(hookPts,hookRadii,64,false);
    const hookManifold=meshToManifold(wasm,hookMesh.V,hookMesh.F);

    const overlapManifold=wasm.Manifold.intersection(bodyManifold,hookManifold);
    const overlapMesh=manifoldToMesh(overlapManifold);
    const hookOverlapVolumeMm3=Math.abs(meshVolumeMm3(overlapMesh.V,overlapMesh.F));
    try{ overlapManifold.delete(); }catch(e){}
    if(!Number.isFinite(hookOverlapVolumeMm3)||hookOverlapVolumeMm3<HOOK_MIN_OVERLAP_VOLUME_MM3){
      try{ bodyManifold.delete(); }catch(e){}
      try{ hookManifold.delete(); }catch(e){}
      throw new Error('AGDP hoop hook/body overlap below structural minimum');
    }

    const manifold=wasm.Manifold.union(bodyManifold,hookManifold);
    try{ bodyManifold.delete(); }catch(e){}
    try{ hookManifold.delete(); }catch(e){}

    p.hoopHookTipDiameterMm=HOOK_TIP_R_MM*2;
    p.hoopHookRootDiameterMm=HOOK_ROOT_R_MM*2;
    p.hoopHookRootOverlapMm=HOOK_ROOT_OVERLAP_MM;
    p.hoopHookBodyOverlapVolumeMm3=hookOverlapVolumeMm3;
    p.hoopHookBendRadiusMm=HOOK_BEND_R_MM;
    p.hoopHookInsertionLengthMm=HOOK_INSERTION_MM;
    p.hoopHookRotationDeg=90;
    p.hoopBodySpanMm=BODY_SPAN_MM;
    p.hoopBodyDepthMm=bandWidth;
    p.hoopClosureType='integratedFrenchHook';
    p.hoopBodyGeometry='pendantAnnularCore';
    p.hoopPairCount=2;
    p.hoopBodyCommercialRangeMm=[HOOP_BODY_MIN_OD_MM,HOOP_BODY_MAX_OD_MM];
    p.hoopBodyDefaultMm=HOOP_BODY_DEFAULT_OD_MM;
    return {manifold,bandW:bandWidth};
  })();
}

async function makeMeshManifoldEntry(wasm, inputParams){
  const p = window.GenerationLayers.compile(Object.assign({}, inputParams));
  let manifold;
  if (p.type==='pendant') {
    ({manifold} = await makePendantManifold(wasm, p));
  } else if (p.type==='cufflinks') {
    ({manifold} = await makeCufflinksManifold(wasm, p));
  } else if (p.type==='haircomb') {
    ({manifold} = makeHairCombManifold(wasm, p));
  } else if (p.type==='hoopEarring') {
    ({manifold} = await makeHoopEarringManifold(wasm, p));
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

  const isSegmentedType = (p.type==='choker' || p.type==='headpiece');
  let V, F;
  if(isSegmentedType){
    const preMesh = manifoldToMeshHelper(manifold);
    const preWeightLimits = AGDP_SILVER_HOLLOWING.thresholdsGrams[silverWeightProfileKey(p)]||{rejectAbove:Infinity};
    const preWeight = silverWeightGrams(meshVolumeMm3(preMesh.V, preMesh.F));
    if (preWeight > preWeightLimits.rejectAbove) {
      try{ manifold.delete(); }catch(e){}
      return {
        V: preMesh.V, F: preMesh.F,
        audit: { ok:false, warning:'FALLA: masa de plata superior al límite ergonómico y económico',
          silverG:preWeight, weightLimitG:preWeightLimits.rejectAbove, weightOK:false,
          components:1, manifoldOK:true, finite:true, discardedComponents:[] },
        bandW: p.bandWidth||0, innerR:(p.mainSize||0)/2
      };
    }
    const wall = 2.2;
    const segmentManifolds = splitIntoHookedSegments(wasm, manifold, wall);
    ({V, F} = concatenateSegmentMeshes(segmentManifolds));
    segmentManifolds.forEach(seg => { try{ seg.delete(); }catch(e){} });
    p.segmentedIntoParts = 3;
    p.segmentConnectorType = 'slidingDovetailRail';
    p.segmentConnectorRailMm = 'full-height';
  } else if(p.type==='hoopEarring') {
    const unitMesh=manifoldToMeshHelper(manifold);
    try{ manifold.delete(); }catch(e){}
    manifold=null;
    const unitConnectivity=removeFloatingComponents(unitMesh.V,unitMesh.F,1);
    if(unitConnectivity.totalComponents!==1||unitConnectivity.discarded.length!==0){
      throw new Error('AGDP hoop earring unit is disconnected; generation rejected before pair export');
    }
    const xs=unitConnectivity.V.map(v=>v[0]);
    const unitDepth=xs.length?Math.max(...xs)-Math.min(...xs):0;
    const minimumClearGapMm=6;
    const pairSpacing=Math.max((p.hoopBodySpanMm||p.mainSize||26)+minimumClearGapMm,unitDepth+minimumClearGapMm);
    ({V,F}=identicalFacingPairMesh(unitConnectivity.V,unitConnectivity.F,pairSpacing));
    p.hoopPairCenterSpacingMm=pairSpacing;
    p.hoopPairComponents=2;
    p.hoopPairPresentation='asymmetricJewelleryProductComposition';
  } else if(p.type==='haircomb') {
    const rawHairCombMesh=manifoldToMeshHelper(manifold);
    const rawReport=diagnoseClosedTriangleMesh(rawHairCombMesh.V,rawHairCombMesh.F,'haircomb/final-raw');
    console[rawReport.ok?'info':'error']('AGDP haircomb diagnostic '+(rawReport.ok?'✓':'✗'),'haircomb/final-raw',rawReport);
    try{ manifold.delete(); }catch(e){}
    manifold=null;
    const canonicalHairComb=canonicalizeMeshForValidation(rawHairCombMesh.V,rawHairCombMesh.F,1e-5);
    const canonicalReport=diagnoseClosedTriangleMesh(canonicalHairComb.V,canonicalHairComb.F,'haircomb/final-canonical');
    console[canonicalReport.ok?'info':'error']('AGDP haircomb diagnostic '+(canonicalReport.ok?'✓':'✗'),'haircomb/final-canonical',canonicalReport);
    if(!canonicalReport.ok){
      p.hairCombFinalDiagnostics={raw:rawReport,canonical:canonicalReport};
      throw new Error('AGDP haircomb canonical topology is invalid; inspect p.hairCombFinalDiagnostics');
    }
    const rebuiltHairComb=meshToManifold(wasm,canonicalHairComb.V,canonicalHairComb.F);
    ({V,F}=manifoldToMeshHelper(rebuiltHairComb));
    const rebuiltReport=diagnoseClosedTriangleMesh(V,F,'haircomb/final-rebuilt');
    console[rebuiltReport.ok?'info':'error']('AGDP haircomb diagnostic '+(rebuiltReport.ok?'✓':'✗'),'haircomb/final-rebuilt',rebuiltReport);
    try{ rebuiltHairComb.delete(); }catch(e){}
    p.hairCombFinalDiagnostics={raw:rawReport,canonical:canonicalReport,rebuilt:rebuiltReport};
    if(!rebuiltReport.ok) throw new Error('AGDP haircomb rebuilt topology is invalid; inspect p.hairCombFinalDiagnostics');
    p.hairCombTopologyRepair='diagnosedSubMicronWeldAndManifoldRoundTrip';
    p.hairCombWeldedVertexCount=canonicalHairComb.weldedVertices;
    p.hairCombRemovedDegenerateTriangles=canonicalHairComb.removedDegenerate;
    p.hairCombRemovedDuplicateTriangles=canonicalHairComb.removedDuplicate;
    p.hairCombGeneratorVersion='haircomb-v10-diagnostic';
  } else {
    ({ V, F } = manifoldToMeshHelper(manifold));
    try{ manifold.delete(); }catch(e){}
    manifold = null;
  }

  const expectedComponents = (p.type==='cufflinks'||p.type==='hoopEarring') ? 2 : (isSegmentedType ? 3 : 1);
  const connected = removeFloatingComponents(V, F, expectedComponents);
  V = connected.V; F = connected.F;
  if(connected.discarded && connected.discarded.length){
    console.warn('AGDP: '+connected.discarded.length+' componente(s) descartado(s) de '+connected.totalComponents+' total — ', connected.discarded);
  }
  const extra = {
    type:p.type, innerD:(p.type==='ring'||p.type==='bangle'||p.type==='earCuff')?p.mainSize:(p.type==='cuffBracelet'?p.mainSize*0.85:0),
    bandW:p.bandWidth, holeCells:0, printProfile:p.printProfile, minFeature:p.minFeature,
    maxRelief:p.surfaceRelief+p.sideRelief, spikes:0, hinges:p.hinges,
    allowConstructiveOverlap:true, booleanUnion:true, allowedSolids:expectedComponents
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
  return { V, F, audit, bandW: extra.bandW||0, innerR:(extra.innerD||0)/2, compiledParams: p };
}

function manifoldToMeshHelper(manifoldObj){
  const out = manifoldObj.getMesh();
  try {
    const V = [], F = [];
    for (let i = 0; i < out.vertProperties.length; i += 3) V.push([out.vertProperties[i], out.vertProperties[i+1], out.vertProperties[i+2]]);
    for (let i = 0; i < out.triVerts.length; i += 3) F.push([out.triVerts[i], out.triVerts[i+1], out.triVerts[i+2]]);
    return { V, F };
  } finally {
    if (out && typeof out.delete === 'function') out.delete();
  }
}

let _wasmReady = null;
function ensureWasm(){
  if(!_wasmReady){
    _wasmReady = Module().then(wasm => { wasm.setup(); return wasm; });
  }
  return _wasmReady;
}

window.AGDP_resetWasmModule = function(){
  _wasmReady = null;
};
window.makeMeshManifold = async function(inputParams){
  const wasm = await ensureWasm();
  return makeMeshManifoldEntry(wasm, inputParams);
};
window.AGDP_MANIFOLD_PRELOAD = ensureWasm();
