import { DbConnection } from '../module_bindings';
import type {
  ClusterMeta,
  ConnectionStatus,
  DataAdapter,
  LiveFeed,
  LiveIncident,
  LiveNotification,
  Resident,
  Snapshot,
} from './contracts';

// Tables not built in Spacetime yet: stable empty arrays keep snapshot references steady.
const NO_CAMPAIGNS: Snapshot['campaigns'] = [];
const NO_MESSAGES: Snapshot['messages'] = [];
const NO_WARNINGS: Snapshot['warnings'] = [];
const NOT_AVAILABLE = 'Not available yet in live mode.';

// Residents + the notification/incident feed. The `message` table (scam text) is not subscribed.
const QUERIES = [
  'SELECT * FROM resident',
  'SELECT * FROM resident_profile',
  'SELECT * FROM notification',
  'SELECT * FROM incident',
];

const EMPTY_FEED: LiveFeed = {
  notifications: [],
  alertCount: 0,
  recoveryCount: 0,
  incidents: [],
};

/** Spacetime Timestamp -> epoch milliseconds. */
function toMs(ts: { microsSinceUnixEpoch: bigint }) {
  return Number(ts.microsSinceUnixEpoch / 1000n);
}

function parseClusterMeta(json: string): ClusterMeta[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export interface SpacetimeAdapterOptions {
  uri?: string;
  db: string;
}

/** Live DataAdapter backed by SpacetimeDB subscriptions to resident + resident_profile. */
export function createSpacetimeAdapter({
  uri,
  db,
}: SpacetimeAdapterOptions): DataAdapter {
  const listeners = new Set<() => void>();
  let snapshot: Snapshot = {
    residents: [],
    campaigns: NO_CAMPAIGNS,
    messages: NO_MESSAGES,
    warnings: NO_WARNINGS,
    connection: { state: 'connecting' },
    liveFeed: EMPTY_FEED,
  };

  /** Replaces the cached snapshot, then notifies subscribers (same pattern as the mock). */
  const publish = (next: Snapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  const setConnection = (connection: ConnectionStatus) =>
    publish({ ...snapshot, connection });

  const adapter: DataAdapter = {
    mode: 'live',
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    acknowledgeWarning: () => Promise.reject(new Error(NOT_AVAILABLE)),
    loadScenario: () => Promise.reject(new Error(NOT_AVAILABLE)),
    reset: () => Promise.reject(new Error(NOT_AVAILABLE)),
  };

  if (!uri) {
    snapshot = {
      ...snapshot,
      connection: {
        state: 'error',
        message: 'VITE_SPACETIME_URI is not set (see frontend/.env.example).',
      },
    };
    return adapter;
  }

  let conn: DbConnection | null = null;
  let applied = false; // ignore per-row callbacks during the initial 10k-row sync
  let frame = 0;

  /** Joins resident + resident_profile from the client cache into view models. */
  function buildResidents(c: DbConnection): Resident[] {
    const profiles = new Map<number, ReturnType<typeof profileOf>>();
    for (const p of c.db.residentProfile.iter())
      profiles.set(p.residentId, profileOf(p));
    const residents: Resident[] = [];
    for (const r of c.db.resident.iter()) {
      const p = profiles.get(r.id);
      residents.push({
        id: String(r.id),
        persona: r.persona,
        isSimulated: true,
        displayName: p?.name ?? `Resident ${r.id}`,
        profile: p?.profile,
      });
    }
    residents.sort((a, b) => Number(a.id) - Number(b.id));
    return residents;
  }

  /** Builds the notification + Nemotron incident feed from the client cache. */
  function buildFeed(c: DbConnection): LiveFeed {
    const notifications: LiveNotification[] = [];
    let alertCount = 0;
    let recoveryCount = 0;
    const rows = [...c.db.notification.iter()].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );
    for (const n of rows) {
      const kind = n.kind === 'recovery' ? 'recovery' : 'alert';
      if (kind === 'recovery') recoveryCount++;
      else alertCount++;
      notifications.push({
        id: String(n.id),
        recipientId: String(n.recipientId),
        kind,
        text: n.text,
      });
    }
    const incidents: LiveIncident[] = [...c.db.incident.iter()]
      .map((i) => ({
        campaignId: i.campaignId,
        status: i.status as LiveIncident['status'],
        isCoordinated: i.isCoordinated,
        confidence: i.confidence,
        reasoning: i.reasoning,
        warningText: i.warningText,
        numVariants: i.numVariants,
        clusterMeta: parseClusterMeta(i.clusterMeta),
        createdAt: toMs(i.createdAt),
        updatedAt: toMs(i.updatedAt),
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
    return {
      notifications,
      alertCount,
      recoveryCount,
      incidents,
      latestIncident: incidents[0],
    };
  }

  /** Rebuilds once per animation frame no matter how many rows changed (e.g. a reseed). */
  function scheduleRebuild() {
    if (!applied || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (conn)
        publish({
          ...snapshot,
          residents: buildResidents(conn),
          liveFeed: buildFeed(conn),
        });
    });
  }

  function subscribeTables(c: DbConnection) {
    applied = false;
    setConnection({ state: 'syncing' });
    c.subscriptionBuilder()
      .onApplied(() => {
        applied = true;
        publish({
          ...snapshot,
          residents: buildResidents(c),
          liveFeed: buildFeed(c),
          connection: { state: 'live' },
        });
      })
      .onError((ctx) =>
        setConnection({
          state: 'error',
          message: `Subscription failed: ${ctx.event?.message ?? 'unknown error'}`,
        }),
      )
      .subscribe(QUERIES);
  }

  /** Registers row callbacks once per connection object. */
  function watchTables(c: DbConnection) {
    c.db.resident.onInsert(scheduleRebuild);
    c.db.resident.onUpdate(scheduleRebuild);
    c.db.resident.onDelete(scheduleRebuild);
    c.db.residentProfile.onInsert(scheduleRebuild);
    c.db.residentProfile.onUpdate(scheduleRebuild);
    c.db.residentProfile.onDelete(scheduleRebuild);
    c.db.notification.onInsert(scheduleRebuild);
    c.db.notification.onDelete(scheduleRebuild);
    c.db.incident.onInsert(scheduleRebuild);
    c.db.incident.onUpdate(scheduleRebuild);
    c.db.incident.onDelete(scheduleRebuild);
  }

  try {
    conn = DbConnection.builder()
      .withUri(uri)
      .withDatabaseName(db)
      .withAutomaticReconnect()
      .onConnect((c) => {
        watchTables(c);
        subscribeTables(c);
      })
      .onAutomaticReconnect((c) => subscribeTables(c))
      .onConnectError((_ctx, error, nextAttempt) =>
        setConnection({
          state: nextAttempt ? 'reconnecting' : 'error',
          message: `Can't connect to ${uri} (${db}): ${error.message}`,
        }),
      )
      .onDisconnect((_ctx, error, nextAttempt) => {
        applied = false;
        setConnection({
          state: nextAttempt ? 'reconnecting' : 'error',
          message: `Disconnected from ${db}${error ? `: ${error.message}` : ''}`,
        });
      })
      .build();
  } catch (failure) {
    snapshot = {
      ...snapshot,
      connection: {
        state: 'error',
        message: failure instanceof Error ? failure.message : String(failure),
      },
    };
  }

  return adapter;
}

function profileOf(p: {
  name: string;
  district: string;
  x: number;
  y: number;
  weakSpot: string;
}) {
  return {
    name: p.name,
    profile: { district: p.district, x: p.x, y: p.y, weakSpot: p.weakSpot },
  };
}
