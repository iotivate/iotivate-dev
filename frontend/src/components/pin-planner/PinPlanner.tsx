"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type { Selection } from "./types";
import { BOARD_VARIANTS, DEFAULT_VARIANT_ID } from "./data";
import BoardSVG from "./BoardSVG";
import InfoPanel from "./InfoPanel";
import PinTooltip from "./PinTooltip";
import ModuleSelector from "./ModuleSelector";
import usePerspectiveTilt from "./usePerspectiveTilt";

export default function PinPlanner() {
  const [variantId, setVariantId] = useState(DEFAULT_VARIANT_ID);
  const [hoveredPin, setHoveredPin] = useState<number | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);

  const { ref: tiltRef, handleMouseMove: handleTiltMove, handleMouseLeave: handleTiltLeave } =
    usePerspectiveTilt<HTMLDivElement>();

  const variant = useMemo(
    () => BOARD_VARIANTS.find((v) => v.id === variantId) ?? BOARD_VARIANTS[0],
    [variantId]
  );

  // Reset selection when switching variants
  const handleVariantChange = useCallback((id: string) => {
    setVariantId(id);
    setSelection(null);
    setHoveredPin(null);
    setHoveredComponent(null);
    setShowTooltip(false);
  }, []);

  // Pin interactions
  const handlePinHover = useCallback((position: number | null) => {
    setHoveredPin(position);
    setShowTooltip(position !== null);
  }, []);

  const handlePinClick = useCallback(
    (position: number) => {
      setSelection((prev) => {
        if (prev?.type === "pin" && prev.index === position) return null;
        return { type: "pin", index: position };
      });
    },
    []
  );

  // Component interactions
  const handleComponentHover = useCallback((id: string | null) => {
    setHoveredComponent(id);
  }, []);

  const handleComponentClick = useCallback(
    (id: string) => {
      const idx = variant.components.findIndex((c) => c.id === id);
      if (idx === -1) return;
      setSelection((prev) => {
        if (prev?.type === "component" && prev.index === idx) return null;
        return { type: "component", index: idx };
      });
    },
    [variant.components]
  );

  // Track mouse for tooltip
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setTooltipPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelection(null);
        setShowTooltip(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Resolve what to show in the info panel
  const infoPanelPin = useMemo(() => {
    if (selection?.type === "pin") {
      return variant.pins.find((p) => p.position === selection.index) ?? null;
    }
    if (hoveredPin !== null) {
      return variant.pins.find((p) => p.position === hoveredPin) ?? null;
    }
    return null;
  }, [selection, hoveredPin, variant.pins]);

  const infoPanelComponent = useMemo(() => {
    if (infoPanelPin) return null;
    if (selection?.type === "component") {
      return variant.components[selection.index] ?? null;
    }
    if (hoveredComponent) {
      return variant.components.find((c) => c.id === hoveredComponent) ?? null;
    }
    return null;
  }, [infoPanelPin, selection, hoveredComponent, variant.components]);

  // Tooltip pin
  const tooltipPin = useMemo(() => {
    if (!showTooltip || hoveredPin === null) return null;
    return variant.pins.find((p) => p.position === hoveredPin) ?? null;
  }, [showTooltip, hoveredPin, variant.pins]);

  return (
    <div className="space-y-4">
      {/* Module selector */}
      <ModuleSelector
        variants={BOARD_VARIANTS}
        selectedId={variantId}
        onChange={handleVariantChange}
      />

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Board */}
        <div
          ref={tiltRef}
          className="transition-transform duration-200 ease-out"
          onMouseMove={handleTiltMove}
          onMouseLeave={(e) => {
            handleTiltLeave();
            // Only clear hover if leaving the board entirely
            const related = e.relatedTarget as HTMLElement | null;
            if (!related || !e.currentTarget.contains(related)) {
              handlePinHover(null);
              handleComponentHover(null);
              setShowTooltip(false);
            }
          }}
        >
          <div className="bg-surface/30 border border-border rounded-xl p-4 overflow-hidden">
            <BoardSVG
              variant={variant}
              hoveredPin={hoveredPin}
              selection={selection}
              hoveredComponent={hoveredComponent}
              onPinHover={handlePinHover}
              onPinClick={handlePinClick}
              onComponentHover={handleComponentHover}
              onComponentClick={handleComponentClick}
            />
          </div>
        </div>

        {/* Info Panel */}
        <div className="bg-surface/30 border border-border rounded-xl p-4 lg:max-h-[70vh] lg:overflow-y-auto">
          <InfoPanel
            pin={infoPanelPin}
            component={infoPanelComponent}
            chipFamily={variant.chipFamily}
          />
        </div>
      </div>

      {/* Tooltip */}
      {tooltipPin && <PinTooltip pin={tooltipPin} x={tooltipPos.x} y={tooltipPos.y} />}

      {/* Color legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-muted pt-2">
        <LegendItem color="#dc2626" label="Power" />
        <LegendItem color="#404040" label="Ground" />
        <LegendItem color="#4d7c0f" label="GPIO" />
        <LegendItem color="#1e40af" label="Input Only" />
        <LegendItem color="#991b1b" label="Flash" />
        <LegendItem color="#f59e0b" label="Enable" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}
