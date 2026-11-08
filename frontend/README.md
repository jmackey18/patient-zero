# Patient Zero frontend

Minimal React + TypeScript + Vite + Tailwind UI for Person 4. Supports local mock fixtures and live synthetic resident subscriptions. Mock development needs no environment variables; live mode uses the public connection settings below. No API keys belong in the frontend.

## Run

Use a Node.js version supported by the SpacetimeDB SDK: `^22.23.4 || ^24.22.1 || >=26.12.1`, plus npm. Node 20 is outside the SDK’s declared support range.

```sh
cd frontend
npm ci
npm run dev
npm run build
npm run preview
```

Open the URL printed by Vite. The build type-checks the frontend before producing `dist/`.

## Views and mock behavior

- **Command Center:** clickable resident visualization, campaign detection/investigation status, and counts derived from fixture records.
- **Resident Phone:** switch synthetic residents, inspect their inbox and warnings, acknowledge a warning locally.
- **Attacker Console:** load suspicious or benign fixtures and reset. Loading replaces the fixture, including prior acknowledgments. Reset retains residents but clears campaigns, messages, and warnings.

In mock mode, the initial fixture contains four residents, one flagged cluster, three synthetic messages, and two preliminary warnings. Statuses are predetermined UI fixtures, not detector output. The separate timed mock described below creates 5,000 residents and scripted propagation. No live backend simulation or Nemotron calls are implemented. State is in memory, resets on reload, and does not synchronize between tabs. Warning creation/acknowledgment is not evidence of delivery, avoided interaction, or protection. No precision, recall, or protection metrics are claimed.

## Expected data contracts and adapter boundary

`src/data/contracts.ts` defines frontend view models only; it does not change the team's shared schema. IDs are strings; timestamps are Unix epoch milliseconds. Collections must contain unique IDs and references must resolve to the corresponding resident or detected cluster.

| Model            | Expected fields                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Resident         | `id`, `persona`, `isSimulated`, `displayName`, optional `profile` (`district`, `x`, `y`, `weakSpot`)                                          |
| Campaign         | `clusterId`, `label`, `detectionStatus` (`monitoring` or `flagged`), `investigationStatus` (`not_requested`, `pending`, `complete`, `failed`) |
| Warning          | `id`, `recipientId`, `clusterId`, `severity` (`preliminary` or `elevated`), `warningText`, `createdAt`, `acknowledged` (spec section 5)       |
| SyntheticMessage | `id`, `recipientId`, optional `detectedClusterId`, `senderLabel`, `syntheticText`, `receivedAt`; authorized synthetic inbox view only         |
| Snapshot         | `residents`, `campaigns`, `messages`, `warnings` arrays; optional `connection` status; mock-only `mockSimulation` and `mockPropagation`       |

Campaign is a UI projection of backend cluster/detection/investigation state, not a simulation ground-truth campaign ID. The current campaign label is a fixture label; future labels must derive from authorized public evidence. The synthetic inbox model is separate from ordinary message ingestion. Never add plaintext, actual campaign labels, or evaluation ground truth to public detection subscriptions. Preserve 64-bit fingerprints as strings/bigints at integration boundaries, never JavaScript numbers.

`DataAdapter` exposes a stable cached `getSnapshot()`, `subscribe(callback)` returning an unsubscribe function, and asynchronous `acknowledgeWarning(id)`, `loadScenario(scenario)`, and `reset()` operations. Publish a new snapshot reference after changes. Reject failed operations so the UI can show an error. `src/data/index.ts` is the single adapter composition point; components accept an adapter rather than importing fixtures. Scenario loading is a mock convenience; do not assume a similarly named backend reducer exists.

## Integration dependencies and ownership

1. **Person 3:** resident tables, generated bindings, native subscriptions, and connection status are now integrated. Campaign/message/warning tables and authorized warning acknowledgment reducers remain integration work.
2. **Person 1 + Person 3:** agree on operator-authorized start/reset operations and simulation scenarios before wiring live attacker controls. Speed controls are deferred. Retain scenario ground truth within the simulator/evaluation boundary.
3. **Person 2 + Person 3:** provide real cluster IDs and detection results. Derive campaign status from these results, never from synthetic scenario labels. Delivery/interaction records are required before showing protection or warning-delivery counts.
4. **Person 4:** extend the existing live adapter as the remaining tables become available. The resident selector is a synthetic demo control: future private resident sessions must bind to an authorized resident identity, subscribe only to permitted inbox/warnings, and scope command/operator views separately. Client-side filtering or hidden navigation is not access control.
5. **Nemotron:** deferred entirely; a future server-side worker must authenticate, validate responses, and keep keys outside browser code. No frontend environment variable should contain an NVIDIA key.

The current `shared/schema.py` differs from the spec: it includes plaintext and campaign IDs in message records and uses `exposed`/`warned`/`opened` resident booleans. Plaintext is documented as simulation-only; these records must not become public detection inputs. Coordinate a privacy-safe backend mapping before connecting; do not subscribe the frontend to those records wholesale.

## Verification

`npm run test` checks mock propagation, resident states, investigation phases, and adapter lifecycle. `npm run build` checks TypeScript (including unused locals/parameters) and the production bundle. Manual smoke flow: view the initial campaign; select Alex in Resident Phone and acknowledge the warning; switch to Jordan (message, no warning); load the benign fixture (monitoring, no warnings); reset (empty campaigns/inbox, residents retained). Live multi-client synchronization and backend authorization remain integration work.

## Code organization and formatting

`src/App.tsx` owns navigation, adapter subscriptions, and action feedback. The three view components live in `src/views/`; they receive data and callbacks through props. Resident/scenario selections remain in the app so switching views preserves them. Small static fixtures live in `src/data/mockFixtures.ts`; `mockSimulation.ts` builds the timed demo, and `mockAdapter.ts` handles scheduling and subscriptions. `components/avon/mapModel.ts` derives resident display states; `AvonScene.tsx` owns WebGL rendering. `lib/networkLayout.ts` provides stable positions and the internal mock topology. Generated `module_bindings/` files remain owned by the SpacetimeDB generator; do not prune them based on current UI usage.

Run `npm run format` to format frontend files with Prettier, or `npm run format:check` to check formatting without modifying files.

## Live mode (SpacetimeDB)

`VITE_DATA_MODE=live` swaps the mock for `src/data/spacetimeAdapter.ts`, which subscribes to `resident` and `resident_profile` in `patient-zero-db` and maps them to `Resident` (with optional `profile`: district, x, y, weakSpot for the map). Campaigns, messages and warnings stay empty, and acknowledge/scenario/reset reject with "Not available yet", until those backend tables exist. Connection state and errors appear under the banner.

```sh
cp .env.example .env.local      # VITE_DATA_MODE=live, Vultr wss URI, patient-zero-db
npm run dev                     # Shows residents currently seeded in that database
```

Local backend instead: `VITE_SPACETIME_URI=ws://127.0.0.1:3000`. After changing the Spacetime module, regenerate bindings from `backend/spacetime`: `spacetime generate --lang typescript --out-dir ../../frontend/src/module_bindings --module-path ./spacetimedb`. `VITE_*` values ship to the browser: never put API keys in them.

The Command Center uses graph node selection for resident details; the duplicate resident card grid is removed. Summary counts still include all residents. Production builds use the checked-in `.env.production` live settings by default; set `VITE_DATA_MODE=mock` explicitly when building or running a mock demo.

## Unified resident network

Command Center renders **one continuous network of all residents**, including all 5,000 live synthetic residents. There are no regions, district filters, or separate regional layouts. A hand-drawn, schematic Texas silhouette sits beneath the network. A resident's ID alone determines a stable synthetic position inside the silhouette and an elevation 5–16 display units above it. The horizontal footprint is scaled 1.8× in both directions (3.24× ground area), spreading residents apart without increasing the vertical thickness. The overview camera fits the wider footprint. These are not resident locations, terrain heights, or risk values. The default angled camera shows the separation from the ground; the Texas layer can be toggled independently without changing nodes. Districts, coordinates, and susceptibility do not affect the layout or links, and profile data remains unchanged in the adapter.

All dots remain in the graph when selecting a resident. Click or tap a dot to update the selected resident details; Open Resident Phone retains that selection. Campaign investigation and selected resident details sit side by side below the graph on desktop and stack on narrow screens. The graph has no resident dropdown, previous/next buttons, or synthetic-neighbor details. **Focus selected** moves and zooms the camera to that dot without filtering the population; **Reset camera** restores the whole network. Camera buttons remain keyboard-accessible. Graph node selection currently requires a pointer; the Resident Phone view retains its resident selector as an alternative for browsing details.

The scene uses shared Three.js `Points` buffers, separate blue investigation and amber warning rings, and one white selection outline. Selection updates one marker rather than rebuilding the population. Dots remain enlarged: 4px in overview, 6px when zoomed, 9px for small mock populations. The ground uses one translucent shape and one outline, with no external map assets, services, new dependencies, or automatic motion. The camera stays above the ground and rotates around the elevation axis. Rendering occurs on changes, and GPU resources/listeners are disposed on unmount. Resident Phone remains available if WebGL fails.

### State meanings

- **Green:** no message associated with a flagged cluster was observed in the available snapshot; not a guarantee of safety.
- **Red:** a received message's `detectedClusterId` matches a campaign with `detectionStatus: flagged`. Detection updates recolor existing recipients without moving them.
- **Gray:** detection data unavailable. The current live adapter only subscribes to resident/profile tables, so live dots are gray and message/warning details say unavailable. Mock records demonstrate green/red states. Availability currently uses the existing `Snapshot.connection` distinction; replace this check with explicit feed capabilities when integrating live detection.
- **Amber ring:** at least one warning record was created. Acknowledgment updates a separate count and keeps the ring; neither establishes delivery or protection.
- **Blue ring (timed mock only):** a received message belongs to a campaign with `investigationStatus: pending`. This means “associated campaign under investigation,” not scanning a person. Rings disappear on completion, failure, or reset, without clearing red exposure or amber warnings. Blue rings are larger than amber rings; the white selection outline surrounds both.
- **White outline:** selected resident, preserving exposure color and warning rings.

Campaign investigation status remains separate. A completed investigation or warning acknowledgment does not clear exposure or stop the simulation. Resetting the mock fixture clears its records and recomputes state.

### Internal mock topology and data contracts

The timed demo adds optional mock-only controls to `DataAdapter` and optional fields to `Snapshot` (below). Existing live adapters remain compatible; backend schemas and generated bindings are unchanged. The view consumes the existing residents, messages, campaigns, and warnings. Detection uses detected cluster membership, not simulation ground truth.

**No lines are drawn between residents**, in either live or mock mode. Both synthetic layout edges and recent mock forwarding paths have been removed from the renderer to avoid implying real connections. The timed mock still uses a private fictional spanning tree to order deliveries (N residents, N−1 internal edges) and records mock forwarding events. This does not represent real contacts, never enters detection or the backend, and does not require new adapter contracts. Node colors, warning rings, selection, and the Texas outline remain visible.

Real propagation and stopping remain integration dependencies. Coordinate with backend/simulation owners for:

1. Authorized propagation events with stable IDs, source and destination resident IDs, and occurrence timestamps. Display links, proximity, and sender display names cannot establish transmissions.
2. Explicit availability/synchronization for message, detection, warning, and investigation subscriptions, plus detection timestamps for future playback. Empty unsubscribed feeds must not imply no exposure.
3. Authorized intervention actions and confirmed events recording the affected campaign, effective time, action, and outcome. Nemotron completion is an assessment, not a confirmed stop.

Until those live contracts exist, only the explicitly labeled browser-local demo can show propagation events. Live mode remains residents-only, without inferred transmissions, LLM calls, automatic stopping, or protection claims.

## Timed mock spread (5,000 residents)

From the repository root:

```sh
VITE_DATA_MODE=mock npm run dev --prefix frontend
```

Open **Command Center**, choose **Suspicious parcel campaign** under **Timed mock spread**, and click **Start 5,000-resident simulation**. Scroll to Resident network to watch it. The same controls are available in Attacker Console; starting there opens Command Center.

- Start replaces the four-resident static fixture with 5,000 synthetic identities, all initially green, and a monitoring campaign. The initial external entry has a null source; each subsequent forward has a previously reached resident as its source.
- The first 750ms tick introduces one recipient. Subsequent ticks add up to 25 deliveries, following a breadth-first plan through the explicitly fictional topology. Each resident receives one simulated message; every forward has a unique event ID and message ID.
- At **4.5 simulated seconds**, the suspicious scenario's cluster is **scripted** to become flagged. Prior recipients turn red, and subsequent recipients turn red as events arrive. This is not a detector implementation, benchmark, or validation of detection quality.
- At **7.5 simulated seconds** the suspicious campaign enters `pending` investigation, shown as “in progress (scripted mock).” All recipients linked to that campaign gain blue rings; unreached residents do not. At **22.5 seconds** the scripted assessment becomes `complete` and the rings clear, while exposure and spread continue. Benign runs never request an investigation. Timing labels derive from the exported tick constants in `mockSimulation.ts`.
- Warnings appear six ticks after receipt, once the scripted flag exists. Counts and acknowledgment remain independent of exposure. **Show warning rings** is off by default for the timed demo so rings do not obscure red spread; turn it on to inspect warnings. It stays on by default for the original small fixture.
- Spread is shown through node color changes only. No topology or forwarding lines are rendered. All 5,000 nodes, messages, and events remain in the snapshot. The warning log displays its latest 100 records; resident-specific warnings remain available in Resident Phone.
- **Pause** freezes state and cancels the timer. **Resume** continues without replaying missed wall-clock time. **Reset timed simulation** cancels activity, clears events/campaign/messages/warnings, and keeps the 5,000 residents green. Starting again restarts the demo. Loading a small static fixture cancels the timed run and restores four residents.
- Suspicious runs finish after all 5,000 deliveries and delayed warnings (about 155.25 simulated seconds); benign runs finish after deliveries (about 150.75 seconds), stay green, and create no warnings. Completion means the entire population was reached, not containment. No Nemotron API request is made and no intervention is claimed.

The clock is owned by the mock adapter, survives ordinary view navigation, and is canceled on completion, reset, fixture replacement, or final unsubscribe. Leaving the app pauses an active session; reload creates a fresh static fixture. Background-tab throttling can make wall-clock duration longer; ticks do not catch up in a burst. No API keys, network requests, backend reducers, or teammate simulator changes are involved.

The investigation phase reuses the existing `Campaign.investigationStatus` contract. Only the derived frontend `ResidentSignal.investigating` boolean is new; neither the DataAdapter API nor backend schemas change. Live snapshots do not show these scripted rings.

### Optional frontend-only contract additions

- `DataAdapter.startMockSimulation?(scenario)`, `pauseMockSimulation?()`, `resumeMockSimulation?()` return promises. Existing `reset()` clears a timed run while preserving its resident population. The live adapter does not implement timed methods and its UI does not expose them.
- `Snapshot.mockSimulation?`: `status` (`idle`, `running`, `paused`, `complete`), `scenario`, `tick`, `tickMs`, `seedResidentId`.
- `Snapshot.mockPropagation?`: events with `id`, nullable `sourceId` (external seed), `recipientId`, `messageId`, `occurredAt` (simulated epoch milliseconds), and `tick`. These types are intentionally mock-specific and do not define a public SpacetimeDB subscription.

`src/data/mockSimulation.ts` implements pure, deterministic steps. `mockAdapter.ts` owns scheduling and cancellation. `src/lib/networkLayout.ts` supplies shared geometry/topology without pulling React or WebGL into the data layer. The real detector and simulator remain separate teammates' modules.

Run `npm run test --prefix frontend` for layout plus simulation tests. The suite checks full-population completion, causal forwarding along the internal mock topology, delayed scripted detection/warnings, blue investigation rings, benign behavior, pause/resume/reset/restart, stale timer rejection, unsubscribe cleanup, and warning acknowledgment persistence. `npm run test:map --prefix frontend` remains available for layout/state tests only.

If localhost shows gray nodes, check the banner: **SpacetimeDB · Live** currently supplies resident/profile data only. Gray means detection data is unavailable, not a color-rendering failure. To see the scripted red/green spread, run `VITE_DATA_MODE=mock npm run dev --prefix frontend`, open the exact URL printed by Vite, and start the 5,000-resident simulation. Keep the live configuration for real subscriptions; do not infer safe or exposed states from missing feeds.
