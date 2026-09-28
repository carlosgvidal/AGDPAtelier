AGDP ATELIER HIGH JEWELRY V8.2 — RUNTIME REGRESSION FIX

Confirmed regression from V8 -> V8.1:
V8.1 added a second AGDP_Gemstones.plan() call inside geometry.js after CAD generation,
and a second fatal presentation invariant in ui.js. Those checks were not present in V8
and made presentation/planning capable of rejecting an otherwise accepted CAD result.

V8.2:
- geometry.js attaches the already-resolved highJewelryResolvedStone directly to result.gemstones.
- no second planner call is made inside the CAD transaction.
- ui.js consumes result.gemstones and cannot reject an accepted CAD mesh because of presentation planning.
- legacy fallback planning is non-fatal and is not used by normal High Jewelry output.
- V8.1 cabochon and pearl closed-mesh corrections are retained.

Verification performed:
- line-by-line diff V8 vs V8.1 isolated the regression to the added fatal gemstone transaction checks (plus intended cabochon/pearl fixes).
- node --check passes for all JS.
- direct code-path audit confirms normal High Jewelry result.gemstones is constructed from the exact highJewelryResolvedStone used by geometry.
- no V8.1 fatal presentation invariant remains.

Not verified:
- Manifold WASM runtime in Safari/iPad is not executable in this environment.
- Therefore runtime functionality is not claimed until tested in the deployment browser.
