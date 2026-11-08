import type { Snapshot } from '../data/contracts';

/** Cards rendered in the resident grid; the count tile always shows the full total. */
const MAX_CARDS = 200;

/**
 * Derives a display status, prioritizing warning records over flagged messages.
 * A warning record does not imply delivery or protection.
 */
function getResidentStatus(residentId: string, data: Snapshot) {
  const hasWarning = data.warnings.some(
    (warning) => warning.recipientId === residentId,
  );
  if (hasWarning) return { color: 'bg-amber-500', label: 'Warning created' };

  const messages = data.messages.filter(
    (message) => message.recipientId === residentId,
  );

  const hasFlaggedMessage = messages.some((message) =>
    data.campaigns.some(
      (campaign) =>
        campaign.clusterId === message.detectedClusterId &&
        campaign.detectionStatus === 'flagged',
    ),
  );
  if (hasFlaggedMessage) {
    return {
      color: 'bg-red-600',
      label: 'Flagged message received; no warning yet',
    };
  }

  return {
    color: 'bg-slate-400',
    label:
      messages.length > 0
        ? 'Message received; not flagged'
        : 'No campaign messages',
  };
}

/** Displays snapshot counts, resident statuses, and campaign assessments. */
export function CommandCenter({ data }: { data: Snapshot }) {
  return (
    <>
      <section
        className="grid gap-3 sm:grid-cols-3"
        aria-label="Fixture counts"
      >
        {[
          ['Residents', data.residents.length],
          ['Messages in fixture', data.messages.length],
          ['Warnings created', data.warnings.length],
        ].map(([label, value]) => (
          <div className="panel" key={label}>
            <p className="muted">{label}</p>
            <p className="text-3xl font-bold">{value}</p>
          </div>
        ))}
      </section>
      

      <section className="panel">
        <h2>Avon residents</h2>
        <p className="muted mb-4">
          Schematic resident grid; not geographic locations. Warning records do
          not establish delivery or protection.
        </p>
        {data.residents.length > MAX_CARDS && (
          <p className="muted mb-2">
            Showing {MAX_CARDS} of {data.residents.length} residents.
          </p>
        )}
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.residents.slice(0, MAX_CARDS).map((person) => {
            const status = getResidentStatus(person.id, data);
            return (
              <li
                key={person.id}
                className="rounded border border-slate-200 p-3"
              >
                <span
                  aria-hidden="true"
                  className={`mr-2 inline-block h-3 w-3 rounded-full ${status.color}`}
                />
                <strong>{person.displayName}</strong>
                <p className="muted">
                  {person.persona} · {status.label}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="muted mt-4">
          Gray: no flagged message · Red: flagged message received · Orange:
          warning created, delivery unverified. Green protection status requires
          interaction and delivery evidence and is not shown.
        </p>
      </section>


      <section className="panel">
        <h2>Campaign detection</h2>
        {data.campaigns.length === 0 && <p>No campaigns loaded.</p>}
        {data.campaigns.map((campaign) => (
          <article key={campaign.clusterId} className="space-y-2">
            <h3>{campaign.label}</h3>
            <p className="muted">Cluster: {campaign.clusterId}</p>
            <p>
              Detection:{' '}
              <strong>
                {campaign.detectionStatus === 'flagged'
                  ? 'Flagged — preliminary suspicion'
                  : 'Monitoring — not flagged'}
              </strong>
            </p>
            <p>
              Investigation: {campaign.investigationStatus.replaceAll('_', ' ')}
              . Nemotron is not integrated.
            </p>
            <p className="muted">
              Fixture status is preassigned, not a detection result or a
              benign-traffic evaluation.
            </p>
          </article>
        ))}
      </section>
    </>
  );
}
