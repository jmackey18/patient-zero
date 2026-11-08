import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { BinaryReader, BinaryWriter } from "spacetimedb";

let server;
let SimulatePanel, LiveNotifications, CommandCenter, ResidentPhoneOverlay;
before(async () => {
  // Vite transforms the real TSX components without starting an HTTP/WebSocket server.
  server = await createServer({
    root: fileURLToPath(new URL("..", import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    // SSR-only tests do not need a browser dependency scan racing server teardown.
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: "custom",
  });
  ({ ResidentPhoneOverlay } = await server.ssrLoadModule(
    "/src/components/campus/ResidentPhoneOverlay.tsx",
  ));
  ({ SimulatePanel } = await server.ssrLoadModule(
    "/src/components/live/SimulatePanel.tsx",
  ));
  ({ LiveNotifications } = await server.ssrLoadModule(
    "/src/components/LiveNotifications.tsx",
  ));
  ({ CommandCenter } = await server.ssrLoadModule(
    "/src/views/CommandCenter.tsx",
  ));
});
after(async () => {
  await server?.close();
});

const resident = {
  id: "1",
  displayName: "Test resident",
  persona: "Student",
  isSimulated: true,
  liveState: { exposed: true, warned: false },
};
const incident = {
  campaignId: "c1",
  status: "investigating",
  isCoordinated: true,
  confidence: 91,
  numVariants: 2,
  reasoning: "<script>untrusted</script>",
  warningText: "Review this warning",
  clusterMeta: [],
  timeSpreadS: 12.5,
  createdAt: 1,
  updatedAt: 2,
};
const snapshot = (patch = {}) => ({
  residents: [resident],
  campaigns: [],
  messages: [],
  warnings: [],
  connection: { state: "live" },
  liveFeed: {
    scenarios: [],
    incidents: [],
    notifications: [],
    alertCount: 0,
    recoveryCount: 0,
  },
  ...patch,
});
const render = (component, props) =>
  renderToStaticMarkup(createElement(component, props));

test("incident binding decodes consecutive deployed rows including time_spread_s", async () => {
  const { default: IncidentRow } = await server.ssrLoadModule(
    "/src/module_bindings/incident_table.ts",
  );
  const writer = new BinaryWriter(256);
  // The deployed wire order includes an f32 before the two timestamps.
  for (const id of ["first", "second"]) {
    writer.writeString(id);
    writer.writeString("complete");
    writer.writeBool(true);
    writer.writeU8(91);
    writer.writeString("Synthetic assessment");
    writer.writeString("Check the sender");
    writer.writeU32(2);
    writer.writeString("[]");
    writer.writeF32(12.5);
    writer.writeI64(1000000n);
    writer.writeI64(2000000n);
  }
  const reader = new BinaryReader(writer.getBuffer());
  for (const id of ["first", "second"]) {
    const row = IncidentRow.deserialize(reader);
    assert.equal(row.campaignId, id);
    assert.equal(row.timeSpreadS, 12.5);
    assert.equal(row.createdAt.microsSinceUnixEpoch, 1000000n);
    assert.equal(row.updatedAt.microsSinceUnixEpoch, 2000000n);
  }
  assert.equal(reader.remaining, 0);
});

test("investigation states distinguish unavailable, empty, pending, completed, and failed reports", () => {
  assert.match(
    render(SimulatePanel, { data: snapshot({ liveFeed: undefined }) }),
    /unavailable until/,
  );
  assert.match(
    render(SimulatePanel, { data: snapshot() }),
    /No campaign detected yet/,
  );
  for (const status of ["investigating", "complete", "failed", "unexpected"]) {
    const report = { ...incident, status };
    const html = render(SimulatePanel, {
      data: snapshot({
        liveFeed: {
          scenarios: [],
          incidents: [report],
          latestIncident: report,
          notifications: [],
        },
      }),
    });
    if (status !== "investigating")
      assert.match(html, /&lt;script&gt;untrusted&lt;\/script&gt;/);
    if (status === "complete") {
      assert.match(html, /91%/);
      assert.match(html, /Review this warning/);
    } else {
      assert.doesNotMatch(html, /91%|Review this warning/);
    }
    if (status === "failed") assert.match(html, /Investigation unavailable/);
    if (status === "unexpected")
      assert.match(html, /Unknown investigation status/);
  }
});

/** Check both permanent phone regions and their independently derived sleep/wake states. */
function assertPhoneStates(html, awake, asleep) {
  assert.match(html, /aria-label="Preemptive alert phone"/);
  assert.match(html, /aria-label="Recovery guidance phone"/);
  assert.equal((html.match(/role="region"/g) ?? []).length, 2);
  assert.equal((html.match(/data-state="awake"/g) ?? []).length, awake);
  assert.equal((html.match(/data-state="asleep"/g) ?? []).length, asleep);
}

test("both notification phones start inactive for empty or unavailable feeds", () => {
  for (const data of [snapshot(), snapshot({ liveFeed: undefined })]) {
    const html = render(LiveNotifications, { data });
    assertPhoneStates(html, 0, 2);
    assert.equal((html.match(/Awaiting notifications/g) ?? []).length, 2);
    assert.doesNotMatch(html, /Acknowledge warning/);
  }
  assert.match(
    render(LiveNotifications, { data: snapshot({ liveFeed: undefined }) }),
    /Notification feed unavailable until the live subscription syncs/,
  );
});

test("each notification type wakes only its own phone and renders the recipient name safely", () => {
  for (const kind of ["alert", "recovery"]) {
    const html = render(LiveNotifications, {
      data: snapshot({
        residents: [{ ...resident, displayName: "Alex <script>name</script>" }],
        liveFeed: {
          ...snapshot().liveFeed,
          notifications: [
            {
              id: "1",
              recipientId: "1",
              kind,
              text: "Check the sender before acting.",
            },
          ],
        },
      }),
    });
    assertPhoneStates(html, 1, 1);
    assert.match(html, /Alex &lt;script&gt;name&lt;\/script&gt;/);
    assert.match(html, /Check the sender before acting\./);
    assert.equal((html.match(/Awaiting notifications/g) ?? []).length, 1);
    assert.doesNotMatch(html, /<script>|Resident 1/);
  }
});

test("notification stack counts records rather than unique recipients", () => {
  const html = render(LiveNotifications, {
    data: snapshot({
      liveFeed: {
        ...snapshot().liveFeed,
        notifications: [
          { id: "1", recipientId: "1", kind: "alert", text: "Earlier alert" },
          { id: "2", recipientId: "1", kind: "alert", text: "Latest alert" },
        ],
      },
    }),
  });
  assertPhoneStates(html, 1, 1);
  assert.match(html.replace(/<[^>]*>/g, ""), /2 notifications/);
  assert.match(html, /Latest alert/);
  assert.doesNotMatch(html, /Earlier alert/);
});

test("notification phones bound large feeds to the newest record per type and escape their text", () => {
  const notifications = Array.from({ length: 5000 }, (_, i) => ({
    id: String(i),
    recipientId: String(i + 1),
    kind: i === 4999 ? "recovery" : "alert",
    text: i === 4999 ? "<script>Recovery guidance</script>" : `Alert ${i}`,
  }));
  const data = snapshot({
    liveFeed: {
      incidents: [],
      notifications,
      alertCount: 4999,
      recoveryCount: 1,
    },
  });
  const log = render(LiveNotifications, { data });
  assertPhoneStates(log, 2, 0);
  assert.match(log.replace(/<[^>]*>/g, ""), /4,999 notifications/);
  assert.ok(
    log.length < 20000,
    "thousands of records must not become thousands of DOM nodes",
  );
  assert.match(log, /Alert 4998/);
  assert.doesNotMatch(log, /Alert 4997/);
  assert.match(log, /Recovery guidance/);
  assert.match(log, /&lt;script&gt;Recovery guidance&lt;\/script&gt;/);
  assert.match(log, /Resident 5000/);
  assert.doesNotMatch(log, /<script>|Acknowledge warning/);
});

test("command center preserves live and mock records without removed pages", () => {
  const data = snapshot();
  const html = render(CommandCenter, {
    data,
  });
  assert.match(html, /Live notifications/);
  assert.doesNotMatch(
    html,
    /Nemotron is not integrated|Messages in fixture|No campaigns loaded/,
  );
  const mock = snapshot({
    connection: undefined,
    liveFeed: undefined,
    messages: [
      {
        id: "m1",
        recipientId: "1",
        senderLabel: "Demo sender",
        syntheticText: "Synthetic sample",
      },
    ],
    warnings: [
      {
        id: "w1",
        recipientId: "1",
        severity: "preliminary",
        warningText: "Demo warning",
        acknowledged: false,
      },
    ],
  });
  const mockDashboard = render(CommandCenter, {
    data: mock,
  });
  assert.match(mockDashboard, /Warning log/);
  assert.match(mockDashboard, /Created · not acknowledged/);
  for (const dashboard of [html, mockDashboard]) {
    assert.doesNotMatch(
      dashboard,
      /Resident Phone|Attacker Console|Colors reflect backend simulation flags/,
    );
    assert.doesNotMatch(
      dashboard,
      /Selected resident details|Trail legend|Nemotron investigation|Fixture counts|Live simulation counts|Building points and arcs are illustrative/,
    );
  }
});

test("notification types update independently, including a type older than the last 100 rows", () => {
  const notifications = [
    { id: "1", recipientId: "1", kind: "recovery", text: "Older recovery" },
    ...Array.from({ length: 150 }, (_, i) => ({
      id: String(i + 2),
      recipientId: "1",
      kind: "alert",
      text: `Alert sequence ${i}`,
    })),
  ];
  const feed = snapshot().liveFeed;
  const before = JSON.stringify(notifications);
  const renderLog = (rows) =>
    render(LiveNotifications, {
      data: snapshot({ liveFeed: { ...feed, notifications: rows } }),
    });
  const first = renderLog(notifications);
  assertPhoneStates(first, 2, 0);
  assert.match(first, /Older recovery/);
  assert.match(first, /Alert sequence 149/);
  const updated = renderLog([
    ...notifications,
    { id: "152", recipientId: "1", kind: "recovery", text: "New recovery" },
  ]);
  assert.match(updated, /New recovery/);
  assert.doesNotMatch(updated, /Older recovery/);
  assert.match(updated, /Alert sequence 149/);
  assert.equal(JSON.stringify(notifications), before);
  assertPhoneStates(renderLog(notifications.slice(1)), 1, 1);
  const reset = renderLog([]);
  assertPhoneStates(reset, 0, 2);
  assert.equal((reset.match(/Awaiting notifications/g) ?? []).length, 2);
  assert.doesNotMatch(reset, /Older recovery|New recovery|Alert sequence/);
});

test("phone inspector uses the actual profile name and current status with safe text", () => {
  const props = {
    resident: {
      ...resident,
      displayName: "Alex <script>test</script>",
      status: "recovery",
      investigating: true,
    },
    onClose() {},
    reducedMotion: false,
  };
  const html = render(ResidentPhoneOverlay, props);
  assert.match(html, /Alex &lt;script&gt;test&lt;\/script&gt;/);
  assert.match(html, /Status: Recovery guidance/);
  assert.match(html, /Student/);
  assert.match(html, /Campaign investigation in progress/);
  assert.match(html, /Close resident details/);
  assert.equal(render(ResidentPhoneOverlay, { ...props, resident: null }), "");
});
