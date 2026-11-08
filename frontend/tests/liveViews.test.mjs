import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { BinaryReader, BinaryWriter } from "spacetimedb";

let server;
let LiveInvestigation, LiveNotifications, CommandCenter;
before(async () => {
  // Vite transforms the real TSX components without starting an HTTP/WebSocket server.
  server = await createServer({
    root: fileURLToPath(new URL("..", import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    // SSR-only tests do not need a browser dependency scan racing server teardown.
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: "custom",
  });
  ({ LiveInvestigation } = await server.ssrLoadModule(
    "/src/components/LiveInvestigation.tsx",
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
    render(LiveInvestigation, { data: snapshot({ liveFeed: undefined }) }),
    /unavailable until/,
  );
  assert.match(
    render(LiveInvestigation, { data: snapshot() }),
    /No investigations reported yet/,
  );
  for (const status of ["investigating", "complete", "failed", "unexpected"]) {
    const report = { ...incident, status };
    const html = render(LiveInvestigation, {
      data: snapshot({
        liveFeed: {
          incidents: [report],
          latestIncident: report,
          notifications: [],
        },
      }),
    });
    assert.match(html, /&lt;script&gt;untrusted&lt;\/script&gt;/);
    if (status === "complete") {
      assert.match(html, /91%/);
      assert.match(html, /Review this warning/);
    } else {
      assert.doesNotMatch(html, /91%|Review this warning/);
    }
    if (status === "failed") assert.match(html, /Investigation unavailable/);
    if (status === "unexpected") assert.match(html, /Unknown status/);
  }
});

test("notifications are bounded and safely rendered without removed phone controls", () => {
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
  assert.equal((log.match(/<li /g) ?? []).length, 100);
  assert.match(log, /Recovery guidance/);
  assert.match(log, /&lt;script&gt;Recovery guidance&lt;\/script&gt;/);
  assert.match(log, /Resident 5000/);
  assert.doesNotMatch(log, /<script>|phone|Acknowledge warning/);
});

test("command center preserves live and mock records without removed pages", () => {
  const data = snapshot();
  const html = render(CommandCenter, {
    data,
    selectedId: "1",
    onSelect() {},
  });
  assert.match(html, /Exposed · backend state/);
  assert.match(html, /Nemotron investigation/);
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
    selectedId: "1",
    onSelect() {},
  });
  assert.match(mockDashboard, /Messages in fixture/);
  assert.match(mockDashboard, /Warning log/);
  assert.match(mockDashboard, /Created · not acknowledged/);
  for (const dashboard of [html, mockDashboard]) {
    assert.doesNotMatch(
      dashboard,
      /Resident Phone|Attacker Console|Colors reflect backend simulation flags/,
    );
    assert.match(dashboard, /Selected resident details/);
  }
});
