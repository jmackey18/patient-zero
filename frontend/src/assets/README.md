# UT Dallas campus anchors

`utd-campus.json` contains the mapped UT Dallas campus outline and 64 approximate
building points derived from OpenStreetMap. The campus outline is from
[relation 7316239](https://www.openstreetmap.org/relation/7316239), outer way 498756178.
Points use the mean longitude/latitude of a closed building way's non-repeated
vertices, not surveyed entrances or verified building centroids. The stored seed points may fall
outside a concave footprint; at render time `campusAnchors.ts` moves such points
inside the roof polygon, avoiding courtyard holes, and adds the building top
height plus two meters of visual clearance. Points and arc endpoints use this
same derived 3D position. All current rendered points are inside the campus boundary.

Retrieved November 8, 2026. © OpenStreetMap contributors; distributed under the
[Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
See [OpenStreetMap attribution](https://www.openstreetmap.org/copyright).
The JSON is the machine-readable derived dataset; no editor or resident data is included.

Source: `https://api.openstreetmap.org/api/0.6/map?bbox=...`, downloaded as four
boxes and merged by OSM IDs:

- `-96.765,32.975,-96.751,32.987`
- `-96.751,32.975,-96.737,32.987`
- `-96.765,32.987,-96.751,32.999`
- `-96.751,32.987,-96.737,32.999`

Extraction keeps complete closed building ways, excluding `building=no|roof`.
Of 193 candidate building points inside the campus boundary, 64 are selected
by farthest-point sampling, beginning nearest the overview center
`[-96.7503,32.9876]`. This spreads markers across campus rather than concentrating
in dense housing. Only way ID, name (or "Campus building"), and position are retained.
Campus bounds are `[-96.7588315,32.9783176,-96.7417973,32.9969301]`.

Resident assignments and animated arches are entirely synthetic. Arcs take
18 seconds to cross with three-second tails; this is visual pacing, not human
travel speed. Building markers carry no resident or campaign verdict. No indoor
navigation or actual contacts are included.

## Building footprints

`utd-buildings.json` uses the same four cached OSM extracts, source date, and ODbL
license. It retains 193 complete closed building ways whose mean vertex position
is inside the campus boundary, excluding `building=no|roof`. Footprints may extend
slightly across the boundary. Incomplete ways and buildings mapped only as relations
are omitted. Geometry is approximate and may not include newer buildings.

The GeoJSON contains way IDs, polygon coordinates, `height`, `base`, and
`heightSource` only. Heights are in meters:

- 148 footprints use a positive mapped `height` tag (`mapped`).
- 20 estimate height from `building:levels` × 3 meters (`levels`).
- 25 use a 12-meter visual fallback (`fallback`).

A positive `min_height` supplies the extrusion base, otherwise zero; invalid bases
at or above the top height reset to zero. Meter, feet, and bare numeric height tags
are accepted. No personal or editor metadata is retained. These are simplified
visual blocks, not surveyed elevations or detailed architectural models.

MapLibre renders this local GeoJSON beneath the existing deck.gl points and arcs.
It does not require a second tile source or add backend data contracts.

Online basemap tiles use OpenFreeMap/OpenMapTiles with visible attribution.
The bundled points and arcs remain available when tiles fail. No API key or
runtime routing request is required. For actual campus navigation, use
[UT Dallas's official map](https://map.utdallas.edu/).
