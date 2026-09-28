AGDP ATELIER — HIGH JEWELRY V8 / LAPIDARY PRIMARY VOLUME

ARCHITECTURE
1. A primary gemstone is selected before metal geometry.
2. configurator.lapidary.js resolves physical L × W × D and cut architecture.
3. Fancy-cut numerical ranges are explicitly AGDP_DESIGN_RANGE, not represented as GIA cut grades.
4. The metal typology is generated with the gemstone contract already frozen.
5. Body hollowing (when applicable) occurs before the gemstone interface.
6. Receiver dimensions derive from actual gemstone L × W × D.
7. The boolean cutter is the same parametric gemstone mesh used for render/export, not a bounding box.
8. Setting policy is filtered by cut/material vulnerability.
9. High-jewelry geometry is locally topology-audited and cannot silently fall back to metal-only.

LAPIDARY FAMILIES
- Asscher / Emerald / Baguette: stepped crown/girdle/pavilion/keel meshes.
- Princess: square modified-brilliant family with pointed-corner protection policy.
- Cushion: rounded-square brilliant family.
- Cabochon: dome + base dimensions.
- Slab/inlay: calibrated L × W × thickness.
- Pearl: measured 3-axis-compatible primary volume.

SETTING POLICIES
- princess -> V-prong or channel-capture policy; V-prong preferred.
- step cuts -> corner-prong / channel-capture / partial bezel depending material risk.
- fragile/high-risk materials -> partial bezel/capture preferred.
- slab -> inlay.
- pearl -> post-cup.

SOURCE CLASSIFICATION
STANDARD_REPORTING / GIA_GUIDANCE describe reporting or durability/setting guidance.
AGDP_DESIGN_RANGE is an internal design specification. Fancy-cut ranges are NOT claimed to be GIA cut grades or universal international ideals.

VERIFICATION LIMIT
JS syntax and deterministic lapidary generation were tested locally. 800 deterministic primary-volume cases passed dimension/range/policy assertions. Browser/WebGL and Manifold boolean runtime were NOT successfully tested in this environment. Workshop tolerances and manufacturing fitness require bench/CAD validation.
