import type {
  Resident,
  Scenario,
  Snapshot,
  MockPropagationEvent,
} from "./contracts";
import { mockForwardingLinks } from "./mockTopology";

export const MOCK_TICK_MS = 750;
export const MOCK_BATCH_SIZE = 25;
export const MOCK_DETECTION_TICK = 6;
export const MOCK_WARNING_DELAY = 6;
export const MOCK_INVESTIGATION_START_TICK = MOCK_DETECTION_TICK + 4;
export const MOCK_INVESTIGATION_END_TICK = MOCK_INVESTIGATION_START_TICK + 20;
const CLUSTER_ID = "timed-mock-cluster";

/** Creates synthetic demo identities without importing simulator ground truth or personal data. */
function createMockPopulation(): Resident[] {
  const names = ["Alex", "Sam", "Jordan", "Taylor"];
  const personas = ["Student", "Small-business owner", "Grandparent"];
  return Array.from({ length: 5000 }, (_, index) => ({
    id: `r${index + 1}`,
    displayName:
      names[index] ?? `Resident ${String(index + 1).padStart(4, "0")}`,
    persona: personas[index % personas.length],
    isSimulated: true,
  }));
}

interface PlannedTransmission {
  sourceId: string | null;
  recipientId: string;
}

/** Plans forwarding through the internal fictional topology; these edges are never drawn as real contacts. */
function planMockSpread(residents: Resident[]): PlannedTransmission[] {
  const ids = residents.map((resident) => resident.id).sort();
  const neighbors = new Map(ids.map((id) => [id, [] as string[]]));
  for (const link of mockForwardingLinks(ids)) {
    neighbors.get(link.sourceId)!.push(link.targetId);
    neighbors.get(link.targetId)!.push(link.sourceId);
  }
  const seed = ids[0];
  if (!seed) return [];
  const plan: PlannedTransmission[] = [{ sourceId: null, recipientId: seed }];
  const seen = new Set([seed]);
  for (let index = 0; index < plan.length; index++) {
    const parent = plan[index].recipientId;
    for (const child of neighbors.get(parent)!) {
      if (seen.has(child)) continue;
      seen.add(child);
      plan.push({ sourceId: parent, recipientId: child });
    }
  }
  return plan;
}

/** Pure step engine: scripted phases, bounded batches, and immutable snapshots make replay testable. */
export function createMockSimulation(scenario: Scenario, startedAt: number) {
  const residents = createMockPopulation();
  const plan = planMockSpread(residents);
  const names = new Map(
    residents.map((resident) => [resident.id, resident.displayName]),
  );
  const initial: Snapshot = {
    residents,
    campaigns: [
      {
        clusterId: CLUSTER_ID,
        label:
          scenario === "suspicious"
            ? "Timed mock parcel campaign"
            : "Timed mock community newsletter",
        detectionStatus: "monitoring",
        investigationStatus: "not_requested",
      },
    ],
    messages: [],
    warnings: [],
    mockPropagation: [],
    mockSimulation: {
      status: "running",
      scenario,
      tick: 0,
      tickMs: MOCK_TICK_MS,
      seedResidentId: plan[0].recipientId,
    },
  };

  function advance(current: Snapshot): Snapshot {
    const state = current.mockSimulation;
    if (!state || state.status !== "running") return current;
    const tick = state.tick + 1;
    // First show just the entry point, then expand in short visible batches.
    const targetCount = Math.min(plan.length, 1 + (tick - 1) * MOCK_BATCH_SIZE);
    const newEvents: MockPropagationEvent[] = plan
      .slice(current.messages.length, targetCount)
      .map((step, index) => {
        const sequence = current.messages.length + index;
        return {
          id: `mock-transmission-${sequence}`,
          ...step,
          messageId: `mock-message-${sequence}`,
          occurredAt: startedAt + tick * MOCK_TICK_MS + index,
          tick,
        };
      });
    const events = [...(current.mockPropagation ?? []), ...newEvents];
    const messages = [
      ...current.messages,
      ...newEvents.map((event) => ({
        id: event.messageId,
        recipientId: event.recipientId,
        detectedClusterId: CLUSTER_ID,
        senderLabel: event.sourceId
          ? `${names.get(event.sourceId)} (simulated forward)`
          : "External source (simulated)",
        syntheticText:
          scenario === "suspicious"
            ? "[Synthetic mock] A parcel-themed scam message was forwarded in this fictional network."
            : "[Synthetic mock] The community picnic is Saturday. This newsletter is benign.",
        receivedAt: event.occurredAt,
      })),
    ];
    // This is a scripted UI phase, not the team's detector and not an evaluation of benign traffic.
    const flagged = scenario === "suspicious" && tick >= MOCK_DETECTION_TICK;
    const warned = new Set(
      current.warnings.map((warning) => warning.recipientId),
    );
    const newWarnings = flagged
      ? events
          .filter(
            (event) =>
              event.tick <= tick - MOCK_WARNING_DELAY &&
              !warned.has(event.recipientId),
          )
          .map((event) => ({
            id: `mock-warning-${event.recipientId}`,
            recipientId: event.recipientId,
            clusterId: CLUSTER_ID,
            severity: "preliminary" as const,
            warningText:
              "[Scripted mock warning] A similar message was flagged in this demo. Verify requests independently. This is not a confirmed verdict.",
            createdAt: startedAt + tick * MOCK_TICK_MS,
            acknowledged: false,
          }))
      : [];
    const warnings = [...current.warnings, ...newWarnings];
    const complete =
      messages.length === residents.length &&
      (!flagged || warnings.length === residents.length);
    return {
      ...current,
      messages,
      warnings,
      mockPropagation: events,
      campaigns: current.campaigns.map((campaign) => ({
        ...campaign,
        detectionStatus: flagged ? "flagged" : "monitoring",
        // Scripted campaign assessment only: never a real Nemotron call or a containment signal.
        investigationStatus:
          !flagged || tick < MOCK_INVESTIGATION_START_TICK
            ? "not_requested"
            : tick < MOCK_INVESTIGATION_END_TICK
              ? "pending"
              : "complete",
      })),
      mockSimulation: {
        ...state,
        tick,
        status: complete ? "complete" : "running",
      },
    };
  }
  return { initial, advance };
}
