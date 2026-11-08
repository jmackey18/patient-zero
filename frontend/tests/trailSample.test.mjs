import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScript } from "./loadTypeScript.mjs";

const { sampleResidentTrails, MAX_DISPLAY_TRAILS } = await loadTypeScript(
  new URL("../src/components/campus/trailSample.ts", import.meta.url),
);
const population = (counts) =>
  Object.entries(counts).flatMap(([status, count]) =>
    Array.from({ length: count }, (_, i) => ({
      id: `${status}-${i}`,
      status,
      investigating: false,
    })),
  );
const count = (nodes, status) =>
  nodes.filter((node) => node.status === status).length;

test("every recovery resident has a trail, even when the usual budget must expand", () => {
  for (const red of [1, 4, 25, 50, 500, 2500, 4999]) {
    const nodes = population({ recovery: red, warned: 5000 - red });
    const sample = sampleResidentTrails(nodes);
    assert.equal(sample.length, Math.max(MAX_DISPLAY_TRAILS, red + 1));
    assert.equal(
      new Set(sample.map((node) => node.id)).size,
      Math.max(MAX_DISPLAY_TRAILS, red + 1),
    );
    assert.ok(
      sample.every((node) => nodes.includes(node)),
      "only real resident records are sampled",
    );
    assert.equal(count(sample, "recovery"), red);
    assert.ok(count(sample, "warned") >= 1);
    if (red <= 25) assert.ok(count(sample, "warned") > red);
  }
});

test("all statuses retain their meaning, and small populations are not duplicated", () => {
  const mixed = population({
    recovery: 1,
    warned: 4000,
    untouched: 997,
    unavailable: 2,
  });
  const sample = sampleResidentTrails(mixed);
  assert.equal(sample.length, MAX_DISPLAY_TRAILS);
  assert.equal(count(sample, "recovery"), 1);
  assert.ok(sample.every((node) => mixed.includes(node)));
  assert.deepEqual(sampleResidentTrails([]), []);
  const small = population({ flagged: 3, no_flagged: 1 });
  assert.equal(sampleResidentTrails(small).length, 4);
  assert.equal(count(sampleResidentTrails(small), "flagged"), 3);
  for (const status of [
    "recovery",
    "warned",
    "untouched",
    "unavailable",
    "flagged",
    "no_flagged",
  ]) {
    assert.equal(
      count(sampleResidentTrails(population({ [status]: 5000 })), status),
      ["recovery", "flagged"].includes(status) ? 5000 : MAX_DISPLAY_TRAILS,
    );
  }
});

test("sample is deterministic, input-order independent, and preserves inspection through status changes", () => {
  const nodes = population({ recovery: 4, warned: 4996 });
  const before = JSON.stringify(nodes);
  const original = sampleResidentTrails(nodes);
  assert.deepEqual(sampleResidentTrails([...nodes].reverse()), original);
  assert.deepEqual(sampleResidentTrails(nodes), original);
  assert.equal(JSON.stringify(nodes), before);
  const selected = nodes.find(
    (node) => !original.includes(node) && node.status === "warned",
  );
  const pinned = sampleResidentTrails(nodes, selected.id);
  assert.equal(pinned.length, MAX_DISPLAY_TRAILS);
  assert.ok(pinned.includes(selected));
  assert.equal(count(pinned, "recovery"), count(original, "recovery"));
  const changed = nodes.map((node) =>
    node.id === selected.id
      ? { ...node, status: "recovery", investigating: true }
      : node,
  );
  const after = sampleResidentTrails(changed, selected.id);
  assert.equal(after.length, MAX_DISPLAY_TRAILS);
  assert.ok(
    after.some(
      (node) =>
        node.id === selected.id &&
        node.status === "recovery" &&
        node.investigating,
    ),
  );
  assert.ok(
    !sampleResidentTrails(
      changed.filter((node) => node.id !== selected.id),
      selected.id,
    ).some((node) => node.id === selected.id),
  );
  assert.equal(
    count(
      sampleResidentTrails(
        nodes.map((node) => ({ ...node, status: "untouched" })),
      ),
      "recovery",
    ),
    0,
  );
});

test("gray-to-green updates retain the same ordinary residents", () => {
  const nodes = population({ untouched: 5000 });
  const ids = (items) => items.map((item) => item.id);
  assert.deepEqual(
    ids(sampleResidentTrails(nodes)),
    ids(
      sampleResidentTrails(
        nodes.map((node) => ({ ...node, status: "warned" })),
      ),
    ),
  );
});
