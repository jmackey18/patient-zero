import type { Scenario, Snapshot } from "../data/contracts";
import {
  MOCK_TICK_MS,
  MOCK_DETECTION_TICK,
  MOCK_INVESTIGATION_START_TICK,
  MOCK_INVESTIGATION_END_TICK,
} from "../data/mockSimulation";

interface Props {
  data: Snapshot;
  scenario: Scenario;
  setScenario: (scenario: Scenario) => void;
  busy: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}

/** Controls and progress stay available beside the graph; scripted phases are explicit. */
export function MockSimulationControls({
  data,
  scenario,
  setScenario,
  busy,
  onStart,
  onPause,
  onResume,
  onReset,
}: Props) {
  const state = data.mockSimulation;
  const running = state?.status === "running";
  const flagged = data.campaigns.some(
    (campaign) => campaign.detectionStatus === "flagged",
  );
  return (
    <section className="panel space-y-4" aria-label="Timed mock simulation">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2>Timed mock spread · 5,000 residents</h2>
        <span className="badge">{state?.status ?? "ready"}</span>
      </div>
      <p className="muted">
        A fictional message enters at one node and spreads through the synthetic
        network. Suspicious traffic is scripted to be flagged at{" "}
        {(MOCK_DETECTION_TICK * MOCK_TICK_MS) / 1000} seconds. Blue rings mark
        recipients associated with the campaign during its scripted
        investigation ({(MOCK_INVESTIGATION_START_TICK * MOCK_TICK_MS) / 1000}–
        {(MOCK_INVESTIGATION_END_TICK * MOCK_TICK_MS) / 1000} simulated
        seconds). Warning records follow detection. Enable Show warning rings in
        the graph to overlay them. This is a UI demonstration, not the real
        detector or Nemotron.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-0 text-sm">
          Timed scenario
          <select
            className="mt-2"
            value={scenario}
            disabled={busy || running || state?.status === "paused"}
            onChange={(event) => setScenario(event.target.value as Scenario)}
          >
            <option value="suspicious">Suspicious parcel campaign</option>
            <option value="benign">Benign community newsletter</option>
          </select>
        </label>
        <button disabled={busy || running} onClick={onStart}>
          Start 5,000-resident simulation
        </button>
        <button disabled={busy || !running} onClick={onPause}>
          Pause
        </button>
        <button
          disabled={busy || state?.status !== "paused"}
          onClick={onResume}
        >
          Resume
        </button>
        <button disabled={busy || !state} onClick={onReset}>
          Reset timed simulation
        </button>
      </div>
      {state && (
        <div className="space-y-2 text-sm">
          <p>
            {state.scenario === "suspicious"
              ? "Suspicious campaign"
              : "Benign newsletter"}{" "}
            · Simulated time: {((state.tick * state.tickMs) / 1000).toFixed(1)}s
            · {data.messages.length.toLocaleString()} /{" "}
            {data.residents.length.toLocaleString()} recipients
          </p>
          <progress
            className="w-full accent-emerald-400"
            aria-label="Mock residents reached"
            max={data.residents.length}
            value={data.messages.length}
          />
          <p>
            Scripted detection: {flagged ? "flagged" : "not flagged"} · Warnings
            created: {data.warnings.length.toLocaleString()} · Seed:{" "}
            {state.seedResidentId}
          </p>
          <p>
            Scripted campaign investigation:{" "}
            {data.campaigns[0]?.investigationStatus === "pending"
              ? "in progress — blue rings visible"
              : (
                  data.campaigns[0]?.investigationStatus ?? "not_requested"
                ).replaceAll("_", " ")}
            . Completion does not clear exposure or stop the spread.
          </p>
          {state.status === "complete" && (
            <p>
              Demo complete: every resident was reached. This is not containment
              or an investigator stopping the campaign.
            </p>
          )}
        </div>
      )}
      <p className="muted">
        Start replaces the current fixture. Pause preserves state; reset stops
        the clock and clears activity while keeping 5,000 residents. The demo
        ends after all residents are reached and any scripted warnings are
        created. It does not call the live backend or Nemotron.
      </p>
    </section>
  );
}
