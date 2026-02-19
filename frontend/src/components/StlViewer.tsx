"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface Dimensions {
  x: number;
  y: number;
  z: number;
}

export default function StlViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const frameRef = useRef<number>(0);

  const [fileName, setFileName] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);
  const [color, setColor] = useState("#5BA8A0");
  const [wireframe, setWireframe] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Three.js scene
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

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
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

  const fitCameraToObject = useCallback(
    (mesh: THREE.Mesh) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;

      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const distance = maxDim / (2 * Math.tan(fov / 2)) * 1.5;

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
        const grid = new THREE.GridHelper(
          gridSize,
          20,
          0x444466,
          0x333355
        );
        grid.position.y = box.min.y;
        scene.add(grid);
        gridRef.current = grid;
      }
    },
    []
  );

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
    [color, wireframe, fitCameraToObject]
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
        className="relative w-full rounded-lg border border-border overflow-hidden"
        style={{ height: "min(70vh, 600px)" }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

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
