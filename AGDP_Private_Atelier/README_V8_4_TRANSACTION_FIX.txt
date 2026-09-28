AGDP ATELIER HIGH JEWELRY — V8.4 TRANSACTION FIX

Base: V8.2 Runtime Fix.
Reference controls: V6 and V8.

Purpose
-------
Repair the render-blocking regression introduced when the High Jewelry setting
transaction became fatal. The gemstone setting remains lapidary-driven, but a
failure in that optional transaction no longer destroys an otherwise valid
base-metal generation.

Changes
-------
1. agdpHJ8ApplyPrimaryVolume() is now recoverable.
   The following failures roll back High Jewelry and return the original
   manifold:
   - missing primary mineral volume
   - missing structural anchor
   - saddle/receiver union failure
   - lapidary cutter construction failure
   - seat boolean failure
   - retention union failure
   - local topology audit error/failure

2. Temporary Manifold/WASM objects created by a rejected High Jewelry
   transaction are explicitly disposed before fallback.

3. A rejected setting is recorded in highJewelrySettingV8 and the program is
   disabled for that compiled variant, preserving diagnostic information.

4. The accepted base-metal manifold continues through the normal global audit.
   Global manufacturing/topology gates are NOT bypassed or relaxed.

5. UI gemstone planning is restored to the V6/V8 post-acceptance contract:
   presentation planning occurs after a CAD mesh has been accepted.

Unchanged
---------
- Three.js viewport and renderer
- camera and lighting
- global topology/manufacturing audits
- typology constructors
- lapidary primary-volume geometry
- V8.2 closed cabochon/pearl meshes

Verification performed
----------------------
- JavaScript syntax check for all configurator*.js files.
- Static inspection confirms no fatal AGDP V7/V8 throw remains inside
  agdpHJ8ApplyPrimaryVolume().
- Static inspection confirms fallback returns the original input manifold.
- This environment does not execute browser WebGL + Manifold WASM end-to-end.
