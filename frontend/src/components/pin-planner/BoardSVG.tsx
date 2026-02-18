import type { BoardComponent, BoardVariant, Selection } from "./types";
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

function ComponentRenderer({
  comp,
  isHighlighted,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  comp: BoardComponent;
  isHighlighted: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  const { x, y, w, h } = comp.bounds;
  const cx = x + w / 2;
  const cy = y + h / 2;

  const wrapperProps = {
    className: "cursor-pointer",
    onMouseEnter,
    onMouseLeave,
    onClick,
    "data-component-id": comp.id,
  };

  // Invisible hit area for reliable click targeting
  const hitArea = (
    <rect x={x} y={y} width={w} height={h} fill="transparent" />
  );

  switch (comp.type) {
    case "chip": {
      const pinDotSpacing = 12;
      const pinDotsLeft = Math.floor(h / pinDotSpacing) - 1;
      const pinDotsRight = pinDotsLeft;
      const pinDotsBottom = Math.floor(w / pinDotSpacing) - 1;
      return (
        <g {...wrapperProps}>
          {hitArea}
          {/* IC body */}
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={4}
            fill="url(#chip-body)"
            stroke={isHighlighted ? "var(--color-accent)" : "#1a1a1a"}
            strokeWidth={isHighlighted ? 2 : 1}
          />
          {/* Pin-1 dot marker */}
          <circle cx={x + 10} cy={y + 10} r={3} fill="#555" />
          {/* Peripheral pin dots — left edge */}
          {Array.from({ length: pinDotsLeft }).map((_, i) => (
            <rect
              key={`cl-${i}`}
              x={x - 2}
              y={y + 14 + i * pinDotSpacing}
              width={4}
              height={6}
              rx={1}
              fill="#888"
            />
          ))}
          {/* Right edge */}
          {Array.from({ length: pinDotsRight }).map((_, i) => (
            <rect
              key={`cr-${i}`}
              x={x + w - 2}
              y={y + 14 + i * pinDotSpacing}
              width={4}
              height={6}
              rx={1}
              fill="#888"
            />
          ))}
          {/* Bottom edge */}
          {Array.from({ length: pinDotsBottom }).map((_, i) => (
            <rect
              key={`cb-${i}`}
              x={x + 14 + i * pinDotSpacing}
              y={y + h - 2}
              width={6}
              height={4}
              rx={1}
              fill="#888"
            />
          ))}
          {/* Silkscreen label */}
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            dominantBaseline="central"
            fill={isHighlighted ? "var(--color-accent)" : "rgba(255,255,255,0.7)"}
            fontSize={9}
            fontFamily="ui-monospace, monospace"
            fontWeight={500}
            className="select-none pointer-events-none"
          >
            {comp.label}
          </text>
          {/* Chip family sub-label */}
          <text
            x={cx}
            y={cy + 8}
            textAnchor="middle"
            dominantBaseline="central"
            fill="rgba(255,255,255,0.35)"
            fontSize={7}
            fontFamily="ui-monospace, monospace"
            className="select-none pointer-events-none"
          >
            SoC Module
          </text>
        </g>
      );
    }

    case "usb-micro": {
      // Trapezoidal USB-Micro connector shape
      const inset = 6;
      const shellPath = `M${x},${y + h} L${x},${y + 3} Q${x},${y} ${x + 3},${y} L${x + w - 3},${y} Q${x + w},${y} ${x + w},${y + 3} L${x + w},${y + h} L${x + w - inset},${y + h - 4} L${x + inset},${y + h - 4} Z`;
      return (
        <g {...wrapperProps}>
          {hitArea}
          {/* Metallic shell */}
          <path
            d={shellPath}
            fill="url(#usb-metallic)"
            stroke={isHighlighted ? "var(--color-accent)" : "#666"}
            strokeWidth={isHighlighted ? 1.5 : 0.75}
          />
          {/* Inner cavity */}
          <rect
            x={x + inset + 2}
            y={y + 5}
            width={w - (inset + 2) * 2}
            height={h - 14}
            rx={2}
            fill="#1a1a1a"
          />
          {/* Label */}
          <text
            x={cx}
            y={y - 5}
            textAnchor="middle"
            dominantBaseline="auto"
            fill={isHighlighted ? "var(--color-accent)" : "rgba(255,255,255,0.45)"}
            fontSize={6}
            fontFamily="ui-monospace, monospace"
            className="select-none pointer-events-none"
          >
            {comp.label}
          </text>
        </g>
      );
    }

    case "usb-c": {
      // Pill-shaped USB-C connector
      const rr = h / 2;
      return (
        <g {...wrapperProps}>
          {hitArea}
          {/* Metallic shell */}
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={rr}
            fill="url(#usb-metallic)"
            stroke={isHighlighted ? "var(--color-accent)" : "#666"}
            strokeWidth={isHighlighted ? 1.5 : 0.75}
          />
          {/* Inner cavity */}
          <rect
            x={x + 5}
            y={y + 5}
            width={w - 10}
            height={h - 10}
            rx={rr - 4}
            fill="#1a1a1a"
          />
          {/* Center contact row */}
          {Array.from({ length: 6 }).map((_, i) => (
            <rect
              key={`uc-${i}`}
              x={x + 12 + i * 8}
              y={y + h / 2 - 1.5}
              width={4}
              height={3}
              rx={0.5}
              fill="#c0a030"
              opacity={0.7}
            />
          ))}
          {/* Label */}
          <text
            x={cx}
            y={y - 5}
            textAnchor="middle"
            dominantBaseline="auto"
            fill={isHighlighted ? "var(--color-accent)" : "rgba(255,255,255,0.45)"}
            fontSize={6}
            fontFamily="ui-monospace, monospace"
            className="select-none pointer-events-none"
          >
            {comp.label}
          </text>
        </g>
      );
    }

    case "antenna": {
      // Copper zigzag antenna trace with keep-out outline
      const zigW = w - 10;
      const zigH = h - 8;
      const startX = x + 5;
      const startY = y + 4;
      const segments = 8;
      const segW = zigW / segments;
      let zigzagPoints = `${startX},${startY + zigH / 2}`;
      for (let i = 0; i < segments; i++) {
        const sx = startX + i * segW + segW / 2;
        const sy = i % 2 === 0 ? startY : startY + zigH;
        const ex = startX + (i + 1) * segW;
        const ey = startY + zigH / 2;
        zigzagPoints += ` ${sx},${sy} ${ex},${ey}`;
      }
      return (
        <g {...wrapperProps}>
          {hitArea}
          {/* Keep-out zone dashed outline */}
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={2}
            fill="none"
            stroke={isHighlighted ? "var(--color-accent)" : "rgba(255,200,50,0.25)"}
            strokeWidth={0.75}
            strokeDasharray="4 2"
          />
          {/* Zigzag antenna trace */}
          <polyline
            points={zigzagPoints}
            fill="none"
            stroke={isHighlighted ? "var(--color-accent)" : "#c0863a"}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* ANT label */}
          <text
            x={x + 14}
            y={y + h + 10}
            textAnchor="start"
            fill={isHighlighted ? "var(--color-accent)" : "rgba(255,255,255,0.35)"}
            fontSize={6}
            fontFamily="ui-monospace, monospace"
            className="select-none pointer-events-none"
          >
            ANT
          </text>
        </g>
      );
    }

    case "led": {
      // Small single-color LED with glow
      const r = Math.min(w, h) / 2;
      return (
        <g {...wrapperProps}>
          {hitArea}
          {/* Copper pad base */}
          <rect x={x} y={y} width={w} height={h} rx={2} fill="#8a7040" />
          {/* LED glow */}
          <circle
            cx={cx}
            cy={cy}
            r={r * 0.8}
            fill="#ff3030"
            filter="url(#led-glow)"
            opacity={0.9}
          />
          {/* LED die center */}
          <circle cx={cx} cy={cy} r={r * 0.35} fill="#ff6060" />
          {/* Highlight ring */}
          {isHighlighted && (
            <circle
              cx={cx}
              cy={cy}
              r={r + 3}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={1.5}
            />
          )}
        </g>
      );
    }

    case "rgb-led": {
      // Colorful addressable RGB LED — the most eye-catching element
      const r = Math.min(w, h) / 2;
      return (
        <g {...wrapperProps}>
          {hitArea}
          {/* Pad body */}
          <rect
            x={x - 2}
            y={y - 2}
            width={w + 4}
            height={h + 4}
            rx={3}
            fill="#2a2a2a"
            stroke={isHighlighted ? "var(--color-accent)" : "#555"}
            strokeWidth={isHighlighted ? 1.5 : 0.5}
          />
          {/* RGB outer glow */}
          <circle
            cx={cx}
            cy={cy}
            r={r + 4}
            fill="url(#rgb-led-glow)"
            filter="url(#led-glow)"
            opacity={0.6}
          />
          {/* Main colored ring */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="url(#rgb-led-glow)"
            opacity={0.9}
          />
          {/* Bright inner die */}
          <circle cx={cx} cy={cy} r={r * 0.35} fill="#fff" opacity={0.85} />
          {/* GPIO label */}
          <text
            x={cx}
            y={y + h + 12}
            textAnchor="middle"
            fill={isHighlighted ? "var(--color-accent)" : "rgba(255,255,255,0.45)"}
            fontSize={6}
            fontFamily="ui-monospace, monospace"
            className="select-none pointer-events-none"
          >
            {comp.label}
          </text>
        </g>
      );
    }

    case "button": {
      // Tactile switch: outer metallic ring + inner cap
      const btnR = Math.min(w, h) / 2;
      return (
        <g {...wrapperProps}>
          {hitArea}
          {/* 4 corner pads */}
          {[
            [x, y],
            [x + w - 4, y],
            [x, y + h - 4],
            [x + w - 4, y + h - 4],
          ].map(([px, py], i) => (
            <rect
              key={`bp-${i}`}
              x={px}
              y={py}
              width={4}
              height={4}
              rx={0.5}
              fill="#c0a030"
            />
          ))}
          {/* Outer metallic ring */}
          <circle
            cx={cx}
            cy={cy}
            r={btnR}
            fill="url(#usb-metallic)"
            stroke={isHighlighted ? "var(--color-accent)" : "#777"}
            strokeWidth={isHighlighted ? 1.5 : 0.75}
          />
          {/* Inner raised cap */}
          <circle
            cx={cx}
            cy={cy}
            r={btnR * 0.6}
            fill="#3a3a3a"
            stroke="#555"
            strokeWidth={0.5}
          />
          {/* Label */}
          <text
            x={cx}
            y={y + h + 10}
            textAnchor="middle"
            fill={isHighlighted ? "var(--color-accent)" : "rgba(255,255,255,0.4)"}
            fontSize={5.5}
            fontFamily="ui-monospace, monospace"
            className="select-none pointer-events-none"
          >
            {comp.label}
          </text>
        </g>
      );
    }

    case "ldo": {
      // SOT-223 voltage regulator: dark body + 3 bottom pads + 1 top tab
      return (
        <g {...wrapperProps}>
          {hitArea}
          {/* Top tab pad */}
          <rect x={x + 5} y={y - 3} width={w - 10} height={6} rx={1} fill="#c0a030" />
          {/* IC body */}
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={2}
            fill="url(#chip-body)"
            stroke={isHighlighted ? "var(--color-accent)" : "#333"}
            strokeWidth={isHighlighted ? 1.5 : 0.75}
          />
          {/* 3 bottom pads */}
          {[0, 1, 2].map((i) => (
            <rect
              key={`lp-${i}`}
              x={x + 4 + i * ((w - 12) / 2)}
              y={y + h - 2}
              width={6}
              height={5}
              rx={1}
              fill="#c0a030"
            />
          ))}
          {/* Label */}
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fill={isHighlighted ? "var(--color-accent)" : "rgba(255,255,255,0.5)"}
            fontSize={6}
            fontFamily="ui-monospace, monospace"
            className="select-none pointer-events-none"
          >
            {comp.label}
          </text>
        </g>
      );
    }

    default:
      return null;
  }
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

  // Mounting hole positions (board corners, inset by 15px)
  const holeInset = 15;
  const mountingHoles = [
    { cx: layout.boardX + holeInset, cy: layout.boardY + holeInset },
    { cx: layout.boardX + layout.boardWidth - holeInset, cy: layout.boardY + holeInset },
    { cx: layout.boardX + holeInset, cy: layout.boardY + layout.boardHeight - holeInset },
    { cx: layout.boardX + layout.boardWidth - holeInset, cy: layout.boardY + layout.boardHeight - holeInset },
  ];

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

        {/* Chip body gradient */}
        <linearGradient id="chip-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a3a3a" />
          <stop offset="50%" stopColor="#222" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </linearGradient>

        {/* USB metallic gradient */}
        <linearGradient id="usb-metallic" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d0d0d0" />
          <stop offset="40%" stopColor="#a8a8a8" />
          <stop offset="100%" stopColor="#808080" />
        </linearGradient>

        {/* Pin metallic gradient */}
        <linearGradient id="pin-metallic" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e0c860" />
          <stop offset="50%" stopColor="#c0a030" />
          <stop offset="100%" stopColor="#a08020" />
        </linearGradient>

        {/* LED glow filter */}
        <filter id="led-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* RGB LED radial gradient */}
        <radialGradient id="rgb-led-glow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#ff4444" />
          <stop offset="40%" stopColor="#44ff44" />
          <stop offset="80%" stopColor="#4444ff" />
          <stop offset="100%" stopColor="#4444ff" stopOpacity="0" />
        </radialGradient>

        {/* Copper pad gradient for mounting holes */}
        <radialGradient id="copper-pad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c09040" />
          <stop offset="70%" stopColor="#a07830" />
          <stop offset="100%" stopColor="#806020" />
        </radialGradient>

        {/* PCB texture dot pattern */}
        <pattern id="pcb-texture" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="0.5" fill="rgba(255,255,255,0.03)" />
        </pattern>

        {/* Silkscreen glow */}
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

      {/* PCB texture overlay */}
      <rect
        x={layout.boardX}
        y={layout.boardY}
        width={layout.boardWidth}
        height={layout.boardHeight}
        rx={layout.cornerRadius}
        fill="url(#pcb-texture)"
      />

      {/* Mounting holes */}
      {mountingHoles.map((hole, i) => (
        <g key={`mh-${i}`}>
          <circle cx={hole.cx} cy={hole.cy} r={6} fill="url(#copper-pad)" />
          <circle cx={hole.cx} cy={hole.cy} r={3.5} fill="#1a1a1a" />
          <circle cx={hole.cx} cy={hole.cy} r={2.5} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
        </g>
      ))}

      {/* Components (type-specific renderers) */}
      {components.map((comp) => {
        const isHovered = hoveredComponent === comp.id;
        const isSelected =
          selection?.type === "component" &&
          components[selection.index]?.id === comp.id;
        const isHighlighted = isHovered || isSelected;

        return (
          <ComponentRenderer
            key={comp.id}
            comp={comp}
            isHighlighted={isHighlighted}
            onMouseEnter={() => onComponentHover(comp.id)}
            onMouseLeave={() => onComponentHover(null)}
            onClick={() => onComponentClick(comp.id)}
          />
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
