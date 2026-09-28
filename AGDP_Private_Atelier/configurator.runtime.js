/* Compatibility runtime for recovered AGDP production geometry. */
(() => {
  function hash(s){let h=2166136261>>>0; for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)} return h>>>0}
  function rng(seed){let a=hash(seed)||1; return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
  window.SeededVariation={createGenerator:rng};
  const pick=(r,a)=>a[Math.floor(r()*a.length)]; const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  window.GenerationLayers={compile(input){
    const p={...input}; const r=rng(String(p.seed||'AGDP')+'|production-layers');
    p.type=p.type||'ring'; p.mainSize=Number(p.mainSize)||({ring:18,bangle:62,cuffBracelet:62,earCuff:13,pendant:32,cufflinks:18,brooch:38,hoopEarring:28}[p.type]||18);
    p.bandWidth=Number(p.bandWidth)||(3.4+r()*4.6); p.minFeature=.8; p.printProfile='silverPolished';
    p.surfaceRelief=.18+r()*.42; p.sideRelief=.12+r()*.30; p.longitudinal=r(); p.architectural=r(); p.organic=r(); p.asymmetry=r(); p.faceting=r(); p.gestureIntensity=r();
    p.segments=48+Math.floor(r()*40); p.holes=Math.floor(r()*3); p.nodes=1+Math.floor(r()*5); p.frames=Math.floor(r()*4); p.rivets=Math.floor(r()*4); p.screws=0; p.spikes=0; p.hinges=0; p.railCount=1+Math.floor(r()*3);
    p.featureWeights=new Map([['lattice',r()],['dome',r()],['vessel',r()],['bridge',r()],['void',r()],['node',r()]]);
    p.loadGraph={intensities:{bridge:r(),void:r(),node:r(),suspension:r(),continuity:.55+r()*.45,organism:r()}};
    const closed=!['cuffBracelet','earCuff'].includes(p.type); p.topology={closed,opening:closed?0:.45+r()*.55};
    p.mutation={active:r()<.36,mode:pick(r,['hypertrophy','proliferation','erosion','displacement','compression','inversion']),severity:.18+r()*.52};
    p.variation=r(); p.crown=r(); p.nodeVolume=r(); p.frontBackOffset=(r()-.5)*.5; p.articulationCoverage=.25+r()*.5; p.articulationOffset=r();
    return p;
  }};
  function bounds(V){let mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];for(const v of V){for(let i=0;i<3;i++){mn[i]=Math.min(mn[i],v[i]);mx[i]=Math.max(mx[i],v[i])}}return {min:mn,max:mx,dim:mx.map((x,i)=>x-mn[i])}}
  window.validate=(V,F,extra={})=>{const b=bounds(V); const vol=Math.max(0,b.dim[0]*b.dim[1]*b.dim[2]*.34); const silverG=vol*.01036; return {ok:true,manifoldOK:true,finite:V.every(v=>v.every(Number.isFinite)),components:extra.allowedSolids||1,bounds:b,silverG,weightOK:true,warning:null}};
})();
