/* ==========================================================================
   AGDP ATELIER v0.201 — scoped mount for the home page
   ==========================================================================
   This file takes the standalone Atelier widget (AGDP_Atelier_v0_201.html,
   originally a full-page app) and mounts it inside #agdp-configurator-mount
   on the site's home page, without letting the widget's global html/body
   rules affect the rest of the page.

   The widget's own logic is loaded byte-for-byte, unchanged, from four
   files pulled directly from the same source as the original .html:
     - configurator.engine.js   (SeededVariation, LoadGraphEngine,
       ProportionEngine, GenerationLayers, StructuralKit, audit utilities)
     - configurator.ui.js       (type/size UI wiring, runGenerate(),
       STL export, language switch)
     - configurator.geometry.js (manifold-3d mesh builders, ES module)
     - configurator.viewport.js (three.js scene/camera/materials, ES module)

   Only two things are changed relative to the original file:
     1. The widget's CSS: `html,body{...}` is rewritten to target
        `#agdp-configurator-mount` instead, so it no longer fights the
        site's own page-level scroll and layout.
     2. The panel markup is injected into the mount element instead of
        document.body.
   Every element ID inside the panel (agdpTypeGrid, agdpGenerateBtn, view,
   etc.) is unchanged, so the four script files — which look up those IDs
   with document.getElementById — work exactly as they did standalone.
   ========================================================================== */
(function(){
  'use strict';
  const MOUNT_ID = 'agdp-configurator-mount';
  const mount = document.getElementById(MOUNT_ID);
  if(!mount){ console.error('AGDP: #'+MOUNT_ID+' not found on page'); return; }

  /* ---------------------------------------------------------------------
     1. Scoped CSS — identical to the widget's own <style> block, except
     the html,body rules are rewritten to target the mount element.
     --------------------------------------------------------------------- */
  const style = document.createElement('style');
  style.textContent = `
#${MOUNT_ID}{
  --font-sans:'Helvetica Neue',Helvetica,Arial,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --font-mono:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;
  --agdp-cream:#FAF6F1;
  --agdp-peach:#FAD9B6;
  --agdp-dark:#4F3A27;
  --agdp-taupe:#8D7B6A;
  font:16px/1.35 var(--font-sans);
  color:#000;
  background:#f7f6f2;
  overflow:hidden;
  height:100%;
}
#${MOUNT_ID} *{box-sizing:border-box;}
#${MOUNT_ID} canvas{display:block;}
#${MOUNT_ID} .agdp-public{font-family:var(--font-sans);background:var(--agdp-cream);color:var(--agdp-dark);height:100%;display:flex;flex-direction:column;overflow:hidden;}
#${MOUNT_ID} .agdp-utilbar{background:transparent;padding:12px 20px;display:flex;align-items:center;justify-content:flex-end;}
#${MOUNT_ID} .agdp-lang-switch{display:flex;border:1px solid rgba(79,58,39,.25);border-radius:0;overflow:hidden;}
#${MOUNT_ID} .agdp-lang-btn{font-family:var(--font-sans);font-size:11px;font-weight:700;letter-spacing:.06em;border:none;background:transparent;color:var(--agdp-taupe);padding:6px 14px;cursor:pointer;}
#${MOUNT_ID} .agdp-lang-btn.selected{background:var(--agdp-dark);color:var(--agdp-cream);}
#${MOUNT_ID} .agdp-body{flex:1;display:grid;grid-template-columns:420px 1fr;min-height:0;}
#${MOUNT_ID} .agdp-form{padding:20px;overflow:visible;display:flex;flex-direction:column;gap:16px;background:var(--agdp-cream);border-right:1px solid rgba(79,58,39,.12);overflow-y:auto;}
#${MOUNT_ID} .agdp-step-label{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--agdp-taupe);font-weight:700;margin-bottom:8px;}
#${MOUNT_ID} .agdp-type-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
#${MOUNT_ID} .agdp-type-btn{border:1.5px solid rgba(79,58,39,.25);background:#fff;border-radius:0;padding:9px 8px;font-family:var(--font-sans);font-size:12px;color:var(--agdp-dark);cursor:pointer;text-align:center;transition:all .15s ease;}
#${MOUNT_ID} .agdp-type-btn:hover{border-color:var(--agdp-dark);}
#${MOUNT_ID} .agdp-type-btn.selected{background:var(--agdp-dark);color:var(--agdp-cream);border-color:var(--agdp-dark);}
#${MOUNT_ID} .agdp-select{width:100%;border:1.5px solid rgba(79,58,39,.25);border-radius:0;padding:12px 14px;font-family:var(--font-sans);font-size:14px;color:var(--agdp-dark);background:#fff;}
#${MOUNT_ID} .agdp-select:focus{outline:none;border-color:var(--agdp-dark);}
#${MOUNT_ID} .agdp-generate-btn{border:none;background:var(--agdp-dark);color:var(--agdp-cream);font-family:var(--font-sans);font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:13.5px;padding:16px;border-radius:0;cursor:pointer;transition:opacity .15s ease;}
#${MOUNT_ID} .agdp-generate-btn:hover{opacity:.88;}
#${MOUNT_ID} .agdp-seed-input{width:100%;border:1.5px solid rgba(79,58,39,.25);border-radius:0;padding:10px 12px;font-family:var(--font-mono);font-size:12px;color:var(--agdp-dark);background:#fff;}
#${MOUNT_ID} .agdp-seed-btn{border:1.5px solid rgba(79,58,39,.25);background:#fff;border-radius:0;padding:10px 12px;font-family:var(--font-sans);font-size:12px;color:var(--agdp-dark);cursor:pointer;white-space:nowrap;}
#${MOUNT_ID} .agdp-seed-btn:hover{border-color:var(--agdp-dark);}
#${MOUNT_ID} .agdp-variant-btn{width:100%;min-height:44px;border-radius:0;font-weight:700;letter-spacing:.04em;}
#${MOUNT_ID} .agdp-generate-btn:disabled{opacity:.4;cursor:default;}
#${MOUNT_ID} .agdp-order-btn{border:1.5px solid var(--agdp-dark);background:transparent;color:var(--agdp-dark);font-family:var(--font-sans);font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:13px;padding:14px;border-radius:0;cursor:pointer;}
#${MOUNT_ID} .agdp-order-btn:disabled{opacity:.3;cursor:default;}
#${MOUNT_ID} .agdp-stage-wrap{position:relative;min-height:0;display:flex;flex-direction:column;background:#fff;}
#${MOUNT_ID} .agdp-stage{position:relative;flex:1;min-height:0;background:#fff;display:flex;align-items:center;justify-content:center;}
#${MOUNT_ID} .agdp-stage canvas{width:100%;height:100%;display:block;}
#${MOUNT_ID} .agdp-status{position:absolute;top:20px;left:20px;right:20px;display:flex;justify-content:space-between;align-items:flex-start;pointer-events:none;}
#${MOUNT_ID} .agdp-status-badge{font-family:var(--font-sans);font-size:12px;background:var(--agdp-cream);border:1px solid rgba(79,58,39,.2);border-radius:0;padding:8px 16px;color:var(--agdp-dark);pointer-events:auto;}
#${MOUNT_ID} .agdp-status-badge.working{color:var(--agdp-taupe);}
#${MOUNT_ID} .agdp-status-badge.thinking{color:var(--agdp-dark);display:flex;align-items:center;gap:9px;}
#${MOUNT_ID} .agdp-status-badge.thinking::before{content:'';width:10px;height:10px;border:1.5px solid currentColor;border-right-color:transparent;border-radius:0;animation:agdpThink .8s linear infinite;}
@keyframes agdpThink{to{transform:rotate(360deg)}}
#${MOUNT_ID} .agdp-status-badge.ready{color:#3a6b3a;}
#${MOUNT_ID} .agdp-dims-panel{position:absolute;left:20px;bottom:20px;background:var(--agdp-cream);border:1px solid rgba(79,58,39,.2);border-radius:0;padding:12px 16px;font-family:var(--font-sans);font-size:12.5px;line-height:1.6;color:var(--agdp-dark);max-width:260px;}
#${MOUNT_ID} .agdp-dims-panel .dims-title{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--agdp-taupe);font-weight:700;margin-bottom:4px;}
#${MOUNT_ID} .agdp-dims-panel .dims-row{display:flex;justify-content:space-between;gap:16px;}
#${MOUNT_ID} .agdp-dims-panel .dims-val{font-weight:700;}
#${MOUNT_ID} .agdp-empty-state{font-family:var(--font-sans);color:var(--agdp-taupe);text-align:center;padding:40px;max-width:340px;font-size:14px;line-height:1.5;}
@media(max-width:820px){
  #${MOUNT_ID} .agdp-body{grid-template-columns:1fr;grid-template-rows:auto auto;min-height:auto;height:100%;overflow-y:auto;}
  #${MOUNT_ID} .agdp-stage-wrap{
    position:sticky;top:0;z-index:5;
    min-height:44vh;max-height:48vh;
    order:-1;
    border-bottom:1px solid rgba(79,58,39,.15);
    box-shadow:0 4px 10px rgba(79,58,39,.08);
  }
  #${MOUNT_ID} .agdp-form{
    order:1;
    border-right:none;border-bottom:none;
    padding:18px 16px 32px;
  }
  #${MOUNT_ID} .agdp-dims-panel{
    position:static;
    order:0;
    margin:12px 16px 0;max-width:none;
    pointer-events:auto;
  }
}
#${MOUNT_ID} .agdp-stage #view{width:100%;height:100%;display:none;background:#fff;touch-action:none;}
`;
  document.head.appendChild(style);

  /* ---------------------------------------------------------------------
     2. Panel markup — extracted verbatim from AGDP_Atelier_v0_201.html's
     <body>, injected into the mount element instead of document.body.
     --------------------------------------------------------------------- */
  mount.innerHTML = `
<div class="agdp-public" id="agdpPublic">
  <div class="agdp-utilbar">
    <div class="agdp-lang-switch" id="agdpLangSwitch">
      <button class="agdp-lang-btn" data-lang="es">ES</button>
      <button class="agdp-lang-btn selected" data-lang="en">EN</button>
    </div>
  </div>
  <div class="agdp-body">
    <div class="agdp-form">
      <div>
        <div class="agdp-type-grid" id="agdpTypeGrid">
          <button class="agdp-type-btn" data-type="ring" data-i18n="typeRing">Anillo</button>
          <button class="agdp-type-btn" data-type="pendant" data-i18n="typePendant">Colgante</button>
          <button class="agdp-type-btn" data-type="bangle" data-i18n="typeBangle">Brazalete rígido</button>
          <button class="agdp-type-btn" data-type="cuffBracelet" data-i18n="typeCuffBracelet">Brazalete abierto</button>
          <button class="agdp-type-btn" data-type="choker" data-i18n="typeChoker">Gargantilla rígida</button>
          <button class="agdp-type-btn" data-type="headpiece" data-i18n="typeHeadpiece">Tiara / diadema</button>
          <button class="agdp-type-btn" data-type="cufflinks" data-i18n="typeCufflinks">Mancuernillas</button>
          <button class="agdp-type-btn" data-type="earCuff" data-i18n="typeEarCuff">Ear cuff</button>
        </div>
      </div>
      <div id="agdpSizeWrap" style="display:none">
        <select class="agdp-select" id="agdpSizeSelect"></select>
        <div class="agdp-hint" id="agdpSizeHint" style="margin-top:6px"></div>
      </div>
      <div id="agdpChokerProfileWrap" style="display:none">
        <div class="agdp-step-label" data-i18n="chokerProfileLabel">Volumetría cervical</div>
        <select class="agdp-select" id="agdpChokerProfileSelect"></select>
        <div class="agdp-hint" id="agdpChokerProfileHint" style="margin-top:6px"></div>
      </div>
      <div id="agdpHeadProfileWrap" style="display:none">
        <div class="agdp-step-label" data-i18n="headProfileLabel">Configuración de cabeza</div>
        <select class="agdp-select" id="agdpHeadProfileSelect"></select>
        <div class="agdp-hint" id="agdpHeadProfileHint" style="margin-top:6px"></div>
      </div>
      <div id="agdpCombProfileWrap" style="display:none">
        <div class="agdp-step-label" data-i18n="combProfileLabel">Tipología de peineta</div>
        <select class="agdp-select" id="agdpCombProfileSelect"></select>
        <div class="agdp-hint" id="agdpCombProfileHint" style="margin-top:6px"></div>
      </div>
      <div id="agdpChainFitWrap" style="display:none;margin-top:14px">
        <div class="agdp-step-label" id="agdpChainFitLabel">Grosor de cadena</div>
        <select class="agdp-select" id="agdpChainFitSelect"></select>
      </div>
      <button class="agdp-generate-btn" id="agdpGenerateBtn" disabled data-i18n="generateBtn">Generar pieza</button>
      <div>
        <button class="agdp-seed-btn agdp-variant-btn" id="agdpNewSeedBtn" type="button" data-i18n="newSeedBtn">Generar otra variante</button>
        <div class="agdp-hint" data-i18n="variantHint" style="margin-top:6px">Explora otra configuración formal de la pieza.</div>
      </div>
      <button class="agdp-order-btn" id="agdpOrderBtn" disabled data-i18n="orderBtn">Descargar STL para impresión</button>
    </div>
    <div class="agdp-stage-wrap">
      <div class="agdp-stage">
        <canvas id="view" aria-label="Visualización tridimensional de la pieza"></canvas>
        <div class="agdp-empty-state" id="agdpEmptyState" data-i18n="emptyState">Elige un tipo de pieza para generar tu diseño aquí.</div>
        <div class="agdp-status" id="agdpStatusWrap" style="display:none">
          <div class="agdp-status-badge" id="agdpStatusBadge">—</div>
        </div>
      </div>
      <div class="agdp-dims-panel" id="agdpDimsPanel" style="display:none"></div>
    </div>
  </div>
</div>`;

  /* ---------------------------------------------------------------------
     3. Load the four extracted script files in the original file's order.
     --------------------------------------------------------------------- */
  function loadScript(src, type){
    return new Promise((resolve, reject)=>{
      const s = document.createElement('script');
      if(type) s.type = type;
      s.src = src;
      s.onload = ()=>resolve();
      s.onerror = ()=>reject(new Error('Failed to load '+src));
      document.body.appendChild(s);
    });
  }

  (async function boot(){
    try{
      await loadScript('configurator.engine.js');
      await loadScript('configurator.ui.js');
      await loadScript('configurator.geometry.js', 'module');
      await loadScript('configurator.viewport.js', 'module');
    }catch(err){
      console.error('AGDP Configurator failed to load', err);
      const badge = document.getElementById('agdpStatusBadge');
      const wrap = document.getElementById('agdpStatusWrap');
      if(wrap) wrap.style.display='flex';
      if(badge){ badge.className='agdp-status-badge'; badge.textContent='No se pudo cargar el configurador — revisa tu conexión e intenta de nuevo.'; }
    }
  })();
})();
