import { useState } from "react";
import type { Snapshot } from "../../data/contracts";
import { useLiveFeed } from "../../data/useLiveFeed";

/**
 * Simulation controls and the latest investigation (live mode). Everything shown here is written by the real
 * pipeline: sim_runner.py/attacker.py -> live_detect.py -> Nemotron -> SpacetimeDB.
 */
export function SimulatePanel({
  data,
  onSimulate,
  onReset,
}: {
  data: Snapshot;
  onSimulate: (scenarioId: string) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const feed = useLiveFeed(data);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const run = feed.latestRun;
  const active = run?.status === "requested" || run?.status === "running";
  const incident = feed.latestIncident;

  async function perform(action: () => Promise<void>) {
    setError("");
    setPending(true);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setPending(false);
    }
  }

  const runLabel =
    run &&
    (run.scenarioId === "reset"
      ? `Reset · ${run.status === "done" ? `${data.residents.length} residents ready` : run.status}`
      : `${feed.scenarios.find((s) => s.id === run.scenarioId)?.label ?? run.scenarioId} · run ${run.id} · ${run.status}`);

  return (
    <section className="panel space-y-5" aria-label="Simulate a scam attack">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-1">Simulate an attack</h2>
          <p className="muted">
            Each button resets the city and launches a real attack. The
            detector, Nemotron and SpacetimeDB produce everything below.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {runLabel && <span className="badge">{runLabel}</span>}
          <button
            className="danger-button"
            disabled={pending || active}
            onClick={() => void perform(onReset)}
            title="Clears the last run and reseeds the 5000 residents"
          >
            Reset city
          </button>
        </div>
      </div>

      {feed.scenarios.length === 0 ? (
        <p className="muted">
          No scenarios yet. Start{" "}
          <code className="font-mono">python -m simulation.sim_runner</code> on
          the server.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {feed.scenarios.map((s) => (
            <button
              key={s.id}
              className="h-full text-left"
              disabled={pending || active}
              onClick={() => void perform(() => onSimulate(s.id))}
            >
              <span className="block font-semibold">Simulate: {s.label}</span>
              <span className="mt-1 block text-xs font-normal text-muted">
                {s.description}
              </span>
            </button>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="min-w-0 space-y-3">
        <p className="eyebrow">Nemotron investigation</p>
        {!feed.available ? (
          <p className="muted">
            Investigation feed unavailable until the live subscription syncs.
          </p>
        ) : !incident ? (
          <p className="muted">No campaign detected yet.</p>
        ) : (
          <div className="space-y-3 rounded-lg border border-border bg-background/40 p-4">
            <div className="flex flex-wrap gap-2">
              <span className="badge max-w-full break-all">
                {incident.campaignId}
              </span>
              <span className="badge">{incident.status}</span>
            </div>
            {incident.status === "investigating" ? (
              <p className="muted">
                Nemotron is reasoning over cluster metadata…
              </p>
            ) : incident.status === "complete" ? (
              <>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
                  <div>
                    <dt className="eyebrow">Coordinated</dt>
                    <dd className="mt-1 text-2xl font-medium">
                      {incident.isCoordinated ? "Yes" : "No"}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Confidence</dt>
                    <dd className="mt-1 text-2xl font-medium">
                      {incident.confidence}%
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Variants</dt>
                    <dd className="mt-1 text-2xl font-medium">
                      {incident.numVariants}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Time spread</dt>
                    <dd className="mt-1 text-2xl font-medium">
                      {incident.timeSpreadS.toFixed(2)}s
                    </dd>
                  </div>
                </dl>
                <p className="text-sm leading-relaxed">{incident.reasoning}</p>
                {incident.warningText && (
                  <p className="warning-card text-sm">{incident.warningText}</p>
                )}
              </>
            ) : (
              <p className="muted">
                {incident.status === "failed"
                  ? "Investigation unavailable."
                  : "Unknown investigation status."}
                {incident.reasoning && ` ${incident.reasoning}`}
              </p>
            )}
            <p className="eyebrow">
              Notifications: {feed.alertCount} alerts · {feed.recoveryCount}{" "}
              recovery
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
