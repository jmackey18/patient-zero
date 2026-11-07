import { schema, table, t } from 'spacetimedb/server';

// --- Hello-world (kept until the real tables are proven) ---
const person = table(
  { public: true },
  {
    name: t.string(),
  }
);

// --- Avon residents (MVP v2) ---
// Locked shared schema: {id, persona, exposed, warned, opened}. Do not add fields here.
const resident = table(
  { name: 'resident', public: true },
  {
    id: t.u32().primaryKey(),
    persona: t.string(), // grandparent | student | small-biz
    exposed: t.bool(),   // received the campaign message
    warned: t.bool(),    // got a Scam Shield warning
    opened: t.bool(),    // opened/tapped the scam
  }
);

// Extra per-person details for the map and spread logic, kept apart from the locked schema.
const residentProfile = table(
  { name: 'resident_profile', public: true },
  {
    resident_id: t.u32().primaryKey(),
    name: t.string(),
    age: t.u8(),
    district: t.string(),
    x: t.f32(), // map position, 0..1
    y: t.f32(),
    weak_spot: t.string(),      // scam type they're most likely to fall for
    susceptibility: t.f32(),    // 0..1
    open_delay_s: t.u16(),      // seconds before they typically open a text
  }
);

const spacetimedb = schema({ person, resident, residentProfile });
export default spacetimedb;

// One flat row per resident: resident fields + profile fields (what residents.json holds).
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

export const init = spacetimedb.init(_ctx => {
  // Called when the module is initially published
});

export const onConnect = spacetimedb.clientConnected(_ctx => {
  // Called every time a new client connects
});

export const onDisconnect = spacetimedb.clientDisconnected(_ctx => {
  // Called every time a client disconnects
});

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

// Insert a batch of residents (called by simulation/seed_spacetime.py, 500 at a time).
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

// Delete every resident and profile so the city can be reseeded.
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
