import type { PinDefinition, BoardComponent } from "./types";
import { FUNCTION_COLORS, getPinColor } from "./types";

interface InfoPanelProps {
  pin: PinDefinition | null;
  component: BoardComponent | null;
  chipFamily: string;
}

export default function InfoPanel({ pin, component, chipFamily }: InfoPanelProps) {
  if (pin) {
    return <PinDetail pin={pin} chipFamily={chipFamily} />;
  }
  if (component) {
    return <ComponentDetail component={component} />;
  }
  return <EmptyState />;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted">
      <svg className="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
      </svg>
      <p className="text-sm">Hover or click a pin to see details</p>
    </div>
  );
}

function PinDetail({ pin, chipFamily }: { pin: PinDefinition; chipFamily: string }) {
  const pinColor = getPinColor(pin);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-4 h-4 rounded-sm mt-0.5 shrink-0"
          style={{ backgroundColor: pinColor }}
        />
        <div className="min-w-0">
          <h3 className="font-semibold text-sm leading-tight">{pin.label}</h3>
          <p className="text-xs text-muted mt-0.5">
            Pin {pin.position} &middot; {pin.side === "left" ? "Left" : "Right"} side
            {pin.gpio !== null && ` \u00B7 GPIO${pin.gpio}`}
          </p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {pin.inputOnly && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Input Only
          </span>
        )}
        {pin.flashConnected && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
            Flash Connected
          </span>
        )}
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted">
          {chipFamily}
        </span>
      </div>

      {/* Functions */}
      <div>
        <h4 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
          Functions ({pin.functions.length})
        </h4>
        <div className="space-y-1.5">
          {pin.functions.map((fn, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs p-1.5 rounded bg-surface/50 border border-border/50"
            >
              <div
                className="w-2 h-2 rounded-full mt-1 shrink-0"
                style={{ backgroundColor: FUNCTION_COLORS[fn.category] }}
              />
              <div className="min-w-0">
                <span className="font-medium">{fn.label}</span>
                <p className="text-muted mt-0.5 leading-snug">{fn.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {pin.warnings.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
            Notes
          </h4>
          <div className="space-y-1.5">
            {pin.warnings.map((w, i) => (
              <div
                key={i}
                className={`text-xs p-2 rounded border leading-snug ${
                  w.severity === "danger"
                    ? "bg-red-500/5 border-red-500/20 text-red-400"
                    : w.severity === "warning"
                    ? "bg-amber-500/5 border-amber-500/20 text-amber-400"
                    : "bg-blue-500/5 border-blue-500/20 text-blue-400"
                }`}
              >
                {w.severity === "danger" && "⚠ "}
                {w.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ComponentDetail({ component }: { component: BoardComponent }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm">{component.label}</h3>
        <p className="text-xs text-muted mt-1 leading-snug">{component.description}</p>
      </div>

      <div>
        <h4 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
          Specifications
        </h4>
        <div className="space-y-1">
          {component.specs.map((spec, i) => (
            <div
              key={i}
              className="flex justify-between text-xs p-1.5 rounded bg-surface/50 border border-border/50"
            >
              <span className="text-muted">{spec.label}</span>
              <span className="font-medium text-right ml-2">{spec.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
