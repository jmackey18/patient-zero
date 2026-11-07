import type { DataAdapter, Snapshot } from './contracts';
import { createMockSnapshot } from './mockFixtures';

/** Creates an independent, in-memory demo session implementing the UI data contract. */
export function createMockAdapter(): DataAdapter {
  let snapshot = createMockSnapshot('suspicious');
  const listeners = new Set<() => void>();
  /** Replaces the cached snapshot, then notifies subscribers to read the new state. */
  const publish = (next: Snapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };

  return {
    mode: 'mock',
    /** Returns the same snapshot reference until publish replaces it. */
    getSnapshot: () => snapshot,
    /** Registers an update callback and returns its unsubscribe cleanup function. */
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Updates an existing warning immutably; rejects if the warning no longer exists. */
    async acknowledgeWarning(id) {
      if (!snapshot.warnings.some((warning) => warning.id === id))
        throw new Error('Warning no longer available.');
      publish({
        ...snapshot,
        warnings: snapshot.warnings.map((warning) =>
          warning.id === id ? { ...warning, acknowledged: true } : warning,
        ),
      });
    },
    /** Validates the scenario and replaces all demo records, including acknowledgments. */
    async loadScenario(scenario) {
      if (scenario !== 'suspicious' && scenario !== 'benign')
        throw new Error('Unknown mock scenario.');
      publish(createMockSnapshot(scenario));
    },
    /** Clears campaign activity and warnings while recreating the default residents. */
    async reset() {
      publish(createMockSnapshot(null));
    },
  };
}
