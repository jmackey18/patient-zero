import { schema, table, t } from 'spacetimedb/server';

const person = table(
  { public: true },
  { name: t.string() }
);

const notification = table(
  { name: 'notification', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    recipient_id: t.u32(),
    kind: t.string(),        // "recovery" or "alert"
    text: t.string(),
  }
);

const resident = table(
  { name: 'resident', public: true },
  {
    id: t.u32().primaryKey(),
    persona: t.string(),
    exposed: t.bool(),
    warned: t.bool(),
    opened: t.bool(),
  }
);

const residentProfile = table(
  { name: 'resident_profile', public: true },
  {
    resident_id: t.u32().primaryKey(),
    name: t.string(),
    age: t.u8(),
    district: t.string(),
    x: t.f32(),
    y: t.f32(),
    weak_spot: t.string(),
    susceptibility: t.f32(),
    open_delay_s: t.u16(),
  }
);

const message = table(
  { name: 'message', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    sender_id: t.u64(),
    sender_known: t.bool(),
    recipient_id: t.u32(),
    text: t.string(),
    timestamp: t.timestamp(),
    campaign_id: t.string(),
  }
);

/**
 * Nemotron's investigation of a detected campaign, written by detection/live_detect.py.
 * One row per campaign; the frontend subscribes to show the verdict live.
 * status: "investigating" (Nemotron running) | "complete" (verdict in) | "failed" (Nemotron unavailable)
 */
const incident = table(
  { name: 'incident', public: true },
  {
    campaign_id: t.string().primaryKey(),
    status: t.string(),
    is_coordinated: t.bool(),
    confidence: t.u8(),           // 0-100
    reasoning: t.string(),
    warning_text: t.string(),
    num_variants: t.u32(),        // fingerprint clusters Nemotron linked together
    cluster_meta: t.string(),     // JSON array of cluster metadata (no message text)
    time_spread_s: t.f32().default(0), // seconds from first to last exposed message at detection
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

/** Attack scenarios the Simulate button can launch. Registered by simulation/sim_runner.py from scenarios.json. */
const scenario = table(
  { name: 'scenario', public: true },
  {
    id: t.string().primaryKey(),
    label: t.string(),
    description: t.string(),
  }
);

/**
 * One Simulate-button press. The frontend inserts it ("requested"); sim_runner.py runs the attacker
 * ("running") and finishes it ("done" / "aborted"). Its id becomes the campaign_id ("run-<id>").
 */
const simRun = table(
  { name: 'sim_run', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    scenario_id: t.string(),
    status: t.string(),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

/** Terminal output from the attacker and detector, streamed to the frontend. */
const pipelineLog = table(
  { name: 'pipeline_log', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    source: t.string(),      // "attacker" | "detector"
    line: t.string(),
    at: t.timestamp(),
  }
);

const spacetimedb = schema({
  person, resident, residentProfile, message, notification, incident, scenario, simRun, pipelineLog,
});
export default spacetimedb;

const SeedRow = t.object('SeedRow', {
  id: t.u32(),
  persona: t.string(),
  exposed: t.bool(),
  warned: t.bool(),
  opened: t.bool(),
  name: t.string(),
  age: t.u8(),
  district: t.string(),
  x: t.f32(),
  y: t.f32(),
  weak_spot: t.string(),
  susceptibility: t.f32(),
  open_delay_s: t.u16(),
});

export const init = spacetimedb.init(_ctx => {});
export const onConnect = spacetimedb.clientConnected(_ctx => {});
export const onDisconnect = spacetimedb.clientDisconnected(_ctx => {});

export const add = spacetimedb.reducer(
  { name: t.string() },
  (ctx, { name }) => {
    ctx.db.person.insert({ name });
  }
);

export const sayHello = spacetimedb.reducer(ctx => {
  for (const person of ctx.db.person.iter()) {
    console.info(`Hello, ${person.name}!`);
  }
  console.info('Hello, World!');
});

export const seedResidentsBatch = spacetimedb.reducer(
  { rows: t.array(SeedRow) },
  (ctx, { rows }) => {
    for (const r of rows) {
      ctx.db.resident.insert({
        id: r.id,
        persona: r.persona,
        exposed: r.exposed,
        warned: r.warned,
        opened: r.opened,
      });
      ctx.db.residentProfile.insert({
        resident_id: r.id,
        name: r.name,
        age: r.age,
        district: r.district,
        x: r.x,
        y: r.y,
        weak_spot: r.weak_spot,
        susceptibility: r.susceptibility,
        open_delay_s: r.open_delay_s,
      });
    }
    console.info(`seeded ${rows.length} residents`);
  }
);

export const clearResidents = spacetimedb.reducer(ctx => {
  let n = 0;
  for (const r of [...ctx.db.resident.iter()]) {
    ctx.db.resident.id.delete(r.id);
    n++;
  }
  for (const p of [...ctx.db.residentProfile.iter()]) {
    ctx.db.residentProfile.resident_id.delete(p.resident_id);
  }
  console.info(`cleared ${n} residents`);
});

export const startCampaign = spacetimedb.reducer(
  { scam_text: t.string(), num_targets: t.u32() },
  (ctx, { scam_text, num_targets }) => {
    // Each Simulate run gets its own campaign id so the detector flags every run.
    const run = activeRun(ctx);
    const campaign_id = run ? `run-${run.id}` : "c1";
    const unexposed = [...ctx.db.resident.iter()].filter(r => !r.exposed);
    const targets = unexposed.slice(0, num_targets);
    for (const r of targets) {
      ctx.db.message.insert({
        id: 0n,
        sender_id: 999n,
        sender_known: false,
        recipient_id: r.id,
        text: scam_text,
        timestamp: ctx.timestamp,
        campaign_id,
      });
      ctx.db.resident.id.update({ ...r, exposed: true });
    }
    console.info(`blasted ${targets.length}`);
  }
);

export const flagCampaign = spacetimedb.reducer(
  {},
  (ctx) => {
    for (const r of [...ctx.db.resident.iter()]) {
      if (r.exposed) {
        // the 6 who got hit → recovery notif
        ctx.db.notification.insert({
          id: 0n, recipient_id: r.id, kind: "recovery",
          text: "⚠️ You received a scam. Do not click. If you did: freeze your card, change passwords, report to your carrier.",
        });
      } else if (!r.warned) {
        // everyone else → preemptive alert + mark warned
        ctx.db.notification.insert({
          id: 0n, recipient_id: r.id, kind: "alert",
          text: "🛡️ Scam Shield: A scam campaign is active. Don't click links in unexpected texts asking you to pay or verify.",
        });
        ctx.db.resident.id.update({ ...r, warned: true });
      }
    }
    console.info(`notifications dispatched`);
  }
);

/**
 * Upserts Nemotron's output for a campaign. Call once with status "investigating"
 * (so the UI can show the investigation starting), then again with "complete" or "failed".
 */
export const reportIncident = spacetimedb.reducer(
  {
    campaign_id: t.string(),
    status: t.string(),
    is_coordinated: t.bool(),
    confidence: t.u8(),
    reasoning: t.string(),
    warning_text: t.string(),
    num_variants: t.u32(),
    cluster_meta: t.string(),
    time_spread_s: t.f32(),
  },
  (ctx, args) => {
    const existing = ctx.db.incident.campaign_id.find(args.campaign_id);
    if (existing) {
      ctx.db.incident.campaign_id.update({ ...existing, ...args, updated_at: ctx.timestamp });
    } else {
      ctx.db.incident.insert({ ...args, created_at: ctx.timestamp, updated_at: ctx.timestamp });
    }
    console.info(`incident ${args.campaign_id}: ${args.status} (${args.confidence}%)`);
  }
);

/** Clears incidents (for resetting between demo runs). */
export const clearIncidents = spacetimedb.reducer(ctx => {
  for (const i of [...ctx.db.incident.iter()]) ctx.db.incident.campaign_id.delete(i.campaign_id);
});

// ---------- Simulate button ----------

const ACTIVE = new Set(['requested', 'running']);
/** sim_run.scenario_id used for Reset-button runs. */
const RESET = 'reset';

/** Newest run that is requested or running, if any. */
function activeRun(ctx: any) {
  let latest: any = undefined;
  for (const r of ctx.db.simRun.iter()) {
    if (ACTIVE.has(r.status) && (!latest || r.id > latest.id)) latest = r;
  }
  return latest;
}

/** Upserts a scenario (sim_runner.py calls this on startup for each entry in scenarios.json). */
export const registerScenario = spacetimedb.reducer(
  { id: t.string(), label: t.string(), description: t.string() },
  (ctx, row) => {
    if (ctx.db.scenario.id.find(row.id)) ctx.db.scenario.id.update(row);
    else ctx.db.scenario.insert(row);
  }
);

/**
 * Simulate button: wipes the previous run (messages, notifications, incidents, logs, resident flags)
 * and queues a new run for sim_runner.py. Rejected while another run is still active.
 */
export const requestSimulation = spacetimedb.reducer(
  { scenario_id: t.string() },
  (ctx, { scenario_id }) => {
    if (!ctx.db.scenario.id.find(scenario_id)) throw new Error(`Unknown scenario: ${scenario_id}`);
    if (activeRun(ctx)) throw new Error('A simulation or reset is already running.');
    clearRunState(ctx);
    for (const r of [...ctx.db.resident.iter()]) {
      if (r.exposed || r.warned || r.opened) {
        ctx.db.resident.id.update({ ...r, exposed: false, warned: false, opened: false });
      }
    }
    const run = ctx.db.simRun.insert({
      id: 0n, scenario_id, status: 'requested', created_at: ctx.timestamp, updated_at: ctx.timestamp,
    });
    console.info(`simulation ${run.id} requested: ${scenario_id}`);
  }
);

/** Clears everything a run leaves behind (messages, notifications, incidents, terminal log). */
function clearRunState(ctx: any) {
  for (const m of [...ctx.db.message.iter()]) ctx.db.message.id.delete(m.id);
  for (const n of [...ctx.db.notification.iter()]) ctx.db.notification.id.delete(n.id);
  for (const i of [...ctx.db.incident.iter()]) ctx.db.incident.campaign_id.delete(i.campaign_id);
  for (const l of [...ctx.db.pipelineLog.iter()]) ctx.db.pipelineLog.id.delete(l.id);
}

/**
 * Reset button: same as the README reset (DELETE FROM message, clear_incidents, clear_residents + seed).
 * Clears run state here, then queues a "reset" run; sim_runner.py does clear_residents + reseed.
 */
export const requestReset = spacetimedb.reducer(ctx => {
  if (activeRun(ctx)) throw new Error('A simulation or reset is already running.');
  clearRunState(ctx);
  ctx.db.simRun.insert({
    id: 0n, scenario_id: RESET, status: 'requested', created_at: ctx.timestamp, updated_at: ctx.timestamp,
  });
  console.info('reset requested');
});

/** sim_runner.py moves a run through running -> done (or aborted). */
export const updateSimRun = spacetimedb.reducer(
  { id: t.u64(), status: t.string() },
  (ctx, { id, status }) => {
    const run = ctx.db.simRun.id.find(id);
    if (!run) throw new Error(`No sim_run ${id}`);
    ctx.db.simRun.id.update({ ...run, status, updated_at: ctx.timestamp });
  }
);

/** One line of attacker/detector terminal output for the frontend. */
export const logLine = spacetimedb.reducer(
  { source: t.string(), line: t.string() },
  (ctx, { source, line }) => {
    ctx.db.pipelineLog.insert({ id: 0n, source, line, at: ctx.timestamp });
  }
);
