"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { computeMeshMetrics } from "@/components/stl-viewer/utils";

export interface StlMetrics {
  volumeCm3: number;
  x: number; // mm
  y: number;
  z: number;
}

// Bambu Studio-inspired palette.
const BG_TOP = "#52565e";
const BG_BOTTOM = "#2b2d33";
const PLATE_COLOR = 0x303338;
const GRID_CENTER = 0x7a7f87;
const GRID_LINE = 0x40434a;

function makeGradientTexture(top: string, bottom: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Bambu-Studio-style STL preview: the model sits on a build plate/grid over a
 * dark gradient background. Reports volume (cm³) + dimensions (mm) via onMetrics
 * using computeMeshMetrics (the same proven volume calc the quote uses).
 */
export default function StlPreview({
  file,
  onMetrics,
  colorHex = "#00ae42",
  bedX = 220,
  bedY = 220,
}: {
  file: File;
  onMetrics: (m: StlMetrics) => void;
  colorHex?: string;
  bedX?: number;
  bedY?: number;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const colorRef = useRef(colorHex);
  const onMetricsRef = useRef(onMetrics);

  useEffect(() => {
    onMetricsRef.current = onMetrics;
  }, [onMetrics]);

  useEffect(() => {
    colorRef.current = colorHex;
    if (materialRef.current) materialRef.current.color.set(colorHex);
  }, [colorHex]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let raf = 0;

    const scene = new THREE.Scene();
    scene.background = makeGradientTexture(BG_TOP, BG_BOTTOM);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 0.75);
    key.position.set(1, 1.5, 1);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-1, 0.5, -1);
    scene.add(fill);

    // Build plate + grid on the XZ ground plane (y = 0).
    const bed = Math.max(bedX, bedY, 50);
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(bedX, bedY),
      new THREE.MeshStandardMaterial({ color: PLATE_COLOR, roughness: 0.95, metalness: 0 }),
    );
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = -0.2;
    scene.add(plate);
    const grid = new THREE.GridHelper(bed, Math.max(4, Math.round(bed / 10)), GRID_CENTER, GRID_LINE);
    scene.add(grid);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let mesh: THREE.Mesh | null = null;

    const reader = new FileReader();
    reader.onload = () => {
      if (disposed) return;
      try {
        const geometry = new STLLoader().parse(reader.result as ArrayBuffer);
        // STLs for printing are Z-up; Three.js is Y-up — rotate so it stands on the plate.
        geometry.rotateX(-Math.PI / 2);
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        // Centre on the plate (X/Z) and rest the bottom on y = 0.
        geometry.translate(-center.x, -box.min.y, -center.z);

        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(colorRef.current),
          metalness: 0.0,
          roughness: 0.55,
        });
        materialRef.current = material;
        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        camera.position.set(maxDim * 1.1, maxDim * 1.0 + size.y * 0.3, maxDim * 1.5);
        controls.target.set(0, size.y / 2, 0);
        controls.update();

        const metrics = computeMeshMetrics(geometry); // mm³ (rotation/translation preserve volume)
        onMetricsRef.current({ volumeCm3: metrics.volume / 1000, x: size.x, y: size.y, z: size.z });
      } catch {
        /* invalid STL — parent handles errors */
      }
    };
    reader.readAsArrayBuffer(file);

    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      if (mesh) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      plate.geometry.dispose();
      (plate.material as THREE.Material).dispose();
      grid.dispose();
      (scene.background as THREE.CanvasTexture)?.dispose?.();
      materialRef.current = null;
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [file, bedX, bedY]);

  return <div ref={mountRef} className="h-full w-full" />;
}
