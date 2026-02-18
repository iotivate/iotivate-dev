import type { BoardVariant } from "../types";
import { esp32Wroom32_30pin } from "./esp32-wroom-32-30pin";
import { esp32S3DevKitC } from "./esp32-s3-devkitc";
import { esp32C3DevKitM } from "./esp32-c3-devkitm";

export const BOARD_VARIANTS: BoardVariant[] = [
  esp32Wroom32_30pin,
  esp32S3DevKitC,
  esp32C3DevKitM,
];

export const DEFAULT_VARIANT_ID = "esp32-wroom-32-30pin";
