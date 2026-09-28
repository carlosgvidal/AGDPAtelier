# Structural Gems — validation fix

This patch addresses the two validation regressions identified in the delivered Structural Gems build.

1. Intermediate setting CSG is now audited through the existing canonicalized Manifold diagnostic rather than raw index topology.
2. The diagnostic accepts an explicit expected component count. Cufflinks remain two solids throughout setting integration; hoop earrings remain one unit until deliberate pair duplication.
3. The final Manifold mesh is canonicalized at 1e-5 mm before connectivity and `window.validate`, so coincident CSG seam vertices cannot be misclassified as open boundaries merely because they carry distinct indices.
4. Validation is not bypassed: real boundary edges, non-manifold edges, wrong component counts, non-finite coordinates and near-zero volume still reject the variant.

Static regression checks: 8/8 PASS. `node --check`: geometry and engine PASS.
