import Module from 'manifold-3d';

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
const SHAPEWAYS_SILVER_925 = Object.freeze({
  process: 'lost-wax-casting',
  units: 'mm',
  boundingBoxMm: Object.freeze({ min: Object.freeze([2.4, 2.4, 0.6]), max: Object.freeze([89, 89, 100]) }),
  wallsMm: Object.freeze({
    natural: Object.freeze({ supported: 0.6, unsupported: 0.6 }),
    polished: Object.freeze({ supported: 0.8, unsupported: 0.8 })
  }),
  wiresMm: Object.freeze({ supported: 0.8, unsupported: 1.0 }),
  detailsMm: Object.freeze({
    natural: Object.freeze({ embossedWidth: 0.3, embossedHeight: 0.3, engravedWidth: 0.3, engravedDepth: 0.3 }),
    polished: Object.freeze({ embossedWidth: 0.3, embossedHeight: 0.3, engravedWidth: 0.3, engravedDepth: 0.3 }),
    fineDetailPolished: Object.freeze({ embossedWidth: 0.4, embossedHeight: 0.4, engravedWidth: 0.35, engravedDepth: 0.35 })
  }),
  clearanceMm: Object.freeze({ separateParts: 0.3 }),
  escapeHolesMm: Object.freeze({ singleDiameter: 4.0, multipleDiameter: 2.0, preferredCount: 2 }),
  partsPerFile: Object.freeze({ maximumIdentical: 2, multipleUniqueAllowed: false, interlockingAllowed: false, enclosedPartsAllowed: false })
});
window.SHAPEWAYS_SILVER_925 = SHAPEWAYS_SILVER_925;


const COMMERCIAL_DIMENSION_REFERENCE_LIMITS = Object.freeze({
  sourceRole: 'commercial-dimensional-reference',
  provenance: 'published luxury-jewelry dimensional benchmarks',
  units: 'mm',
  ring: Object.freeze({
    innerCircumferenceMm: Object.freeze({ min: 44, max: 77 }),
    innerDiameterMm: Object.freeze({ min: 44 / Math.PI, max: 77 / Math.PI }),
    bandWidthMm: Object.freeze({ min: 2.6, max: 6.5 })
  }),
  bracelet: Object.freeze({
    nominalCircumferenceMm: Object.freeze({ min: 150, max: 220 }),
    circularEquivalentDiameterMm: Object.freeze({ min: 150 / Math.PI, max: 220 / Math.PI }),
    bandWidthMm: Object.freeze({ min: 3.6, max: 7.0 })
  }),
  pendant: Object.freeze({
    circularBodyOuterDiameterMm: Object.freeze({ min: 10.8, max: 23.5 })
  }),
  hoopEarring: Object.freeze({
    outerDiameterMm: Object.freeze({ min: 12.8, max: 35.0 }),
    axialWidthMm: Object.freeze({ min: 2.6, max: 5.7 })
  }),
  cufflinks: Object.freeze({
    faceDiameterMm: Object.freeze({ nominal: 12.0 }),
    postLengthMm: Object.freeze({ min: 10.0, nominal: 12.5, max: 15.0 }),
    toggleLengthMm: Object.freeze({ min: 15.0, nominal: 16.5, max: 18.0 })
  }),
  brooch: Object.freeze({
    faceWidthMm: Object.freeze({ nominal: 26.0 }),
    faceHeightMm: Object.freeze({ nominal: 20.0 })
  })
});
window.COMMERCIAL_DIMENSION_REFERENCE_LIMITS = COMMERCIAL_DIMENSION_REFERENCE_LIMITS;

// Existing geometry uses these aliases extensively. Both now resolve to the
// centralized manufacturing profile rather than independent numeric literals.
const AGDP_MIN_WALL_MM = SHAPEWAYS_SILVER_925.wallsMm.polished.supported;
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

// Builds a customer-facing pair from one validated unit mesh. The two
// earrings are arranged as a jewellery product composition rather than as
// two rigidly duplicated orthographic copies: the right unit remains nearly
// frontal, while the left unit turns into a controlled three-quarter view.
// This lets the annular body dominate visually and places the French hook
// behind it in perspective. The underlying printable geometry is unchanged;
// only each copy's presentation transform and position are modified.
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
// Variable-elliptical-radius variant of tubeAlongPathMesh: each point along
// the path carries its OWN (rx, ry) cross-section instead of one fixed
// radius for the whole tube. This is what a genuinely continuous, tapering
// ridge/crest needs -- unlike stitching together independent
// ellipticalSegmentBetween capsules (each its own separate capped
// cylinder with no shared cross-section with its neighbors), this shares
// a single ring of vertices at every path point, so consecutive
// cross-sections blend into one smooth tube instead of each one's own end
// cap poking through the next segment's own volume. That poking-through is
// exactly what produced the blocky, self-intersecting, faceted lumps in
// a continuous crest once cross-section radius (rx driven by
// CROWN_HEIGHT_MM*crownBoost) grew larger than the spacing between
// consecutive crownAnchors -- confirmed numerically (rx/spacing reached
// ~1.37x at the crest's own peak), which independent capsules cannot
// tolerate but a shared-ring tube handles by construction.
function variableEllipticalTubeMesh(points, radii, ringSegN, closed){
  ringSegN=Math.max(Math.round(ringSegN||8),8);
  closed=!!closed;
  if(!Array.isArray(points)||!Array.isArray(radii)||points.length!==radii.length||points.length<(closed?3:2)){
    throw new Error('variableEllipticalTubeMesh: invalid path/radii input');
  }

  // Remove consecutive coincident samples before frame construction. A zero-
  // length segment makes the old projected-frame transport collapse to a
  // zero vector, producing coincident ring vertices and degenerate triangles.
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

  // Rotation-minimising frame transport. Unlike repeated projection, this
  // remains stable through tight bends and near-orthogonal tangent changes.
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


function smoothRoundedRectTubeMeshYZ(origin, outerW, outerH, innerW, innerH, depth, straightSegments, cornerSegments, radialSegments) {
  // Closed rounded-rectangle tube in the YZ plane. Unlike an extruded frame,
  // every visible surface is part of one continuous swept skin, so polished
  // materials do not expose diagonal splits across broad planar quads.
  const ss=Math.max(4,Math.round(straightSegments||10));
  const cs=Math.max(10,Math.round(cornerSegments||18));
  const rs=Math.max(16,Math.round(radialSegments||24));
  const wallZ=Math.max((outerW-innerW)*.5,AGDP_MIN_WALL_MM);
  const wallY=Math.max((outerH-innerH)*.5,AGDP_MIN_WALL_MM);
  const tubeR=Math.max(AGDP_MIN_WALL_MM*.52,Math.min(wallZ,wallY)*.5);
  const rx=Math.max(depth*.5,AGDP_MIN_WALL_MM*.55);
  const hz=Math.max(innerW*.5+tubeR,tubeR*1.8);
  const hy=Math.max(innerH*.5+tubeR,tubeR*1.8);
  const cr=Math.min(Math.max(tubeR*1.25,Math.min(hz,hy)*.16),hz-tubeR*.35,hy-tubeR*.35);
  const path=[];
  const addLine=(z0,y0,z1,y1,n)=>{
    for(let i=0;i<n;i++){const t=i/n;path.push([z0+(z1-z0)*t,y0+(y1-y0)*t]);}
  };
  const addArc=(cz,cy,a0,a1,n)=>{
    for(let i=0;i<n;i++){const a=a0+(a1-a0)*(i/n);path.push([cz+cr*Math.cos(a),cy+cr*Math.sin(a)]);}
  };
  // Counter-clockwise centerline, with explicit subdivisions along every
  // straight span to keep triangle size and normal interpolation uniform.
  addLine(hz-cr,-hy,hz-cr,hy,ss);
  addArc(hz-cr,hy,0,Math.PI*.5,cs);
  addLine(hz,hy-cr,-hz,hy-cr,ss);
  addArc(-hz+cr,hy,Math.PI*.5,Math.PI,cs);
  addLine(-hz+cr,hy,-hz+cr,-hy,ss);
  addArc(-hz+cr,-hy,Math.PI,Math.PI*1.5,cs);
  addLine(-hz,-hy+cr,hz,-hy+cr,ss);
  addArc(hz-cr,-hy,Math.PI*1.5,Math.PI*2,cs);

  const n=path.length,V=[],F=[];
  for(let i=0;i<n;i++){
    const prev=path[(i+n-1)%n], next=path[(i+1)%n];
    let tz=next[0]-prev[0], ty=next[1]-prev[1];
    const tl=Math.hypot(tz,ty)||1;tz/=tl;ty/=tl;
    // For a CCW path, the right-hand normal points outside the frame.
    const nz=ty, ny=-tz;
    for(let k=0;k<rs;k++){
      const a=2*Math.PI*k/rs;
      const ca=Math.cos(a),sa=Math.sin(a);
      V.push([
        origin[0]+rx*ca,
        origin[1]+path[i][1]+tubeR*sa*ny,
        origin[2]+path[i][0]+tubeR*sa*nz
      ]);
    }
  }
  for(let i=0;i<n;i++){
    const j=(i+1)%n;
    for(let k=0;k<rs;k++){
      const l=(k+1)%rs;
      const a=i*rs+k,b=j*rs+k,c=j*rs+l,d=i*rs+l;
      F.push([a,b,c],[a,c,d]);
    }
  }
  return {V,F};
}


function rectilinearFrameMeshYZ(origin, outerW, outerH, innerW, innerH, depth) {
  // Closed rectangular frame in the YZ plane. The chain passage runs along X,
  // matching the lateral orientation of a conventional pendant bail.
  const hx=Math.max(depth*.5,AGDP_MIN_WALL_MM*.5);
  const ow=Math.max(outerW*.5,AGDP_MIN_WALL_MM);
  const oh=Math.max(outerH*.5,AGDP_MIN_WALL_MM);
  const iw=Math.max(innerW*.5,AGDP_MIN_WALL_MM*.25);
  const ih=Math.max(innerH*.5,AGDP_MIN_WALL_MM*.25);
  const V=[],F=[];
  const frontOuter=[],frontInner=[],backOuter=[],backInner=[];
  const outer=[[-ow,-oh],[ow,-oh],[ow,oh],[-ow,oh]]; // [z,y]
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
  // Lateral frame in the YZ plane with short-radius corners. The straight
  // spans remain dominant, while the corners use enough facets to match the
  // visual resolution of the surrounding annular body.
  const cs=Math.max(8,Math.round(cornerSegments||12));
  const hx=Math.max(depth*.5,AGDP_MIN_WALL_MM*.5);
  const wallZ=Math.max((outerW-innerW)*.5,AGDP_MIN_WALL_MM);
  const wallY=Math.max((outerH-innerH)*.5,AGDP_MIN_WALL_MM);
  const outerR=Math.min(Math.max(AGDP_MIN_WALL_MM*.22,Math.min(wallZ,wallY)*.32),Math.min(outerW,outerH)*.075);
  const innerR=Math.min(Math.max(AGDP_MIN_WALL_MM*.18,outerR*.72),Math.min(innerW,innerH)*.08);
  function loop(w,h,r){
    const pts=[];
    const cz=w*.5-r, cy=h*.5-r;
    const centers=[[cz,cy],[-cz,cy],[-cz,-cy],[cz,-cy]]; // [z,y]
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
  // The YZ loop construction above is topologically closed but uses the
  // opposite global winding from the rest of the generator. Reverse every
  // triangle so outward normals remain consistent through booleans and export.
  return {V,F:F.map(([a,b,c])=>[a,c,b])};
}



// Closed rounded prism with a shallow physical bevel. The bevel prevents
// renderers that average vertex normals from smearing a 90-degree edge across
// large planar triangles, while preserving the functional outer envelope.
function beveledRoundedRectPrismMesh(center,w,h,d,cornerR,bevel,cornerSegments){
  const cs=Math.max(6,Math.round(cornerSegments||12));
  const b=Math.max(0,Math.min(bevel||0,d*.24,w*.08,h*.08));
  const baseR=Math.max(0,Math.min(cornerR||0,w*.5-b,h*.5-b));
  function loop(lw,lh,r){
    const pts=[];
    if(r<=1e-7) return [[lw*.5,lh*.5],[-lw*.5,lh*.5],[-lw*.5,-lh*.5],[lw*.5,-lh*.5]];
    const cx=lw*.5-r,cy=lh*.5-r;
    const centers=[[cx,cy],[-cx,cy],[-cx,-cy],[cx,-cy]];
    const starts=[0,Math.PI*.5,Math.PI,Math.PI*1.5];
    for(let q=0;q<4;q++)for(let k=0;k<cs;k++){
      const a=starts[q]+k/cs*Math.PI*.5;
      pts.push([centers[q][0]+r*Math.cos(a),centers[q][1]+r*Math.sin(a)]);
    }
    return pts;
  }
  const endW=Math.max(AGDP_MIN_WALL_MM,w-2*b),endH=Math.max(AGDP_MIN_WALL_MM,h-2*b);
  const endR=Math.max(0,baseR-b);
  const rings=[
    {z:-d*.5,pts:loop(endW,endH,endR)},
    {z:-d*.5+b,pts:loop(w,h,baseR)},
    {z:d*.5-b,pts:loop(w,h,baseR)},
    {z:d*.5,pts:loop(endW,endH,endR)}
  ];
  const n=rings[0].pts.length,V=[],F=[],idx=[];
  for(const ring of rings){
    const row=[];
    for(const pt of ring.pts){row.push(V.length);V.push([center[0]+pt[0],center[1]+pt[1],center[2]+ring.z]);}
    idx.push(row);
  }
  const q=(a,b,c,d)=>F.push([a,b,c],[a,c,d]);
  for(let r=0;r<idx.length-1;r++)for(let i=0;i<n;i++){const j=(i+1)%n;q(idx[r][i],idx[r][j],idx[r+1][j],idx[r+1][i]);}
  const bot=V.length;V.push([center[0],center[1],center[2]-d*.5]);
  const top=V.length;V.push([center[0],center[1],center[2]+d*.5]);
  for(let i=0;i<n;i++){const j=(i+1)%n;F.push([bot,idx[0][j],idx[0][i]]);F.push([top,idx[3][i],idx[3][j]]);}
  return {V,F};
}

function beveledRoundedRectPrismManifold(wasm,center,w,h,d,cornerR,bevel,cornerSegments){
  const m=beveledRoundedRectPrismMesh(center,w,h,d,cornerR,bevel,cornerSegments);
  return meshToManifold(wasm,m.V,m.F);
}

function beveledEllipticalCylinderMesh(center,rx,ry,d,bevel,segments){
  const n=Math.max(48,Math.round(segments||128));
  const b=Math.max(0,Math.min(bevel||0,d*.24,rx*.12,ry*.12));
  const sx=Math.max(.05,(rx-b)/rx),sy=Math.max(.05,(ry-b)/ry);
  const levels=[[-d*.5,sx,sy],[-d*.5+b,1,1],[d*.5-b,1,1],[d*.5,sx,sy]];
  const V=[],F=[],rows=[];
  for(const [z,kx,ky] of levels){
    const row=[];
    for(let i=0;i<n;i++){const a=2*Math.PI*i/n;row.push(V.length);V.push([center[0]+rx*kx*Math.cos(a),center[1]+ry*ky*Math.sin(a),center[2]+z]);}
    rows.push(row);
  }
  const q=(a,b,c,d)=>F.push([a,b,c],[a,c,d]);
  for(let r=0;r<3;r++)for(let i=0;i<n;i++){const j=(i+1)%n;q(rows[r][i],rows[r][j],rows[r+1][j],rows[r+1][i]);}
  const bot=V.length;V.push([center[0],center[1],center[2]-d*.5]);
  const top=V.length;V.push([center[0],center[1],center[2]+d*.5]);
  for(let i=0;i<n;i++){const j=(i+1)%n;F.push([bot,rows[0][j],rows[0][i]]);F.push([top,rows[3][i],rows[3][j]]);}
  return {V,F};
}

function beveledEllipticalCylinderManifold(wasm,center,rx,ry,d,bevel,segments){
  const m=beveledEllipticalCylinderMesh(center,rx,ry,d,bevel,segments);
  return meshToManifold(wasm,m.V,m.F);
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
  // Keep deformation subtle. Strong anisotropic scaling exaggerates every
  // latitude ring and produces visible facets in mirror-finish materials.
  const e=.026+.012*(.5+.5*Math.sin(phase));
  const sx=1+e, sy=1-e*.28, sz=1/(sx*sy);
  // One stable local resolution avoids mixed tessellation at node/body unions.
  // Cutters retain their original resolution and are not routed here.
  const localSegments=Math.max(48,Math.round(segments||0));
  return Manifold.sphere(radius,localSegments).scale([sx,sy,sz]).translate(center);
}
function insertedRingManifold(wasm, origin, ex, ey, ez, ri, ro, thickness, segN) {
  // The opening is part of the source topology. No subtraction is performed,
  // so the inner rim cannot inherit triangulation from a transverse boolean.
  const mesh=annularPrismMesh(origin,ex,ey,ez,ri,ri,ro,ro,thickness,segN);
  return meshToManifold(wasm,mesh.V,mesh.F);
}
// General mesh cleanup: merges vertices within a tight tolerance (1
// micron -- far below any real jewelry feature size, so this cannot
// merge two legitimately distinct nearby details) and removes any
// triangle that becomes degenerate (two or more shared vertices, or a
// near-zero cross-product area) or is an exact duplicate of another
// triangle. Confirmed via direct STL mesh analysis (edge-sharing count
// audit) that CSG booleans in this pipeline occasionally produce exactly
// this kind of artifact -- a cluster of near-zero-area triangles all
// converging on one near-coincident point, or an outright duplicated
// triangle -- which shows up as non-manifold edges and visible jagged
// output, i.e. in the shared construction pipeline, not one typology's
// own code; this general pass catches the defect regardless of its
// exact source rather than requiring every individual embed calculation
// to be proven safe.

// Canonicalizes a mesh before external topology validation. Manifold's CSG
// output is geometrically closed, but separate boolean fragments can retain
// numerically coincident vertices. Validators that build edge incidence from
// vertex indices then report false open/non-manifold seams. This pass welds
// only sub-micron coincidences, removes collapsed/duplicate triangles, and
// compacts indices without changing any printable feature.
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



// Detailed topology audit used by the geometry diagnostic pipeline. This is
// intentionally independent from window.validate so a failing intermediate
// CSG stage can be identified before the final product audit is reached.
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
function topologyFailureReasons(report){
  if(!report) return ['missing-report'];
  const reasons=[];
  if(!report.finite) reasons.push('non-finite-coordinates');
  if(report.invalidIndices) reasons.push('invalid-indices:'+report.invalidIndices);
  if(report.degenerateTriangles) reasons.push('degenerate-triangles:'+report.degenerateTriangles);
  if(report.boundaryEdges) reasons.push('boundary-edges:'+report.boundaryEdges);
  if(report.nonManifoldEdges) reasons.push('non-manifold-edges:'+report.nonManifoldEdges);
  if(report.connectedComponents!==1) reasons.push('connected-components:'+report.connectedComponents);
  if(!(Math.abs(report.signedVolumeMm3)>1e-8)) reasons.push('near-zero-volume');
  if(report.exception) reasons.push('exception:'+report.exception);
  return reasons;
}
function diagnoseManifoldStage(manifold,label){
  try{
    const mesh=manifoldToMesh(manifold);
    const raw=diagnoseClosedTriangleMesh(mesh.V,mesh.F,label);
    let report=raw;
    // Manifold CSG can retain sub-micron duplicate vertices at otherwise
    // closed seams. Audit a canonicalized copy before classifying the stage as
    // failed, so index-level duplication is not confused with a real opening
    // or disconnected solid.
    if(!raw.ok){
      const canonical=canonicalizeMeshForValidation(mesh.V,mesh.F,1e-5);
      const normalized=diagnoseClosedTriangleMesh(canonical.V,canonical.F,label+'-canonical');
      report=Object.assign({},normalized,{
        label:String(label||'manifold'),
        raw,
        canonicalization:{
          weldedVertices:canonical.weldedVertices,
          removedDegenerate:canonical.removedDegenerate,
          removedDuplicate:canonical.removedDuplicate
        }
      });
    }
    report.failureReasons=topologyFailureReasons(report);
    const prefix=report.ok?'AGDP topology diagnostic ✓':'AGDP topology diagnostic ✗';
    (report.ok?console.info:console.error)(prefix,label,report);
    return report;
  }catch(error){
    const report={label:String(label||'manifold'),ok:false,exception:String(error&&error.message||error)};
    report.failureReasons=topologyFailureReasons(report);
    console.error('AGDP topology diagnostic ✗',label,report);
    return report;
  }
}
function cloneManifold(wasm,manifold){
  const mesh=manifoldToMesh(manifold);
  return meshToManifold(wasm,mesh.V,mesh.F);
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
  const baseWall = Math.max(AGDP_STRUCTURAL_WALL_MM, computedWall);
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
  const lateralOpsActive = opts.type==='ring'||opts.type==='bangle'||opts.type==='cuffBracelet'||opts.type==='earCuff'||opts.type==='pendantAnnularCore';
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
      // BUG FIX (confusión de eje radial/axial): outerOperationField
      // devuelve una cantidad RADIAL (cuánto se desvía el radio de la
      // superficie exterior decorada respecto al nominal, en este ángulo
      // t y altura z) -- puede ser fuertemente positiva por zoneMassDepth
      // o negativa por grooveDepth. Antes se sumaba directamente como
      // desplazamiento en el eje Z de la tapa lateral que cierra la banda
      // abierta. Confirmado numéricamente: con valores realistas de
      // organic/surfaceRelief, ese valor crudo alcanza varios mm y NO es
      // monótono en k, así que lateralTop/lateralBottom se plegaban sobre
      // sí mismos (Z subía y volvía a bajar dentro del mismo tramo) en vez
      // de barrer suavemente de radio interior a exterior -- una tapa
      // auto-intersectante, que es lo que producía triangulación
      // degenerada en cada boolean posterior (código compartido por
      // el núcleo anular del dije).
      // Arreglo: se acota la magnitud del desplazamiento axial con un
      // squash suave (tanh) a una fracción pequeña y fija del espesor
      // radial de la tapa, en vez de sumar el valor crudo sin control.
      // tanh satura suavemente y preserva la forma monótona de un solo
      // lóbulo que ya tenía "envelope" (cero en ambos extremos), así que
      // lateralField hereda esa monotonía por construcción, sin importar
      // cuán extremos sean zoneMassDepth o grooveDepth.
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

  // testing (forcing this off while varying every other decoration
  // independently) that it was the largest single contributor to severe
  // testing of the pin decoration alone (even with multiple pins) on a
  // simple band stayed clean -- meaning this is an interaction with the
  // piece's full real complexity, not reproducible standalone. This is a
  // mitigation matching the same "disable, don't keep chasing under
  // time pressure" approach taken for the hallmark engraving; a smaller
  // residual defect remains (worst case dropped from 6337 to 561 in
  // testing) and still needs dedicated root-cause investigation.
  const pinCount = cellularActive ? 0 : Math.round(p.screws||0);
  if (pinCount>0) {
    const pinR = Math.max(AGDP_MIN_WALL_MM*0.35, baseWall*0.16);
    for (let k=0;k<pinCount;k++) {
      const u = pinCount===1?.5:k/(pinCount-1);
      const t = -arcRad/2+arcRad*(0.15+0.7*u);
      const ct=Math.cos(t), st=Math.sin(t);
      // BUG FIX: this used to run the pin all the way from innerR (the
      // bore surface, where skin touches) out to the decorated outer
      // surface -- a full-thickness spike rather than a surface
      // decoration, visible as a protruding block on the inside of the
      // ring (confirmed via screenshot: pinCount pins showed as exactly
      // that many tabs inside the bore). Every other decoration in this
      // file embeds a modest, capped depth below the OUTER surface
      // instead of reaching toward the inner one; this now does the
      // same, capping the embed at a small multiple of the pin's own
      // radius regardless of how deep embedAtZ would otherwise allow.
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
      // Segment count reduced from 24 to 8: confirmed via direct,
      // isolated testing that the number of non-manifold edges produced
      // by this sphere's union with the band scales with the sphere's
      // OWN facet count (4 segments -> 1 defect, 24 -> 176, 96 -> 3065),
      // the opposite of what earlier "smoother reflections" tuning
      // assumed. Every additional facet on the sphere adds another
      // potential near-tangent crossing against the base mesh's own
      // faceting -- fewer facets means fewer chances for that. This
      // trades a slightly more faceted-looking bead for the piece
      // actually being printable, which is the more urgent priority.
      decorations.push(organicNodeAt(wasm,[rr*Math.cos(t),rr*Math.sin(t),nodeZ],sr,12,t+k*.73));
    }
  }
  // Hallmark engraving removed entirely per explicit request: the
  // curved-surface text approach produced catastrophic geometry damage
  // in production and there's no reason to keep dead code implementing
  // an approach that's been abandoned. A future hallmark, if pursued,
  // should be a completely different design (e.g. a small flat plate)
  // rather than text curved into the band's own surface.
  if (!closed) {
    const tEnd0=-arcRad/2, tEnd1=arcRad/2;
    [tEnd0, tEnd1].forEach(te => {
      const ct=Math.cos(te), st=Math.sin(te);
      const wallHere = localSurfaceRZ(te,0)-innerR;
      const ballR = Math.max(AGDP_MIN_WALL_MM*1.1, wallHere*0.62);
      // Shifted outward by an extra 0.15*ballR: the ball's innermost point
      // used to sit at EXACTLY innerR (tangent to the bore surface, not
      // overlapping past it) -- the same coincident-surface condition
      // confirmed to cause degenerate CSG results in the hallmark bug.
      // This guarantees genuine volumetric overlap with the solid band
      // instead of an ambiguous tangent touch.
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
      bodyManifold=safeDifference(wasm,bodyManifold, notchCutter);
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
    decorations.push(organicNodeAt(wasm,[massCenterR*hct,massCenterR*hst,0],massR,12,ht));
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
      bodyManifold=safeDifference(wasm,bodyManifold, thinCutter);
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
      erosionCutters.push(sphereAt(wasm,[erAdj*ect, erAdj*est, ez], esr, 24));
    }
    try{ bodyManifold=safeDifference(wasm,bodyManifold, unionAll(wasm, erosionCutters)); }
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
    decorations.push(organicNodeAt(wasm,[centerR*ect,centerR*est,0],dMassR,12,edgeT));
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
      // Compression rebuild: the old bodyManifold is pure-JS-deformed
      // above (no WASM calls), then rebuilt from scratch below -- the
      // old one must be explicitly freed or it leaks every time this
      // catch below still sees a valid bodyManifold if this throws.
      const oldBody = bodyManifold;
      bodyManifold=meshToManifold(wasm, mesh.V, mesh.F);
      try{ oldBody.delete(); }catch(e){}
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
      decorations.push(organicNodeAt(wasm,[rr*ct,rr*st,z],r,12,t+k*.41));
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
   different mesh topologies into one impossible function — each product
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
    // Embed deepened from 0.42 to 0.68 of the sphere's own radius: a
    // shallow embed against a thin dome shell (not a solid block) can
    // leave the sphere and shell surfaces nearly tangent at their
    // boundary, which is a classic source of sliver triangles and
    // jagged, unstable boolean seams -- independent of either surface's
    // own segment count. A deeper embed guarantees solid volumetric
    // overlap regardless of the shell's local thickness at that point.
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
// piece's secondary body reads. Ring, cufflinks, brooch — any
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
  /* AGDP v0.180 — pendant derived from the proven annular topology.
     The outer body uses the same continuous closed-band construction as a
     ring. The central void is functional as a sculptural field rather than
     a finger aperture, and every interior member is embedded into the band. */
  const {Manifold}=wasm;
  const targetEnvelope=clamp(p.mainSize||19,COMMERCIAL_DIMENSION_REFERENCE_LIMITS.pendant.circularBodyOuterDiameterMm.min,COMMERCIAL_DIMENSION_REFERENCE_LIMITS.pendant.circularBodyOuterDiameterMm.max);
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

  // Deformation removed per explicit request: the pendant core keeps its
  // natural, undeformed proportions (sx=sy=1) rather than being stretched
  // for silhouette variety.
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
    // Endpoints penetrate the annular body by `embed`, guaranteeing a true
    // volumetric union rather than tangent contact.
    parts.push(cylinderBetween(wasm,a,b,r,32));
  }

  // The main annulus carries the same generated radial field on its outer
  // and inner surfaces. No independent members are added inside the void.
  const phase=(p.variation?.phaseA||0)+polarity*(.18+.22*rng());
  const mode=(p.compositionSignature?.cadence||0)%4;

  // Suspension grows from the upper arc. Two shoulders and a crown overlap
  // the annular core deeply; the chain tunnel is cut only after union.
  const passageR=Math.max(.85,p.chainFitRadiusMm!=null?p.chainFitRadiusMm:1.35);
  const topY=outerR*sy;
  const tunnelWall=Math.max(AGDP_STRUCTURAL_WALL_MM,(p.minFeature||.8)*1.45,annularWall*.30);
  const crownOuterR=Math.max(passageR+tunnelWall,annularWall*1.28);

  // Rectilinear bail: the frame itself is the structural connection.
  // Its lower rail overlaps the pendant body directly, so no posts,
  // shoulders, saddle or auxiliary members are required.
  // Keep the lateral frame inside the actual depth envelope of the pendant.
  // This prevents the bail from becoming wider than the central body when
  // crownOuterR grows on small or highly architectural pieces.
  const frameOuterW=Math.min(crownOuterR*1.72,bandWidth*.94);
  const frameOuterH=crownOuterR*2.48;
  const lateralWall=Math.max(AGDP_STRUCTURAL_WALL_MM,(p.minFeature||.8)*1.08);
  const frameInnerW=Math.max(AGDP_MIN_WALL_MM*.8,Math.min(passageR*1.84,frameOuterW-lateralWall*2));
  const frameInnerH=passageR*2.26;
  const frameOverlap=Math.max(annularWall*.42,(p.minFeature||.8)*.55);
  // Lateral frame: its opening axis is X, so the chain passes from side to side.
  // Only the lower rail overlaps the outer crown of the pendant; no vertical
  // member enters the annular opening.
  const crownCenter=[0,topY+frameOuterH*.5-frameOverlap,0];
  const frameDepth=Math.max(annularWall*.72,(p.minFeature||.8)*1.35);
  // Robust CSG bail: an elliptical outer washer minus a longer elliptical
  // tunnel. Both primitives are generated by manifold-3d, so the passage is
  // guaranteed to remain open and no manually wound faces are involved.
  const bailSegN=192;
  const outerBail=Manifold.cylinder(frameDepth,1,1,bailSegN,true)
    .scale([frameOuterW*.5,frameOuterH*.5,1])
    .rotate([0,90,0])
    .translate(crownCenter);
  const innerBail=Manifold.cylinder(frameDepth+Math.max(AGDP_MIN_WALL_MM*2,.8),1,1,bailSegN,true)
    .scale([frameInnerW*.5,frameInnerH*.5,1])
    .rotate([0,90,0])
    .translate(crownCenter);
  const bailManifold=wasm.Manifold.difference(outerBail,innerBail);
  parts.push(bailManifold);

  let manifold=unionAll(wasm,parts);
  let mesh=manifoldToMesh(manifold);
  let preflight=validate(mesh.V,mesh.F,{type:'pendant-annular-preflight',minFeature:p.minFeature||.8,printProfile:p.printProfile||'silverPolished'});
  if(preflight.components!==1||!preflight.manifoldOK)throw new Error('AGDP annular pendant core failed continuity validation');

  // No passage subtraction: the chain opening already exists in the bail mesh.

  const finalMesh=manifoldToMesh(manifold);
  const finalAudit=validate(finalMesh.V,finalMesh.F,{type:'pendant',minFeature:p.minFeature||.8,printProfile:p.printProfile||'silverPolished'});
  if(!finalAudit.ok||finalAudit.components!==1)throw new Error('AGDP annular pendant failed structural validation');

  p.pendantBodyEnvelopeMm=targetEnvelope;
  p.pendantBodyWidthMm=finalAudit.bounds.dim[0];
  p.pendantBodyHeightMm=finalAudit.bounds.dim[1];
  p.pendantBodyDepthMm=finalAudit.bounds.dim[2];
  p.pendantSuspension='integratedLateralEllipticalCSGBailNoPosts';
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
  const targetEnvelope=COMMERCIAL_DIMENSION_REFERENCE_LIMITS.cufflinks.faceDiameterMm.nominal;
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
    mutation:{active:false,severity:0,mode:null},
    // High asymmetry (>=0.25, combined with organic>=0.40) activates the
    // band builder's "zone mass" feature -- an asymmetric volume bulge.
    // Diagnosed empirically (Node.js harness, 24 seeds): every crown
    // construction failure had asymmetry in [0.44, 0.50]. Zone-mass has
    // a SECOND, independent trigger (featureWeights.vessel>0.18) that
    // capping asymmetry alone does not block -- confirmed by testing:
    // failures persisted with asymmetry capped until vessel was also
    // capped. With both paths closed: 0 crown failures across 24 test
    // seeds (previously a frequent failure mode), vs. 4 failures in the
    // first 10-seed sample before this fix.
    asymmetry:Math.min(p.asymmetry||0,0.18),
    featureWeights:Object.freeze(Object.assign({},p.featureWeights||{},{vessel:Math.min((p.featureWeights&&p.featureWeights.vessel)||0,0.15)}))
  });
  const built=await buildBandGeometryManifold(wasm,crownParams,{
    type:'pendantAnnularCore',innerD:innerR*2,width:th,closed:true,opening:0
  });
  // Deformation removed per explicit request: the crown keeps its
  // natural, undeformed proportions (sx=sy=1). Rebuild from mesh rather
  // than retaining both a source and a transformed WASM object.
  const builtMesh=manifoldToMesh(built.manifold);
  try{ built.manifold.delete(); }catch(e){}
  const crown=meshToManifold(wasm,builtMesh.V,builtMesh.F);

  const crownMesh=manifoldToMesh(crown);
  const crownAudit=validate(crownMesh.V,crownMesh.F,{
    type:'cufflink-annular-crown',minFeature,printProfile:p.printProfile||'silverPolished'
  });
  if(!crownAudit.manifoldOK||crownAudit.components!==1||!crownAudit.finite){
    try{ crown.delete(); }catch(e){}
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
  const capBevel=Math.min(.34,capHeight*.16,minFeature*.32);
  const capFill=beveledEllipticalCylinderManifold(
    wasm,[0,0,capCenterZ],capHalfX,capHalfY,capHeight,capBevel,192
  );

  const structuralParts=[crown,capFill];

  function cylZ(cx,cy,rad,z0,z1){
    return cylinderBetween(wasm,[cx,cy,z0],[cx,cy,z1],rad,48);
  }

  /* Closed posterior finding. All joints overlap by at least one structural
     wall, preventing isolated components after boolean evaluation. */
  // Authentic fixed-back cufflink finding. The shank is deliberately slimmer
  // than the former pseudo-toggle post so the complete rigid finding can pass
  // through a French-cuff buttonhole without requiring a moving component.
  // Diameters: 4.0 mm at the front root, tapering to 3.3 mm through the usable
  // shank. The fixed terminal is an elongated transverse capsule: long
  // enough to retain the cuff reliably, but fully rounded so it can still be
  // inserted through the buttonhole by angling the rigid finding.
  const postRootRadius=Math.max(2.00,minFeature*.82);
  const postShaftRadius=Math.max(1.65,minFeature*.72);
  const postLength=clamp(
    Number.isFinite(p.cufflinkPostLengthMm) ? p.cufflinkPostLengthMm : 12.0,
    10.8,
    13.2
  );
  const postCurvatureRadius=50.0;
  const postTiltRad=3*Math.PI/180;
  const rootRadius=Math.max(2.35,postRootRadius*1.18,minFeature*1.35);
  const rootDepth=Math.max(2.8,minFeature*2.35);
  const terminalHalfLength=Math.max(6.00,minFeature*2.55);
  const terminalHalfWidth=Math.max(2.15,minFeature*.92);
  const terminalHalfThickness=Math.max(1.75,minFeature*.78);
  const terminalAttachmentOffset=Math.min(1.00,terminalHalfLength*.22);
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
    // BUG FIX (preventive, confirmed live risk): this used to be a chain of
    // independent cylinderBetween capsules (one per segment) with filler
    // spheres (postRadius*1.04) stitched at each joint to visually hide the
    // seam between them -- the same construction pattern diagnosed in the
    // a continuous crest, where a capsule's own radius exceeding the spacing
    // between consecutive path points produces blocky, self-intersecting
    // facets rather than a smooth continuous surface. Checked with this
    // function's own real constants (postRadius=2.6mm, spacing=postLength/
    // segments=1.5mm): ratio = 1.73x, ABOVE the 1.37x that already produced
    // visible faceting in a comparable crest before its fix -- so this was a
    // live risk in the post, not a hypothetical one. Replaced with a single
    // continuous tube (shared vertex rings between consecutive
    // cross-sections, same mechanism as variableEllipticalTubeMesh already
    // used for continuous crowns) which cannot develop this defect
    // regardless of radius/spacing ratio, and no longer needs the filler
    // spheres that were papering over the old seams.
    const segments=14;
    const postPathPts=[[root[0],root[1],rearFaceZ-rootDepth*.42]];
    for(let i=1;i<=segments;i++){
      const raw=cufflinkPostPoint(i/segments);
      postPathPts.push([raw[0],raw[1],raw[2]-rootDepth*.18]);
    }
    const postRadii=postPathPts.map((_,i)=>{
      const t=i/(postPathPts.length-1);
      const eased=t*t*(3-2*t);
      const rr=postRootRadius+(postShaftRadius-postRootRadius)*eased;
      return [rr,rr];
    });
    const postMesh=variableEllipticalTubeMesh(postPathPts, postRadii, 28, false);
    target.push(meshToManifold(wasm, postMesh.V, postMesh.F));

    // Elongated transverse capsule. The attachment is intentionally offset
    // by 1 mm from its geometric centre, keeping more material on the outer
    // retention side while bringing its centre of mass closer to the cuff.
    // A small tangent-direction overlap embeds the post inside the capsule so
    // the union remains one closed rigid solid without a narrow neck.
    const tip=postPathPts[postPathPts.length-1];
    const prev=postPathPts[postPathPts.length-2];
    const tx=tip[0]-prev[0],ty=tip[1]-prev[1],tz=tip[2]-prev[2];
    const tangentLength=Math.hypot(tx,ty,tz)||1;
    const ux=tx/tangentLength,uy=ty/tangentLength,uz=tz/tangentLength;
    const terminalCenter=[
      tip[0]-terminalAttachmentOffset+ux*terminalHalfThickness*.42,
      tip[1]+uy*terminalHalfThickness*.42,
      tip[2]+uz*terminalHalfThickness*.42
    ];
    const terminal=Manifold.sphere(1,48)
      .scale([terminalHalfLength,terminalHalfWidth,terminalHalfThickness])
      .translate(terminalCenter);
    target.push(terminal);
  }
  addFinding(structuralParts);

  if(featureIntensity(p,'interweave')>.58){
    const spokeR=Math.max(minFeature*.72,th*.11);
    structuralParts.push(cylinderBetween(wasm,[0,0,rearFaceZ+minFeature*.2],[r*.72,0,rearFaceZ+minFeature*.2],spokeR,24));
  }

  let unit=unionAll(wasm,structuralParts);

  /* Optional mutations are embedded deeply into the front skin. If a boolean
     does not remain closed, only that optional addition is discarded. */
  if(p.mutation&&p.mutation.active){
    const baseMesh=manifoldToMesh(unit);
    const frontVerts=baseMesh.V.filter(v=>v[2]>th*.05);
    const pool=frontVerts.length?frontVerts:baseMesh.V;
    // A fresh copy (not the live `unit` object) seeds the mutation
    // candidate, so `unit` itself is never consumed and remains a safe
    // fallback below if the mutated variant fails validation.
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
    try{ unit.delete(); }catch(e){}
    throw new Error('AGDP cufflink unit is not a single closed manifold');
  }

  const unitBounds=bounds(unitMesh.V);
  const minimumClearGapMm=12.0;
  const pairSpacing=Math.max(unitBounds.dim[0]+minimumClearGapMm,r*3.15,th*3.8);
  /* Each half of the pair is built from its own freshly-reconstructed
     manifold (via the mesh data already extracted above), rather than
     calling .translate() twice on the same live `unit` object. Calling a
     second transform on an object already consumed by an earlier one is
     what produced the WASM binding crashes seen here — rebuilding from
     V/F sidesteps the question entirely, since each half's manifold is
     transformed exactly once. */
  const leftSource=meshToManifold(wasm,unitMesh.V,unitMesh.F);
  const rightSource=meshToManifold(wasm,unitMesh.V,unitMesh.F);
  const leftUnit=leftSource.translate([-pairSpacing/2,0,0]);
  const rightUnit=rightSource.translate([pairSpacing/2,0,0]);
  try{ leftSource.delete(); }catch(e){}
  try{ rightSource.delete(); }catch(e){}
  const manifold=Manifold.union(leftUnit,rightUnit);
  try{ leftUnit.delete(); }catch(e){}
  try{ rightUnit.delete(); }catch(e){}
  try{ unit.delete(); }catch(e){}

  const pairMesh=manifoldToMesh(manifold);
  const pairAudit=validate(pairMesh.V,pairMesh.F,{
    type:'cufflinks',minFeature,printProfile:p.printProfile||'silverPolished',
    allowConstructiveOverlap:true,allowedSolids:2
  });
  if(!pairAudit.manifoldOK||pairAudit.components!==2||!pairAudit.finite){
    try{ manifold.delete(); }catch(e){}
    throw new Error('AGDP cufflink pair is not two closed consistently oriented solids');
  }

  p.cufflinkPairCenterSpacingMm=pairSpacing;
  p.cufflinkMinimumClearGapMm=minimumClearGapMm;
  p.cufflinkUnitComponents=unitAudit.components;
  p.cufflinkPairComponents=pairAudit.components;
  p.cufflinkPostLengthMm=postLength;
  p.cufflinkBackingType='fixedCurvedStudTransverseCapsule';
  p.cufflinkPostRootDiameterMm=postRootRadius*2;
  p.cufflinkPostShaftDiameterMm=postShaftRadius*2;
  p.cufflinkTerminalEnvelopeMm=[terminalHalfLength*2,terminalHalfWidth*2,terminalHalfThickness*2];
  p.cufflinkTerminalAttachmentOffsetMm=terminalAttachmentOffset;
  p.cufflinkCapFootprintMm=[capHalfX*2,capHalfY*2];
  p.cufflinkCapClosure='fullDeformedFootprint';
  p.cufflinkDnaSurface='+ZFrontOnly';
  return {manifold};
}

function flattenedNodeAt(wasm,center,rx,ry,rz,segments){
  const { Manifold }=wasm;
  return Manifold.sphere(1,segments||18).scale([rx,ry,rz]).translate(center);
}

function decorateBroochCapFront(wasm,p,capFill,capHalfX,capHalfY,capTopZ,minFeature){
  const { Manifold }=wasm;
  const domeI=featureIntensity(p,'dome');
  const vesselI=featureIntensity(p,'vessel');
  const cageI=featureIntensity(p,'cage');
  const wrappedI=featureIntensity(p,'wrapped');
  const interI=featureIntensity(p,'interweave');
  const effR=Math.max(minFeature*2.4,Math.min(capHalfX,capHalfY));
  const reliefDepth=clamp(effR*(.16+.18*Math.max(domeI,vesselI,cageI,wrappedI,interI)),1.2,4.2);
  const overlap=Math.max(.18,minFeature*.24);
  const parts=[];

  if(domeI>.08){
    const rr=effR*(.30+.24*domeI);
    parts.push(sphereAt(wasm,[0,0,capTopZ-overlap],rr,24).scale([1,1,.38+.28*domeI]));
  }
  if(vesselI>.08){
    const polarity=(p.variation?.offset||0)>=0?1:-1;
    const rr=effR*(.20+.22*vesselI);
    parts.push(sphereAt(wasm,[polarity*effR*.20,-effR*.09,capTopZ-overlap],rr,24).scale([1.16,.86,.44+.20*vesselI]));
  }
  if(cageI>.08){
    const barR=Math.max(AGDP_MIN_WALL_MM*.9,effR*(.045+.025*cageI));
    const span=effR*(.48+.20*cageI);
    parts.push(cylinderBetween(wasm,[-span,0,capTopZ-overlap],[span,0,capTopZ-overlap],barR,24));
    parts.push(cylinderBetween(wasm,[0,-span,capTopZ-overlap],[0,span,capTopZ-overlap],barR,24));
  }
  if(wrappedI>.08){
    const count=2+Math.round(wrappedI*2);
    for(let i=0;i<count;i++){
      const a=(p.variation?.phaseB||0)+i*Math.PI*2/count;
      const rr=effR*(.58+.07*Math.sin(a*2));
      const nr=Math.max(AGDP_MIN_WALL_MM*.9,effR*(.05+.035*wrappedI));
      parts.push(sphereAt(wasm,[Math.cos(a)*rr,Math.sin(a)*rr,capTopZ-overlap],nr,24));
    }
  }
  if(interI>.12){
    const r=Math.max(AGDP_MIN_WALL_MM*.75,effR*(.038+.026*interI));
    const span=effR*.66;
    parts.push(cylinderBetween(wasm,[-span*.72,-span*.38,capTopZ-overlap],[span*.72,span*.38,capTopZ-overlap],r,24));
    parts.push(cylinderBetween(wasm,[-span*.72,span*.38,capTopZ-overlap],[span*.72,-span*.38,capTopZ-overlap],r,24));
  }

  if(!parts.length) return capFill;

  // Restrict every added operation to the cap footprint and to the outward
  // side only. This keeps all new volume away from the rear mechanism.
  const margin=Math.max(minFeature*.34,AGDP_STRUCTURAL_WALL_MM*.22);
  const maskHalfX=Math.max(minFeature*1.8,capHalfX-margin);
  const maskHalfY=Math.max(minFeature*1.8,capHalfY-margin);
  const mask=Manifold.cylinder(reliefDepth+overlap*2,1,1,160,true)
    .scale([maskHalfX,maskHalfY,1])
    .translate([0,0,capTopZ+(reliefDepth-overlap*2)*.5]);
  const relief=Manifold.intersection(unionAll(wasm,parts),mask);
  return unionAll(wasm,[capFill,relief]);
}

// Shared by clip-like typologies (universal clip and related mechanisms, any
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
    const notch=sphereAt(wasm,[polarity*6.2*sx,-2.6*sy,0],3.2*Math.min(sx,sy),24).scale([1.08,.9,.75]);
    face=safeDifference(wasm,unionAll(wasm,[a,b,c]),notch);
  }else{
    const rot=(p.compositionSignature?.polarity||1)*(5+9*rng());
    let slab=Manifold.cube([faceW*.86,faceH*.79,faceTh],true).rotate([0,0,rot]);
    const lobe1=sphereAt(wasm,[faceW*.26,faceH*.14,0],faceH*.31,24).scale([1.20,.85,.55]);
    const lobe2=sphereAt(wasm,[-faceW*.28,-faceH*.16,0],faceH*.27,24).scale([.98,1.00,.52]);
    const voidCut=Manifold.cube([faceW*.18,faceH*.35,faceTh*1.8],true).rotate([0,0,-17]).translate([-faceW*.07,faceH*.045,0]);
    face=safeDifference(wasm,unionAll(wasm,[slab,lobe1,lobe2]),voidCut);
  }
  return face.translate([0,0,faceTh*.45]);
}


async function buildBroochBaseFromPendantOrCufflink(wasm,p,targetW,targetH,faceTh,rng){
  const { Manifold }=wasm;
  const minFeature=Math.max(.8,p.minFeature||.8);
  const source=rng()<.5?'pendant':'cufflink';
  const targetEnvelope=clamp(Math.min(targetW,targetH),source==='pendant'?23.5:15,source==='pendant'?40:25);
  const outerR=targetEnvelope*.5;
  const architectural=clamp(p.architectural||0,0,1);
  const I=(p.loadGraph&&p.loadGraph.intensities)||{node:.35};
  const annularWall=source==='pendant'
    ? clamp(targetEnvelope*(.105+.035*architectural+.025*I.node),3.2,6.2)
    : clamp(targetEnvelope*(.115+.030*architectural+.020*I.node),2.4,4.2);
  const innerR=Math.max(outerR-annularWall,outerR*(source==='pendant'?.48:.46));
  const bandWidth=Math.max(faceTh,minFeature*3.2);
  const baseParams=Object.assign({},p,{
    type:'pendantAnnularCore',
    mainSize:innerR*2,
    bandWidth,
    holes:source==='pendant'?Math.min(2,p.holes||0):0,
    railCount:source==='pendant'?Math.min(2,p.railCount||0):Math.min(1,p.railCount||0),
    crown:false,
    spikes:0,
    opening:0,
    mutation:source==='cufflink'?{active:false,severity:0,mode:null}:p.mutation,
    asymmetry:source==='cufflink'?Math.min(p.asymmetry||0,.18):p.asymmetry,
    featureWeights:source==='cufflink'
      ? Object.freeze(Object.assign({},p.featureWeights||{}, {vessel:Math.min((p.featureWeights&&p.featureWeights.vessel)||0,.15)}))
      : p.featureWeights
  });
  const built=await buildBandGeometryManifold(wasm,baseParams,{
    type:'pendantAnnularCore',innerD:innerR*2,width:bandWidth,closed:true,opening:0
  });
  let base=built.manifold;

  // Every brooch base receives a full posterior cap, including bases derived
  // from the pendant annulus. Without it, the rear clip remains visible
  // through the central opening and the piece reads as mechanically exposed.
  const crownMesh=manifoldToMesh(base);
  const crownAudit=validate(crownMesh.V,crownMesh.F,{
    type:'brooch-'+source+'-crown',minFeature,printProfile:p.printProfile||'silverPolished'
  });
  if(!crownAudit.manifoldOK||crownAudit.components!==1||!crownAudit.finite){
    throw new Error('AGDP brooch '+source+'-derived crown is not a closed manifold');
  }
  const capDepth=Math.max(2.2,bandWidth*.46,minFeature*2.4);
  const rearFaceZ=-bandWidth*.5;
  const posteriorFlattenZ=-Math.max(minFeature*.22,bandWidth*.08);
  const capTopZ=posteriorFlattenZ;
  const capBottomZ=rearFaceZ-capDepth*.58;
  const capHeight=capTopZ-capBottomZ;
  const capCenterZ=(capTopZ+capBottomZ)*.5;
  const footprintOverlap=Math.max(minFeature*.48,AGDP_STRUCTURAL_WALL_MM*.32);
  const crownHalfX=Math.max(Math.abs(crownAudit.bounds.min[0]),Math.abs(crownAudit.bounds.max[0]));
  const crownHalfY=Math.max(Math.abs(crownAudit.bounds.min[1]),Math.abs(crownAudit.bounds.max[1]));
  const capHalfX=crownHalfX+footprintOverlap;
  const capHalfY=crownHalfY+footprintOverlap;
  const capBevel=Math.max(.20,Math.min(.42,minFeature*.34,capHeight*.18));
  let capFill=beveledEllipticalCylinderManifold(
    wasm,[0,0,capCenterZ],capHalfX,capHalfY,capHeight,capBevel,192
  );
  capFill=decorateBroochCapFront(wasm,p,capFill,capHalfX,capHalfY,capTopZ,minFeature);
  base=unionAll(wasm,[base,capFill]);

  const baseMesh=manifoldToMesh(base);
  const baseBounds=bounds(baseMesh.V);
  const sx=targetW/Math.max(1e-6,baseBounds.dim[0]);
  const sy=targetH/Math.max(1e-6,baseBounds.dim[1]);
  base=base.scale([sx,sy,1]);

  const finalMesh=manifoldToMesh(base);
  const finalAudit=validate(finalMesh.V,finalMesh.F,{
    type:'brooch-'+source+'-derived-base',minFeature,printProfile:p.printProfile||'silverPolished'
  });
  if(!finalAudit.manifoldOK||finalAudit.components!==1||!finalAudit.finite){
    throw new Error('AGDP brooch '+source+'-derived base failed continuity validation');
  }
  return {manifold:base,source};
}

async function makeBroochClipManifold(wasm,p){
  const { Manifold }=wasm;
  const rng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|brooch-clip-face');

  // The visible brooch base is restricted to the two established AGDP
  // typologies requested for this pipeline: pendant body or cufflink crown.
  // No slab, isolated sphere, amorphous cluster or generic three-mode face
  // is permitted in the brooch path.
  const faceW=COMMERCIAL_DIMENSION_REFERENCE_LIMITS.brooch.faceWidthMm.nominal;
  const faceH=COMMERCIAL_DIMENSION_REFERENCE_LIMITS.brooch.faceHeightMm.nominal;
  const flapT=clamp(p.clipThicknessMm||2.0,1.8,2.3);
  const faceTh=Math.max(3.6,flapT*1.9);
  const baseBuild=await buildBroochBaseFromPendantOrCufflink(wasm,p,faceW,faceH,faceTh,rng);
  const face=baseBuild.manifold;

  const faceMesh=manifoldToMesh(face);
  const faceBounds=bounds(faceMesh.V);
  const faceBackZ=faceBounds.min[2];

  // SIMPLE MONOBLOC FLAP
  // The visible face remains untouched. A broad hidden backer is embedded
  // into the rear of the face and carries one cantilever tongue. There is no
  // hinge, pin, catch, return tube, articulated support or simulated clasp.
  const gap=clamp(p.clipGapMm||2.6,2.2,3.2);
  const flapL=clamp(p.clipSpringLengthMm||faceW*.62,faceW*.52,faceW*.70);
  const flapW=clamp(p.clipWidthMm||faceH*.20,6.0,8.0);
  const rootL=clamp(flapT*2.25,4.2,5.4);

  // The backer deliberately crosses a wide central area. This makes the
  // attachment independent of a single local point on amorphous, annular or
  // rotated faces. Its front portion is buried inside the generated face.
  const embedDepth=clamp(faceTh*.30,1.05,1.45);
  const backerT=clamp(flapT*.95,1.8,2.2);
  const backerW=Math.min(faceW*.66,Math.max(flapL+3.0,19.0));
  const backerH=Math.min(faceH*.34,Math.max(flapW+3.2,9.0));
  const backerDepth=backerT+embedDepth;
  const backerZ=faceBackZ+(embedDepth-backerT)/2;
  const mechanismBevel=Math.min(.28,backerT*.14);
  let backer=beveledRoundedRectPrismManifold(
    wasm,[0,0,backerZ],backerW,backerH,backerDepth,
    Math.min(1.15,backerH*.13),mechanismBevel,14
  );

  // Reject a face/backer pair that does not share real volume. This prevents
  // removeFloatingComponents() from silently discarding the mechanism later.
  const faceBackerOverlap=Manifold.intersection(face,backer);
  const faceBackerOverlapMesh=manifoldToMesh(faceBackerOverlap);
  const faceBackerOverlapVolumeMm3=Math.abs(meshVolumeMm3(faceBackerOverlapMesh.V,faceBackerOverlapMesh.F));
  try{ faceBackerOverlap.delete(); }catch(e){}
  const MIN_FACE_BACKER_OVERLAP_MM3=2.0;
  if(!Number.isFinite(faceBackerOverlapVolumeMm3)||faceBackerOverlapVolumeMm3<MIN_FACE_BACKER_OVERLAP_MM3){
    try{ face.delete(); }catch(e){}
    try{ backer.delete(); }catch(e){}
    throw new Error('AGDP brooch face/backer overlap below structural minimum');
  }

  const backerRearZ=faceBackZ-backerT;
  const flapTopZ=backerRearZ-gap;
  const flapCenterZ=flapTopZ-flapT/2;
  const overlapIntoBacker=clamp(flapT*.48,.85,1.10);
  const rootDepth=gap+flapT+overlapIntoBacker;
  const rootFrontZ=backerRearZ+overlapIntoBacker;
  const rootZ=rootFrontZ-rootDepth/2;
  const rootX=-flapL/2+rootL/2;
  const root=beveledRoundedRectPrismManifold(
    wasm,[rootX,0,rootZ],rootL,flapW,rootDepth,
    Math.min(.75,flapW*.12),Math.min(.24,flapT*.12),12
  );

  // The tongue overlaps the root longitudinally. A slight upward rake at the
  // free end provides pressure while preserving an open usable throat.
  const tongueStartX=rootX+rootL*.38;
  const freeX=flapL/2;
  const tongueL=freeX-tongueStartX;
  const tongueCenterX=(tongueStartX+freeX)/2;
  const rise=Math.min(.50,gap*.18);
  const angleDeg=Math.atan2(rise,Math.max(1,tongueL))*180/Math.PI;
  const tongue=beveledRoundedRectPrismManifold(
    wasm,[0,0,0],tongueL,flapW,flapT,
    Math.min(.72,flapW*.12),Math.min(.22,flapT*.11),12
  ).rotate([0,-angleDeg,0])
   .translate([tongueCenterX,0,flapCenterZ+rise/2]);

  // A modest terminal pressure pad is fused to the same tongue. It does not
  // close against the face and does not imitate a separate catch.
  const padL=Math.max(2.8,flapT*1.55);
  const padW=Math.min(flapW+.8,8.6);
  const pad=beveledRoundedRectPrismManifold(
    wasm,[0,0,0],padL,padW,flapT,
    Math.min(.78,padW*.13),Math.min(.22,flapT*.11),12
  ).rotate([0,-angleDeg,0])
   .translate([freeX-padL/2,0,flapCenterZ+rise]);

  const flapAssembly=unionAll(wasm,[root,tongue,pad]);
  const backerFlapOverlap=Manifold.intersection(backer,flapAssembly);
  const backerFlapOverlapMesh=manifoldToMesh(backerFlapOverlap);
  const backerFlapOverlapVolumeMm3=Math.abs(meshVolumeMm3(backerFlapOverlapMesh.V,backerFlapOverlapMesh.F));
  try{ backerFlapOverlap.delete(); }catch(e){}
  const MIN_BACKER_FLAP_OVERLAP_MM3=1.0;
  if(!Number.isFinite(backerFlapOverlapVolumeMm3)||backerFlapOverlapVolumeMm3<MIN_BACKER_FLAP_OVERLAP_MM3){
    try{ face.delete(); }catch(e){}
    try{ backer.delete(); }catch(e){}
    try{ flapAssembly.delete(); }catch(e){}
    throw new Error('AGDP brooch backer/flap overlap below structural minimum');
  }

  let manifold=unionAll(wasm,[face,backer,flapAssembly]);

  // Confirm the brooch core is one connected solid before any downstream
  // cleanup can conceal a disconnected flap.
  const coreMesh=manifoldToMesh(manifold);
  const canonicalCore=canonicalizeMeshForValidation(coreMesh.V,coreMesh.F,1e-5);
  const coreConnectivity=removeFloatingComponents(canonicalCore.V,canonicalCore.F,1);
  if(coreConnectivity.totalComponents!==1||coreConnectivity.retainedComponents!==1||coreConnectivity.discarded.length){
    try{ manifold.delete(); }catch(e){}
    throw new Error('AGDP brooch mechanism is not a single connected solid');
  }

  // Preserve the v28 hypertrophy behavior and seed namespace. It remains
  // confined to the visible face and does not alter the mechanism dimensions.
  if(p.mutation&&p.mutation.active&&p.mutation.mode==='hypertrophy'){
    const sv=p.mutation.severity;
    const hRng=window.SeededVariation.createGenerator(String(p.seed||'AGDP')+'|brooch-clip-hypertrophy');
    const fx=(hRng()*2-1)*faceW*.28;
    const fy=(hRng()*2-1)*faceH*.28;
    const massR=Math.max(faceTh*.9,faceTh*(1+.9*sv));
    const mutationMass=sphereAt(wasm,[fx,fy,faceTh*.35+massR*.3],massR,24);
    const merged=Manifold.union(manifold,mutationMass);
    try{ manifold.delete(); }catch(e){}
    try{ mutationMass.delete(); }catch(e){}
    manifold=merged;
  }

  p.clipFaceWidthMm=faceW;
  p.clipFaceHeightMm=faceH;
  p.clipEffectiveClearanceMm=gap-rise;
  p.clipFaceBackZMm=faceBackZ;
  p.broochFaceBackerOverlapVolumeMm3=faceBackerOverlapVolumeMm3;
  p.broochBackerFlapOverlapVolumeMm3=backerFlapOverlapVolumeMm3;
  p.broochClosureType='integratedCantileverFlap';
  p.broochConstruction='singlePrintedSolid';
  p.broochArticulatedParts=0;
  p.broochAssemblyRequired=false;
  p.broochBaseSource=baseBuild.source;
  p.broochBaseGeometry=baseBuild.source==='pendant'?'pendantAnnularBody':'cufflinkClosedCrown';
  p.broochGeneratorVersion='brooch-v8-universal-cap-csg-bail';
  return {manifold,bandW:Math.max(faceW,faceH)};
}

const AGDP_SILVER_HOLLOWING=Object.freeze({
  manufacturingProfile: SHAPEWAYS_SILVER_925,
  conservativeShellWallMm:Object.freeze({
    bangle:1.7,
    cuffBracelet:1.8,
    earCuff:0.85
  }),
  escapeHoleDiameterMm:2.4,
  escapeHoleCount:SHAPEWAYS_SILVER_925.escapeHolesMm.preferredCount,
  thresholdsGrams:Object.freeze({
    ring:Object.freeze({hollowAt:Infinity,rejectAbove:38}),
    pendant:Object.freeze({hollowAt:Infinity,rejectAbove:110}),
    bangle:Object.freeze({hollowAt:125,rejectAbove:190}),
    cuffBracelet:Object.freeze({hollowAt:115,rejectAbove:180}),
    cufflinks:Object.freeze({hollowAt:Infinity,rejectAbove:80}),
    earCuff:Object.freeze({hollowAt:22,rejectAbove:42}),
    brooch:Object.freeze({hollowAt:Infinity,rejectAbove:75}),
    hoopEarring:Object.freeze({hollowAt:Infinity,rejectAbove:26})
  })
});
window.AGDP_SILVER_HOLLOWING=AGDP_SILVER_HOLLOWING;

function silverWeightProfileKey(p){ return p.type; }
function manifoldBounds(manifold){
  const mesh=manifoldToMeshHelper(manifold);
  return {mesh,b:bounds(mesh.V)};
}
function applyConservativeSilverHollowing(wasm,manifold,p){
  if(p.type==='brooch'){
    p.silverHollowingApplied=false;
    p.silverWeightProfile=silverWeightProfileKey(p);
    return manifold;
  }
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
  // The upper clamp caps how close the inner cavity's scale can get to 1
  // (a safety margin against near-total hollowing). At .94 this works
  // as a margin for compact pieces (bangle/cuffBracelet), but for large
  // (d-2*wall)/d is ITSELF already above .94 for any reasonable wall,
  // so .94 silently became the active constraint rather than a safety
  // margin -- capping achievable reduction to ~20% regardless of wall,
  // with correct dimensions (diagnosed via Node.js harness). Raising
  // the ceiling for these two types lets the real wall-based formula
  // govern instead of the safety cap.
  const scaleCeiling=.94;
  const scale=dim.map(d=>clamp((d-2*wall)/d,.15,scaleCeiling));
  let inner=manifold.translate(center.map(v=>-v)).scale(scale).translate(center);
  let hollowed;
  try{ hollowed=wasm.Manifold.difference(manifold,inner); }
  catch(e){ return manifold; }

  // Two opposing 2.4 mm escape holes exceed Shapeways' 2.0 mm multiple-hole
  // minimum. REDESIGNED placement: every rail, node, and relief feature in
  // this codebase is added to the OUTER radius of the band (never the
  // inner, skin-facing surface -- confirmed by reading buildBandGeometry-
  // Manifold's decoration code). The original heuristic picked "low"
  // vertices by Z-coordinate, which had no way to know whether that point
  // sat on a rail or node, producing perforations that read as visual
  // defects. Selecting by SMALLEST radial distance from the central axis
  // (hypot(x,y)) instead guarantees the candidates are inner-wall points,
  // which are always plain by construction -- verified in a Node.js
  const candidates=before.mesh.V.slice().sort((a,bv)=>Math.hypot(a[0],a[1])-Math.hypot(bv[0],bv[1]));
  const innerMost=candidates.slice(0,Math.max(24,Math.floor(candidates.length*.12)));
  function pick(side){
    const set=innerMost.filter(v=>side<0?v[0]<center[0]:v[0]>=center[0]);
    const pool=set.length?set:innerMost;
    // Among inner-wall candidates on this side, prefer one nearer the
    // vertical/Z center of the piece -- keeps the hole away from the
    // terminal ends of an open band.
    return pool.reduce((best,v)=>Math.abs(v[2]-center[2])<Math.abs(best[2]-center[2])?v:best,pool[0]);
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
  // is tight relative to its physical size even at the manufacturing
  // wall-thickness floor (0.8mm) -- see note in AGDP_SILVER_HOLLOWING
  // below about this being a product/threshold question, not purely an
  // engineering one.
  const reduction=1-finalWeight/Math.max(initialWeight,1e-6);
  const reductionCeiling=.90;
  if(!Number.isFinite(finalWeight)||reduction<.18||reduction>reductionCeiling)return manifold;
  const topo=topologyAudit(after.mesh.V,after.mesh.F);
  if(!topo.manifoldOK)return manifold;

  p.silverHollowingApplied=true;
  p.silverRequestedShellWallMm=wall;
  p.silverShellMethod='scaledInternalDuplicate';
  p.silverShellThicknessVerified=false;
  p.silverEscapeHoleDiameterMm=AGDP_SILVER_HOLLOWING.escapeHoleDiameterMm;
  p.silverEscapeHoleCount=2;
  p.silverWeightAfterHollowingG=finalWeight;
  p.silverWeightReductionRatio=reduction;
  return hollowed;
}

// =============================================================================
// BROOCH — one-piece solid spring clip
// The visible face comes from the same shared AGDP face vocabulary used by
// pendants and cufflinks. The rear clip is a continuous, non-articulated
// silver body: no hinge, pin, separate catch, trapped part or assembly.
// =============================================================================

// =============================================================================
// HOOP EARRING — v1
// Two elements: hook (fixed, safety-driven) + body/crown (decorated,
// reusing makeFaceManifold -- the same shared face builder pendant and
// cufflinks already use, so this typology's decoration vocabulary is
// consistent with the rest of the line rather than a one-off).
//
// Safety/manufacturing basis (see chat history for sources):
//   - Hook free-tip diameter: 1.3mm. Commercial jewelry commonly uses
//     18-20 gauge (1.0-0.8mm) DRAWN wire for earring posts, but this
//     piece is CAST silver, not drawn wire -- cast silver is structurally
//     weaker per unit thickness than drawn wire at the same gauge, and
//     Shapeways' own unsupported-wire floor for cast silver is 1.0mm
//     (the free tip qualifies as unsupported: connected on one side only).
//     1.3mm sits meaningfully above that floor rather than exactly at it,
//     specifically because the insertion tip takes repeated mechanical
//     stress (insertion/removal) that a decorative surface does not.
//   - Closure: "click-top" / endless-hoop mechanism -- the hook's own free
//     end press-fits into a small hollow socket on the body, rather than
//     a separate hinge or clasp. This avoids Shapeways' "Interlocking:
//     Not Supported" and "Sprues: Not Supported" restrictions, since the
//     socket and hook are cast as ONE continuous solid (the hoop is a
//     single closed ring shape, not two parts that interlock after the
//     fact) -- the "click" happens at the wearer's own assembly when they
//     flex the hoop open slightly to put it on, exactly like a real
//     endless hoop.
//   - Hoop outer diameter: 20-40mm, matching the commercial standard
//     range for everyday hoop earrings.
// =============================================================================
// =============================================================================
// HOOP EARRING — integrated French-hook pair
// The decorated annular body and the hook are generated as one printable
// solid per earring. The hook uses a conventional insertion diameter and a
// buried, enlarged root transition so its union with the body has measurable
// volume rather than a merely tangential contact. The exported pair contains
// two identical front-facing copies for the customer preview.
// =============================================================================
function makeHoopEarringManifold(wasm, p){
  // Commercial configurator policy, expressed in millimetres. This is a
  // product range rather than a claim of one universal international size.
  const HOOP_BODY_MIN_OD_MM = COMMERCIAL_DIMENSION_REFERENCE_LIMITS.hoopEarring.outerDiameterMm.min;
  const HOOP_BODY_MAX_OD_MM = COMMERCIAL_DIMENSION_REFERENCE_LIMITS.hoopEarring.outerDiameterMm.max;
  const HOOP_BODY_DEFAULT_OD_MM = 24;
  const HOOK_TIP_R_MM = 0.45;        // 0.90 mm insertion diameter
  const HOOK_SHAFT_R_MM = 0.58;
  const HOOK_ROOT_R_MM = 1.00;
  const HOOK_ROOT_OVERLAP_MM = 1.50;
  const HOOK_MIN_OVERLAP_VOLUME_MM3 = 0.45;
  const HOOK_RISE_MM = 6.2;
  const HOOK_BEND_R_MM = 5.2;
  const HOOK_INSERTION_MM = 12.0;
  const HOOK_TAIL_FLARE_MM = 0.9;
  const BODY_SPAN_MM = clamp(Number.isFinite(p.mainSize)?p.mainSize:HOOP_BODY_DEFAULT_OD_MM, HOOP_BODY_MIN_OD_MM, HOOP_BODY_MAX_OD_MM);
  const BODY_DEPTH_MM = clamp(Number.isFinite(p.bandWidth)?p.bandWidth:3.6, COMMERCIAL_DIMENSION_REFERENCE_LIMITS.hoopEarring.axialWidthMm.min, COMMERCIAL_DIMENSION_REFERENCE_LIMITS.hoopEarring.axialWidthMm.max);

  return (async () => {
    const I=(p.loadGraph&&p.loadGraph.intensities)||{bridge:.35,void:.25,node:.35,suspension:.3,continuity:.75,organism:.5};
    const architectural=clamp(p.architectural||0,0,1);
    const outerR=BODY_SPAN_MM*.5;
    const annularWall=clamp(BODY_SPAN_MM*(.105+.035*architectural+.025*I.node),3.2,6.2);
    const innerR=Math.max(outerR-annularWall,outerR*.48);
    const bandWidth=Math.max(BODY_DEPTH_MM,(p.minFeature||.8)*3.2);
    const ringParams=Object.assign({},p,{
      type:'pendantAnnularCore', mainSize:innerR*2, bandWidth,
      holes:Math.min(2,p.holes||0), railCount:Math.min(2,p.railCount||0),
      nodes:0, rivets:0, screws:0, crown:false, spikes:0, opening:0
    });
    const built=await buildBandGeometryManifold(wasm,ringParams,{
      type:'pendantAnnularCore',innerD:innerR*2,width:bandWidth,closed:true,opening:0
    });
    let bodyManifold=built.manifold.rotate([0,90,0]);

    // Nodules are fused as overlapping rounded volumes only. No capped
    // cylinders, tangent contacts or local cutters are used in this typology.
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

    // Build one uninterrupted hook sweep with a buried root. The first
    // section travels through real annular material before emerging from the
    // body, creating a measurable overlap volume and a gradual neck instead
    // of a tangential point contact.
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

    // Audit the actual shared volume before union. Connectivity alone cannot
    // distinguish a robust root from a hairline neck, so reject any seed whose
    // body/hook intersection falls below the structural threshold.
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
  const removedTypes = new Set(['choker', 'headpiece', 'comb', 'moneyClip']);
  if (removedTypes.has(inputParams?.type)) {
    throw new Error('AGDP typology removed from catalog: ' + inputParams.type);
  }
  const p = window.GenerationLayers.compile(Object.assign({}, inputParams));
  if (removedTypes.has(p.type)) {
    throw new Error('AGDP typology removed from catalog: ' + p.type);
  }
  if (p.type==='ring') {
    p.mainSize=clamp(Number.isFinite(p.mainSize)?p.mainSize:18,
      COMMERCIAL_DIMENSION_REFERENCE_LIMITS.ring.innerDiameterMm.min,
      COMMERCIAL_DIMENSION_REFERENCE_LIMITS.ring.innerDiameterMm.max);
    p.bandWidth=clamp(Number.isFinite(p.bandWidth)?p.bandWidth:3.6,
      COMMERCIAL_DIMENSION_REFERENCE_LIMITS.ring.bandWidthMm.min,
      COMMERCIAL_DIMENSION_REFERENCE_LIMITS.ring.bandWidthMm.max);
  } else if (p.type==='bangle') {
    p.mainSize=clamp(Number.isFinite(p.mainSize)?p.mainSize:60,
      COMMERCIAL_DIMENSION_REFERENCE_LIMITS.bracelet.circularEquivalentDiameterMm.min,
      COMMERCIAL_DIMENSION_REFERENCE_LIMITS.bracelet.circularEquivalentDiameterMm.max);
    p.bandWidth=clamp(Number.isFinite(p.bandWidth)?p.bandWidth:4.8,
      COMMERCIAL_DIMENSION_REFERENCE_LIMITS.bracelet.bandWidthMm.min,
      COMMERCIAL_DIMENSION_REFERENCE_LIMITS.bracelet.bandWidthMm.max);
  }
  let manifold;
  if (p.type==='pendant') {
    ({manifold} = await makePendantManifold(wasm, p));
  } else if (p.type==='cufflinks') {
    ({manifold} = await makeCufflinksManifold(wasm, p));
  } else if (p.type==='brooch') {
    ({manifold} = await makeBroochClipManifold(wasm, p));
  } else if (p.type==='hoopEarring') {
    ({manifold} = await makeHoopEarringManifold(wasm, p));
  } else {
    const topology = p.topology;
    const type = p.type==='ring'?'ring':p.type;
    ({manifold} = await buildBandGeometryManifold(wasm, p, {
      type, innerD:p.mainSize, width:p.bandWidth,
      closed: topology.closed, opening: topology.closed?0:topology.opening
    }));
  }
  manifold=applyConservativeSilverHollowing(wasm,manifold,p);

  let V, F;
  if(p.type==='hoopEarring') {
    // Validate the generated unit before duplication. A hoop earring must be
    // one closed connected solid; exporting a disconnected unit twice merely
    // turns one construction defect into several STL components.
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
  } else {
    ({ V, F } = manifoldToMeshHelper(manifold));
    try{ manifold.delete(); }catch(e){}
    manifold = null;
  }

  const expectedComponents = (p.type==='cufflinks'||p.type==='hoopEarring') ? 2 : 1;
  // Never repair topology by deleting triangles or connected components.
  // That strategy can turn a defective boolean result into a visibly open
  // mesh. Preserve the generated mesh intact and reject it instead, so a
  // broken ring or ear cuff can never be exported with artificial holes.
  const connectivityProbe = removeFloatingComponents(V, F, Math.max(expectedComponents, F.length||1));
  if(connectivityProbe.totalComponents!==expectedComponents){
    throw new Error('AGDP topology rejected: expected '+expectedComponents+' connected solid(s), found '+connectivityProbe.totalComponents+'. No geometry was deleted.');
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
  audit.requestedShellWallMm=p.silverRequestedShellWallMm||null;
  audit.shellMethod=p.silverShellMethod||null;
  audit.shellThicknessVerified=!!p.silverShellThicknessVerified;
  audit.escapeHoleDiameterMm=p.silverEscapeHoleDiameterMm||null;
  audit.escapeHoleCount=p.silverEscapeHoleCount||0;
  audit.weightBeforeHollowingG=p.silverWeightBeforeHollowingG||audit.silverG;
  if(!audit.weightOK){
    audit.ok=false;
    audit.warning='FALLA: masa de plata superior al límite ergonómico y económico';
  }
  audit.discardedComponents = [];
  audit.componentDeletionPolicy = 'disabled-reject-instead';
  // Exposes the fully-compiled internal params object (p), not just the
  // caller's pre-compile() input -- type-specific builders (brooch,
  // hoopEarring) write derived dimensions directly onto this object
  // (p.clipFaceWidthMm, p.hoopHookTipDiameterMm, etc.) so the UI
  // layer can display them without recomputing anything. Previously only
  // {V,F,audit,bandW,innerR} were returned, so none of those fields were
  // ever actually reachable by ui.js (which only ever had its OWN
  // pre-compile params object) -- silently broken for brooch and hoopEarring without this fix.
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
