import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadTypeScript } from "./loadTypeScript.mjs";

const { createResidentTrips, tripPosition, TRIP_LOOP_SECONDS, TRAIL_SECONDS } =
  await loadTypeScript(new URL("../src/lib/campusTrips.ts", import.meta.url));
const campus = JSON.parse(
  await readFile(
    new URL("../src/assets/utd-campus.json", import.meta.url),
    "utf8",
  ),
);
const { createRoofAnchors, ROOF_CLEARANCE_METERS } = await loadTypeScript(
  new URL("../src/lib/campusAnchors.ts", import.meta.url),
);
const buildings = JSON.parse(
  await readFile(
    new URL("../src/assets/utd-buildings.json", import.meta.url),
    "utf8",
  ),
);
const anchors = createRoofAnchors(campus.anchors, buildings);

test("5000 resident arcs connect distinct campus buildings with bounded altitude and seamless timing", () => {
  const trips = createResidentTrips(
    Array.from({ length: 5000 }, (_, i) => String(i)),
    anchors,
  );
  assert.equal(trips.length, 5000);
  assert.deepEqual(
    trips[0],
    createResidentTrips(["0"], anchors)[0],
    "the same resident keeps identical geometry and timing at any population size",
  );
  assert.equal(new Set(trips.map((trip) => trip.id)).size, 5000);
  const byId = new Map(anchors.map((anchor) => [anchor.id, anchor.position]));
  for (const trip of trips) {
    assert.notEqual(trip.sourceId, trip.targetId);
    assert.ok(byId.has(trip.sourceId) && byId.has(trip.targetId));
    assert.equal(trip.path.length, trip.timestamps.length);
    assert.ok(trip.path.length < 160, "geometry stays bounded per resident");
    assert.ok(trip.timestamps[0] <= -TRAIL_SECONDS);
    assert.ok(trip.timestamps.at(-1) >= TRIP_LOOP_SECONDS);
    assert.ok(
      trip.path.some((point) => point[2] > 50),
      "arcs rise above ground",
    );
    const source = byId.get(trip.sourceId);
    const target = byId.get(trip.targetId);
    assert.deepEqual(trip.path[0], source);
    assert.deepEqual(trip.path.at(-1), source);
    assert.ok(
      trip.path.some((point) =>
        point.every((value, axis) => Math.abs(value - target[axis]) < 1e-10),
      ),
    );
    const axis =
      Math.abs(target[0] - source[0]) > Math.abs(target[1] - source[1]) ? 0 : 1;
    for (let i = 0; i < trip.path.length; i++) {
      const point = trip.path[i];
      assert.ok(point.every(Number.isFinite));
      const fraction =
        (point[axis] - source[axis]) / (target[axis] - source[axis]);
      const roofBaseline = source[2] + (target[2] - source[2]) * fraction;
      assert.ok(
        point[2] >= roofBaseline - 1e-8 && point[2] <= roofBaseline + 280,
      );
      if (Math.abs(fraction) < 1e-8 || Math.abs(fraction - 1) < 1e-8) {
        const endpoint = fraction < 0.5 ? source : target;
        assert.ok(
          point.every((value, axis) => Math.abs(value - endpoint[axis]) < 1e-8),
          "arc endpoints coincide with roof markers",
        );
      }
      if (i > 0) assert.ok(trip.timestamps[i] > trip.timestamps[i - 1]);
      assert.ok(
        Math.abs(Math.fround(trip.timestamps[i]) - trip.timestamps[i]) < 0.0001,
      );
    }
    const start = tripPosition(trip, 0);
    const end = tripPosition(trip, TRIP_LOOP_SECONDS);
    start.forEach((value, axis) =>
      assert.ok(Math.abs(value - end[axis]) < 1e-8),
    );
  }
  for (const time of [0, 150, 300, 599]) {
    const active = trips.filter((trip) => {
      const point = tripPosition(trip, time);
      return [byId.get(trip.sourceId), byId.get(trip.targetId)].every(
        (endpoint) =>
          point.some((value, axis) => Math.abs(value - endpoint[axis]) > 1e-8),
      );
    }).length;
    assert.ok(
      active > 150 && active < 450,
      "staggered arcs avoid rendering the entire population simultaneously",
    );
  }
});

test("arc assignments are stable across population, anchor order, and state changes", () => {
  const before = JSON.stringify(anchors);
  const original = createResidentTrips(["r1", "r2", "r3"], anchors);
  const reordered = createResidentTrips(
    ["r3", "r1", "new"],
    [...anchors].reverse(),
  );
  assert.deepEqual(original[0], reordered[1]);
  assert.deepEqual(original[2], reordered[0]);
  assert.equal(JSON.stringify(anchors), before);
  assert.deepEqual(createResidentTrips([], anchors), []);
  assert.deepEqual(createResidentTrips(["r1"], []), []);
  assert.deepEqual(createResidentTrips(["r1"], anchors.slice(0, 1)), []);
});

test("campus anchors are unique building points inside the campus boundary with no resident fields", () => {
  assert.equal(anchors.length, 64);
  assert.equal(new Set(anchors.map((a) => a.id)).size, 64);
  for (const anchor of anchors) {
    assert.deepEqual(Object.keys(anchor).sort(), ["id", "name", "position"]);
    const [x, y] = anchor.position;
    let inside = false;
    const ring = campus.boundary;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[i],
        [bx, by] = ring[j];
      if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
        inside = !inside;
    }
    assert.ok(inside);
  }
});

test("campus building footprints have valid heights, closed geometry, and cover every anchor", () => {
  assert.equal(buildings.type, "FeatureCollection");
  assert.equal(buildings.features.length, 193);
  const ids = new Set();
  const sources = new Set();
  for (const feature of buildings.features) {
    assert.equal(feature.type, "Feature");
    assert.ok(!ids.has(feature.id));
    ids.add(feature.id);
    assert.equal(feature.geometry.type, "Polygon");
    const ring = feature.geometry.coordinates[0];
    assert.ok(ring.length >= 4);
    assert.deepEqual(ring[0], ring.at(-1));
    assert.ok(
      ring.every((point) => point.length === 2 && point.every(Number.isFinite)),
    );
    const { height, base, heightSource } = feature.properties;
    assert.ok(Number.isFinite(height) && Number.isFinite(base));
    assert.ok(height > base && base >= 0);
    assert.ok(["mapped", "levels", "fallback"].includes(heightSource));
    sources.add(heightSource);
    if (heightSource === "fallback") assert.equal(height, 12);
    assert.deepEqual(Object.keys(feature.properties).sort(), [
      "base",
      "height",
      "heightSource",
    ]);
  }
  assert.equal(sources.size, 3);
  assert.ok(anchors.every((anchor) => ids.has(anchor.id)));
});

test("all campus points sit inside their own roof footprint at its rendered top height", () => {
  const byId = new Map(
    buildings.features.map((building) => [building.id, building]),
  );
  const before = JSON.stringify([campus.anchors, buildings]);
  assert.equal(anchors.length, campus.anchors.length);
  for (const anchor of anchors) {
    const building = byId.get(anchor.id);
    assert.equal(
      anchor.position[2],
      building.properties.height + ROOF_CLEARANCE_METERS,
    );
    let inside = false;
    const [x, y] = anchor.position;
    for (const ring of building.geometry.coordinates) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [ax, ay] = ring[i],
          [bx, by] = ring[j];
        if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
          inside = !inside;
      }
    }
    assert.ok(inside, `anchor ${anchor.id} must sit over its roof`);
  }
  assert.deepEqual(createRoofAnchors(campus.anchors, buildings), anchors);
  assert.equal(JSON.stringify([campus.anchors, buildings]), before);
});

test("rooftop placement handles concave buildings, courtyards, and missing footprints", () => {
  const concave = [
    [0, 0],
    [4, 0],
    [4, 1],
    [1, 1],
    [1, 4],
    [0, 4],
    [0, 0],
  ];
  const outer = [
    [0, 0],
    [6, 0],
    [6, 6],
    [0, 6],
    [0, 0],
  ];
  const courtyard = [
    [2, 2],
    [4, 2],
    [4, 4],
    [2, 4],
    [2, 2],
  ];
  const raw = [
    { id: "L", name: "L", position: [2, 2] },
    { id: "court", name: "court", position: [3, 3] },
    { id: "missing", name: "missing", position: [0, 0] },
  ];
  const roofs = createRoofAnchors(raw, {
    features: [
      {
        id: "L",
        properties: { height: 10 },
        geometry: { coordinates: [concave] },
      },
      {
        id: "court",
        properties: { height: 35 },
        geometry: { coordinates: [outer, courtyard] },
      },
    ],
  });
  assert.equal(roofs.length, 2);
  const [x, y, z] = roofs[0].position;
  assert.ok(x > 0 && x < 4 && y > 0 && y < 4 && (x < 1 || y < 1));
  assert.equal(z, 10 + ROOF_CLEARANCE_METERS);
  const [cx, cy, cz] = roofs[1].position;
  assert.ok(
    cx > 0 &&
      cx < 6 &&
      cy > 0 &&
      cy < 6 &&
      !(cx > 2 && cx < 4 && cy > 2 && cy < 4),
  );
  assert.equal(cz, 35 + ROOF_CLEARANCE_METERS);
});
