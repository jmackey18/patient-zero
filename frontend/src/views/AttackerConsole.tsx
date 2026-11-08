import type { Campaign, Scenario } from "../data/contracts";

interface AttackerConsoleProps {
  campaigns: Campaign[];
  scenario: Scenario;
  setScenario: (scenario: Scenario) => void;
  busy: boolean;
  onLoadScenario: () => void;
  onReset: () => void;
}

/** Presents mock scenario controls and delegates loading and reset actions to the app. */
export function AttackerConsole({
  campaigns,
  scenario,
  setScenario,
  busy,
  onLoadScenario,
  onReset,
}: AttackerConsoleProps) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.3fr]">
      <section className="panel space-y-5">
        <h2 className="text-danger">Load synthetic scenario</h2>
        <p className="muted">
          Preview suspicious or benign traffic in the other views. These
          controls load static fixtures; they do not generate, send, or detect
          messages.
        </p>
        <label className="block">
          <span className="eyebrow">Mock scenario</span>
          <select
            className="mt-2"
            value={scenario}
            onChange={(event) => setScenario(event.target.value as Scenario)}
          >
            <option value="suspicious">Suspicious delivery campaign</option>
            <option value="benign">Benign community newsletter</option>
          </select>
        </label>
        <div className="space-y-3">
          <button
            className="danger-button w-full"
            disabled={busy}
            onClick={onLoadScenario}
          >
            Load mock scenario
          </button>
          <button className="w-full" disabled={busy} onClick={onReset}>
            Reset mock session
          </button>
        </div>
        <p className="muted">
          Loading replaces the current scenario and acknowledgments. Reset
          clears campaigns, messages, and warnings while retaining residents.
        </p>
      </section>
      <section className="panel">
        <h2>Campaign roster · current fixture</h2>
        {campaigns.length === 0 && (
          <p className="muted">
            No campaigns loaded. Select a scenario to get started.
          </p>
        )}
        <ul className="divide-y divide-border">
          {campaigns.map((campaign) => (
            <li
              key={campaign.clusterId}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div>
                <h3>{campaign.label}</h3>
                <p className="eyebrow mt-2">{campaign.clusterId}</p>
              </div>
              <span className="badge">
                {campaign.detectionStatus === "flagged"
                  ? "Preliminary suspicion"
                  : "Monitoring"}
              </span>
            </li>
          ))}
        </ul>
        <p className="muted mt-6 border-t border-border pt-4">
          Live start, speed controls, and scheduling depend on Person 1’s
          simulator and Person 3’s authorized reducers. No real messages are
          sent.
        </p>
      </section>
    </div>
  );
}
