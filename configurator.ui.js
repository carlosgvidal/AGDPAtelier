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
  const HAIRCOMB_SIZES = [
    {key:'s', totalWidthMm:95, topHeightMm:38, label_es:'S · 95 mm · cabezal 38 mm', label_en:'S · 95 mm · 38 mm crown'},
    {key:'m', totalWidthMm:110, topHeightMm:42, label_es:'M · 110 mm · cabezal 42 mm', label_en:'M · 110 mm · 42 mm crown'},
    {key:'l', totalWidthMm:120, topHeightMm:48, label_es:'L · 120 mm · cabezal 48 mm', label_en:'L · 120 mm · 48 mm crown'},
  ];
  const HOOP_EARRING_SIZES = [
    {key:'s', outerDiamMm:20, label_es:'S · 20 mm', label_en:'S · 20 mm'},
    {key:'m', outerDiamMm:26, label_es:'M · 26 mm', label_en:'M · 26 mm'},
    {key:'l', outerDiamMm:34, label_es:'L · 34 mm', label_en:'L · 34 mm'},
    {key:'xl', outerDiamMm:40, label_es:'XL · 40 mm', label_en:'XL · 40 mm'},
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
    haircomb:{options:HAIRCOMB_SIZES, key:'key', kind:'haircomb'},
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
      typeHaircomb:'Peineta', typeHoopEarring:'Hoop earring', typeCufflinks:'Mancuernillas', typeEarCuff:'Ear cuff',
generateBtn:'Generar pieza', orderBtn:'Descargar STL para impresión',
      variantLabel:'Variación', newSeedBtn:'Generar otra variante', variantHint:'Explora otra configuración formal de la pieza.',
      emptyState:'Elige un tipo de pieza para generar tu diseño aquí.',
      statusGenerating:'El motor está pensando la pieza…', statusReady:'Lista para producción', statusAdjusting:'Explorando forma y validando impresión…', statusUnavailable:'Generando una nueva configuración…', statusFailedAfterRetries:'Ajustando la configuración — genera otra variante.', statusReinitializing:'Reiniciando el motor 3D…', statusLoadingEngine:'Cargando motor 3D (solo la primera vez)…', statusEngineError:'No se pudo cargar el motor 3D — revisa tu conexión e intenta de nuevo', statusValidationFailed:'No pasó la auditoría geométrica — no apta para producción. Genera otra variante.',
      orderConfirmed:'Archivo STL descargado',
      sizeHintRing:'La talla determina el diámetro interior real del anillo.',
      sizeHintWrist:'Incluye holgura de confort estándar sobre la circunferencia de muñeca.',
      sizeHintPendant:'Tamaño de la placa. La apertura para cadena se ajusta abajo.',
      sizeHintHaircomb:'La talla controla el ancho total (fijo, con dientes y riel de seguridad estándar) y la altura del cabezal decorado.',
      sizeHintHoopEarring:'La talla determina el diámetro exterior del aro. El gancho y el cierre son de calibre fijo por seguridad.',
      chainFitLabel:'Grosor de cadena',
      dimsTitle:'Medidas finales',
      dimInnerDiameter:'Diámetro interior', dimInnerWidth:'Ancho interior', dimInnerDepth:'Fondo interior', dimOpening:'Apertura posterior', dimWidth:'Ancho', dimHeight:'Alto', dimThickness:'Espesor', dimTargetWeight:'Rango de peso objetivo',
      dimTotalWidth:'Ancho total', dimCrownHeight:'Altura de cabezal', dimToothCount:'Número de dientes', dimToothSpacing:'Separación entre dientes', dimToothDiameter:'Diámetro de diente (raíz/punta)',
      dimHoopOuterDiameter:'Diámetro exterior del aro', dimHoopWireDiameter:'Grosor del aro', dimHookTipDiameter:'Grosor de punta del gancho',
      dimHoopBodySpan:'Diámetro del cuerpo', dimHoopPostLength:'Longitud del poste', dimHoopPostTipDiameter:'Grosor de punta del poste',
      dimOverall:'Dimensión total', dimPlate:'Placa', dimWeight:'Peso aprox. en plata',
      dimNominal:'Talla solicitada', dimDesign:'Diámetro de diseño (con compensación)',
      weightLight:'Colgante ligero', weightMedium:'Colgante medio', weightHeavy:'Colgante pesado — considerar mecanismo reforzado',
      tagType:{ring:'Anillo',bangle:'Brazalete rígido',cuffBracelet:'Brazalete abierto',haircomb:'Peineta',hoopEarring:'Hoop earring',pendant:'Colgante',cufflinks:'Mancuernillas',earCuff:'Ear cuff'},
    },
    en:{
      typeRing:'Ring', typePendant:'Pendant', typeBangle:'Bangle', typeCuffBracelet:'Cuff',
      typeHaircomb:'Hair comb', typeHoopEarring:'Hoop earring', typeCufflinks:'Cufflinks', typeEarCuff:'Ear cuff',
generateBtn:'Generate piece', orderBtn:'Download print-ready STL',
      variantLabel:'Variation', newSeedBtn:'Generate another variant', variantHint:'Explores another formal configuration of the piece.',
      emptyState:'Choose a piece type to generate your design here.',
      statusGenerating:'The engine is thinking through the piece…', statusReady:'Ready for production', statusAdjusting:'Exploring form and validating production…', statusUnavailable:'Generating a new configuration…', statusFailedAfterRetries:'Adjusting the configuration — generate another variant.', statusReinitializing:'Reinitializing the 3D engine…', statusLoadingEngine:'Loading 3D engine (first time only)…', statusEngineError:'Could not load the 3D engine — check your connection and try again', statusValidationFailed:'Failed geometric audit — not production-ready. Generate another variant.',
      orderConfirmed:'STL file downloaded',
      sizeHintRing:'Size determines the actual inner diameter of the ring.',
      sizeHintWrist:'Includes standard comfort ease over wrist circumference.',
      sizeHintPendant:'Plate size. Chain opening is set below.',
      sizeHintHaircomb:'Size controls overall width (fixed, with standard safety teeth and spine) and the decorated crown height.',
      sizeHintHoopEarring:'Size determines the hoop\'s outer diameter. The hook and closure are fixed-gauge for safety.',
      chainFitLabel:'Chain thickness',
      dimsTitle:'Final measurements',
      dimInnerDiameter:'Inner diameter', dimInnerWidth:'Inner width', dimInnerDepth:'Inner depth', dimOpening:'Rear opening', dimWidth:'Width', dimHeight:'Height', dimThickness:'Thickness', dimTargetWeight:'Target weight range',
      dimTotalWidth:'Overall width', dimCrownHeight:'Crown height', dimToothCount:'Tooth count', dimToothSpacing:'Tooth spacing', dimToothDiameter:'Tooth diameter (root/tip)',
      dimHoopOuterDiameter:'Hoop outer diameter', dimHoopWireDiameter:'Hoop wire thickness', dimHookTipDiameter:'Hook tip thickness',
      dimHoopBodySpan:'Body span', dimHoopPostLength:'Post length', dimHoopPostTipDiameter:'Post tip thickness',
      dimOverall:'Overall size', dimPlate:'Plate', dimWeight:'Approx. silver weight',
      dimNominal:'Requested size', dimDesign:'Design diameter (with compensation)',
      weightLight:'Light pendant', weightMedium:'Medium pendant', weightHeavy:'Heavy pendant — consider reinforced mechanism',
      tagType:{ring:'Ring',bangle:'Rigid bangle',cuffBracelet:'Open cuff',haircomb:'Hair comb',hoopEarring:'Hoop earring',pendant:'Pendant',cufflinks:'Cufflinks',earCuff:'Ear cuff'},
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
    const hintKey = cfg.kind==='ring'?'sizeHintRing':cfg.kind==='wrist'?'sizeHintWrist':cfg.kind==='haircomb'?'sizeHintHaircomb':cfg.kind==='hoopEarring'?'sizeHintHoopEarring':'sizeHintPendant';
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
    // Type-specific builders (clip, money clip, haircomb, hoopEarring)
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
    } else if(params.type==='haircomb'){
      rows.push([t('dimTotalWidth'), params.mainSize.toFixed(1)+' mm']);
      rows.push([t('dimCrownHeight'), (cp.combTopHeightMm||0).toFixed(1)+' mm']);
      rows.push([t('dimToothCount'), String(cp.hairCombToothCount||10)]);
      rows.push([t('dimToothDiameter'), (cp.hairCombToothRootDiameterMm||2.9).toFixed(1)+' / '+(cp.hairCombToothTipDiameterMm||1.7).toFixed(1)+' mm']);
    } else if(params.type==='hoopEarring'){
      rows.push([t('dimHoopBodySpan'), (cp.hoopBodySpanMm||params.mainSize).toFixed(1)+' mm']);
      rows.push([t('dimHoopPostLength'), (cp.hoopPostLengthMm||11.5).toFixed(1)+' mm']);
      rows.push([t('dimHoopPostTipDiameter'), (cp.hoopPostTipDiameterMm||1.3).toFixed(1)+' mm']);
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
      }else if(cfg.kind==='haircomb'){
        // mainSize is the comb's fixed overall width (teeth+spine geometry
        // itself is locked in makeHairCombManifold regardless of this
        // value's exact number -- this only sizes the spine's own span so
        // the fixed tooth count/spacing lays out across the requested
        // width). combTopHeightMm sets the crown's height envelope, which
        // IS seed/decoration-driven within ProportionEngine's haircomb range.
        result.params.mainSize=opt.totalWidthMm;
        result.params.combTopHeightMm=opt.topHeightMm;
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
    const blob=new Blob([buffer],{type:'model/stl'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=filename.endsWith('.stl')?filename:filename+'.stl';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),4000);
  }

  orderBtn.addEventListener('click',()=>{
    if(!window.AGDP_currentMesh||!window.AGDP_currentMesh.V||!window.AGDP_currentMesh.V.length){ return; }
    exportSTLBinary(window.AGDP_currentMesh.V, window.AGDP_currentMesh.F, window.AGDP_currentPieceName||'AGDP_pieza');
    orderBtn.textContent=t('orderConfirmed');
    orderBtn.disabled=true;
  });

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
