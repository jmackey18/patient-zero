import { CampusMap } from "../components/campus/CampusMap";
import type { Snapshot } from "../data/contracts";
import { LiveNotifications } from "../components/LiveNotifications";
import { useLiveFeed } from "../data/useLiveFeed";

/** Displays counts and records from the active adapter, keeping live flags separate from mock fixtures. */
export function CommandCenter({
  data,
  selectedId,
  onSelect,
}: {
  data: Snapshot;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const live = !!data.connection;
  const feed = useLiveFeed(data);
  const acknowledged = data.warnings.filter(
    (warning) => warning.acknowledged,
  ).length;
  const stats = live
    ? [
        { label: "Residents · synthetic", value: data.residents.length },
        {
          label: "Exposed · backend state",
          value: feed.available
            ? data.residents.filter((resident) => resident.liveState?.exposed)
                .length
            : "—",
        },
        {
          label: "Warned · backend state",
          value: feed.available
            ? data.residents.filter((resident) => resident.liveState?.warned)
                .length
            : "—",
          note: "May overlap with exposed residents",
        },
        {
          label: "Notification records",
          value: feed.available ? feed.notifications.length : "—",
          note: feed.available
            ? `${feed.alertCount} alerts · ${feed.recoveryCount} recovery`
            : "Waiting for live feed",
        },
      ]
    : [
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
        aria-label={live ? "Live simulation counts" : "Fixture counts"}
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
      <CampusMap data={data} selectedId={selectedId} onSelect={onSelect} />
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
        </>
      )}
    </div>
  );
}
