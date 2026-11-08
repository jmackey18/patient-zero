import type { ReactNode } from "react";
import { CampusMap } from "../components/campus/CampusMap";
import type { Snapshot } from "../data/contracts";
import { LiveNotifications } from "../components/LiveNotifications";

/** Displays the campus map and records from the active adapter. */
export function CommandCenter({
  data,
  controls,
}: {
  data: Snapshot;
  controls?: ReactNode;
}) {
  const live = !!data.connection;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div
        className="min-w-0 space-y-6"
        aria-label="Simulation and notifications"
      >
        {controls}
        {live ? (
          <section className="panel">
            <LiveNotifications data={data} />
          </section>
        ) : (
          <>
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
                      {campaign.investigationStatus.replaceAll("_", " ")}.
                      Nemotron is not integrated.
                    </p>
                  </article>
                ))}
              </div>
              <p className="muted mt-4">
                Statuses are preassigned fixtures, not detector output or a
                benign-traffic evaluation.
              </p>
            </section>
            <section className="panel">
              <h2>Warning log</h2>
              {data.warnings.length > 100 && (
                <p className="muted mb-3">
                  Showing the latest 100 of{" "}
                  {data.warnings.length.toLocaleString()} warnings. Select a
                  resident on the UTD campus map to inspect their status.
                </p>
              )}
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
                        {[
                          "Warning",
                          "Resident",
                          "Cluster",
                          "Severity",
                          "Status",
                        ].map((heading) => (
                          <th key={heading} scope="col">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="font-mono text-xs">
                      {data.warnings.slice(-100).map((warning) => (
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
                              warning.acknowledged
                                ? "text-primary"
                                : "text-muted"
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
          </>
        )}
      </div>
      <div className="min-w-0 lg:sticky lg:top-6">
        <CampusMap data={data} />
      </div>
    </div>
  );
}
