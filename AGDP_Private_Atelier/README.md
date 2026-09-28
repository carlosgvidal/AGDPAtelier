# AGDP Private Atelier — recovered-production derivation

This package is intentionally based on the recovered AGDP production modules, not on the discarded simplified prototype.

## Preserved production files
- `configurator.geometry.js` — recovered AGDP Manifold production geometry (~154 KB source revision).
- `configurator.viewport.js` — recovered AGDP Three.js viewport, including the original silver physical material, IBL/light-tent, surface maps, camera and per-typology presentation matrices. The only code appended is the private metal/gemstone accessory API.
- `agdp-site.css` — recovered site stylesheet.

## Added private layer
- `configurator.runtime.js` supplies the runtime interfaces expected by the recovered geometry when deployed independently.
- `private-ateliers.js` adds seeded metal/gem decisions without replacing the body generator.
- `private.css` only lays out the private workbench.

## Gemstone system
Stone family, format, cut, scale, count/density, phase and rotation are seed-derived when set to Auto. Formats: traditional faceted, cabochon, slab/laja, pavé, pearl. Metals: .925 silver, platinum, yellow/rose/white gold.

## Integration
Deploy this directory under a server-protected path inside the existing AGDP site (example `/private/atelier/`). `noindex` is included but is not access control. Use the hosting/server authentication mechanism for actual privacy.

## Important
Gem meshes are design-study presentation geometry, not stone-seat/cutting geometry. The existing AGDP metal body generator remains responsible for the structural object. A later production pass should boolean/model actual seats, prongs, bezels and tolerances against measured stones.
