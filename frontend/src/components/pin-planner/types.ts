export type PinSide = "left" | "right";

export type FunctionCategory =
  | "power"
  | "ground"
  | "adc"
  | "dac"
  | "touch"
  | "spi"
  | "i2c"
  | "uart"
  | "pwm"
  | "gpio"
  | "i2s"
  | "jtag"
  | "sdio"
  | "can"
  | "usb"
  | "strapping"
  | "enable"
  | "clock"
  | "flash"
  | "other";

export type WarningSeverity = "info" | "warning" | "danger";

export interface PinFunction {
  category: FunctionCategory;
  label: string;
  description: string;
}

export interface PinWarning {
  severity: WarningSeverity;
  text: string;
}

export interface PinDefinition {
  position: number;
  side: PinSide;
  label: string;
  gpio: number | null;
  functions: PinFunction[];
  warnings: PinWarning[];
  inputOnly?: boolean;
  flashConnected?: boolean;
}

export interface BoardComponent {
  id: string;
  label: string;
  description: string;
  specs: { label: string; value: string }[];
  /** SVG rect: x, y, width, height */
  bounds: { x: number; y: number; w: number; h: number };
}

export interface BoardLayout {
  width: number;
  height: number;
  boardX: number;
  boardY: number;
  boardWidth: number;
  boardHeight: number;
  pinStartY: number;
  pinSpacing: number;
  leftPinX: number;
  rightPinX: number;
  pinWidth: number;
  pinHeight: number;
  labelOffset: number;
  cornerRadius: number;
}

export interface BoardVariant {
  id: string;
  name: string;
  shortName: string;
  chipFamily: string;
  pinCount: number;
  pins: PinDefinition[];
  components: BoardComponent[];
  layout: BoardLayout;
}

export type SelectionType = "pin" | "component";

export interface Selection {
  type: SelectionType;
  index: number;
}

export const FUNCTION_COLORS: Record<FunctionCategory, string> = {
  power: "#dc2626",
  ground: "#404040",
  adc: "#7c3aed",
  dac: "#a855f7",
  touch: "#ec4899",
  spi: "#2563eb",
  i2c: "#0891b2",
  uart: "#059669",
  pwm: "#d97706",
  gpio: "#65a30d",
  i2s: "#6366f1",
  jtag: "#64748b",
  sdio: "#0d9488",
  can: "#ea580c",
  usb: "#db2777",
  strapping: "#b45309",
  enable: "#f59e0b",
  clock: "#8b5cf6",
  flash: "#991b1b",
  other: "#6b7280",
};

export function getPinColor(pin: PinDefinition): string {
  if (pin.functions.some((f) => f.category === "power")) return FUNCTION_COLORS.power;
  if (pin.functions.some((f) => f.category === "ground")) return FUNCTION_COLORS.ground;
  if (pin.functions.some((f) => f.category === "enable")) return FUNCTION_COLORS.enable;
  if (pin.flashConnected) return FUNCTION_COLORS.flash;
  if (pin.inputOnly) return "#1e40af";
  if (pin.gpio !== null) return "#4d7c0f";
  return FUNCTION_COLORS.other;
}
