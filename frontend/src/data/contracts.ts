// Frontend view models, not a replacement for the team's backend schema.
export interface Resident {
  id: string;
  persona: string;
  isSimulated: boolean;
  displayName: string;
}

export interface Campaign {
  clusterId: string;
  label: string;
  detectionStatus: 'monitoring' | 'flagged';
  investigationStatus: 'not_requested' | 'pending' | 'complete' | 'failed';
}

export interface Warning {
  id: string;
  recipientId: string;
  clusterId: string;
  severity: 'preliminary' | 'elevated';
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

export interface Snapshot {
  residents: Resident[];
  campaigns: Campaign[];
  messages: SyntheticMessage[];
  warnings: Warning[];
}

export type Scenario = 'suspicious' | 'benign';

/** Data access contract shared by the local mock and a future live backend adapter. */
export interface DataAdapter {
  readonly mode: 'mock' | 'live';
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
}
