AGDP ATELIER HIGH JEWELRY V6

Purpose: reduce rejected high-jewelry variants, especially rings and other small typologies.

Changes:
- Small typologies build a structural receiver/shoulder before the gemstone seat.
- The seat is biased outward and cut primarily into that receiver, not through the load-bearing band.
- Prongs/channel rails/inlay retainers are united to the receiver/metal.
- A local closed-mesh topology audit runs immediately after the setting operation.
- If the setting fails locally, only the gemstone setting is abandoned; the valid base morphology is retained.
- Full morphology retry cap reduced from 16 to 7.

Verification scope:
- JavaScript syntax checked with node --check.
- Package integrity checked with unzip -t.
- Static code path inspected for receiver -> seat boolean -> retention union -> local topology gate -> final audit.
- NOT browser/WebGL runtime tested.
- NOT bench/manufacturing validated.
