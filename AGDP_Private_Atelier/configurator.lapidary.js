'use strict';
/* AGDP Lapidary Specification v1.0
   Source classes are explicit: STANDARD_REPORTING, GIA_GUIDANCE, AGDP_DESIGN_RANGE.
   Fancy-cut proportions below are AGDP design ranges, not represented as GIA cut grades. */
(function(){
  const VERSION='1.0.0';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const CUTS=Object.freeze({
    asscher:{family:'step',lw:[1.00,1.06],depthPct:[0.62,0.72],tablePct:[0.54,0.66],crownPct:[0.12,0.18],girdlePct:[0.025,0.055],cornerCut:[0.16,0.22],keel:true,sourceClass:'AGDP_DESIGN_RANGE'},
    emerald:{family:'step',lw:[1.35,1.65],depthPct:[0.60,0.70],tablePct:[0.56,0.70],crownPct:[0.10,0.16],girdlePct:[0.025,0.055],cornerCut:[0.10,0.16],keel:true,sourceClass:'AGDP_DESIGN_RANGE'},
    baguette:{family:'step',lw:[1.55,2.20],depthPct:[0.55,0.68],tablePct:[0.58,0.76],crownPct:[0.08,0.14],girdlePct:[0.025,0.05],cornerCut:[0,0.04],keel:true,sourceClass:'AGDP_DESIGN_RANGE'},
    princess:{family:'modified-brilliant',lw:[1.00,1.08],depthPct:[0.64,0.78],tablePct:[0.58,0.74],crownPct:[0.08,0.15],girdlePct:[0.025,0.055],cornerCut:[0,0],pointedCorners:true,sourceClass:'AGDP_DESIGN_RANGE'},
    cushion:{family:'brilliant',lw:[1.00,1.18],depthPct:[0.60,0.72],tablePct:[0.52,0.66],crownPct:[0.10,0.17],girdlePct:[0.03,0.06],cornerRadius:[0.16,0.24],sourceClass:'AGDP_DESIGN_RANGE'}
  });
  const MATERIALS=Object.freeze({
    diamond:{sg:3.52,toughness:'good',cleavage:'perfect',settingRisk:'medium'}, ruby:{sg:4.00,toughness:'excellent',settingRisk:'low'}, sapphire:{sg:4.00,toughness:'excellent',settingRisk:'low'},
    emerald:{sg:2.76,toughness:'fair-poor',settingRisk:'high'}, spinel:{sg:3.60,toughness:'good',settingRisk:'low'}, 'paraiba-tourmaline':{sg:3.06,toughness:'fair',settingRisk:'high'}, tourmaline:{sg:3.06,toughness:'fair',settingRisk:'high'},
    aquamarine:{sg:2.72,toughness:'good',settingRisk:'medium'}, topaz:{sg:3.53,toughness:'poor-fair',cleavage:'perfect',settingRisk:'high'}, morganite:{sg:2.84,toughness:'good',settingRisk:'medium'}, garnet:{sg:3.90,toughness:'fair-good',settingRisk:'medium'},
    amethyst:{sg:2.65,toughness:'good',settingRisk:'medium'},citrine:{sg:2.65,toughness:'good',settingRisk:'medium'},peridot:{sg:3.34,toughness:'fair',settingRisk:'high'},tanzanite:{sg:3.35,toughness:'fair-poor',settingRisk:'high'},
    opal:{sg:2.15,toughness:'poor-fair',settingRisk:'high'},carnelian:{sg:2.61,toughness:'good',settingRisk:'medium'},onyx:{sg:2.65,toughness:'good',settingRisk:'medium'},jadeite:{sg:3.34,toughness:'exceptional',settingRisk:'low'},turquoise:{sg:2.70,toughness:'fair',settingRisk:'high'},moonstone:{sg:2.58,toughness:'poor',settingRisk:'high'},labradorite:{sg:2.70,toughness:'fair',settingRisk:'high'},chalcedony:{sg:2.60,toughness:'good',settingRisk:'medium'},
    malachite:{sg:3.90,toughness:'fair',settingRisk:'high'},'lapis-lazuli':{sg:2.75,toughness:'fair',settingRisk:'medium'},'mother-of-pearl':{sg:2.75,toughness:'fair',settingRisk:'high'},'rock-crystal':{sg:2.65,toughness:'good',settingRisk:'medium'}
  });
  function lerpRange(r,t){return r[0]+(r[1]-r[0])*t;}
  function facetSpec(cut,widthMm,rng){
    const c=CUTS[cut]||CUTS.asscher;
    const lw=lerpRange(c.lw,rng()), length=widthMm*lw;
    const depthPct=lerpRange(c.depthPct,rng()), depth=widthMm*depthPct;
    const tablePct=lerpRange(c.tablePct,rng()), crownPct=lerpRange(c.crownPct,rng()), girdlePct=lerpRange(c.girdlePct,rng());
    const crownHeight=widthMm*crownPct, girdle=widthMm*girdlePct, pavilionDepth=Math.max(.5,depth-crownHeight-girdle);
    return {cut,family:c.family,widthMm:+widthMm.toFixed(2),lengthMm:+length.toFixed(2),depthMm:+depth.toFixed(2),lw:+lw.toFixed(3),tablePct:+tablePct.toFixed(3),crownHeightMm:+crownHeight.toFixed(2),girdleMm:+girdle.toFixed(2),pavilionDepthMm:+pavilionDepth.toFixed(2),cornerCut:c.cornerCut?+lerpRange(c.cornerCut,rng()).toFixed(3):0,cornerRadius:c.cornerRadius?+lerpRange(c.cornerRadius,rng()).toFixed(3):0,pointedCorners:!!c.pointedCorners,keel:!!c.keel,sourceClass:c.sourceClass,measurementStandard:'length × width × depth (mm)'};
  }
  function cabochonSpec(widthMm,rng){const lw=1.0+rng()*.34,length=widthMm*lw, dome=widthMm*(.28+rng()*.18),base=Math.max(.8,widthMm*(.10+rng()*.06));return {cut:'cabochon',family:'cabochon',widthMm:+widthMm.toFixed(2),lengthMm:+length.toFixed(2),depthMm:+(dome+base).toFixed(2),lw:+lw.toFixed(3),domeHeightMm:+dome.toFixed(2),baseMm:+base.toFixed(2),sourceClass:'AGDP_DESIGN_RANGE'};}
  function slabSpec(widthMm,rng){const lw=1.20+rng()*.55,length=widthMm*lw,thickness=clamp(widthMm*(.12+rng()*.07),1.0,3.2);return {cut:'slab',family:'slab',widthMm:+widthMm.toFixed(2),lengthMm:+length.toFixed(2),depthMm:+thickness.toFixed(2),thicknessMm:+thickness.toFixed(2),lw:+lw.toFixed(3),sourceClass:'AGDP_DESIGN_RANGE'};}
  function pearlSpec(widthMm,rng){const lw=.94+rng()*.20;return {cut:'pearl',family:'pearl',widthMm:+widthMm.toFixed(2),lengthMm:+(widthMm*lw).toFixed(2),depthMm:+widthMm.toFixed(2),lw:+lw.toFixed(3),sourceClass:'GIA_SHAPE_MEASUREMENT_COMPATIBLE'};}
  function build(family,cut,widthMm,rng){return family==='faceted'?facetSpec(cut,widthMm,rng):family==='cabochon'?cabochonSpec(widthMm,rng):family==='slab'?slabSpec(widthMm,rng):pearlSpec(widthMm,rng);}
  function settingPolicy(material,lap){
    const m=MATERIALS[material]||{settingRisk:'medium'};
    if(lap.family==='slab')return {preferred:'inlay',allowed:['inlay'],protectGirdle:true};
    if(lap.family==='pearl')return {preferred:'post-cup',allowed:['post-cup'],protectGirdle:false};
    if(lap.family==='cabochon')return {preferred:m.settingRisk==='high'?'partial-bezel':'inlay',allowed:['partial-bezel','inlay','prong'],protectGirdle:m.settingRisk==='high'};
    if(lap.pointedCorners)return {preferred:'v-prong',allowed:['v-prong','channel-capture'],protectCorners:true,protectGirdle:m.settingRisk==='high'};
    if(m.settingRisk==='high')return {preferred:'partial-bezel',allowed:['partial-bezel','channel-capture'],protectGirdle:true};
    if(lap.family==='step')return {preferred:'corner-prong',allowed:['corner-prong','channel-capture','partial-bezel'],protectGirdle:false};
    return {preferred:'prong',allowed:['prong','partial-bezel'],protectGirdle:false};
  }
  window.AGDP_Lapidary=Object.freeze({VERSION,CUTS,MATERIALS,build,settingPolicy});
})();
