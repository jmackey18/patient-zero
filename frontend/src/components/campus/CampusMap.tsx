import { lazy, Suspense, useMemo } from "react";
import type { ConnectionStatus, Snapshot } from "../../data/contracts";
import { residentMapStates } from "./mapModel";
import { displayTrailCount } from "./trailSample";

const CampusScene = lazy(() => import("./CampusScene"));

/** Human-readable live connection state for the map badge. */
function connectionLabel(state?: ConnectionStatus["state"]) {
  switch (state) {
    case "connecting":
      return "Connecting…";
    case "syncing":
      return "Syncing live data…";
    case "live":
      return "Live";
    case "reconnecting":
      return "Reconnecting…";
    case "error":
      return "Connection error";
    default:
      return "Unknown";
  }
}

/** Supplies live/mock resident states to the campus visualization. */
export function CampusMap({ data }: { data: Snapshot }) {
  const nodes = useMemo(() => residentMapStates(data), [data]);
  return (
    <section className="panel space-y-5" aria-labelledby="campus-map-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2
          id="campus-map-title"
          className="mb-1 font-sans text-2xl normal-case tracking-tight text-foreground"
        >
          Scam observation
        </h2>
        <div className="ml-auto flex flex-col items-end gap-2">
          <span className="badge border-dashed">
            {data.connection
              ? `SpacetimeDB · ${connectionLabel(data.connection.state)}`
              : "Synthetic mock data"}
          </span>
          <span
            className="badge"
            title="Every recovery recipient (or flagged mock resident) is shown; other residents are sampled."
          >
            {displayTrailCount(nodes)} displayed trails ·{" "}
            {nodes.length.toLocaleString()} residents
          </span>
        </div>
      </div>
      {nodes.length === 0 ? (
        <p className="muted">
          No residents available yet. Trails will populate when residents
          arrive.
        </p>
      ) : (
        <Suspense
          fallback={
            <div
              role="status"
              className="flex h-[440px] items-center justify-center rounded-xl border border-border text-muted sm:h-[560px]"
            >
              Loading UTD campus map…
            </div>
          }
        >
          <CampusScene
            nodes={nodes}
            simulationPaused={
              !!data.mockSimulation && data.mockSimulation.status !== "running"
            }
          />
        </Suspense>
      )}
    </section>
  );
}
