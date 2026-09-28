AGDP ATELIER — HIGH JEWELRY V7 PRIMARY VOLUME

Architectural change:
The gemstone is defined before the metal typology constructor. primaryGemVolume freezes family, material, cut, mounting, dimensions and aspect from the seed. Metal geometry is then constructed under that constraint.

For a high-jewelry seed, loss of the gemstone is no longer an accepted fallback. Failure of the primary-volume saddle, seat boolean, retention union, or local topology audit rejects the generation instead of silently returning a metal-only piece.

The metal/stone interface is built in configurator.geometry.js:
1. primary mineral volume exists before typology construction;
2. base load-bearing typology is generated;
3. a stone-derived structural head/saddle is fused with substantial overlap;
4. a shallow seat is boolean-subtracted from that head;
5. prongs, channel rails or low inlay capture are unioned as metal geometry;
6. the resulting assembly receives a local topology audit and then the existing final audit.

The old V6 post-hoc setting routine is not called.

LIMITATION: Browser/WebGL runtime could not be completed in the build environment because local HTTP navigation was blocked by environment policy (ERR_BLOCKED_BY_ADMINISTRATOR). Do not treat this package as browser-runtime verified until tested in the deployment environment.
