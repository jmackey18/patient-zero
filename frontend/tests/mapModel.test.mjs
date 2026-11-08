import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadTypeScript } from "./loadTypeScript.mjs";

const { residentSignals, constellationNodes } = await loadTypeScript(
  new URL("../src/components/avon/mapModel.ts", import.meta.url),
);
const { residentPosition, syntheticLayoutLinks } = await loadTypeScript(
  new URL("../src/lib/networkLayout.ts", import.meta.url),
);
const resident = {
  id: "r1",
  displayName: "Test resident",
  persona: "Student",
  isSimulated: true,
};
const { insideTexas } = await loadTypeScript(
  new URL("../src/lib/texasLayout.ts", import.meta.url),
);

test("all 5000 residents form one connected network without mutating input", async () => {
  const raw = JSON.parse(
    await readFile(
      new URL("../../simulation/data/residents.json", import.meta.url),
      "utf8",
    ),
  );
  const residents = raw.map((row) => ({
    ...resident,
    id: String(row.id),
    profile: { district: row.district, x: row.x, y: row.y },
  }));
  const data = {
    residents,
    messages: [],
    campaigns: [],
    warnings: [],
    connection: { state: "live" },
  };
  const before = JSON.stringify(data);
  const nodes = constellationNodes(data);
  assert.equal(nodes.length, 5000);
  assert.equal(new Set(nodes.map((node) => node.id)).size, 5000);
  assert.ok(nodes.every((node) => node.status === "unavailable"));
  assertConnectedLayout(nodes);
  assert.equal(JSON.stringify(data), before);
  assert.equal(
    new Set(nodes.map(({ x, y, z }) => JSON.stringify([x, y, z]))).size,
    5000,
  );
  for (const node of nodes) {
    assert.ok([node.x, node.y, node.z].every(Number.isFinite));
    assert.ok(insideTexas(node.x, node.y));
    assert.ok(node.z >= 5 && node.z < 16);
  }
  assert.ok(new Set(nodes.map((node) => Math.floor(node.z))).size >= 10);
  assert.ok(
    Math.max(...nodes.map((node) => node.x)) -
      Math.min(...nodes.map((node) => node.x)) >
      45,
  );
  assert.ok(
    Math.max(...nodes.map((node) => node.y)) -
      Math.min(...nodes.map((node) => node.y)) >
      42,
  );
});

test("districts, coordinates, and susceptibility have no influence on positions or links", () => {
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
  const original = constellationNodes(data);
  const reassigned = constellationNodes({
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
  const noProfiles = constellationNodes({
    ...data,
    residents: residents.map(({ profile, ...item }) => item),
  });
  assert.deepEqual(original, reassigned);
  assert.deepEqual(original, noProfiles);
  assert.deepEqual(
    syntheticLayoutLinks(original),
    syntheticLayoutLinks(reassigned),
  );
  assert.deepEqual(
    constellationNodes({
      ...data,
      residents: [...residents].reverse(),
    }).reverse(),
    original,
  );
  assert.deepEqual(
    residentPosition("r201"),
    original.map(({ id, x, y, z }) => ({ id, x, y, z }))[201],
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
  const nodes = constellationNodes(data);
  assert.equal(nodes.length, 2);
  assert.ok(
    nodes.every((node) => node.status === "unavailable" && !node.warningCount),
  );
  assert.equal(
    constellationNodes({
      residents: [],
      messages: [],
      campaigns: [],
      warnings: [],
    }).length,
    0,
  );
});

test("state updates preserve all dot positions and reset clears previous warning/flag records", () => {
  const data = snapshot({
    campaigns: [{ clusterId: "cluster1", detectionStatus: "flagged" }],
    warnings: [{ recipientId: "r1", acknowledged: false }],
  });
  const flagged = constellationNodes(data);
  const reset = constellationNodes({
    ...data,
    messages: [],
    campaigns: [],
    warnings: [],
  });
  assert.deepEqual(
    flagged.map(({ id, x, y, z }) => ({ id, x, y, z })),
    reset.map(({ id, x, y, z }) => ({ id, x, y, z })),
  );
  assert.ok(
    reset.every(
      (node) => node.status === "no_flagged" && node.warningCount === 0,
    ),
  );
});

/** Verifies the internal mock topology is a tree with real node endpoints and no isolated residents. */
function assertConnectedLayout(nodes) {
  const links = syntheticLayoutLinks(nodes);
  assert.equal(links.length, Math.max(0, nodes.length - 1));
  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  const pairs = new Set();
  for (const link of links) {
    assert.ok(adjacency.has(link.sourceId) && adjacency.has(link.targetId));
    assert.notEqual(link.sourceId, link.targetId);
    const pair = [link.sourceId, link.targetId].sort().join(":");
    assert.ok(!pairs.has(pair));
    pairs.add(pair);
    adjacency.get(link.sourceId).push(link.targetId);
    adjacency.get(link.targetId).push(link.sourceId);
  }
  const seen = new Set();
  const pending = nodes.length ? [nodes[0].id] : [];
  while (pending.length) {
    const id = pending.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    pending.push(
      ...adjacency.get(id).filter((neighbor) => !seen.has(neighbor)),
    );
  }
  assert.equal(seen.size, nodes.length);
  assert.deepEqual(syntheticLayoutLinks([...nodes].reverse()), links);
}

test("synthetic layout stays connected for empty, single, and coincident inputs", () => {
  assertConnectedLayout([]);
  assertConnectedLayout([{ id: "only", x: 0, y: 0, z: 0 }]);
  const nodes = Array.from({ length: 60 }, (_, i) => ({
    id: `node${i}`,
    x: i % 5,
    y: i % 7,
    z: i % 2,
  }));
  assertConnectedLayout(nodes);
  assertConnectedLayout(nodes.map((node) => ({ ...node, x: 0, y: 0, z: 0 })));
  assert.deepEqual(
    syntheticLayoutLinks(nodes),
    syntheticLayoutLinks(
      nodes.map((node) => ({ ...node, status: "flagged", warningCount: 5 })),
    ),
  );
});

test("blue mock rings follow campaign membership and stay separate from exposure and warnings", () => {
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
