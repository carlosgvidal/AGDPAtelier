AGDP ATELIER — HIGH JEWELRY V8.3 RENDER FIX

Scope
-----
This patch is based on a direct executable diff between:
- V8_LAPIDARY (known rendering baseline)
- V8.2_RUNTIME_FIX (viewport-empty regression package)

Confirmed diff surface
----------------------
Only three executable files differed between V8 and V8.2:
1. configurator.gemstones.js
2. configurator.geometry.js
3. configurator.ui.js

No changes existed in configurator.viewport.js, Three.js setup, canvas setup,
engine.js, lapidary.js, configurator.js, or index.html.

V8.3 correction
---------------
1. configurator.geometry.js
   Restored the V8 contract: geometry returns CAD mesh/audit/compiled params/
   gemstone anchor only. It no longer manufactures the presentation-layer
   `result.gemstones` object.

2. configurator.ui.js
   Restored the V8 post-acceptance presentation flow. Only AFTER a CAD mesh has
   passed audit, AGDP_Gemstones.plan() is invoked. Planner failure is non-fatal
   and cannot invalidate the accepted metal mesh.

3. configurator.gemstones.js
   Retains V8.2's closed pearl and cabochon mesh corrections (single ellipsoid
   poles; closed cabochon base) because these repair degenerate/open source
   meshes. Gemstone module version updated to 8.3.0.

What was deliberately NOT changed
---------------------------------
- No audit thresholds were relaxed.
- No manifold/topology errors were suppressed.
- No viewport or Three.js behavior was altered.
- No CAD construction logic from the known V8 baseline was otherwise changed.

Verification performed in this package
--------------------------------------
- JavaScript syntax check for all configurator*.js files: PASS.
- Diff check confirms geometry.js and ui.js now match V8 exactly.
- Diff check confirms gemstones.js differs from V8 only by the version string,
  V8 setting fallback compatibility, and the closed pearl/cabochon mesh fixes.

Runtime limitation
------------------
A browser + WebGL + manifold-3d WASM runtime is not available in this packaging
environment, so this package does not claim an end-to-end browser render test.
The correction restores the execution contract of the supplied V8 rendering
baseline without weakening CAD validation.
