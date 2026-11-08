import { useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import {
  MapView,
  WebMercatorViewport,
  type Color,
  type PickingInfo,
  type MapViewState,
} from "@deck.gl/core";
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import { Map as BaseMap, Source, Layer } from "react-map-gl/maplibre";
import {
  setWorkerUrl,
  type FillExtrusionLayerSpecification,
} from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import campusData from "../../assets/utd-campus.json";
import buildingData from "../../assets/utd-buildings.json";
import type { FeatureCollection, Polygon } from "geojson";
import { createRoofAnchors, type GroundAnchor } from "../../lib/campusAnchors";
import {
  createResidentTrips,
  sameTripData,
  CAMPUS_VIEW,
  TRAIL_SECONDS,
  TRIP_LOOP_SECONDS,
  tripPosition,
  type CampusAnchor,
  type ResidentTrip,
} from "../../lib/campusTrips";
import { type ResidentMapState } from "./mapModel";
import { sampleResidentTrails } from "./trailSample";
import { useTrailColors } from "./useTrailColors";
import { GREEN_FADE_MS } from "./trailColorQueue";
import { ResidentPhoneOverlay } from "./ResidentPhoneOverlay";

const ANCHORS = createRoofAnchors(
  campusData.anchors as GroundAnchor[],
  buildingData,
);
setWorkerUrl(mapWorkerUrl);
const BOUNDARY_PATHS = [campusData.boundary];
const MAP_VIEW = new MapView({ repeat: false });
const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";
const BUILDING_SOURCE = "campus-building-footprints";
const BUILDING_FOOTPRINTS = buildingData as FeatureCollection<Polygon>;
// Local OSM campus footprints avoid tile features that group off-campus buildings together.
// Deck's overlay stays above this context layer so buildings do not obscure resident picking.
const BUILDINGS: FillExtrusionLayerSpecification = {
  id: "campus-buildings-3d",
  type: "fill-extrusion",
  source: BUILDING_SOURCE,
  minzoom: 12,
  paint: {
    "fill-extrusion-color": "#526779",
    "fill-extrusion-height": ["get", "height"],
    "fill-extrusion-base": ["get", "base"],
    "fill-extrusion-opacity": 0.8,
    "fill-extrusion-vertical-gradient": true,
  },
};
/** Sizes the overview to the viewport, then moves closer to emphasize campus buildings. */
function campusOverview(width: number, height: number): MapViewState {
  const [west, south, east, north] = campusData.bounds;
  const fitted = new WebMercatorViewport({ width, height }).fitBounds(
    [
      [west, south],
      [east, north],
    ],
    { padding: 40 },
  );
  return {
    ...CAMPUS_VIEW,
    longitude: fitted.longitude,
    latitude: fitted.latitude,
    zoom: fitted.zoom + 0.55,
  };
}
const COLORS: Record<ResidentMapState["status"], Color> = {
  no_flagged: [85, 217, 155],
  flagged: [255, 103, 125],
  unavailable: [154, 172, 189],
  recovery: [255, 103, 125],
  warned: [85, 217, 155],
  untouched: [154, 172, 189],
};

interface Props {
  nodes: ResidentMapState[];
  simulationPaused: boolean;
}

/** Keeps the visual clock local: no catch-up jumps, backend writes, or simulation ticks. */
function useTrailClock(enabled: boolean) {
  const elapsed = useRef(0);
  const [time, setTime] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    let previous = 0;
    const animate = (now: number) => {
      if (document.hidden) {
        previous = 0;
        return;
      }
      if (!previous) previous = now;
      const delta = now - previous;
      if (delta >= 1000 / 30) {
        elapsed.current =
          (elapsed.current + Math.min(delta, 100) / 1000) % TRIP_LOOP_SECONDS;
        setTime(elapsed.current);
        previous = now;
      }
      frame = requestAnimationFrame(animate);
    };
    const visibility = () => {
      cancelAnimationFrame(frame);
      previous = 0;
      if (!document.hidden) frame = requestAnimationFrame(animate);
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled]);
  return time;
}

/** Renders fictional campus journeys, colored by the existing live/mock resident signals. */
export default function CampusScene({ nodes, simulationPaused }: Props) {
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [viewState, setViewState] = useState<MapViewState>(CAMPUS_VIEW);
  const [mapFailed, setMapFailed] = useState(false);
  const [renderError, setRenderError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const viewportSize = useRef<{ width: number; height: number } | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  // Clicking outside the map ends inspection without changing the adapter's clock.
  useEffect(() => {
    if (!paused) return;
    const resumeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !mapContainer.current?.contains(event.target)
      ) {
        setPaused(false);
        setSelectedId("");
      }
    };
    document.addEventListener("pointerdown", resumeOutside);
    return () => document.removeEventListener("pointerdown", resumeOutside);
  }, [paused]);
  // Fit actual CSS dimensions, avoiding the canvas's temporary initialization size.
  useEffect(() => {
    const container = mapContainer.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width <= 80 || height <= 80) return;
      const previous = viewportSize.current;
      viewportSize.current = { width, height };
      setViewState((view) =>
        previous
          ? {
              ...view,
              zoom: Math.max(
                12,
                Math.min(
                  18,
                  view.zoom +
                    Math.log2(
                      Math.min(
                        width / previous.width,
                        height / previous.height,
                      ),
                    ),
                ),
              ),
            }
          : campusOverview(width, height),
      );
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => setReducedMotion(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);

  const running =
    !paused && !reducedMotion && !simulationPaused && !renderError;
  const time = useTrailClock(running);
  const displayed = useMemo(
    () => sampleResidentTrails(nodes, selectedId),
    [nodes, selectedId],
  );
  const trailColors = useTrailColors(displayed, reducedMotion);
  // Build geometry only for displayed residents. Retained IDs keep identical paths and phases.
  const populationKey = JSON.stringify(displayed.map((node) => node.id));
  const trips = useMemo(
    () => createResidentTrips(JSON.parse(populationKey) as string[], ANCHORS),
    [populationKey],
  );
  const signals = useMemo(
    () => new Map(displayed.map((node) => [node.id, node])),
    [displayed],
  );
  const investigating = useMemo(
    () => trips.filter((trip) => signals.get(trip.id)?.investigating),
    [trips, signals],
  );
  const recovery = useMemo(
    () =>
      trips.filter((trip) =>
        ["recovery", "flagged"].includes(signals.get(trip.id)?.status ?? ""),
      ),
    [trips, signals],
  );
  const ordinary = useMemo(
    () =>
      trips.filter(
        (trip) =>
          !["recovery", "flagged"].includes(signals.get(trip.id)?.status ?? ""),
      ),
    [trips, signals],
  );
  const selected = useMemo(
    () => trips.filter((trip) => trip.id === selectedId),
    [trips, selectedId],
  );
  // Keep each batch's fade shorter than its cadence, so subsequent batches never restart it.
  const colorTransitions = reducedMotion ? null : { getColor: GREEN_FADE_MS };
  const selectedIsRed = ["recovery", "flagged"].includes(
    signals.get(selectedId)?.status ?? "",
  );
  const selectedFade = reducedMotion || selectedIsRed ? 0 : GREEN_FADE_MS;
  const tripProps = {
    dataComparator: sameTripData,
    getPath: (trip: ResidentTrip) => trip.path,
    getTimestamps: (trip: ResidentTrip) => trip.timestamps,
    currentTime: time,
    trailLength: TRAIL_SECONDS,
    capRounded: true,
    jointRounded: true,
    parameters: { depthWriteEnabled: false },
  };
  const layers = [
    new PathLayer({
      id: "utd-campus-boundary",
      data: BOUNDARY_PATHS,
      getPath: (path) => path as [number, number][],
      getColor: [98, 138, 161, 130],
      widthMinPixels: 1,
    }),
    new ScatterplotLayer<CampusAnchor>({
      id: "campus-building-points",
      data: ANCHORS,
      getPosition: (anchor) => anchor.position,
      getRadius: 8,
      radiusMinPixels: 3,
      radiusMaxPixels: 8,
      getFillColor: [168, 185, 201, 220],
      stroked: true,
      getLineColor: [225, 237, 245, 190],
      lineWidthMinPixels: 1,
    }),
    new TripsLayer<ResidentTrip>({
      ...tripProps,
      id: "investigation-trails",
      data: investigating,
      getColor: [96, 165, 250],
      widthMinPixels: 8,
      opacity: 0.9,
    }),
    new TripsLayer<ResidentTrip>({
      ...tripProps,
      id: "resident-trails",
      data: ordinary,
      transitions: colorTransitions,
      getColor: (trip) => COLORS[trailColors.get(trip.id) ?? "unavailable"],
      updateTriggers: { getColor: [trailColors] },
      widthMinPixels: 3,
      opacity: 1,
      pickable: true,
    }),
    // Red trails render last so numerous green journeys cannot hide recovery recipients.
    new TripsLayer<ResidentTrip>({
      ...tripProps,
      id: "recovery-trails",
      data: recovery,
      getColor: COLORS.recovery,
      widthMinPixels: 5,
      opacity: 1,
      pickable: true,
    }),
    new ScatterplotLayer<ResidentTrip>({
      id: "selected-resident-head",
      transitions: { getFillColor: selectedFade },
      data: selected,
      getPosition: (trip) => tripPosition(trip, time),
      updateTriggers: { getPosition: time, getFillColor: [trailColors] },
      getRadius: 5,
      radiusMinPixels: 4,
      getFillColor: (trip) => COLORS[trailColors.get(trip.id) ?? "unavailable"],
      stroked: true,
      getLineColor: [255, 255, 255],
      lineWidthMinPixels: 2,
      pickable: true,
    }),
    new TripsLayer<ResidentTrip>({
      ...tripProps,
      id: "selected-trail-outline",
      data: selected,
      pickable: true,
      getColor: [255, 255, 255],
      widthMinPixels: 7,
    }),
    new TripsLayer<ResidentTrip>({
      ...tripProps,
      id: "selected-trail",
      transitions: { getColor: selectedFade },
      data: selected,
      getColor: (trip) => COLORS[trailColors.get(trip.id) ?? "unavailable"],
      updateTriggers: { getColor: [trailColors] },
      widthMinPixels: 4,
    }),
  ];

  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap items-center gap-2"
        aria-label="UTD campus map controls"
      >
        <button
          onClick={() =>
            setViewState(
              campusOverview(
                viewportSize.current?.width ?? 1000,
                viewportSize.current?.height ?? 560,
              ),
            )
          }
        >
          Reset campus view
        </button>
      </div>
      <p id="campus-motion-help" className="muted" aria-live="polite">
        {reducedMotion
          ? "Motion paused for your reduced-motion preference."
          : simulationPaused
            ? "Trail motion is paused with the mock simulation."
            : paused
              ? "Trail motion paused for inspection; live data still updates."
              : null}{" "}
        Click a trail to pause and inspect its resident; click empty map space
        or outside the map to resume. Scroll or pinch to zoom; drag to pan. With
        the map focused, press Enter or Space to pause, and Escape to resume.
      </p>
      {mapFailed && (
        <p role="status" className="warning-card text-sm">
          Online basemap unavailable. Campus points and synthetic arcs remain
          visible.{" "}
          <button onClick={() => setMapFailed(false)}>Retry basemap</button>
        </p>
      )}
      {renderError ? (
        <p role="alert" className="warning-card">
          The map could not start. Live notifications and investigation reports
          are still available. {renderError}
        </p>
      ) : (
        <div
          className="relative h-[440px] overflow-hidden rounded-xl border border-border bg-[#080e17] sm:h-[560px]"
          ref={mapContainer}
          role="region"
          tabIndex={0}
          aria-describedby="campus-motion-help"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setPaused(false);
              setSelectedId("");
            } else if (
              event.target === event.currentTarget &&
              (event.key === "Enter" || event.key === " ")
            ) {
              event.preventDefault();
              setPaused(true);
            }
          }}
          aria-label="UTD campus map with synthetic moving resident trails"
        >
          <DeckGL
            views={MAP_VIEW}
            viewState={{ ...viewState, minZoom: 12, maxZoom: 18, maxPitch: 65 }}
            controller
            onViewStateChange={({ viewState: next }) => setViewState(next)}
            layers={layers}
            useDevicePixels={1}
            pickingRadius={6}
            onClick={({ object }: PickingInfo<ResidentTrip | CampusAnchor>) => {
              const resident = object && "timestamps" in object ? object : null;
              setPaused(!!resident);
              setSelectedId(resident?.id ?? "");
            }}
            onError={(error) => setRenderError(error.message)}
          >
            {!mapFailed && (
              <BaseMap
                mapStyle={MAP_STYLE}
                attributionControl={{ compact: true }}
                onError={() => setMapFailed(true)}
              >
                <Source
                  id={BUILDING_SOURCE}
                  type="geojson"
                  data={BUILDING_FOOTPRINTS}
                >
                  <Layer {...BUILDINGS} />
                </Source>
              </BaseMap>
            )}
          </DeckGL>
          <div className="pointer-events-none absolute left-3 top-3 max-w-[85%] rounded bg-background/90 px-4 py-3 text-sm sm:text-base">
            <p className="font-semibold">UT DALLAS</p>
          </div>
          <ResidentPhoneOverlay
            resident={paused ? (signals.get(selectedId) ?? null) : null}
            reducedMotion={reducedMotion}
            onClose={() => {
              setPaused(false);
              setSelectedId("");
              mapContainer.current?.focus();
            }}
          />
        </div>
      )}
      <p className="text-xs text-muted">
        Campus geometry ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          OpenStreetMap contributors
        </a>{" "}
        · ODbL. Online basemap:{" "}
        <a
          href="https://openfreemap.org"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          OpenFreeMap
        </a>{" "}
        / OpenMapTiles.
      </p>
    </div>
  );
}
