# AGDP Atelier High Jewelry — V11 Mineral Topology Grammar

V11 is an architectural candidate, not a cosmetic gemstone patch.

## What changed
- Mineral composition is compiled inside `configurator.engine.js` from the same LoadGraph used by metal morphology.
- Six composition regimes: monolith, dyad, constellation, field, composite, sign.
- Four mineral families: faceted, cabochon, slab/inlay, pearl.
- Setting interfaces are structural grammar: prong/V-prong, basket, bezel/partial bezel, channel, bar, flush, tension, inlay/channel-frame, post-cup/cup-cage.
- `configurator.geometry.js` receives mineral events before body construction.
- Mineral events create a support field that changes the metal section/shoulders before setting construction and blocks perforations through required support zones.
- Multiple mineral volumes are supported and are integrated sequentially into the same metal manifold.
- Stone count and scale are reciprocal: denser regimes reduce individual stone scale.
- Stone size is constrained by mineral family and jewelry typology.
- Material durability can veto an interface and force a safer setting family.

## Engineering references encoded
- Channel wall policy: 1.00 mm each side (GIA melee design benchmark).
- Pavé/bead border policy: 0.50 mm minimum (GIA melee design benchmark).
- Nominal calibrated melee spacing: 0.10 mm.
- Pearl ranges are kept conservative relative to GIA typical cultured-pearl ranges.

## Verification performed
- `node --check` passes for every JavaScript file.
- Deterministic grammar audit: 800 generated grammar cases (100 per current jewelry typology).
- Every case stayed within stone-count caps, family/type size ranges, and declared family/interface compatibility.
- Static geometry audit confirms mineral support fields affect body construction, mineral zones are protected from holes, multi-volume integration exists, and the primary stone is no longer derived from a post-hoc semantic surface anchor.

## Runtime limitation
A full end-to-end Chromium/Manifold/WebGL generation could not be completed in the build environment because the application imports runtime dependencies from external CDNs and the headless session could not finish loading them. Therefore V11 should be visually tested in the normal browser before being treated as production-final.

See `GRAMMAR_V11.md` for the complete design/engineering grammar.
