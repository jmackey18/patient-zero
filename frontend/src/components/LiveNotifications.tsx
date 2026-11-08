import { useEffect, useState } from "react";
import type { LiveNotification, Snapshot } from "../data/contracts";
import { useLiveFeed } from "../data/useLiveFeed";
import { PhoneFrame } from "./PhoneFrame";

type NotificationKind = LiveNotification["kind"];
const LABELS: Record<NotificationKind, string> = {
  alert: "Preemptive alert",
  recovery: "Recovery guidance",
};

/** Local lock-screen time; it is not a notification timestamp or a delivery claim. */
function LockScreenClock({ now }: { now: Date }) {
  return (
    <div className="notification-phone__clock" aria-hidden="true">
      <p>
        {now.toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        })}
      </p>
      <p>
        {now.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}

function NotificationPhone({
  kind,
  latest,
  count,
  residentName,
  now,
}: {
  kind: NotificationKind;
  latest?: LiveNotification;
  count: number;
  residentName?: string;
  now: Date;
}) {
  const awake = !!latest;
  const label = LABELS[kind];
  return (
    <section
      role="region"
      className="notification-device"
      aria-label={`${label} phone`}
      data-state={awake ? "awake" : "asleep"}
    >
      <div className="notification-device__heading">
        <h4>{label}</h4>
        <span
          className={`notification-device__indicator ${awake ? "is-awake" : ""}`}
        >
          {awake ? "Active" : "Standby"}
        </span>
      </div>
      <PhoneFrame
        className={`notification-phone notification-phone--${kind} ${awake ? "notification-phone--awake" : "notification-phone--asleep"}`}
      >
        <svg
          className="notification-phone__lock"
          aria-hidden="true"
          width="18"
          height="22"
          viewBox="0 0 18 22"
          fill="none"
        >
          <rect
            x="3"
            y="10"
            width="12"
            height="10"
            rx="3"
            fill="currentColor"
          />
          <path
            d="M5 10V6a4 4 0 0 1 8 0v4"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
        {latest ? (
          <div className="notification-phone__awake-content">
            <LockScreenClock now={now} />
            <div
              className={`notification-stack ${count > 1 ? "notification-stack--multiple" : ""}`}
            >
              {count > 1 && (
                <div
                  className="notification-stack__back notification-stack__back--far"
                  aria-hidden="true"
                />
              )}
              {count > 1 && (
                <div className="notification-stack__back" aria-hidden="true" />
              )}
              <article className="notification-stack__card" key={latest.id}>
                <div className="resident-phone__app">
                  <span aria-hidden="true">PZ</span> PATIENT ZERO
                </div>
                <p className="notification-stack__title">{label}</p>
                <p className="notification-stack__recipient">
                  {residentName ?? `Resident ${latest.recipientId}`}
                </p>
                <p
                  className="notification-stack__description"
                  tabIndex={0}
                  aria-label="Notification description"
                >
                  {latest.text}
                </p>
              </article>
            </div>
            <p className="notification-phone__count">
              {count.toLocaleString()}{" "}
              {count === 1 ? "notification" : "notifications"}
              {count > 1 ? " · Latest shown" : ""}
            </p>
          </div>
        ) : (
          <div className="notification-phone__standby">
            <span
              className="notification-phone__standby-mark"
              aria-hidden="true"
            >
              PZ
            </span>
            <p>Awaiting notifications</p>
          </div>
        )}
      </PhoneFrame>
      <p className="sr-only" role="status" aria-atomic="true">
        {label}: {count.toLocaleString()} notification records.
      </p>
    </section>
  );
}

/** Keeps two independent lock screens: newest content plus counts, with bounded stack geometry. */
export function LiveNotifications({ data }: { data: Snapshot }) {
  const feed = useLiveFeed(data);
  // Both lock screens share one clock, even when their notifications arrive at different times.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const latest: Partial<Record<NotificationKind, LiveNotification>> = {};
  const counts: Record<NotificationKind, number> = { alert: 0, recovery: 0 };
  // Oldest-first adapter records; counts and displayed content share the same source.
  for (const notification of feed.notifications) {
    latest[notification.kind] = notification;
    counts[notification.kind]++;
  }
  const residents = new Map(
    data.residents.map((resident) => [resident.id, resident.displayName]),
  );
  return (
    <div className="live-notification-phones min-w-0 space-y-4">
      <h3>Live notifications</h3>
      {!feed.available && (
        <p className="muted">
          Notification feed unavailable until the live subscription syncs.
        </p>
      )}
      <div className="notification-device-grid">
        {(["alert", "recovery"] as const).map((kind) => (
          <NotificationPhone
            key={kind}
            kind={kind}
            now={now}
            latest={latest[kind]}
            count={counts[kind]}
            residentName={residents.get(latest[kind]?.recipientId ?? "")}
          />
        ))}
      </div>
    </div>
  );
}
