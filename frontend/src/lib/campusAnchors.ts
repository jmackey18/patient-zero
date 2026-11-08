import type { CampusAnchor, Coordinate } from "./campusTrips";

export const ROOF_CLEARANCE_METERS = 2;

export interface GroundAnchor {
  id: string;
  name: string;
  position: Coordinate;
}

interface BuildingFootprints {
  features: {
    id?: string | number;
    geometry: { coordinates: number[][][] };
    properties: { height: number };
  }[];
}

/** Ray crossing includes the outer footprint and excludes courtyard holes. */
function insideRoof(point: Coordinate, rings: number[][][]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[j];
      if (
        ay > point[1] !== by > point[1] &&
        point[0] < ((bx - ax) * (point[1] - ay)) / (by - ay) + ax
      )
        inside = !inside;
    }
  }
  return inside;
}

/** Finds an interior roof point when an old averaged anchor falls outside a concave footprint. */
function roofPoint(
  preferred: Coordinate,
  rings: number[][][],
): Coordinate | null {
  if (insideRoof(preferred, rings)) return [...preferred];
  const levels = [
    ...new Set(rings.flatMap((ring) => ring.map((point) => point[1]))),
  ].sort((a, b) => a - b);
  let closest: Coordinate | null = null;
  let bestDistance = Infinity;
  for (let level = 1; level < levels.length; level++) {
    const y = (levels[level - 1] + levels[level]) / 2;
    const crossings: number[] = [];
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [ax, ay] = ring[i];
        const [bx, by] = ring[j];
        if (ay > y !== by > y)
          crossings.push(ax + ((bx - ax) * (y - ay)) / (by - ay));
      }
    }
    crossings.sort((a, b) => a - b);
    for (let i = 1; i < crossings.length; i += 2) {
      const point: Coordinate = [(crossings[i - 1] + crossings[i]) / 2, y];
      const distance =
        (point[0] - preferred[0]) ** 2 + (point[1] - preferred[1]) ** 2;
      if (distance < bestDistance && insideRoof(point, rings)) {
        closest = point;
        bestDistance = distance;
      }
    }
  }
  return closest;
}

/** Joins anchor IDs to the same top heights used by the building extrusions; adds a small visual clearance. */
export function createRoofAnchors(
  anchors: GroundAnchor[],
  buildings: BuildingFootprints,
): CampusAnchor[] {
  const byId = new Map(
    buildings.features.map((feature) => [String(feature.id), feature]),
  );
  return anchors.flatMap((anchor) => {
    const building = byId.get(anchor.id);
    if (
      !building ||
      !Number.isFinite(building.properties.height) ||
      building.properties.height <= 0
    )
      return [];
    const position = roofPoint(anchor.position, building.geometry.coordinates);
    return position
      ? [
          {
            ...anchor,
            position: [
              ...position,
              building.properties.height + ROOF_CLEARANCE_METERS,
            ] as CampusAnchor["position"],
          },
        ]
      : [];
  });
}
