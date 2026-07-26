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
  const WRIST_SIZES = [
    {key:'xs', circMm:145, label_es:'XS · muñeca ~14.5cm', label_en:'XS · wrist ~14.5cm'},
    {key:'s',  circMm:160, label_es:'S · muñeca ~16cm',   label_en:'S · wrist ~16cm'},
    {key:'m',  circMm:175, label_es:'M · muñeca ~17.5cm', label_en:'M · wrist ~17.5cm'},
    {key:'l',  circMm:190, label_es:'L · muñeca ~19cm',   label_en:'L · wrist ~19cm'},
    {key:'xl', circMm:205, label_es:'XL · muñeca ~20.5cm',label_en:'XL · wrist ~20.5cm'},
  ].map(w=>Object.assign(w,{diameterMm: w.circMm/Math.PI + 8}));
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
    {key:'thin', innerMm:1.6, label_es:'Cadena fina (≤2mm)', label_en:'Thin chain (≤2mm)'},
    {key:'std',  innerMm:2.6, label_es:'Cadena estándar (2–4mm)', label_en:'Standard chain (2–4mm)'},
    {key:'thick',innerMm:3.6, label_es:'Cadena gruesa (4–6mm)', label_en:'Thick chain (4–6mm)'},
  ];
  const SIZE_CONFIG = {
    ring:{options:RING_SIZES, key:'us', kind:'ring'},
    bangle:{options:WRIST_SIZES, key:'key', kind:'wrist'},
    cuffBracelet:{options:WRIST_SIZES, key:'key', kind:'wrist'},
    brooch:{options:BROOCH_SIZES, key:'key', kind:'brooch'},
    hoopEarring:{options:HOOP_EARRING_SIZES, key:'key', kind:'hoopEarring'},
    earCuff:null,
    pendant:{options:PENDANT_SIZES, key:'key', kind:'pendant'},
    cufflinks:null,
  };

  function baseParamsForType(pieceType){
    const openDefaults={cuffBracelet:70,earCuff:70};
    return {
      type:pieceType,faceShape:'round',mainSize:18.4,bandWidth:5.2,opening:openDefaults[pieceType]||0,segments:208,
      organic:.28,architectural:.74,longitudinal:.56,asymmetry:.10,surfaceRelief:.052,sideRelief:.036,
      railCount:2,railHeight:1.55,railGap:2.1,crownArc:68,crownMass:1.75,spikes:0,spikeHeight:1.25,
      nodes:0,nodeVolume:1.45,holes:0,holeCoverage:118,frames:.30,rivets:0,screws:0,hinges:0,
      articulationCoverage:118,articulationOffset:0,faceting:.24,smoothness:.58,shrinkComp:2.5,minFeature:.8,
      printProfile:'silverPolished',crown:false
    };
  }

  let currentLang = 'en';
  let selectedType=null;
  let selectedSizeIndex=0;
  let selectedChainFit=1;
  const typeGrid=document.getElementById('agdpTypeGrid');
  const generateBtn=document.getElementById('agdpGenerateBtn');
  const orderBtn=document.getElementById('agdpOrderBtn');
  let currentSeed=SeededVariation.newSeed();
  window.AGDP_currentSeed=currentSeed;
  const newSeedBtn=document.getElementById('agdpNewSeedBtn');
  const emptyState=document.getElementById('agdpEmptyState');
  const statusWrap=document.getElementById('agdpStatusWrap');
  const dimsPanel=document.getElementById('agdpDimsPanel');
  const statusBadge=document.getElementById('agdpStatusBadge');
  const legacyCanvas=document.getElementById('view');

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
      typeRing:'Anillo', typePendant:'Colgante', typeBangle:'Brazalete rígido', typeCuffBracelet:'Brazalete abierto',
      typeBrooch:'Broche', typeHoopEarring:'Aretes', typeCufflinks:'Mancuernillas', typeEarCuff:'Ear cuff',
generateBtn:'Generar pieza', orderBtn:'Cotizar en plata pulida',
      variantLabel:'Variación', newSeedBtn:'Generar otra variante', variantHint:'Explora otra configuración formal de la pieza.',
      emptyState:'Elige un tipo de pieza para generar tu diseño aquí.',
      statusGenerating:'El motor está pensando la pieza…', statusReady:'Lista para producción', statusAdjusting:'Explorando forma y validando impresión…', statusUnavailable:'Generando una nueva configuración…', statusFailedAfterRetries:'Ajustando la configuración — genera otra variante.', statusReinitializing:'Reiniciando el motor 3D…', statusLoadingEngine:'Cargando motor 3D (solo la primera vez)…', statusEngineError:'No se pudo cargar el motor 3D — revisa tu conexión e intenta de nuevo', statusValidationFailed:'No pasó la auditoría geométrica — no apta para producción. Genera otra variante.',
      orderConfirmed:'Modelo enviado a producción',
      sizeHintRing:'La talla determina el diámetro interior real del anillo.',
      sizeHintWrist:'Incluye holgura de confort estándar sobre la circunferencia de muñeca.',
      sizeHintPendant:'Tamaño de la placa. La apertura para cadena se ajusta abajo.',
      sizeHintBrooch:'La talla determina la escala del frente. El clip posterior es sólido, continuo y no articulado.',
      sizeHintHoopEarring:'La talla determina el diámetro exterior del cuerpo decorado. El gancho francés mantiene dimensiones fijas de seguridad.',
      chainFitLabel:'Grosor de cadena',
      dimsTitle:'Medidas finales',
      dimInnerDiameter:'Diámetro interior', dimInnerWidth:'Ancho interior', dimInnerDepth:'Fondo interior', dimOpening:'Apertura posterior', dimWidth:'Ancho', dimHeight:'Alto', dimThickness:'Espesor', dimTargetWeight:'Rango de peso objetivo',
      dimBroochFace:'Frente', dimClipLength:'Longitud del clip', dimClipClearance:'Apertura útil', dimClipConstruction:'Construcción',
      dimHoopBodySpan:'Diámetro del cuerpo', dimHoopBodyDepth:'Profundidad del cuerpo',
      dimHookInsertionLength:'Longitud de inserción del gancho', dimHookTipDiameter:'Grosor de punta del gancho',
      dimOverall:'Dimensión total', dimPlate:'Placa', dimWeight:'Peso aprox. en plata',
      dimNominal:'Talla solicitada', dimDesign:'Diámetro de diseño (con compensación)',
      weightLight:'Colgante ligero', weightMedium:'Colgante medio', weightHeavy:'Colgante pesado — considerar mecanismo reforzado',
      tagType:{ring:'Anillo',bangle:'Brazalete rígido',cuffBracelet:'Brazalete abierto',brooch:'Broche',hoopEarring:'Aretes',pendant:'Colgante',cufflinks:'Mancuernillas',earCuff:'Ear cuff'},
    },
    en:{
      typeRing:'Ring', typePendant:'Pendant', typeBangle:'Bangle', typeCuffBracelet:'Cuff',
      typeBrooch:'Brooch', typeHoopEarring:'Hoop earrings', typeCufflinks:'Cufflinks', typeEarCuff:'Ear cuff',
generateBtn:'Generate piece', orderBtn:'Quote in Polished Silver',
      variantLabel:'Variation', newSeedBtn:'Generate another variant', variantHint:'Explores another formal configuration of the piece.',
      emptyState:'Choose a piece type to generate your design here.',
      statusGenerating:'The engine is thinking through the piece…', statusReady:'Ready for production', statusAdjusting:'Exploring form and validating production…', statusUnavailable:'Generating a new configuration…', statusFailedAfterRetries:'Adjusting the configuration — generate another variant.', statusReinitializing:'Reinitializing the 3D engine…', statusLoadingEngine:'Loading 3D engine (first time only)…', statusEngineError:'Could not load the 3D engine — check your connection and try again', statusValidationFailed:'Failed geometric audit — not production-ready. Generate another variant.',
      orderConfirmed:'Model sent to production',
      sizeHintRing:'Size determines the actual inner diameter of the ring.',
      sizeHintWrist:'Includes standard comfort ease over wrist circumference.',
      sizeHintPendant:'Plate size. Chain opening is set below.',
      sizeHintBrooch:'Size determines the face scale. The rear clip is solid, continuous and non-articulated.',
      sizeHintHoopEarring:'Size determines the decorated body’s outer diameter. The French hook keeps fixed safety dimensions.',
      chainFitLabel:'Chain thickness',
      dimsTitle:'Final measurements',
      dimInnerDiameter:'Inner diameter', dimInnerWidth:'Inner width', dimInnerDepth:'Inner depth', dimOpening:'Rear opening', dimWidth:'Width', dimHeight:'Height', dimThickness:'Thickness', dimTargetWeight:'Target weight range',
      dimBroochFace:'Face', dimClipLength:'Clip length', dimClipClearance:'Usable opening', dimClipConstruction:'Construction',
      dimHoopBodySpan:'Body diameter', dimHoopBodyDepth:'Body depth',
      dimHookInsertionLength:'Hook insertion length', dimHookTipDiameter:'Hook tip thickness',
      dimOverall:'Overall size', dimPlate:'Plate', dimWeight:'Approx. silver weight',
      dimNominal:'Requested size', dimDesign:'Design diameter (with compensation)',
      weightLight:'Light pendant', weightMedium:'Medium pendant', weightHeavy:'Heavy pendant — consider reinforced mechanism',
      tagType:{ring:'Ring',bangle:'Rigid bangle',cuffBracelet:'Open cuff',brooch:'Brooch',hoopEarring:'Hoop earrings',pendant:'Pendant',cufflinks:'Cufflinks',earCuff:'Ear cuff'},
    }
  };

  function t(key){ return (I18N[currentLang]&&I18N[currentLang][key]) || I18N.es[key] || key; }

  function applyStaticTexts(){
    document.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent = t(el.getAttribute('data-i18n')); });
    renderSizeOptions();
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
    const hintKey = cfg.kind==='ring'?'sizeHintRing':cfg.kind==='wrist'?'sizeHintWrist':cfg.kind==='brooch'?'sizeHintBrooch':cfg.kind==='hoopEarring'?'sizeHintHoopEarring':'sizeHintPendant';
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
      btn.classList.add('selected');
      applyStaticTexts();
    });
  });

  typeGrid.querySelectorAll('.agdp-type-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      selectedType=btn.getAttribute('data-type');
      selectedSizeIndex=0;
      typeGrid.querySelectorAll('.agdp-type-btn').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      renderSizeOptions();
      updateGenerateEnabled();
    });
  });

  function updateGenerateEnabled(){
    generateBtn.disabled = !selectedType;
  }

  newSeedBtn.addEventListener('click',()=>{
    currentSeed=SeededVariation.newSeed();
    window.AGDP_currentSeed=currentSeed;
    if(!generateBtn.disabled)runGenerate();
  });

  function shrinkCompensatedDiameter(nominalMm){ return (nominalMm+0.25)*1.025; }
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
      rows.push([t('dimWidth'), params.bandWidth.toFixed(1)+' mm']);
    } else if(params.type==='brooch'){
      rows.push([t('dimBroochFace'), (cp.clipFaceWidthMm||params.clipFaceWidthMm||0).toFixed(1)+' × '+(cp.clipFaceHeightMm||params.clipFaceHeightMm||0).toFixed(1)+' mm']);
      rows.push([t('dimClipLength'), (params.clipLengthMm||36).toFixed(1)+' mm']);
      rows.push([t('dimClipClearance'), (cp.clipEffectiveClearanceMm||params.clipGapMm||2.8).toFixed(1)+' mm']);
      rows.push([t('dimClipConstruction'), currentLang==='es'?'Una sola pieza, sin articulaciones':'Single piece, non-articulated']);
    } else if(params.type==='hoopEarring'){
      rows.push([t('dimHoopBodySpan'), (cp.hoopBodySpanMm||params.mainSize).toFixed(1)+' mm']);
      rows.push([t('dimHoopBodyDepth'), (cp.hoopBodyDepthMm||params.bandWidth).toFixed(1)+' mm']);
      rows.push([t('dimHookInsertionLength'), (cp.hoopHookInsertionLengthMm||12.0).toFixed(1)+' mm']);
      rows.push([t('dimHookTipDiameter'), (cp.hoopHookTipDiameterMm||0.9).toFixed(1)+' mm']);
    } else if(params.type==='cuffBracelet'){
      rows.push([t('dimInnerWidth'), (params.mainSize*1.20).toFixed(1)+' mm']);
      rows.push([t('dimInnerDepth'), (params.mainSize*0.85).toFixed(1)+' mm']);
      rows.push([t('dimWidth'), params.bandWidth.toFixed(1)+' mm']);
    } else if(params.type==='bangle'||params.type==='earCuff'){
      rows.push([t('dimInnerDiameter'), params.mainSize.toFixed(1)+' mm']);
      rows.push([t('dimWidth'), params.bandWidth.toFixed(1)+' mm']);
    } else if(params.type==='pendant'||params.type==='cufflinks'){
      rows.push([t('dimPlate'), params.mainSize.toFixed(1)+' mm']);
    }
    rows.push([t('dimOverall'), overallStr]);
    rows.push([t('dimWeight'), result.audit.silverG.toFixed(1)+' g']);
    if(params.type==='pendant'){
      const cat=pendantWeightCategory(result.audit.silverG);
      rows.push(['', t(cat==='light'?'weightLight':(cat==='medium'?'weightMedium':'weightHeavy'))]);
    }
    dimsPanel.innerHTML = '<div class="dims-title">'+t('dimsTitle')+'</div>'+
      rows.map(r=>'<div class="dims-row"><span>'+r[0]+'</span><span class="dims-val">'+r[1]+'</span></div>').join('');
    dimsPanel.style.display='block';
  }

  let generationSerial=0;
  const AGDP_MAX_GEOMETRY_ATTEMPTS=16;
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
    if(!selectedType)return;
    if(generateBtn.disabled&&generateBtn.dataset.busy==='1')return;
    await agdpMaybeResetEngineIfNeeded();
    const serial=++generationSerial;
    generateBtn.dataset.busy='1';
    generateBtn.disabled=true;
    newSeedBtn.disabled=true;
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
    const cfg=SIZE_CONFIG[selectedType];
    if(cfg){
      const opt=cfg.options[selectedSizeIndex]||cfg.options[0];
      if(cfg.kind==='ring'){
        result.params.mainSizeNominal=opt.diameterMm;
        result.params.mainSize=shrinkCompensatedDiameter(opt.diameterMm);
      }else if(cfg.kind==='wrist'){
        result.params.mainSize=opt.diameterMm;
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
      generateBtn.dataset.busy='0';
      agdpBumpGenerationCount();
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
    agdpBumpGenerationCount();
  }
  generateBtn.addEventListener('click',runGenerate);

  function buildSTLBinaryBlob(V,F){
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
    return new Blob([buffer],{type:'model/stl'});
  }

  const AGDP_PRODUCTION_API='https://agdp-shapeways-api.carlosgvidal.workers.dev';

  function wait(ms){
    return new Promise(resolve=>setTimeout(resolve,ms));
  }

  function formatQuotePrice(price,currency){
    try{
      return new Intl.NumberFormat(currentLang==='es'?'es-MX':'en-US',{
        style:'currency',
        currency:currency||'USD',
        minimumFractionDigits:2,
        maximumFractionDigits:2
      }).format(price);
    }catch(e){
      return (currency||'USD')+' '+Number(price).toFixed(2);
    }
  }

  async function requestPolishedSilverQuote(modelId){
    const response=await fetch(AGDP_PRODUCTION_API+'/quote',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({modelId})
    });
    const payload=await response.json().catch(()=>null);

    if(!response.ok||!payload||payload.ok!==true){
      const message=payload&&payload.error&&payload.error.message
        ?payload.error.message
        :'Quote request failed';
      throw new Error(message);
    }

    return payload.quote;
  }

  async function waitForPolishedSilverQuote(modelId){
    const maxAttempts=30;
    for(let attempt=0;attempt<maxAttempts;attempt++){
      const quote=await requestPolishedSilverQuote(modelId);

      if(quote&&quote.status==='ready')return quote;
      if(quote&&quote.status==='unavailable'){
        throw new Error('Polished Silver is unavailable for this model');
      }
      if(quote&&quote.status==='material_not_found'){
        throw new Error('Polished Silver is not available');
      }

      await wait(4000);
    }

    throw new Error('The model is still being analyzed');
  }

  async function uploadCurrentSTL(){
    if(!window.AGDP_currentMesh||!window.AGDP_currentMesh.V||!window.AGDP_currentMesh.V.length)return;

    const originalText=orderBtn.textContent;
    orderBtn.disabled=true;
    orderBtn.textContent=currentLang==='es'?'Enviando modelo…':'Uploading model…';

    const fileBase=(window.AGDP_currentPieceName||'AGDP_pieza').replace(/\.stl$/i,'');
    const fileName=fileBase+'.stl';
    const blob=buildSTLBinaryBlob(window.AGDP_currentMesh.V,window.AGDP_currentMesh.F);
    const form=new FormData();
    form.append('file',blob,fileName);
    form.append('fileName',fileName);
    form.append('type',selectedType||'piece');
    form.append('seed',currentSeed||window.AGDP_currentSeed||'');

    try{
      const response=await fetch(AGDP_PRODUCTION_API+'/upload',{
        method:'POST',
        body:form
      });
      const payload=await response.json().catch(()=>null);

      if(!response.ok||!payload||payload.ok!==true){
        const message=payload&&payload.error&&payload.error.message
          ?payload.error.message
          :'Model upload failed';
        throw new Error(message);
      }

      const modelId=payload.modelId||null;
      if(!modelId)throw new Error('The production service did not return a model identifier');

      window.AGDP_currentProductionModelId=modelId;
      window.AGDP_currentProductionUpload=payload;

      orderBtn.textContent=currentLang==='es'
        ?'Calculando precio…'
        :'Calculating price…';
      statusBadge.textContent=currentLang==='es'
        ?'Analizando la pieza en plata pulida…'
        :'Analyzing the piece in Polished Silver…';
      statusBadge.className='agdp-status-badge';

      const quote=await waitForPolishedSilverQuote(modelId);

      const finalPrice=Number(quote&&quote.price);
      if(!Number.isFinite(finalPrice)||finalPrice<=0){
        throw new Error('Invalid production price');
      }

      window.AGDP_currentProductionQuote=quote;

      const priceText=formatQuotePrice(finalPrice,quote.currency);
      const materialTitle=quote.material&&quote.material.title
        ?quote.material.title
        :(currentLang==='es'?'Plata pulida':'Polished Silver');

      orderBtn.textContent=priceText;
      statusBadge.textContent=currentLang==='es'
        ?'Plata pulida · Precio final · '+priceText
        :'Polished Silver · Final price · '+priceText;
      statusBadge.className='agdp-status-badge ready';
      orderBtn.disabled=true;
    }catch(error){
      console.error('AGDP: production upload/quote failed',error);
      orderBtn.disabled=false;
      orderBtn.textContent=originalText;
      statusBadge.textContent=currentLang==='es'
        ?'No fue posible obtener la cotización. Intenta de nuevo.'
        :'The quote could not be obtained. Try again.';
      statusBadge.className='agdp-status-badge';
    }
  }

  orderBtn.addEventListener('click',uploadCurrentSTL);

  if(legacyCanvas) legacyCanvas.style.display='none';
  applyStaticTexts();

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
    if(!generateBtn.disabled) runGenerate();
  })();
})();
