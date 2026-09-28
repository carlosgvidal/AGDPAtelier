# Structural Gems — Topological Settings

This build replaces the single-family/single-interface mineral program with event-level mineral and setting graphs.

Implemented changes:
- mixed lapidary families per composition;
- round brilliant melee in addition to existing fancy cuts;
- halo system with orbital secondary stones;
- pave/bead, shared-prong and channel fields;
- setting topology compiled before body construction;
- mineral/setting events broaden and deform the body support field before the body mesh is built;
- setting transitions inherit body faceting/organic/surface-relief parameters;
- no presentation fallback; exact lapidary seat remains mandatory.

The post-body stage is retained only to resolve the exact physical surface and execute the CSG seat/retention. It no longer decides the mineral family, setting system, hierarchy or composition.
