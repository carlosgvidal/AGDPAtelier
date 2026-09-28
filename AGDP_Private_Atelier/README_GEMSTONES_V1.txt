AGDP ATELIER — GEMSTONE LAYER V1

Verified in this package:
- Baseline engine.js and geometry.js are byte-identical to the user-confirmed functional baseline.
- All JavaScript files pass Node syntax checking.
- Gemstone plan is deterministic for a fixed seed in an isolated planner test.
- Gemstone module loads after engine and before UI.
- UI attaches the gemstone plan only after the original metal mesh passes its existing audit.
- Viewport renders stones as a separate Three.js group inheriting the metal presentation rotation/scale.

Not verified / not yet implemented as production geometry:
- Browser/WebGL runtime was not executed in this environment.
- Settings (bezel/prong/flush/pave/frame/post-cup) are selected as design metadata but are NOT yet booleaned into the printable metal V/F mesh.
- Stone seats/cutters and bench tolerances are therefore not production-ready in V1.
- Paired typologies (cufflinks and hoop earrings) intentionally receive no stones in V1.

This package is a geometry-aware gemstone placement/rendering iteration, not the final production-setting implementation.
