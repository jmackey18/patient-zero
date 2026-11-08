/** Widen the ground and resident footprint together without stretching node elevations. */
export const TEXAS_FOOTPRINT_SCALE = 1.8;

/** Hand-drawn Texas silhouette, not geographic boundary or resident location data. */
const BASE_OUTLINE: ReadonlyArray<readonly [number, number]> = [
  [-5, 12],
  [1, 12],
  [1, 6],
  [2, 5.7],
  [3, 5.3],
  [4, 5.5],
  [5, 5],
  [6, 5.3],
  [7, 4.8],
  [8, 5],
  [9, 4.6],
  [11, 4.6],
  [11, 1.5],
  [12, 0.1],
  [11.5, -2],
  [12, -3],
  [10, -4],
  [8, -5],
  [6.2, -6.8],
  [4.8, -8.8],
  [4.5, -10.3],
  [5, -12],
  [2, -11],
  [0.5, -8.2],
  [-1, -6.5],
  [-2, -4.5],
  [-4, -3],
  [-5.5, -3],
  [-7, -5],
  [-9, -3.8],
  [-10, -1],
  [-12, 1],
  [-14, 3],
  [-5, 3],
];

export const TEXAS_OUTLINE: ReadonlyArray<readonly [number, number]> =
  BASE_OUTLINE.map(([x, y]) => [
    x * TEXAS_FOOTPRINT_SCALE,
    y * TEXAS_FOOTPRINT_SCALE,
  ]);

/** Ray crossing keeps synthetic node footprints inside the decorative ground silhouette. */
export function insideTexas(x: number, y: number): boolean {
  let inside = false;
  for (
    let i = 0, j = TEXAS_OUTLINE.length - 1;
    i < TEXAS_OUTLINE.length;
    j = i++
  ) {
    const [ax, ay] = TEXAS_OUTLINE[i];
    const [bx, by] = TEXAS_OUTLINE[j];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
      inside = !inside;
  }
  return inside;
}
