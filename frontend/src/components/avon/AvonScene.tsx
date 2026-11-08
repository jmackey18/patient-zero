import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TEXAS_OUTLINE } from "../../lib/texasLayout";
import { EXPOSURE_COLORS, type ResidentNode } from "./mapModel";

type CameraAction = "left" | "right" | "in" | "out" | "focus" | "reset";
interface Props {
  nodes: ResidentNode[];
  showWarnings: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
}

/** Shared dot/ring textures avoid a mesh or DOM label for each of the 5,000 residents. */
function markerTexture(ring: boolean, lineWidth = 7) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d")!;
  context.beginPath();
  context.arc(32, 32, ring ? 25 : 28, 0, Math.PI * 2);
  context.fillStyle = context.strokeStyle = "white";
  context.lineWidth = lineWidth;
  if (ring) context.stroke();
  else context.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Owns a single on-demand WebGL scene; all GPU resources and listeners are cleaned up on unmount. */
export default function AvonScene({
  nodes,
  showWarnings,
  selectedId,
  onSelect,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const sceneApi = useRef<{
    update: (nodes: ResidentNode[], showWarnings: boolean) => void;
    select: (id: string) => void;
    camera: (action: CameraAction) => void;
    ground: (visible: boolean) => void;
  } | null>(null);
  const onSelectRef = useRef(onSelect);
  const [error, setError] = useState("");
  const [showGround, setShowGround] = useState(true);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError(
        "3D is unavailable in this browser. Open Resident Phone to browse resident details.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const canvas = renderer.domElement;
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      "Synthetic Avon resident graph. Each dot represents a resident; no connections between residents are drawn. Drag to rotate; use the labeled camera buttons to rotate and zoom. Click or tap a dot to select a resident.",
    );
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    container.appendChild(canvas);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-18, 18, 14, -14, 0.1, 150);
    // Z is elevation; look down at the XY ground from the south without flattening the node cloud.
    camera.up.set(0, 0, 1);
    camera.position.set(0, -48, 48);
    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = false;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = Math.PI / 2 - 0.1;
    controls.minZoom = 0.7;
    controls.maxZoom = 5;
    controls.target.set(0, 0, 6);
    controls.update();
    controls.saveState();
    // Two shared draw calls for the decorative ground, with no map service or per-node meshes.
    const shape = new THREE.Shape(
      TEXAS_OUTLINE.map(([x, y]) => new THREE.Vector2(x, y)),
    );
    shape.closePath();
    const groundGeometry = new THREE.ShapeGeometry(shape);
    const groundMaterial = new THREE.MeshBasicMaterial({
      color: 0x387c89,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    const outlineGeometry = new THREE.BufferGeometry().setFromPoints(
      TEXAS_OUTLINE.map(([x, y]) => new THREE.Vector3(x, y, 0.02)),
    );
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: 0x69b1bd,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const outline = new THREE.LineLoop(outlineGeometry, outlineMaterial);
    ground.renderOrder = -2;
    outline.renderOrder = -1;
    scene.add(ground, outline);
    const dotTexture = markerTexture(false);
    const ringTexture = markerTexture(true);
    const investigationTexture = markerTexture(true, 2.5);
    const nodeMaterial = new THREE.PointsMaterial({
      map: dotTexture,
      size: 4,
      sizeAttenuation: false,
      vertexColors: true,
      alphaTest: 0.3,
    });
    const warningMaterial = new THREE.PointsMaterial({
      map: ringTexture,
      color: 0xfbbf24,
      size: 12,
      sizeAttenuation: false,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const selectionMaterial = new THREE.PointsMaterial({
      map: ringTexture,
      color: 0xffffff,
      size: 30,
      sizeAttenuation: false,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const investigationMaterial = new THREE.PointsMaterial({
      map: investigationTexture,
      color: 0x60a5fa,
      size: 18,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      depthWrite: false,
    });
    const investigations = new THREE.Points(
      new THREE.BufferGeometry(),
      investigationMaterial,
    );
    const residents = new THREE.Points(
      new THREE.BufferGeometry(),
      nodeMaterial,
    );
    const warnings = new THREE.Points(
      new THREE.BufferGeometry(),
      warningMaterial,
    );
    const selection = new THREE.Points(
      new THREE.BufferGeometry(),
      selectionMaterial,
    );
    warnings.renderOrder = 3;
    investigations.renderOrder = 2;
    selection.renderOrder = 4;
    selection.visible = false;
    scene.add(residents, investigations, warnings, selection);
    let currentNodes: ResidentNode[] = [];
    let nodesById = new Map<string, ResidentNode>();
    let selectedResident = "";
    let lost = false;
    const render = () => {
      if (lost) return;
      nodeMaterial.size =
        currentNodes.length < 20 ? 9 : camera.zoom > 1.5 ? 6 : 4;
      warningMaterial.size =
        currentNodes.length < 20 ? 18 : camera.zoom > 1.5 ? 16 : 12;
      investigationMaterial.size =
        currentNodes.length < 20 ? 24 : camera.zoom > 1.5 ? 22 : 18;
      renderer.render(scene, camera);
    };
    // Selection updates one marker, leaving the full population buffer intact.
    const select = (id: string) => {
      selectedResident = id;
      const node = nodesById.get(id);
      selection.visible = !!node;
      selection.geometry.dispose();
      selection.geometry = new THREE.BufferGeometry();
      if (node) {
        selection.geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute([node.x, node.y, node.z], 3),
        );
        selection.geometry.computeBoundingSphere();
      }
      render();
    };
    controls.addEventListener("change", render);
    const resize = () => {
      const width = Math.max(1, container.clientWidth),
        height = Math.max(1, container.clientHeight);
      const aspect = width / height;
      // Fit the wider footprint without shrinking it back to the old compact overview.
      const vertical = Math.max(24, 28 / aspect);
      camera.left = -vertical * aspect;
      camera.right = vertical * aspect;
      camera.top = vertical;
      camera.bottom = -vertical;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    const pointerDown = (event: PointerEvent) => {
      down = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
    };
    const pointerUp = (event: PointerEvent) => {
      if (
        !down ||
        Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6
      ) {
        down = null;
        return;
      }
      down = null;
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      // Keep a five-pixel hit target at any zoom, then choose the closest projected dot.
      raycaster.params.Points.threshold =
        ((camera.top - camera.bottom) / camera.zoom / rect.height) * 5;
      const hits = raycaster.intersectObject(residents);
      hits.sort((a, b) => (a.distanceToRay ?? 0) - (b.distanceToRay ?? 0));
      const nodeHit = hits[0];
      if (nodeHit?.index !== undefined) {
        onSelectRef.current(currentNodes[nodeHit.index].id);
      }
    };
    const cancelPointer = () => {
      down = null;
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      setError(
        "The 3D graphics context was lost. Open Resident Phone for resident details; reload to retry 3D.",
      );
    };
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", cancelPointer);
    canvas.addEventListener("webglcontextlost", contextLost);
    sceneApi.current = {
      ground(visible) {
        ground.visible = outline.visible = visible;
        render();
      },
      update(nextNodes, warningsVisible) {
        warnings.visible = warningsVisible;
        currentNodes = nextNodes;
        nodesById = new Map(nextNodes.map((node) => [node.id, node]));
        // One position/color buffer renders every resident; warnings are a separate ring layer.
        const positions = new Float32Array(nextNodes.length * 3);
        const colors = new Float32Array(nextNodes.length * 3);
        const warningPositions: number[] = [];
        const investigationPositions: number[] = [];
        const color = new THREE.Color();
        nextNodes.forEach((node, i) => {
          positions.set([node.x, node.y, node.z], i * 3);
          color.set(EXPOSURE_COLORS[node.status]).toArray(colors, i * 3);
          if (node.warningCount > 0)
            warningPositions.push(node.x, node.y, node.z);
          if (node.investigating)
            investigationPositions.push(node.x, node.y, node.z);
        });
        residents.geometry.dispose();
        residents.geometry = new THREE.BufferGeometry();
        residents.geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(positions, 3),
        );
        residents.geometry.setAttribute(
          "color",
          new THREE.BufferAttribute(colors, 3),
        );
        residents.geometry.computeBoundingSphere();
        warnings.geometry.dispose();
        warnings.geometry = new THREE.BufferGeometry();
        warnings.geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(warningPositions, 3),
        );
        warnings.geometry.computeBoundingSphere();
        // Independent ring buffers preserve the exposure dot and any smaller amber warning ring.
        investigations.geometry.dispose();
        investigations.geometry = new THREE.BufferGeometry();
        investigations.geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(investigationPositions, 3),
        );
        investigations.geometry.computeBoundingSphere();
        canvas.setAttribute(
          "aria-label",
          `Graph with ${nextNodes.length} individual resident dots at synthetic elevations above a schematic Texas ground layer. No connections between residents are drawn. Positions are not real locations. Colors show exposure records, blue rings show ${investigationPositions.length / 3} residents associated with a campaign under scripted mock investigation, amber rings show warnings, and white outlines show selection. Use the resident controls for text details.`,
        );
        select(selectedResident);
      },
      select,
      camera(action) {
        if (action === "reset") controls.reset();
        else if (action === "focus") {
          const node = nodesById.get(selectedResident);
          if (!node) return;
          const direction = camera.position.clone().sub(controls.target);
          controls.target.set(node.x, node.y, node.z);
          camera.position.copy(controls.target).add(direction);
          camera.zoom = 3;
          camera.updateProjectionMatrix();
        } else if (action === "in" || action === "out") {
          camera.zoom = THREE.MathUtils.clamp(
            camera.zoom * (action === "in" ? 1.25 : 0.8),
            0.7,
            5,
          );
          camera.updateProjectionMatrix();
        } else {
          const offset = camera.position.clone().sub(controls.target);
          offset.applyAxisAngle(
            new THREE.Vector3(0, 0, 1),
            action === "left" ? Math.PI / 8 : -Math.PI / 8,
          );
          camera.position.copy(controls.target).add(offset);
        }
        controls.update();
        render();
      },
    };
    resize();
    return () => {
      sceneApi.current = null;
      observer.disconnect();
      controls.dispose();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", cancelPointer);
      canvas.removeEventListener("webglcontextlost", contextLost);
      residents.geometry.dispose();
      warnings.geometry.dispose();
      selection.geometry.dispose();
      warningMaterial.dispose();
      investigations.geometry.dispose();
      investigationMaterial.dispose();
      selectionMaterial.dispose();
      dotTexture.dispose();
      ringTexture.dispose();
      investigationTexture.dispose();
      nodeMaterial.dispose();
      groundGeometry.dispose();
      groundMaterial.dispose();
      outlineGeometry.dispose();
      outlineMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, []);

  useEffect(() => {
    sceneApi.current?.ground(showGround);
  }, [showGround]);

  useEffect(() => {
    sceneApi.current?.update(nodes, showWarnings);
  }, [nodes, showWarnings]);

  useEffect(() => {
    sceneApi.current?.select(selectedId);
  }, [selectedId]);

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showGround}
          onChange={(event) => setShowGround(event.target.checked)}
        />
        Show Texas ground layer · schematic, not resident locations
      </label>
      <div className="flex flex-wrap gap-2" aria-label="Graph camera controls">
        {(
          [
            ["left", "Rotate left"],
            ["right", "Rotate right"],
            ["in", "Zoom in"],
            ["out", "Zoom out"],
            ["focus", "Focus selected"],
            ["reset", "Reset camera"],
          ] as const
        ).map(([action, label]) => (
          <button
            key={action}
            disabled={!!error || (action === "focus" && !selectedId)}
            onClick={() => sceneApi.current?.camera(action)}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p role="status" className="warning-card text-sm">
          {error}
        </p>
      )}
      <div
        ref={host}
        className={`h-[440px] overflow-hidden rounded-xl border border-border bg-background sm:h-[560px] ${error ? "hidden" : ""}`}
      />
      <p className="muted">
        Drag to orbit, scroll to zoom, or use the buttons. White outlines mark
        selection and preserve the dot’s exposure color. Every resident belongs
        to the same network. Use Focus selected to inspect a dot, and Reset
        camera to return to the full network.
      </p>
    </div>
  );
}
