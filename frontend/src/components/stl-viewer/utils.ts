import * as THREE from "three";
import type { MeshMetrics, RepairReport, MaterialPreset, CostEstimate } from "./types";

// ---------- Color palette for multi-file ----------

export const FILE_PALETTE = [
  "#5BA8A0", // teal (brand)
  "#E8855E", // coral
  "#7B9FD4", // steel blue
  "#D4A05B", // gold
  "#9B7BD4", // lavender
  "#5BC28E", // mint
  "#D47B8E", // rose
  "#8ED45B", // lime
];

// ---------- Mesh metrics ----------

export function computeMeshMetrics(
  geometry: THREE.BufferGeometry
): MeshMetrics {
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

// ---------- Repair analysis ----------

export function computeRepairInfo(
  geometry: THREE.BufferGeometry
): RepairReport {
  const pos = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const triCount = index ? index.count / 3 : pos.count / 3;
  const vertexCount = pos.count;

  // Build edge → face count map.  Edge key = sorted vertex-index pair.
  const edgeMap = new Map<string, number>();

  function addEdge(a: number, b: number) {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    edgeMap.set(key, (edgeMap.get(key) ?? 0) + 1);
  }

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
    addEdge(ia, ib);
    addEdge(ib, ic);
    addEdge(ic, ia);
  }

  let openEdges = 0;
  let nonManifoldEdges = 0;

  for (const count of edgeMap.values()) {
    if (count === 1) openEdges++;
    else if (count > 2) nonManifoldEdges++;
  }

  return {
    triangleCount: triCount,
    vertexCount,
    openEdges,
    nonManifoldEdges,
    isWatertight: openEdges === 0,
    isManifold: nonManifoldEdges === 0,
  };
}

// ---------- Unit conversion ----------

const MM_PER_INCH = 25.4;

export type Unit = "mm" | "in";

export function convertLength(mm: number, unit: Unit): number {
  return unit === "in" ? mm / MM_PER_INCH : mm;
}

export function convertArea(mm2: number, unit: Unit): number {
  return unit === "in" ? mm2 / (MM_PER_INCH * MM_PER_INCH) : mm2;
}

export function convertVolume(mm3: number, unit: Unit): number {
  return unit === "in"
    ? mm3 / (MM_PER_INCH * MM_PER_INCH * MM_PER_INCH)
    : mm3;
}

export function formatLength(mm: number, unit: Unit): string {
  const v = convertLength(mm, unit);
  return unit === "in" ? v.toFixed(3) : v.toFixed(2);
}

export function formatArea(mm2: number, unit: Unit): string {
  const v = convertArea(mm2, unit);
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatVolume(mm3: number, unit: Unit): string {
  const v = convertVolume(mm3, unit);
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function unitLabel(unit: Unit): string {
  return unit;
}

// ---------- Print cost estimation ----------

export const MATERIAL_PRESETS: MaterialPreset[] = [
  { name: "PLA", density: 1.24 },
  { name: "ABS", density: 1.04 },
  { name: "PETG", density: 1.27 },
  { name: "TPU", density: 1.21 },
  { name: "Nylon", density: 1.14 },
];

export function computePrintEstimate(opts: {
  volumeMm3: number;
  surfaceAreaMm2: number;
  infillPercent: number;
  wallThicknessMm: number;
  densityGPerCm3: number;
  filamentDiameterMm: number;
  costPerKg: number;
}): CostEstimate {
  const {
    volumeMm3, surfaceAreaMm2, infillPercent, wallThicknessMm,
    densityGPerCm3, filamentDiameterMm, costPerKg,
  } = opts;

  // Shell volume = surface area × wall thickness (approximation).
  // Capped to total volume so thin/small parts don't overshoot.
  const shellVolumeMm3 = Math.min(surfaceAreaMm2 * wallThicknessMm, volumeMm3);
  const interiorVolumeMm3 = volumeMm3 - shellVolumeMm3;

  // Shell is solid; only interior gets the infill percentage
  const effectiveVolumeMm3 = shellVolumeMm3 + interiorVolumeMm3 * (infillPercent / 100);
  const effectiveVolumeCm3 = effectiveVolumeMm3 / 1000;
  const weightGrams = effectiveVolumeCm3 * densityGPerCm3;

  // Filament cross-section area in mm²
  const radiusMm = filamentDiameterMm / 2;
  const crossSectionMm2 = Math.PI * radiusMm * radiusMm;
  // Volume of filament per mm of length = crossSection * 1mm (in mm³)
  // Weight per mm of filament = crossSectionMm2 * 1mm / 1000 (cm³) * density (g/cm³)
  // So length_mm = weightGrams / (densityGPerCm3 * crossSectionMm2 / 1000)
  const filamentLengthMm = weightGrams / (densityGPerCm3 * crossSectionMm2 / 1000);
  const filamentLengthMeters = filamentLengthMm / 1000;

  const costDollars = (weightGrams / 1000) * costPerKg;

  return { weightGrams, filamentLengthMeters, costDollars };
}

// ---------- Thickness analysis ----------

export interface ThicknessResult {
  min: number;
  max: number;
  colors: Float32Array;
}

export async function computeThickness(
  geometry: THREE.BufferGeometry,
  mesh: THREE.Mesh,
  onProgress: (pct: number) => void,
  sampleRate: number = 1
): Promise<ThicknessResult> {
  const pos = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const count = pos.count;

  const raycaster = new THREE.Raycaster();
  const thicknessValues = new Float32Array(count);
  let minThick = Infinity;
  let maxThick = 0;

  const CHUNK = 500;

  for (let start = 0; start < count; start += CHUNK) {
    const end = Math.min(start + CHUNK, count);

    for (let i = start; i < end; i += sampleRate) {
      const origin = new THREE.Vector3().fromBufferAttribute(pos, i);
      // Transform to world space
      origin.applyMatrix4(mesh.matrixWorld);

      const normal = new THREE.Vector3()
        .fromBufferAttribute(normals, i)
        .normalize();
      // Transform normal
      normal.transformDirection(mesh.matrixWorld);

      // Cast ray along inverted normal (into the mesh)
      raycaster.set(origin, normal.negate());
      raycaster.far = Infinity;

      // We need the back faces — set backface culling off temporarily
      const intersects = raycaster.intersectObject(mesh);

      if (intersects.length > 0) {
        const dist = intersects[0].distance;
        thicknessValues[i] = dist;
        if (dist < minThick) minThick = dist;
        if (dist > maxThick) maxThick = dist;
      } else {
        thicknessValues[i] = -1; // no hit
      }
    }

    // Fill in skipped vertices via nearest sampled value
    if (sampleRate > 1) {
      for (let i = start; i < end; i++) {
        if (i % sampleRate !== 0) {
          // Copy from nearest sampled vertex
          const nearest = Math.round(i / sampleRate) * sampleRate;
          thicknessValues[i] =
            nearest < count ? thicknessValues[nearest] : thicknessValues[start];
        }
      }
    }

    onProgress(Math.min((end / count) * 100, 100));
    // Yield to UI thread
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  if (minThick === Infinity) minThick = 0;

  // Build vertex colors (red=thin → yellow → green=thick)
  const colors = new Float32Array(count * 3);
  const range = maxThick - minThick || 1;

  for (let i = 0; i < count; i++) {
    const t = thicknessValues[i] < 0 ? 0 : (thicknessValues[i] - minThick) / range;
    // Red(0) → Yellow(0.5) → Green(1)
    if (t < 0.5) {
      colors[i * 3] = 1;
      colors[i * 3 + 1] = t * 2;
      colors[i * 3 + 2] = 0;
    } else {
      colors[i * 3] = 1 - (t - 0.5) * 2;
      colors[i * 3 + 1] = 1;
      colors[i * 3 + 2] = 0;
    }
  }

  return { min: minThick, max: maxThick, colors };
}
