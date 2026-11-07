import type { Snapshot } from '../data/contracts';

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
  const resident = data.residents.find((item) => item.id === residentId) ?? data.residents[0];
  const messages = data.messages.filter(
    (message) => message.recipientId === resident?.id,
  );

  const warnings = data.warnings.filter(
    (warning) => warning.recipientId === resident?.id,
  );

  return (
    <section className="panel mx-auto max-w-md space-y-5">
      <h2>Resident Phone</h2>
      <label className="block">
        Demo resident
        <select
          className="mt-1 block w-full"
          value={resident?.id ?? ''}
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
      <div className="space-y-3">
        <h3>Warnings</h3>
        {warnings.length === 0 && (
          <p className="muted">No warnings for this resident.</p>
        )}
        {warnings.map((warning) => (
          <article
            key={warning.id}
            className="space-y-3 rounded border border-amber-300 bg-amber-50 p-3"
          >
            <h3>
              {warning.severity === 'preliminary'
                ? 'Preliminary warning'
                : 'Elevated warning'}
            </h3>
            <p>{warning.warningText}</p>
            <p className="muted">Cluster: {warning.clusterId}</p>
            <button
              disabled={busy || warning.acknowledged}
              onClick={() => onAcknowledge(warning.id)}
            >
              {warning.acknowledged ? 'Acknowledged' : 'Acknowledge warning'}
            </button>
          </article>
        ))}
      </div>
      <div className="space-y-3">
        <h3>Synthetic inbox</h3>
        {messages.length === 0 && (
          <p className="muted">No messages for this resident.</p>
        )}
        {messages.map((message) => (
          <article
            key={message.id}
            className="rounded border border-slate-200 p-3"
          >
            <h3>{message.senderLabel}</h3>
            <p>{message.syntheticText}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
