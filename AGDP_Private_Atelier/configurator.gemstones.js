'use strict';
/* AGDP Gemstone Layer v1.0 — deterministic, geometry-aware, non-destructive stone bodies. */
(function(){
  const VERSION='1.0.0';
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
  const CUTS=['round-brilliant','oval','emerald','asscher','cushion','princess','pear','marquise','trillion','baguette','rose-cut'];
  const SUPPORTED=new Set(['ring','pendant','bangle','cuffBracelet','brooch','earCuff']);
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
  function candidateSites(V,F,type,count,rng){
    const b=bounds(V), ns=vertexNormals(V,F), c=b.center, diag=Math.hypot(...b.dim)||1, stride=Math.max(1,Math.floor(V.length/1800));
    const scored=[];
    for(let i=0;i<V.length;i+=stride){
      const p=V[i],n=ns[i],r=norm(vsub(p,c));
      const outward=dot(n,r); if(outward<.38)continue;
      let axis=.5;
      if(type==='ring'||type==='bangle'||type==='earCuff'||type==='cuffBracelet') axis=.5+.5*Math.abs(n[2]);
      else axis=.5+.5*Math.max(0,n[2]);
      const radial=Math.hypot(...vsub(p,c))/diag;
      scored.push({p:p.slice(),n:n.slice(),score:outward*.48+axis*.28+radial*.18+rng()*.06});
    }
    scored.sort((a,b)=>b.score-a.score);
    const out=[]; const minSep=diag*(count>4?.075:.13);
    for(const s of scored){if(out.every(o=>Math.hypot(...vsub(s.p,o.p))>minSep)){out.push(s);if(out.length>=count)break;}}
    return out;
  }
  function plan(mesh,params){
    const type=(mesh.audit&&mesh.audit.type)||params.type;
    if(!SUPPORTED.has(type))return {version:VERSION,enabled:false,reason:'typology-not-yet-supported',stones:[]};
    const seed=String(params.seed||'AGDP'); const rng=window.SeededVariation.createGenerator(seed+'|gemstones-v1');
    if(rng()<.16)return {version:VERSION,enabled:false,reason:'seed-selected-no-stone',stones:[]};
    const family=pickWeighted(rng,[['faceted',.48],['cabochon',.23],['slab',.14],['pearl',.15]]);
    const mode=family==='slab'?'focal':family==='pearl'?pickWeighted(rng,[['focal',.65],['cluster',.35]]):pickWeighted(rng,[['focal',.43],['paired',.13],['cluster',.20],['constellation',.12],['sequence',.08],['pave',.04]]);
    let count=mode==='focal'?1:mode==='paired'?2:mode==='cluster'?2+Math.floor(rng()*4):mode==='constellation'?3+Math.floor(rng()*5):mode==='sequence'?3+Math.floor(rng()*5):8+Math.floor(rng()*9);
    if(family==='slab')count=1;
    const b=bounds(mesh.V), scale=clamp(Math.min(...b.dim.filter(x=>x>0))*0.18,1.3,8.5);
    const sites=candidateSites(mesh.V,mesh.F,type,count,rng); if(!sites.length)return {version:VERSION,enabled:false,reason:'no-safe-candidate',stones:[]};
    count=Math.min(count,sites.length);
    const mat=materialChoice(rng,family), stones=[];
    for(let i=0;i<count;i++){
      let size=scale*(mode==='pave'?(0.18+rng()*.12):(i===0?.72+rng()*.48:.35+rng()*.38));
      size=clamp(size,family==='pearl'?2.4:.9,family==='slab'?10:family==='pearl'?8:6.5);
      const cut=family==='faceted'?CUTS[Math.floor(rng()*CUTS.length)]:family==='cabochon'?'cabochon':family==='slab'?'slab':'pearl';
      const mounting=family==='pearl'?'post-cup':family==='slab'?'frame':mode==='pave'?'bead-pave':pickWeighted(rng,[['bezel',.50],['prong',.28],['flush',.12],['half-bezel',.10]]);
      stones.push({id:i+1,family,material:mat[0],color:mat[1],ior:family==='faceted'?mat[2]:1.52,cut,mounting,sizeMm:+size.toFixed(2),position:sites[i].p,normal:sites[i].n,aspect:cut==='marquise'||cut==='baguette'?1.75:cut==='pear'?1.45:cut==='oval'||cut==='emerald'?1.35:family==='slab'?1.55:1});
    }
    return {version:VERSION,enabled:true,seed:seed+'|gemstones-v1',family,mode,stones};
  }
  function basisFromNormal(n){const z=norm(n),ref=Math.abs(z[2])>.86?[1,0,0]:[0,0,1],x=norm(cross(ref,z)),y=norm(cross(z,x));return {x,y,z};}
  function threeGroup(THREE,plan,center){
    const group=new THREE.Group();group.name='AGDP_Gemstones';group.userData.gemstonePlan=plan;
    if(!plan||!plan.enabled)return group;
    for(const s of plan.stones){
      const radius=s.sizeMm*.5, h=Math.max(.55,radius*.72); let geo;
      if(s.family==='pearl') geo=new THREE.SphereGeometry(radius,40,28);
      else if(s.family==='cabochon') {geo=new THREE.SphereGeometry(radius,40,24,0,Math.PI*2,0,Math.PI*.58);geo.scale(s.aspect,1,h/radius);}
      else if(s.family==='slab') {geo=new THREE.CylinderGeometry(radius*.92,radius,Math.max(.7,radius*.32),s.cut==='slab'?10:24,1,false);geo.scale(s.aspect,1,1);}
      else {const seg=s.cut==='princess'||s.cut==='asscher'?4:s.cut==='trillion'?3:s.cut==='emerald'||s.cut==='baguette'?8:Math.max(12,Math.round(16));geo=new THREE.CylinderGeometry(radius*.18,radius,h,seg,2,false);geo.rotateX(Math.PI);geo.scale(s.aspect,1,1);}
      let material;
      if(s.family==='faceted') material=new THREE.MeshPhysicalMaterial({color:s.color,roughness:.04,metalness:0,transmission:.72,thickness:radius*.8,ior:s.ior||1.6,envMapIntensity:1.35,transparent:true,opacity:.96});
      else if(s.family==='pearl') material=new THREE.MeshPhysicalMaterial({color:s.color,roughness:.24,metalness:0,clearcoat:.55,clearcoatRoughness:.18,ior:1.53,envMapIntensity:1.05});
      else material=new THREE.MeshPhysicalMaterial({color:s.color,roughness:s.material==='mother-of-pearl'?.22:.30,metalness:0,clearcoat:.22,ior:1.5,envMapIntensity:.9});
      const m=new THREE.Mesh(geo,material);m.name='AGDP_Gem_'+s.id+'_'+s.material;
      const n=new THREE.Vector3(...s.normal).normalize(); const pos=vsub(s.position,center||[0,0,0]);
      m.position.set(pos[0]+n.x*radius*.20,pos[1]+n.y*radius*.20,pos[2]+n.z*radius*.20);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),n);m.castShadow=true;group.add(m);
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
  function weightSummary(plan){
    let grams=0;
    for(const stone of ((plan&&plan.stones)||[])){const sg=SPECIFIC_GRAVITY[stone.material]||2.70;grams+=stoneVolumeMm3(stone)*sg/1000;}
    return {grams,carats:grams/0.2};
  }
  function localToWorld(local,stone){const b=basisFromNormal(stone.normal),p=stone.position;return [p[0]+b.x[0]*local[0]+b.y[0]*local[1]+b.z[0]*local[2],p[1]+b.x[1]*local[0]+b.y[1]*local[1]+b.z[1]*local[2],p[2]+b.x[2]*local[0]+b.y[2]*local[1]+b.z[2]*local[2]];}
  function ellipsoidPart(stone){
    const V=[],F=[],nu=24,nv=12,r=stone.sizeMm*.5,asp=stone.aspect||1;
    for(let j=0;j<=nv;j++){const phi=Math.PI*j/nv;for(let i=0;i<nu;i++){const th=2*Math.PI*i/nu;const q=[r*asp*Math.sin(phi)*Math.cos(th),r*Math.sin(phi)*Math.sin(th),r*Math.cos(phi)];V.push(localToWorld(q,stone));}}
    for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const k=(i+1)%nu,a=j*nu+i,b=j*nu+k,c=(j+1)*nu+k,d=(j+1)*nu+i;F.push([a,b,c],[a,c,d]);}
    return {V,F};
  }
  function cutPart(stone){
    if(stone.family==='pearl')return ellipsoidPart(stone);
    const V=[],F=[],seg=(stone.cut==='trillion'?3:(stone.cut==='princess'||stone.cut==='asscher'?4:stone.cut==='slab'?10:16)),r=stone.sizeMm*.5,asp=stone.aspect||1;
    const depth=stone.family==='slab'?Math.max(.7,r*.32):stone.family==='cabochon'?r*.55:r*.72;
    const top=stone.family==='cabochon'?depth*.7:depth*.35,bot=-depth*.35;
    for(let i=0;i<seg;i++){const a=2*Math.PI*i/seg;V.push(localToWorld([r*asp*Math.cos(a),r*Math.sin(a),0],stone));}
    const ti=V.length;V.push(localToWorld([0,0,top],stone));const bi=V.length;V.push(localToWorld([0,0,bot],stone));
    for(let i=0;i<seg;i++){const j=(i+1)%seg;F.push([i,j,ti],[bi,j,i]);}
    return {V,F};
  }
  function objParts(plan){if(!plan||!plan.enabled)return [];return plan.stones.map(stone=>{const m=cutPart(stone);return {name:'GEM_'+stone.id+'_'+stone.material,material:'GEM_'+stone.material,V:m.V,F:m.F};});}
  window.AGDP_Gemstones=Object.freeze({VERSION,FACETED,CABOCHON,SLAB,PEARL,CUTS,SPECIFIC_GRAVITY,plan,threeGroup,basisFromNormal,weightSummary,objParts});
})();
