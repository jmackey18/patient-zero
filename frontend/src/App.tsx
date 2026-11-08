import { MockSimulationControls } from "./components/MockSimulationControls";
import { SimulatePanel } from "./components/live/SimulatePanel";
import { CommandCenter } from "./views/CommandCenter";
import { useState, useSyncExternalStore } from "react";
import { dataAdapter } from "./data";
import type { DataAdapter, Scenario } from "./data/contracts";

/** Connects adapter updates to the dashboard. */
export function App({ adapter = dataAdapter }: { adapter?: DataAdapter }) {
  const data = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot);
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
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6">
          <span className="text-xl font-bold tracking-tight">
            Patient<span className="text-primary">Zero</span>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <h1>Command Center</h1>
        {adapter.mode === "mock" && (
          <aside className="rounded-lg border border-warning/25 bg-warning/5 px-4 py-3 text-xs leading-relaxed text-muted">
            <strong className="text-warning">Local demo.</strong> Residents,
            messages, detection flags, and warnings are scripted fixtures. Timed
            propagation runs only in this browser. No detector, SpacetimeDB
            connection, or Nemotron is running. Changes reset on reload and do
            not sync across browsers.
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

        <CommandCenter
          data={data}
          controls={
            <>
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
            </>
          }
        />
      </main>
    </div>
  );
}
