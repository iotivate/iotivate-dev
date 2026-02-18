import type { PinDefinition } from "./types";
import { getPinColor } from "./types";

interface PinPadProps {
  pin: PinDefinition;
  x: number;
  y: number;
  width: number;
  height: number;
  isHovered: boolean;
  isSelected: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}

export default function PinPad({
  pin,
  x,
  y,
  width,
  height,
  isHovered,
  isSelected,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: PinPadProps) {
  const baseColor = getPinColor(pin);
  const isHighlighted = isHovered || isSelected;
  const labelX = pin.side === "left" ? x - 6 : x + width + 6;
  const textAnchor = pin.side === "left" ? "end" : "start";

  const inset = 3;

  return (
    <g
      data-pin-index={pin.position}
      className="cursor-pointer"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {/* Glow filter for selected/hovered */}
      {isHighlighted && (
        <rect
          x={x - 3}
          y={y - 3}
          width={width + 6}
          height={height + 6}
          rx={4}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2}
          opacity={0.7}
        />
      )}

      {/* Outer metallic frame */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={3}
        fill="url(#pin-metallic)"
        stroke={isHighlighted ? "var(--color-accent)" : "#8a7a40"}
        strokeWidth={0.75}
        className="transition-all duration-150"
      />

      {/* Inner color fill */}
      <rect
        x={x + inset}
        y={y + inset}
        width={width - inset * 2}
        height={height - inset * 2}
        rx={2}
        fill={isHighlighted ? "var(--color-accent)" : baseColor}
        opacity={isHighlighted ? 1 : 0.85}
        className="transition-all duration-150"
      />

      {/* Flash connected hatching */}
      {pin.flashConnected && !isHighlighted && (
        <>
          <line
            x1={x + 3}
            y1={y}
            x2={x + width}
            y2={y + height - 3}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={1}
          />
          <line
            x1={x + 10}
            y1={y}
            x2={x + width}
            y2={y + height - 10}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={1}
          />
        </>
      )}

      {/* Pin label */}
      <text
        x={labelX}
        y={y + height / 2}
        textAnchor={textAnchor}
        dominantBaseline="central"
        className="select-none pointer-events-none"
        fill="currentColor"
        fontSize={10}
        fontFamily="ui-monospace, monospace"
        opacity={isHighlighted ? 1 : 0.8}
        fontWeight={isHighlighted ? 600 : 400}
      >
        {pin.label}
      </text>
    </g>
  );
}
