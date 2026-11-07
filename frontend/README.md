# Patient Zero frontend

Minimal React + TypeScript + Vite + Tailwind UI for Person 4. All displayed data is explicitly mocked. No environment variables or API keys are required.

## Run

Requires Node.js 20.18+ and npm.

```sh
cd frontend
npm ci
npm run dev
npm run build
npm run preview
```

Open the URL printed by Vite. The build type-checks the frontend before producing `dist/`.

## Views and mock behavior

- **Command Center:** resident schematic grid, campaign detection/investigation status, and counts derived from fixture records.
- **Resident Phone:** switch synthetic residents, inspect their inbox and warnings, acknowledge a warning locally.
- **Attacker Console:** load suspicious or benign fixtures and reset. Loading replaces the fixture, including prior acknowledgments. Reset retains residents but clears campaigns, messages, and warnings.

The initial fixture contains four residents, one flagged cluster, three synthetic messages, and two preliminary warnings. Statuses are predetermined UI fixtures, not detector output. No animations, geographic map, live simulation, or Nemotron calls are implemented. State is in memory, resets on reload, and does not synchronize between tabs. Warning creation/acknowledgment is not evidence of delivery, avoided interaction, or protection. No precision, recall, or protection metrics are claimed.

## Expected data contracts and adapter boundary

`src/data/contracts.ts` defines frontend view models only; it does not change the team's shared schema. IDs are strings; timestamps are Unix epoch milliseconds. Collections must contain unique IDs and references must resolve to the corresponding resident or detected cluster.

| Model            | Expected fields                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Resident         | `id`, `persona`, `isSimulated`, `displayName` (spec section 5)                                                                                |
| Campaign         | `clusterId`, `label`, `detectionStatus` (`monitoring` or `flagged`), `investigationStatus` (`not_requested`, `pending`, `complete`, `failed`) |
| Warning          | `id`, `recipientId`, `clusterId`, `severity` (`preliminary` or `elevated`), `warningText`, `createdAt`, `acknowledged` (spec section 5)       |
| SyntheticMessage | `id`, `recipientId`, optional `detectedClusterId`, `senderLabel`, `syntheticText`, `receivedAt`; authorized synthetic inbox view only         |
| Snapshot         | `residents`, `campaigns`, `messages`, `warnings` arrays                                                                                       |

Campaign is a UI projection of backend cluster/detection/investigation state, not a simulation ground-truth campaign ID. The current campaign label is a fixture label; future labels must derive from authorized public evidence. The synthetic inbox model is separate from ordinary message ingestion. Never add plaintext, actual campaign labels, or evaluation ground truth to public detection subscriptions. Preserve 64-bit fingerprints as strings/bigints at integration boundaries, never JavaScript numbers.

`DataAdapter` exposes a stable cached `getSnapshot()`, `subscribe(callback)` returning an unsubscribe function, and asynchronous `acknowledgeWarning(id)`, `loadScenario(scenario)`, and `reset()` operations. Publish a new snapshot reference after changes. Reject failed operations so the UI can show an error. `src/data/index.ts` is the single adapter composition point; components accept an adapter rather than importing fixtures. Scenario loading is a mock convenience; do not assume a similarly named backend reducer exists.

## Integration dependencies and ownership

1. **Person 3:** agree on the SpacetimeDB module address, actual schema, generated TypeScript bindings, native subscription lifecycle, and authorized warning acknowledgment reducer. Implement the live adapter with native subscriptions and validated reducer mutations. Map backend timestamps/statuses to these view models; add connection/loading/error state when integrating.
2. **Person 1 + Person 3:** agree on operator-authorized start/reset operations and simulation scenarios before wiring live attacker controls. Speed controls are deferred. Retain scenario ground truth within the simulator/evaluation boundary.
3. **Person 2 + Person 3:** provide real cluster IDs and detection results. Derive campaign status from these results, never from synthetic scenario labels. Delivery/interaction records are required before showing protection or warning-delivery counts.
4. **Person 4:** replace the composition point and adapt view models to the agreed bindings. Resident selection is mock-only: live sessions must bind to an authorized resident identity, subscribe only to permitted inbox/warnings, and scope command/operator views separately. Client-side filtering or hidden navigation is not access control.
5. **Nemotron:** deferred entirely; a future server-side worker must authenticate, validate responses, and keep keys outside browser code. No frontend environment variable should contain an NVIDIA key.

The current `shared/schema.py` differs from the spec: it includes plaintext and campaign IDs in message records and uses `infected`/`warned` resident booleans. It is intentionally unchanged. Coordinate a privacy-safe backend mapping before connecting; do not subscribe the frontend to those records wholesale.

## Verification

`npm run build` checks TypeScript and the production bundle. No automated test suite existed in the repository at setup. Manual smoke flow: view the initial campaign; select Alex in Resident Phone and acknowledge the warning; switch to Jordan (message, no warning); load the benign fixture (monitoring, no warnings); reset (empty campaigns/inbox, residents retained). Live multi-client synchronization and backend authorization remain integration work.

## Code organization and formatting

`src/App.tsx` owns navigation, adapter subscriptions, and action feedback. The three view components live in `src/views/`; they receive data and callbacks through props. Resident/scenario selections remain in the app so switching views preserves them. Mock records are built in `src/data/mockFixtures.ts`, while `mockAdapter.ts` handles state updates and subscriptions.

Run `npm run format` to format frontend files with Prettier, or `npm run format:check` to check formatting without modifying files.
