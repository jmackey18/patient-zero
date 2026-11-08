import { lazy, Suspense, useMemo, useState } from "react";
import type { Snapshot } from "../../data/contracts";
import {
  constellationNodes,
  EXPOSURE_COLORS,
  EXPOSURE_LABELS,
} from "./mapModel";

const AvonScene = lazy(() => import("./AvonScene"));
interface Props {
  data: Snapshot;
  selectedId: string;
  onSelect: (id: string) => void;
  onOpenPhone: (id: string) => void;
}

/** Shows every resident in WebGL, with node selection and independent observed-state details. */
export function AvonMap({ data, selectedId, onSelect, onOpenPhone }: Props) {
  const [warningOverlay, setWarningOverlay] = useState<boolean | null>(null);
  const showWarnings = warningOverlay ?? !data.mockSimulation;
  const residents = data.residents;
  const selected =
    residents.find((resident) => resident.id === selectedId) ?? residents[0];
  const nodes = useMemo(() => constellationNodes(data), [data]);
  const selectedSignal = nodes.find((node) => node.id === selected?.id);
  const counts = nodes.reduce(
    (totals, node) => {
      totals[node.status]++;
      if (node.warningCount > 0) totals.warned++;
      if (node.investigating) totals.investigating++;
      return totals;
    },
    { no_flagged: 0, flagged: 0, unavailable: 0, warned: 0, investigating: 0 },
  );

  return (
    <section className="panel space-y-5" aria-labelledby="avon-map-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">Scam observation · synthetic network</p>
          <h2
            id="avon-map-title"
            className="mb-1 font-sans text-2xl normal-case tracking-tight text-foreground"
          >
            Resident network
          </h2>
        </div>
        <span className="badge">
          {nodes.length.toLocaleString()} residents · one network
        </span>
      </div>
      <p className="muted">
        One dot per resident, with no connection lines between people. Colors
        reflect observed records; green is not a guarantee of safety. The Texas
        ground layer is schematic. Node positions and varied heights are
        synthetic, not resident locations, terrain, or risk levels.
      </p>
      <ul
        className="flex flex-wrap gap-x-6 gap-y-3 text-sm"
        aria-label="Network legend and resident counts"
      >
        {(["no_flagged", "flagged", "unavailable"] as const).map((status) => (
          <li key={status} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: EXPOSURE_COLORS[status] }}
            />
            {EXPOSURE_LABELS[status]}: {counts[status].toLocaleString()}
          </li>
        ))}
        {data.mockSimulation && (
          <li className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-blue-400"
            />
            Campaign under investigation (scripted mock):{" "}
            {counts.investigating.toLocaleString()} residents
          </li>
        )}
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-3.5 w-3.5 rounded-full border-2 border-amber-400"
          />
          {data.connection
            ? "Warning data unavailable"
            : `Warning created: ${counts.warned.toLocaleString()} residents`}
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 rounded-full border-2 border-white"
          />
          Selected resident
        </li>
      </ul>
      {data.connection && (
        <p className="muted">
          Live detection and warning feeds are not connected. Gray dots indicate
          unavailable data, not safe residents.
        </p>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showWarnings}
          onChange={(event) => setWarningOverlay(event.target.checked)}
        />
        Show warning rings (warning counts remain visible)
      </label>
      {data.residents.length === 0 ? (
        <p className="muted">
          No residents available yet. The graph will populate when residents
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
                Loading 3D view…
              </div>
            }
          >
            <AvonScene
              nodes={nodes}
              showWarnings={showWarnings}
              selectedId={selected?.id ?? ""}
              onSelect={onSelect}
            />
          </Suspense>
          <p className="muted">
            All {nodes.length.toLocaleString()} dots stay in the network while
            you inspect residents. Click or tap a dot to see its details below.
          </p>
        </>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <div
          className="rounded-lg border border-border p-4 text-sm"
          aria-label="Investigation and propagation status"
        >
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
            <p className="muted mt-2">
              {data.connection
                ? "Live campaign and investigation data unavailable."
                : "No campaign loaded."}
            </p>
          )}
          <p className="muted mt-3">
            Investigation is an assessment, not a confirmed stop. Warning
            acknowledgment does not clear exposure. Nemotron and intervention
            events are not connected.
          </p>
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
                <dt>Warnings created / acknowledged</dt>
                <dd>
                  {data.connection
                    ? "Unavailable"
                    : `${selectedSignal?.warningCount ?? 0} / ${selectedSignal?.acknowledgedCount ?? 0}`}
                </dd>
              </div>
            </dl>
            <button onClick={() => onOpenPhone(selected.id)}>
              Open Resident Phone
            </button>
          </article>
        )}
      </div>
      <p className="muted border-t border-border pt-4">
        {data.mockSimulation
          ? "Color changes show the browser-local mock spread. Detection and warnings are scripted phases, not detector output. No Nemotron calls or automatic intervention occur."
          : "No propagation paths are shown. Dot positions do not establish contacts or message paths."}{" "}
        Warning rings mean records were created, not delivered or protective.
      </p>
    </section>
  );
}
