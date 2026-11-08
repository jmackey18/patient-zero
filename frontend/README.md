# Patient Zero frontend

Minimal React + TypeScript + Vite + Tailwind UI for Person 4. Supports local mock fixtures and live synthetic resident states, notifications, and Nemotron reports. Mock development needs no environment variables; live mode uses the public connection settings below. No API keys belong in the frontend.

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

## Dashboard and mock behavior

The Command Center provides clickable resident trails, resident details, campaign detection/investigation status, notifications, and counts derived from adapter records. Timed mock controls start suspicious or benign simulations, pause/resume, and reset them. Resident Phone and Attacker Console have been removed; there is no inbox, resident dropdown, or warning-acknowledgment UI.

In mock mode, the initial fixture contains four residents, one flagged cluster, three synthetic messages, and two preliminary warnings. Statuses are predetermined UI fixtures, not detector output. The separate timed mock described below creates 5,000 residents and scripted propagation. Mock mode never runs the backend simulator or calls Nemotron. State is in memory, resets on reload, and does not synchronize between tabs. Warning creation/acknowledgment is not evidence of delivery, avoided interaction, or protection. No precision, recall, or protection metrics are claimed.

## Expected data contracts and adapter boundary

`src/data/contracts.ts` defines frontend view models only; it does not change the team's shared schema. IDs are strings; timestamps are Unix epoch milliseconds. Collections must contain unique IDs and references must resolve to the corresponding resident or detected cluster.

| Model            | Expected fields                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Resident         | `id`, `persona`, `isSimulated`, `displayName`, optional `profile` (`district`, `x`, `y`, `weakSpot`), optional `liveState` (`exposed`, `warned`)       |
| Campaign         | `clusterId`, `label`, `detectionStatus` (`monitoring` or `flagged`), `investigationStatus` (`not_requested`, `pending`, `complete`, `failed`)          |
| Warning          | `id`, `recipientId`, `clusterId`, `severity` (`preliminary` or `elevated`), `warningText`, `createdAt`, `acknowledged` (spec section 5)                |
| SyntheticMessage | `id`, `recipientId`, optional `detectedClusterId`, `senderLabel`, `syntheticText`, `receivedAt`; authorized synthetic inbox view only                  |
| Snapshot         | `residents`, `campaigns`, `messages`, `warnings` arrays; optional `connection` status and `liveFeed`; mock-only `mockSimulation` and `mockPropagation` |

Campaign is a UI projection of backend cluster/detection/investigation state, not a simulation ground-truth campaign ID. The current campaign label is a fixture label; future labels must derive from authorized public evidence. The synthetic inbox model is separate from ordinary message ingestion. Never add plaintext, actual campaign labels, or evaluation ground truth to public detection subscriptions. Preserve 64-bit fingerprints as strings/bigints at integration boundaries, never JavaScript numbers.

`DataAdapter` exposes a stable cached `getSnapshot()`, `subscribe(callback)` returning an unsubscribe function, and asynchronous `acknowledgeWarning(id)`, `loadScenario(scenario)`, and `reset()` operations. Publish a new snapshot reference after changes. Reject failed operations so the UI can show an error. `src/data/index.ts` is the single adapter composition point; components accept an adapter rather than importing fixtures. Acknowledgment and static scenario loading remain adapter capabilities for compatibility but have no UI controls. Scenario loading is a mock convenience; do not assume a similarly named backend reducer exists.

## Integration dependencies and ownership

1. **Person 3:** resident flags, incident/notification tables, generated bindings, native subscriptions, and connection status are integrated. Authorized warning acknowledgment and per-campaign resident membership remain integration work.
2. **Person 1 + Person 3:** agree on operator-authorized start/reset operations and simulation scenarios before adding any future live operator controls. Speed controls are deferred. Retain scenario ground truth within the simulator/evaluation boundary.
3. **Person 2 + Person 3:** provide real cluster IDs and detection results. Derive campaign status from these results, never from synthetic scenario labels. Delivery/interaction records are required before showing protection or warning-delivery counts.
4. **Person 4:** the frontend reads live flags/reports without changing backend reducers or the mock contract. Any future private resident sessions must bind to an authorized identity and subscribe only to permitted records. Client-side filtering or hidden navigation is not access control.
5. **Nemotron:** the frontend displays the existing worker's incident records. Server-side authentication, response validation, credentials, and worker availability remain backend responsibilities. No frontend environment variable should contain an NVIDIA key.

The current backend simulation uses `exposed`/`warned`/`opened` resident booleans and stores synthetic message text separately. This frontend reads the exposure/warning flags and incident/notification metadata, never the `message` table. Backend exposure flags represent simulated targeting, not independent detector evidence.

## Verification

`npm run test` checks mock propagation/lifecycle, live flag precedence and reset behavior, 5,000-resident counts and building-to-building arcs, investigation states, bounded notifications, safe text rendering, and dashboard records. Component tests use Vite's SSR loader without opening HTTP/WebSocket listeners. `npm run build` checks TypeScript (including unused locals/parameters) and the production bundle. For a live smoke test, verify the connection badge, click a red/green trail, inspect its resident details, and check the investigation panel. A new backend run must update the same database the frontend subscribes to; these frontend tests do not validate backend authorization or detection quality.

## Code organization and formatting

`src/App.tsx` owns adapter subscriptions, resident/scenario selections, and action feedback. The single `src/views/CommandCenter.tsx` view receives data and callbacks through props. Small static fixtures live in `src/data/mockFixtures.ts`; `mockSimulation.ts` builds the timed demo, and `mockAdapter.ts` handles scheduling and subscriptions. `components/campus/mapModel.ts` derives resident display states; `components/campus/CampusScene.tsx` owns deck.gl/MapLibre rendering; `lib/campusAnchors.ts` places points over building roofs; `lib/campusTrips.ts` connects them with stable synthetic arcs. `data/mockTopology.ts` provides an ID-based fictional forwarding tree, independent of the campus geometry. Generated `module_bindings/` files remain owned by the SpacetimeDB generator; do not prune them based on current UI usage.

Run `npm run format` to format frontend files with Prettier, or `npm run format:check` to check formatting without modifying files.

## Live mode (SpacetimeDB)

`VITE_DATA_MODE=live` selects `src/data/spacetimeAdapter.ts`. Native subscriptions join `resident`, `resident_profile`, `notification`, and `incident`. No backend schema or generated binding changes are required for this frontend integration.

From the repository root:

```sh
VITE_DATA_MODE=live VITE_SPACETIME_URI=wss://db.patientzero.fishing npm run dev --prefix frontend
```

Open the exact URL Vite prints. Shell variables override `.env.local`, which may still select mock mode. Restart Vite after changing environment settings. To preview a production build, run `npm run build --prefix frontend` followed by `npm run preview --prefix frontend`; local builds do not deploy the public site.

### Live contract and display behavior

- `Resident.liveState?: { exposed: boolean; warned: boolean }` copies backend flags without inferring them from messages, notifications, or an AI verdict. Missing state is unavailable, not safe. Mock residents omit it.
- `Snapshot.liveFeed?` appears after subscription synchronization. It contains `notifications`, `alertCount`, `recoveryCount`, `incidents` (newest first), and optional `latestIncident`. An absent feed means unavailable; a synchronized empty feed means no records yet. Reconnection retains the last snapshot, with a stale-data banner.
- `LiveNotification` has string `id`, string `recipientId`, `kind` (`alert` or `recovery`), and plain `text`. Counts are records, not unique protected residents or delivery confirmations. The dashboard displays the latest 100 and preserves their text safely as React text, without HTML rendering.
- `LiveIncident` carries `campaignId`, `status` (`investigating`, `complete`, `failed`), `isCoordinated`, `confidence` (0–100), `reasoning`, `warningText`, `numVariants`, `clusterMeta`, and epoch-millisecond timestamps. The map's investigation panel shows the latest 10 reports. Only completed investigations display the model verdict/confidence and suggested warning; pending/failed reports never imply a completed assessment.
- Legacy `campaigns`, `messages`, and `warnings` remain empty in the live adapter. The views read `liveState` and `liveFeed` directly rather than inventing mock-shaped campaign membership or warning acknowledgments. `DataAdapter` methods and the timed mock remain unchanged.
- Live scenario/reset/acknowledgment actions are unavailable; the backend simulator starts live campaigns. No frontend NVIDIA keys or LLM calls are needed.

### Integration dependencies

The deployed database must include the four subscribed tables and match the checked-in generated bindings. The backend simulator must update resident flags; the detection worker must write notifications and investigation reports to **that same database**. The worker needs its server-side NVIDIA configuration for investigation results. The current Python database client points to localhost, so coordinate its runtime/deployment with the backend owner rather than assuming it follows the frontend URL.

The deployed `incident` row includes `time_spread_s: f32` between `cluster_meta` and the timestamps; `report_incident` also takes this field. The frontend bindings include it even though the UI does not display it. An older binding misreads subsequent rows and can leave the page stuck on “Syncing live data” with no residents or trails. Keep these bindings aligned with the deployed schema when regenerating from a local backend checkout.

This UI shows backend simulation state. `exposed` is currently set when the synthetic simulator targets a resident; it is not proof of a malicious message, interaction, compromise, or detection. `warned` is not evidence of delivery or avoided harm. The backend does not provide campaign-to-resident investigation membership, notification acknowledgments, or confirmed intervention events. Therefore live investigations appear in the panel, not as inferred blue outlines, and completing an investigation does not clear exposure. Message contents are not subscribed. End-to-end runs require the deployed services; frontend fixture tests do not validate Nemotron or detection quality.

Local backend instead: `VITE_SPACETIME_URI=ws://127.0.0.1:3000`. After changing the Spacetime module, regenerate bindings from `backend/spacetime`: `spacetime generate --lang typescript --out-dir ../../frontend/src/module_bindings --module-path ./spacetimedb`. `VITE_*` values ship to the browser: never put API keys in them.

The Command Center uses trail selection for resident details; the duplicate resident card grid is removed. Summary counts still include all residents. Production builds use the checked-in `.env.production` live settings by default; set `VITE_DATA_MODE=mock` explicitly when building or running a mock demo.

## UT Dallas campus arcs

The Command Center uses **deck.gl elevated trails over a MapLibre dark UT Dallas campus map**. The overview fits the campus boundary. Sixty-four neutral points sit over campus building roofs. All 5,000 residents have a deterministic, fictional source/target pair; live and mock snapshots share the renderer. Profiles and backend coordinates do not determine these assignments.

`src/assets/utd-campus.json` contains selected OpenStreetMap building anchors and the campus outline. Source and ODbL attribution are in `src/assets/README.md`. The old pedestrian-path dataset and street-routing code are removed. Online OpenFreeMap/OpenMapTiles needs internet but no API key. Local points and arcs remain visible if tiles fail. MapLibre renders muted 3D campus buildings from bundled OpenStreetMap footprints beneath the deck.gl overlay.

### 3D building context

`CampusScene.tsx` adds a MapLibre `fill-extrusion` layer from `src/assets/utd-buildings.json`. The dataset contains 193 campus building footprints: 148 use mapped height tags, 20 estimate height from mapped levels at 3 meters per level, and 25 use a 12-meter visual fallback. These are simplified blocks, not verified architectural models. Source details and attribution are in `src/assets/README.md`.

Bundling campus footprints avoids OpenFreeMap tile features that group campus and neighboring housing together. There are no additional building-tile requests or runtime API keys. OpenFreeMap still provides the basemap. If the basemap fails, the existing local points and arcs remain usable; the MapLibre building layer is hidden with the basemap.

Buildings are noninteractive context. The existing deck.gl canvas deliberately draws points and arcs above the basemap, so buildings cannot hide resident colors or intercept trail selection. These separate canvases do not share a depth buffer: arcs are not physically occluded by buildings, and each endpoint matches its rooftop marker. Markers sit two meters above the same top height used for the building extrusion; points outside a concave footprint are moved inside it. No new dependencies, subscriptions, or DataAdapter changes are required. See the [MapLibre building example](https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/) for the extrusion technique.

### Movement and interaction

- Each ID chooses two distinct rooftop points and an elevated parabolic arc. Its altitude interpolates between the two roof heights plus a parabolic rise, so both ends meet their markers. These links are illustrative, **not actual travel, contacts, or message propagation**. Gray building markers are geographic anchors, not resident exposure states; colored arcs retain individual resident state.
- Arcs cross in 18 visual seconds with three-second fading tails. Every resident crosses twice per 600-second loop, regardless of population size; independent phases keep roughly 300 of 5,000 arcs moving at once. Small fixtures can have long intervals without visible trails. This is visual pacing, not walking speed or simulation timing.
- Geometry is cached by resident IDs. Status updates recolor the same arcs; red renders above green. The selected resident has a white-edged head marker, including while resting. The loop is seamless, with no accumulated epoch timestamp precision loss.
- **Click a trail** to pause animation and inspect its resident; click empty map space or outside the map to resume. Keyboard users can focus the map and press Enter/Space to pause or Escape to resume. Live state continues updating. The animation also pauses for reduced-motion preferences, hidden tabs, and a paused/idle/completed timed mock. It never advances the adapter's simulation clock, makes backend writes, or implies that a scam stopped. Leaving the map resets its visual playhead on remount without resetting the adapter.
- Click a trail to view its resident details below the map. White outlines identify the selection; blue outlines retain the timed mock's investigation phase. Notification records remain available in the dashboard log. Normal trails use a 3-pixel minimum width at full opacity; exposed trails use 3.5 pixels for visibility over buildings.
- Use scroll/pinch to zoom and drag to pan. Focus selected trail and reset controls remain keyboard-accessible; redundant zoom, rotate, and pause buttons are removed. The overview adapts to map width. Online basemap attribution remains visible; reduced motion freezes trails rather than removing resident data.

### Data adapter compatibility

No shared schema or DataAdapter additions are required for synthetic arcs. `Resident.liveState`, `Snapshot.liveFeed`, and the existing mock message/campaign/warning models still supply state and counts. Synthetic arc geometry/timestamps live only in the visualization and never enter SpacetimeDB or detection. Trail colors show **current** state across the visible tail, not historical verdicts along the path. The mock uses a deterministic ID-based forwarding tree, unrelated to the campus anchor geometry and never rendered. Removing the old Texas layout changes the fictional delivery order, but preserves batch sizes, timing, causal forwarding, and simulation controls.

Actual transmission trails would require authorized source/destination events with timestamps and campaign membership. Live investigations still have no per-resident membership, so their results remain in the panel rather than inferred blue outlines.

### Runtime and dependency notes

The map loads lazily. The visualization uses pinned deck.gl 9.4.1, react-map-gl 8.1.3, and MapLibre 6.17.0; MapLibre's worker is bundled explicitly through Vite. Three.js and the old renderer have been removed. Map and worker chunks are larger than the previous node renderer; the production build reports chunk-size warnings. Use the supported Node versions listed above; the current Node 20 environment emits dependency engine warnings.

The dependency audit reports transitive advisories through deck.gl's optional asset-loading packages (including image-size/texture-compressor and fflate). This visualization does not load uploaded models or compressed archives, but the advisories still need dependency maintenance before production use. An automatic downgrade/force-fix has not been applied to the pinned rendering stack.

### State meanings

- **Live red:** `liveState.exposed` is true, even if `warned` is also true.
- **Live green:** `warned` is true and `exposed` is false.
- **Live gray:** neither flag is set (untouched), or live state is unavailable. Labels distinguish these cases; neither means safe.
- **Mock green:** no message associated with a flagged cluster was observed in the fixture.
- **Mock red:** a received message's `detectedClusterId` matches a campaign with `detectionStatus: flagged`.
- **Blue trail outline (timed mock only):** a received message belongs to a campaign with `investigationStatus: pending`. Outlines disappear on completion, failure, or reset without clearing exposure or warnings. Live incident reports have no resident membership, so no live blue outlines are inferred.
- **White outline:** selected resident, preserving state color and other outlines.

Campaign investigation status remains separate. A completed investigation or warning acknowledgment does not clear exposure or stop the simulation. Resetting the mock fixture clears its records and recomputes state.

### Internal mock topology and data contracts

The timed demo adds optional mock-only controls to `DataAdapter` and optional fields to `Snapshot` (below). Existing live adapters remain compatible; backend schemas and generated bindings are unchanged. The view consumes the existing residents, messages, campaigns, and warnings. Detection uses detected cluster membership, not simulation ground truth.

**No transmission links are drawn between residents**. The timed mock retains a private fictional spanning tree to order deliveries (N residents, N−1 internal edges). Its forwarding events are unrelated to synthetic campus arcs and never enter detection or the backend.

Real propagation and stopping remain integration dependencies. Coordinate with backend/simulation owners for:

1. Authorized propagation events with stable IDs, source and destination resident IDs, and occurrence timestamps. Display links, proximity, and sender display names cannot establish transmissions.
2. Explicit availability/synchronization for message, detection, warning, and investigation subscriptions, plus detection timestamps for future playback. Empty unsubscribed feeds must not imply no exposure.
3. Authorized intervention actions and confirmed events recording the affected campaign, effective time, action, and outcome. Nemotron completion is an assessment, not a confirmed stop.

Until those live contracts exist, only the explicitly labeled browser-local demo can show propagation events. Live mode displays backend resident flags and incident/notification records without inferred transmissions, browser LLM calls, automatic stopping, or protection claims.

## Timed mock spread (5,000 residents)

From the repository root:

```sh
VITE_DATA_MODE=mock npm run dev --prefix frontend
```

Open **Command Center**, choose **Suspicious parcel campaign** under **Timed mock spread**, and click **Start 5,000-resident simulation**. Scroll to Scam observation to watch it.

- Start replaces the four-resident static fixture with 5,000 synthetic identities, all initially green, and a monitoring campaign. The initial external entry has a null source; each subsequent forward has a previously reached resident as its source.
- The first 750ms tick introduces one recipient. Subsequent ticks add up to 25 deliveries, following a breadth-first plan through the explicitly fictional topology. Each resident receives one simulated message; every forward has a unique event ID and message ID.
- At **4.5 simulated seconds**, the suspicious scenario's cluster is **scripted** to become flagged. Prior recipients turn red, and subsequent recipients turn red as events arrive. This is not a detector implementation, benchmark, or validation of detection quality.
- At **7.5 simulated seconds** the suspicious campaign enters `pending` investigation, shown as “in progress (scripted mock).” All recipients linked to that campaign gain blue trail outlines; unreached residents do not. At **22.5 seconds** the scripted assessment becomes `complete` and the outlines clear, while exposure and spread continue. Benign runs never request an investigation. Timing labels derive from the exported tick constants in `mockSimulation.ts`.
- Warnings appear six ticks after receipt, once the scripted flag exists. Counts and acknowledgment remain independent of exposure. Warning counts and resident details remain available; warnings do not add map outlines.
- Spread is shown through trail color changes only. No topology or forwarding lines are rendered. All 5,000 residents, messages, and events remain in the snapshot. The warning log displays its latest 100 records; selected resident details show warning counts.
- **Pause** freezes state and cancels the timer. **Resume** continues without replaying missed wall-clock time. **Reset timed simulation** cancels activity, clears events/campaign/messages/warnings, and keeps the 5,000 residents green. Starting again restarts the demo. Reloading restores the four-resident static fixture.
- Suspicious runs finish after all 5,000 deliveries and delayed warnings (about 155.25 simulated seconds); benign runs finish after deliveries (about 150.75 seconds), stay green, and create no warnings. Completion means the entire population was reached, not containment. No Nemotron API request is made and no intervention is claimed.

The clock is owned by the mock adapter, is canceled on completion, reset, fixture replacement, or final unsubscribe. Leaving the app pauses an active session; reload creates a fresh static fixture. Background-tab throttling can make wall-clock duration longer; ticks do not catch up in a burst. The mock simulator makes no backend requests; online basemap requests remain independent of the simulation. No API keys, backend reducer changes, or teammate simulator changes are involved.

The investigation phase reuses the existing `Campaign.investigationStatus` contract. Only the derived frontend `ResidentSignal.investigating` boolean is new; neither the DataAdapter API nor backend schemas change. Live snapshots do not show these scripted outlines.

### Optional frontend-only contract additions

- `DataAdapter.startMockSimulation?(scenario)`, `pauseMockSimulation?()`, `resumeMockSimulation?()` return promises. Existing `reset()` clears a timed run while preserving its resident population. The live adapter does not implement timed methods and its UI does not expose them.
- `Snapshot.mockSimulation?`: `status` (`idle`, `running`, `paused`, `complete`), `scenario`, `tick`, `tickMs`, `seedResidentId`.
- `Snapshot.mockPropagation?`: events with `id`, nullable `sourceId` (external seed), `recipientId`, `messageId`, `occurredAt` (simulated epoch milliseconds), and `tick`. These types are intentionally mock-specific and do not define a public SpacetimeDB subscription.

`src/data/mockSimulation.ts` implements pure, deterministic steps. `mockAdapter.ts` owns scheduling and cancellation. `src/data/mockTopology.ts` supplies fictional contacts using resident IDs, without geographic positions or rendering dependencies. The real detector and simulator remain separate teammates' modules.

Run `npm run test --prefix frontend` for campus arcs, display states, and simulation tests. The suite checks full-population completion, causal forwarding along the internal mock topology, delayed scripted detection/warnings, blue investigation outlines, benign behavior, pause/resume/reset/restart, stale timer rejection, unsubscribe cleanup, and warning acknowledgment persistence. `npm run test:map --prefix frontend` remains available for resident display-state tests only.

If localhost shows gray trails, check the banner and selected resident flags. In live mode, gray means untouched or missing state; a disconnected view may retain stale records. To see the scripted red/green spread, run `VITE_DATA_MODE=mock npm run dev --prefix frontend`, open the exact URL printed by Vite, and start the 5,000-resident simulation. Keep the live configuration for real subscriptions; do not infer safe or exposed states from missing feeds.
