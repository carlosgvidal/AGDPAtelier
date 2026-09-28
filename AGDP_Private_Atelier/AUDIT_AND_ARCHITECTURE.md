# AGDP Structural Gems — audited rebuild

## Confirmed defects removed
- Gem renderer no longer explodes shared vertices into independent triangles for smooth stones.
- Pearl mesh: 96 × 48; cabochon: 96 × 24; circular outlines: 64–96 samples.
- No generic oriented-box receiver.
- No presentation fallback after failed setting construction. A failed setting rejects the variant.
- All resolved stones are returned; the payload is no longer reduced to only the first stone.
- Cufflink settings are resolved on each member of the pair instead of at the pair midpoint.

## Generative rule
The mineral grammar fixes event count, hierarchy, family, size, relation and event coordinate before body generation. The body builder receives those events as an influence field. Only after that body exists is its actual production surface sampled at the already-fixed event coordinate. Sampling does not choose a new location; it measures the surface needed to construct the interface.

Each stone must then pass:
1. body-connected shape-matched saddle;
2. setting family geometry;
3. exact lapidary seat boolean;
4. closed-manifold audit.

If any step fails, the entire generated variant is rejected. There is no gemstone-only rendering fallback.

## Setting families currently constructed
- bezel / flush / inlay / channel-frame: footprint-derived closed frame;
- partial bezel / bar / channel: structural rails;
- prong / v-prong / corner-prong: body-connected retainers;
- basket: prongs plus lower footprint-derived rail;
- pearl post-cup / cup-cage: post plus basal cup rail, with cage retainers when selected;
- tension: opposed body-connected retaining arms.

The setting is metal geometry in the same Manifold transaction as the jewelry body.
