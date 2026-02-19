"use client";

import { useState, useMemo } from "react";
import type { Unit } from "./utils";
import { MATERIAL_PRESETS, computePrintEstimate } from "./utils";

interface CostEstimatorPanelProps {
  volume: number; // mm³ (already includes scaleFactor³)
  unit: Unit;
  onClose: () => void;
}

export default function CostEstimatorPanel({
  volume,
  onClose,
}: CostEstimatorPanelProps) {
  const [material, setMaterial] = useState("PLA");
  const [customDensity, setCustomDensity] = useState(1.24);
  const [infill, setInfill] = useState(20);
  const [diameter, setDiameter] = useState<1.75 | 2.85>(1.75);
  const [costPerKg, setCostPerKg] = useState(25.0);

  const density = useMemo(() => {
    if (material === "Custom") return customDensity;
    const preset = MATERIAL_PRESETS.find((p) => p.name === material);
    return preset?.density ?? 1.24;
  }, [material, customDensity]);

  const estimate = useMemo(
    () =>
      computePrintEstimate({
        volumeMm3: volume,
        infillPercent: infill,
        densityGPerCm3: density,
        filamentDiameterMm: diameter,
        costPerKg,
      }),
    [volume, infill, density, diameter, costPerKg]
  );

  return (
    <div className="px-3 py-2 bg-surface border border-border rounded-lg space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          Print Cost Estimate
        </span>
        <button
          onClick={onClose}
          className="text-muted hover:text-foreground text-sm transition-colors"
        >
          &times;
        </button>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {/* Material */}
        <label className="text-muted flex items-center">Material</label>
        <select
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          className="px-2 py-1 text-sm bg-transparent border border-border rounded text-foreground"
        >
          {MATERIAL_PRESETS.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
          <option value="Custom">Custom</option>
        </select>

        {/* Custom density (only when Custom selected) */}
        {material === "Custom" && (
          <>
            <label className="text-muted flex items-center">
              Density (g/cm&sup3;)
            </label>
            <input
              type="number"
              min={0.1}
              max={20}
              step={0.01}
              value={customDensity}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) setCustomDensity(v);
              }}
              className="w-full px-2 py-1 text-sm bg-transparent border border-border rounded tabular-nums text-foreground"
            />
          </>
        )}

        {/* Infill */}
        <label className="text-muted flex items-center">Infill</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={infill}
            onChange={(e) => setInfill(parseInt(e.target.value, 10))}
            className="flex-1 accent-[#5BA8A0]"
          />
          <span className="text-foreground tabular-nums w-10 text-right">
            {infill}%
          </span>
        </div>

        {/* Filament diameter */}
        <label className="text-muted flex items-center">Diameter</label>
        <div className="flex items-center rounded-md border border-border overflow-hidden">
          <button
            onClick={() => setDiameter(1.75)}
            className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${
              diameter === 1.75
                ? "bg-accent/10 text-accent"
                : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            1.75 mm
          </button>
          <button
            onClick={() => setDiameter(2.85)}
            className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${
              diameter === 2.85
                ? "bg-accent/10 text-accent"
                : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            2.85 mm
          </button>
        </div>

        {/* Cost per kg */}
        <label className="text-muted flex items-center">Cost</label>
        <div className="flex items-center gap-1">
          <span className="text-muted">$</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={costPerKg}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v >= 0) setCostPerKg(v);
            }}
            className="w-20 px-2 py-1 text-sm bg-transparent border border-border rounded tabular-nums text-foreground"
          />
          <span className="text-muted text-xs">/kg</span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Results */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <span className="text-muted">Weight</span>
        <span className="text-foreground tabular-nums">
          {estimate.weightGrams.toFixed(1)} g
        </span>
        <span className="text-muted">Filament</span>
        <span className="text-foreground tabular-nums">
          {estimate.filamentLengthMeters.toFixed(2)} m
        </span>
        <span className="text-muted">Est. Cost</span>
        <span className="text-foreground tabular-nums font-medium">
          ${estimate.costDollars.toFixed(2)}
        </span>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted/70">
        Rough estimate &mdash; actual cost depends on walls, supports, and
        slicer settings.
      </p>
    </div>
  );
}
