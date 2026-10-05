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

/**
 * Compact STL viewer for the print studio: renders the model and reports volume
 * (cm³) + bounding-box dimensions (mm) via onMetrics. Reuses computeMeshMetrics
 * (signed-tetrahedra volume) so the quote math is the same proven code.
 * - colour updates live (no reload) via a material ref
 * - resizes with its container (ResizeObserver) so fullscreen works
 */
export default function StlPreview({
  file,
  onMetrics,
  colorHex = "#5BA8A0",
}: {
  file: File;
  onMetrics: (m: StlMetrics) => void;
  colorHex?: string;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const colorRef = useRef(colorHex);
  const onMetricsRef = useRef(onMetrics);

  useEffect(() => {
    onMetricsRef.current = onMetrics;
  }, [onMetrics]);

  // Live colour update without re-parsing the model.
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
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(1, 1, 1);
    scene.add(dir);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    let mesh: THREE.Mesh | null = null;

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

    const reader = new FileReader();
    reader.onload = () => {
      if (disposed) return;
      try {
        const geometry = new STLLoader().parse(reader.result as ArrayBuffer);
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);

        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(colorRef.current),
          metalness: 0.1,
          roughness: 0.7,
        });
        materialRef.current = material;
        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        camera.position.set(maxDim * 1.4, maxDim * 1.1, maxDim * 1.6);
        camera.lookAt(0, 0, 0);
        controls.update();

        const metrics = computeMeshMetrics(geometry); // mm³
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
      materialRef.current = null;
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [file]);

  return <div ref={mountRef} className="h-full w-full" />;
}
