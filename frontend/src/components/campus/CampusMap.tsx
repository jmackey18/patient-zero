import { lazy, Suspense, useMemo } from "react";
import type { Snapshot } from "../../data/contracts";
import { LiveInvestigation } from "../LiveInvestigation";
import {
  residentMapStates,
  EXPOSURE_COLORS,
  EXPOSURE_LABELS,
} from "./mapModel";

const CampusScene = lazy(() => import("./CampusScene"));
interface Props {
  data: Snapshot;
  selectedId: string;
  onSelect: (id: string) => void;
}

/** Shows synthetic campus journeys with resident selection and independent observed-state details. */
export function CampusMap({ data, selectedId, onSelect }: Props) {
  const residents = data.residents;
  const selected =
    residents.find((resident) => resident.id === selectedId) ?? residents[0];
  const nodes = useMemo(() => residentMapStates(data), [data]);
  const selectedSignal = nodes.find((node) => node.id === selected?.id);
  const counts = nodes.reduce(
    (totals, node) => {
      totals[node.status]++;
      if (node.investigating) totals.investigating++;
      return totals;
    },
    {
      no_flagged: 0,
      flagged: 0,
      unavailable: 0,
      exposed: 0,
      warned: 0,
      untouched: 0,
      investigating: 0,
    },
  );

  return (
    <section className="panel space-y-5" aria-labelledby="campus-map-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="campus-map-title"
            className="mb-1 font-sans text-2xl normal-case tracking-tight text-foreground"
          >
            Scam observation
          </h2>
        </div>
        <span className="badge">{nodes.length.toLocaleString()} residents</span>
      </div>
      <ul
        className="flex flex-wrap gap-x-6 gap-y-3 text-sm"
        aria-label="Trail legend and resident counts"
      >
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-slate-300"
          />
          Campus buildings
        </li>
        {(data.connection
          ? ([
              "exposed",
              "warned",
              "untouched",
              ...(counts.unavailable ? ["unavailable" as const] : []),
            ] as const)
          : (["no_flagged", "flagged", "unavailable"] as const)
        ).map((status) => (
          <li key={status} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-1 w-6 rounded-full"
              style={{ backgroundColor: EXPOSURE_COLORS[status] }}
            />
            {EXPOSURE_LABELS[status]}: {counts[status].toLocaleString()}
          </li>
        ))}
        {data.mockSimulation && (
          <li className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-6 shrink-0 rounded-full border-2 border-blue-400"
            />
            Campaign under investigation (scripted mock):{" "}
            {counts.investigating.toLocaleString()} residents
          </li>
        )}
      </ul>
      {data.residents.length === 0 ? (
        <p className="muted">
          No residents available yet. Trails will populate when residents
          arrive.
        </p>
      ) : (
        <>
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
                !!data.mockSimulation &&
                data.mockSimulation.status !== "running"
              }
              selectedId={selected?.id ?? ""}
              onSelect={onSelect}
            />
          </Suspense>
        </>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <div
          className="rounded-lg border border-border p-4 text-sm"
          aria-label="Investigation and propagation status"
        >
          {data.connection ? (
            <LiveInvestigation data={data} />
          ) : (
            <>
              <h3>Campaign investigation</h3>
              {data.campaigns.length ? (
                <ul className="mt-3 space-y-2">
                  {data.campaigns.map((campaign) => (
                    <li key={campaign.clusterId}>
                      {campaign.label} · Detection: {campaign.detectionStatus} ·
                      Investigation:{" "}
                      {campaign.investigationStatus === "pending"
                        ? "in progress"
                        : campaign.investigationStatus.replaceAll("_", " ")}
                      {data.mockSimulation && " (scripted mock)"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted mt-2">No campaign loaded.</p>
              )}
              <p className="muted mt-3">
                Investigation is an assessment, not a confirmed stop. Warning
                acknowledgment does not clear exposure. Nemotron and
                intervention events are not connected.
              </p>
            </>
          )}
        </div>
        {selected && (
          <article
            className="rounded-lg border border-border bg-background/50 p-4"
            aria-label="Selected resident details"
          >
            <h3>{selected.displayName}</h3>
            <p className="muted">{selected.persona}</p>
            <p className="mt-3 text-sm">
              {selectedSignal && EXPOSURE_LABELS[selectedSignal.status]}
            </p>
            {selectedSignal?.investigating && (
              <p className="mt-2 text-sm text-blue-400">
                Associated campaign under investigation (scripted mock).
              </p>
            )}
            <dl className="my-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt>Messages received</dt>
                <dd>
                  {data.connection
                    ? "Unavailable"
                    : (selectedSignal?.messageCount ?? 0)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Messages in flagged clusters</dt>
                <dd>
                  {data.connection
                    ? "Unavailable"
                    : (selectedSignal?.flaggedCount ?? 0)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>
                  {data.connection
                    ? "Notification records"
                    : "Warnings created / acknowledged"}
                </dt>
                <dd>
                  {data.connection
                    ? data.liveFeed
                      ? (selectedSignal?.warningCount ?? 0)
                      : "Unavailable"
                    : `${selectedSignal?.warningCount ?? 0} / ${selectedSignal?.acknowledgedCount ?? 0}`}
                </dd>
              </div>
              {selected.liveState && (
                <div className="flex justify-between gap-3">
                  <dt>Backend flags</dt>
                  <dd>
                    Exposed: {selected.liveState.exposed ? "yes" : "no"} ·
                    Warned: {selected.liveState.warned ? "yes" : "no"}
                  </dd>
                </div>
              )}
            </dl>
          </article>
        )}
      </div>
      <p className="muted border-t border-border pt-4">
        {data.mockSimulation
          ? "Color changes show the browser-local mock spread. Detection and warnings are scripted phases, not detector output. No Nemotron calls or automatic intervention occur."
          : "Building points and arcs are illustrative, not actual resident locations, contacts, or message paths."}
      </p>
    </section>
  );
}
