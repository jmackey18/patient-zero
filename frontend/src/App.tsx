import { MockSimulationControls } from "./components/MockSimulationControls";
import { SimulatePanel } from "./components/live/SimulatePanel";
import { CommandCenter } from "./views/CommandCenter";
import { ResidentPhone } from "./views/ResidentPhone";
import { AttackerConsole } from "./views/AttackerConsole";
import { useState, useSyncExternalStore } from "react";
import { dataAdapter } from "./data";
import type { ConnectionStatus, DataAdapter, Scenario } from "./data/contracts";

const views = ["Command Center", "Resident Phone", "Attacker Console"] as const;
/** Human-readable live connection state for the banner. */
function connectionLabel(state?: ConnectionStatus["state"]) {
  switch (state) {
    case "connecting":
      return "Connecting…";
    case "syncing":
      return "Syncing residents…";
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

type View = (typeof views)[number];

/** Connects adapter updates to the views and preserves selections across navigation. */
export function App({ adapter = dataAdapter }: { adapter?: DataAdapter }) {
  const data = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot);
  const [view, setView] = useState<View>("Command Center");
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
          <nav aria-label="Main views" className="flex flex-wrap gap-5">
            {views.map((item) => (
              <button
                key={item}
                aria-current={view === item ? "page" : undefined}
                className="nav-button"
                onClick={() => setView(item)}
              >
                {item}
              </button>
            ))}
          </nav>
          <span className="eyebrow ml-auto">Avon · synthetic simulation</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">
              {view === "Command Center"
                ? "Operations"
                : view === "Resident Phone"
                  ? "Resident view"
                  : "Red team · simulation only"}
            </p>
            <h1>{view}</h1>
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
            Residents, notifications, and Nemotron incidents stream live from
            SpacetimeDB. Use Simulate to launch a real attack through the
            pipeline. The mock campaign, message, and warning panels below stay
            empty in live mode.
          </aside>
        )}
        {(data.connection?.state === "error" ||
          data.connection?.state === "reconnecting") && (
          <p
            role="alert"
            className="rounded border border-danger/50 bg-danger/10 p-3 text-danger"
          >
            {data.connection.message ?? "Connection problem."}
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

        {adapter.mode === "mock" &&
          adapter.startMockSimulation &&
          view !== "Resident Phone" && (
            <MockSimulationControls
              data={data}
              scenario={scenario}
              setScenario={setScenario}
              busy={busy}
              onStart={() =>
                void perform(async () => {
                  await adapter.startMockSimulation!(scenario);
                  setView("Command Center");
                }, "Timed mock simulation started.")
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
        {adapter.mode === "live" &&
          adapter.requestSimulation &&
          view === "Command Center" && (
            <SimulatePanel
              data={data}
              onSimulate={(id) => adapter.requestSimulation!(id)}
              onReset={() => adapter.reset()}
            />
          )}
        {view === "Command Center" && (
          <CommandCenter
            data={data}
            selectedId={residentId}
            onSelect={setResidentId}
            onOpenPhone={(id) => {
              setResidentId(id);
              setView("Resident Phone");
            }}
          />
        )}
        {view === "Resident Phone" && (
          <ResidentPhone
            data={data}
            residentId={residentId}
            setResidentId={setResidentId}
            busy={busy}
            onAcknowledge={(warningId) =>
              void perform(
                () => adapter.acknowledgeWarning(warningId),
                "Warning acknowledged in this local mock session.",
              )
            }
          />
        )}
        {view === "Attacker Console" && (
          <AttackerConsole
            campaigns={data.campaigns}
            scenario={scenario}
            setScenario={setScenario}
            busy={busy}
            onLoadScenario={() =>
              void perform(
                () => adapter.loadScenario(scenario),
                "Mock scenario loaded. Open Command Center or Resident Phone to inspect it.",
              )
            }
            onReset={() =>
              void perform(
                () => adapter.reset(),
                "Local mock session reset; residents retained.",
              )
            }
          />
        )}
      </main>
    </div>
  );
}
