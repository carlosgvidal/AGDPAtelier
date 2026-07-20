(function(){
‘use strict’;

function ringSizeToDiameter(usSize){
const circumference = 36.5 + 2.55*usSize;
return circumference/Math.PI;
}
const RING_SIZES = [4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10,10.5,11,11.5,12,12.5,13].map(us=>{
const d = ringSizeToDiameter(us);
const euCirc = Math.round(36.5+2.55*us);
return {us, diameterMm: d, label_es:`US ${us} · EU ${euCirc} · ⌀ ${d.toFixed(1)}mm`, label_en:`US ${us} · EU ${euCirc} · ⌀ ${d.toFixed(1)}mm`};
});
const WRIST_SIZES = [
{key:‘xs’, circMm:145, label_es:‘XS · muñeca ~14.5cm’, label_en:‘XS · wrist ~14.5cm’},
{key:‘s’,  circMm:160, label_es:‘S · muñeca ~16cm’,   label_en:‘S · wrist ~16cm’},
{key:‘m’,  circMm:175, label_es:‘M · muñeca ~17.5cm’, label_en:‘M · wrist ~17.5cm’},
{key:‘l’,  circMm:190, label_es:‘L · muñeca ~19cm’,   label_en:‘L · wrist ~19cm’},
{key:‘xl’, circMm:205, label_es:‘XL · muñeca ~20.5cm’,label_en:‘XL · wrist ~20.5cm’},
].map(w=>Object.assign(w,{diameterMm: w.circMm/Math.PI + 8}));
const CHOKER_SIZES = [
{key:‘s’, label_es:‘S · cuello estrecho’, label_en:‘S · narrow neck’},
{key:‘m’, label_es:‘M · cuello medio’, label_en:‘M · medium neck’},
{key:‘l’, label_es:‘L · cuello amplio’, label_en:‘L · broad neck’},
];
const CHOKER_PROFILES = [
{
key:‘torque’, label_es:‘Torque · abierto, ligero y escultórico’, label_en:‘Torque · open, light and sculptural’,
hint_es:‘Arco abierto que abraza la base del cuello, con contacto posterior mínimo.’,
hint_en:‘Open arc around the base of the neck with minimal posterior contact.’,
widths:[115,122,130], depths:[92,98,106], openings:[60,66,72],
frontHeight:42, rearHeightRatio:.58, wall:4.8, frontDrop:8, rearLift:4, frontProjection:.030,
weightRange:[60,95]
},
{
key:‘cervical’, label_es:‘Collar cervical · envolvente y arquitectónico’, label_en:‘Cervical collar · enveloping and architectural’,
hint_es:‘Mayor superficie, apoyo distribuido y expansión controlada sobre las clavículas.’,
hint_en:‘Greater surface area, distributed support and controlled expansion over the clavicles.’,
widths:[118,126,134], depths:[96,104,112], openings:[62,66,72],
frontHeight:52, rearHeightRatio:.70, wall:5.6, frontDrop:10, rearLift:4, frontProjection:.065,
weightRange:[90,150]
},
{
key:‘sculptural’, label_es:‘Gargantilla escultórica · frontal y dominante’, label_en:‘Sculptural choker · frontal and dominant’,
hint_es:‘Volumen concentrado al frente, menor altura posterior y apertura más contenida.’,
hint_en:‘Volume concentrated at the front, reduced posterior height and a tighter opening.’,
widths:[112,119,127], depths:[90,96,102], openings:[58,62,66],
frontHeight:34, rearHeightRatio:.50, wall:4.6, frontDrop:10, rearLift:3, frontProjection:.090,
weightRange:[40,70]
}
];

const HEAD_SIZES = [
{key:‘s’, innerWidthMm:132, innerDepthMm:154, label_es:‘S · de oreja a oreja ~132 mm’, label_en:‘S · ear to ear ~132 mm’},
{key:‘m’, innerWidthMm:142, innerDepthMm:164, label_es:‘M · de oreja a oreja ~142 mm’, label_en:‘M · ear to ear ~142 mm’},
{key:‘l’, innerWidthMm:152, innerDepthMm:174, label_es:‘L · de oreja a oreja ~152 mm’, label_en:‘L · ear to ear ~152 mm’},
];
const HEAD_PROFILES = [
{
key:‘frontal’, label_es:‘Tiara frontal · presencia escultórica’, label_en:‘Frontal tiara · sculptural presence’,
hint_es:‘Concentra la altura y el volumen sobre la frente, con brazos laterales ligeros.’,
hint_en:‘Concentrates height and volume over the forehead with lightweight side arms.’,
arcDeg:188, frontHeight:52, sideHeightRatio:.30, rearHeightRatio:.18, wall:3.2, crownRise:11, templeDrop:7, frontProjection:.055,
weightRange:[35,48]
},
{
key:‘complete’, label_es:‘Diadema completa · de oreja a oreja’, label_en:‘Full headband · ear to ear’,
hint_es:‘Distribuye la estructura sobre la curvatura craneal y reduce la presión puntual.’,
hint_en:‘Distributes the structure over the cranial curve and reduces pressure points.’,
arcDeg:222, frontHeight:43, sideHeightRatio:.58, rearHeightRatio:.34, wall:3.5, crownRise:15, templeDrop:9, frontProjection:.035,
weightRange:[42,55]
},
{
key:‘modular’, label_es:‘Combinación modular · frente y laterales’, label_en:‘Modular combination · front and sides’,
hint_es:‘Mantiene un frente dominante y desarrolla apoyos laterales de transición gradual.’,
hint_en:‘Keeps a dominant front while developing gradual transitional side supports.’,
arcDeg:208, frontHeight:58, sideHeightRatio:.48, rearHeightRatio:.24, wall:3.4, crownRise:13, templeDrop:8, frontProjection:.070,
weightRange:[38,52]
}
];
const COMB_SIZES = [
{key:‘s’, totalWidthMm:95, topHeightMm:45, toothLengthMm:32, label_es:‘S · 95 mm · dientes 32 mm’, label_en:‘S · 95 mm · 32 mm teeth’},
{key:‘m’, totalWidthMm:110, topHeightMm:50, toothLengthMm:35, label_es:‘M · 110 mm · dientes 35 mm’, label_en:‘M · 110 mm · 35 mm teeth’},
{key:‘l’, totalWidthMm:120, topHeightMm:58, toothLengthMm:38, label_es:‘L · 120 mm · dientes 38 mm’, label_en:‘L · 120 mm · 38 mm teeth’},
];
const COMB_PROFILES = [
{key:‘organic’,label_es:‘Orgánica · ligera y aérea’,label_en:‘Organic · light and airy’,hint_es:‘Vacíos amplios, curvas fluidas y siete dientes para una sujeción ligera.’,hint_en:‘Wide voids, fluid curves and seven teeth for light hold.’,teeth:7, bodyWall:3.6, toothDiameter:2.6, arch:8, depth:10.5, cranialCurve:8.5, insertionAngle:17, toothSweep:7.5, tipReturn:2.8, weightRange:[28,42]},
{key:‘tectonic’,label_es:‘Tectónica · sólida y arquitectónica’,label_en:‘Tectonic · solid and architectural’,hint_es:‘Volúmenes marcados, ocho dientes y un cuerpo superior de mayor presencia.’,hint_en:‘Defined volumes, eight teeth and a more substantial upper body.’,teeth:8, bodyWall:4.4, toothDiameter:2.9, arch:5, depth:11.5, cranialCurve:7.0, insertionAngle:14, toothSweep:6.2, tipReturn:2.4, weightRange:[38,55]},
{key:‘hybrid’,label_es:‘Híbrida · equilibrio entre ligereza y solidez’,label_en:‘Hybrid · balanced lightness and solidity’,hint_es:‘Cuerpo escultórico perforado y nueve dientes con transición estructural reforzada.’,hint_en:‘Perforated sculptural body and nine teeth with reinforced structural transitions.’,teeth:9, bodyWall:4.0, toothDiameter:2.8, arch:7, depth:11.0, cranialCurve:8.0, insertionAngle:16, toothSweep:7.0, tipReturn:2.6, weightRange:[34,50]},
];
const MONEY_CLIP_SIZES = [
{key:‘s’, lengthMm:50, widthMm:20, thicknessMm:1.8, capacityMm:3.0, label_es:‘S · 50 × 20 mm · billetes’, label_en:‘S · 50 × 20 mm · banknotes’},
{key:‘m’, lengthMm:55, widthMm:23, thicknessMm:2.0, capacityMm:3.8, label_es:‘M · 55 × 23 mm · estándar’, label_en:‘M · 55 × 23 mm · standard’},
{key:‘l’, lengthMm:60, widthMm:25, thicknessMm:2.2, capacityMm:4.6, label_es:‘L · 60 × 25 mm · billetes y tarjetas’, label_en:‘L · 60 × 25 mm · notes and cards’},
];
const PENDANT_SIZES = [
{key:‘sm’, mainSize:23.5, label_es:‘Pequeño · 23.5 mm’, label_en:‘Small · 23.5 mm’},
{key:‘md’, mainSize:31.5, label_es:‘Mediano · 31.5 mm’, label_en:‘Medium · 31.5 mm’},
{key:‘lg’, mainSize:40, label_es:‘Grande · 40 mm’, label_en:‘Large · 40 mm’},
];
const CHAIN_FIT = [
{key:‘thin’, innerMm:1.6, label_es:‘Cadena fina (≤2mm)’, label_en:‘Thin chain (≤2mm)’},
{key:‘std’,  innerMm:2.6, label_es:‘Cadena estándar (2–4mm)’, label_en:‘Standard chain (2–4mm)’},
{key:‘thick’,innerMm:3.6, label_es:‘Cadena gruesa (4–6mm)’, label_en:‘Thick chain (4–6mm)’},
];
const SIZE_CONFIG = {
ring:{options:RING_SIZES, key:‘us’, kind:‘ring’},
bangle:{options:WRIST_SIZES, key:‘key’, kind:‘wrist’},
cuffBracelet:{options:WRIST_SIZES, key:‘key’, kind:‘wrist’},
choker:{options:CHOKER_SIZES, key:‘key’, kind:‘neck’},
headpiece:{options:HEAD_SIZES, key:‘key’, kind:‘head’},
earCuff:null,
pendant:{options:PENDANT_SIZES, key:‘key’, kind:‘pendant’},
cufflinks:null,
};

function baseParamsForType(pieceType){
const openDefaults={cuffBracelet:70,choker:72,headpiece:152,earCuff:70};
return {
type:pieceType,faceShape:‘round’,mainSize:18.4,bandWidth:5.2,opening:openDefaults[pieceType]||0,segments:208,
organic:.28,architectural:.74,longitudinal:.56,asymmetry:.10,surfaceRelief:.052,sideRelief:.036,
railCount:2,railHeight:1.55,railGap:2.1,crownArc:68,crownMass:1.75,spikes:0,spikeHeight:1.25,
nodes:0,nodeVolume:1.45,holes:0,holeCoverage:118,frames:.30,rivets:0,screws:0,hinges:0,
articulationCoverage:118,articulationOffset:0,faceting:.24,smoothness:.58,shrinkComp:2.5,minFeature:.8,
printProfile:‘silverPolished’,crown:false
};
}

let currentLang = ‘en’;
let selectedType=null;
let selectedSizeIndex=0;
let selectedChainFit=1;
let selectedChokerProfile=0;
let selectedHeadProfile=0;
let selectedCombProfile=0;
const typeGrid=document.getElementById(‘agdpTypeGrid’);
const generateBtn=document.getElementById(‘agdpGenerateBtn’);
const orderBtn=document.getElementById(‘agdpOrderBtn’);
let currentSeed=SeededVariation.newSeed();
window.AGDP_currentSeed=currentSeed;
const newSeedBtn=document.getElementById(‘agdpNewSeedBtn’);
const emptyState=document.getElementById(‘agdpEmptyState’);
const statusWrap=document.getElementById(‘agdpStatusWrap’);
const dimsPanel=document.getElementById(‘agdpDimsPanel’);
const statusBadge=document.getElementById(‘agdpStatusBadge’);
const legacyCanvas=document.getElementById(‘view’);

function mountLegacyVisualization(){
if(!legacyCanvas) return;
legacyCanvas.style.display=‘block’;
if(window.AGDP_onCanvasResize) requestAnimationFrame(window.AGDP_onCanvasResize);
}

const sizeWrap=document.getElementById(‘agdpSizeWrap’);
const sizeSelect=document.getElementById(‘agdpSizeSelect’);
const sizeHint=document.getElementById(‘agdpSizeHint’);
const chokerProfileWrap=document.getElementById(‘agdpChokerProfileWrap’);
const chokerProfileSelect=document.getElementById(‘agdpChokerProfileSelect’);
const chokerProfileHint=document.getElementById(‘agdpChokerProfileHint’);
const headProfileWrap=document.getElementById(‘agdpHeadProfileWrap’);
const headProfileSelect=document.getElementById(‘agdpHeadProfileSelect’);
const headProfileHint=document.getElementById(‘agdpHeadProfileHint’);
const combProfileWrap=document.getElementById(‘agdpCombProfileWrap’);
const combProfileSelect=document.getElementById(‘agdpCombProfileSelect’);
const combProfileHint=document.getElementById(‘agdpCombProfileHint’);
const chainFitWrap=document.getElementById(‘agdpChainFitWrap’);
const chainFitSelect=document.getElementById(‘agdpChainFitSelect’);
const chainFitLabel=document.getElementById(‘agdpChainFitLabel’);
const langSwitch=document.getElementById(‘agdpLangSwitch’);

const I18N = {
es:{
typeRing:‘Anillo’, typePendant:‘Colgante’, typeBangle:‘Brazalete rígido’, typeCuffBracelet:‘Brazalete abierto’,
typeChoker:‘Gargantilla rígida’, typeHeadpiece:‘Tiara / diadema’, typeComb:‘Peineta’, typeClip:‘Clip’, typeMoneyClip:‘Money clip’, typeCufflinks:‘Mancuernillas’, typeEarCuff:‘Ear cuff’,
generateBtn:‘Generar pieza’, orderBtn:‘Descargar STL para impresión’,
variantLabel:‘Variación’, newSeedBtn:‘Generar otra variante’, variantHint:‘Explora otra configuración formal de la pieza.’,
emptyState:‘Elige un tipo de pieza para generar tu diseño aquí.’,
statusGenerating:‘El motor está pensando la pieza…’, statusReady:‘Lista para producción’, statusAdjusting:‘Explorando forma y validando impresión…’, statusUnavailable:‘Generando una nueva configuración…’, statusFailedAfterRetries:‘Ajustando la configuración — genera otra variante.’, statusLoadingEngine:‘Cargando motor 3D (solo la primera vez)…’, statusEngineError:‘No se pudo cargar el motor 3D — revisa tu conexión e intenta de nuevo’, statusValidationFailed:‘No pasó la auditoría geométrica — no apta para producción. Genera otra variante.’,
orderConfirmed:‘Archivo STL descargado’,
sizeHintRing:‘La talla determina el diámetro interior real del anillo.’,
sizeHintWrist:‘Incluye holgura de confort estándar sobre la circunferencia de muñeca.’,
sizeHintPendant:‘Tamaño de la placa. La apertura para cadena se ajusta abajo.’,
sizeHintNeck:‘La talla se adapta al perfil seleccionado dentro de los rangos cervicales recomendados.’,
sizeHintHead:‘La talla define el ancho interior de oreja a oreja y la curvatura craneal de apoyo.’,
sizeHintComb:‘La talla controla el ancho total, la altura superior y la longitud funcional de los dientes.’,
sizeHintMoneyClip:‘La talla ajusta longitud, ancho, espesor y capacidad para billetes o tarjetas.’,
combProfileLabel:‘Tipología de peineta’,
headProfileLabel:‘Configuración de cabeza’,
chokerProfileLabel:‘Volumetría cervical’,
chainFitLabel:‘Grosor de cadena’,
dimsTitle:‘Medidas finales’,
dimInnerDiameter:‘Diámetro interior’, dimInnerWidth:‘Ancho interior’, dimInnerDepth:‘Fondo interior’, dimOpening:‘Apertura posterior’, dimFrontHeight:‘Altura frontal’, dimRearHeight:‘Altura posterior’, dimWidth:‘Ancho’, dimHeight:‘Alto’, dimThickness:‘Espesor’, dimTargetWeight:‘Rango de peso objetivo’, dimEarToEar:‘Interior de oreja a oreja’, dimCranialDepth:‘Fondo craneal’, dimArc:‘Cobertura angular’, dimCrownRise:‘Elevación de coronilla’, dimTotalWidth:‘Ancho total’, dimTopHeight:‘Altura superior’, dimToothLength:‘Longitud de dientes’, dimToothCount:‘Número de dientes’, dimToothSpacing:‘Separación entre dientes’, dimCranialCurve:‘Curvatura craneal’, dimInsertionAngle:‘Ángulo de inserción’, dimClipLength:‘Longitud del mecanismo’, dimClipWidth:‘Ancho del frente’, dimClipHeight:‘Alto del frente’, dimClipGap:‘Garganta útil’, dimChainPassage:‘Paso para cadena’, dimMoneyClipLength:‘Longitud’, dimMoneyClipWidth:‘Ancho’, dimMoneyClipCapacity:‘Capacidad útil’, dimMoneyClipReturn:‘Retorno elástico’,
dimOverall:‘Dimensión total’, dimPlate:‘Placa’, dimWeight:‘Peso aprox. en plata’,
dimNominal:‘Talla solicitada’, dimDesign:‘Diámetro de diseño (con compensación)’, dimStructuralModule:‘Módulo estructural’, dimFormalEnvelope:‘Envolvente formal’, dimProjection:‘Proyección’,
weightLight:‘Colgante ligero’, weightMedium:‘Colgante medio’, weightHeavy:‘Colgante pesado — considerar mecanismo reforzado’,
tagType:{ring:‘Anillo’,bangle:‘Brazalete rígido’,cuffBracelet:‘Brazalete abierto’,choker:‘Gargantilla rígida’,headpiece:‘Tiara / diadema’,comb:‘Peineta’,clip:‘Clip’,moneyClip:‘Money clip’,pendant:‘Colgante’,cufflinks:‘Mancuernillas’,earCuff:‘Ear cuff’},
},
en:{
typeRing:‘Ring’, typePendant:‘Pendant’, typeBangle:‘Rigid bangle’, typeCuffBracelet:‘Open cuff’,
typeChoker:‘Rigid choker’, typeHeadpiece:‘Tiara / headband’, typeComb:‘Comb’, typeClip:‘Clip’, typeMoneyClip:‘Money clip’, typeCufflinks:‘Cufflinks’, typeEarCuff:‘Ear cuff’,
generateBtn:‘Generate piece’, orderBtn:‘Download print-ready STL’,
variantLabel:‘Variation’, newSeedBtn:‘Generate another variant’, variantHint:‘Explores another formal configuration of the piece.’,
emptyState:‘Choose a piece type to generate your design here.’,
statusGenerating:‘The engine is thinking through the piece…’, statusReady:‘Ready for production’, statusAdjusting:‘Exploring form and validating production…’, statusUnavailable:‘Generating a new configuration…’, statusFailedAfterRetries:‘Adjusting the configuration — generate another variant.’, statusLoadingEngine:‘Loading 3D engine (first time only)…’, statusEngineError:‘Could not load the 3D engine — check your connection and try again’, statusValidationFailed:‘Failed geometric audit — not production-ready. Generate another variant.’,
orderConfirmed:‘STL file downloaded’,
sizeHintRing:‘Size determines the actual inner diameter of the ring.’,
sizeHintWrist:‘Includes standard comfort ease over wrist circumference.’,
sizeHintPendant:‘Plate size. Chain opening is set below.’,
sizeHintNeck:‘Size adapts to the selected profile within the recommended cervical ranges.’,
sizeHintHead:‘Size defines the inner ear-to-ear width and the supporting cranial curvature.’,
sizeHintComb:‘Size controls overall width, upper-body height and functional tooth length.’,
sizeHintMoneyClip:‘Size adjusts length, width, thickness and capacity for banknotes or cards.’,
combProfileLabel:‘Comb typology’,
headProfileLabel:‘Head configuration’,
chokerProfileLabel:‘Cervical volume’,
chainFitLabel:‘Chain thickness’,
dimsTitle:‘Final measurements’,
dimInnerDiameter:‘Inner diameter’, dimInnerWidth:‘Inner width’, dimInnerDepth:‘Inner depth’, dimOpening:‘Rear opening’, dimFrontHeight:‘Front height’, dimRearHeight:‘Rear height’, dimWidth:‘Width’, dimHeight:‘Height’, dimThickness:‘Thickness’, dimTargetWeight:‘Target weight range’, dimEarToEar:‘Inner ear-to-ear width’, dimCranialDepth:‘Cranial depth’, dimArc:‘Angular coverage’, dimCrownRise:‘Crown rise’, dimTotalWidth:‘Overall width’, dimTopHeight:‘Upper height’, dimToothLength:‘Tooth length’, dimToothCount:‘Tooth count’, dimToothSpacing:‘Tooth spacing’, dimCranialCurve:‘Cranial curvature’, dimInsertionAngle:‘Insertion angle’, dimClipLength:‘Mechanism length’, dimClipWidth:‘Front width’, dimClipHeight:‘Front height’, dimClipGap:‘Functional throat’, dimChainPassage:‘Chain passage’, dimMoneyClipLength:‘Length’, dimMoneyClipWidth:‘Width’, dimMoneyClipCapacity:‘Usable capacity’, dimMoneyClipReturn:‘Spring return’,
dimOverall:‘Overall size’, dimPlate:‘Plate’, dimWeight:‘Approx. silver weight’,
dimNominal:‘Requested size’, dimDesign:‘Design diameter (with compensation)’, dimStructuralModule:‘Structural module’, dimFormalEnvelope:‘Formal envelope’, dimProjection:‘Projection’,
weightLight:‘Light pendant’, weightMedium:‘Medium pendant’, weightHeavy:‘Heavy pendant — consider reinforced mechanism’,
tagType:{ring:‘Ring’,bangle:‘Rigid bangle’,cuffBracelet:‘Open cuff’,choker:‘Rigid choker’,headpiece:‘Tiara / headband’,comb:‘Comb’,clip:‘Clip’,moneyClip:‘Money clip’,pendant:‘Pendant’,cufflinks:‘Cufflinks’,earCuff:‘Ear cuff’},
}
};

function t(key){ return (I18N[currentLang]&&I18N[currentLang][key]) || I18N.es[key] || key; }

function applyStaticTexts(){
document.querySelectorAll(’[data-i18n]’).forEach(el=>{ el.textContent = t(el.getAttribute(‘data-i18n’)); });
renderSizeOptions();
}

function renderSizeOptions(){
const cfg = selectedType ? SIZE_CONFIG[selectedType] : null;
if(!cfg){ sizeWrap.style.display=‘none’; chokerProfileWrap.style.display=‘none’; headProfileWrap.style.display=‘none’; combProfileWrap.style.display=‘none’; chainFitWrap.style.display=‘none’; return; }
sizeWrap.style.display=‘block’;
sizeSelect.innerHTML=’’;
cfg.options.forEach((opt,i)=>{
const o=document.createElement(‘option’);
o.value=i; o.textContent = opt[‘label_’+currentLang] || opt.label_es;
sizeSelect.appendChild(o);
});
if(selectedSizeIndex>=cfg.options.length) selectedSizeIndex=0;
sizeSelect.value = selectedSizeIndex;
const hintKey = cfg.kind===‘ring’?‘sizeHintRing’:cfg.kind===‘wrist’?‘sizeHintWrist’:cfg.kind===‘neck’?‘sizeHintNeck’:cfg.kind===‘head’?‘sizeHintHead’:cfg.kind===‘comb’?‘sizeHintComb’:cfg.kind===‘moneyClip’?‘sizeHintMoneyClip’:‘sizeHintPendant’;
sizeHint.textContent = t(hintKey);
// Choker and headpiece profiles are no longer a client-facing choice —
// the seed picks among them automatically, so the picker stays hidden
// regardless of category.
chokerProfileWrap.style.display=‘none’;
headProfileWrap.style.display=‘none’;
if(cfg.kind===‘comb’){
combProfileWrap.style.display=‘block’;
combProfileSelect.innerHTML=’’;
COMB_PROFILES.forEach((profile,i)=>{
const o=document.createElement(‘option’);
o.value=i; o.textContent=profile[‘label_’+currentLang]||profile.label_es;
combProfileSelect.appendChild(o);
});
combProfileSelect.value=selectedCombProfile;
const profile=COMB_PROFILES[selectedCombProfile]||COMB_PROFILES[0];
combProfileHint.textContent=profile[‘hint_’+currentLang]||profile.hint_es;
}else{
combProfileWrap.style.display=‘none’;
}
if(cfg.kind===‘pendant’){
chainFitWrap.style.display=‘block’;
chainFitLabel.textContent = t(‘chainFitLabel’);
chainFitSelect.innerHTML=’’;
CHAIN_FIT.forEach((cf,i)=>{
const o=document.createElement(‘option’);
o.value=i; o.textContent = cf[‘label_’+currentLang] || cf.label_es;
chainFitSelect.appendChild(o);
});
chainFitSelect.value = selectedChainFit;
} else {
chainFitWrap.style.display=‘none’;
}
}

sizeSelect.addEventListener(‘change’,()=>{ selectedSizeIndex = Number(sizeSelect.value); });
chainFitSelect.addEventListener(‘change’,()=>{ selectedChainFit = Number(chainFitSelect.value); });
chokerProfileSelect.addEventListener(‘change’,()=>{
selectedChokerProfile=Number(chokerProfileSelect.value);
const profile=CHOKER_PROFILES[selectedChokerProfile]||CHOKER_PROFILES[0];
chokerProfileHint.textContent=profile[‘hint_’+currentLang]||profile.hint_es;
});
headProfileSelect.addEventListener(‘change’,()=>{
selectedHeadProfile=Number(headProfileSelect.value);
const profile=HEAD_PROFILES[selectedHeadProfile]||HEAD_PROFILES[0];
headProfileHint.textContent=profile[‘hint_’+currentLang]||profile.hint_es;
});
combProfileSelect.addEventListener(‘change’,()=>{
selectedCombProfile=Number(combProfileSelect.value);
const profile=COMB_PROFILES[selectedCombProfile]||COMB_PROFILES[0];
combProfileHint.textContent=profile[‘hint_’+currentLang]||profile.hint_es;
});

langSwitch.querySelectorAll(’.agdp-lang-btn’).forEach(btn=>{
btn.addEventListener(‘click’,()=>{
currentLang = btn.getAttribute(‘data-lang’);
langSwitch.querySelectorAll(’.agdp-lang-btn’).forEach(b=>b.classList.remove(‘selected’));
btn.classList.add(‘selected’);
applyStaticTexts();
});
});

typeGrid.querySelectorAll(’.agdp-type-btn’).forEach(btn=>{
btn.addEventListener(‘click’,()=>{
selectedType=btn.getAttribute(‘data-type’);
selectedSizeIndex=0;
typeGrid.querySelectorAll(’.agdp-type-btn’).forEach(b=>b.classList.remove(‘selected’));
btn.classList.add(‘selected’);
renderSizeOptions();
updateGenerateEnabled();
});
});

function updateGenerateEnabled(){
generateBtn.disabled = !selectedType;
}

newSeedBtn.addEventListener(‘click’,()=>{
currentSeed=SeededVariation.newSeed();
window.AGDP_currentSeed=currentSeed;
if(!generateBtn.disabled)runGenerate();
});

function shrinkCompensatedDiameter(nominalMm){ return (nominalMm+0.25)*1.025; }
function pendantWeightCategory(grams){
if(grams<5)return ‘light’;
if(grams<=10)return ‘medium’;
return ‘heavy’;
}
function showDimensions(result, params){
const dim = result.audit.bounds.dim;
const rows = [];
const overallStr = dim.map(d=>d.toFixed(1)).join(’ × ‘)+’ mm’;
if(params.type===‘ring’){
rows.push([t(‘dimNominal’), (params.mainSizeNominal!=null?params.mainSizeNominal:params.mainSize).toFixed(2)+’ mm’]);
rows.push([t(‘dimWidth’), params.bandWidth.toFixed(1)+’ mm’]);
} else if(params.type===‘choker’){
rows.push([t(‘dimInnerWidth’), params.mainSize.toFixed(1)+’ mm’]);
rows.push([t(‘dimInnerDepth’), params.chokerInnerDepthMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimOpening’), params.chokerOpeningMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimFrontHeight’), params.bandWidth.toFixed(1)+’ mm’]);
rows.push([t(‘dimRearHeight’), (params.bandWidth*params.chokerRearHeightRatio).toFixed(1)+’ mm’]);
rows.push([t(‘dimThickness’), params.chokerWallMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimTargetWeight’), params.chokerWeightRange[0]+’–’+params.chokerWeightRange[1]+’ g’]);
} else if(params.type===‘headpiece’){
rows.push([t(‘dimEarToEar’), params.mainSize.toFixed(1)+’ mm’]);
rows.push([t(‘dimCranialDepth’), params.headInnerDepthMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimArc’), params.headArcDeg.toFixed(0)+‘°’]);
rows.push([t(‘dimFrontHeight’), params.bandWidth.toFixed(1)+’ mm’]);
rows.push([t(‘dimCrownRise’), params.headCrownRiseMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimThickness’), params.headWallMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimTargetWeight’), params.headWeightRange[0]+’–’+params.headWeightRange[1]+’ g’]);
} else if(params.type===‘comb’){
rows.push([t(‘dimTotalWidth’), params.mainSize.toFixed(1)+’ mm’]);
rows.push([t(‘dimTopHeight’), params.combTopHeightMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimToothLength’), params.combToothLengthMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimToothCount’), String(params.combToothCount)]);
rows.push([t(‘dimToothSpacing’), params.combToothSpacingMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimCranialCurve’), params.combCranialCurveMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimInsertionAngle’), params.combInsertionAngleDeg.toFixed(0)+‘°’]);
rows.push([t(‘dimThickness’), params.combBodyWallMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimTargetWeight’), params.combWeightRange[0]+’–’+params.combWeightRange[1]+’ g’]);
} else if(params.type===‘moneyClip’){
rows.push([t(‘dimMoneyClipLength’), params.moneyClipLengthMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimMoneyClipWidth’), params.moneyClipWidthMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimThickness’), params.moneyClipThicknessMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimMoneyClipCapacity’), params.moneyClipGapMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimMoneyClipReturn’), params.moneyClipReturnRadiusMm.toFixed(1)+’ mm’]);
} else if(params.type===‘clip’){
rows.push([t(‘dimClipLength’), params.clipLengthMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimClipWidth’), params.clipFaceWidthMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimClipHeight’), params.clipFaceHeightMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimThickness’), params.clipThicknessMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimClipGap’), params.clipGapMm.toFixed(1)+’ mm’]);
} else if(params.type===‘cuffBracelet’){
rows.push([t(‘dimInnerWidth’), (params.mainSize*1.20).toFixed(1)+’ mm’]);
rows.push([t(‘dimInnerDepth’), (params.mainSize*0.85).toFixed(1)+’ mm’]);
rows.push([t(‘dimWidth’), params.bandWidth.toFixed(1)+’ mm’]);
} else if(params.type===‘bangle’||params.type===‘earCuff’){
rows.push([t(‘dimInnerDiameter’), params.mainSize.toFixed(1)+’ mm’]);
rows.push([t(‘dimWidth’), params.bandWidth.toFixed(1)+’ mm’]);
} else if(params.type===‘pendant’||params.type===‘cufflinks’){
rows.push([t(‘dimPlate’), params.mainSize.toFixed(1)+’ mm’]);
}
if(params.structuralModuleMm!=null)rows.push([t(‘dimStructuralModule’), params.structuralModuleMm.toFixed(2)+’ mm’]);
if(params.envelopeHeightMm!=null)rows.push([t(‘dimFormalEnvelope’), params.envelopeHeightMm.toFixed(1)+’ mm’]);
if(params.projectionDepthMm!=null)rows.push([t(‘dimProjection’), params.projectionDepthMm.toFixed(1)+’ mm’]);
rows.push([t(‘dimOverall’), overallStr]);
rows.push([t(‘dimWeight’), result.audit.silverG.toFixed(1)+’ g’]);
if(params.type===‘pendant’){
const cat=pendantWeightCategory(result.audit.silverG);
rows.push([’’, t(cat===‘light’?‘weightLight’:(cat===‘medium’?‘weightMedium’:‘weightHeavy’))]);
}
dimsPanel.innerHTML = ‘<div class="dims-title">’+t(‘dimsTitle’)+’</div>’+
rows.map(r=>’<div class="dims-row"><span>’+r[0]+’</span><span class="dims-val">’+r[1]+’</span></div>’).join(’’);
dimsPanel.style.display=‘block’;
}

let generationSerial=0;
const AGDP_MAX_GEOMETRY_ATTEMPTS=16;
async function runGenerate(){
if(!selectedType)return;
if(generateBtn.disabled&&generateBtn.dataset.busy===‘1’)return;
const serial=++generationSerial;
generateBtn.dataset.busy=‘1’;
generateBtn.disabled=true;
newSeedBtn.disabled=true;
statusWrap.style.display=‘flex’;
statusBadge.textContent=t(‘statusGenerating’);
statusBadge.className=‘agdp-status-badge thinking’;
orderBtn.disabled=true;
dimsPanel.style.display=‘none’;
emptyState.style.display=‘none’;
setRenderMesh(null);
legacyCanvas.style.display=‘block’;
mountLegacyVisualization();

```
await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

const result={params:baseParamsForType(selectedType)};
const cfg=SIZE_CONFIG[selectedType];
if(cfg){
  const opt=cfg.options[selectedSizeIndex]||cfg.options[0];
  if(cfg.kind==='ring'){
    result.params.mainSizeNominal=opt.diameterMm;
    result.params.mainSize=shrinkCompensatedDiameter(opt.diameterMm);
  }else if(cfg.kind==='wrist'){
    result.params.mainSize=opt.diameterMm;
  }else if(cfg.kind==='neck'){
    const chokerPickRng=SeededVariation.createGenerator(currentSeed+'|choker-profile-autopick');
    const autoChokerIdx=Math.floor(chokerPickRng()*CHOKER_PROFILES.length);
    const profile=CHOKER_PROFILES[autoChokerIdx]||CHOKER_PROFILES[0];
    const idx=Math.max(0,Math.min(2,selectedSizeIndex));
    const innerWidth=profile.widths[idx], innerDepth=profile.depths[idx], openingMm=profile.openings[idx];
    result.params.mainSize=innerWidth;
    result.params.chokerInnerDepthMm=innerDepth;
    result.params.chokerDepthRatio=innerDepth/innerWidth;
    result.params.chokerOpeningMm=openingMm;
    result.params.opening=2*Math.asin(clamp(openingMm/innerDepth,0.05,0.92))*180/Math.PI;
    result.params.bandWidth=profile.frontHeight;
    result.params.chokerRearHeightRatio=profile.rearHeightRatio;
    result.params.chokerWallMm=profile.wall;
    result.params.chokerFrontDropMm=profile.frontDrop;
    result.params.chokerRearLiftMm=profile.rearLift;
    result.params.chokerFrontProjection=profile.frontProjection;
    result.params.chokerProfile=profile.key;
    result.params.chokerWeightRange=profile.weightRange.slice();
    result.params.segments=288;
  }else if(cfg.kind==='head'){
    const profile=HEAD_PROFILES.find(hp=>hp.key==='modular')||HEAD_PROFILES[0];
    result.params.mainSize=opt.innerWidthMm;
    result.params.headInnerDepthMm=opt.innerDepthMm;
    result.params.headDepthRatio=opt.innerDepthMm/opt.innerWidthMm;
    result.params.opening=360-profile.arcDeg;
    result.params.headArcDeg=profile.arcDeg;
    result.params.bandWidth=profile.frontHeight;
    result.params.headSideHeightRatio=profile.sideHeightRatio;
    result.params.headRearHeightRatio=profile.rearHeightRatio;
    result.params.headWallMm=profile.wall;
    result.params.headCrownRiseMm=profile.crownRise;
    result.params.headTempleDropMm=profile.templeDrop;
    result.params.headFrontProjection=profile.frontProjection;
    result.params.headProfile=profile.key;
    result.params.headWeightRange=profile.weightRange.slice();
    result.params.segments=304;
  }else if(cfg.kind==='comb'){
    const profile=COMB_PROFILES[selectedCombProfile]||COMB_PROFILES[0];
    result.params.mainSize=opt.totalWidthMm;
    result.params.bandWidth=opt.topHeightMm;
    result.params.combTopHeightMm=opt.topHeightMm;
    result.params.combToothLengthMm=opt.toothLengthMm;
    result.params.combToothCount=profile.teeth;
    result.params.combBodyWallMm=profile.bodyWall;
    result.params.combToothDiameterMm=profile.toothDiameter;
    result.params.combArchMm=profile.arch;
    result.params.combDepthMm=profile.depth;
    result.params.combCranialCurveMm=profile.cranialCurve;
    result.params.combInsertionAngleDeg=profile.insertionAngle;
    result.params.combToothSweepMm=profile.toothSweep;
    result.params.combTipReturnMm=profile.tipReturn;
    result.params.combProfile=profile.key;
    result.params.combWeightRange=profile.weightRange.slice();
    result.params.combToothSpacingMm=(opt.totalWidthMm-18)/(profile.teeth-1);
    result.params.segments=240;
  }else if(cfg.kind==='moneyClip'){
    result.params.mainSize=opt.lengthMm;
    result.params.bandWidth=opt.widthMm;
    result.params.moneyClipLengthMm=opt.lengthMm;
    result.params.moneyClipWidthMm=opt.widthMm;
    result.params.moneyClipThicknessMm=opt.thicknessMm;
    result.params.moneyClipGapMm=opt.capacityMm;
    result.params.moneyClipReturnRadiusMm=(opt.capacityMm+opt.thicknessMm)/2;
    result.params.moneyClipRearLengthMm=opt.lengthMm-8;
    result.params.segments=240;
  }else if(cfg.kind==='pendant'){
    result.params.mainSize=opt.mainSize;
    result.params.chainFitRadiusMm=(CHAIN_FIT[selectedChainFit]||CHAIN_FIT[1]).innerMm/2;
  }
}

if(selectedType==='clip'){
  result.params.mainSize=32;
  result.params.bandWidth=32;
  result.params.clipLengthMm=36;
  result.params.clipWidthMm=7.2;
  result.params.clipFaceWidthMm=32;
  result.params.clipFaceHeightMm=30;
  result.params.clipThicknessMm=2.0;
  result.params.clipGapMm=2.8;
  result.params.clipSpringLengthMm=36;
  result.params.clipChainPassageMm=3.2;
  result.params.segments=224;
}

const requestedSeed=currentSeed;
const baseAttemptParams=Object.assign({},result.params);
let acceptedMesh=null;
let acceptedParams=null;
let acceptedSeed=null;
let terminalEngineError=null;
let lastFailureReason=null;

for(let attempt=0;attempt<AGDP_MAX_GEOMETRY_ATTEMPTS;attempt++){
  if(serial!==generationSerial)return;
  const candidateSeed=attempt===0?requestedSeed:SeededVariation.newSeed();
  let params=SeededVariation.apply(Object.assign({},baseAttemptParams),candidateSeed);
  params.seed=candidateSeed;
  const loadGraph=window.LoadGraphEngine.buildLoadGraph(candidateSeed,selectedType);
  params=window.LoadGraphEngine.applyGraphToParams(params,loadGraph);
  params=window.ProportionEngine.apply(params);

  try{
    if(!window.AGDP_MANIFOLD_PRELOAD_DONE){
      statusBadge.textContent=t('statusLoadingEngine');
      statusBadge.className='agdp-status-badge thinking';
    }else if(attempt>0){
      statusBadge.textContent=t('statusAdjusting');
      statusBadge.className='agdp-status-badge thinking';
    }
    const candidateMesh=await window.makeMeshManifold(params);
    window.AGDP_MANIFOLD_PRELOAD_DONE=true;
    if(candidateMesh&&candidateMesh.audit&&candidateMesh.audit.ok){
      acceptedMesh=candidateMesh;
      acceptedParams=params;
      acceptedSeed=candidateSeed;
      break;
    }
    console.warn('AGDP: variante descartada silenciosamente por auditoría geométrica',{
      attempt:attempt+1,
      type:selectedType,
      seed:candidateSeed,
      warning:candidateMesh&&candidateMesh.audit&&candidateMesh.audit.warning
    });
    lastFailureReason=(candidateMesh&&candidateMesh.audit&&candidateMesh.audit.warning)||lastFailureReason;
  }catch(e){
    console.warn('AGDP: intento de geometría descartado',{
      attempt:attempt+1,type:selectedType,seed:candidateSeed,error:e
    });
    const message=String(e&&e.message||'');
    const engineFailure=/fetch|network|import|module|failed to load|loading chunk|webassembly|wasm/i.test(message);
    if(engineFailure){terminalEngineError=e;break;}
    lastFailureReason=message||String(e)||lastFailureReason;
  }

  if(attempt<AGDP_MAX_GEOMETRY_ATTEMPTS-1){
    await new Promise(resolve=>requestAnimationFrame(resolve));
  }
}

if(serial!==generationSerial)return;

if(!acceptedMesh){
  console.error('AGDP: no se obtuvo una geometría válida tras los reintentos',{
    type:selectedType,attempts:AGDP_MAX_GEOMETRY_ATTEMPTS,error:terminalEngineError,lastFailureReason
  });
  // The customer-facing badge never shows technical detail (attempt
  // counts, audit warnings, exception messages) — that belongs in
  // console/telemetry only. The one distinction worth keeping public
  // is whether the issue is genuinely actionable by the customer
  // (check connection) versus simply trying another variant.
  statusBadge.textContent=terminalEngineError?t('statusEngineError'):t('statusFailedAfterRetries');
  statusBadge.className='agdp-status-badge';
  orderBtn.disabled=true;
  generateBtn.disabled=false;
  newSeedBtn.disabled=false;
  generateBtn.dataset.busy='0';
  return;
}

currentSeed=acceptedSeed;
window.AGDP_currentSeed=currentSeed;
window.AGDP_currentMesh=acceptedMesh;
window.AGDP_currentPieceName=(selectedType||'pieza')+'_'+(currentSeed||'agdp');
setRenderMesh(acceptedMesh);
showDimensions(acceptedMesh,acceptedParams);
statusBadge.textContent=t('statusReady');
statusBadge.className='agdp-status-badge ready';
orderBtn.disabled=false;
generateBtn.disabled=false;
newSeedBtn.disabled=false;
generateBtn.dataset.busy='0';
```

}
generateBtn.addEventListener(‘click’,runGenerate);

function exportSTLBinary(V,F,filename){
const triCount=F.length;
const bufferSize=84+triCount*50;
const buffer=new ArrayBuffer(bufferSize);
const dv=new DataView(buffer);
for(let i=0;i<80;i++) dv.setUint8(i,0);
dv.setUint32(80,triCount,true);
let offset=84;
function normalOf(a,b,c){
const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2];
const vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
const len=Math.hypot(nx,ny,nz)||1;
return [nx/len,ny/len,nz/len];
}
for(let i=0;i<triCount;i++){
const f=F[i], a=V[f[0]], b=V[f[1]], c=V[f[2]];
const n=normalOf(a,b,c);
dv.setFloat32(offset,n[0],true); dv.setFloat32(offset+4,n[1],true); dv.setFloat32(offset+8,n[2],true);
dv.setFloat32(offset+12,a[0],true); dv.setFloat32(offset+16,a[1],true); dv.setFloat32(offset+20,a[2],true);
dv.setFloat32(offset+24,b[0],true); dv.setFloat32(offset+28,b[1],true); dv.setFloat32(offset+32,b[2],true);
dv.setFloat32(offset+36,c[0],true); dv.setFloat32(offset+40,c[1],true); dv.setFloat32(offset+44,c[2],true);
dv.setUint16(offset+48,0,true);
offset+=50;
}
const blob=new Blob([buffer],{type:‘model/stl’});
const url=URL.createObjectURL(blob);
const a=document.createElement(‘a’);
a.href=url; a.download=filename.endsWith(’.stl’)?filename:filename+’.stl’;
document.body.appendChild(a); a.click(); document.body.removeChild(a);
setTimeout(()=>URL.revokeObjectURL(url),4000);
}

orderBtn.addEventListener(‘click’,()=>{
if(!window.AGDP_currentMesh||!window.AGDP_currentMesh.V||!window.AGDP_currentMesh.V.length){ return; }
exportSTLBinary(window.AGDP_currentMesh.V, window.AGDP_currentMesh.F, window.AGDP_currentPieceName||‘AGDP_pieza’);
orderBtn.textContent=t(‘orderConfirmed’);
orderBtn.disabled=true;
});

if(legacyCanvas) legacyCanvas.style.display=‘none’;
applyStaticTexts();
})();
