(function(){
  'use strict';

  function ringSizeToDiameter(usSize){
    const circumference = 36.5 + 2.55*usSize;
    return circumference/Math.PI;
  }
  const RING_SIZES = [4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10,10.5,11,11.5,12,12.5,13].map(us=>{
    const d = ringSizeToDiameter(us);
    const euCirc = Math.round(36.5+2.55*us);
    return {us, diameterMm: d, label_es:`US ${us} · EU ${euCirc} · ⌀ ${d.toFixed(1)}mm`, label_en:`US ${us} · EU ${euCirc} · ⌀ ${d.toFixed(1)}mm`};
  });
  // Exact internal dimensions replace the former wrist/π approximation.
  // Fit is intentionally left to a physical sizing sample or an existing
  // well-fitting piece; a wrist circumference alone cannot size a rigid bangle.
  const BANGLE_SIZES = [
    {key:'s',diameterMm:58,label_es:'S · diámetro interior 58 mm',label_en:'S · 58 mm inner diameter'},
    {key:'m',diameterMm:62,label_es:'M · diámetro interior 62 mm',label_en:'M · 62 mm inner diameter'},
    {key:'l',diameterMm:66,label_es:'L · diámetro interior 66 mm',label_en:'L · 66 mm inner diameter'},
    {key:'xl',diameterMm:70,label_es:'XL · diámetro interior 70 mm',label_en:'XL · 70 mm inner diameter'}
  ];
  const CUFF_SIZES = [
    {key:'s',mainSize:52,label_es:'S · interior aprox. 62.4 × 44.2 mm',label_en:'S · approx. 62.4 × 44.2 mm inner'},
    {key:'m',mainSize:55,label_es:'M · interior aprox. 66.0 × 46.8 mm',label_en:'M · approx. 66.0 × 46.8 mm inner'},
    {key:'l',mainSize:58,label_es:'L · interior aprox. 69.6 × 49.3 mm',label_en:'L · approx. 69.6 × 49.3 mm inner'},
    {key:'xl',mainSize:61,label_es:'XL · interior aprox. 73.2 × 51.9 mm',label_en:'XL · approx. 73.2 × 51.9 mm inner'}
  ];
  const BROOCH_SIZES = [
    {
      key:'s', faceWidthMm:28, faceHeightMm:26, clipLengthMm:34,
      clipWidthMm:6.8, clipThicknessMm:2.0, clipGapMm:2.6,
      label_es:'S · frente 28 × 26 mm',
      label_en:'S · 28 × 26 mm face'
    },
    {
      key:'m', faceWidthMm:32, faceHeightMm:30, clipLengthMm:36,
      clipWidthMm:7.2, clipThicknessMm:2.0, clipGapMm:2.8,
      label_es:'M · frente 32 × 30 mm',
      label_en:'M · 32 × 30 mm face'
    },
    {
      key:'l', faceWidthMm:36, faceHeightMm:34, clipLengthMm:38,
      clipWidthMm:7.6, clipThicknessMm:2.1, clipGapMm:3.0,
      label_es:'L · frente 36 × 34 mm',
      label_en:'L · 36 × 34 mm face'
    },
  ];
  const HOOP_EARRING_SIZES = [
    {key:'s', outerDiamMm:20, label_es:'S · 20 mm', label_en:'S · 20 mm'},
    {key:'m', outerDiamMm:24, label_es:'M · 24 mm', label_en:'M · 24 mm'},
    {key:'l', outerDiamMm:30, label_es:'L · 30 mm', label_en:'L · 30 mm'},
    {key:'xl', outerDiamMm:35, label_es:'XL · 35 mm', label_en:'XL · 35 mm'},
  ];
  const PENDANT_SIZES = [
    {key:'sm', mainSize:23.5, label_es:'Pequeño · 23.5 mm', label_en:'Small · 23.5 mm'},
    {key:'md', mainSize:31.5, label_es:'Mediano · 31.5 mm', label_en:'Medium · 31.5 mm'},
    {key:'lg', mainSize:40, label_es:'Grande · 40 mm', label_en:'Large · 40 mm'},
  ];
  const CHAIN_FIT = [
    {key:'thin', innerMm:2.8, label_es:'Abertura 2.8 mm · cadena ≤2 mm', label_en:'2.8 mm opening · chain ≤2 mm'},
    {key:'std',  innerMm:4.8, label_es:'Abertura 4.8 mm · cadena 2–4 mm', label_en:'4.8 mm opening · 2–4 mm chain'},
    {key:'thick',innerMm:6.8, label_es:'Abertura 6.8 mm · cadena 4–6 mm', label_en:'6.8 mm opening · 4–6 mm chain'},
  ];
  const EAR_CUFF_SIZES = [
    {key:'s',diameterMm:9,label_es:'S · diámetro interior 9 mm',label_en:'S · 9 mm inner diameter'},
    {key:'m',diameterMm:11,label_es:'M · diámetro interior 11 mm',label_en:'M · 11 mm inner diameter'},
    {key:'l',diameterMm:13,label_es:'L · diámetro interior 13 mm',label_en:'L · 13 mm inner diameter'}
  ];
  const CUFFLINK_SIZES = [
    {key:'s',mainSize:15,label_es:'S · frente 15 mm',label_en:'S · 15 mm face'},
    {key:'m',mainSize:18.4,label_es:'M · frente 18.4 mm',label_en:'M · 18.4 mm face'},
    {key:'l',mainSize:21,label_es:'L · frente 21 mm',label_en:'L · 21 mm face'}
  ];
  const SIZE_CONFIG = {
    ring:{options:RING_SIZES, key:'us', kind:'ring'},
    bangle:{options:BANGLE_SIZES, key:'key', kind:'bangle'},
    cuffBracelet:{options:CUFF_SIZES, key:'key', kind:'cuff'},
    brooch:{options:BROOCH_SIZES, key:'key', kind:'brooch'},
    hoopEarring:{options:HOOP_EARRING_SIZES, key:'key', kind:'hoopEarring'},
    earCuff:{options:EAR_CUFF_SIZES,key:'key',kind:'earCuff'},
    pendant:{options:PENDANT_SIZES, key:'key', kind:'pendant'},
    cufflinks:{options:CUFFLINK_SIZES,key:'key',kind:'cufflinks'},
  };

  function baseParamsForType(pieceType){
    const openDefaults={cuffBracelet:70,earCuff:70};
    return {
      type:pieceType,faceShape:'round',mainSize:18.4,bandWidth:5.2,opening:openDefaults[pieceType]||0,segments:208,
      organic:.28,architectural:.74,longitudinal:.56,asymmetry:.10,surfaceRelief:.052,sideRelief:.036,
      railCount:2,railHeight:1.55,railGap:2.1,crownArc:68,crownMass:1.75,spikes:0,spikeHeight:1.25,
      nodes:0,nodeVolume:1.45,holes:0,holeCoverage:118,frames:.30,rivets:0,screws:0,hinges:0,
      articulationCoverage:118,articulationOffset:0,faceting:.24,smoothness:.58,shrinkComp:2.5,minFeature:.8,
      printProfile:'silverPolished',materialKey:'silver-925',settingClearanceMm:.12,
      enableExperimentalHollowing:false,crown:false
    };
  }

  let currentLang = 'en';
  let selectedType=null;
  let selectedSizeIndex=0;
  let selectedChainFit=1;
  let engineReady=!!window.AGDP_ATELIER_READY;
  const typeGrid=document.getElementById('agdpTypeGrid');
  const generateBtn=document.getElementById('agdpGenerateBtn');
  const orderBtn=document.getElementById('agdpOrderBtn');
  let currentSeed=SeededVariation.newSeed();
  window.AGDP_currentSeed=currentSeed;
  const newSeedBtn=document.getElementById('agdpNewSeedBtn');
  const seedInput=document.getElementById('agdpSeedInput');
  const applySeedBtn=document.getElementById('agdpApplySeedBtn');
  const emptyState=document.getElementById('agdpEmptyState');
  const statusWrap=document.getElementById('agdpStatusWrap');
  const dimsPanel=document.getElementById('agdpDimsPanel');
  const statusBadge=document.getElementById('agdpStatusBadge');
  const atelierMount=document.getElementById('agdp-configurator-mount');
  const legacyCanvas=document.getElementById('view');
  const metalSelect=document.getElementById('agdpMetalSelect');
  const metalLabel=document.getElementById('agdpMetalLabel');
  const METALS=Object.freeze({
    'silver-925':{es:'Plata esterlina .925',en:'Sterling Silver .925',density:10.26,mtl:[0.82,0.82,0.80]},
    'gold18-yellow':{es:'Oro amarillo 18K',en:'18K Yellow Gold',density:15.6,mtl:[0.78,0.52,0.16]},
    'gold18-white':{es:'Oro blanco 18K',en:'18K White Gold',density:15.8,mtl:[0.82,0.82,0.78]},
    'gold18-rose':{es:'Oro rosado 18K',en:'18K Rose Gold',density:15.2,mtl:[0.72,0.42,0.34]},
    platinum:{es:'Platino',en:'Platinum',density:21.45,mtl:[0.78,0.78,0.76]}
  });
  let selectedMetal=(metalSelect&&metalSelect.value)||'silver-925';
  function resetProductionState(){ orderBtn.disabled=true; orderBtn.textContent=t('orderBtn'); }

  function mountLegacyVisualization(){
    if(!legacyCanvas) return;
    legacyCanvas.style.display='block';
    if(window.AGDP_onCanvasResize) requestAnimationFrame(window.AGDP_onCanvasResize);
  }

  const sizeWrap=document.getElementById('agdpSizeWrap');
  const sizeSelect=document.getElementById('agdpSizeSelect');
  const sizeHint=document.getElementById('agdpSizeHint');
  const chainFitWrap=document.getElementById('agdpChainFitWrap');
  const chainFitSelect=document.getElementById('agdpChainFitSelect');
  const chainFitLabel=document.getElementById('agdpChainFitLabel');
  const langSwitch=document.getElementById('agdpLangSwitch');

  const I18N = {
    es:{
      reviewLabel:'Estudio geométrico · requiere revisión técnica',
      typeRing:'Anillo', typePendant:'Colgante', typeBangle:'Brazalete rígido', typeCuffBracelet:'Brazalete abierto',
      typeBrooch:'Broche', typeHoopEarring:'Aretes', typeCufflinks:'Mancuernillas', typeEarCuff:'Ear cuff',
generateBtn:'Generar estudio', orderBtn:'Exportar OBJ + ficha',
      variantLabel:'Variación', seedLabel:'Semilla de diseño', applySeedBtn:'Usar', seedHint:'Conserva esta semilla para reproducir la configuración.', newSeedBtn:'Generar otra variante', variantHint:'Explora otra configuración formal de la pieza.',
      emptyState:'Elige un tipo de pieza para generar tu diseño aquí.',
      statusGenerating:'El motor está construyendo la geometría…', statusReady:'Topología aprobada · revisión técnica pendiente', statusReadyAdjusted:'Topología aprobada con una semilla alternativa · revisión técnica pendiente', statusAdjusting:'Descartando una variante y comprobando otra…', statusUnavailable:'Generando una nueva configuración…', statusFailedAfterRetries:'No se obtuvo una topología válida. Genera otra variante.', statusReinitializing:'Reiniciando el motor 3D…', statusLoadingEngine:'Cargando motor 3D…', statusEngineError:'No se pudo cargar el motor 3D — revisa la conexión e intenta de nuevo', statusValidationFailed:'La geometría no pasó la auditoría topológica.',
      sizeHintRing:'La talla determina el diámetro interior real del anillo.',
      sizeHintBangle:'Mide el diámetro interior de un brazalete rígido que ya te ajuste. La medida de muñeca no basta para calcular el paso de la mano.',
      sizeHintCuff:'Dimensión interior aproximada del cuerpo. La apertura y el ajuste deben verificarse con una muestra física.',
      sizeHintEarCuff:'Diámetro interior de diseño. El ajuste y la presión de contacto requieren una prueba física.',
      sizeHintCufflinks:'Diámetro nominal del frente. El paso por el ojal y la retención requieren prueba física.',
      sizeHintPendant:'Tamaño de la placa. La apertura para cadena se ajusta abajo.',
      sizeHintBrooch:'La talla determina la escala del frente. El clip posterior es sólido, continuo y no articulado.',
      sizeHintHoopEarring:'La talla determina el diámetro exterior del cuerpo decorado. El gancho francés mantiene dimensiones fijas de seguridad.',
      chainFitLabel:'Grosor de cadena',
      dimsTitle:'Medidas generadas',
      dimInnerDiameter:'Diámetro interior', dimInnerWidth:'Ancho interior', dimInnerDepth:'Fondo interior', dimOpening:'Apertura posterior', dimWidth:'Ancho', dimHeight:'Alto', dimThickness:'Espesor', dimTargetWeight:'Rango de peso objetivo',
      dimBroochFace:'Frente', dimClipLength:'Longitud del clip', dimClipClearance:'Apertura útil', dimClipConstruction:'Construcción',
      dimHoopBodySpan:'Diámetro del cuerpo', dimHoopBodyDepth:'Profundidad del cuerpo', dimChainOpening:'Abertura para cadena',
      dimHookInsertionLength:'Longitud de inserción del gancho', dimHookTipDiameter:'Grosor de punta del gancho',
      dimOverall:'Dimensión total', dimPlate:'Frente', dimWeight:'Masa calculada del metal', dimGemWeight:'Masa calculada de gemas', dimTotalWeight:'Masa calculada total', dimReview:'Estado técnico',
      dimNominal:'Talla solicitada', dimDesign:'Diámetro de diseño (con compensación)',
      reviewPending:'Pendiente de revisión de banco y proceso', weightLight:'Colgante ligero', weightMedium:'Colgante medio', weightHeavy:'Colgante pesado — considerar mecanismo reforzado',
      tagType:{ring:'Anillo',bangle:'Brazalete rígido',cuffBracelet:'Brazalete abierto',brooch:'Broche',hoopEarring:'Aretes',pendant:'Colgante',cufflinks:'Mancuernillas',earCuff:'Ear cuff'},
    },
    en:{
      reviewLabel:'Geometry study · technical review required',
      typeRing:'Ring', typePendant:'Pendant', typeBangle:'Bangle', typeCuffBracelet:'Cuff',
      typeBrooch:'Brooch', typeHoopEarring:'Hoop earrings', typeCufflinks:'Cufflinks', typeEarCuff:'Ear cuff',
generateBtn:'Generate study', orderBtn:'Export OBJ + record',
      variantLabel:'Variation', seedLabel:'Design seed', applySeedBtn:'Use', seedHint:'Keep this seed to reproduce the configuration.', newSeedBtn:'Generate another variant', variantHint:'Explores another formal configuration of the piece.',
      emptyState:'Choose a piece type to generate your design here.',
      statusGenerating:'The engine is constructing the geometry…', statusReady:'Topology passed · technical review pending', statusReadyAdjusted:'Topology passed with an alternate seed · technical review pending', statusAdjusting:'Discarding one variant and checking another…', statusUnavailable:'Generating a new configuration…', statusFailedAfterRetries:'No valid topology was produced. Generate another variant.', statusReinitializing:'Reinitializing the 3D engine…', statusLoadingEngine:'Loading the 3D engine…', statusEngineError:'Could not load the 3D engine — check the connection and try again', statusValidationFailed:'The geometry failed the topology audit.',
      sizeHintRing:'Size determines the actual inner diameter of the ring.',
      sizeHintBangle:'Measure the inner diameter of a rigid bangle that already fits. Wrist circumference alone does not establish hand passage.',
      sizeHintCuff:'Approximate internal body dimensions. Opening and fit require a physical sample.',
      sizeHintEarCuff:'Design inner diameter. Fit and contact pressure require a physical test.',
      sizeHintCufflinks:'Nominal face diameter. Buttonhole passage and retention require a physical test.',
      sizeHintPendant:'Plate size. Chain opening is set below.',
      sizeHintBrooch:'Size determines the face scale. The rear clip is solid, continuous and non-articulated.',
      sizeHintHoopEarring:'Size determines the decorated body’s outer diameter. The French hook keeps fixed safety dimensions.',
      chainFitLabel:'Chain thickness',
      dimsTitle:'Generated measurements',
      dimInnerDiameter:'Inner diameter', dimInnerWidth:'Inner width', dimInnerDepth:'Inner depth', dimOpening:'Rear opening', dimWidth:'Width', dimHeight:'Height', dimThickness:'Thickness', dimTargetWeight:'Target weight range',
      dimBroochFace:'Face', dimClipLength:'Clip length', dimClipClearance:'Usable opening', dimClipConstruction:'Construction',
      dimHoopBodySpan:'Body diameter', dimHoopBodyDepth:'Body depth', dimChainOpening:'Chain opening',
      dimHookInsertionLength:'Hook insertion length', dimHookTipDiameter:'Hook tip thickness',
      dimOverall:'Overall size', dimPlate:'Face', dimWeight:'Calculated metal mass', dimGemWeight:'Calculated gemstone mass', dimTotalWeight:'Calculated total mass', dimReview:'Technical status',
      dimNominal:'Requested size', dimDesign:'Design diameter (with compensation)',
      reviewPending:'Pending bench and process review', weightLight:'Light pendant', weightMedium:'Medium pendant', weightHeavy:'Heavy pendant — consider reinforced mechanism',
      tagType:{ring:'Ring',bangle:'Rigid bangle',cuffBracelet:'Open cuff',brooch:'Brooch',hoopEarring:'Hoop earrings',pendant:'Pendant',cufflinks:'Cufflinks',earCuff:'Ear cuff'},
    }
  };

  function t(key){ return (I18N[currentLang]&&I18N[currentLang][key]) || I18N.es[key] || key; }

  function applyStaticTexts(){
    atelierMount.querySelectorAll('[data-i18n]').forEach(el=>{ const label=el.querySelector&&el.querySelector('.agdp-type-label'); if(label)label.textContent=t(el.getAttribute('data-i18n')); else el.textContent=t(el.getAttribute('data-i18n')); });
    renderSizeOptions();
    document.documentElement.lang=currentLang;
    if(legacyCanvas)legacyCanvas.setAttribute('aria-label',currentLang==='es'?'Estudio tridimensional de joyería':'Three-dimensional jewelry study');
    if(metalLabel)metalLabel.textContent=currentLang==='es'?'Metal':'Metal';
    if(metalSelect){
      for(const opt of metalSelect.options){const spec=METALS[opt.value];if(spec)opt.textContent=spec[currentLang]||spec.es;}
    }
  }

  function renderSizeOptions(){
    const cfg = selectedType ? SIZE_CONFIG[selectedType] : null;
    if(!cfg){ sizeWrap.style.display='none'; chainFitWrap.style.display='none'; return; }
    sizeWrap.style.display='block';
    sizeSelect.innerHTML='';
    cfg.options.forEach((opt,i)=>{
      const o=document.createElement('option');
      o.value=i; o.textContent = opt['label_'+currentLang] || opt.label_es;
      sizeSelect.appendChild(o);
    });
    if(selectedSizeIndex>=cfg.options.length) selectedSizeIndex=0;
    sizeSelect.value = selectedSizeIndex;
    const hintKey = cfg.kind==='ring'?'sizeHintRing':
      cfg.kind==='bangle'?'sizeHintBangle':
      cfg.kind==='cuff'?'sizeHintCuff':
      cfg.kind==='earCuff'?'sizeHintEarCuff':
      cfg.kind==='cufflinks'?'sizeHintCufflinks':
      cfg.kind==='brooch'?'sizeHintBrooch':
      cfg.kind==='hoopEarring'?'sizeHintHoopEarring':'sizeHintPendant';
    sizeHint.textContent = t(hintKey);
    if(cfg.kind==='pendant'){
      chainFitWrap.style.display='block';
      chainFitLabel.textContent = t('chainFitLabel');
      chainFitSelect.innerHTML='';
      CHAIN_FIT.forEach((cf,i)=>{
        const o=document.createElement('option');
        o.value=i; o.textContent = cf['label_'+currentLang] || cf.label_es;
        chainFitSelect.appendChild(o);
      });
      chainFitSelect.value = selectedChainFit;
    } else {
      chainFitWrap.style.display='none';
    }
  }

  sizeSelect.addEventListener('change',()=>{ selectedSizeIndex = Number(sizeSelect.value); });
  chainFitSelect.addEventListener('change',()=>{ selectedChainFit = Number(chainFitSelect.value); });

  langSwitch.querySelectorAll('.agdp-lang-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      currentLang = btn.getAttribute('data-lang');
      langSwitch.querySelectorAll('.agdp-lang-btn').forEach(b=>b.classList.remove('selected'));
      langSwitch.querySelectorAll('.agdp-lang-btn').forEach(b=>b.setAttribute('aria-pressed','false'));
      btn.classList.add('selected');
      btn.setAttribute('aria-pressed','true');
      applyStaticTexts();
    });
  });

  typeGrid.querySelectorAll('.agdp-type-btn').forEach(btn=>{
    btn.setAttribute('aria-pressed','false');
    btn.addEventListener('click',()=>{
      selectedType=btn.getAttribute('data-type');
      selectedSizeIndex=0;
      typeGrid.querySelectorAll('.agdp-type-btn').forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-pressed','false');});
      btn.classList.add('selected');
      btn.setAttribute('aria-pressed','true');
      renderSizeOptions();
      updateGenerateEnabled();
    });
  });

  function updateGenerateEnabled(){
    generateBtn.disabled = !selectedType||!engineReady||generateBtn.dataset.busy==='1';
  }

  window.addEventListener('agdp:ready',()=>{
    engineReady=true;
    updateGenerateEnabled();
  },{once:true});

  newSeedBtn.addEventListener('click',()=>{
    currentSeed=SeededVariation.newSeed();
    window.AGDP_currentSeed=currentSeed;
    if(seedInput)seedInput.value=currentSeed;
    if(!generateBtn.disabled)runGenerate();
  });
  if(seedInput)seedInput.value=currentSeed;
  if(applySeedBtn)applySeedBtn.addEventListener('click',()=>{
    currentSeed=SeededVariation.normalize(seedInput&&seedInput.value);
    window.AGDP_currentSeed=currentSeed;
    if(seedInput)seedInput.value=currentSeed;
    if(selectedType&&engineReady)runGenerate();
  });
  if(seedInput)seedInput.addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();if(applySeedBtn)applySeedBtn.click();}
  });

  function pendantWeightCategory(grams){
    if(grams<5)return 'light';
    if(grams<=10)return 'medium';
    return 'heavy';
  }
  function showDimensions(result, params){
    const dim = result.audit.bounds.dim;
    const rows = [];
    const overallStr = dim.map(d=>d.toFixed(1)).join(' × ')+' mm';
    // Type-specific builders (brooch, money clip, hoopEarring)
    // write their own derived dimensions onto the engine's INTERNAL
    // compiled params object, exposed here as result.compiledParams --
    // NOT onto the `params` object this file itself built and passed in,
    // which the engine never mutates in place (it works from its own
    // copy, produced by GenerationLayers.compile()). Falls back to
    // `params` for any field that happens to exist on both, but reads
    // requiring engine-computed values (tooth counts, hook gauge, etc.)
    // must come from compiledParams or they will always be undefined.
    const cp = result.compiledParams || params;
    // Curated for the customer: only dimensions that answer "will it fit
    // me", "how big is it", "how heavy is it". Internal engineering
    // parameters are left out of this default view.
    if(params.type==='ring'){
      rows.push([t('dimNominal'), (params.mainSizeNominal!=null?params.mainSizeNominal:params.mainSize).toFixed(2)+' mm']);
    } else if(params.type==='brooch'){
      rows.push([t('dimBroochFace'), (cp.clipFaceWidthMm||params.clipFaceWidthMm||0).toFixed(1)+' × '+(cp.clipFaceHeightMm||params.clipFaceHeightMm||0).toFixed(1)+' mm']);
    } else if(params.type==='hoopEarring'){
      rows.push([t('dimHoopBodySpan'), (cp.hoopBodySpanMm||params.mainSize).toFixed(1)+' mm']);
      if(cp.hoopHookTipDiameterMm)rows.push([t('dimHookTipDiameter'),cp.hoopHookTipDiameterMm.toFixed(2)+' mm']);
    } else if(params.type==='cuffBracelet'){
      rows.push([t('dimInnerWidth'), (params.mainSize*1.20).toFixed(1)+' mm']);
      rows.push([t('dimInnerDepth'), (params.mainSize*0.85).toFixed(1)+' mm']);
    } else if(params.type==='bangle'||params.type==='earCuff'){
      rows.push([t('dimInnerDiameter'), params.mainSize.toFixed(1)+' mm']);
    } else if(params.type==='pendant'||params.type==='cufflinks'){
      rows.push([t('dimPlate'), params.mainSize.toFixed(1)+' mm']);
      if(params.type==='pendant'&&cp.pendantPassageDiameterMm)rows.push([t('dimChainOpening'),cp.pendantPassageDiameterMm.toFixed(1)+' mm']);
    }
    rows.push([t('dimOverall'), overallStr]);
    const metalSpec=METALS[selectedMetal]||METALS['silver-925'];
    const metalG=Number.isFinite(result.audit.metalG)?result.audit.metalG:result.audit.volumeMm3*metalSpec.density/1000;
    const gemSummary=(window.AGDP_Gemstones&&window.AGDP_Gemstones.weightSummary)?window.AGDP_Gemstones.weightSummary(result.gemstones):{grams:0,carats:0};
    rows.push([t('dimWeight')+' · '+(metalSpec[currentLang]||metalSpec.es), metalG.toFixed(2)+' g']);
    if(gemSummary.grams>0)rows.push([t('dimGemWeight'),gemSummary.grams.toFixed(3)+' g · '+gemSummary.carats.toFixed(2)+' ct']);
    rows.push([t('dimTotalWeight'),(metalG+gemSummary.grams).toFixed(2)+' g']);
    if(params.type==='pendant'){
      const cat=pendantWeightCategory(metalG+gemSummary.grams);
      rows.push(['', t(cat==='light'?'weightLight':(cat==='medium'?'weightMedium':'weightHeavy'))]);
    }
    rows.push([t('dimReview'),t('reviewPending')]);
    dimsPanel.innerHTML = '<div class="dims-title">'+t('dimsTitle')+'</div>'+
      rows.map(r=>'<div class="dims-row"><span>'+r[0]+'</span><span class="dims-val">'+r[1]+'</span></div>').join('');
    dimsPanel.style.display='block';
  }

  let generationSerial=0;
  const AGDP_MAX_GEOMETRY_ATTEMPTS=7;
  const AGDP_REFRESH_AFTER_N_GENERATIONS=6;
  function agdpGenerationCount(){ return Number(sessionStorage.getItem('agdp_gen_count')||'0'); }
  function agdpBumpGenerationCount(){
    try{ sessionStorage.setItem('agdp_gen_count', String(agdpGenerationCount()+1)); }catch(e){}
  }
  // Resets the WASM engine only -- not the page. See prior version's
  // comment history for the full rationale; unchanged here except that
  // the heavy-type (choker/headpiece) lower threshold no longer applies,
  // since neither type exists anymore -- every type now uses the same
  // standard refresh threshold.
  async function agdpMaybeResetEngineIfNeeded(){
    const threshold = AGDP_REFRESH_AFTER_N_GENERATIONS;
    if(agdpGenerationCount()<threshold) return;
    try{ sessionStorage.setItem('agdp_gen_count','0'); }catch(e){}
    if(typeof window.AGDP_resetWasmModule==='function'){
      const prevText=statusBadge.textContent, prevClass=statusBadge.className, wasVisible=statusWrap.style.display;
      statusWrap.style.display='flex';
      statusBadge.textContent=t('statusReinitializing');
      statusBadge.className='agdp-status-badge thinking';
      window.AGDP_resetWasmModule();
      window.AGDP_MANIFOLD_PRELOAD_DONE=false;
      await new Promise(resolve=>setTimeout(resolve,150));
      statusBadge.textContent=prevText; statusBadge.className=prevClass; statusWrap.style.display=wasVisible;
    }else{
      try{
        if(selectedType) sessionStorage.setItem('agdp_restore_type', selectedType);
        sessionStorage.setItem('agdp_restore_seed', currentSeed||'');
      }catch(e){}
      statusWrap.style.display='flex';
      statusBadge.textContent=t('statusReinitializing');
      statusBadge.className='agdp-status-badge thinking';
      generateBtn.disabled=true;
      newSeedBtn.disabled=true;
      await new Promise(resolve=>setTimeout(resolve,550));
      window.location.reload();
      await new Promise(()=>{});
    }
  }
  async function runGenerate(){
    if(!selectedType||!engineReady)return;
    window.AGDP_GENERATION_ACTIVE=true;
    resetProductionState();
    if(generateBtn.disabled&&generateBtn.dataset.busy==='1')return;
    await agdpMaybeResetEngineIfNeeded();
    const serial=++generationSerial;
    generateBtn.dataset.busy='1';
    generateBtn.disabled=true;
    newSeedBtn.disabled=true;
    if(applySeedBtn)applySeedBtn.disabled=true;
    if(seedInput)seedInput.disabled=true;
    if(metalSelect)metalSelect.disabled=true;
    statusWrap.style.display='flex';
    statusBadge.textContent=t('statusGenerating');
    statusBadge.className='agdp-status-badge thinking';
    orderBtn.disabled=true;
    dimsPanel.style.display='none';
    emptyState.style.display='none';
    setRenderMesh(null);
    legacyCanvas.style.display='block';
    mountLegacyVisualization();

    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

    const result={params:baseParamsForType(selectedType)};
    result.params.materialKey=selectedMetal;
    const cfg=SIZE_CONFIG[selectedType];
    if(cfg){
      const opt=cfg.options[selectedSizeIndex]||cfg.options[0];
      if(cfg.kind==='ring'){
        result.params.mainSizeNominal=opt.diameterMm;
        result.params.mainSize=opt.diameterMm;
      }else if(cfg.kind==='bangle'){
        result.params.mainSize=opt.diameterMm;
      }else if(cfg.kind==='cuff'){
        result.params.mainSize=opt.mainSize;
      }else if(cfg.kind==='earCuff'){
        result.params.mainSize=opt.diameterMm;
      }else if(cfg.kind==='cufflinks'){
        result.params.mainSize=opt.mainSize;
      }else if(cfg.kind==='brooch'){
        result.params.mainSize=Math.max(opt.faceWidthMm,opt.faceHeightMm);
        result.params.clipFaceWidthMm=opt.faceWidthMm;
        result.params.clipFaceHeightMm=opt.faceHeightMm;
        result.params.clipLengthMm=opt.clipLengthMm;
        result.params.clipSpringLengthMm=opt.clipLengthMm-4;
        result.params.clipWidthMm=opt.clipWidthMm;
        result.params.clipThicknessMm=opt.clipThicknessMm;
        result.params.clipGapMm=opt.clipGapMm;
        result.params.segments=160;
      }else if(cfg.kind==='hoopEarring'){
        result.params.mainSize=opt.outerDiamMm;
        result.params.segments=160;
      }else if(cfg.kind==='pendant'){
        result.params.mainSize=opt.mainSize;
        result.params.chainFitRadiusMm=(CHAIN_FIT[selectedChainFit]||CHAIN_FIT[1]).innerMm/2;
      }
    }

    const requestedSeed=currentSeed;
    const baseAttemptParams=Object.assign({},result.params);
    let acceptedMesh=null;
    let acceptedParams=null;
    let acceptedSeed=null;
    let acceptedAttempt=0;
    let terminalEngineError=null;
    let lastFailureReason=null;

    for(let attempt=0;attempt<AGDP_MAX_GEOMETRY_ATTEMPTS;attempt++){
      if(serial!==generationSerial){window.AGDP_GENERATION_ACTIVE=false;return;}
      const candidateSeed=attempt===0?requestedSeed:SeededVariation.newSeed();
      let params=SeededVariation.apply(Object.assign({},baseAttemptParams),candidateSeed);
      params.seed=candidateSeed;
      const loadGraph=window.LoadGraphEngine.buildLoadGraph(candidateSeed,selectedType);
      if(!loadGraph.ruleAudit||!loadGraph.ruleAudit.allPass){
        lastFailureReason='load-graph-rule-audit';
        continue;
      }
      params=window.LoadGraphEngine.applyGraphToParams(params,loadGraph);
      if(window.MineralTopologyGrammar){
        params.mineralSystem=window.MineralTopologyGrammar.compile(params,loadGraph);
      }
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
          acceptedAttempt=attempt;
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

    if(serial!==generationSerial){window.AGDP_GENERATION_ACTIVE=false;return;}

    if(!acceptedMesh){
      console.error('AGDP: no se obtuvo una geometría válida tras los reintentos',{
        type:selectedType,attempts:AGDP_MAX_GEOMETRY_ATTEMPTS,error:terminalEngineError,lastFailureReason
      });
      const debugMode=/[?&]debug=1\b/.test(window.location.search);
      const baseMsg=terminalEngineError?t('statusEngineError'):t('statusFailedAfterRetries');
      if(debugMode){
        const reason=terminalEngineError?String(terminalEngineError.message||terminalEngineError):(lastFailureReason||'(sin detalle capturado)');
        statusBadge.textContent=baseMsg+' [DEBUG: '+selectedType+' — '+reason+']';
      }else{
        statusBadge.textContent=baseMsg;
      }
      statusBadge.className='agdp-status-badge';
      orderBtn.disabled=true;
      generateBtn.disabled=false;
      newSeedBtn.disabled=false;
      if(applySeedBtn)applySeedBtn.disabled=false;
      if(seedInput)seedInput.disabled=false;
      if(metalSelect)metalSelect.disabled=false;
      generateBtn.dataset.busy='0';
      agdpBumpGenerationCount();
      window.AGDP_GENERATION_ACTIVE=false;
      return;
    }

    currentSeed=acceptedSeed;
    window.AGDP_currentSeed=currentSeed;
    if(seedInput)seedInput.value=currentSeed;
    if(window.AGDP_Gemstones){
      // Presentation consumes only the structurally accepted geometry transaction.
      // Normal high-jewelry output already contains gemstones. The fallback exists
      try{
        acceptedMesh.gemstones=window.AGDP_Gemstones.plan(acceptedMesh,acceptedMesh.compiledParams||acceptedParams);
        window.AGDP_currentGemstonePlan=acceptedMesh.gemstones;
      }catch(gemError){
        console.warn('AGDP gemstones: plan omitted after planner error',gemError);
        acceptedMesh.gemstones={enabled:false,reason:'planner-error',stones:[]};
      }
    }
    window.AGDP_currentMesh=acceptedMesh;
    window.AGDP_currentPieceName=(selectedType||'pieza')+'_'+(currentSeed||'agdp');
    setRenderMesh(acceptedMesh);
    showDimensions(acceptedMesh,acceptedParams);
    statusBadge.textContent=t(acceptedAttempt>0?'statusReadyAdjusted':'statusReady');
    statusBadge.className='agdp-status-badge ready';
    orderBtn.disabled=false;
    generateBtn.disabled=false;
    newSeedBtn.disabled=false;
    if(applySeedBtn)applySeedBtn.disabled=false;
    if(seedInput)seedInput.disabled=false;
    if(metalSelect)metalSelect.disabled=false;
    generateBtn.dataset.busy='0';
    agdpBumpGenerationCount();
    window.AGDP_GENERATION_ACTIVE=false;
  }
  generateBtn.addEventListener('click',runGenerate);

  function safeName(v){return String(v||'part').replace(/[^A-Za-z0-9_.-]+/g,'_');}
  function buildOBJ(mesh){
    const lines=['# A GROSS DOMESTIC PRODUCT. private atelier','# Units: millimeters','# Seed: '+(currentSeed||''),'mtllib '+safeName(window.AGDP_currentPieceName||'AGDP_piece')+'.mtl'];
    let offset=1;
    lines.push('o METAL_'+safeName(selectedMetal),'g METAL','usemtl METAL_'+safeName(selectedMetal));
    for(const v of mesh.V)lines.push('v '+v[0]+' '+v[1]+' '+v[2]);
    for(const f of mesh.F)lines.push('f '+(f[0]+offset)+' '+(f[1]+offset)+' '+(f[2]+offset));
    offset+=mesh.V.length;
    const parts=(window.AGDP_Gemstones&&window.AGDP_Gemstones.objParts)?window.AGDP_Gemstones.objParts(mesh.gemstones):[];
    for(const part of parts){
      lines.push('o '+safeName(part.name),'g GEMSTONES','usemtl '+safeName(part.material));
      for(const v of part.V)lines.push('v '+v[0]+' '+v[1]+' '+v[2]);
      for(const f of part.F)lines.push('f '+(f[0]+offset)+' '+(f[1]+offset)+' '+(f[2]+offset));
      offset+=part.V.length;
    }
    return lines.join('\n')+'\n';
  }
  function buildMTL(mesh){
    const metal=METALS[selectedMetal]||METALS['silver-925'], lines=['# AGDP material references'];
    lines.push('newmtl METAL_'+safeName(selectedMetal),'Kd '+metal.mtl.join(' '),'Ks 0.9 0.9 0.9','Ns 500','illum 2','');
    const seen=new Set();
    for(const stone of ((mesh.gemstones&&mesh.gemstones.stones)||[])){
      const name=safeName('GEM_'+stone.material); if(seen.has(name))continue; seen.add(name);
      const hex=Number(stone.color||0xffffff),r=((hex>>16)&255)/255,g=((hex>>8)&255)/255,b=(hex&255)/255;
      lines.push('newmtl '+name,'Kd '+r.toFixed(4)+' '+g.toFixed(4)+' '+b.toFixed(4),'Ks 0.75 0.75 0.75','Ns 350','illum 2','');
    }
    return lines.join('\n')+'\n';
  }
  function buildTechnicalRecord(mesh){
    const cp=mesh.compiledParams||{};
    const audit=mesh.audit||{};
    return JSON.stringify({
      schema:'AGDP_PRIVATE_ATELIER_RECORD_1',
      generatedAt:new Date().toISOString(),
      applicationVersion:window.AGDP_APP_VERSION||null,
      privateBuild:window.AGDP_PRIVATE_BUILD||null,
      seed:currentSeed||null,
      type:cp.type||selectedType||null,
      materialKey:selectedMetal,
      units:'mm',
      status:'TECHNICAL_REVIEW_REQUIRED',
      geometry:{vertices:(mesh.V||[]).length,triangles:(mesh.F||[]).length,boundsMm:audit.bounds&&audit.bounds.dim||null,volumeMm3:audit.volumeMm3||null,connectedComponents:audit.components||null,manifoldOK:!!audit.manifoldOK},
      mass:{metalGrams:Number.isFinite(audit.metalG)?audit.metalG:null,densityGcm3:Number.isFinite(audit.materialDensity)?audit.materialDensity:null},
      requested:{mainSizeMm:cp.mainSize||null,bandWidthMm:cp.bandWidth||null,chainOpeningMm:cp.pendantPassageDiameterMm||null,settingClearanceMm:cp.settingClearanceMm||null},
      fabrication:{autoApproved:false,wallThicknessMeasured:false,clearanceMeasured:false,benchReviewRequired:true,hollowingApplied:!!audit.hollowingApplied,shellThicknessVerified:!!audit.shellThicknessVerified},
      gemstones:mesh.gemstones&&mesh.gemstones.enabled?mesh.gemstones.stones.map(s=>({id:s.id,material:s.material,family:s.family,cut:s.cut,sizeMm:s.sizeMm,widthMm:s.widthMm,lengthMm:s.lengthMm,depthMm:s.depthMm,mounting:s.mounting,pairSide:s.pairSide||null})):[]
    },null,2)+'\n';
  }
  function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);}
  function downloadCurrentOBJ(){
    const mesh=window.AGDP_currentMesh;if(!mesh||!mesh.V||!mesh.V.length)return;
    const base=safeName(window.AGDP_currentPieceName||'AGDP_piece');
    downloadBlob(new Blob([buildOBJ(mesh)],{type:'text/plain;charset=utf-8'}),base+'.obj');
    setTimeout(()=>downloadBlob(new Blob([buildMTL(mesh)],{type:'text/plain;charset=utf-8'}),base+'.mtl'),180);
    setTimeout(()=>downloadBlob(new Blob([buildTechnicalRecord(mesh)],{type:'application/json;charset=utf-8'}),base+'.json'),360);
  }
  orderBtn.addEventListener('click',downloadCurrentOBJ);
  if(metalSelect){metalSelect.addEventListener('change',()=>{
    selectedMetal=metalSelect.value;
    if(window.AGDP_setMetalMaterial)window.AGDP_setMetalMaterial(selectedMetal);
    resetProductionState();
    if(window.AGDP_currentMesh&&selectedType&&engineReady)runGenerate();
  });}


  if(legacyCanvas) legacyCanvas.style.display='none';
  if(window.AGDP_setMetalMaterial)window.AGDP_setMetalMaterial(selectedMetal);
  applyStaticTexts();
  updateGenerateEnabled();

  (function agdpRestoreAfterRefresh(){
    let restoreType=null, restoreSeed=null;
    try{
      restoreType=sessionStorage.getItem('agdp_restore_type');
      restoreSeed=sessionStorage.getItem('agdp_restore_seed');
      sessionStorage.removeItem('agdp_restore_type');
      sessionStorage.removeItem('agdp_restore_seed');
    }catch(e){}
    if(!restoreType)return;
    const btn=typeGrid.querySelector('.agdp-type-btn[data-type="'+restoreType+'"]');
    if(!btn)return;
    btn.click();
    if(restoreSeed){ currentSeed=restoreSeed; window.AGDP_currentSeed=currentSeed; }
    if(seedInput)seedInput.value=currentSeed;
    if(!generateBtn.disabled) runGenerate();
  })();
})();
