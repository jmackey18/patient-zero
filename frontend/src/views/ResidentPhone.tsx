import type { Snapshot } from "../data/contracts";

interface ResidentPhoneProps {
  data: Snapshot;
  residentId: string;
  setResidentId: (id: string) => void;
  busy: boolean;
  onAcknowledge: (warningId: string) => void;
}

/** Displays the selected demo resident’s inbox and warnings, forwarding acknowledgments to the app. */
export function ResidentPhone({
  data,
  residentId,
  setResidentId,
  busy,
  onAcknowledge,
}: ResidentPhoneProps) {
  const resident =
    data.residents.find((item) => item.id === residentId) ?? data.residents[0];
  const messages = data.messages.filter(
    (message) => message.recipientId === resident?.id,
  );

  const warnings = data.warnings.filter(
    (warning) => warning.recipientId === resident?.id,
  );

  return (
    <section className="grid items-start gap-8 lg:grid-cols-[1fr_auto]">
      <div className="max-w-md space-y-5">
        <p className="eyebrow">A resident’s view of Avon</p>
        <h2 className="font-sans text-2xl normal-case tracking-tight text-foreground">
          A warning before the next tap.
        </h2>
        <p className="muted">
          Explore a synthetic inbox and its preliminary warnings. Acknowledging
          a warning updates the shared local demo state; it does not establish
          that the resident avoided a scam.
        </p>
        <label className="block">
          Demo resident
          <select
            className="mt-1 block w-full"
            value={resident?.id ?? ""}
            onChange={(event) => setResidentId(event.target.value)}
            disabled={!resident}
          >
            {data.residents.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName} — {person.persona}
              </option>
            ))}
          </select>
        </label>
        {!resident && <p>No residents available.</p>}
      </div>
      <div className="phone">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <span className="eyebrow">
            {resident?.displayName ?? "No resident"}
          </span>
          <span className="eyebrow">SIM · demo</span>
        </div>
        <div className="space-y-3">
          <h3 className="eyebrow">Warnings</h3>
          {warnings.length === 0 && (
            <p className="muted">No warnings for this resident.</p>
          )}
          {warnings.map((warning) => (
            <article
              key={warning.id}
              className="warning-card space-y-3 text-sm"
            >
              <h3 className="text-warning">
                {warning.severity === "preliminary"
                  ? "Preliminary warning"
                  : "Elevated warning"}
              </h3>
              <p>{warning.warningText}</p>
              <p className="muted">Cluster: {warning.clusterId}</p>
              <button
                className="w-full border-warning/40 bg-transparent text-xs text-warning"
                disabled={busy || warning.acknowledged}
                onClick={() => onAcknowledge(warning.id)}
              >
                {warning.acknowledged ? "Acknowledged" : "Acknowledge warning"}
              </button>
            </article>
          ))}
        </div>
        <div className="space-y-3">
          <h3 className="eyebrow">Synthetic inbox</h3>
          {messages.length === 0 && (
            <p className="muted">No messages for this resident.</p>
          )}
          {messages.map((message) => (
            <article
              key={message.id}
              className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm"
            >
              <h3 className="font-mono text-[11px] text-muted">
                {message.senderLabel}
              </h3>
              <p>{message.syntheticText}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
