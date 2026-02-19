"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface Dimensions {
  x: number;
  y: number;
  z: number;
}

interface MeshMetrics {
  volume: number;
  surfaceArea: number;
}

interface MeasurePoint {
  position: THREE.Vector3;
  marker: THREE.Mesh;
}

function ProBadge({ feature }: { feature: string }) {
  return (
    <Link
      href="/pro"
      className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors"
      title={`${feature} requires iotivate Pro`}
    >
      <span className="px-1 py-0.5 text-[10px] font-semibold rounded bg-accent/10 text-accent border border-accent/20">
        PRO
      </span>
    </Link>
  );
}

function computeMeshMetrics(geometry: THREE.BufferGeometry): MeshMetrics {
  const pos = geometry.getAttribute("position");
  const index = geometry.getIndex();
  let volume = 0;
  let surfaceArea = 0;

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const cross = new THREE.Vector3();

  const triCount = index ? index.count / 3 : pos.count / 3;

  for (let i = 0; i < triCount; i++) {
    let ia: number, ib: number, ic: number;
    if (index) {
      ia = index.getX(i * 3);
      ib = index.getX(i * 3 + 1);
      ic = index.getX(i * 3 + 2);
    } else {
      ia = i * 3;
      ib = i * 3 + 1;
      ic = i * 3 + 2;
    }

    vA.fromBufferAttribute(pos, ia);
    vB.fromBufferAttribute(pos, ib);
    vC.fromBufferAttribute(pos, ic);

    // Signed volume via tetrahedra method
    volume +=
      vA.x * (vB.y * vC.z - vC.y * vB.z) -
      vB.x * (vA.y * vC.z - vC.y * vA.z) +
      vC.x * (vA.y * vB.z - vB.y * vA.z);

    // Surface area via cross product
    const edge1 = new THREE.Vector3().subVectors(vB, vA);
    const edge2 = new THREE.Vector3().subVectors(vC, vA);
    cross.crossVectors(edge1, edge2);
    surfaceArea += cross.length() * 0.5;
  }

  volume = Math.abs(volume) / 6;

  return { volume, surfaceArea };
}

interface StlViewerProps {
  isPro?: boolean;
}

export default function StlViewer({ isPro = false }: StlViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const frameRef = useRef<number>(0);
  const clippingPlaneRef = useRef<THREE.Plane>(
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)
  );
  const measureGroupRef = useRef<THREE.Group>(new THREE.Group());
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());

  const [fileName, setFileName] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);
  const [metrics, setMetrics] = useState<MeshMetrics | null>(null);
  const [color, setColor] = useState("#5BA8A0");
  const [wireframe, setWireframe] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cross-section state
  const [clippingEnabled, setClippingEnabled] = useState(false);
  const [clipPosition, setClipPosition] = useState(0.5);
  const [clipBounds, setClipBounds] = useState<{ min: number; max: number }>({
    min: 0,
    max: 100,
  });

  // Measure state
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<MeasurePoint[]>([]);
  const [measureDistance, setMeasureDistance] = useState<number | null>(null);

  // Initialize Three.js scene
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    scene.add(measureGroupRef.current);

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      10000
    );
    camera.position.set(50, 50, 50);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.localClippingEnabled = true;
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 1;
    controls.maxDistance = 5000;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(1, 2, 1);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight2.position.set(-1, -0.5, -1);
    scene.add(dirLight2);

    // Grid helper
    const grid = new THREE.GridHelper(200, 20, 0x444466, 0x333355);
    scene.add(grid);
    gridRef.current = grid;

    // Animation loop
    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Resize handler
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(frameRef.current);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    };
  }, []);

  // Update mesh color
  useEffect(() => {
    if (!meshRef.current) return;
    const material = meshRef.current.material as THREE.MeshStandardMaterial;
    material.color.set(color);
  }, [color]);

  // Update wireframe
  useEffect(() => {
    if (!meshRef.current) return;
    const material = meshRef.current.material as THREE.MeshStandardMaterial;
    material.wireframe = wireframe;
  }, [wireframe]);

  // Update clipping plane
  useEffect(() => {
    if (!meshRef.current) return;
    const material = meshRef.current.material as THREE.MeshStandardMaterial;

    if (clippingEnabled) {
      const yValue =
        clipBounds.min + clipPosition * (clipBounds.max - clipBounds.min);
      clippingPlaneRef.current.set(new THREE.Vector3(0, -1, 0), yValue);
      material.clippingPlanes = [clippingPlaneRef.current];
      material.side = THREE.DoubleSide;
      material.clipShadows = true;
    } else {
      material.clippingPlanes = [];
      material.side = THREE.FrontSide;
    }
    material.needsUpdate = true;
  }, [clippingEnabled, clipPosition, clipBounds]);

  const fitCameraToObject = useCallback((mesh: THREE.Mesh) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.5;

    controls.target.copy(center);
    camera.position.set(
      center.x + distance * 0.7,
      center.y + distance * 0.7,
      center.z + distance * 0.7
    );
    camera.near = distance / 100;
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
    controls.update();

    // Resize grid to match model
    const scene = sceneRef.current;
    if (scene && gridRef.current) {
      scene.remove(gridRef.current);
      gridRef.current.dispose();
      const gridSize = maxDim * 3;
      const grid = new THREE.GridHelper(gridSize, 20, 0x444466, 0x333355);
      grid.position.y = box.min.y;
      scene.add(grid);
      gridRef.current = grid;
    }
  }, []);

  const clearMeasurement = useCallback(() => {
    const group = measureGroupRef.current;
    group.children.forEach((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          (child.material as THREE.Material).dispose();
        }
      }
    });
    group.clear();
    setMeasurePoints([]);
    setMeasureDistance(null);
  }, []);

  const loadSTL = useCallback(
    (file: File) => {
      setError(null);

      if (!file.name.toLowerCase().endsWith(".stl")) {
        setError("Please select a valid .stl file.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (!result) return;

        try {
          const loader = new STLLoader();
          const geometry = loader.parse(result as ArrayBuffer);
          geometry.computeVertexNormals();

          const scene = sceneRef.current;
          if (!scene) return;

          // Remove old mesh
          if (meshRef.current) {
            scene.remove(meshRef.current);
            meshRef.current.geometry.dispose();
            (meshRef.current.material as THREE.Material).dispose();
          }

          const material = new THREE.MeshStandardMaterial({
            color: color,
            wireframe: wireframe,
            metalness: 0.1,
            roughness: 0.6,
            flatShading: false,
          });

          const mesh = new THREE.Mesh(geometry, material);
          scene.add(mesh);
          meshRef.current = mesh;

          // Compute dimensions
          const box = new THREE.Box3().setFromObject(mesh);
          const size = box.getSize(new THREE.Vector3());
          setDimensions({
            x: Math.round(size.x * 100) / 100,
            y: Math.round(size.y * 100) / 100,
            z: Math.round(size.z * 100) / 100,
          });

          // Compute metrics
          const m = computeMeshMetrics(geometry);
          setMetrics({
            volume: Math.round(m.volume * 100) / 100,
            surfaceArea: Math.round(m.surfaceArea * 100) / 100,
          });

          // Set clip bounds
          setClipBounds({ min: box.min.y, max: box.max.y });
          setClipPosition(0.5);

          // Reset clipping and measurement
          setClippingEnabled(false);
          clearMeasurement();
          setMeasureMode(false);

          setFileName(file.name);
          fitCameraToObject(mesh);
        } catch {
          setError("Failed to parse STL file. The file may be corrupted.");
        }
      };
      reader.onerror = () => {
        setError("Failed to read the file.");
      };
      reader.readAsArrayBuffer(file);
    },
    [color, wireframe, fitCameraToObject, clearMeasurement]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) loadSTL(file);
    },
    [loadSTL]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) loadSTL(file);
    },
    [loadSTL]
  );

  const handleResetView = useCallback(() => {
    if (meshRef.current) {
      fitCameraToObject(meshRef.current);
    }
  }, [fitCameraToObject]);

  // Screenshot export
  const handleScreenshot = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;

    renderer.render(scene, camera);
    const dataURL = renderer.domElement.toDataURL("image/png");
    const link = document.createElement("a");
    const baseName = fileName
      ? fileName.replace(/\.stl$/i, "")
      : "stl";
    link.download = `${baseName}-screenshot.png`;
    link.href = dataURL;
    link.click();
  }, [fileName]);

  // Measure mode click handler
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!measureMode || !meshRef.current) return;

      const container = containerRef.current;
      const camera = cameraRef.current;
      if (!container || !camera) return;

      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      raycasterRef.current.setFromCamera(mouse, camera);
      const intersects = raycasterRef.current.intersectObject(meshRef.current);

      if (intersects.length === 0) return;

      const point = intersects[0].point.clone();
      const group = measureGroupRef.current;

      // Create marker sphere
      const markerGeo = new THREE.SphereGeometry(
        meshRef.current.geometry.boundingSphere
          ? meshRef.current.geometry.boundingSphere.radius * 0.015
          : 0.5,
        16,
        16
      );
      const markerMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.copy(point);
      group.add(marker);

      const newPoint: MeasurePoint = { position: point, marker };

      if (measurePoints.length === 0) {
        // First point
        setMeasurePoints([newPoint]);
        setMeasureDistance(null);
      } else if (measurePoints.length === 1) {
        // Second point — draw line and show distance
        const p1 = measurePoints[0].position;
        const p2 = point;

        const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0xff4444,
          linewidth: 2,
        });
        const line = new THREE.Line(lineGeo, lineMat);
        group.add(line);

        const dist = p1.distanceTo(p2);
        setMeasurePoints([measurePoints[0], newPoint]);
        setMeasureDistance(Math.round(dist * 100) / 100);
      } else {
        // Third click — reset and start new measurement
        clearMeasurement();
        // Place new first point
        const freshMarkerGeo = new THREE.SphereGeometry(
          meshRef.current!.geometry.boundingSphere
            ? meshRef.current!.geometry.boundingSphere.radius * 0.015
            : 0.5,
          16,
          16
        );
        const freshMarkerMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
        const freshMarker = new THREE.Mesh(freshMarkerGeo, freshMarkerMat);
        freshMarker.position.copy(point);
        group.add(freshMarker);
        setMeasurePoints([
          { position: point, marker: freshMarker },
        ]);
        setMeasureDistance(null);
      }
    },
    [measureMode, measurePoints, clearMeasurement]
  );

  // Toggle measure mode
  const toggleMeasureMode = useCallback(() => {
    if (measureMode) {
      clearMeasurement();
    }
    setMeasureMode((prev) => !prev);
  }, [measureMode, clearMeasurement]);

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-surface border border-border rounded-lg">
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-muted">Color</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
          />
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-sm text-muted">
          <input
            type="checkbox"
            checked={wireframe}
            onChange={(e) => setWireframe(e.target.checked)}
            className="rounded border-border accent-[#5BA8A0]"
          />
          Wireframe
        </label>

        <button
          onClick={handleResetView}
          disabled={!meshRef.current}
          className="px-3 py-1.5 text-sm rounded-md border border-border bg-surface hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Reset View
        </button>

        {/* Pro: Cross-Section */}
        {isPro ? (
          <button
            onClick={() => setClippingEnabled((prev) => !prev)}
            disabled={!meshRef.current}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              clippingEnabled
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-surface hover:bg-surface-hover"
            }`}
          >
            Cross-Section
          </button>
        ) : (
          <Link
            href="/pro"
            className="px-3 py-1.5 text-sm rounded-md border border-border bg-surface hover:bg-surface-hover transition-colors flex items-center gap-1.5"
            title="Cross-Section requires Pro"
          >
            Cross-Section{" "}
            <span className="text-[9px] font-semibold text-accent">PRO</span>
          </Link>
        )}

        {/* Pro: Measure */}
        {isPro ? (
          <button
            onClick={toggleMeasureMode}
            disabled={!meshRef.current}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              measureMode
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-surface hover:bg-surface-hover"
            }`}
          >
            Measure
          </button>
        ) : (
          <Link
            href="/pro"
            className="px-3 py-1.5 text-sm rounded-md border border-border bg-surface hover:bg-surface-hover transition-colors flex items-center gap-1.5"
            title="Measure requires Pro"
          >
            Measure{" "}
            <span className="text-[9px] font-semibold text-accent">PRO</span>
          </Link>
        )}

        {/* Pro: Screenshot */}
        {isPro ? (
          <button
            onClick={handleScreenshot}
            disabled={!meshRef.current}
            className="px-3 py-1.5 text-sm rounded-md border border-border bg-surface hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Screenshot
          </button>
        ) : (
          <Link
            href="/pro"
            className="px-3 py-1.5 text-sm rounded-md border border-border bg-surface hover:bg-surface-hover transition-colors flex items-center gap-1.5"
            title="Screenshot requires Pro"
          >
            Screenshot{" "}
            <span className="text-[9px] font-semibold text-accent">PRO</span>
          </Link>
        )}

        <label className="ml-auto px-3 py-1.5 text-sm rounded-md border border-border bg-surface hover:bg-surface-hover cursor-pointer transition-colors">
          Open File
          <input
            type="file"
            accept=".stl"
            onChange={handleFileInput}
            className="hidden"
          />
        </label>
      </div>

      {/* Cross-section slider */}
      {clippingEnabled && isPro && meshRef.current && (
        <div className="flex items-center gap-3 px-3 py-2 bg-surface border border-border rounded-lg">
          <span className="text-sm text-muted whitespace-nowrap">
            Clip Y
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.005}
            value={clipPosition}
            onChange={(e) => setClipPosition(parseFloat(e.target.value))}
            className="flex-1 accent-[#5BA8A0]"
          />
          <span className="text-sm text-muted tabular-nums w-20 text-right">
            {(
              clipBounds.min +
              clipPosition * (clipBounds.max - clipBounds.min)
            ).toFixed(1)}{" "}
            mm
          </span>
        </div>
      )}

      {/* Info bar */}
      {(fileName || dimensions) && (
        <div className="flex flex-wrap items-center gap-4 px-3 py-2 bg-surface/50 border border-border rounded-lg text-sm text-muted">
          {fileName && (
            <span>
              <span className="text-foreground font-medium">{fileName}</span>
            </span>
          )}
          {dimensions && (
            <span>
              {dimensions.x} &times; {dimensions.y} &times; {dimensions.z} mm
            </span>
          )}
          {metrics && isPro && (
            <>
              <span>
                Volume:{" "}
                <span className="text-foreground">
                  {metrics.volume.toLocaleString()} mm&sup3;
                </span>
              </span>
              <span>
                Surface area:{" "}
                <span className="text-foreground">
                  {metrics.surfaceArea.toLocaleString()} mm&sup2;
                </span>
              </span>
            </>
          )}
          {metrics && !isPro && (
            <>
              <span className="flex items-center gap-1.5">
                Volume <ProBadge feature="Volume" />
              </span>
              <span className="flex items-center gap-1.5">
                Surface area <ProBadge feature="Surface area" />
              </span>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-3 py-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">
          {error}
        </div>
      )}

      {/* Viewer */}
      <div
        ref={containerRef}
        className={`relative w-full rounded-lg border border-border overflow-hidden ${
          measureMode ? "cursor-crosshair" : ""
        }`}
        style={{ height: "min(70vh, 600px)" }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={handleCanvasClick}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Measure distance overlay */}
        {measureMode && measureDistance !== null && (
          <div className="absolute top-3 left-3 px-3 py-1.5 bg-black/70 text-white text-sm rounded-lg pointer-events-none z-10 tabular-nums">
            Distance: {measureDistance} mm
          </div>
        )}

        {/* Measure mode hint */}
        {measureMode && measureDistance === null && meshRef.current && (
          <div className="absolute top-3 left-3 px-3 py-1.5 bg-black/50 text-white/70 text-xs rounded-lg pointer-events-none z-10">
            {measurePoints.length === 0
              ? "Click to place first point"
              : "Click to place second point"}
          </div>
        )}

        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-accent/10 border-2 border-dashed border-accent rounded-lg flex items-center justify-center pointer-events-none z-10">
            <span className="text-accent font-medium text-lg">
              Drop STL file here
            </span>
          </div>
        )}

        {/* Empty state */}
        {!fileName && !isDragging && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <svg
              className="w-16 h-16 text-muted/30 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <p className="text-muted/50 text-sm">
              Drag &amp; drop an STL file or click Open File
            </p>
          </div>
        )}
      </div>

      {/* Usage tips */}
      <div className="text-xs text-muted space-y-1">
        <p>
          <strong className="text-foreground">Controls:</strong> Left-click drag
          to rotate, scroll to zoom, right-click drag to pan.
        </p>
        <p>
          <strong className="text-foreground">Note:</strong> Dimensions shown in
          millimeters (standard for 3D printing). STL files are unitless — values
          reflect the model&apos;s coordinate units.
        </p>
      </div>
    </div>
  );
}
