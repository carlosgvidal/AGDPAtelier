# AGDP High Jewelry — Mineral/Metal Grammar v11

## Principle
A gemstone is not an attachment and a setting is not a decoration. The generative unit is a structural system:

`mineral event -> setting interface -> metal load path -> jewelry body -> mechanism`

The mineral event and the body are compiled from the same load graph before Geometry constructs metal.

## 1. Mineral composition regimes

| Regime | Stones | Hierarchy | Structural consequence |
|---|---:|---|---|
| monolith | 1 | dominant | replaces the principal mass/event; body develops around it |
| dyad | 2 | paired | creates an axis/tension; metal must connect or oppose both events |
| constellation | 3–5 | primary + secondary | secondary stones propagate/contradict the primary load path |
| field | 4–7 | distributed | stones become a structural edge/row/surface; never random scatter |
| composite | 1–3 | material integration | mineral becomes face/segment/window/inlay of the body |
| sign | 1 | small but decisive | occupies a load/articulation point; hierarchy is semantic, not size-based |

Default policy is statement-biased and saturation-limited. High jewelry is not equated with stone count.

## 2. Mineral families

### Faceted
Geometry exposes crown/girdle/pavilion as different structural zones. Pavilion is exclusion volume; girdle/crown are retention zones. Compatible interfaces depend on durability and cut: prong, V-prong, basket, bezel/partial bezel, bar, channel, flush or tension when technically admissible.

### Cabochon
Dome is display volume; back/perimeter define seat. Preferred interfaces are bezel/partial bezel, selected prongs, or inlay where the material and geometry allow it.

### Slab / inlay
The mineral is a plate/face/segment rather than a perched stone. The body must provide a continuous seat and protected perimeter. Interfaces: inlay, bezel or channel-frame.

### Pearl
Pearl is an ovoide/spherical volume with its own plausible size range and support axis. Interfaces: post-cup or cup-cage. It is not treated as a faceted stone with generic prongs.

## 3. Setting interfaces are topology

- **prong / V-prong**: load paths terminate in claws that make real crown/girdle contact.
- **basket**: under-gallery is part of the body; prongs grow from it.
- **bezel / partial bezel**: perimeter wall grows continuously into the body.
- **channel**: opposing structural walls belong to the body; stones occupy the interval between them.
- **bar**: shared transverse supports participate in the graph between adjacent mineral events.
- **flush**: the seat is contained within sufficient body thickness; no fictitious floating rim.
- **tension**: opposing body branches are the setting; it is permitted only where the load graph and material policy support it.
- **inlay / channel-frame**: the mineral replaces a face/segment of the body.
- **post-cup / cup-cage**: axial support and cup/cage are continuous with the body.

## 4. Load-graph translation

| Existing AGDP load | Mineral/setting interpretation |
|---|---|
| node / mass | may be replaced by the dominant mineral event |
| bridge | may become basket bridge, bar, shared support, or path between mineral events |
| surround | may become bezel, basket perimeter or cup |
| suspension | may become prong/cage/tension support |
| continuity | drives shoulders/walls/body transitions into the setting |
| void / traverse | reserves pavilion, cleaning/access or optical void; never cuts through required support |
| organism | controls curvature/growth of transitions, not arbitrary stone placement |

## 5. Dimensional policy
Stone scale is chosen before body construction and is constrained by mineral family and jewelry typology. Exceptional auction/museum specimens are not used as ordinary generator defaults.

Pearl policy is conservative relative to GIA typical ranges. Current code caps pearl primary widths by typology (e.g. ring 6–11 mm, brooch 8–14 mm, hoop/ear cuff 6–10 mm).

## 6. Engineering floors used by the generator
These are conservative generator constraints, not claims of universal bench-jewelry law:

- channel wall: 1.00 mm per side (GIA benchmark for channel-set melee)
- pavé/bead border: 0.50 mm minimum (GIA benchmark)
- nominal calibrated melee spacing: 0.10 mm
- global AGDP manufacturing wall/feature audits remain active

## 7. Rejection rules
A candidate must be rejected or its interface changed if:

1. the mineral family/material is incompatible with the selected setting;
2. a required load path from retention to body does not exist;
3. a void/perforation intersects the mineral support field;
4. channel/pavé would violate minimum wall/border policy;
5. the setting contacts the wrong stone zone (e.g. no crown/girdle contact for prongs);
6. the stone exceeds the typology/family size policy;
7. removing the stone leaves a formally complete body with no structural absence (the "pasted-on stone" test);
8. the final metal manifold fails the existing topology/manufacturing audit.

## 8. Design character
The grammar privileges hierarchy, proportion and controlled contrast over saturation. Increasing stone count reduces individual scale; increasing mineral scale reduces count and competing focal metal. Color/optical complexity can be balanced by simpler metal organization; highly complex metal reduces mineral density. The intent is statement through hierarchy rather than accumulation.
