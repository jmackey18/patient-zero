export type Coordinate = [longitude: number, latitude: number];
export type ArcPosition = [
  longitude: number,
  latitude: number,
  altitude: number,
];
export interface CampusAnchor {
  id: string;
  name: string;
  position: ArcPosition;
}
export interface ResidentTrip {
  id: string;
  sourceId: string;
  targetId: string;
  path: ArcPosition[];
  timestamps: number[];
}

/** Reuses GPU path buffers when a fresh filtered array contains the same immutable trips.
 * Compare object identity, not just IDs: rebuilt paths/timestamps must invalidate buffers.
 */
export function sameTripData(next: unknown, previous?: unknown): boolean {
  return (
    next === previous ||
    (Array.isArray(next) &&
      Array.isArray(previous) &&
      next.length === previous.length &&
      next.every((trip, index) => trip === previous[index]))
  );
}

export const TRAIL_SECONDS = 3;
export const ARC_DURATION_SECONDS = 15 / 1.1;
export const TRIP_LOOP_SECONDS = ARC_DURATION_SECONDS * 2;
const ARC_SEGMENTS = 24;
export const CAMPUS_VIEW = {
  longitude: -96.7503,
  latitude: 32.9876,
  zoom: 14.7,
  pitch: 45,
  bearing: 0,
};

/** Campus-scale ground distance; used only to choose an illustrative arc height. */
function campusDistance(a: ArcPosition, b: ArcPosition): number {
  return (
    111320 *
    Math.hypot(
      (b[0] - a[0]) * Math.cos((CAMPUS_VIEW.latitude * Math.PI) / 180),
      b[1] - a[1],
    )
  );
}

/** Deterministic per-ID random stream; never reads resident profiles, risk, or backend coordinates. */
function randomFor(id: string) {
  let seed = 2166136261;
  for (const char of id)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Creates phased, elevated links between building anchors, independent of actual contacts or travel.
 * Sampled residents cross continuously at the same speed, without population-dependent timing.
 * Repeated cycles keep tails continuous at the clock seam and at rooftop turns.
 */
export function createResidentTrips(
  ids: string[],
  anchors: CampusAnchor[],
): ResidentTrip[] {
  const ordered = [...anchors].sort((a, b) => a.id.localeCompare(b.id));
  if (ordered.length < 2) return [];
  const interval = TRIP_LOOP_SECONDS / 2;
  return ids.map((id) => {
    const random = randomFor(id);
    const sourceIndex = Math.floor(random() * ordered.length);
    const targetIndex =
      (sourceIndex + 1 + Math.floor(random() * (ordered.length - 1))) %
      ordered.length;
    const source = ordered[sourceIndex];
    const target = ordered[targetIndex];
    const height =
      Math.min(
        240,
        Math.max(65, campusDistance(source.position, target.position) * 0.24),
      ) *
      (0.85 + random() * 0.3);
    const phase = random() * TRIP_LOOP_SECONDS;
    const path: ArcPosition[] = [];
    const timestamps: number[] = [];
    const pointAt = (fraction: number): ArcPosition => [
      source.position[0] + (target.position[0] - source.position[0]) * fraction,
      source.position[1] + (target.position[1] - source.position[1]) * fraction,
      source.position[2] +
        (target.position[2] - source.position[2]) * fraction +
        4 * height * fraction * (1 - fraction),
    ];
    for (let cycle = -2; cycle <= 0; cycle++) {
      const start = cycle * TRIP_LOOP_SECONDS + phase;
      for (let leg = 0; leg < 2; leg++) {
        for (
          let step = cycle === -2 && leg === 0 ? 0 : 1;
          step <= ARC_SEGMENTS;
          step++
        ) {
          const fraction = step / ARC_SEGMENTS;
          path.push(pointAt(leg === 0 ? fraction : 1 - fraction));
          timestamps.push(
            start + leg * interval + fraction * ARC_DURATION_SECONDS,
          );
        }
      }
    }
    return { id, sourceId: source.id, targetId: target.id, path, timestamps };
  });
}

/** Finds the current arc head for selected-resident highlighting. */
export function tripPosition(trip: ResidentTrip, time: number): ArcPosition {
  for (let i = 1; i < trip.timestamps.length; i++) {
    if (trip.timestamps[i] < time) continue;
    const fraction = Math.max(
      0,
      Math.min(
        1,
        (time - trip.timestamps[i - 1]) /
          (trip.timestamps[i] - trip.timestamps[i - 1]),
      ),
    );
    const a = trip.path[i - 1];
    const b = trip.path[i];
    return [
      a[0] + (b[0] - a[0]) * fraction,
      a[1] + (b[1] - a[1]) * fraction,
      a[2] + (b[2] - a[2]) * fraction,
    ];
  }
  return trip.path[trip.path.length - 1];
}
