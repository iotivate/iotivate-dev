"use client";

import { useState, useMemo } from "react";
import type { Unit } from "./utils";
import { MATERIAL_PRESETS, computePrintEstimate } from "./utils";

interface CostEstimatorPanelProps {
  volume: number; // mm³ (already includes scaleFactor³)
  surfaceArea: number; // mm² (already includes scaleFactor²)
  unit: Unit;
  onClose: () => void;
}

function formatTime(hours: number): string {
  if (hours < 1 / 60) return "< 1 min";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function CostEstimatorPanel({
  volume,
  surfaceArea,
  onClose,
}: CostEstimatorPanelProps) {
  // Material settings
  const [material, setMaterial] = useState("PLA");
  const [customDensity, setCustomDensity] = useState(1.24);
  const [infill, setInfill] = useState(20);
  const [wallThickness, setWallThickness] = useState(1.2);
  const [diameter, setDiameter] = useState<1.75 | 2.85>(1.75);
  const [costPerKg, setCostPerKg] = useState(25.0);

  // Machine settings
  const [printSpeed, setPrintSpeed] = useState(50);
  const [printerWatts, setPrinterWatts] = useState(200);
  const [electricityRate, setElectricityRate] = useState(0.12);
  const [laborRate, setLaborRate] = useState(0);
  const [markup, setMarkup] = useState(0);

  const density = useMemo(() => {
    if (material === "Custom") return customDensity;
    const preset = MATERIAL_PRESETS.find((p) => p.name === material);
    return preset?.density ?? 1.24;
  }, [material, customDensity]);

  const estimate = useMemo(
    () =>
      computePrintEstimate({
        volumeMm3: volume,
        surfaceAreaMm2: surfaceArea,
        infillPercent: infill,
        wallThicknessMm: wallThickness,
        densityGPerCm3: density,
        filamentDiameterMm: diameter,
        costPerKg,
        printSpeedMmPerS: printSpeed,
        printerWatts,
        electricityPerKwh: electricityRate,
        laborPerHour: laborRate,
        markupPercent: markup,
      }),
    [
      volume, surfaceArea, infill, wallThickness, density, diameter,
      costPerKg, printSpeed, printerWatts, electricityRate, laborRate, markup,
    ]
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

      {/* Material inputs */}
      <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <label className="text-muted flex items-center" title="Filament material type — each has a different density that affects weight and cost">Material</label>
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

        {material === "Custom" && (
          <>
            <label className="text-muted flex items-center" title="Material density in grams per cubic centimeter — determines weight from volume">
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

        <label className="text-muted flex items-center" title="Percentage of the interior filled with material — 20% is typical, 100% is solid">Infill</label>
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

        <label className="text-muted flex items-center" title="Shell/wall thickness — the solid outer perimeter of the print (e.g. 3 perimeters at 0.4mm = 1.2mm)">Walls</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0.4}
            max={5}
            step={0.4}
            value={wallThickness}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v >= 0.4 && v <= 5) setWallThickness(v);
            }}
            className="w-20 px-2 py-1 text-sm bg-transparent border border-border rounded tabular-nums text-foreground"
          />
          <span className="text-muted text-xs">mm</span>
        </div>

        <label className="text-muted flex items-center" title="Filament diameter — most printers use 1.75mm, some older models use 2.85mm">Diameter</label>
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

        <label className="text-muted flex items-center" title="Price you paid for a 1kg spool of filament">Filament</label>
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
          <span className="text-muted text-xs">/1kg</span>
        </div>
      </div>

      {/* Machine & overhead inputs */}
      <div className="border-t border-border" />
      <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <label className="text-muted flex items-center" title="Average print speed from your slicer — used to estimate total print time">Print speed</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={10}
            max={300}
            step={5}
            value={printSpeed}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 10) setPrintSpeed(v);
            }}
            className="w-20 px-2 py-1 text-sm bg-transparent border border-border rounded tabular-nums text-foreground"
          />
          <span className="text-muted text-xs">mm/s</span>
        </div>

        <label className="text-muted flex items-center" title="Power consumption of your printer in watts — typically 150-300W for FDM printers">Printer power</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={2000}
            step={10}
            value={printerWatts}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 0) setPrinterWatts(v);
            }}
            className="w-20 px-2 py-1 text-sm bg-transparent border border-border rounded tabular-nums text-foreground"
          />
          <span className="text-muted text-xs">W</span>
        </div>

        <label className="text-muted flex items-center" title="Your electricity rate — check your utility bill for the cost per kilowatt-hour">Electricity</label>
        <div className="flex items-center gap-1">
          <span className="text-muted">$</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={electricityRate}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v >= 0) setElectricityRate(v);
            }}
            className="w-20 px-2 py-1 text-sm bg-transparent border border-border rounded tabular-nums text-foreground"
          />
          <span className="text-muted text-xs">/kWh</span>
        </div>

        <label className="text-muted flex items-center" title="Hourly rate for your time — setup, monitoring, post-processing (set to 0 for personal use)">Labor</label>
        <div className="flex items-center gap-1">
          <span className="text-muted">$</span>
          <input
            type="number"
            min={0}
            step={1}
            value={laborRate}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v >= 0) setLaborRate(v);
            }}
            className="w-20 px-2 py-1 text-sm bg-transparent border border-border rounded tabular-nums text-foreground"
          />
          <span className="text-muted text-xs">/hr</span>
        </div>

        <label className="text-muted flex items-center" title="Profit margin added on top of total cost — useful if you sell prints (set to 0 for personal use)">Markup</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={500}
            step={5}
            value={markup}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 0) setMarkup(v);
            }}
            className="w-20 px-2 py-1 text-sm bg-transparent border border-border rounded tabular-nums text-foreground"
          />
          <span className="text-muted text-xs">%</span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Results */}
      <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <span className="text-muted">Weight</span>
        <span className="text-foreground tabular-nums">
          {estimate.weightGrams.toFixed(1)} g
        </span>
        <span className="text-muted">Filament</span>
        <span className="text-foreground tabular-nums">
          {estimate.filamentLengthMeters.toFixed(2)} m
        </span>
        <span className="text-muted">Est. time</span>
        <span className="text-foreground tabular-nums">
          {formatTime(estimate.printTimeHours)}
        </span>

        <div className="col-span-2 border-t border-border/50 my-1" />

        <span className="text-muted">Filament</span>
        <span className="text-foreground tabular-nums">
          ${estimate.filamentCost.toFixed(2)}
        </span>
        <span className="text-muted">Electricity</span>
        <span className="text-foreground tabular-nums">
          ${estimate.electricityCost.toFixed(2)}
        </span>
        {estimate.laborCost > 0 && (
          <>
            <span className="text-muted">Labor</span>
            <span className="text-foreground tabular-nums">
              ${estimate.laborCost.toFixed(2)}
            </span>
          </>
        )}
        {markup > 0 && (
          <>
            <span className="text-muted">Markup ({markup}%)</span>
            <span className="text-foreground tabular-nums">
              ${(estimate.totalCost - estimate.subtotal).toFixed(2)}
            </span>
          </>
        )}

        <div className="col-span-2 border-t border-border/50 my-1" />

        <span className="text-foreground font-medium">Total</span>
        <span className="text-foreground tabular-nums font-medium">
          ${estimate.totalCost.toFixed(2)}
        </span>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted/70">
        Rough estimate &mdash; actual cost depends on slicer settings,
        supports, and machine specifics.
      </p>
    </div>
  );
}
