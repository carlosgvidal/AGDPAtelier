AGDP ATELIER HIGH JEWELRY — V8.5 STONE PIPELINE FIX

Observed V8.4 behavior
----------------------
Base metal rendered again, but gemstones disappeared from every typology.

Root cause
----------
V8.4 correctly made the High Jewelry CAD setting transaction recoverable, but
its rollback conflated two independent states:
  1. whether the gemstone seat/retention boolean was accepted in the metal CAD;
  2. whether the gemstone itself remains part of the design/presentation.

On any setting failure V8.4 set:
  highJewelryResolvedStone = null
  highJewelryProgram.enabled = false

Gemstones.plan() correctly interprets a disabled program as metal-only and
returns stones: []. Therefore every piece recovered by the V8.4 rollback was
guaranteed to render without a gemstone.

V8.5 repair
-----------
- A failed CAD setting rolls back only the constructive metal transaction.
- highJewelryProgram remains enabled.
- Once a resolved lapidary stone exists, it is preserved for presentation/export.
- highJewelrySettingV8 records accepted:false, booleanSeat:false and the precise
  failure reason.
- Gemstones.plan() therefore continues to return the lapidary stone.
- The metal still goes through the unchanged global topology/manufacturing audit.
- The gemstone is rendered separately by the existing Three.js gemstone group,
  exactly as the architecture already supports.

Static topology audit
---------------------
The current V8.2/V8.4 gemstone mesh combinatorics were checked independently:
- pearl ellipsoid: closed, 0 boundary edges, 0 non-2-manifold edges, 0 degenerate faces
- cabochon: closed, 0 boundary edges, 0 non-2-manifold edges, 0 degenerate faces
- round faceted: closed, 0 boundary edges, 0 non-2-manifold edges, 0 degenerate faces
- emerald/asscher/baguette: closed, 0 boundary edges, 0 non-2-manifold edges, 0 degenerate faces
- princess: closed, 0 boundary edges, 0 non-2-manifold edges, 0 degenerate faces
- slab variants: closed, 0 boundary edges, 0 non-2-manifold edges, 0 degenerate faces

This establishes that the systematic disappearance of all gemstones in V8.4
was not caused by open faces in those mesh constructors. It does not by itself
prove every Manifold boolean succeeds for every placement.

Verification
------------
All configurator*.js files pass Node syntax checking.
Browser WebGL + Manifold WASM execution is not available in this environment.
