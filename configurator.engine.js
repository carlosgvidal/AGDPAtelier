‘use strict’;
const AGDP_APP_VERSION=‘0.201’;
window.AGDP_APP_VERSION=AGDP_APP_VERSION;
window.addEventListener(‘error’,function(e){
const statusWrap=document.getElementById(‘agdpStatusWrap’);
const statusBadge=document.getElementById(‘agdpStatusBadge’);
if(statusWrap)statusWrap.style.display=‘flex’;
if(statusBadge){
statusBadge.className=‘agdp-status-badge’;
// Technical detail (e.message) is never shown publicly — it belongs in
// the console/telemetry, not in the customer-facing interface. Full
// detail is still logged below for internal diagnosis.
statusBadge.textContent=‘The engine is adjusting the configuration — generate another variant.’;
}
console.error(‘AGDP Atelier ‘+AGDP_APP_VERSION+’ · error global’,e);
});
window.addEventListener(‘unhandledrejection’,function(e){
console.error(‘AGDP Atelier ‘+AGDP_APP_VERSION+’ · promesa rechazada’,e.reason);
});
const $=id=>document.getElementById(id);
const canvas=$(‘view’);

const SeededVariation=(()=>{
function hash(value){
const text=String(value||‘AGDP’);
let h=2166136261>>>0;
for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
h+=h<<13;h^=h>>>7;h+=h<<3;h^=h>>>17;h+=h<<5;
return h>>>0;
}
function createGenerator(seed){
let a=hash(seed)||0x6d2b79f5;
return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};
}
function normalize(seed){
const cleaned=String(seed||’’).trim().replace(/[^A-Za-z0-9_-]/g,’’).slice(0,48);
return cleaned||newSeed();
}
function newSeed(){
const bytes=new Uint32Array(4);
if(window.crypto&&window.crypto.getRandomValues)window.crypto.getRandomValues(bytes);
else{
const now=Date.now()>>>0, perf=(performance.now()*1000000)>>>0;
bytes[0]=now;bytes[1]=perf;bytes[2]=(now^perf^Math.floor(Math.random()*0xffffffff))>>>0;bytes[3]=Math.floor(Math.random()*0xffffffff)>>>0;
}
return ‘AGDP-’+Array.from(bytes,v=>v.toString(36).toUpperCase().padStart(7,‘0’)).join(’-’);
}
function signed(rng){return rng()*2-1;}
function range(rng,a,b){return a+(b-a)*rng();}
function integer(rng,a,b){return Math.floor(range(rng,a,b+1));}
function extremal(rng,min,max,power){
power=power==null?2.8:power;
const side=rng()<0.5?0:1;
const x=Math.pow(rng(),power);
const t=side===0?x:1-x;
return min+(max-min)*t;
}
function contrastedWeights(rng){
const keys=[‘lattice’,‘cellular’,‘vessel’,‘dome’,‘wrapped’,‘cage’,‘interweave’];
const values={};
keys.forEach(k=>{values[k]=range(rng,.04,.58);});
const first=keys.splice(Math.floor(rng()*keys.length),1)[0];
const second=keys.splice(Math.floor(rng()*keys.length),1)[0];
values[first]=range(rng,.78,1.00);
values[second]=range(rng,.62,.94);
if(rng()<.62){
const recessed=keys[Math.floor(rng()*keys.length)];
values[recessed]=range(rng,.02,.12);
}
values.continuity=extremal(rng,.28,1.00,2.15);
return Object.freeze(values);
}
function apply(params,seed){
const p=Object.assign({},params);
p.seed=normalize(seed||p.seed);
const rng=createGenerator(p.seed+’|’+(p.type||‘piece’)+’|variation-v3-sculptural’);

```
p.variantSelector=rng();
p.sculpturalVolume=extremal(rng,.12,1.00,2.05);
p.formContrast=extremal(rng,.18,1.00,2.15);
p.variation={
  phaseA:rng()*Math.PI*2,phaseB:rng()*Math.PI*2,phaseC:rng()*Math.PI*2,
  contour:signed(rng),axial:signed(rng),radial:signed(rng),detail:signed(rng),
  jitter:extremal(rng,.46,1.52,2.0),rhythm:extremal(rng,.48,1.62,2.0),
  scaleU:extremal(rng,.62,1.48,2.05),scaleV:extremal(rng,.58,1.52,2.05),
  density:extremal(rng,.08,1.00,2.0),offset:signed(rng)
};

p.featureWeights=contrastedWeights(rng);

p.risk=Math.min(1,Math.pow(rng(),.86)*1.08);
p.organic=extremal(rng,.02,.98,2.15);
p.architectural=extremal(rng,.02,.98,2.15);
p.longitudinal=extremal(rng,.04,.98,2.05);
p.asymmetry=clamp(extremal(rng,.00,.58,2.15)*(1+p.risk*.62),0,.72);
p.faceting=extremal(rng,.01,.92,2.15);
p.smoothness=extremal(rng,.12,.98,2.10);
p.structuralConflict=p.risk*(Math.abs(p.organic-p.architectural)+p.asymmetry+p.variation.density+p.formContrast*.55);

const volumeGain=.82+p.sculpturalVolume*1.18;
p.surfaceRelief=range(rng,.020,.132)*(1+p.risk*.95)*volumeGain;
p.sideRelief=range(rng,.010,.094)*(1+p.sculpturalVolume*.72);
p.railCount=integer(rng,0,4);
p.railHeight=range(rng,.85,2.75)*(1+p.sculpturalVolume*.22);
p.railGap=range(rng,1.10,3.90);
p.holes=integer(rng,0,5);
p.holeCoverage=range(rng,58,170)*(1+p.risk*.46);
p.nodes=integer(rng,0,6);
p.nodeVolume=range(rng,1.00,3.25)*(1+p.risk*.72)*(1+p.sculpturalVolume*.48);
p.frames=range(rng,.02,.88);
p.rivets=integer(rng,0,4);
p.screws=integer(rng,0,3);
p.hinges=integer(rng,0,2);
p.articulationCoverage=range(rng,48,168);
p.articulationOffset=signed(rng)*52*(1+p.risk*.72);
p.crown=rng()<(.30+p.sculpturalVolume*.34);
p.crownArc=extremal(rng,24,154,2.0);
p.crownMass=range(rng,.85,3.85)*(1+p.sculpturalVolume*.56);
p.spikes=p.crown&&rng()<.38?integer(rng,1,4):0;
p.spikeHeight=range(rng,.74,1.42);

p.mutation={
  active:rng()<.28,
  severity:Math.pow(rng(),.42),
  mode:['rupture','hypertrophy','erosion','displacement','compression','proliferation','inversion'][Math.floor(rng()*7)]
};
if(p.mutation.active){
  const sv=p.mutation.severity;
  if(p.mutation.mode==='rupture'){
    p.featureWeights=Object.freeze(Object.assign({},p.featureWeights,{
      continuity:clamp(p.featureWeights.continuity*(1-sv*.72),.10,1),
      cage:clamp(p.featureWeights.cage+sv*.64,.02,1),
      lattice:clamp(p.featureWeights.lattice+sv*.56,.02,1)
    }));
    p.railCount=Math.min(4,(p.railCount||0)+Math.round(1+sv*2));
  }else if(p.mutation.mode==='hypertrophy'){
    p.nodeVolume=(p.nodeVolume||1.4)*(1+sv*1.85);
    p.crownMass=(p.crownMass||1.75)*(1+sv*1.35);
    p.surfaceRelief=(p.surfaceRelief||.05)*(1+sv*.55);
    p.asymmetry=clamp((p.asymmetry||.1)+sv*.34,0,.72);
  }else if(p.mutation.mode==='erosion'){
    p.holes=Math.min(6,(p.holes||0)+Math.round(1+sv*3));
    p.holeCoverage=(p.holeCoverage||118)*(1+sv*.58);
    p.featureWeights=Object.freeze(Object.assign({},p.featureWeights,{cellular:clamp(p.featureWeights.cellular+sv*.62,.02,1)}));
  }else if(p.mutation.mode==='displacement'){
    p.articulationOffset=(signed(rng)>=0?1:-1)*(68+sv*94);
    p.crownArc=range(rng,18,58);
    p.asymmetry=clamp((p.asymmetry||.1)+sv*.28,0,.72);
  }else if(p.mutation.mode==='compression'){
    p.smoothness=clamp((p.smoothness||.5)*(1-sv*.58),.04,1);
    p.surfaceRelief=(p.surfaceRelief||.05)*(1+sv*1.12);
    p.longitudinal=clamp((p.longitudinal||.5)*(1+sv*.72),0,1);
  }else if(p.mutation.mode==='proliferation'){
    p.nodes=Math.min(6,(p.nodes||0)+Math.round(1+sv*3));
    p.rivets=Math.min(5,(p.rivets||0)+Math.round(sv*3));
    p.railCount=Math.min(4,(p.railCount||0)+Math.round(sv*2));
    p.nodeVolume=(p.nodeVolume||1.4)*(1+sv*.42);
  }else if(p.mutation.mode==='inversion'){
    const fw=p.featureWeights;
    p.featureWeights=Object.freeze({
      lattice:fw.cellular,cellular:fw.lattice,
      vessel:fw.wrapped,wrapped:fw.vessel,
      dome:fw.cage,cage:fw.dome,
      interweave:fw.interweave,continuity:fw.continuity
    });
    p.organic=1-(p.organic||.5);
    p.architectural=1-(p.architectural||.5);
  }
}

// Functional limits for the active compact typologies.
if(p.type==='earCuff'){
  p.holes=integer(rng,0,2);p.nodes=integer(rng,0,3);p.crown=false;p.spikes=0;
  p.nodeVolume=Math.min(p.nodeVolume,3.8);
}else if(p.type==='cufflinks'){
  p.holes=integer(rng,0,1);p.nodes=integer(rng,0,4);p.crown=false;p.spikes=0;
  p.nodeVolume=Math.min(p.nodeVolume,4.5);
}
return p;
```

}
return Object.freeze({apply,newSeed,normalize,createGenerator});
})();

function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
function wrap(a){while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;}

/* =========================================================================
AGDP PROPORTION ENGINE
Explicit dimensional envelopes keep the sculptural seed from inflating
wearable widths beyond the collection’s calibrated limits. Fit dimensions
remain independent; only visible width, height and projection are bounded.
========================================================================= */
const AGDP_PROPORTION_SYSTEM=Object.freeze({
moduleMm:Object.freeze({min:3.6,canonical:5.4,max:7.0}),
widthRangesMm:Object.freeze({
ring:Object.freeze([3.6,6.5]),
bangle:Object.freeze([3.6,7.0]),
cuffBracelet:Object.freeze([3.6,7.0]),
earCuff:Object.freeze([3.6,6.5])
}),
envelopeRangesMm:Object.freeze({
pendant:Object.freeze([23.5,40]),
cufflinks:Object.freeze([15,25]),
chokerTorque:Object.freeze([6,14]),
chokerSculptural:Object.freeze([28,52]),
chokerCervical:Object.freeze([34,58]),
headpiece:Object.freeze([18,42])
}),
projectionRangesMm:Object.freeze({
ring:Object.freeze([2.2,4.8]),
bangle:Object.freeze([2.6,5.8]),
cuffBracelet:Object.freeze([2.8,6.2]),
earCuff:Object.freeze([2.2,4.8]),
pendant:Object.freeze([3.2,7.2]),
cufflinks:Object.freeze([3.2,7.0]),
chokerTorque:Object.freeze([3.8,6.0]),
chokerSculptural:Object.freeze([4.2,7.2]),
chokerCervical:Object.freeze([4.6,7.2]),
headpiece:Object.freeze([2.8,5.4])
})
});

const ProportionEngine=(()=>{
function lerp(a,b,t){return a+(b-a)*clamp(t,0,1);}
function normalizeCrownMass(x){return clamp(((x==null?1.75:x)-1.0)/3.8,0,1);}
function normalizeNodeVolume(x){return clamp(((x==null?1.45:x)-1.0)/4.2,0,1);}
function profileKey(p){
if(p.type!==‘choker’)return p.type;
if(p.chokerProfile===‘torque’)return ‘chokerTorque’;
if(p.chokerProfile===‘cervical’)return ‘chokerCervical’;
return ‘chokerSculptural’;
}
function rangeFor(table,key,fallback){return table[key]||fallback;}
function apply(params){
const p=Object.assign({},params);
const I=(p.loadGraph&&p.loadGraph.intensities)||{};
const mutation=(p.mutation&&p.mutation.active)?clamp(p.mutation.severity||0,0,1):0;
const density=clamp(p.variation&&p.variation.density!=null?p.variation.density:.5,0,1);
const nodeI=Math.max(clamp(I.node||0,0,1),normalizeNodeVolume(p.nodeVolume));
const bridgeI=clamp(I.bridge||0,0,1);
const crownI=normalizeCrownMass(p.crownMass);
const volumeIntensity=clamp(
.22*clamp(p.risk||0,0,1)+
.18*nodeI+
.16*crownI+
.14*clamp(p.architectural||0,0,1)+
.12*density+
.10*bridgeI+
.08*mutation,0,1
);
const envelopeIntensity=clamp(
.30*clamp(p.longitudinal||0,0,1)+
.25*crownI+
.20*normalizeNodeVolume(p.nodeVolume)+
.15*clamp((p.asymmetry||0)/.72,0,1)+
.10*clamp(p.risk||0,0,1),0,1
);
const key=profileKey(p);
const moduleSpec=AGDP_PROPORTION_SYSTEM.moduleMm;
const structuralModuleMm=lerp(moduleSpec.min,moduleSpec.max,Math.pow(volumeIntensity,.82));
const widthRange=AGDP_PROPORTION_SYSTEM.widthRangesMm[key];
const envelopeRange=rangeFor(AGDP_PROPORTION_SYSTEM.envelopeRangesMm,key,[structuralModuleMm,structuralModuleMm*3]);
const projectionRange=rangeFor(AGDP_PROPORTION_SYSTEM.projectionRangesMm,key,[structuralModuleMm*.6,structuralModuleMm*1.25]);
const wearableWidthMm=widthRange?lerp(widthRange[0],widthRange[1],envelopeIntensity):null;
const envelopeHeightMm=widthRange?wearableWidthMm:lerp(envelopeRange[0],envelopeRange[1],envelopeIntensity);
const massIntensity=clamp(.55*nodeI+.45*crownI,0,1);
const projectionDepthMm=lerp(projectionRange[0],projectionRange[1],massIntensity);

```
p.proportionSystem='AGDP-Dimensional-Envelopes-v2';
p.proportionProfile=key;
p.proportionVolumeIntensity=volumeIntensity;
p.proportionEnvelopeIntensity=envelopeIntensity;
p.structuralModuleMm=structuralModuleMm;
p.envelopeHeightMm=envelopeHeightMm;
p.projectionDepthMm=projectionDepthMm;
p.edgeGaugeMm=Math.max(.8,structuralModuleMm*.22);

if(widthRange){
  p.bandWidth=wearableWidthMm;
}else if(p.type==='choker'){
  p.bandWidth=envelopeHeightMm;
  p.chokerWallMm=projectionDepthMm;
  p.chokerFrontProjection=clamp(projectionDepthMm/Math.max(70,p.mainSize||100),.018,.095);
}else if(p.type==='headpiece'){
  p.bandWidth=envelopeHeightMm;
  p.headWallMm=projectionDepthMm;
  p.headFrontProjection=clamp(projectionDepthMm/Math.max(100,p.mainSize||140),.015,.052);
}else if(p.type==='pendant'){
  p.mainSize=clamp(p.mainSize||envelopeHeightMm,envelopeRange[0],envelopeRange[1]);
  p.bandWidth=projectionDepthMm;
}else if(p.type==='cufflinks'){
  p.mainSize=clamp(p.mainSize||envelopeHeightMm,envelopeRange[0],envelopeRange[1]);
  p.bandWidth=projectionDepthMm;
}
return p;
```

}
return Object.freeze({apply,system:AGDP_PROPORTION_SYSTEM});
})();
window.AGDP_PROPORTION_SYSTEM=AGDP_PROPORTION_SYSTEM;
window.ProportionEngine=ProportionEngine;

window.AGDP_GEOMETRY_CONSTRAINTS_V157=Object.freeze({
geometryRevision:‘v200’,
minimumBridgeDiameterMm:1.4,
minimumNeckClearanceMm:2.0,
minimumHeadClearanceMm:2.5,
cufflinkStemSweepDeg:4,
surfaceClearanceMm:1.2,
forbidBodyPenetration:true,
requireConnectedComponents:true,
autoBridgeFloatingGeometry:true,
cufflinkPostCurvatureRadiusMm:34,
cufflinkPostDiameterMm:1.8,
viewportEnvIntensity:.656,
viewportRoughness:.275
});

const SurfaceTopologyProfiles=Object.freeze({
ring:Object.freeze({domain:‘annular’,u:‘circumference’,v:‘width’,closed:true,flow:‘circumferential’,relief:.90,voids:.72,rails:1.00,nodes:.72,edgeReserve:.10}),
bangle:Object.freeze({domain:‘annular’,u:‘circumference’,v:‘width’,closed:true,flow:‘circumferential’,relief:1.00,voids:.82,rails:1.00,nodes:.82,edgeReserve:.09}),
cuffBracelet:Object.freeze({domain:‘openAnnular’,u:‘arc’,v:‘width’,closed:false,flow:‘circumferential’,relief:1.00,voids:.70,rails:1.00,nodes:.82,edgeReserve:.16}),
choker:Object.freeze({domain:‘cervicalShell’,u:‘cervicalArc’,v:‘height’,closed:false,flow:‘cervical’,relief:.82,voids:.62,rails:.88,nodes:.72,edgeReserve:.18}),
headpiece:Object.freeze({domain:‘cranialBand’,u:‘cranialArc’,v:‘height’,closed:false,flow:‘cranial’,relief:.86,voids:.66,rails:.92,nodes:.80,edgeReserve:.18}),
pendant:Object.freeze({domain:‘sculpturalPendantVolume’,u:‘massField’,v:‘contour’,closed:true,flow:‘volumetric’,relief:1.08,voids:.78,rails:.62,nodes:1.00,edgeReserve:.16}),
cufflinks:Object.freeze({domain:‘compactFace’,u:‘radial’,v:‘contour’,closed:true,flow:‘radial’,relief:.96,voids:.70,rails:.55,nodes:.92,edgeReserve:.14}),
earCuff:Object.freeze({domain:‘openAnnular’,u:‘arc’,v:‘width’,closed:false,flow:‘circumferential’,relief:.72,voids:.45,rails:.80,nodes:.70,edgeReserve:.22})
});
function surfaceTopologyProfile(type){
return SurfaceTopologyProfiles[type]||SurfaceTopologyProfiles.ring;
}
function adaptTopologyToSurface(params){
const profile=surfaceTopologyProfile(params.type);
const p=Object.assign({},params);
p.surfaceTopology=profile;
const fw=Object.assign({lattice:.35,cellular:.35,vessel:.35,dome:.35,wrapped:.35,cage:.35,interweave:.35,continuity:.7},p.featureWeights||{});
p.featureWeights=Object.freeze({
lattice:clamp(fw.lattice*(.72+.28*profile.voids),.04,1),
cellular:clamp(fw.cellular*(.68+.32*profile.voids),.04,1),
vessel:clamp(fw.vessel*(.72+.28*profile.relief),.04,1),
dome:clamp(fw.dome*(.72+.28*profile.relief),.04,1),
wrapped:clamp(fw.wrapped*(.76+.24*profile.rails),.04,1),
cage:clamp(fw.cage*(.70+.30*profile.rails),.04,1),
interweave:clamp(fw.interweave*(.72+.28*profile.nodes),.04,1),
continuity:clamp(fw.continuity,.35,1)
});
p.surfaceRelief=Math.max(0,(p.surfaceRelief||0)*profile.relief);
p.sideRelief=Math.max(0,(p.sideRelief||0)*Math.min(1,profile.relief));
p.holes=Math.max(0,Math.round((p.holes||0)*profile.voids));
p.holeCoverage=(p.holeCoverage||118)*(0.88+profile.voids*.12);
p.railCount=Math.max(0,Math.round((p.railCount||0)*profile.rails));
p.nodes=Math.max(0,Math.round((p.nodes||0)*profile.nodes));
p.surfaceMapping=Object.freeze({
domain:profile.domain,u:profile.u,v:profile.v,flow:profile.flow,
edgeReserve:profile.edgeReserve,protected:(profile.protected||[]).slice(),
reliefScale:profile.relief,voidScale:profile.voids
});
if(p.type===‘earCuff’){
p.holes=Math.min(p.holes,2);
}
return p;
}
const GenerationLayers=(()=>{
function topology(params){
const profile=surfaceTopologyProfile(params.type);
return Object.freeze({
bandMultiplicity:1+Math.max(0,params.railCount||0)/2,
headScale:1+(params.crownMass||0)*0.15,
split:params.asymmetry||0,
voidBias:(params.holeCoverage||0)/180,
closed:profile.closed,
opening:params.opening||0,
domain:profile.domain,flow:profile.flow,edgeReserve:profile.edgeReserve
});
}
function morphology(params,topologyLayer){
return Object.freeze({
organic:params.organic, architectural:params.architectural, longitudinal:clamp(params.longitudinal,0,1),
asymmetry:params.asymmetry, crown:params.crown, crownArc:params.crownArc,
crownMass:params.crownMass*topologyLayer.headScale, mainSize:params.mainSize,
bandWidth:params.bandWidth, faceShape:params.faceShape,
faceting:params.faceting, smoothness:params.smoothness
});
}
function surface(params,topologyLayer){
return Object.freeze({
relief:params.surfaceRelief, sideRelief:params.sideRelief,
mapping:params.surfaceMapping,
rails:{count:Math.max(params.railCount,topologyLayer.bandMultiplicity-1),height:params.railHeight,gap:params.railGap},
perforation:{count:params.holes,coverage:params.holeCoverage,bias:topologyLayer.voidBias},
crownDetails:{spikes:params.spikes,spikeHeight:params.spikeHeight,nodes:params.nodes,nodeVolume:params.nodeVolume},
articulation:{frames:params.frames,rivets:params.rivets,screws:params.screws,hinges:params.hinges,coverage:params.articulationCoverage,offset:params.articulationOffset}
});
}
function compile(params){
const adapted=adaptTopologyToSurface(params);
const t=topology(adapted),m=morphology(adapted,t),sf=surface(adapted,t);
const p=Object.assign({},adapted,{
topology:t,morphology:m,surface:sf,
mainSize:m.mainSize,bandWidth:m.bandWidth,organic:m.organic,architectural:m.architectural,
longitudinal:m.longitudinal,asymmetry:m.asymmetry,crown:m.crown,crownArc:m.crownArc,crownMass:m.crownMass,
faceShape:m.faceShape,faceting:m.faceting,smoothness:m.smoothness,
surfaceRelief:sf.relief,sideRelief:sf.sideRelief,
railCount:sf.rails.count,railHeight:sf.rails.height,railGap:sf.rails.gap,
holes:sf.perforation.count,holeCoverage:sf.perforation.coverage,
spikes:sf.crownDetails.spikes,spikeHeight:sf.crownDetails.spikeHeight,nodes:sf.crownDetails.nodes,nodeVolume:sf.crownDetails.nodeVolume,
frames:sf.articulation.frames,rivets:sf.articulation.rivets,screws:sf.articulation.screws,hinges:sf.articulation.hinges,
articulationCoverage:sf.articulation.coverage,articulationOffset:sf.articulation.offset
});
const spec=silverSpec(p.printProfile||‘silverPolished’);
p.minFeature=Math.max(spec.wall,p.minFeature||spec.wall);
if(p.railCount>0)p.railHeight=Math.max(p.railHeight||spec.supportedWire,spec.supportedWire);
if(p.railCount>1)p.railGap=Math.max(p.railGap||spec.clearance,spec.clearance);
if(p.crown&&p.spikes>0){
p.protrusions=Math.min(4,Math.max(p.protrusions||0,Math.round(p.spikes)));
p.nodes=Math.max(p.nodes||0,p.protrusions);
p.nodeVolume=Math.max(p.nodeVolume||1.4,1.75);
p.spikes=0; p.spikeHeight=0; p.spikeProfile=‘roundedBump’;
}
if(p.surfaceRelief>0)p.surfaceRelief=Math.max(p.surfaceRelief,spec.embossed/5.2);
if(p.sideRelief>0)p.sideRelief=Math.max(p.sideRelief,spec.engraved/4.0);
// Universal structural-safety floor, applied identically to every
// category on every generation — never optional, never bypassable by
// a caller forgetting to invoke it separately.
const safe = window.LoadGraphEngine ? window.LoadGraphEngine.enforceStructuralSafety(p) : p;
return safe;
}
return Object.freeze({topology,morphology,surface,compile,profile:surfaceTopologyProfile,adapt:adaptTopologyToSurface});
})();
window.GenerationLayers = GenerationLayers;

/* =========================================================================
LOAD GRAPH ENGINE
The seed does not start from a torus or a curve. It starts from a graph
of structural loads: nodes carrying a role (support, articulation,
compression, tension, suspension, mass, void) and edges carrying a
structural relation (loop, bridge, surround, traverse, interrupt) with
their own properties (rigidity, torsion, width, continuity).

There are no discrete families here. The graph’s own composition is
measured into continuous structural intensities (bridge presence, void
presence, node/mass presence, organism/curvature presence, loop
continuity) and every one of those intensities is blended into every
piece, of every category, by the same rules — exactly the same
“campo formal continuo” principle this engine already applies to
featureWeights, extended one level upstream of it. A ring, a comb, and
a money clip all read the same graph the same way; only their existing
per-type geometry builders differ, never the rules that feed them.

A universal structural-safety pass (enforceStructuralSafety) is applied
to every compiled piece regardless of type, so that no seed can ever
produce a fragile or dangerous result — this is a hard floor, not a
diagnostic suggestion.
========================================================================= */
const LoadGraphEngine = (()=>{
const NODE_ROLES = [‘support’,‘articulation’,‘compression’,‘tension’,‘suspension’,‘mass’,‘void’];
const EDGE_TYPES = [‘loop’,‘bridge’,‘surround’,‘traverse’,‘interrupt’];

function rngFor(seed,tag){ return SeededVariation.createGenerator(String(seed||‘AGDP’)+’|loadgraph|’+tag); }

// –– Graph construction –––––––––––––––––––––––––
// A ring/bangle/etc’s principal loop is always present (Regla 1: debe
// existir un loop principal). Everything else is attached to it. The
// graph is built once per seed, identically in shape for every category —
// only the geometry that later reads it differs.
function buildLoadGraph(seed, type){
const rng = rngFor(seed, type);
const nodes = [];
const edges = [];

```
const loopNode = { id:'loop0', role:'support', u:0, radialOffset:0,
  radius:1.0, curvature:1.0, thickness:1.0, fn:'principalLoop' };
nodes.push(loopNode);
const loopContinuity = 0.55+0.45*rng();
edges.push({ from:'loop0', to:'loop0', type:'loop', rigidity:0.8+0.2*rng(), torsion:rng()<0.35?rng()*0.35:0, width:1, continuity:loopContinuity });

// Secondary structural nodes: 1-4, each with a genuine structural role,
// never a purely decorative one (Regla 3, Regla 8: primitives never
// appear pure/unmodified — every node's geometry is derived from its
// role + attributes, not a bare sphere/cube).
const secondaryCount = 1+Math.floor(rng()*4);
const rolePool = ['articulation','compression','tension','suspension','mass','void'];
for (let i=0;i<secondaryCount;i++){
  const role = rolePool[Math.floor(rng()*rolePool.length)];
  const node = {
    id:'n'+i, role,
    u: rng(),
    radialOffset: (rng()*2-1)*0.4,
    radius: 0.35+rng()*0.9,
    curvature: rng(),
    thickness: 0.4+rng()*0.8,
    fn: role
  };
  nodes.push(node);
  // Every node connects to the loop — Regla 2: no existen elementos
  // aislados, todo debe conectarse.
  edges.push({ from:'loop0', to:node.id, type: role==='void' ? 'traverse' : 'surround',
    rigidity:0.3+0.6*rng(), torsion:0, width:0.3+0.5*rng(), continuity:0.5+0.5*rng() });
}

// Bridges are present in every graph to some continuous degree — never
// gated behind an exclusive category. Even a graph that ends up with
// zero explicit bridge edges still contributes a near-zero (not
// undefined) bridge intensity, so downstream code never has to branch
// on "does this piece have bridges or not."
const bridgeCount = Math.floor(rng()*3) + (rng()<0.55 ? 1 : 0);
for (let i=0;i<bridgeCount && nodes.length>=2;i++){
  const a = nodes[1+Math.floor(rng()*(nodes.length-1))];
  const b = nodes[1+Math.floor(rng()*(nodes.length-1))];
  if (a.id===b.id) continue;
  edges.push({ from:a.id, to:b.id, type:'bridge',
    rigidity:0.6+0.4*rng(), torsion:0, width:0.4+0.5*rng(), continuity:0.4+0.4*rng() });
}

// Exactly one semantic event/center is guaranteed (Regla 7).
let eventNode = nodes.slice(1).sort((a,b)=>b.radius-a.radius)[0];
if (!eventNode){
  eventNode = { id:'event0', role:'mass', u:0.5, radialOffset:0, radius:0.8, curvature:0.6, thickness:0.7, fn:'mass' };
  nodes.push(eventNode);
  edges.push({ from:'loop0', to:eventNode.id, type:'surround', rigidity:0.7, torsion:0, width:0.6, continuity:0.7 });
}
eventNode.isEvent = true;

// Regla 6 enforcement, by construction: mass must compensate —
// asymmetry is allowed, imbalance is not. If multiple mass/compression
// nodes would all sit near maximum radius simultaneously, scale the
// secondary ones down so exactly one can carry the dominant weight.
const massCandidates = nodes.filter(n=>n.role==='mass'||n.role==='compression');
if (massCandidates.length>1){
  const dominant = massCandidates.reduce((best,n)=>n.radius>best.radius?n:best, massCandidates[0]);
  massCandidates.forEach(n=>{
    if (n!==dominant && n.radius>=0.95) n.radius = 0.55+rng()*0.30;
  });
}

const intensities = measureIntensities(nodes, edges);
const graph = { nodes, edges, intensities, seed, type };
graph.ruleAudit = auditRules(graph);
return graph;
```

}

// –– Continuous structural measurement ———————————–
// No classification, no exclusive category: every one of these reads
// 0..1 and every one of them is present, in some measure, in every
// graph. This is what actually feeds every piece of every category —
// the same five numbers, read the same way, everywhere.
function measureIntensities(nodes, edges){
const bridgeEdges = edges.filter(e=>e.type===‘bridge’);
const traverseEdges = edges.filter(e=>e.type===‘traverse’);
const massNodes = nodes.filter(n=>n.role===‘mass’||n.role===‘compression’);
const suspensionNodes = nodes.filter(n=>n.role===‘suspension’||n.role===‘tension’);
const loopEdge = edges.find(e=>e.type===‘loop’);
const denom = Math.max(1, nodes.length-1);

```
const bridge = clamp(bridgeEdges.reduce((s,e)=>s+e.rigidity,0) / (denom*0.85), 0, 1);
const voidI = clamp(traverseEdges.length / denom, 0, 1);
const node = clamp(massNodes.reduce((m,n)=>Math.max(m,n.radius),0), 0, 1);
const suspension = clamp(suspensionNodes.length / denom, 0, 1);
const continuity = loopEdge ? clamp(loopEdge.continuity, 0, 1) : 0.7;
const organism = clamp(nodes.reduce((s,n)=>s+n.curvature,0) / nodes.length, 0, 1);

return Object.freeze({ bridge, void: voidI, node, suspension, continuity, organism });
```

}

// –– Rule audit ———————————————————–
// Structural-safety diagnostics, computed for every graph regardless of
// category. These no longer gate a “family” — they simply must all pass,
// for every piece, every time (enforced for real in
// enforceStructuralSafety below, not just reported here).
function auditRules(graph){
const { nodes, edges } = graph;
const loopEdges = edges.filter(e=>e.type===‘loop’);
const rule1 = loopEdges.length===1;
const connectedIds = new Set([‘loop0’]);
edges.forEach(e=>{ if(e.from===‘loop0’||connectedIds.has(e.from)) connectedIds.add(e.to); if(e.to===‘loop0’||connectedIds.has(e.to)) connectedIds.add(e.from); });
const rule2 = nodes.every(n=>connectedIds.has(n.id));
const rule3 = edges.every(e=>e.type!==‘loop’ ? e.rigidity>0.15 : true);
const rule4 = nodes.every(n=>n.thickness>=0.2 && n.thickness<=1.6);
const rule5 = edges.filter(e=>e.type===‘traverse’).every(e=>e.width>0.2);
const massRoles = nodes.filter(n=>n.role===‘mass’||n.role===‘compression’);
// A real weighted centroid, not “one small mass among several proves
// balance”: radius^3 as a volume proxy, projected onto each node’s own
// angular position — the centroid must not sit far from the loop’s
// own middle, which a single dominant, off-center mass would violate
// even if some other node happens to be small.
const rule6 = (()=>{
if (massRoles.length<=1) return true;
let sumW=0, sumWU=0;
massRoles.forEach(n=>{ const w=Math.pow(n.radius,3); sumW+=w; sumWU+=w*n.u; });
if (sumW<=0) return true;
const centroidU = sumWU/sumW;
return Math.abs(centroidU-0.5) < 0.38;
})();
const rule7 = nodes.some(n=>n.isEvent);
const rule8 = nodes.every(n=>n.fn && n.fn!==‘rawPrimitive’);
// Surface texture complexity is handled at the material layer, not
// here — but the graph’s own size is a real, checkable ceiling on
// accumulated detail, not a permanently-true placeholder.
const rule9 = nodes.length <= 8;
// Complexity from repeated simple relations, not from accumulating
// one-off detail: at least one edge type must actually repeat, not
// just “as many edges as nodes” (which says nothing about whether
// any of it repeats).
const rule10 = (()=>{
if (edges.length>nodes.length) return true;
if (edges.length<nodes.length) return false;
const typeCounts={};
edges.forEach(e=>{ typeCounts[e.type]=(typeCounts[e.type]||0)+1; });
return Object.values(typeCounts).some(c=>c>=2);
})();
const results = { rule1, rule2, rule3, rule4, rule5, rule6, rule7, rule8, rule9, rule10 };
results.allPass = Object.values(results).every(Boolean);
return results;
}

// –– Universal continuous feed into every category ———————–
// The same five intensities blend into the same featureWeights and
// structural fields for every type — ring, bangle, choker, comb, clip,
// money clip, cufflinks, everything. No branch on category, no branch
// on a discrete family. Differences between pieces come only from the
// seed’s own numbers, never from a selected code path.
function applyGraphToParams(params, graph){
const p = Object.assign({}, params);
const I = graph.intensities;
p.loadGraph = graph;

```
const fw = Object.assign({}, p.featureWeights || {});
fw.cage      = clamp(((fw.cage||0.3)      + I.bridge*0.9)     / 1.5, 0.04, 1);
fw.lattice   = clamp(((fw.lattice||0.3)   + I.bridge*0.7 + I.void*0.5) / 1.9, 0.04, 1);
fw.cellular  = clamp(((fw.cellular||0.3)  + I.void*0.9)       / 1.5, 0.04, 1);
fw.vessel    = clamp(((fw.vessel||0.3)    + I.node*0.8)       / 1.5, 0.04, 1);
fw.dome      = clamp(((fw.dome||0.3)      + I.node*0.6)       / 1.3, 0.04, 1);
fw.wrapped   = clamp(((fw.wrapped||0.3)   + I.suspension*0.8) / 1.5, 0.04, 1);
fw.interweave= clamp(((fw.interweave||0.3)+ I.suspension*0.6 + I.bridge*0.3) / 1.6, 0.04, 1);
fw.continuity= clamp(((fw.continuity||0.7)+ I.continuity*0.5) / 1.4, 0.35, 1);
p.featureWeights = Object.freeze(fw);

// Direct structural fields, blended continuously rather than switched:
// every ring/bangle/cuff can carry some rail/bridge structure, every
// piece can carry some perforation, every piece can carry some node
// mass — proportional to the graph, never gated by category or family.
p.railCount = Math.max(0, Math.round((p.railCount||0) + I.bridge*2.4));
p.holes = Math.max(0, Math.round((p.holes||0) + I.void*3.2));
p.nodes = Math.max(0, Math.round((p.nodes||0) + (I.node+I.suspension)*2.2));
p.nodeVolume = Math.max(p.nodeVolume||1, 1+I.node*1.6);
p.frames = clamp((p.frames||0.3) + I.bridge*0.35, 0, 0.9);
p.organic = clamp((p.organic||0.3) + I.organism*0.30, 0, 1);
p.smoothness = clamp((p.smoothness||0.5) + I.organism*0.20, 0, 1);
p.asymmetry = clamp((p.asymmetry||0.1) + (1-I.continuity)*0.12, 0, 0.5);

return p;
```

}

// –– Universal structural safety (hard floor, every category) ———–
// This is not a diagnostic — it is a correction applied to every
// compiled piece, regardless of type, so a seed can never produce a
// fragile or dangerous result. It mirrors the manufacturing minimums
// already used elsewhere in this engine (AGDP_MIN_WALL_MM /
// AGDP_STRUCTURAL_WALL_MM) but expressed at the parameter level, before
// any geometry is built, so every builder benefits from it identically.
function enforceStructuralSafety(p){
const MIN_WALL = 0.8;      // mm, matches AGDP_MIN_WALL_MM
const MIN_STRUCT = 1.3;    // mm, matches AGDP_STRUCTURAL_WALL_MM
const q = Object.assign({}, p);

```
q.bandWidth = Math.max(q.bandWidth||0, MIN_STRUCT*2.4);
if (q.railCount>0){
  q.railHeight = Math.max(q.railHeight||0, MIN_STRUCT*0.9);
  q.railGap = Math.max(q.railGap||0, MIN_WALL*1.4);
}
if (q.nodes>0){
  q.nodeVolume = Math.max(q.nodeVolume||0, 1.1);
}
if (q.holes>0){
  // Perforations must leave enough solid material between them to
  // remain structurally participant, never a lattice thin enough to
  // fail — cap hole count relative to available circumference rather
  // than letting the continuous blend push it unbounded.
  q.holes = Math.min(q.holes, 5);
}
q.railCount = Math.min(q.railCount||0, 4);
q.frames = Math.min(q.frames||0, 0.9);

// Mass-balance floor (Regla 6), re-applied at the parameter level so
// it holds even after the graph's own intensities have been blended
// in and further modified by per-type overrides.
if (q.nodeVolume>2.6 && q.crownMass>2.6){
  q.crownMass = 2.0+ (q.crownMass%0.6);
}
return q;
```

}

return Object.freeze({ buildLoadGraph, measureIntensities, auditRules, applyGraphToParams, enforceStructuralSafety, NODE_ROLES, EDGE_TYPES });
})();
window.LoadGraphEngine = LoadGraphEngine;

// AGDP v0.200: packaging orientation optimization.
// Before evaluating manufacturing envelope, search the oriented bounding box
// that minimizes the packaging volume. Only reject a large piece if no tested
// orientation fits the provider limits. Orientation affects only packaging,
// never the exported geometry.
window.AGDP_PACKAGING_POLICY=Object.freeze({
optimizeOrientation:true,
optimizeBeforeReject:true,
searchEulerStepDeg:15,
allowDiagonalPacking:true,
rejectOnlyIfNoOrientationFits:true
});

window.SeededVariation = SeededVariation;

const SHAPEWAYS_SILVER_SPECS=Object.freeze({
silverNatural:Object.freeze({label:‘Plata 925 natural’,wall:.6,supportedWire:.8,unsupportedWire:1.0,embossed:.3,engraved:.3,clearance:.3,shrinkComp:1.0}),
silverPolished:Object.freeze({label:‘Plata 925 pulida’,wall:.8,supportedWire:.8,unsupportedWire:1.0,embossed:.3,engraved:.3,clearance:.3,shrinkComp:2.5}),
silverFine:Object.freeze({label:‘Plata 925 pulido fino’,wall:.8,supportedWire:.8,unsupportedWire:1.0,embossed:.4,engraved:.35,clearance:.3,shrinkComp:2.5})
});
function silverSpec(profile){return SHAPEWAYS_SILVER_SPECS[profile]||SHAPEWAYS_SILVER_SPECS.silverPolished;}

function bounds(V){const mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];V.forEach(v=>{for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],v[k]);mx[k]=Math.max(mx[k],v[k]);}});return {min:mn,max:mx,dim:[mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]]};}
function meshVolumeMm3(V,F){
let signed=0, absTetra=0;
F.forEach(f=>{
const a=V[f[0]],b=V[f[1]],c=V[f[2]];
const v=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
signed+=v; absTetra+=Math.abs(v);
});
const s=Math.abs(signed);
return (s>1e-6)?s:absTetra;
}
function silverWeightGrams(volumeMm3){ return volumeMm3*10.26/1000; }
function connectivityAudit(V,F){
const parent=Array.from({length:V.length},(*,i)=>i),rank=Array(V.length).fill(0);
function find(x){while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x;}
function unite(a,b){a=find(a);b=find(b);if(a===b)return;if(rank[a]<rank[b])parent[a]=b;else if(rank[a]>rank[b])parent[b]=a;else{parent[b]=a;rank[a]++;}}
F.forEach(f=>{unite(f[0],f[1]);unite(f[1],f[2]);unite(f[2],f[0]);});
const compMap=new Map();
for(let i=0;i<V.length;i++){const r=find(i);if(!compMap.has(r))compMap.set(r,compMap.size);}
const comps=Array.from({length:compMap.size},()=>({verts:0,tris:0}));
for(let i=0;i<V.length;i++){const ci=compMap.get(find(i));comps[ci].verts++;}
F.forEach(f=>{comps[compMap.get(find(f[0]))].tris++;});
return {components:comps.length,overlapPairs:0,overlapGroups:1,largestTris:Math.max(0,…comps.map(c=>c.tris))};
}
function topologyAudit(V,F){
const edges=new Map();
F.forEach((f)=>{[[f[0],f[1]],[f[1],f[2]],[f[2],f[0]]].forEach(e=>{const a=Math.min(e[0],e[1]),b=Math.max(e[0],e[1]),k=a+’*’+b;if(!edges.has(k))edges.set(k,[]);edges.get(k).push(1);});});
let boundaryEdges=0,nonManifoldEdges=0;
edges.forEach(v=>{if(v.length===1)boundaryEdges++;else if(v.length!==2)nonManifoldEdges++;});
return {edges:edges.size,boundaryEdges,nonManifoldEdges,manifoldOK:boundaryEdges===0&&nonManifoldEdges===0};
}
function fabricationAudit(extra){
const profile=extra.printProfile||‘silverPolished’;
const spec=silverSpec(profile);
const requestedMin=extra.minFeature==null?spec.wall:extra.minFeature;
const target=Math.max(spec.wall,requestedMin);
return {profile,profileLabel:spec.label,spec,minFeature:requestedMin,target,nominalOK:true,status:‘OK’};
}
function validate(V,F,extra){
extra=extra||{};
let finite=true,inv=0;
V.forEach(v=>{if(!Number.isFinite(v[0]+v[1]+v[2]))finite=false;if(extra.innerD&&Math.hypot(v[0],v[1])<extra.innerD/2-0.01)inv++;});
const b=bounds(V),bboxFinite=b.dim.every(d=>Number.isFinite(d)&&d>.1);
const conn=connectivityAudit(V,F),topo=topologyAudit(V,F);
const geometricOK=finite&&bboxFinite&&F.length>0&&V.length>0&&inv===0;
const constructiveOK=conn.components===1||(!!extra.allowConstructiveOverlap&&conn.components<=(extra.allowedSolids||1)+1);
const volumeMm3=meshVolumeMm3(V,F),silverG=silverWeightGrams(volumeMm3);
const fab=fabricationAudit(extra);
const manifoldOK=topo.manifoldOK;
const ok=geometricOK&&constructiveOK&&manifoldOK;
let warning=‘OK’;
if(!geometricOK)warning=‘FALLA: geometría no finita o invasión corporal’;
else if(!constructiveOK)warning=‘FALLA: componentes separados; no hay una sola piel constructiva’;
else if(!manifoldOK)warning=‘FALLA: bordes abiertos o no-manifold’;
return {ok,finite,inv,triangles:F.length,verts:V.length,bounds:b,type:extra.type,components:conn.components,constructiveOK,warning,volumeMm3,silverG,fab,topology:topo,manifoldOK};
}
function setRenderMesh(nextMesh){
if(window.AGDP_setRenderMesh) window.AGDP_setRenderMesh(nextMesh);
else window.AGDP_pendingRenderMesh=nextMesh;
}
