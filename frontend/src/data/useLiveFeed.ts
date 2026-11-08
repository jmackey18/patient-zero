import type { LiveFeed, LiveNotification, Snapshot } from "./contracts";

const EMPTY: LiveFeed = {
  scenarios: [],
  logs: [],
  notifications: [],
  alertCount: 0,
  recoveryCount: 0,
  incidents: [],
};

/**
 * Notification + Nemotron feed for components. Pass the snapshot App already has:
 *
 *   const feed = useLiveFeed(data);
 *   feed.latestIncident?.status        // "investigating" | "complete" | "failed"
 *   feed.latestIncident?.confidence    // 0-100
 *   feed.latestIncident?.reasoning     // Nemotron's explanation
 *   feed.alertCount, feed.recoveryCount
 *   feed.notificationsFor("123")       // one resident's alerts/recovery steps
 *
 * In mock mode (no SpacetimeDB) everything is empty, so components can render unconditionally.
 */
export function useLiveFeed(data: Snapshot) {
  const feed = data.liveFeed ?? EMPTY;
  return {
    ...feed,
    available: !!data.liveFeed,
    notificationsFor(residentId: string): LiveNotification[] {
      return feed.notifications.filter((n) => n.recipientId === residentId);
    },
  };
}
