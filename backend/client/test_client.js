// Hello-world live sync test: connect, subscribe to `person`, insert a row, see it arrive.
// Run: node test_client.js [name]   (needs the local server + published patient-zero-db)
import { DbConnection } from './module_bindings/index.ts';

const URI = process.env.SPACETIME_URI || 'ws://127.0.0.1:3000';
const DB = process.env.SPACETIME_DB || 'patient-zero-db';
const name = process.argv[2] || `client-${Date.now() % 10000}`;

const timeout = setTimeout(() => {
  console.error('FAIL: no live insert within 10s');
  process.exit(1);
}, 10000);

DbConnection.builder()
  .withUri(URI)
  .withDatabaseName(DB)
  .onConnect((conn, identity) => {
    console.log(`connected to ${DB} as ${identity.toHexString().slice(0, 12)}...`);

    conn.db.person.onInsert((_ctx, row) => {
      console.log(`live insert: ${row.name}`);
      if (row.name === name) {
        console.log('PASS: live sync works');
        clearTimeout(timeout);
        conn.disconnect();
        process.exit(0);
      }
    });

    conn.subscriptionBuilder()
      .onApplied(() => {
        const rows = [...conn.db.person.iter()].map(r => r.name);
        console.log(`initial rows: ${rows.join(', ') || '(none)'}`);
        console.log(`calling add("${name}")`);
        conn.reducers.add({ name });
      })
      .subscribe('SELECT * FROM person');
  })
  .onConnectError((_ctx, err) => {
    console.error('connect error:', err.message);
    process.exit(1);
  })
  .build();
