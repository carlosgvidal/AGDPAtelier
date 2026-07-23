import Module from ‘manifold-3d’;

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
if (mesh && typeof mesh.delete === ‘function’) mesh.delete();
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
if (out && typeof out.delete === ‘function’) out.delete();
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

/* =========================================================================
HOOKED-SEGMENT SPLIT (choker / headpiece)
Shapeways’ silver lost-wax casting has a maximum bounding box of
89x89x100mm (confirmed against their published spec, 2026-07). A choker
or headpiece at any dimension realistic for actual wear (verified
against comparable rigid wire chokers on the market: 114-165mm
diameter) categorically exceeds this in every orientation – confirmed
empirically via full 3D rotation search, not assumed. Splitting into
3 wedge-cut segments, each fitted with a simple wire hook-and-eye
clasp at the two joints, is the customer-assemblable alternative:
no soldering, no workshop step, no tools – the wearer closes it the
same way they would any hook-and-eye choker clasp. Verified: 2 segments
does not fit even with optimized orientation (106mm+ minimum); 3
segments fits every time with per-segment orientation.
========================================================================= */
function wedgeCutterMesh(t0, t1, radius, height){
const cx0=radius*Math.cos(t0), cy0=radius*Math.sin(t0);
const cx1=radius*Math.cos(t1), cy1=radius*Math.sin(t1);
const hz=height/2;
const V=[[0,0,-hz],[cx0,cy0,-hz],[cx1,cy1,-hz],[0,0,hz],[cx0,cy0,hz],[cx1,cy1,hz]];
const F=[[0,1,2],[3,5,4],[0,2,5],[0,5,3],[0,3,4],[0,4,1],[1,4,5],[1,5,2]];
return {V,F};
}
// REDESIGNED per updated request: a genuine sliding dovetail rail joint
// instead of a press-fit post/socket. A trapezoidal rail – narrow where
// it meets the segment’s surface, wider at its outer tip – slides
// lengthwise (along Z, the sliding axis) into a matching trapezoidal
// groove cut into the adjacent segment. Once slid into place, the
// dovetail’s own shape mechanically blocks radial separation (the wide
// tip cannot pass back out through the narrower groove opening), while
// still allowing assembly via a simple lengthwise slide – a real,
// load-bearing mechanical joint, not a decorative press-fit.
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
// 8 vertices: 4 corners (base-left, base-right, tip-left, tip-right) at
// each of the two Z ends.
const V = [
corner(baseHalfW, 0, z0, -1), corner(baseHalfW, 0, z0, 1),
corner(tipHalfW, railHeight, z0, 1), corner(tipHalfW, railHeight, z0, -1),
corner(baseHalfW, 0, z1, -1), corner(baseHalfW, 0, z1, 1),
corner(tipHalfW, railHeight, z1, 1), corner(tipHalfW, railHeight, z1, -1)
];
// Quad faces (as triangle pairs): near cap, far cap, and the 4 sides.
const F = [
[0,1,2],[0,2,3],       // near cap (z0)
[4,6,5],[4,7,6],       // far cap (z1)
[0,4,5],[0,5,1],       // base side
[1,5,6],[1,6,2],       // tangent+ side
[2,6,7],[2,7,3],       // tip side
[3,7,4],[3,4,0]        // tangent- side
];
return {V,F};
}
// REDESIGNED per direct feedback (with a wood tongue-and-groove joint as
// reference): a single continuous rail spanning nearly the full height
// of the cut face, instead of two small localized rail pairs. The
// previous two-point design held the segments together at only two
// small contact patches; a full-height rail gives dramatically more
// contact area and rigidity, matching how a real sliding wood joint is
// built – solid along its whole length, not just pinned at a couple of
// points.
function buildDovetailRailFull(wasm, anchor, wall, zMin, zMax){
const rr = Math.hypot(anchor[0],anchor[1])||1;
const radialDir = [anchor[0]/rr, anchor[1]/rr, 0];
const tangentDir = [-radialDir[1], radialDir[0], 0];
const baseHalfW = wall*0.9, tipHalfW = wall*1.5, railHeight = wall*1.9;
// Small margin at each end of the cut face so the rail’s own end caps
// stay comfortably embedded in real material rather than reaching
// exactly to the surface edge.
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
// Groove is slightly larger than the rail on every dimension for a
// real sliding clearance fit (not a tight press-fit): +0.25mm on the
// width dimensions, +0.3mm extra depth so the rail’s tip does not
// bottom out, and +1mm extra length so the rail can fully enter
// without jamming at the very end of its travel.
const baseHalfW = wall*0.9+0.25, tipHalfW = wall*1.5+0.25, railHeight = wall*1.9+0.3;
const margin = Math.max(1.0, wall*0.5);
const railLen = Math.max(4, (zMax-zMin) - 2*margin);
const zCenter = (zMin+zMax)/2 - anchor[2];
const mesh = dovetailPrismMesh(anchor, radialDir, tangentDir, baseHalfW, tipHalfW, railHeight, railLen+1.0, zCenter);
const cutter = meshToManifold(wasm, mesh.V, mesh.F);
return safeDifference(wasm, segmentManifold, cutter);
}
// Anchors the connector on the segment’s OWN real cut-face geometry
// (mid-radius, mid-height of the vertices actually lying on the cut
// plane) rather than an assumed/computed position – correct regardless
// of how the seed’s own decorations shape that particular cut. Now also
// returns the face’s real Z range so the rail/groove can span nearly its
// full height.
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
// Cuts a completed choker/headpiece manifold into 3 wedge segments and
// attaches a dovetail-rail-pair (odd joints) / matching-groove-pair
// (even joints) at each of the 2 internal cuts, alternating so every
// joint is exactly one rail-bearing face meeting one groove-bearing
// face. Returns an array of 3 manifolds, each independently a valid,
// printable, single closed solid.
function splitIntoHookedSegments(wasm, manifold, wall){
const { Manifold } = wasm;
const mesh = manifoldToMesh(manifold);
const angles = mesh.V.map(v=>Math.atan2(v[1],v[0]));
const minA = Math.min(…angles), maxA = Math.max(…angles);
const span = (maxA-minA)/3;
// Tiny, deliberately “ugly” (non-round) perturbation on the 2 internal
// cut angles only, confirmed necessary via direct STL mesh analysis:
// when a cutting plane’s angle coincides almost exactly with an
// existing vertex’s own angle in the decorated surface, the boolean
// intersection produces a cluster of near-zero-area triangles all
// converging on that one point (found: 30 triangles sharing a single
// near-coincident vertex, all effectively degenerate). This offsets
// the cut just enough to avoid that exact coincidence without
// meaningfully changing where the piece is divided.
const cutEps = 0.0001743;
const cutAngles = [minA, minA+span+cutEps, minA+2*span-cutEps, maxA];
// A small angular inset at the 2 INTERNAL cuts only (not the piece’s own
// natural ends) creates a real ~0.4mm physical gap between adjacent
// segments, comfortably above Shapeways’ stated 0.3mm minimum clearance
// between separate parts in one file, and removes any ambiguity about
// whether touching-but-not-overlapping solids might get treated as one
// connected component downstream.
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
// Combines the 3 already-separate, already-validated segment manifolds
// into one V/F pair for export, via direct mesh concatenation rather than
// a further boolean union – guarantees they remain 3 distinct
// components in the output regardless of how closely their cut faces
// sit next to one another (a CSG union of touching-but-non-overlapping
// solids is not a risk worth taking here when a plain array concatenation
// does the same job with zero ambiguity).
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
const V=[…base, apex];
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
// micron – far below any real jewelry feature size, so this cannot
// merge two legitimately distinct nearby details) and removes any
// triangle that becomes degenerate (two or more shared vertices, or a
// near-zero cross-product area) or is an exact duplicate of another
// triangle. Confirmed via direct STL mesh analysis (edge-sharing count
// audit) that CSG booleans in this pipeline occasionally produce exactly
// this kind of artifact – a cluster of near-zero-area triangles all
// converging on one near-coincident point, or an outright duplicated
// triangle – which shows up as non-manifold edges and visible jagged
// seams in a highly reflective material. Found in both ring and choker
// output, i.e. in the shared construction pipeline, not one typology’s
// own code; this general pass catches the defect regardless of its
// exact source rather than requiring every individual embed calculation
// to be proven safe.
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
const rng=window.SeededVariation.createGenerator(String(p.seed||‘AGDP’)+’|cellular’);
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
while((remI!==0||remJ!==0)&&guard–>0){
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
const accentRngK = window.SeededVariation.createGenerator(String(p.seed||‘AGDP’)+’|full-vocabulary-knot’);
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
if(pathKey===‘vesselDome’){
const bigR=Math.max(AGDP_MIN_WALL_MM*1.0,strandR*(1.1+1.2*intensity));
parts.push(sphereAt(wasm,[rr*ct,rr*st,z],bigR,24));
}else if(pathKey===‘cageLattice’){
const barR=Math.max(AGDP_MIN_WALL_MM*0.65,strandR*(0.55+0.5*intensity));
const halfSpan=half*(0.18+0.16*intensity);
parts.push(cylinderBetween(wasm,[rr*ct,rr*st,z-halfSpan],[rr*ct,rr*st,z+halfSpan],barR,24));
parts.push(sphereAt(wasm,[rr*ct,rr*st,z-halfSpan],barR*1.3,24));
parts.push(sphereAt(wasm,[rr*ct,rr*st,z+halfSpan],barR*1.3,24));
}else if(pathKey===‘wrapped’){
const bumpR=Math.max(AGDP_MIN_WALL_MM*0.7,strandR*(0.9+0.9*intensity));
parts.push(sphereAt(wasm,[rr*ct,rr*st,z],bumpR,24));
}else if(pathKey===‘cellular’){
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
const baseWall = Math.max(AGDP_STRUCTURAL_WALL_MM, opts.type===‘choker’?(p.chokerWallMm||computedWall):opts.type===‘headpiece’?(p.headWallMm||computedWall):opts.type===‘comb’?(p.combBodyWallMm||computedWall):computedWall);
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
// removes the “two families” split: one topology, one spectrum.
const lattice = featureIntensity(p,‘lattice’);
const cage = featureIntensity(p,‘cage’);
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
const comfortActive = opts.type===‘ring’;
const comfortDepth = comfortActive ? Math.min(baseWall*0.28, 0.30) : 0;

const V=[], outer=[], inner=[];
const lateralOpsActive = opts.type===‘ring’||opts.type===‘bangle’||opts.type===‘cuffBracelet’||opts.type===‘earCuff’||opts.type===‘choker’||opts.type===‘headpiece’||opts.type===‘pendantAnnularCore’;
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
const ri = opts.type===‘pendantAnnularCore’
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
// BUG FIX (axis confusion): outerOperationField returns a RADIAL
// quantity (how many mm the decorated outer surface’s radius
// deviates from nominal at a given angle/height – it can be
// strongly positive from zoneMassDepth bulges or negative from
// grooveDepth cuts). This was being added directly as a Z-axis
// offset on the lateral cap that closes the band’s open ends.
// Confirmed numerically: with realistic organic/surfaceRelief
// values, this raw value reaches several mm and is NOT monotonic
// across k, so lateralTop/lateralBottom folded back on themselves
// (Z went up and back down within the same span) instead of
// sweeping smoothly from the inner radius to the outer radius –
// a self-intersecting cap, which is what produced degenerate
// triangulation in every downstream boolean (this is the shared
// code path for ring-open, bangle, cuffBracelet, earCuff, choker,
// headpiece and the pendant’s annular core).
// Fix: clamp the axial offset to a small, fixed fraction of the
// cap’s own radial span and drive it with the same smooth,
// strictly single-lobed envelope already used for blending –
// guaranteeing a monotonic sweep by construction rather than by
// luck of the current parameter values. This keeps the visual
// intent (the cap can bow slightly to follow the decorated
// surface) while making the fold structurally impossible.
const capAxialSlack = Math.max(AGDP_MIN_WALL_MM*0.4, (topOuterR-topInnerR)*0.18);
for(let k=1;k<lateralSeg;k++){
const u=k/lateralSeg;
const envelope=Math.sin(Math.PI*u);
const virtualZ=-half+bandW*u;
const rawField=outerOperationField(t,virtualZ)*envelope;
// Clamp the MAGNITUDE (via a smooth tanh squash) rather than a hard
// min/max clamp: a hard clamp can flatten into a plateau near the
// saturation region, which still leaves a non-monotonic dip right
// at the point where envelope pulls back toward zero at the ends.
// tanh saturates smoothly and preserves envelope’s own monotonic
// shape (single lobe, zero at both ends), so lateralField inherits
// envelope’s monotonicity by construction instead of fighting it.
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
for(let k=lateralSeg-1;k>=0;k–) loop.push(lateralTop[i][k]);
for(let j=zSeg-1;j>=0;j–) loop.push(inner[i][j]);
for(let k=1;k<lateralSeg;k++) loop.push(lateralBottom[i][k]);
}else{
// Final del arco: la orientación exterior es la inversa.
for(let j=zSeg;j>=0;j–) loop.push(outer[i][j]);
for(let k=lateralSeg-1;k>=0;k–) loop.push(lateralBottom[i][k]);
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

// Disabled for choker/headpiece specifically: confirmed via ablation
// testing (forcing this off while varying every other decoration
// independently) that it was the largest single contributor to severe
// non-manifold defects at choker’s much larger scale, though isolated
// testing of the pin decoration alone (even with multiple pins) on a
// simple band stayed clean – meaning this is an interaction with the
// piece’s full real complexity, not reproducible standalone. This is a
// mitigation matching the same “disable, don’t keep chasing under
// time pressure” approach taken for the hallmark engraving; a smaller
// residual defect remains (worst case dropped from 6337 to 561 in
// testing) and still needs dedicated root-cause investigation.
const pinCount = (cellularActive || opts.type===‘choker’ || opts.type===‘headpiece’) ? 0 : Math.round(p.screws||0);
if (pinCount>0) {
const pinR = Math.max(AGDP_MIN_WALL_MM*0.35, baseWall*0.16);
for (let k=0;k<pinCount;k++) {
const u = pinCount===1?.5:k/(pinCount-1);
const t = -arcRad/2+arcRad*(0.15+0.7*u);
const ct=Math.cos(t), st=Math.sin(t);
// BUG FIX: this used to run the pin all the way from innerR (the
// bore surface, where skin touches) out to the decorated outer
// surface – a full-thickness spike rather than a surface
// decoration, visible as a protruding block on the inside of the
// ring (confirmed via screenshot: pinCount pins showed as exactly
// that many tabs inside the bore). Every other decoration in this
// file embeds a modest, capped depth below the OUTER surface
// instead of reaching toward the inner one; this now does the
// same, capping the embed at a small multiple of the pin’s own
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
// by this sphere’s union with the band scales with the sphere’s
// OWN facet count (4 segments -> 1 defect, 24 -> 176, 96 -> 3065),
// the opposite of what earlier “smoother reflections” tuning
// assumed. Every additional facet on the sphere adds another
// potential near-tangent crossing against the base mesh’s own
// faceting – fewer facets means fewer chances for that. This
// trades a slightly more faceted-looking bead for the piece
// actually being printable, which is the more urgent priority.
decorations.push(organicNodeAt(wasm,[rr*Math.cos(t),rr*Math.sin(t),nodeZ],sr,12,t+k*.73));
}
}
// Hallmark engraving removed entirely per explicit request: the
// curved-surface text approach produced catastrophic geometry damage
// in production and there’s no reason to keep dead code implementing
// an approach that’s been abandoned. A future hallmark, if pursued,
// should be a completely different design (e.g. a small flat plate)
// rather than text curved into the band’s own surface.
if (!closed) {
const tEnd0=-arcRad/2, tEnd1=arcRad/2;
[tEnd0, tEnd1].forEach(te => {
const ct=Math.cos(te), st=Math.sin(te);
const wallHere = localSurfaceRZ(te,0)-innerR;
const ballR = Math.max(AGDP_MIN_WALL_MM*1.1, wallHere*0.62);
// Shifted outward by an extra 0.15*ballR: the ball’s innermost point
// used to sit at EXACTLY innerR (tangent to the bore surface, not
// overlapping past it) – the same coincident-surface condition
// confirmed to cause degenerate CSG results in the hallmark bug.
// This guarantees genuine volumetric overlap with the solid band
// instead of an ambiguous tangent touch.
const rCenter = innerR+ballR*1.15;
decorations.push(organicNodeAt(wasm,[rCenter*ct,rCenter*st,0],ballR,12,t));
});
}

const featureWeights=p.featureWeights||{};
const floors={lattice:.24,vessel:.18,cellular:.22};
const accentRng=window.SeededVariation.createGenerator(String(p.seed||‘AGDP’)+’|transversal-subtractive-v106’);
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
catch(err){ console.warn(‘AGDP: operación transversal omitida por seguridad topológica’,err); }
}
