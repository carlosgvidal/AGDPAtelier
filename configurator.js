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

   v0.206 note: the unstable comb typology was removed. It is replaced by
   brooch: a single-piece, non-articulated solid spring clip whose visible
   face shares the AGDP morphology used by pendants and cufflinks.
   hoopEarring remains unchanged.
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
  --font-display:Georgia,'Times New Roman',serif;
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
#${MOUNT_ID} .agdp-body{flex:1;display:grid;grid-template-columns:410px 1fr;min-height:0;background:#fff;}
#${MOUNT_ID} .agdp-form{padding:28px 24px 32px;overflow:visible;display:flex;flex-direction:column;gap:19px;background:var(--agdp-cream);border-right:1px solid rgba(79,58,39,.22);overflow-y:auto;box-shadow:10px 0 28px rgba(79,58,39,.035);z-index:2;}
#${MOUNT_ID} .agdp-step-label{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--agdp-taupe);font-weight:700;margin-bottom:8px;}
#${MOUNT_ID} .agdp-type-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;}
#${MOUNT_ID} .agdp-type-btn{min-height:74px;border:1px solid rgba(79,58,39,.18);background:rgba(255,255,255,.62);border-radius:0;padding:12px 10px 11px;font-family:var(--font-sans);font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--agdp-dark);cursor:pointer;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;transition:background-color .28s ease,color .28s ease,border-color .28s ease,transform .28s ease,box-shadow .28s ease;}
#${MOUNT_ID} .agdp-type-btn:hover{border-color:rgba(79,58,39,.55);background:#fff;transform:translateY(-1px);box-shadow:0 7px 18px rgba(79,58,39,.06);}
#${MOUNT_ID} .agdp-type-btn.selected{background:var(--agdp-dark);color:var(--agdp-cream);border-color:var(--agdp-dark);box-shadow:0 9px 22px rgba(79,58,39,.14);}
#${MOUNT_ID} .agdp-type-icon{width:29px;height:23px;display:block;transition:transform .28s ease;}
#${MOUNT_ID} .agdp-type-icon *{fill:none;stroke:currentColor;stroke-width:1.35;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;}
#${MOUNT_ID} .agdp-type-btn:hover .agdp-type-icon{transform:scale(1.04);}
#${MOUNT_ID} .agdp-select{width:100%;border:1px solid rgba(79,58,39,.25);border-radius:0;padding:14px 46px 14px 15px;font-family:var(--font-sans);font-size:13px;letter-spacing:.025em;color:var(--agdp-dark);background-color:#fff;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='8' viewBox='0 0 14 8'%3E%3Cpath d='M1 1l6 6 6-6' fill='none' stroke='%234F3A27' stroke-width='1.3'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 16px center;appearance:none;-webkit-appearance:none;}
#${MOUNT_ID} .agdp-select:focus{outline:none;border-color:var(--agdp-dark);}
#${MOUNT_ID} .agdp-generate-btn{border:none;background:var(--agdp-dark);color:var(--agdp-cream);font-family:var(--font-sans);font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:13.5px;padding:16px;border-radius:0;cursor:pointer;transition:opacity .15s ease;}
#${MOUNT_ID} .agdp-generate-btn:hover{opacity:.88;}
#${MOUNT_ID} .agdp-seed-input{width:100%;border:1.5px solid rgba(79,58,39,.25);border-radius:0;padding:10px 12px;font-family:var(--font-mono);font-size:12px;color:var(--agdp-dark);background:#fff;}
#${MOUNT_ID} .agdp-seed-btn{border:1.5px solid rgba(79,58,39,.25);background:#fff;border-radius:0;padding:10px 12px;font-family:var(--font-sans);font-size:12px;color:var(--agdp-dark);cursor:pointer;white-space:nowrap;}
#${MOUNT_ID} .agdp-seed-btn:hover{border-color:var(--agdp-dark);}
#${MOUNT_ID} .agdp-variant-btn{width:100%;min-height:44px;border-radius:0;font-weight:700;letter-spacing:.04em;}
#${MOUNT_ID} .agdp-generate-btn:disabled{opacity:.4;cursor:default;}
#${MOUNT_ID} .agdp-order-btn{border:1px solid var(--agdp-dark);background:transparent;color:var(--agdp-dark);font-family:var(--font-sans);font-weight:700;letter-spacing:.1em;text-transform:uppercase;font-size:12px;padding:15px;border-radius:0;cursor:pointer;transition:background-color .25s ease,color .25s ease,box-shadow .25s ease;}
#${MOUNT_ID} .agdp-order-btn:disabled{opacity:.3;cursor:default;}
#${MOUNT_ID} .agdp-stage-wrap{position:relative;min-height:0;display:flex;flex-direction:column;background:#fff;}
#${MOUNT_ID} .agdp-stage{position:relative;flex:1;min-height:0;background:linear-gradient(145deg,#fff 0%,#fdfcf9 54%,#f7f2eb 100%);display:flex;align-items:center;justify-content:center;padding:3.5vw;}
#${MOUNT_ID} .agdp-stage canvas{width:100%;height:100%;display:block;}
#${MOUNT_ID} .agdp-status{position:absolute;top:28px;left:32px;right:32px;display:flex;justify-content:flex-start;align-items:flex-start;pointer-events:none;}
#${MOUNT_ID} .agdp-status-badge{font-family:var(--font-sans);font-size:11px;background:rgba(250,246,241,.9);border:1px solid rgba(79,58,39,.14);border-radius:0;padding:9px 13px;color:var(--agdp-dark);pointer-events:auto;letter-spacing:.035em;backdrop-filter:blur(6px);}
#${MOUNT_ID} .agdp-status-badge.working{color:var(--agdp-taupe);}
#${MOUNT_ID} .agdp-status-badge.thinking{color:var(--agdp-dark);display:flex;align-items:center;gap:9px;}
#${MOUNT_ID} .agdp-status-badge.thinking::before{content:'';width:10px;height:10px;border:1.5px solid currentColor;border-right-color:transparent;border-radius:50%;animation:agdpThink .8s linear infinite;}
@keyframes agdpThink{to{transform:rotate(360deg)}}
#${MOUNT_ID} .agdp-status-badge.ready{background:transparent;border:0;padding:0;color:var(--agdp-dark);font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;opacity:.72;}
#${MOUNT_ID} .agdp-status-badge.ready::before{content:'✓';display:inline-block;margin-right:8px;font-size:11px;letter-spacing:0;}
#${MOUNT_ID} .agdp-status-badge.quote-ready{background:rgba(250,246,241,.93);border:0;border-top:1px solid rgba(79,58,39,.2);padding:14px 0 0;min-width:250px;backdrop-filter:blur(8px);}
#${MOUNT_ID} .agdp-quote-meta{display:block;font-size:9.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--agdp-taupe);margin-bottom:5px;}
#${MOUNT_ID} .agdp-quote-price{display:block;font-family:var(--font-display);font-size:31px;line-height:1;color:var(--agdp-dark);letter-spacing:-.025em;}
#${MOUNT_ID} .agdp-dims-panel{margin-top:15px;background:transparent;border:0;border-top:1px solid rgba(79,58,39,.2);border-radius:0;padding:17px 0 0;font-family:var(--font-sans);font-size:11px;line-height:1.55;color:var(--agdp-dark);}
#${MOUNT_ID} .agdp-dims-panel .dims-title{font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--agdp-taupe);font-weight:700;margin-bottom:8px;}
#${MOUNT_ID} .agdp-dims-panel .dims-row{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:5px 0;border-bottom:1px solid rgba(79,58,39,.08);color:var(--agdp-taupe);}
#${MOUNT_ID} .agdp-dims-panel .dims-val{font-family:var(--font-display);font-size:17px;line-height:1.1;font-weight:400;color:var(--agdp-dark);letter-spacing:-.01em;text-align:right;}
#${MOUNT_ID}.agdp-quote-ready .agdp-order-btn{background:var(--agdp-dark);color:var(--agdp-cream);border-color:var(--agdp-dark);padding:17px;box-shadow:0 9px 24px rgba(79,58,39,.16);}
#${MOUNT_ID}.agdp-quote-ready .agdp-order-btn:hover{background:#3f2e20;box-shadow:0 12px 28px rgba(79,58,39,.22);}
#${MOUNT_ID}.agdp-quote-ready .agdp-variant-btn{border:0;background:transparent;padding:5px 0;min-height:0;width:auto;text-align:left;font-size:10px;font-weight:600;letter-spacing:.08em;color:var(--agdp-taupe);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:4px;}
#${MOUNT_ID}.agdp-quote-ready .agdp-variant-btn:hover{color:var(--agdp-dark);background:transparent;}
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
}
#${MOUNT_ID} .agdp-stage #view{width:100%;height:100%;display:none;background:#fff;touch-action:none;}
`;
  document.head.appendChild(style);

  /* ---------------------------------------------------------------------
     2. Panel markup — extracted verbatim from AGDP_Atelier_v0_201.html's
     <body>, injected into the mount element instead of document.body.
     v0.206: type grid updated: brooch replaces the removed comb typology.
     The fastening is integral and has no separate mechanism selector.
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
          <button class="agdp-type-btn" data-type="ring" data-i18n="typeRing"><svg class="agdp-type-icon" viewBox="0 0 32 24" aria-hidden="true"><ellipse cx="16" cy="13" rx="9" ry="7"/><path d="M12 6.8c.8-3.5 7.2-3.5 8 0"/></svg><span class="agdp-type-label">Anillo</span></button>
          <button class="agdp-type-btn" data-type="pendant" data-i18n="typePendant"><svg class="agdp-type-icon" viewBox="0 0 32 24" aria-hidden="true"><path d="M13.5 4.5a2.5 2.5 0 0 1 5 0v2"/><path d="M16 6.5c-5 0-8 3.3-8 7.3 0 4.2 3.5 6.7 8 6.7s8-2.5 8-6.7c0-4-3-7.3-8-7.3Z"/></svg><span class="agdp-type-label">Colgante</span></button>
          <button class="agdp-type-btn" data-type="bangle" data-i18n="typeBangle"><svg class="agdp-type-icon" viewBox="0 0 32 24" aria-hidden="true"><ellipse cx="16" cy="12" rx="12" ry="8"/><ellipse cx="16" cy="12" rx="8.5" ry="5.2"/></svg><span class="agdp-type-label">Brazalete rígido</span></button>
          <button class="agdp-type-btn" data-type="cuffBracelet" data-i18n="typeCuffBracelet"><svg class="agdp-type-icon" viewBox="0 0 32 24" aria-hidden="true"><path d="M24.5 7.5c2.8 4.4.7 9.5-4.2 11.2-5.2 1.8-11-.3-12.8-4.7-1.6-3.9.4-7.8 4.1-9.5"/><path d="M11.6 4.5l1.8 3M24.5 7.5l-3.2 1.2"/></svg><span class="agdp-type-label">Brazalete abierto</span></button>
          <button class="agdp-type-btn" data-type="brooch" data-i18n="typeBrooch"><svg class="agdp-type-icon" viewBox="0 0 32 24" aria-hidden="true"><ellipse cx="16" cy="12" rx="10" ry="7"/><path d="M7 17.5h18"/></svg><span class="agdp-type-label">Broche</span></button>
          <button class="agdp-type-btn" data-type="hoopEarring" data-i18n="typeHoopEarring"><svg class="agdp-type-icon" viewBox="0 0 32 24" aria-hidden="true"><path d="M19 3.5c-6 0-10 4-10 9.2 0 4.6 3.4 7.8 7.5 7.8 3.7 0 6.5-2.7 6.5-6.1 0-3.1-2.3-5.4-5.2-5.4-2.5 0-4.3 1.7-4.3 3.9"/></svg><span class="agdp-type-label">Hoop earring</span></button>
          <button class="agdp-type-btn" data-type="cufflinks" data-i18n="typeCufflinks"><svg class="agdp-type-icon" viewBox="0 0 32 24" aria-hidden="true"><ellipse cx="10" cy="8" rx="5.5" ry="4.5"/><path d="M13.8 11.2 21 17"/><path d="M19 19.5 25 14.5"/></svg><span class="agdp-type-label">Mancuernillas</span></button>
          <button class="agdp-type-btn" data-type="earCuff" data-i18n="typeEarCuff"><svg class="agdp-type-icon" viewBox="0 0 32 24" aria-hidden="true"><path d="M22.5 5.5c-5-3.5-12-.7-12 5.7 0 5.1 4 8.3 8.1 7.2 3.4-.9 4.7-4.6 2.6-7.1-1.7-2-5-1.5-5.9.7"/></svg><span class="agdp-type-label">Ear cuff</span></button>
        </div>
      </div>
      <div id="agdpSizeWrap" style="display:none">
        <select class="agdp-select" id="agdpSizeSelect"></select>
        <div class="agdp-hint" id="agdpSizeHint" style="margin-top:6px"></div>
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
      <div class="agdp-dims-panel" id="agdpDimsPanel" style="display:none"></div>
    </div>
    <div class="agdp-stage-wrap">
      <div class="agdp-stage">
        <canvas id="view" aria-label="Visualización tridimensional de la pieza"></canvas>
        <div class="agdp-empty-state" id="agdpEmptyState" data-i18n="emptyState">Elige un tipo de pieza para generar tu diseño aquí.</div>
        <div class="agdp-status" id="agdpStatusWrap" style="display:none">
          <div class="agdp-status-badge" id="agdpStatusBadge">—</div>
        </div>
      </div>
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
