AGDP ATELIER HIGH JEWELRY V8.1 — CODE AUDIT CORRECTION

ROOT CAUSES VERIFIED IN V8
1. UI presentation could silently downgrade an audited high-jewelry result to metal-only:
   planner exceptions were caught and replaced with {enabled:false, reason:'planner-error'}.
2. Cabochon mesh was open and contained degenerate triangles.
3. Pearl mesh duplicated pole vertices, producing open edges and degenerate triangles.
4. Gemstone plan reported old setting metadata (V7/V6/V5), omitting V8 setting metadata.

V8.1 CHANGES
- Gemstone plan is now part of the geometry transaction before makeMeshManifold returns.
- High-jewelry geometry cannot return unless a resolved primary stone and renderable gemstone plan exist.
- UI no longer silently suppresses gemstone planner failures.
- Cabochon is a closed solid with apex, dome, base wall and bottom cap.
- Pearl is a closed ellipsoid with single pole vertices.
- Plan now exposes highJewelrySettingV8 first.

EXECUTED CHECKS
- node --check: all JavaScript files pass.
- Mesh topology test, 8 lapidary families: 0 boundary edges, 0 non-manifold edges, 0 degenerate triangles for all.
- Planner contract test, 8 typologies: enabled=true, one stone, non-empty stone mesh for all.
- Search confirms former planner-error silent downgrade path is absent.
- ZIP integrity: see VERIFICATION_V8_1.json / delivery notes.

NOT RUNTIME-VERIFIED
- manifold-3d WASM boolean execution in this environment.
- WebGL/Safari rendering in the deployed site.
An npm installation attempt for manifold-3d timed out; no runtime claim is made from static checks.
