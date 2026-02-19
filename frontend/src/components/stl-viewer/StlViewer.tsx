"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type {
  Dimensions,
  MeshMetrics,
  MeasurePoint,
  StlViewerProps,
  RepairReport,
  LoadedFile,
} from "./types";
import type { Unit, ThicknessResult } from "./utils";
import {
  FILE_PALETTE,
  computeMeshMetrics,
  computeRepairInfo,
  computeThickness,
  formatLength,
  formatArea,
  formatVolume,
} from "./utils";
import RepairPanel from "./RepairPanel";
import CostEstimatorPanel from "./CostEstimatorPanel";
import FileListPanel from "./FileListPanel";

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

function ProButton({
  label,
  isPro,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  isPro: boolean;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  children?: React.ReactNode;
}) {
  if (isPro) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`px-3 py-1.5 text-sm rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
          active
            ? "border-accent bg-accent/10 text-accent"
            : "border-border bg-surface hover:bg-surface-hover"
        }`}
      >
        {children ?? label}
      </button>
    );
  }
  return (
    <Link
      href="/pro"
      className="px-3 py-1.5 text-sm rounded-md border border-border bg-surface hover:bg-surface-hover transition-colors flex items-center gap-1.5"
      title={`${label} requires Pro`}
    >
      {label}{" "}
      <span className="text-[9px] font-semibold text-accent">PRO</span>
    </Link>
  );
}

// ---------- Main component ----------

export default function StlViewer({ isPro = false }: StlViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const frameRef = useRef<number>(0);
  const clippingPlaneRef = useRef<THREE.Plane>(
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)
  );
  const measureGroupRef = useRef<THREE.Group>(new THREE.Group());
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());

  // ---------- Multi-file state ----------
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const fileCounterRef = useRef(0);

  const activeFile = useMemo(
    () => files.find((f) => f.id === activeFileId) ?? null,
    [files, activeFileId]
  );
  const hasAnyMesh = files.length > 0;

  // ---------- Display state ----------
  const [color, setColor] = useState("#5BA8A0");
  const [wireframe, setWireframe] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cross-section
  const [clippingEnabled, setClippingEnabled] = useState(false);
  const [clipPosition, setClipPosition] = useState(0.5);
  const [clipBounds, setClipBounds] = useState<{ min: number; max: number }>({
    min: 0,
    max: 100,
  });

  // Measure
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<MeasurePoint[]>([]);
  const [measureDistance, setMeasureDistance] = useState<number | null>(null);

  // Animation export
  const [isRecording, setIsRecording] = useState(false);

  // --- NEW: Unit toggle (free) ---
  const [unit, setUnit] = useState<Unit>("mm");

  // --- NEW: Background color (free) ---
  const [bgColor, setBgColor] = useState("#1a1a2e");

  // --- NEW: Auto-rotate (free) ---
  const [autoRotate, setAutoRotate] = useState(false);

  // --- NEW: Scale/Transform (Pro) ---
  const [scaleEnabled, setScaleEnabled] = useState(false);
  const [scaleFactor, setScaleFactor] = useState(1.0);

  // --- NEW: Repair info (Pro) ---
  const [repairReport, setRepairReport] = useState<RepairReport | null>(null);
  const [showRepairPanel, setShowRepairPanel] = useState(false);

  // --- NEW: Thickness analysis (Pro) ---
  const [thicknessEnabled, setThicknessEnabled] = useState(false);
  const [thicknessProgress, setThicknessProgress] = useState<number | null>(
    null
  );
  const [thicknessRange, setThicknessRange] = useState<{
    min: number;
    max: number;
  } | null>(null);
  const originalMaterialsRef = useRef<
    Map<string, THREE.MeshStandardMaterial>
  >(new Map());

  // --- NEW: Print Cost Estimator (Pro) ---
  const [showCostPanel, setShowCostPanel] = useState(false);

  // ---------- Derived display values (with scale + unit) ----------
  const displayDimensions = useMemo(() => {
    if (!activeFile) return null;
    const s = scaleFactor;
    return {
      x: activeFile.dimensions.x * s,
      y: activeFile.dimensions.y * s,
      z: activeFile.dimensions.z * s,
    };
  }, [activeFile, scaleFactor]);

  const displayMetrics = useMemo(() => {
    if (!activeFile) return null;
    const s = scaleFactor;
    return {
      volume: activeFile.metrics.volume * s * s * s,
      surfaceArea: activeFile.metrics.surfaceArea * s * s,
    };
  }, [activeFile, scaleFactor]);

  // ---------- Initialize Three.js scene ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bgColor);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Background color effect ----------
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.background = new THREE.Color(bgColor);
  }, [bgColor]);

  // ---------- Auto-rotate effect ----------
  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.autoRotate = autoRotate;
    controlsRef.current.autoRotateSpeed = 4.0;
  }, [autoRotate]);

  // ---------- Scale effect ----------
  useEffect(() => {
    files.forEach((f) => {
      f.mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
    });
  }, [scaleFactor, files]);

  // ---------- Update active file mesh color ----------
  useEffect(() => {
    if (!activeFile) return;
    const material = activeFile.mesh.material as THREE.MeshStandardMaterial;
    if (material.vertexColors) return; // thickness heatmap active
    material.color.set(color);
  }, [color, activeFile]);

  // ---------- Update active file wireframe ----------
  useEffect(() => {
    if (!activeFile) return;
    const material = activeFile.mesh.material as THREE.MeshStandardMaterial;
    material.wireframe = wireframe;
  }, [wireframe, activeFile]);

  // ---------- Update clipping plane on all visible meshes ----------
  useEffect(() => {
    files.forEach((f) => {
      if (!f.visible) return;
      const material = f.mesh.material as THREE.MeshStandardMaterial;
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
    });
  }, [clippingEnabled, clipPosition, clipBounds, files]);

  // ---------- Camera helpers ----------
  const fitCameraToObjects = useCallback(
    (meshes: THREE.Mesh[]) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls || meshes.length === 0) return;

      const box = new THREE.Box3();
      meshes.forEach((m) => box.expandByObject(m));
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

      // Resize grid
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
    },
    []
  );

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

  // ---------- Clear thickness heatmap ----------
  const clearThickness = useCallback(() => {
    files.forEach((f) => {
      const orig = originalMaterialsRef.current.get(f.id);
      if (orig) {
        f.mesh.material = orig;
        originalMaterialsRef.current.delete(f.id);
      }
      f.geometry.deleteAttribute("color");
    });
    setThicknessEnabled(false);
    setThicknessProgress(null);
    setThicknessRange(null);
  }, [files]);

  // ---------- Load STL ----------
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

          const fileId = `file_${++fileCounterRef.current}`;
          const paletteIdx =
            fileCounterRef.current % FILE_PALETTE.length;
          const fileColor = isPro
            ? FILE_PALETTE[paletteIdx]
            : color;

          const material = new THREE.MeshStandardMaterial({
            color: fileColor,
            wireframe: wireframe,
            metalness: 0.1,
            roughness: 0.6,
            flatShading: false,
          });

          const mesh = new THREE.Mesh(geometry, material);
          scene.add(mesh);

          // Compute dimensions
          const box = new THREE.Box3().setFromObject(mesh);
          const size = box.getSize(new THREE.Vector3());
          const dims: Dimensions = {
            x: Math.round(size.x * 100) / 100,
            y: Math.round(size.y * 100) / 100,
            z: Math.round(size.z * 100) / 100,
          };

          const m = computeMeshMetrics(geometry);
          const met: MeshMetrics = {
            volume: Math.round(m.volume * 100) / 100,
            surfaceArea: Math.round(m.surfaceArea * 100) / 100,
          };

          const newFile: LoadedFile = {
            id: fileId,
            name: file.name,
            mesh,
            geometry,
            dimensions: dims,
            metrics: met,
            color: fileColor,
            visible: true,
            scale: 1.0,
          };

          if (isPro) {
            // Multi-file: add to array
            setFiles((prev) => [...prev, newFile]);
          } else {
            // Single file: replace
            setFiles((prev) => {
              prev.forEach((f) => {
                scene.remove(f.mesh);
                f.geometry.dispose();
                (f.mesh.material as THREE.Material).dispose();
              });
              return [newFile];
            });
          }

          setActiveFileId(fileId);

          // Set clip bounds from this mesh
          setClipBounds({ min: box.min.y, max: box.max.y });
          setClipPosition(0.5);

          // Reset per-file state
          setClippingEnabled(false);
          clearMeasurement();
          setMeasureMode(false);
          setShowRepairPanel(false);
          setRepairReport(null);
          setThicknessEnabled(false);
          setThicknessProgress(null);
          setThicknessRange(null);
          setScaleFactor(1.0);
          setScaleEnabled(false);
          setShowCostPanel(false);

          fitCameraToObjects([mesh]);
        } catch {
          setError("Failed to parse STL file. The file may be corrupted.");
        }
      };
      reader.onerror = () => {
        setError("Failed to read the file.");
      };
      reader.readAsArrayBuffer(file);
    },
    [color, wireframe, fitCameraToObjects, clearMeasurement, isPro]
  );

  // ---------- Drop / file input ----------
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (isPro) {
        droppedFiles.forEach((f) => loadSTL(f));
      } else {
        const file = droppedFiles[0];
        if (file) loadSTL(file);
      }
    },
    [loadSTL, isPro]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      if (isPro) {
        selected.forEach((f) => loadSTL(f));
      } else {
        const file = selected[0];
        if (file) loadSTL(file);
      }
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [loadSTL, isPro]
  );

  // ---------- View reset ----------
  const handleResetView = useCallback(() => {
    const visibleMeshes = files.filter((f) => f.visible).map((f) => f.mesh);
    if (visibleMeshes.length > 0) {
      fitCameraToObjects(visibleMeshes);
    }
  }, [files, fitCameraToObjects]);

  // ---------- Screenshot ----------
  const handleScreenshot = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;

    renderer.render(scene, camera);
    const dataURL = renderer.domElement.toDataURL("image/png");
    const link = document.createElement("a");
    const baseName = activeFile
      ? activeFile.name.replace(/\.stl$/i, "")
      : "stl";
    link.download = `${baseName}-screenshot.png`;
    link.href = dataURL;
    link.click();
  }, [activeFile]);

  // ---------- Export animation ----------
  const handleExportAnimation = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!renderer || !scene || !camera || !controls || !hasAnyMesh || isRecording)
      return;

    const ren = renderer;
    const scn = scene;
    const cam = camera;
    const ctrl = controls;

    setIsRecording(true);

    const canvas = ren.domElement;
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9",
    });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const baseName = activeFile
        ? activeFile.name.replace(/\.stl$/i, "")
        : "stl";
      link.download = `${baseName}-turntable.webm`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      setIsRecording(false);
    };

    const startPos = cam.position.clone();
    const startTarget = ctrl.target.clone();

    // Combined bounding box
    const box = new THREE.Box3();
    files
      .filter((f) => f.visible)
      .forEach((f) => box.expandByObject(f.mesh));
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cam.fov * (Math.PI / 180);
    const orbitRadius = (maxDim / (2 * Math.tan(fov / 2))) * 1.5;

    const totalFrames = 120;
    let frame = 0;

    recorder.start();

    const prevDamping = ctrl.enableDamping;
    ctrl.enableDamping = false;

    function captureFrame() {
      if (frame >= totalFrames) {
        ctrl.enableDamping = prevDamping;
        ctrl.target.copy(startTarget);
        cam.position.copy(startPos);
        cam.updateProjectionMatrix();
        ctrl.update();
        recorder.stop();
        return;
      }

      const t = frame / totalFrames;
      const azimuth = t * Math.PI * 2;
      const elevation =
        Math.PI * 0.25 + Math.sin(t * Math.PI * 2) * Math.PI * 0.2;
      cam.position.set(
        center.x + orbitRadius * Math.sin(elevation) * Math.cos(azimuth),
        center.y + orbitRadius * Math.cos(elevation),
        center.z + orbitRadius * Math.sin(elevation) * Math.sin(azimuth)
      );
      ctrl.target.copy(center);
      ctrl.update();
      ren.render(scn, cam);

      frame++;
      requestAnimationFrame(captureFrame);
    }

    captureFrame();
  }, [activeFile, isRecording, hasAnyMesh, files]);

  // ---------- Measure click handler ----------
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!measureMode || files.length === 0) return;

      const container = containerRef.current;
      const camera = cameraRef.current;
      if (!container || !camera) return;

      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      raycasterRef.current.setFromCamera(mouse, camera);
      const visibleMeshes = files
        .filter((f) => f.visible)
        .map((f) => f.mesh);
      const intersects =
        raycasterRef.current.intersectObjects(visibleMeshes);

      if (intersects.length === 0) {
        clearMeasurement();
        setMeasureMode(false);
        return;
      }

      const point = intersects[0].point.clone();
      const group = measureGroupRef.current;

      // Marker sphere size from first visible mesh
      const firstMesh = visibleMeshes[0];
      const sphere = firstMesh.geometry.boundingSphere;
      const markerRadius = sphere ? sphere.radius * 0.015 : 0.5;

      const markerGeo = new THREE.SphereGeometry(markerRadius, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.copy(point);
      group.add(marker);

      const newPoint: MeasurePoint = { position: point, marker };

      if (measurePoints.length === 0) {
        setMeasurePoints([newPoint]);
        setMeasureDistance(null);
      } else if (measurePoints.length === 1) {
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
        clearMeasurement();
        setMeasureMode(false);
      }
    },
    [measureMode, measurePoints, clearMeasurement, files]
  );

  // Escape key exits measure mode
  useEffect(() => {
    if (!measureMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearMeasurement();
        setMeasureMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [measureMode, clearMeasurement]);

  const toggleMeasureMode = useCallback(() => {
    if (measureMode) {
      clearMeasurement();
    }
    setMeasureMode((prev) => !prev);
  }, [measureMode, clearMeasurement]);

  // ---------- Multi-file handlers ----------
  const handleSelectFile = useCallback((id: string) => {
    setActiveFileId(id);
  }, []);

  const handleToggleVisibility = useCallback(
    (id: string) => {
      setFiles((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f;
          f.mesh.visible = !f.visible;
          return { ...f, visible: !f.visible };
        })
      );
    },
    []
  );

  const handleRemoveFile = useCallback(
    (id: string) => {
      const scene = sceneRef.current;
      setFiles((prev) => {
        const file = prev.find((f) => f.id === id);
        if (file && scene) {
          scene.remove(file.mesh);
          file.geometry.dispose();
          (file.mesh.material as THREE.Material).dispose();
        }
        const next = prev.filter((f) => f.id !== id);
        // If we removed the active file, select the last remaining
        if (id === activeFileId) {
          setActiveFileId(next.length > 0 ? next[next.length - 1].id : null);
        }
        return next;
      });
    },
    [activeFileId]
  );

  // ---------- Repair info handler ----------
  const handleRepairInfo = useCallback(() => {
    if (!activeFile) return;
    if (showRepairPanel) {
      setShowRepairPanel(false);
      return;
    }
    const report = computeRepairInfo(activeFile.geometry);
    setRepairReport(report);
    setShowRepairPanel(true);
  }, [activeFile, showRepairPanel]);

  // ---------- Thickness handler ----------
  const handleThickness = useCallback(async () => {
    if (thicknessEnabled) {
      clearThickness();
      return;
    }
    if (!activeFile) return;

    const { geometry, mesh, id } = activeFile;
    const vertexCount = geometry.getAttribute("position").count;
    const sampleRate = vertexCount > 50000 ? Math.ceil(vertexCount / 50000) : 1;

    // Save original material
    originalMaterialsRef.current.set(
      id,
      mesh.material as THREE.MeshStandardMaterial
    );

    setThicknessEnabled(true);
    setThicknessProgress(0);

    // Need double-sided for raycasting back faces
    const origSide = (mesh.material as THREE.MeshStandardMaterial).side;
    (mesh.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;

    const result: ThicknessResult = await computeThickness(
      geometry,
      mesh,
      (pct) => setThicknessProgress(Math.round(pct)),
      sampleRate
    );

    // Restore side
    (mesh.material as THREE.MeshStandardMaterial).side = origSide;

    // Apply vertex colors
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(result.colors, 3)
    );

    const heatmapMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.1,
      roughness: 0.6,
    });
    mesh.material = heatmapMaterial;

    setThicknessRange({ min: result.min, max: result.max });
    setThicknessProgress(null);
  }, [activeFile, thicknessEnabled, clearThickness]);

  // ---------- Display file name (first file or active) ----------
  const displayFileName = activeFile?.name ?? null;

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-surface border border-border rounded-lg">
        {/* Color + BG */}
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-muted">Color</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
          />
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-muted">BG</span>
          <input
            type="color"
            value={bgColor}
            onChange={(e) => setBgColor(e.target.value)}
            className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
          />
        </label>

        <span className="w-px h-6 bg-border" />

        {/* Wireframe + Auto-Rotate */}
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
          onClick={() => setAutoRotate((prev) => !prev)}
          className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
            autoRotate
              ? "border-accent bg-accent/10 text-accent"
              : "border-border bg-surface hover:bg-surface-hover"
          }`}
        >
          Auto-Rotate
        </button>

        <span className="w-px h-6 bg-border" />

        {/* Reset View */}
        <button
          onClick={handleResetView}
          disabled={!hasAnyMesh}
          className="px-3 py-1.5 text-sm rounded-md border border-border bg-surface hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Reset View
        </button>

        <span className="w-px h-6 bg-border" />

        {/* Pro: Cross-Section */}
        <ProButton
          label="Cross-Section"
          isPro={isPro}
          onClick={() => setClippingEnabled((prev) => !prev)}
          disabled={!hasAnyMesh}
          active={clippingEnabled}
        />

        {/* Pro: Measure */}
        <ProButton
          label="Measure"
          isPro={isPro}
          onClick={toggleMeasureMode}
          disabled={!hasAnyMesh}
          active={measureMode}
        />

        {/* Pro: Scale */}
        <ProButton
          label="Scale"
          isPro={isPro}
          onClick={() => setScaleEnabled((prev) => !prev)}
          disabled={!hasAnyMesh}
          active={scaleEnabled}
        />

        {/* Pro: Repair Info */}
        <ProButton
          label="Repair Info"
          isPro={isPro}
          onClick={handleRepairInfo}
          disabled={!hasAnyMesh}
          active={showRepairPanel}
        />

        {/* Pro: Thickness */}
        <ProButton
          label="Thickness"
          isPro={isPro}
          onClick={handleThickness}
          disabled={!hasAnyMesh || thicknessProgress !== null}
          active={thicknessEnabled}
        >
          {thicknessProgress !== null
            ? `Analyzing ${thicknessProgress}%`
            : thicknessEnabled
              ? "Clear Heatmap"
              : "Thickness"}
        </ProButton>

        {/* Pro: Print Cost */}
        <ProButton
          label="Print Cost"
          isPro={isPro}
          onClick={() => setShowCostPanel((prev) => !prev)}
          disabled={!hasAnyMesh}
          active={showCostPanel}
        />

        <span className="w-px h-6 bg-border" />

        {/* Screenshot (free) */}
        <button
          onClick={handleScreenshot}
          disabled={!hasAnyMesh}
          className="px-3 py-1.5 text-sm rounded-md border border-border bg-surface hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Screenshot
        </button>

        {/* Pro: Export Animation */}
        <ProButton
          label="Export Animation"
          isPro={isPro}
          onClick={handleExportAnimation}
          disabled={!hasAnyMesh || isRecording}
          active={isRecording}
        >
          {isRecording ? "Recording..." : "Export Animation"}
        </ProButton>

        {/* Open File */}
        <label className="ml-auto px-3 py-1.5 text-sm rounded-md border border-border bg-surface hover:bg-surface-hover cursor-pointer transition-colors">
          Open File
          <input
            type="file"
            accept=".stl"
            multiple={isPro}
            onChange={handleFileInput}
            className="hidden"
          />
        </label>
      </div>

      {/* Cross-section slider */}
      {clippingEnabled && isPro && hasAnyMesh && (
        <div className="flex items-center gap-3 px-3 py-2 bg-surface border border-border rounded-lg">
          <span className="text-sm text-muted whitespace-nowrap">Clip Y</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.005}
            value={clipPosition}
            onChange={(e) => setClipPosition(parseFloat(e.target.value))}
            className="flex-1 accent-[#5BA8A0]"
          />
          <span className="text-sm text-muted tabular-nums w-24 text-right">
            {formatLength(
              clipBounds.min +
                clipPosition * (clipBounds.max - clipBounds.min),
              unit
            )}{" "}
            {unit}
          </span>
        </div>
      )}

      {/* Scale slider */}
      {scaleEnabled && isPro && hasAnyMesh && (
        <div className="flex items-center gap-3 px-3 py-2 bg-surface border border-border rounded-lg">
          <span className="text-sm text-muted whitespace-nowrap">Scale</span>
          <input
            type="range"
            min={0.1}
            max={10}
            step={0.1}
            value={scaleFactor}
            onChange={(e) => setScaleFactor(parseFloat(e.target.value))}
            className="flex-1 accent-[#5BA8A0]"
          />
          <input
            type="number"
            min={0.1}
            max={10}
            step={0.1}
            value={scaleFactor}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v >= 0.1 && v <= 10) setScaleFactor(v);
            }}
            className="w-16 px-2 py-1 text-sm text-right bg-transparent border border-border rounded tabular-nums"
          />
          <span className="text-sm text-muted">x</span>
          <button
            onClick={() => setScaleFactor(1.0)}
            className="px-2 py-1 text-xs rounded border border-border bg-surface hover:bg-surface-hover transition-colors"
          >
            Reset
          </button>
        </div>
      )}

      {/* File list panel (Pro multi-file) */}
      {isPro && files.length > 1 && (
        <FileListPanel
          files={files}
          activeFileId={activeFileId}
          unit={unit}
          onSelect={handleSelectFile}
          onToggleVisibility={handleToggleVisibility}
          onRemove={handleRemoveFile}
        />
      )}

      {/* Repair panel */}
      {showRepairPanel && repairReport && (
        <RepairPanel
          report={repairReport}
          onClose={() => setShowRepairPanel(false)}
        />
      )}

      {/* Print Cost Estimator panel */}
      {showCostPanel && isPro && displayMetrics && (
        <CostEstimatorPanel
          volume={displayMetrics.volume}
          unit={unit}
          onClose={() => setShowCostPanel(false)}
        />
      )}

      {/* Info bar */}
      {(displayFileName || displayDimensions) && (
        <div className="flex flex-wrap items-center gap-4 px-3 py-2 bg-surface/50 border border-border rounded-lg text-sm text-muted">
          {displayFileName && (
            <span>
              <span className="text-foreground font-medium">
                {displayFileName}
              </span>
            </span>
          )}
          {displayDimensions && (
            <span>
              {formatLength(displayDimensions.x, unit)} &times;{" "}
              {formatLength(displayDimensions.y, unit)} &times;{" "}
              {formatLength(displayDimensions.z, unit)} {unit}
            </span>
          )}
          {displayMetrics && isPro && (
            <>
              <span>
                Volume:{" "}
                <span className="text-foreground">
                  {formatVolume(displayMetrics.volume, unit)} {unit}&sup3;
                </span>
              </span>
              <span>
                Surface area:{" "}
                <span className="text-foreground">
                  {formatArea(displayMetrics.surfaceArea, unit)} {unit}&sup2;
                </span>
              </span>
            </>
          )}
          {displayMetrics && !isPro && (
            <>
              <span className="flex items-center gap-1.5">
                Volume <ProBadge feature="Volume" />
              </span>
              <span className="flex items-center gap-1.5">
                Surface area <ProBadge feature="Surface area" />
              </span>
            </>
          )}
          {thicknessEnabled && thicknessRange && (
            <span>
              Thickness:{" "}
              <span className="text-foreground">
                {formatLength(thicknessRange.min, unit)} &ndash;{" "}
                {formatLength(thicknessRange.max, unit)} {unit}
              </span>
            </span>
          )}

          {/* Unit toggle — right-aligned */}
          <div className="ml-auto flex items-center rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setUnit("mm")}
              className={`px-2 py-0.5 text-xs font-medium transition-colors ${
                unit === "mm"
                  ? "bg-accent/10 text-accent"
                  : "bg-surface text-muted hover:text-foreground"
              }`}
            >
              mm
            </button>
            <button
              onClick={() => setUnit("in")}
              className={`px-2 py-0.5 text-xs font-medium transition-colors ${
                unit === "in"
                  ? "bg-accent/10 text-accent"
                  : "bg-surface text-muted hover:text-foreground"
              }`}
            >
              in
            </button>
          </div>
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
            Distance: {formatLength(measureDistance, unit)} {unit}
          </div>
        )}

        {/* Measure mode hint */}
        {measureMode && measureDistance === null && hasAnyMesh && (
          <div className="absolute top-3 left-3 px-3 py-1.5 bg-black/50 text-white/70 text-xs rounded-lg pointer-events-none z-10">
            {measurePoints.length === 0
              ? "Click model to place first point \u00b7 Esc to exit"
              : "Click model to place second point \u00b7 Esc to exit"}
          </div>
        )}

        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-accent/10 border-2 border-dashed border-accent rounded-lg flex items-center justify-center pointer-events-none z-10">
            <span className="text-accent font-medium text-lg">
              Drop STL file{isPro ? "(s)" : ""} here
            </span>
          </div>
        )}

        {/* Empty state */}
        {files.length === 0 && !isDragging && (
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
          the selected unit (default mm, standard for 3D printing). STL files
          are unitless — values reflect the model&apos;s coordinate units.
        </p>
      </div>
    </div>
  );
}
