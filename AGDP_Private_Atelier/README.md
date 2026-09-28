# A GROSS DOMESTIC PRODUCT. — Private Atelier

Private high-jewelry generative design study for integration inside the existing AGDP website.

## Intended placement
Upload this folder inside the website repository, for example as `/atelier-private/`. Do not add it to public navigation.

## Privacy
`index.html` contains `noindex,nofollow,noarchive`, but that is **not authentication**. A hidden URL can still be opened by anyone who knows it. Protect the route at the hosting/server layer (HTTP Basic Auth, access-control rule, reverse-proxy authentication, or the site's existing authentication system).

## Generator
A seed controls the occurrence. The generator can randomize gemstone family, cut/format, scale, count, distribution and setting mode while preserving user-selected constraints. Modes include center stone, cluster, pavé, pearl, slab/laja and cabochon. Traditional cuts include round brilliant, oval, emerald, Asscher, princess, cushion, pear, marquise, trillion and rose cut.

The downloaded JSON is the reproducible design record. Gem-bearing outputs are intentionally labelled DESIGN STUDY: stone dimensions, seats, prongs/beads, tolerances and structural integrity must be reviewed before manufacture.

## Dependencies
Three.js and OrbitControls are loaded as ES modules from unpkg, matching the web-native approach of the existing Atelier. If the main site vendors these dependencies locally, replace the import-map URLs accordingly.
