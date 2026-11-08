import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScript } from "./loadTypeScript.mjs";
const { createMockAdapter } = await loadTypeScript(
  new URL("../src/data/mockAdapter.ts", import.meta.url),
);
const {
  createMockSimulation,
  MOCK_BATCH_SIZE,
  MOCK_DETECTION_TICK,
  MOCK_WARNING_DELAY,
  MOCK_INVESTIGATION_START_TICK,
  MOCK_INVESTIGATION_END_TICK,
} = await loadTypeScript(
  new URL("../src/data/mockSimulation.ts", import.meta.url),
);
const { residentSignals } = await loadTypeScript(
  new URL("../src/components/campus/mapModel.ts", import.meta.url),
);
const { mockForwardingLinks } = await loadTypeScript(
  new URL("../src/data/mockTopology.ts", import.meta.url),
);

// Allow a full population run at the configured batch size, including delayed warnings.
const completionTickLimit =
  1 + Math.ceil(5000 / MOCK_BATCH_SIZE) + MOCK_WARNING_DELAY;

function harness() {
  const timers = new Set();
  const scheduled = [];
  const adapter = createMockAdapter({
    now: () => 1000000,
    scheduleTick: (tick) => {
      timers.add(tick);
      scheduled.push(tick);
      return () => timers.delete(tick);
    },
  });
  const unsubscribe = adapter.subscribe(() => {});
  return {
    adapter,
    timers,
    scheduled,
    unsubscribe,
    tick: (times = 1) => {
      for (let i = 0; i < times; i++)
        for (const callback of [...timers]) callback();
    },
  };
}

test("suspicious demo reaches all 5000 via causal mock forwards, then finishes delayed warnings", () => {
  const run = createMockSimulation("suspicious", 1000000);
  let data = run.initial;
  assert.equal(data.residents.length, 5000);
  assert.equal(data.messages.length, 0);
  const initial = JSON.stringify(data);
  const links = new Set(
    mockForwardingLinks(data.residents.map((r) => r.id)).map(
      ({ sourceId, targetId }) => [sourceId, targetId].sort().join(":"),
    ),
  );
  data = run.advance(data);
  assert.equal(data.messages.length, 1);
  assert.equal(data.mockPropagation[0].sourceId, null);
  for (let tick = 2; tick < MOCK_DETECTION_TICK; tick++)
    data = run.advance(data);
  assert.ok(
    [...residentSignals(data).values()].every(
      (signal) => signal.status === "no_flagged",
    ),
  );
  assert.equal(data.warnings.length, 0);
  data = run.advance(data);
  assert.equal(data.campaigns[0].detectionStatus, "flagged");
  assert.equal(
    [...residentSignals(data).values()].filter(
      (signal) => signal.status === "flagged",
    ).length,
    data.messages.length,
  );
  assert.equal(data.warnings.length, 0);
  while (
    data.mockSimulation.status === "running" &&
    data.mockSimulation.tick < completionTickLimit
  )
    data = run.advance(data);
  assert.equal(data.mockSimulation.status, "complete");
  assert.equal(data.messages.length, 5000);
  assert.equal(data.mockPropagation.length, 5000);
  assert.equal(data.warnings.length, 5000);
  assert.equal(
    new Set(data.messages.map((message) => message.recipientId)).size,
    5000,
  );
  const received = new Map();
  for (const event of data.mockPropagation) {
    if (event.sourceId) {
      assert.ok(received.has(event.sourceId));
      assert.ok(received.get(event.sourceId) < event.occurredAt);
      assert.ok(
        links.has([event.sourceId, event.recipientId].sort().join(":")),
      );
    }
    received.set(event.recipientId, event.occurredAt);
  }
  for (const warning of data.warnings)
    assert.ok(warning.createdAt > received.get(warning.recipientId));
  assert.equal(run.advance(data), data);
  assert.equal(JSON.stringify(run.initial), initial);
  assert.equal(data.campaigns[0].investigationStatus, "complete");
});

test("benign timed fixture delivers but never scripts a detection or warning", () => {
  const run = createMockSimulation("benign", 0);
  let data = run.initial;
  for (let index = 0; index < completionTickLimit; index++)
    data = run.advance(data);
  assert.equal(data.mockSimulation.status, "complete");
  assert.equal(data.messages.length, 5000);
  assert.equal(data.warnings.length, 0);
  assert.equal(data.campaigns[0].detectionStatus, "monitoring");
  assert.equal(data.campaigns[0].investigationStatus, "not_requested");
  assert.ok(
    [...residentSignals(data).values()].every(
      (signal) => !signal.investigating,
    ),
  );
  assert.ok(
    [...residentSignals(data).values()].every(
      (signal) => signal.status === "no_flagged",
    ),
  );
});

test("adapter pause/resume, restart and reset cancel timers without stale mutations", async () => {
  const h = harness();
  await h.adapter.startMockSimulation("suspicious");
  assert.equal(h.timers.size, 1);
  const before = h.adapter.getSnapshot();
  assert.equal(before, h.adapter.getSnapshot());
  h.tick(4);
  assert.equal(before.messages.length, 0);
  await h.adapter.pauseMockSimulation();
  const paused = h.adapter.getSnapshot();
  h.tick(10);
  h.scheduled[0]();
  assert.equal(h.adapter.getSnapshot(), paused);
  assert.equal(h.timers.size, 0);
  await h.adapter.resumeMockSimulation();
  assert.equal(h.timers.size, 1);
  h.tick();
  assert.equal(h.adapter.getSnapshot().mockSimulation.tick, 5);
  await h.adapter.startMockSimulation("benign");
  const restarted = h.adapter.getSnapshot();
  h.scheduled[1]();
  assert.equal(h.adapter.getSnapshot(), restarted);
  assert.equal(restarted.messages.length, 0);
  assert.equal(h.timers.size, 1);
  await h.adapter.reset();
  const reset = h.adapter.getSnapshot();
  h.tick(20);
  assert.equal(h.adapter.getSnapshot(), reset);
  assert.equal(reset.residents.length, 5000);
  assert.equal(reset.mockSimulation.status, "idle");
  assert.equal(
    reset.messages.length +
      reset.warnings.length +
      reset.mockPropagation.length +
      reset.campaigns.length,
    0,
  );
  await assert.rejects(h.adapter.resumeMockSimulation());
  h.unsubscribe();
});

test("acknowledgment survives ticks; completion, fixture loading and unmount stop the clock", async () => {
  const h = harness();
  await h.adapter.startMockSimulation("suspicious");
  h.tick(MOCK_DETECTION_TICK + MOCK_WARNING_DELAY);
  const id = h.adapter.getSnapshot().warnings[0].id;
  await h.adapter.acknowledgeWarning(id);
  h.tick();
  assert.equal(
    h.adapter.getSnapshot().warnings.find((warning) => warning.id === id)
      .acknowledged,
    true,
  );
  const running = h.adapter.getSnapshot();
  await assert.rejects(h.adapter.startMockSimulation("invalid"));
  assert.equal(h.adapter.getSnapshot(), running);
  h.tick(completionTickLimit);
  assert.equal(h.timers.size, 0);
  assert.equal(h.adapter.getSnapshot().mockSimulation.status, "complete");
  await h.adapter.startMockSimulation("suspicious");
  await h.adapter.loadScenario("benign");
  assert.equal(h.adapter.getSnapshot().residents.length, 4);
  assert.equal(h.adapter.getSnapshot().mockSimulation, undefined);
  assert.equal(h.timers.size, 0);
  await h.adapter.startMockSimulation("suspicious");
  h.unsubscribe();
  assert.equal(h.timers.size, 0);
  assert.equal(h.adapter.getSnapshot().mockSimulation.status, "paused");
});

test("scripted investigation outlines start, pause, complete, and reset without stopping spread", async () => {
  const h = harness();
  await h.adapter.startMockSimulation("suspicious");
  h.tick(MOCK_INVESTIGATION_START_TICK - 1);
  assert.equal(
    h.adapter.getSnapshot().campaigns[0].investigationStatus,
    "not_requested",
  );
  h.tick();
  const active = h.adapter.getSnapshot();
  assert.equal(active.campaigns[0].investigationStatus, "pending");
  assert.equal(
    [...residentSignals(active).values()].filter((s) => s.investigating).length,
    active.messages.length,
  );
  await h.adapter.pauseMockSimulation();
  const paused = h.adapter.getSnapshot();
  h.tick(100);
  assert.equal(h.adapter.getSnapshot(), paused);
  await h.adapter.resumeMockSimulation();
  h.tick(MOCK_INVESTIGATION_END_TICK - MOCK_INVESTIGATION_START_TICK - 1);
  assert.equal(
    h.adapter.getSnapshot().campaigns[0].investigationStatus,
    "pending",
  );
  h.tick();
  const complete = h.adapter.getSnapshot();
  assert.equal(complete.campaigns[0].investigationStatus, "complete");
  assert.equal(complete.mockSimulation.status, "running");
  assert.ok(
    [...residentSignals(complete).values()].every((s) => !s.investigating),
  );
  assert.equal(
    [...residentSignals(complete).values()].filter(
      (s) => s.status === "flagged",
    ).length,
    complete.messages.length,
  );
  h.tick();
  assert.ok(h.adapter.getSnapshot().messages.length > complete.messages.length);
  await h.adapter.startMockSimulation("suspicious");
  h.tick(MOCK_INVESTIGATION_START_TICK);
  await h.adapter.reset();
  assert.ok(
    [...residentSignals(h.adapter.getSnapshot()).values()].every(
      (s) => !s.investigating,
    ),
  );
  assert.equal(h.timers.size, 0);
  h.unsubscribe();
});
