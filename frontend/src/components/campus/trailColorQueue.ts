import type { ResidentMapState } from "./mapModel";

type Status = ResidentMapState["status"];
export const GREEN_BATCH_SIZE = 6;
export const GREEN_BATCH_INTERVAL_MS = 180;
// Finish a fade before the next batch changes the color attribute.
export const GREEN_FADE_MS = 150;
const isGray = (status?: Status) =>
  status === "untouched" || status === "unavailable";
const isGreen = (status: Status) =>
  status === "warned" || status === "no_flagged";

/** Delays only existing gray→green visuals. Red, resets, and newly loaded records stay immediate. */
export function advanceTrailColors(
  previous: Map<string, Status>,
  targets: ResidentMapState[],
  greenBudget: number,
): Map<string, Status> {
  const next = new Map<string, Status>();
  for (const node of targets) {
    const before = previous.get(node.id);
    const deferred =
      isGray(before) && isGreen(node.status) && greenBudget-- <= 0;
    next.set(node.id, deferred ? before! : node.status);
  }
  return next.size === previous.size &&
    [...next].every(([id, status]) => previous.get(id) === status)
    ? previous
    : next;
}

export function hasPendingTrailColors(
  shown: Map<string, Status>,
  targets: ResidentMapState[],
) {
  return targets.some((node) => shown.get(node.id) !== node.status);
}
