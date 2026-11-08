import type { Snapshot } from "../data/contracts";

/**
 * Derives a display status, prioritizing warning records over flagged messages.
 * A warning record does not imply delivery or protection.
 */
function getResidentStatus(residentId: string, data: Snapshot) {
  const hasWarning = data.warnings.some(
    (warning) => warning.recipientId === residentId,
  );
  if (hasWarning) return { color: "bg-amber-500", label: "Warning created" };

  const messages = data.messages.filter(
    (message) => message.recipientId === residentId,
  );

  const hasFlaggedMessage = messages.some((message) =>
    data.campaigns.some(
      (campaign) =>
        campaign.clusterId === message.detectedClusterId &&
        campaign.detectionStatus === "flagged",
    ),
  );
  if (hasFlaggedMessage) {
    return {
      color: "bg-red-600",
      label: "Flagged message received; no warning yet",
    };
  }

  return {
    color: "bg-slate-400",
    label:
      messages.length > 0
        ? "Message received; not flagged"
        : "No campaign messages",
  };
}

/** Displays fixture-derived counts, resident statuses, campaigns, and the warning log. */
export function CommandCenter({ data }: { data: Snapshot }) {
  const acknowledged = data.warnings.filter(
    (warning) => warning.acknowledged,
  ).length;
  const stats = [
    { label: "Residents · synthetic", value: data.residents.length },
    { label: "Campaign clusters", value: data.campaigns.length },
    { label: "Messages in fixture", value: data.messages.length },
    {
      label: "Warnings created",
      value: data.warnings.length,
      note: `${acknowledged} acknowledged`,
    },
  ];

  return (
    <div className="space-y-6">
      <section
        aria-label="Fixture counts"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat) => (
          <div key={stat.label} className="panel">
            <p className="eyebrow">{stat.label}</p>
            <p className="mt-2 text-4xl font-medium">{stat.value}</p>
            {stat.note && (
              <p className="mt-2 font-mono text-xs text-muted">{stat.note}</p>
            )}
          </div>
        ))}
      </section>
      <p className="muted">
        Warning records do not establish delivery, avoided interaction, or
        protection.
      </p>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel">
          <h2>Avon resident grid</h2>
          <p className="muted mb-4">
            Synthetic residents in a schematic grid, not geographic locations.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.residents.map((person) => {
              const status = getResidentStatus(person.id, data);
              return (
                <li
                  key={person.id}
                  className="rounded-lg border border-border bg-background/40 p-4"
                >
                  <p className="eyebrow mb-3">
                    {person.id} · {person.persona}
                  </p>
                  <h3>{person.displayName}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    <span
                      aria-hidden="true"
                      className={`mr-2 inline-block h-2 w-2 rounded-full ${status.color}`}
                    />
                    {status.label}
                  </p>
                </li>
              );
            })}
          </ul>
          {data.residents.length === 0 && (
            <p className="muted">No residents available.</p>
          )}
          <p className="mt-4 font-mono text-[10px] leading-relaxed text-muted">
            GRAY · no flagged message / RED · flagged message received / ORANGE
            · warning created, delivery unverified
          </p>
        </section>
        <section className="panel">
          <h2>Campaign detection</h2>
          {data.campaigns.length === 0 && (
            <p className="muted">No campaigns loaded.</p>
          )}
          <div className="space-y-3">
            {data.campaigns.map((campaign) => (
              <article
                key={campaign.clusterId}
                className="space-y-3 rounded-lg border border-border bg-background/40 p-4"
              >
                <h3>{campaign.label}</h3>
                <span
                  className={`badge ${campaign.detectionStatus === "monitoring" ? "border-border text-muted" : ""}`}
                >
                  {campaign.detectionStatus === "flagged"
                    ? "Flagged · preliminary"
                    : "Monitoring · not flagged"}
                </span>
                <p className="eyebrow">{campaign.clusterId}</p>
                <p className="muted">
                  Investigation:{" "}
                  {campaign.investigationStatus.replaceAll("_", " ")}. Nemotron
                  is not integrated.
                </p>
              </article>
            ))}
          </div>
          <p className="muted mt-4">
            Statuses are preassigned fixtures, not detector output or a
            benign-traffic evaluation.
          </p>
        </section>
      </div>
      <section className="panel">
        <h2>Warning log</h2>
        {data.warnings.length === 0 ? (
          <p className="muted">No warnings created.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Created warning records and acknowledgment status
              </caption>
              <thead>
                <tr>
                  {["Warning", "Resident", "Cluster", "Severity", "Status"].map(
                    (heading) => (
                      <th key={heading} scope="col">
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {data.warnings.map((warning) => (
                  <tr key={warning.id} className="border-t border-border">
                    <td>{warning.id}</td>
                    <td>
                      {data.residents.find(
                        (resident) => resident.id === warning.recipientId,
                      )?.displayName ?? warning.recipientId}
                    </td>
                    <td>{warning.clusterId}</td>
                    <td className="text-warning">{warning.severity}</td>
                    <td
                      className={
                        warning.acknowledged ? "text-primary" : "text-muted"
                      }
                    >
                      {warning.acknowledged
                        ? "Acknowledged"
                        : "Created · not acknowledged"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
