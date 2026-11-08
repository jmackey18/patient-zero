import type { DataAdapter, Snapshot } from "./contracts";
import { createMockSnapshot } from "./mockFixtures";
import { createMockSimulation, MOCK_TICK_MS } from "./mockSimulation";

interface MockAdapterOptions {
  now?: () => number;
  /** Inject a manual scheduler in tests; the returned function cancels pending ticks. */
  scheduleTick?: (tick: () => void) => () => void;
}

/** Owns the local fixture and timed-demo lifecycle; no live reducers or network requests. */
export function createMockAdapter(
  options: MockAdapterOptions = {},
): DataAdapter {
  let snapshot = createMockSnapshot("suspicious");
  let run: ReturnType<typeof createMockSimulation> | undefined;
  let timerGeneration = 0;
  let cancelTimer: (() => void) | undefined;
  const listeners = new Set<() => void>();
  const scheduleTick =
    options.scheduleTick ??
    ((tick: () => void) => {
      const timer = globalThis.setInterval(tick, MOCK_TICK_MS);
      return () => globalThis.clearInterval(timer);
    });
  const publish = (next: Snapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  const stopTimer = () => {
    timerGeneration++;
    cancelTimer?.();
    cancelTimer = undefined;
  };
  const startTimer = () => {
    stopTimer();
    const generation = timerGeneration;
    cancelTimer = scheduleTick(() => {
      if (generation !== timerGeneration) return;
      if (!run || snapshot.mockSimulation?.status !== "running") return;
      const next = run.advance(snapshot);
      if (next.mockSimulation?.status === "complete") stopTimer();
      publish(next);
    });
  };
  const validateScenario = (scenario: string) => {
    if (scenario !== "suspicious" && scenario !== "benign")
      throw new Error("Unknown mock scenario.");
  };

  return {
    mode: "mock",
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        // Leaving the app must not leave a timer running. Navigation within App keeps its subscription.
        if (listeners.size === 0) {
          stopTimer();
          if (snapshot.mockSimulation?.status === "running")
            snapshot = {
              ...snapshot,
              mockSimulation: { ...snapshot.mockSimulation, status: "paused" },
            };
        }
      };
    },
    async acknowledgeWarning(id) {
      if (!snapshot.warnings.some((warning) => warning.id === id))
        throw new Error("Warning no longer available.");
      publish({
        ...snapshot,
        warnings: snapshot.warnings.map((warning) =>
          warning.id === id ? { ...warning, acknowledged: true } : warning,
        ),
      });
    },
    async loadScenario(scenario) {
      validateScenario(scenario);
      stopTimer();
      run = undefined;
      publish(createMockSnapshot(scenario));
    },
    async reset() {
      stopTimer();
      run = undefined;
      publish(
        snapshot.mockSimulation
          ? {
              residents: snapshot.residents,
              campaigns: [],
              messages: [],
              warnings: [],
              mockPropagation: [],
              mockSimulation: {
                ...snapshot.mockSimulation,
                tick: 0,
                status: "idle",
              },
            }
          : createMockSnapshot(null),
      );
    },
    async startMockSimulation(scenario) {
      validateScenario(scenario);
      stopTimer();
      run = createMockSimulation(scenario, (options.now ?? Date.now)());
      publish(run.initial);
      startTimer();
    },
    async pauseMockSimulation() {
      if (snapshot.mockSimulation?.status !== "running")
        throw new Error("No running mock simulation.");
      stopTimer();
      publish({
        ...snapshot,
        mockSimulation: { ...snapshot.mockSimulation, status: "paused" },
      });
    },
    async resumeMockSimulation() {
      if (!run || snapshot.mockSimulation?.status !== "paused")
        throw new Error("No paused mock simulation.");
      publish({
        ...snapshot,
        mockSimulation: { ...snapshot.mockSimulation, status: "running" },
      });
      startTimer();
    },
  };
}
