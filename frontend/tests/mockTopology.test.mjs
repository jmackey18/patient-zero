import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScript } from "./loadTypeScript.mjs";

const { mockForwardingLinks } = await loadTypeScript(
  new URL("../src/data/mockTopology.ts", import.meta.url),
);

test("all 5000 mock residents remain connected without geography or input mutation", () => {
  const ids = Array.from({ length: 5000 }, (_, index) => `r${index + 1}`);
  const before = [...ids];
  const links = mockForwardingLinks(ids);
  assert.equal(links.length, ids.length - 1);
  const neighbors = new Map(ids.map((id) => [id, []]));
  const pairs = new Set();
  for (const { sourceId, targetId } of links) {
    assert.notEqual(sourceId, targetId);
    assert.ok(neighbors.has(sourceId) && neighbors.has(targetId));
    const pair = [sourceId, targetId].sort().join(":");
    assert.ok(!pairs.has(pair));
    pairs.add(pair);
    neighbors.get(sourceId).push(targetId);
    neighbors.get(targetId).push(sourceId);
  }
  const seen = new Set();
  const pending = [ids[0]];
  while (pending.length) {
    const id = pending.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    pending.push(
      ...neighbors.get(id).filter((neighbor) => !seen.has(neighbor)),
    );
  }
  assert.equal(seen.size, ids.length);
  assert.deepEqual(ids, before);
  assert.deepEqual(mockForwardingLinks([...ids].reverse()), links);
});

test("mock contacts handle empty, singleton, and repeated IDs without self-links", () => {
  assert.deepEqual(mockForwardingLinks([]), []);
  assert.deepEqual(mockForwardingLinks(["only"]), []);
  assert.deepEqual(mockForwardingLinks(["only", "only"]), []);
  assert.deepEqual(
    mockForwardingLinks(["a", "b", "a"]),
    mockForwardingLinks(["a", "b"]),
  );
});
