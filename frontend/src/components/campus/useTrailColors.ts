import { useEffect, useRef, useState } from "react";
import type { ResidentMapState } from "./mapModel";
import {
  advanceTrailColors,
  hasPendingTrailColors,
  GREEN_BATCH_SIZE,
  GREEN_BATCH_INTERVAL_MS,
} from "./trailColorQueue";

/** Maintains one presentation timer across incoming snapshots; never delays adapter state. */
export function useTrailColors(
  nodes: ResidentMapState[],
  reducedMotion: boolean,
) {
  const [colors, setColors] = useState(() =>
    advanceTrailColors(new Map(), nodes, Infinity),
  );
  const shown = useRef(colors);
  const targets = useRef(nodes);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    targets.current = nodes;
    const stop = () => {
      if (timer.current !== null) clearInterval(timer.current);
      timer.current = null;
    };
    const advance = (budget: number) => {
      shown.current = advanceTrailColors(
        shown.current,
        targets.current,
        budget,
      );
      setColors(shown.current);
      if (!hasPendingTrailColors(shown.current, targets.current)) stop();
    };
    advance(reducedMotion ? Infinity : 0);
    if (hasPendingTrailColors(shown.current, nodes) && timer.current === null) {
      timer.current = setInterval(
        () => advance(GREEN_BATCH_SIZE),
        GREEN_BATCH_INTERVAL_MS,
      );
    }
  }, [nodes, reducedMotion]);
  useEffect(
    () => () => {
      if (timer.current !== null) clearInterval(timer.current);
      timer.current = null;
    },
    [],
  );
  return colors;
}
