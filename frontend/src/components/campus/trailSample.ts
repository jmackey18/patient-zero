import type { ResidentMapState } from "./mapModel";

export const MAX_DISPLAY_TRAILS = 120;
export const isRed = (node: ResidentMapState) =>
  node.status === "recovery" || node.status === "flagged";

/** Stable ID ordering keeps paths in place when gray residents become warned. */
function rank(id: string): number {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/** The usual budget expands for large outbreaks rather than hiding recovery recipients. */
export function displayTrailCount(nodes: ResidentMapState[]): number {
  const redCount = nodes.filter(isRed).length;
  return Math.min(nodes.length, Math.max(MAX_DISPLAY_TRAILS, redCount + 1));
}

/** Includes every recovery/flagged resident, then fills remaining slots with actual residents.
 * Ordinary selection is independent of gray/green status; inspection pins the selected ID.
 */
export function sampleResidentTrails(
  nodes: ResidentMapState[],
  selectedId = "",
): ResidentMapState[] {
  const red = nodes.filter(isRed);
  const ordinary = nodes
    .filter((node) => !isRed(node))
    .sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
  const chosen = ordinary.slice(0, displayTrailCount(nodes) - red.length);
  const selected = ordinary.find((node) => node.id === selectedId);
  if (selected && !chosen.includes(selected))
    chosen[chosen.length - 1] = selected;
  return [...red, ...chosen].sort((a, b) => a.id.localeCompare(b.id));
}
