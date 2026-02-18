import type { PinDefinition } from "./types";
import { getPinColor } from "./types";

interface PinTooltipProps {
  pin: PinDefinition;
  x: number;
  y: number;
}

export default function PinTooltip({ pin, x, y }: PinTooltipProps) {
  const pinColor = getPinColor(pin);
  const functionLabels = pin.functions
    .filter((f) => f.category !== "gpio")
    .map((f) => f.label)
    .slice(0, 3);

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: x + 12,
        top: y - 8,
        transform: "translateY(-100%)",
      }}
    >
      <div className="bg-zinc-900 dark:bg-zinc-800 text-white text-xs rounded-lg shadow-xl border border-zinc-700 px-3 py-2 max-w-[220px]">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ backgroundColor: pinColor }}
          />
          <span className="font-semibold">{pin.label}</span>
          {pin.gpio !== null && (
            <span className="text-zinc-400 ml-auto">GPIO{pin.gpio}</span>
          )}
        </div>

        {functionLabels.length > 0 && (
          <div className="text-zinc-400 leading-snug">
            {functionLabels.join(" \u00B7 ")}
          </div>
        )}

        {pin.inputOnly && (
          <div className="text-blue-400 mt-1 text-[10px]">Input only</div>
        )}
        {pin.flashConnected && (
          <div className="text-red-400 mt-1 text-[10px]">Flash connected — avoid</div>
        )}

        {/* Arrow */}
        <div className="absolute left-3 bottom-0 translate-y-full w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-zinc-900 dark:border-t-zinc-800" />
      </div>
    </div>
  );
}
