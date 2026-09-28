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
  window.AGDP_Gemstones=Object.freeze({VERSION,FACETED,CABOCHON,SLAB,PEARL,CUTS,plan,threeGroup,basisFromNormal});
})();
