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

// A rounded rectangle (XY plane), centred on the origin.
function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const hw = w / 2, hh = h / 2;
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

// Bambu-style plate outline: rounded rect with a grip tab on the +X edge.
function platePath(w: number, h: number, r: number, tabDepth: number, tabWidth: number): THREE.Shape {
  const s = new THREE.Shape();
  const hw = w / 2, hh = h / 2, th = tabWidth / 2;
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, -th);
  s.lineTo(hw + tabDepth, -th + 4);
  s.lineTo(hw + tabDepth, th - 4);
  s.lineTo(hw, th);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
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
  const meshRef = useRef<THREE.Mesh | null>(null);
  const colorRef = useRef(colorHex);
  const onMetricsRef = useRef(onMetrics);

  // Rotate the model 90° about an axis, re-sit it on the plate, and re-report
  // dimensions (volume is unchanged by rotation).
  function rotate(axis: "x" | "y" | "z") {
    const mesh = meshRef.current;
    if (!mesh) return;
    const g = mesh.geometry;
    if (axis === "x") g.rotateX(Math.PI / 2);
    else if (axis === "y") g.rotateY(Math.PI / 2);
    else g.rotateZ(Math.PI / 2);
    g.computeBoundingBox();
    const box = g.boundingBox!;
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    g.translate(-center.x, -box.min.y, -center.z);
    g.computeVertexNormals();
    const m = computeMeshMetrics(g);
    onMetricsRef.current({ volumeCm3: m.volume / 1000, x: size.x, y: size.y, z: size.z });
  }

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
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 0.75);
    key.position.set(1, 1.5, 1);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-1, 0.5, -1);
    scene.add(fill);

    // Fancy build plate (Bambu-style): rounded plate with a grip tab, an inset
    // printable-area outline, a fine grid, and a green origin marker — all on the
    // XZ ground plane (y = 0).
    const bed = Math.max(bedX, bedY, 50);
    const plateMat = new THREE.MeshStandardMaterial({ color: PLATE_COLOR, roughness: 0.92, metalness: 0.08 });
    const plate = new THREE.Mesh(new THREE.ShapeGeometry(platePath(bedX + 26, bedY + 26, 14, 14, 46)), plateMat);
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = -0.3;
    scene.add(plate);

    const outlineMat = new THREE.LineBasicMaterial({ color: 0x6b7076 });
    const outline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(roundedRectShape(bedX, bedY, 6).getPoints(90)),
      outlineMat,
    );
    outline.rotation.x = -Math.PI / 2;
    outline.position.y = 0.02;
    scene.add(outline);

    const grid = new THREE.GridHelper(bed, Math.max(4, Math.round(bed / 10)), GRID_CENTER, GRID_LINE);
    grid.position.y = 0.01;
    scene.add(grid);

    const originMat = new THREE.MeshBasicMaterial({ color: 0x00ae42 });
    const origin = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 6), originMat);
    origin.position.set(-bedX / 2, 0.5, bedY / 2);
    scene.add(origin);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h); // updateStyle=true so the canvas fills its container
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
        meshRef.current = mesh;
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
      plateMat.dispose();
      outline.geometry.dispose();
      outlineMat.dispose();
      origin.geometry.dispose();
      originMat.dispose();
      grid.dispose();
      (scene.background as THREE.CanvasTexture)?.dispose?.();
      materialRef.current = null;
      meshRef.current = null;
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [file, bedX, bedY]);

  return (
    <div className="relative h-full w-full">
      <div ref={mountRef} className="h-full w-full" />
      <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg bg-black/40 px-1.5 py-1 backdrop-blur">
        <span className="px-1 text-[10px] font-medium uppercase tracking-wide text-white/70">Rotate</span>
        {(["x", "y", "z"] as const).map((axis) => (
          <button
            key={axis}
            type="button"
            onClick={() => rotate(axis)}
            title={`Rotate 90° around ${axis.toUpperCase()}`}
            className="flex h-6 w-6 items-center justify-center rounded bg-white/10 text-xs font-semibold text-white hover:bg-white/25"
          >
            {axis.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
