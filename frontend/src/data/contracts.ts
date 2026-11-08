// Frontend view models, not a replacement for the team's backend schema.
export interface Resident {
  id: string;
  persona: string;
  isSimulated: boolean;
  displayName: string;
  /** Map/profile details; present in live mode (from resident_profile), absent in mock fixtures. */
  profile?: ResidentProfile;
}

export interface ResidentProfile {
  district: string;
  /** Map position, 0..1. */
  x: number;
  y: number;
  /** Scam type this synthetic resident is most likely to fall for. */
  weakSpot: string;
}

/** Live-adapter connection state; absent in mock mode. */
export interface ConnectionStatus {
  state: "connecting" | "syncing" | "live" | "reconnecting" | "error";
  message?: string;
}

export interface Campaign {
  clusterId: string;
  label: string;
  detectionStatus: "monitoring" | "flagged";
  investigationStatus: "not_requested" | "pending" | "complete" | "failed";
}

export interface Warning {
  id: string;
  recipientId: string;
  clusterId: string;
  severity: "preliminary" | "elevated";
  warningText: string;
  createdAt: number;
  acknowledged: boolean;
}

// Authorized synthetic inbox content only; never ordinary ingestion plaintext.
export interface SyntheticMessage {
  id: string;
  recipientId: string;
  detectedClusterId?: string;
  senderLabel: string;
  syntheticText: string;
  receivedAt: number;
}

/** Browser-local demo event, not a production ingestion or detection contract. */
export interface MockPropagationEvent {
  id: string;
  sourceId: string | null;
  recipientId: string;
  messageId: string;
  occurredAt: number;
  tick: number;
}

export interface MockSimulationState {
  status: "idle" | "running" | "paused" | "complete";
  scenario: Scenario;
  tick: number;
  tickMs: number;
  seedResidentId: string;
}

/** Spacetime `notification` row, written by flag_campaign. */
export interface LiveNotification {
  id: string;
  recipientId: string;
  /** "alert" = warned before opening; "recovery" = already hit, show recovery steps. */
  kind: "alert" | "recovery";
  text: string;
}

/** Fingerprint-cluster metadata Nemotron reasons over (never message text). */
export interface ClusterMeta {
  size: number;
  distinct_recipients: number;
  sender_unknown: boolean;
  time_spread_s: number;
  fingerprint?: number | string;
}

/** Spacetime `incident` row: Nemotron's investigation of one campaign, written by live_detect.py. */
export interface LiveIncident {
  campaignId: string;
  status: "investigating" | "complete" | "failed";
  isCoordinated: boolean;
  /** 0-100 */
  confidence: number;
  reasoning: string;
  warningText: string;
  numVariants: number;
  clusterMeta: ClusterMeta[];
  /** Epoch milliseconds. */
  createdAt: number;
  updatedAt: number;
}

/** Live notification + Nemotron feed. Present only in live mode (`VITE_DATA_MODE=live`). */
export interface LiveFeed {
  /** All notification rows, oldest first. */
  notifications: LiveNotification[];
  alertCount: number;
  recoveryCount: number;
  /** All incidents, newest first. */
  incidents: LiveIncident[];
  /** Newest incident, or undefined before the first detection. */
  latestIncident?: LiveIncident;
}

export interface Snapshot {
  residents: Resident[];
  campaigns: Campaign[];
  messages: SyntheticMessage[];
  warnings: Warning[];
  connection?: ConnectionStatus;
  /** Present only for the browser-local timed demo; live adapters omit these fields. */
  mockSimulation?: MockSimulationState;
  mockPropagation?: MockPropagationEvent[];
  /** Live mode only: notification + Nemotron incident feed from SpacetimeDB. */
  liveFeed?: LiveFeed;
}

export type Scenario = "suspicious" | "benign";

/** Data access contract shared by the local mock and a future live backend adapter. */
export interface DataAdapter {
  readonly mode: "mock" | "live";
  /** Returns a stable cached snapshot until an update, as required by useSyncExternalStore. */
  getSnapshot(): Snapshot;
  /** Registers a change listener and returns a function that removes it. */
  subscribe(onChange: () => void): () => void;
  /** Acknowledges a warning; rejects if the update cannot be completed. */
  acknowledgeWarning(warningId: string): Promise<void>;
  /** Loads a demo scenario; live implementations require an agreed operator-authorized operation. */
  loadScenario(scenario: Scenario): Promise<void>;
  /** Resets simulation state according to the adapter implementation. */
  reset(): Promise<void>;
  /** Optional local-demo controls. Live adapters do not implement them. */
  startMockSimulation?(scenario: Scenario): Promise<void>;
  pauseMockSimulation?(): Promise<void>;
  resumeMockSimulation?(): Promise<void>;
}
