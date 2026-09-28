'use strict';
/* AGDP Gemstone Layer v1.0 — deterministic, geometry-aware, non-destructive stone bodies. */
(function(){
  const VERSION='8.2.0';
  const FACETED=[
    ['diamond',0xffffff,2.417],['ruby',0x9b111e,1.77],['sapphire',0x174a8b,1.77],['emerald',0x168f5b,1.58],
    ['spinel',0xc43b66,1.72],['paraiba-tourmaline',0x24d8cf,1.62],['tourmaline',0x3a9d72,1.62],['aquamarine',0x8ed7e8,1.58],
    ['topaz',0x7bc9e8,1.61],['morganite',0xf3b6ad,1.58],['garnet',0x7f1624,1.79],['amethyst',0x75439a,1.54],
    ['citrine',0xe5ad32,1.54],['peridot',0x86a83e,1.65],['tanzanite',0x4b54a8,1.69]
  ];
  const CABOCHON=[
    ['opal',0xe9e3cf,.18],['carnelian',0xb84d27,.62],['onyx',0x111111,.92],['jadeite',0x5e9b72,.88],
    ['turquoise',0x45aeb3,.96],['moonstone',0xdde2dd,.34],['labradorite',0x667d80,.58],['chalcedony',0xb8cbd4,.52]
  ];
  const SLAB=[
    ['malachite',0x1d713f],['onyx',0x101010],['lapis-lazuli',0x183c8c],['mother-of-pearl',0xf1eee6],
    ['turquoise',0x45aeb3],['rock-crystal',0xe8edf0]
  ];
  const PEARL=[
    ['freshwater-baroque',0xf0e8dc],['freshwater-round',0xf4eee5],['akoya',0xf4efe8],['south-sea-white',0xf2eee3],
    ['south-sea-golden',0xd9bd78],['tahitian-black',0x343b3b],['tahitian-grey',0x697071]
  ];
  const CUTS=['asscher','cushion','emerald','princess','baguette'];
  const CUT_WEIGHTS=[['asscher',.26],['cushion',.25],['emerald',.23],['princess',.17],['baguette',.09]];
  const SUPPORTED=new Set(['ring','pendant','bangle','cuffBracelet','brooch','earCuff','hoopEarring','cufflinks']);
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const vadd=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
  const vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const vmul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];};
  function bounds(V){const mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];for(const v of V)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],v[k]);mx[k]=Math.max(mx[k],v[k]);}return {min:mn,max:mx,dim:mx.map((x,k)=>x-mn[k]),center:mx.map((x,k)=>(x+mn[k])*.5)};}
  function vertexNormals(V,F){const n=V.map(()=>[0,0,0]);for(const f of F){const a=V[f[0]],b=V[f[1]],c=V[f[2]],q=cross(vsub(b,a),vsub(c,a));for(const i of f)n[i]=vadd(n[i],q);}return n.map(norm);}
  function pickWeighted(rng,items){let total=items.reduce((s,x)=>s+x[1],0),r=rng()*total;for(const x of items){r-=x[1];if(r<=0)return x[0];}return items[items.length-1][0];}
  function materialChoice(rng,family){const a=family==='faceted'?FACETED:family==='cabochon'?CABOCHON:family==='slab'?SLAB:PEARL;return a[Math.floor(rng()*a.length)];}
  function candidateSites(V,F,type,count,rng,preferVoid){
    const b=bounds(V), ns=vertexNormals(V,F), c=b.center, diag=Math.hypot(...b.dim)||1, stride=Math.max(1,Math.floor(V.length/2200));
    const scored=[];
    for(let i=0;i<V.length;i+=stride){
      const p=V[i],n=ns[i],delta=vsub(p,c),r=norm(delta),outward=dot(n,r);
      const radial=Math.hypot(...delta)/diag;
      let axis=(type==='ring'||type==='bangle'||type==='earCuff'||type==='cuffBracelet'||type==='hoopEarring')?.5+.5*Math.abs(n[2]):.5+.5*Math.max(0,n[2]);
      // Window/void edges tend to carry normals that are less purely outward than exterior skins.
      // When the source morphology contains holes/frames, reward those inward/oblique boundary surfaces.
      const voidAffinity=preferVoid?clamp((.62-outward)/.72,0,1):0;
      if(!preferVoid && outward<.34)continue;
      if(preferVoid && outward<-.48)continue;
      scored.push({p:p.slice(),n:n.slice(),voidAffinity,score:(preferVoid?voidAffinity*.54:outward*.46)+axis*.20+radial*.16+rng()*.10});
    }
    scored.sort((a,b)=>b.score-a.score);
    const out=[],minSep=diag*(count>4?.065:.115);
    for(const q of scored){if(out.every(o=>Math.hypot(...vsub(q.p,o.p))>minSep)){out.push(q);if(out.length>=count)break;}}
    return out;
  }
  function highJewelryProgram(params){
    const seed=String(params.seed||'AGDP');
    const rng=window.SeededVariation.createGenerator(seed+'|agdp-high-jewelry-v4-focal-mass');
    const type=params.type;
    if(!SUPPORTED.has(type))return {enabled:false,reason:'unsupported-typology',seed};
    const hasVoids=(Number(params.holes)||0)>0||(Number(params.frames)||0)>.18;
    const regime=pickWeighted(rng,hasVoids?
      [['block',.42],['slab-inlay',.30],['cabochon',.20],['pearl',.08]]:
      [['block',.52],['cabochon',.27],['slab-inlay',.13],['pearl',.08]]);
    const family=regime==='block'?'faceted':regime==='cabochon'?'cabochon':regime==='pearl'?'pearl':'slab';
    const material=materialChoice(rng,family);
    const cut=family==='faceted'?pickWeighted(rng,CUT_WEIGHTS):family==='cabochon'?'cabochon':family==='slab'?'slab':'pearl';
    const mounting=family==='pearl'?'post-cup':family==='slab'?(hasVoids?'inlay-window':'inlay'):
      family==='cabochon'?pickWeighted(rng,[['inlay',.48],['prong',.34],['partial-bezel',.18]]):
      (hasVoids?pickWeighted(rng,[['invisible-window',.60],['prong',.28],['channel-capture',.12]]):pickWeighted(rng,[['prong',.54],['invisible',.31],['channel-capture',.15]]));
    return {enabled:true,seed:seed+'|agdp-high-jewelry-v4-focal-mass',regime,family,material,cut,mounting,hasVoids,
      grammar:'AGDP_HIGH_JEWELRY_V4_FOCAL_MASS',replaceMetalFocus:true};
  }
  function prepareGeometry(p){
    const program=highJewelryProgram(p);
    p.highJewelryProgram=program;
    if(!program.enabled)return p;
    if(!window.AGDP_Lapidary)throw new Error('AGDP V8: lapidary specification is not loaded');
    const rng=window.SeededVariation.createGenerator(program.seed+'|primary-volume-v8-lapidary');
    const family=program.family, cut=program.cut;
    const bandLike=['ring','bangle','cuffBracelet','earCuff','hoopEarring'].includes(p.type);
    const small=p.type==='ring'||p.type==='earCuff'||p.type==='hoopEarring'||p.type==='cufflinks';
    const bw=Math.max(2.2,Number(p.bandWidth)||3.6);
    let widthMm;
    if(bandLike) widthMm=clamp(bw*(small?(1.75+rng()*.55):(2.0+rng()*.72)),small?6.2:8.0,small?10.8:15.5);
    else if(p.type==='cufflinks') widthMm=clamp((Number(p.mainSize)||16)*(.42+rng()*.13),7.0,11.5);
    else widthMm=clamp((Number(p.mainSize)||28)*(.30+rng()*.14),8.0,17.5);
    const lapidary=window.AGDP_Lapidary.build(family,cut,widthMm,rng);
    const policy=window.AGDP_Lapidary.settingPolicy(program.material[0],lapidary);
    const mounting=policy.preferred;
    p.primaryGemVolume={id:1,family,material:program.material[0],color:program.material[1],ior:family==='faceted'?program.material[2]:1.52,
      cut,mounting,sizeMm:lapidary.widthMm,aspect:lapidary.lengthMm/lapidary.widthMm,lengthMm:lapidary.lengthMm,widthMm:lapidary.widthMm,depthMm:lapidary.depthMm,
      lapidary,settingPolicy:policy,seed:program.seed+'|primary-volume-v8-lapidary',primaryVolume:true,stoneFirst:true};
    p.highJewelryOriginalFocus={nodes:p.nodes||0,nodeVolume:p.nodeVolume||0,rivets:p.rivets||0,screws:p.screws||0};
    p.nodes=0; p.rivets=0; p.screws=0;
    return p;
  }
  function semanticAnchor(V,F,p){
    const program=p&&p.highJewelryProgram;
    if(!program||!program.enabled||!V||!V.length)return null;
    const b=bounds(V),type=p.type;
    let pos,normal,scaleRef,role;
    if(type==='ring'||type==='bangle'||type==='earCuff'||type==='cuffBracelet'||type==='hoopEarring'){
      // Exterior radial focal zone, never the bore/body-contact surface.
      let best=null,bestScore=-Infinity;
      for(const v of V){
        const radial=Math.hypot(v[0],v[1]);
        const zPenalty=Math.abs(v[2]-b.center[2])/(b.dim[2]||1);
        const score=radial-zPenalty*Math.max(1,b.dim[2])*.22;
        if(score>bestScore){bestScore=score;best=v;}
      }
      const r=Math.hypot(best[0],best[1])||1; normal=[best[0]/r,best[1]/r,0]; pos=best.slice();
      scaleRef=Math.max(p.bandWidth||b.dim[2],Math.min(b.dim[0],b.dim[1])*.32); role='replaced-exterior-focus';
    }else if(type==='brooch'){
      // Brooch mechanism lives posteriorly. Mineral mass is forced to the front face (+Z), near its visual centre.
      const z=b.max[2]; pos=[b.center[0],b.center[1],z]; normal=[0,0,1];
      scaleRef=Math.min(b.dim[0],b.dim[1]); role='front-focal-mass-protected-from-clip';
    }else{
      // Pendant and other face-like bodies: use the presentation front, not an arbitrary side vertex.
      const z=b.max[2]; pos=[b.center[0],b.center[1],z]; normal=[0,0,1];
      scaleRef=Math.min(b.dim[0],b.dim[1]); role='front-focal-mass';
    }
    return {position:pos,normal,scaleRef,role,bounds:b};
  }
  function plan(mesh,params){
    const cp=mesh.compiledParams||params||{};
    const program=cp.highJewelryProgram||highJewelryProgram(cp);
    if(!program.enabled)return {version:VERSION,enabled:false,reason:program.reason||'metal-only',stones:[]};
    if(cp.highJewelryResolvedStone){
      return {version:VERSION,enabled:true,seed:program.seed,family:program.family,mode:'LAPIDARY_PRIMARY_VOLUME',regime:program.regime,hasVoids:program.hasVoids,grammar:'AGDP_HIGH_JEWELRY_V8_LAPIDARY_PRIMARY_VOLUME',replaceMetalFocus:true,setting:cp.highJewelrySettingV8||cp.highJewelrySettingV7||cp.highJewelrySettingV6||cp.highJewelrySettingV5||null,stones:[cp.highJewelryResolvedStone]};
    }
    const anchor=mesh.gemstoneAnchor||semanticAnchor(mesh.V,mesh.F,cp);
    if(!anchor)return {version:VERSION,enabled:false,reason:'no-semantic-focal-anchor',stones:[]};
    const rng=window.SeededVariation.createGenerator(program.seed+'|dimensions');
    const family=program.family,cut=program.cut;
    // Focal mass is deliberately large. Face-like pieces use 36–58% of the minor envelope;
    // band pieces use a multiple of band width so the mineral visibly replaces a node/event mass.
    const faceLike=cp.type==='brooch'||cp.type==='pendant';
    let size=faceLike?anchor.scaleRef*(.36+rng()*.22):anchor.scaleRef*(1.18+rng()*.72);
    size=clamp(size, family==='pearl'?5.5:6.0, faceLike?22.0:16.0);
    const aspect=cut==='emerald'?1.42:cut==='baguette'?1.72:family==='slab'?1.38:cut==='cushion'?1.08:1;
    const stone={id:1,family,material:program.material[0],color:program.material[1],ior:family==='faceted'?program.material[2]:1.52,
      cut,mounting:program.mounting,sizeMm:+size.toFixed(2),position:anchor.position,normal:anchor.normal,aspect,
      structuralRole:anchor.role,replaceMetalFocus:true};
    return {version:VERSION,enabled:true,seed:program.seed,family,mode:'FOCAL_MASS',regime:program.regime,
      hasVoids:program.hasVoids,grammar:program.grammar,replaceMetalFocus:true,stones:[stone]};
  }
  function basisFromNormal(n){const z=norm(n),ref=Math.abs(z[2])>.86?[1,0,0]:[0,0,1],x=norm(cross(ref,z)),y=norm(cross(z,x));return {x,y,z};}
  function threeGroup(THREE,plan,center){
    const group=new THREE.Group();group.name='AGDP_Gemstones';group.userData.gemstonePlan=plan;
    if(!plan||!plan.enabled)return group;
    for(const s of plan.stones){
      const radius=(s.widthMm||s.sizeMm)*.5; let geo;
      const gm=cutPart(s), positions=[];
      for(const f of gm.F){for(const idx of f){const v=gm.V[idx];positions.push(v[0]-(center?center[0]:0),v[1]-(center?center[1]:0),v[2]-(center?center[2]:0));}}
      geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();
      let material;
      if(s.family==='faceted') material=new THREE.MeshPhysicalMaterial({color:s.color,roughness:.04,metalness:0,transmission:.72,thickness:radius*.8,ior:s.ior||1.6,envMapIntensity:1.35,transparent:true,opacity:.96});
      else if(s.family==='pearl') material=new THREE.MeshPhysicalMaterial({color:s.color,roughness:.24,metalness:0,clearcoat:.55,clearcoatRoughness:.18,ior:1.53,envMapIntensity:1.05});
      else material=new THREE.MeshPhysicalMaterial({color:s.color,roughness:s.material==='mother-of-pearl'?.22:.30,metalness:0,clearcoat:.22,ior:1.5,envMapIntensity:.9});
      const m=new THREE.Mesh(geo,material);m.name='AGDP_Gem_'+s.id+'_'+s.material;
      m.castShadow=true;group.add(m);
    }
    return group;
  }
  const SPECIFIC_GRAVITY=Object.freeze({
    diamond:3.52,ruby:4.00,sapphire:4.00,emerald:2.76,spinel:3.60,'paraiba-tourmaline':3.06,tourmaline:3.06,aquamarine:2.72,topaz:3.53,morganite:2.80,garnet:3.90,amethyst:2.65,citrine:2.65,peridot:3.34,tanzanite:3.35,
    opal:2.15,carnelian:2.61,onyx:2.65,jadeite:3.34,turquoise:2.70,moonstone:2.58,labradorite:2.70,chalcedony:2.60,malachite:3.90,'lapis-lazuli':2.75,'mother-of-pearl':2.75,'rock-crystal':2.65,
    'freshwater-baroque':2.70,'freshwater-round':2.70,akoya:2.70,'south-sea-white':2.70,'south-sea-golden':2.70,'tahitian-black':2.70,'tahitian-grey':2.70
  });
  function stoneVolumeMm3(stone){
    const d=stone.sizeMm||1,a=stone.aspect||1;
    if(stone.family==='pearl')return Math.PI/6*d*d*d*a;
    if(stone.family==='slab')return Math.PI*(d*.5)*(d*.5*a)*Math.max(.7,d*.16);
    if(stone.family==='cabochon')return (2/3)*Math.PI*(d*.5)*(d*.5*a)*(d*.34);
    const cutFactor=stone.cut==='rose-cut'?.30:stone.cut==='emerald'||stone.cut==='asscher'||stone.cut==='baguette'?.40:.43;
    return Math.PI*(d*.5)*(d*.5*a)*(d*cutFactor)/3;
  }
  function meshVolumeMm3(V,F){let v=0;for(const f of F){const a=V[f[0]],b=V[f[1]],c=V[f[2]];v+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;}return Math.abs(v);}
  function weightSummary(plan){
    let grams=0;
    for(const stone of ((plan&&plan.stones)||[])){const sg=(window.AGDP_Lapidary&&window.AGDP_Lapidary.MATERIALS[stone.material]&&window.AGDP_Lapidary.MATERIALS[stone.material].sg)||SPECIFIC_GRAVITY[stone.material]||2.70;let vol;try{const m=cutPart(stone);vol=meshVolumeMm3(m.V,m.F);}catch(e){vol=stoneVolumeMm3(stone);}grams+=vol*sg/1000;}
    return {grams,carats:grams/0.2};
  }
  function localToWorld(local,stone){const b=basisFromNormal(stone.normal),p=stone.position;return [p[0]+b.x[0]*local[0]+b.y[0]*local[1]+b.z[0]*local[2],p[1]+b.x[1]*local[0]+b.y[1]*local[1]+b.z[1]*local[2],p[2]+b.x[2]*local[0]+b.y[2]*local[1]+b.z[2]*local[2]];}
  function ellipsoidPart(stone){
    // Closed ellipsoid with single pole vertices. The V8 implementation duplicated
    // each pole 24 times, producing degenerate triangles and open/non-manifold input.
    const V=[],F=[],nu=32,nv=12,r=stone.sizeMm*.5,asp=stone.aspect||1;
    const top=V.length; V.push(localToWorld([0,0,r],stone));
    for(let j=1;j<nv;j++){const phi=Math.PI*j/nv;for(let i=0;i<nu;i++){const th=2*Math.PI*i/nu;V.push(localToWorld([r*asp*Math.sin(phi)*Math.cos(th),r*Math.sin(phi)*Math.sin(th),r*Math.cos(phi)],stone));}}
    const bottom=V.length; V.push(localToWorld([0,0,-r],stone));
    const first=1,last=1+(nv-2)*nu;
    for(let i=0;i<nu;i++){const k=(i+1)%nu;F.push([top,first+i,first+k]);}
    for(let j=0;j<nv-2;j++){const a0=1+j*nu,b0=a0+nu;for(let i=0;i<nu;i++){const k=(i+1)%nu;F.push([a0+i,b0+i,b0+k],[a0+i,b0+k,a0+k]);}}
    for(let i=0;i<nu;i++){const k=(i+1)%nu;F.push([bottom,last+k,last+i]);}
    return {V,F};
  }
  function outline2D(stone,scale){
    const L=(stone.lengthMm||stone.sizeMm*(stone.aspect||1))*scale*.5,W=(stone.widthMm||stone.sizeMm)*scale*.5,lap=stone.lapidary||{};
    if(stone.cut==='asscher'||stone.cut==='emerald'||stone.cut==='baguette'){
      const c=Math.max(.02,Math.min(.28,lap.cornerCut||.10)),cx=L*(1-c),cy=W*(1-c);
      return [[-cx,-W],[cx,-W],[L,-cy],[L,cy],[cx,W],[-cx,W],[-L,cy],[-L,-cy]];
    }
    if(stone.cut==='princess')return [[-L,-W],[L,-W],[L,W],[-L,W]];
    if(stone.cut==='cushion'){
      const q=.72;return [[-L*q,-W], [L*q,-W],[L,-W*q],[L,W*q],[L*q,W],[-L*q,W],[-L,W*q],[-L,-W*q]];
    }
    const seg=16,out=[];for(let i=0;i<seg;i++){const a=2*Math.PI*i/seg;out.push([L*Math.cos(a),W*Math.sin(a)]);}return out;
  }
  function ringMesh(stone,rings){
    const V=[],F=[],counts=[];
    for(const rg of rings){const pts=outline2D(stone,rg.scale);counts.push(pts.length);for(const q of pts)V.push(localToWorld([q[0],q[1],rg.z],stone));}
    let off=0;for(let k=0;k<rings.length-1;k++){const n=counts[k],m=counts[k+1],off2=off+n;if(n!==m)throw new Error('AGDP lapidary ring mismatch');for(let i=0;i<n;i++){const j=(i+1)%n;F.push([off+i,off+j,off2+j],[off+i,off2+j,off2+i]);}off=off2;}
    const top=V.length;V.push(localToWorld([0,0,rings[0].z],stone));for(let i=0;i<counts[0];i++)F.push([top,i,(i+1)%counts[0]]);
    const baseOff=counts.slice(0,-1).reduce((a,b)=>a+b,0),bn=counts[counts.length-1],bot=V.length;V.push(localToWorld([0,0,rings[rings.length-1].z],stone));for(let i=0;i<bn;i++)F.push([bot,baseOff+(i+1)%bn,baseOff+i]);
    return {V,F};
  }
  function cutPart(stone){
    if(stone.family==='pearl')return ellipsoidPart(stone);
    const lap=stone.lapidary||{},D=stone.depthMm||stone.sizeMm*.55;
    if(stone.family==='slab'){
      const t=lap.thicknessMm||D;return ringMesh(stone,[{scale:1,z:t*.5},{scale:1,z:-t*.5}]);
    }
    if(stone.family==='cabochon'){
      // Closed cabochon: one apex, dome rings, vertical/base ring and bottom cap.
      const V=[],F=[],nu=32,nv=10,L=(stone.lengthMm||stone.sizeMm*(stone.aspect||1))*.5,W=(stone.widthMm||stone.sizeMm)*.5,H=(lap.domeHeightMm||D*.72),base=Math.max(.55,lap.baseMm||D-H);
      const apex=V.length;V.push(localToWorld([0,0,H],stone));
      for(let j=1;j<=nv;j++){const ph=(Math.PI*.5)*j/nv,rr=Math.sin(ph),z=H*Math.cos(ph);for(let i=0;i<nu;i++){const a=2*Math.PI*i/nu;V.push(localToWorld([L*rr*Math.cos(a),W*rr*Math.sin(a),z],stone));}}
      for(let i=0;i<nu;i++){const k=(i+1)%nu;F.push([apex,1+i,1+k]);}
      for(let j=0;j<nv-1;j++){const a0=1+j*nu,b0=a0+nu;for(let i=0;i<nu;i++){const k=(i+1)%nu;F.push([a0+i,b0+i,b0+k],[a0+i,b0+k,a0+k]);}}
      const rim=1+(nv-1)*nu,baseOff=V.length;for(let i=0;i<nu;i++){const a=2*Math.PI*i/nu;V.push(localToWorld([L*Math.cos(a),W*Math.sin(a),-base],stone));}
      for(let i=0;i<nu;i++){const k=(i+1)%nu;F.push([rim+i,baseOff+i,baseOff+k],[rim+i,baseOff+k,rim+k]);}
      const bottom=V.length;V.push(localToWorld([0,0,-base],stone));for(let i=0;i<nu;i++){const k=(i+1)%nu;F.push([bottom,baseOff+k,baseOff+i]);}
      return {V,F};
    }
    const crown=lap.crownHeightMm||D*.18,g=lap.girdleMm||Math.max(.15,D*.05),pav=lap.pavilionDepthMm||Math.max(.5,D-crown-g);
    const tableScale=Math.sqrt(Math.max(.18,Math.min(.82,lap.tablePct||.60)));
    if(stone.cut==='asscher'||stone.cut==='emerald'||stone.cut==='baguette')return ringMesh(stone,[{scale:tableScale,z:crown+g*.5},{scale:.84,z:crown*.48+g*.5},{scale:1,z:g*.5},{scale:.78,z:-pav*.36},{scale:.34,z:-pav*.82},{scale:.08,z:-pav}]);
    if(stone.cut==='princess')return ringMesh(stone,[{scale:tableScale,z:crown+g*.5},{scale:1,z:g*.5},{scale:.72,z:-pav*.35},{scale:.34,z:-pav*.72},{scale:.035,z:-pav}]);
    return ringMesh(stone,[{scale:tableScale,z:crown+g*.5},{scale:.86,z:crown*.45+g*.5},{scale:1,z:g*.5},{scale:.68,z:-pav*.45},{scale:.08,z:-pav}]);
  }
  function objParts(plan){if(!plan||!plan.enabled)return [];return plan.stones.map(stone=>{const m=cutPart(stone);return {name:'GEM_'+stone.id+'_'+stone.material,material:'GEM_'+stone.material,V:m.V,F:m.F};});}
  window.AGDP_Gemstones=Object.freeze({VERSION,FACETED,CABOCHON,SLAB,PEARL,CUTS,CUT_WEIGHTS,SPECIFIC_GRAVITY,prepareGeometry,semanticAnchor,plan,threeGroup,basisFromNormal,weightSummary,objParts,meshPart:cutPart});
})();
