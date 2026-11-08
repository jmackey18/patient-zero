import { MockSimulationControls } from "./components/MockSimulationControls";
import { SimulatePanel } from "./components/live/SimulatePanel";
import { CommandCenter } from "./views/CommandCenter";
import { useState, useSyncExternalStore } from "react";
import { dataAdapter } from "./data";
import type { ConnectionStatus, DataAdapter, Scenario } from "./data/contracts";

/** Human-readable live connection state for the banner. */
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

/** Connects adapter updates to the dashboard and keeps the selected resident in sync. */
export function App({ adapter = dataAdapter }: { adapter?: DataAdapter }) {
  const data = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot);
  const [residentId, setResidentId] = useState("r1");
  const [scenario, setScenario] = useState<Scenario>("suspicious");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  /** Runs an adapter action with shared busy, success, and error feedback for the UI. */
  async function perform(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to update data. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6">
          <span className="text-xl font-bold tracking-tight">
            Patient<span className="text-primary">Zero</span>
          </span>
          <span className="eyebrow ml-auto">UT Dallas</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">Operations</p>
            <h1>Command Center</h1>
          </div>
          <span className="badge border-dashed">
            {adapter.mode === "mock"
              ? "Synthetic mock data"
              : `SpacetimeDB · ${connectionLabel(data.connection?.state)}`}
          </span>
        </div>
        {adapter.mode === "mock" && (
          <aside className="rounded-lg border border-warning/25 bg-warning/5 px-4 py-3 text-xs leading-relaxed text-muted">
            <strong className="text-warning">Local demo.</strong> Residents,
            messages, detection flags, and warnings are scripted fixtures. Timed
            propagation runs only in this browser. No detector, SpacetimeDB
            connection, or Nemotron is running. Changes reset on reload and do
            not sync across browsers.
          </aside>
        )}
        {adapter.mode === "live" && (
          <aside className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-muted">
            Resident states, notifications, and Nemotron investigation reports
            stream from SpacetimeDB. Message contents are not subscribed. Use
            Simulate to launch a synthetic attack through the live pipeline or
            reset the simulation. Warning acknowledgment is not available in
            live mode yet.
          </aside>
        )}
        {(data.connection?.state === "error" ||
          data.connection?.state === "reconnecting") && (
          <p
            role="alert"
            className="rounded border border-danger/50 bg-danger/10 p-3 text-danger"
          >
            {data.connection.message ?? "Connection problem."}
            {data.liveFeed &&
              " Displayed records are the last synchronized snapshot and may be stale."}
            {data.connection.state === "reconnecting" && " Retrying…"}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded border border-danger/50 bg-danger/10 p-3 text-danger"
          >
            {error}
          </p>
        )}
        <p role="status" className="text-sm text-primary empty:hidden">
          {notice}
        </p>

        {adapter.mode === "mock" && adapter.startMockSimulation && (
          <MockSimulationControls
            data={data}
            scenario={scenario}
            setScenario={setScenario}
            busy={busy}
            onStart={() =>
              void perform(
                () => adapter.startMockSimulation!(scenario),
                "Timed mock simulation started.",
              )
            }
            onPause={() =>
              void perform(
                () => adapter.pauseMockSimulation!(),
                "Mock simulation paused.",
              )
            }
            onResume={() =>
              void perform(
                () => adapter.resumeMockSimulation!(),
                "Mock simulation resumed.",
              )
            }
            onReset={() =>
              void perform(
                () => adapter.reset(),
                "Timed mock simulation reset; residents retained.",
              )
            }
          />
        )}
        {adapter.mode === "live" && adapter.requestSimulation && (
          <SimulatePanel
            data={data}
            onSimulate={(id) => adapter.requestSimulation!(id)}
            onReset={() => adapter.reset()}
          />
        )}
        <CommandCenter
          data={data}
          selectedId={residentId}
          onSelect={setResidentId}
        />
      </main>
    </div>
  );
}
