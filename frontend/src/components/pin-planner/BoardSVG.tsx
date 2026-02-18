import type { BoardVariant, Selection } from "./types";
import PinPad from "./PinPad";

interface BoardSVGProps {
  variant: BoardVariant;
  hoveredPin: number | null;
  selection: Selection | null;
  hoveredComponent: string | null;
  onPinHover: (index: number | null) => void;
  onPinClick: (index: number) => void;
  onComponentHover: (id: string | null) => void;
  onComponentClick: (id: string) => void;
}

export default function BoardSVG({
  variant,
  hoveredPin,
  selection,
  hoveredComponent,
  onPinHover,
  onPinClick,
  onComponentHover,
  onComponentClick,
}: BoardSVGProps) {
  const { layout, pins, components } = variant;

  const leftPins = pins.filter((p) => p.side === "left");
  const rightPins = pins.filter((p) => p.side === "right");

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="w-full h-auto max-h-[70vh]"
      role="img"
      aria-label={`${variant.name} pin diagram`}
    >
      <defs>
        {/* Board gradient */}
        <linearGradient id="board-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="[stop-color:#1a5c2a] dark:[stop-color:#0f3d1a]" />
          <stop offset="100%" className="[stop-color:#145222] dark:[stop-color:#0a2e14]" />
        </linearGradient>

        {/* Silkscreen style for components */}
        <filter id="silkscreen-glow">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* PCB Board */}
      <rect
        x={layout.boardX}
        y={layout.boardY}
        width={layout.boardWidth}
        height={layout.boardHeight}
        rx={layout.cornerRadius}
        fill="url(#board-gradient)"
        stroke="#0d3b15"
        strokeWidth={2}
        className="dark:stroke-[#0a2e11]"
      />

      {/* PCB edge highlight */}
      <rect
        x={layout.boardX + 1}
        y={layout.boardY + 1}
        width={layout.boardWidth - 2}
        height={layout.boardHeight - 2}
        rx={layout.cornerRadius - 1}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={1}
      />

      {/* Components (silkscreen outlines) */}
      {components.map((comp) => {
        const isHovered = hoveredComponent === comp.id;
        const isSelected =
          selection?.type === "component" &&
          components[selection.index]?.id === comp.id;
        const isHighlighted = isHovered || isSelected;

        return (
          <g
            key={comp.id}
            className="cursor-pointer"
            onMouseEnter={() => onComponentHover(comp.id)}
            onMouseLeave={() => onComponentHover(null)}
            onClick={() => onComponentClick(comp.id)}
          >
            <rect
              x={comp.bounds.x}
              y={comp.bounds.y}
              width={comp.bounds.w}
              height={comp.bounds.h}
              rx={3}
              fill={isHighlighted ? "rgba(91,168,160,0.15)" : "rgba(255,255,255,0.03)"}
              stroke={isHighlighted ? "var(--color-accent)" : "rgba(255,255,255,0.2)"}
              strokeWidth={isHighlighted ? 1.5 : 0.75}
              strokeDasharray={comp.id.startsWith("btn") ? "3 2" : "none"}
              className="transition-all duration-150"
            />
            <text
              x={comp.bounds.x + comp.bounds.w / 2}
              y={comp.bounds.y + comp.bounds.h / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill={isHighlighted ? "var(--color-accent)" : "rgba(255,255,255,0.45)"}
              fontSize={comp.bounds.w > 100 ? 10 : 7}
              fontFamily="ui-monospace, monospace"
              className="select-none pointer-events-none transition-colors duration-150"
            >
              {comp.label}
            </text>
          </g>
        );
      })}

      {/* Left-side pins */}
      {leftPins.map((pin, i) => (
        <PinPad
          key={`l-${pin.position}`}
          pin={pin}
          x={layout.leftPinX}
          y={layout.pinStartY + i * layout.pinSpacing}
          width={layout.pinWidth}
          height={layout.pinHeight}
          isHovered={hoveredPin === pin.position}
          isSelected={
            selection?.type === "pin" && selection.index === pin.position
          }
          onMouseEnter={() => onPinHover(pin.position)}
          onMouseLeave={() => onPinHover(null)}
          onClick={() => onPinClick(pin.position)}
        />
      ))}

      {/* Right-side pins */}
      {rightPins.map((pin, i) => (
        <PinPad
          key={`r-${pin.position}`}
          pin={pin}
          x={layout.rightPinX}
          y={layout.pinStartY + i * layout.pinSpacing}
          width={layout.pinWidth}
          height={layout.pinHeight}
          isHovered={hoveredPin === pin.position}
          isSelected={
            selection?.type === "pin" && selection.index === pin.position
          }
          onMouseEnter={() => onPinHover(pin.position)}
          onMouseLeave={() => onPinHover(null)}
          onClick={() => onPinClick(pin.position)}
        />
      ))}

      {/* Pin position numbers (small, on the board edge) */}
      {leftPins.map((pin, i) => (
        <text
          key={`ln-${pin.position}`}
          x={layout.leftPinX + layout.pinWidth + 4}
          y={layout.pinStartY + i * layout.pinSpacing + layout.pinHeight / 2}
          dominantBaseline="central"
          fill="rgba(255,255,255,0.25)"
          fontSize={7}
          fontFamily="ui-monospace, monospace"
          className="select-none pointer-events-none"
        >
          {pin.position}
        </text>
      ))}
      {rightPins.map((pin, i) => (
        <text
          key={`rn-${pin.position}`}
          x={layout.rightPinX - 4}
          y={layout.pinStartY + i * layout.pinSpacing + layout.pinHeight / 2}
          textAnchor="end"
          dominantBaseline="central"
          fill="rgba(255,255,255,0.25)"
          fontSize={7}
          fontFamily="ui-monospace, monospace"
          className="select-none pointer-events-none"
        >
          {pin.position}
        </text>
      ))}
    </svg>
  );
}
