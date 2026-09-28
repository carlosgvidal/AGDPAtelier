AGDP PRIVATE ATELIER — MATERIAL / WEIGHT / OBJ UPDATE

Changes from GEMSTONES_V1:
- Removed production quote/upload API workflow from configurator.ui.js.
- Replaced quote/order action with local OBJ + MTL export.
- OBJ preserves the metal as one named object and each gemstone as a separate named object/group.
- Added selectable metals: 18K yellow gold, 18K white gold, 18K rose gold, platinum.
- Metal selection changes viewport material without changing seed or geometry.
- Metal mass is recalculated from audited mesh volume and an alloy-density estimate.
- Gemstone mass is estimated independently from generated dimensions, family/cut geometry and material specific gravity; shown in grams and carats.
- Total estimated mass is shown.

Important limitations:
- 18K gold density varies with alloy composition. Values used here are engineering estimates, not assay values.
- Gem weights are geometric estimates, not certified gemological weights.
- Gemstone setting types are still design parameters/visual bodies in this iteration; settings are not yet booleanized into the printable metal mesh.
- The existing geometric manufacturing safety rules remain in the engine. Some constants retain historical Shapeways/silver naming; no production API request is made by this private branch.
- Runtime WebGL behavior was not browser-automated in this environment. JavaScript syntax, package structure, API-removal grep, deterministic gemstone planner, and ZIP integrity were checked.
