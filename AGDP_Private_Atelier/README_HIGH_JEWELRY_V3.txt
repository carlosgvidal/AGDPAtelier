AGDP ATELIER — HIGH JEWELRY V3

Grammar revision based on AGDP high-jewelry rules.

VERIFIED STATIC CHANGES
- Faceted vocabulary restricted to Asscher, geometric cushion, emerald, princess and baguette.
- Primary regimes: BLOCK, SLAB/INLAY, CABOCHON, PEARL; satellite mode is secondary.
- Larger primary mineral masses replace the V1 small-stone distribution.
- Existing holes/frames activate void-aware candidate scoring.
- Void-compatible faceted stones prefer invisible-window/prong/channel-capture.
- Slabs prefer inlay-window/inlay.
- Full bezel removed from normal faceted vocabulary; low-probability only for cabochons.
- Same seed remains deterministic through gemstone namespace gemstones-v2-high-jewelry.
- V2 private material selector, weights and OBJ+MTL export retained.

IMPORTANT LIMITATION
Void occupation in V3 is geometry-aware through the compiled holes/frames morphology and internal/oblique surface scoring. The base geometry engine does not expose explicit semantic polygons for each window. Therefore this version does NOT claim exact CAD window-boundary fitting or booleanized stone seats/mountings. Those require adding explicit window metadata/seat construction to configurator.geometry.js.

RUNTIME STATUS
Static/syntax/package checks performed. Browser/WebGL runtime not executed in this environment.
