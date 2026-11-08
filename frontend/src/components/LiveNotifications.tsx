import type { Snapshot } from "../data/contracts";
import { useLiveFeed } from "../data/useLiveFeed";

/** Displays the latest read-only alert/recovery records from the live feed. */
export function LiveNotifications({ data }: { data: Snapshot }) {
  const feed = useLiveFeed(data);
  const notifications = feed.notifications;
  const residents = new Map(
    data.residents.map((resident) => [resident.id, resident.displayName]),
  );
  const limit = 100;
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
          <p className="muted">
            {notifications.length.toLocaleString()} notification records.
            Showing the latest {Math.min(limit, notifications.length)}.
          </p>
          <ul className="space-y-3">
            {notifications
              .slice(-limit)
              .reverse()
              .map((notification) => (
                <li
                  key={notification.id}
                  className="warning-card space-y-2 break-words text-sm"
                >
                  <h4 className="font-medium text-warning">
                    {notification.kind === "recovery"
                      ? "Recovery guidance"
                      : "Preemptive alert"}
                  </h4>
                  <p className="text-muted">
                    Resident{" "}
                    {residents.get(notification.recipientId) ??
                      notification.recipientId}
                  </p>
                  <p className="whitespace-pre-wrap">{notification.text}</p>
                </li>
              ))}
          </ul>
        </>
      )}
      <p className="muted">
        Records do not confirm delivery or avoided harm. Live acknowledgment is
        not supported yet.
      </p>
    </div>
  );
}
