import type { Scenario } from '../data/contracts';

interface AttackerConsoleProps {
  scenario: Scenario;
  setScenario: (scenario: Scenario) => void;
  busy: boolean;
  onLoadScenario: () => void;
  onReset: () => void;
}

/** Presents mock scenario controls and delegates loading and reset actions to the app. */
export function AttackerConsole({
  scenario,
  setScenario,
  busy,
  onLoadScenario,
  onReset,
}: AttackerConsoleProps) {
  return (
    <section className="panel space-y-4">
      <h2>Attacker Simulation Console</h2>
      <p>
        Load a static synthetic scenario to preview the other views. These
        controls do not generate, send, or detect messages.
      </p>
      <label className="block">
        Mock scenario
        <select
          className="ml-3"
          value={scenario}
          onChange={(event) => setScenario(event.target.value as Scenario)}
        >
          <option value="suspicious">Suspicious delivery campaign</option>
          <option value="benign">Benign community newsletter</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={onLoadScenario}>
          Load mock scenario
        </button>
        <button disabled={busy} onClick={onReset}>
          Reset mock session
        </button>
      </div>
      <p className="muted">
        Live start, speed controls, and scheduling depend on Person 1’s
        simulator and Person 3’s authorized reducers.
      </p>
    </section>
  );
}
