import { insideTexas, TEXAS_FOOTPRINT_SCALE } from "./texasLayout";

export interface GraphPoint {
  id: string;
  x: number;
  y: number;
  z: number;
}

/** Stable synthetic positions above a Texas silhouette; ID alone determines footprint and elevation. */
export function residentPosition(residentId: string): GraphPoint {
  const unit = (salt: string) => {
    let hash = 2166136261;
    for (const char of `${salt}:${residentId}`)
      hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    // Avalanche the hash so sequential resident IDs do not form visible stripes.
    hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
    return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
  };
  // Bounded rejection sampling avoids density bands and never reads resident profile coordinates.
  let x = 0,
    y = 0;
  for (let attempt = 0; attempt < 64; attempt++) {
    const candidateX =
      (-14 + 26 * unit(`x:${attempt}`)) * TEXAS_FOOTPRINT_SCALE;
    const candidateY =
      (-12 + 24 * unit(`y:${attempt}`)) * TEXAS_FOOTPRINT_SCALE;
    if (insideTexas(candidateX, candidateY)) {
      x = candidateX;
      y = candidateY;
      break;
    }
  }
  return {
    id: residentId,
    x,
    y,
    z: 5 + unit("elevation") * 11,
  };
}

export interface LayoutLink {
  sourceId: string;
  targetId: string;
}

/** Spatial ordering keeps nearby dots adjacent without an expensive all-pairs neighbor search. */
function spatialKey(node: GraphPoint): number {
  const quantize = (value: number) =>
    Math.max(0, Math.min(1023, Math.floor((value + 32) * 16)));
  const coordinates = [quantize(node.x), quantize(node.y), quantize(node.z)];
  let key = 0;
  for (let bit = 0; bit < 10; bit++) {
    for (let axis = 0; axis < 3; axis++)
      key |= ((coordinates[axis] >>> bit) & 1) << (bit * 3 + axis);
  }
  return key;
}

/** A deterministic fictional spanning tree for mock forwarding: N residents, N−1 edges. Never real contacts. */
export function syntheticLayoutLinks(nodes: GraphPoint[]): LayoutLink[] {
  const ordered = nodes.map((node) => ({ node, key: spatialKey(node) }));
  ordered.sort((a, b) => a.key - b.key || a.node.id.localeCompare(b.node.id));
  const links: LayoutLink[] = [];
  for (let index = 1; index < ordered.length; index++) {
    const node = ordered[index].node;
    let closest = ordered[index - 1].node;
    let bestDistance = Infinity;
    // Each node joins an earlier node, guaranteeing connectivity with bounded work.
    for (
      let candidate = Math.max(0, index - 8);
      candidate < index;
      candidate++
    ) {
      const other = ordered[candidate].node;
      const distance =
        (node.x - other.x) ** 2 +
        (node.y - other.y) ** 2 +
        (node.z - other.z) ** 2;
      if (distance < bestDistance) {
        closest = other;
        bestDistance = distance;
      }
    }
    links.push({ sourceId: closest.id, targetId: node.id });
  }
  return links;
}
