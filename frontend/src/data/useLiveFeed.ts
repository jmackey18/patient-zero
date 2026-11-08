import type { LiveFeed, Snapshot } from "./contracts";

const EMPTY: LiveFeed = {
  scenarios: [],
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
 *
 * In mock mode (no SpacetimeDB) everything is empty, so components can render unconditionally.
 */
export function useLiveFeed(data: Snapshot) {
  const feed = data.liveFeed ?? EMPTY;
  return {
    ...feed,
    available: !!data.liveFeed,
  };
}
