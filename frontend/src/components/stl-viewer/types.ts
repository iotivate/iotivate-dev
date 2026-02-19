import * as THREE from "three";

export interface Dimensions {
  x: number;
  y: number;
  z: number;
}

export interface MeshMetrics {
  volume: number;
  surfaceArea: number;
}

export interface MeasurePoint {
  position: THREE.Vector3;
  marker: THREE.Mesh;
}

export interface StlViewerProps {
  isPro?: boolean;
}

export interface RepairReport {
  triangleCount: number;
  vertexCount: number;
  openEdges: number;
  nonManifoldEdges: number;
  isWatertight: boolean;
  isManifold: boolean;
}

export interface LoadedFile {
  id: string;
  name: string;
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  dimensions: Dimensions;
  metrics: MeshMetrics;
  color: string;
  visible: boolean;
  scale: number;
}

export interface MaterialPreset {
  name: string;
  density: number; // g/cm³
}

export interface CostEstimate {
  weightGrams: number;
  filamentLengthMeters: number;
  costDollars: number;
}
