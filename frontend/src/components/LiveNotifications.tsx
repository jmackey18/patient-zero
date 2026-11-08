import type { LiveNotification, Snapshot } from "../data/contracts";
import { useLiveFeed } from "../data/useLiveFeed";

/** Displays the latest read-only alert/recovery records from the live feed. */
export function LiveNotifications({ data }: { data: Snapshot }) {
  const feed = useLiveFeed(data);
  // The adapter supplies oldest-first records. Keep the newest of each kind.
  const latest = new Map<LiveNotification["kind"], LiveNotification>();
  for (let i = feed.notifications.length - 1; i >= 0; i--) {
    const notification = feed.notifications[i];
    if (!latest.has(notification.kind))
      latest.set(notification.kind, notification);
    if (latest.size === 2) break;
  }
  const notifications = [...latest.values()];
  const residents = new Map(
    data.residents.map((resident) => [resident.id, resident.displayName]),
  );
  return (
    <div className="min-w-0 space-y-3">
      <h3>Live notifications</h3>
      {!feed.available ? (
        <p className="muted">
          Notification feed unavailable until the live subscription syncs.
        </p>
      ) : notifications.length === 0 ? (
        <p className="muted">No notifications reported yet.</p>
      ) : (
        <>
          <p className="muted">Latest notification of each type.</p>
          <ul className="space-y-3">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className={`space-y-3 rounded-xl border border-l-4 p-4 text-sm [overflow-wrap:anywhere] ${
                  notification.kind === "recovery"
                    ? "border-red-400/50 bg-red-950/70 text-red-50"
                    : "border-warning/40 bg-warning/10 text-foreground"
                }`}
              >
                <h4
                  className={`font-semibold ${notification.kind === "recovery" ? "text-red-200" : "text-warning"}`}
                >
                  {notification.kind === "recovery"
                    ? "Recovery guidance"
                    : "Preemptive alert"}
                </h4>
                <p
                  className={`font-mono text-xs ${notification.kind === "recovery" ? "text-red-200/80" : "text-muted"}`}
                >
                  Resident{" "}
                  {residents.get(notification.recipientId) ??
                    notification.recipientId}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">
                  {notification.text}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
