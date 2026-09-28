AGDP ATELIER HIGH JEWELRY — V9 PRIMARY VOLUME

Architectural correction
------------------------
The gemstone is no longer positioned from the completed metal skin.

Previous V8 order:
  prepare gemstone parameters
  -> build complete metal typology
  -> inspect completed metal for an anchor
  -> place gemstone
  -> try to cut a seat
  -> render gemstone separately

V9 order:
  prepare lapidary family and exact dimensions
  -> reserve/freeze the primary mineral volume in Geometry
  -> suppress competing focal metal before typology construction
  -> build the metal typology with that primary envelope already reserved
  -> integrate receiver/seat/retention around the frozen volume
  -> render/export the same resolved lapidary volume

Four lapidary families remain:
  faceted
  cabochon
  slab
  pearl

The lapidary specification remains responsible for cut proportions/material
policy. Geometry is now responsible for spatial volume, structural role,
position, receiver, seat, retention, topology and final manufacturing audit.

Important
---------
This is an architectural migration, not merely a visual fallback. The exact
lapidary mesh remains a separate material object for rendering/export because
stone and metal are physically different solids, but its position and volume
are now defined by Geometry before metal construction rather than pasted onto
the finished piece.

The global manufacturing/topology gates remain unchanged.
