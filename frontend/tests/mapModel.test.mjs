import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScript } from "./loadTypeScript.mjs";

const { residentSignals, residentMapStates } = await loadTypeScript(
  new URL("../src/components/campus/mapModel.ts", import.meta.url),
);
const resident = {
  id: "r1",
  displayName: "Test resident",
  persona: "Student",
  isSimulated: true,
};
test("resident display states ignore profile coordinates and susceptibility", () => {
  const residents = Array.from({ length: 400 }, (_, i) => ({
    ...resident,
    id: `r${i}`,
    profile: {
      district: `District ${i % 6}`,
      x: i / 400,
      y: 1,
      weakSpot: "parcel",
    },
  }));
  const data = { residents, messages: [], campaigns: [], warnings: [] };
  const original = residentMapStates(data);
  const reassigned = residentMapStates({
    ...data,
    residents: residents.map((item) => ({
      ...item,
      profile: {
        district: "One new district",
        x: NaN,
        y: Infinity,
        weakSpot: "other",
      },
    })),
  });
  const noProfiles = residentMapStates({
    ...data,
    residents: residents.map(({ profile, ...item }) => item),
  });
  assert.deepEqual(original, reassigned);
  assert.deepEqual(original, noProfiles);
  assert.deepEqual(
    residentMapStates({
      ...data,
      residents: [...residents].reverse(),
    }).reverse(),
    original,
  );
});

const snapshot = (patch = {}) => ({
  residents: [resident, { ...resident, id: "r2" }],
  messages: [{ id: "m1", recipientId: "r1", detectedClusterId: "cluster1" }],
  campaigns: [
    {
      clusterId: "cluster1",
      detectionStatus: "monitoring",
      investigationStatus: "not_requested",
    },
  ],
  warnings: [],
  ...patch,
});

test("recipient changes from green to red only when its received message cluster is flagged", () => {
  const data = snapshot();
  const before = JSON.stringify(data);
  assert.equal(residentSignals(data).get("r1").status, "no_flagged");
  const flagged = residentSignals({
    ...data,
    campaigns: [{ ...data.campaigns[0], detectionStatus: "flagged" }],
  });
  assert.equal(flagged.get("r1").status, "flagged");
  assert.equal(flagged.get("r1").flaggedCount, 1);
  assert.equal(flagged.get("r2").status, "no_flagged");
  assert.equal(JSON.stringify(data), before);
});

test("warning acknowledgment and completed investigation preserve exposure", () => {
  const data = snapshot({
    campaigns: [
      {
        clusterId: "cluster1",
        detectionStatus: "flagged",
        investigationStatus: "complete",
      },
    ],
    warnings: [
      { id: "w1", recipientId: "r1", acknowledged: true },
      { id: "w2", recipientId: "r2", acknowledged: false },
    ],
  });
  assert.deepEqual(residentSignals(data).get("r1"), {
    status: "flagged",
    investigating: false,
    messageCount: 1,
    flaggedCount: 1,
    warningCount: 1,
    acknowledgedCount: 1,
  });
  assert.equal(residentSignals(data).get("r2").status, "no_flagged");
  assert.equal(residentSignals(data).get("r2").warningCount, 1);
});

test("empty live feeds stay unknown and orphan records cannot create resident nodes", () => {
  const data = snapshot({
    connection: { state: "live" },
    messages: [{ recipientId: "missing", detectedClusterId: "cluster1" }],
    warnings: [{ recipientId: "missing", acknowledged: true }],
    campaigns: [{ clusterId: "cluster1", detectionStatus: "flagged" }],
  });
  const nodes = residentMapStates(data);
  assert.equal(nodes.length, 2);
  assert.ok(
    nodes.every((node) => node.status === "unavailable" && !node.warningCount),
  );
  assert.equal(
    residentMapStates({
      residents: [],
      messages: [],
      campaigns: [],
      warnings: [],
    }).length,
    0,
  );
});

test("reset preserves resident IDs and clears previous warning/flag records", () => {
  const data = snapshot({
    campaigns: [{ clusterId: "cluster1", detectionStatus: "flagged" }],
    warnings: [{ recipientId: "r1", acknowledged: false }],
  });
  const flagged = residentMapStates(data);
  const reset = residentMapStates({
    ...data,
    messages: [],
    campaigns: [],
    warnings: [],
  });
  assert.deepEqual(
    flagged.map(({ id }) => id),
    reset.map(({ id }) => id),
  );
  assert.ok(
    reset.every(
      (node) => node.status === "no_flagged" && node.warningCount === 0,
    ),
  );
});

test("blue mock outlines follow campaign membership and stay separate from exposure and warnings", () => {
  const data = snapshot({
    mockSimulation: { status: "paused" },
    campaigns: [
      {
        clusterId: "cluster1",
        detectionStatus: "flagged",
        investigationStatus: "pending",
      },
      {
        clusterId: "unrelated",
        detectionStatus: "monitoring",
        investigationStatus: "pending",
      },
    ],
    warnings: [{ recipientId: "r1", acknowledged: true }],
  });
  const signals = residentSignals(data);
  assert.equal(signals.get("r1").investigating, true);
  assert.equal(signals.get("r2").investigating, false);
  assert.equal(signals.get("r1").status, "flagged");
  assert.equal(signals.get("r1").warningCount, 1);
  assert.equal(signals.get("r1").acknowledgedCount, 1);
  for (const investigationStatus of ["complete", "failed", "not_requested"]) {
    const changed = residentSignals({
      ...data,
      campaigns: [{ ...data.campaigns[0], investigationStatus }],
    });
    assert.equal(changed.get("r1").investigating, false);
    assert.equal(changed.get("r1").status, "flagged");
    assert.equal(changed.get("r1").warningCount, 1);
  }
  assert.equal(
    residentSignals({ ...data, connection: { state: "live" } }).get("r1")
      .investigating,
    false,
  );
  assert.equal(
    residentSignals({ ...data, mockSimulation: undefined }).get("r1")
      .investigating,
    false,
  );
  assert.equal(
    residentSignals({ ...data, messages: [] }).get("r1").investigating,
    false,
  );
});

test("live flags drive colors independently from notifications and AI assessments", () => {
  const data = snapshot({
    connection: { state: "live" },
    residents: [
      {
        ...resident,
        id: "exposed",
        liveState: { exposed: true, warned: true },
      },
      {
        ...resident,
        id: "warned",
        liveState: { exposed: false, warned: true },
      },
      {
        ...resident,
        id: "untouched",
        liveState: { exposed: false, warned: false },
      },
      { ...resident, id: "unknown" },
    ],
    liveFeed: {
      notifications: [
        { id: "1", recipientId: "exposed", kind: "recovery" },
        { id: "2", recipientId: "warned", kind: "alert" },
        { id: "3", recipientId: "missing", kind: "alert" },
      ],
      incidents: [{ campaignId: "c1", status: "investigating" }],
    },
  });
  const before = JSON.stringify(data);
  const nodes = residentMapStates(data);
  assert.deepEqual(
    nodes.map((n) => n.status),
    ["exposed", "warned", "untouched", "unavailable"],
  );
  assert.deepEqual(
    nodes.map((n) => n.warningCount),
    [1, 1, 0, 0],
  );
  assert.ok(
    nodes.every(
      (n) => !n.investigating && n.messageCount === 0 && n.flaggedCount === 0,
    ),
  );
  for (const status of ["complete", "failed"]) {
    assert.deepEqual(
      residentMapStates({
        ...data,
        liveFeed: {
          ...data.liveFeed,
          incidents: [{ campaignId: "c1", status }],
        },
      }),
      nodes,
    );
  }
  const cleared = residentMapStates({
    ...data,
    residents: data.residents.map((r) => ({
      ...r,
      liveState: { exposed: false, warned: false },
    })),
    liveFeed: { notifications: [], incidents: [] },
  });
  assert.ok(
    cleared.every((n) => n.status === "untouched" && n.warningCount === 0),
  );
  assert.deepEqual(
    nodes.map(({ id }) => id),
    cleared.map(({ id }) => id),
  );
  assert.equal(JSON.stringify(data), before);
});

test("5000 live residents retain distinct exposed and warned counts on updates", () => {
  const data = snapshot({
    connection: { state: "live" },
    residents: Array.from({ length: 5000 }, (_, id) => ({
      ...resident,
      id: String(id),
      liveState: { exposed: id < 6, warned: id >= 6 },
    })),
    messages: [],
    campaigns: [],
    warnings: [],
  });
  const nodes = residentMapStates(data);
  assert.equal(nodes.filter((n) => n.status === "exposed").length, 6);
  assert.equal(nodes.filter((n) => n.status === "warned").length, 4994);
  assert.ok(nodes.every((n) => n.warningCount === 0));
});
