import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScript } from "./loadTypeScript.mjs";
const { advanceTrailColors, hasPendingTrailColors, GREEN_BATCH_SIZE } =
  await loadTypeScript(
    new URL("../src/components/campus/trailColorQueue.ts", import.meta.url),
  );
const targets = (status) =>
  Array.from({ length: 120 }, (_, i) => ({ id: String(i), status }));

test("gray-to-green presentation advances six residents at a time and completes", () => {
  let shown = advanceTrailColors(new Map(), targets("untouched"), Infinity);
  const wanted = targets("warned");
  assert.equal(advanceTrailColors(shown, wanted, 0), shown);
  for (let batch = 1; batch <= 20; batch++) {
    shown = advanceTrailColors(shown, wanted, GREEN_BATCH_SIZE);
    assert.equal(
      [...shown.values()].filter((s) => s === "warned").length,
      batch * 6,
    );
  }
  assert.equal(hasPendingTrailColors(shown, wanted), false);
  assert.equal(advanceTrailColors(shown, wanted, 6), shown);
});

test("red updates and resets override pending green; removed residents are pruned", () => {
  const gray = advanceTrailColors(new Map(), targets("untouched"), Infinity);
  const pending = advanceTrailColors(gray, targets("warned"), 6);
  const wanted = targets("warned");
  wanted[20].status = "recovery";
  wanted[0].status = "untouched";
  const shown = advanceTrailColors(pending, wanted, 0);
  assert.equal(shown.get("20"), "recovery");
  assert.equal(shown.get("0"), "untouched");
  assert.equal(pending.get("20"), "untouched");
  const reset = advanceTrailColors(shown, targets("untouched"), 0);
  assert.equal(hasPendingTrailColors(reset, targets("untouched")), false);
  assert.equal(advanceTrailColors(reset, [], 6).size, 0);
});

test("initial hydration and reduced-motion updates show actual state immediately", () => {
  const actual = targets("warned");
  const initial = advanceTrailColors(new Map(), actual, 0);
  assert.equal(hasPendingTrailColors(initial, actual), false);
  const gray = advanceTrailColors(initial, targets("untouched"), 0);
  assert.equal(
    hasPendingTrailColors(advanceTrailColors(gray, actual, Infinity), actual),
    false,
  );
});
