import type { BoardVariant } from "../types";

export const esp32C3DevKitM: BoardVariant = {
  id: "esp32-c3-devkitm",
  name: "ESP32-C3-DevKitM-1 (30-pin)",
  shortName: "ESP32-C3",
  chipFamily: "ESP32-C3",
  pinCount: 30,
  layout: {
    width: 520,
    height: 560,
    boardX: 130,
    boardY: 30,
    boardWidth: 260,
    boardHeight: 500,
    pinStartY: 80,
    pinSpacing: 28,
    leftPinX: 110,
    rightPinX: 370,
    pinWidth: 40,
    pinHeight: 16,
    labelOffset: 50,
    cornerRadius: 12,
  },
  components: [
    {
      id: "chip",
      type: "chip",
      label: "ESP32-C3-MINI-1",
      description: "Single-core RISC-V Wi-Fi + BLE 5 SoC module",
      specs: [
        { label: "CPU", value: "RISC-V single-core @ 160 MHz" },
        { label: "Flash", value: "4 MB SPI Flash" },
        { label: "SRAM", value: "400 KB" },
        { label: "Wi-Fi", value: "802.11 b/g/n" },
        { label: "Bluetooth", value: "BLE 5.0" },
        { label: "USB", value: "USB Serial/JTAG" },
      ],
      bounds: { x: 165, y: 70, w: 190, h: 160 },
    },
    {
      id: "usb",
      type: "usb-c",
      label: "USB-C Port",
      description: "USB Serial/JTAG controller for programming and debugging",
      specs: [
        { label: "Type", value: "USB Serial/JTAG" },
        { label: "Pins", value: "GPIO18 (D-), GPIO19 (D+)" },
        { label: "Features", value: "Built-in CDC-ACM + JTAG" },
      ],
      bounds: { x: 225, y: 430, w: 70, h: 35 },
    },
    {
      id: "antenna",
      type: "antenna",
      label: "PCB Antenna",
      description: "Onboard PCB antenna for Wi-Fi and Bluetooth",
      specs: [
        { label: "Type", value: "3D antenna" },
        { label: "Frequency", value: "2.4 GHz" },
      ],
      bounds: { x: 195, y: 35, w: 130, h: 30 },
    },
    {
      id: "rgb-led",
      type: "rgb-led",
      label: "Addressable RGB LED",
      description: "WS2812 RGB LED on GPIO8",
      specs: [
        { label: "Type", value: "WS2812 (NeoPixel)" },
        { label: "GPIO", value: "GPIO8" },
      ],
      bounds: { x: 340, y: 280, w: 15, h: 15 },
    },
    {
      id: "btn-boot",
      type: "button",
      label: "BOOT Button",
      description: "Boot mode select (GPIO9)",
      specs: [{ label: "Function", value: "GPIO9 → GND" }],
      bounds: { x: 345, y: 370, w: 30, h: 20 },
    },
    {
      id: "btn-rst",
      type: "button",
      label: "RST Button",
      description: "Reset button",
      specs: [{ label: "Function", value: "Hardware reset" }],
      bounds: { x: 145, y: 370, w: 30, h: 20 },
    },
  ],
  pins: [
    // Left side — J1 header (positions 1–15), top to bottom
    {
      position: 1,
      side: "left",
      label: "GND",
      gpio: null,
      functions: [
        { category: "ground", label: "Ground", description: "Ground reference" },
      ],
      warnings: [],
    },
    {
      position: 2,
      side: "left",
      label: "3V3",
      gpio: null,
      functions: [
        { category: "power", label: "3.3V", description: "3.3V power output" },
      ],
      warnings: [],
    },
    {
      position: 3,
      side: "left",
      label: "3V3",
      gpio: null,
      functions: [
        { category: "power", label: "3.3V", description: "3.3V power output (second pin)" },
      ],
      warnings: [],
    },
    {
      position: 4,
      side: "left",
      label: "GPIO2",
      gpio: 2,
      functions: [
        { category: "gpio", label: "GPIO2", description: "General-purpose I/O" },
        { category: "adc", label: "ADC1_CH2", description: "ADC1 channel 2" },
        { category: "spi", label: "SPI MISO", description: "FSPIQ / SPI MISO (IO MUX default)" },
      ],
      warnings: [
        { severity: "warning", text: "Strapping pin — controls boot mode" },
      ],
    },
    {
      position: 5,
      side: "left",
      label: "GPIO3",
      gpio: 3,
      functions: [
        { category: "gpio", label: "GPIO3", description: "General-purpose I/O" },
        { category: "adc", label: "ADC1_CH3", description: "ADC1 channel 3" },
      ],
      warnings: [],
    },
    {
      position: 6,
      side: "left",
      label: "GND",
      gpio: null,
      functions: [
        { category: "ground", label: "Ground", description: "Ground reference" },
      ],
      warnings: [],
    },
    {
      position: 7,
      side: "left",
      label: "RST",
      gpio: null,
      functions: [
        { category: "enable", label: "Reset", description: "Active-high chip enable — pull low to reset" },
      ],
      warnings: [],
    },
    {
      position: 8,
      side: "left",
      label: "GND",
      gpio: null,
      functions: [
        { category: "ground", label: "Ground", description: "Ground reference" },
      ],
      warnings: [],
    },
    {
      position: 9,
      side: "left",
      label: "GPIO0",
      gpio: 0,
      functions: [
        { category: "gpio", label: "GPIO0", description: "General-purpose I/O" },
        { category: "adc", label: "ADC1_CH0", description: "ADC1 channel 0" },
      ],
      warnings: [],
    },
    {
      position: 10,
      side: "left",
      label: "GPIO1",
      gpio: 1,
      functions: [
        { category: "gpio", label: "GPIO1", description: "General-purpose I/O" },
        { category: "adc", label: "ADC1_CH1", description: "ADC1 channel 1" },
      ],
      warnings: [],
    },
    {
      position: 11,
      side: "left",
      label: "GPIO10",
      gpio: 10,
      functions: [
        { category: "gpio", label: "GPIO10", description: "General-purpose I/O" },
        { category: "spi", label: "SPI CS", description: "FSPICS0 / SPI chip-select (IO MUX default)" },
      ],
      warnings: [],
    },
    {
      position: 12,
      side: "left",
      label: "GND",
      gpio: null,
      functions: [
        { category: "ground", label: "Ground", description: "Ground reference" },
      ],
      warnings: [],
    },
    {
      position: 13,
      side: "left",
      label: "5V",
      gpio: null,
      functions: [
        { category: "power", label: "5V", description: "5V power from USB" },
      ],
      warnings: [],
    },
    {
      position: 14,
      side: "left",
      label: "5V",
      gpio: null,
      functions: [
        { category: "power", label: "5V", description: "5V power from USB (second pin)" },
      ],
      warnings: [],
    },
    {
      position: 15,
      side: "left",
      label: "GND",
      gpio: null,
      functions: [
        { category: "ground", label: "Ground", description: "Ground reference" },
      ],
      warnings: [],
    },

    // Right side — J3 header (positions 16–30), top to bottom
    {
      position: 16,
      side: "right",
      label: "GND",
      gpio: null,
      functions: [
        { category: "ground", label: "Ground", description: "Ground reference" },
      ],
      warnings: [],
    },
    {
      position: 17,
      side: "right",
      label: "TX / GPIO21",
      gpio: 21,
      functions: [
        { category: "gpio", label: "GPIO21", description: "General-purpose I/O" },
        { category: "uart", label: "UART0 TX", description: "UART0 transmit" },
      ],
      warnings: [
        { severity: "info", text: "Default serial TX — used for debug output and programming via UART" },
      ],
    },
    {
      position: 18,
      side: "right",
      label: "RX / GPIO20",
      gpio: 20,
      functions: [
        { category: "gpio", label: "GPIO20", description: "General-purpose I/O" },
        { category: "uart", label: "UART0 RX", description: "UART0 receive" },
      ],
      warnings: [
        { severity: "info", text: "Default serial RX — used for programming via UART" },
      ],
    },
    {
      position: 19,
      side: "right",
      label: "GND",
      gpio: null,
      functions: [
        { category: "ground", label: "Ground", description: "Ground reference" },
      ],
      warnings: [],
    },
    {
      position: 20,
      side: "right",
      label: "GPIO9",
      gpio: 9,
      functions: [
        { category: "gpio", label: "GPIO9", description: "General-purpose I/O" },
        { category: "strapping", label: "Boot Select", description: "LOW = download mode" },
      ],
      warnings: [
        { severity: "danger", text: "Strapping pin — connected to BOOT button; LOW enters download mode" },
      ],
    },
    {
      position: 21,
      side: "right",
      label: "GPIO8",
      gpio: 8,
      functions: [
        { category: "gpio", label: "GPIO8", description: "General-purpose I/O" },
      ],
      warnings: [
        { severity: "warning", text: "Strapping pin — must be pulled high at boot" },
        { severity: "info", text: "Connected to onboard RGB LED (WS2812)" },
      ],
    },
    {
      position: 22,
      side: "right",
      label: "GND",
      gpio: null,
      functions: [
        { category: "ground", label: "Ground", description: "Ground reference" },
      ],
      warnings: [],
    },
    {
      position: 23,
      side: "right",
      label: "GPIO7",
      gpio: 7,
      functions: [
        { category: "gpio", label: "GPIO7", description: "General-purpose I/O" },
        { category: "spi", label: "SPI MOSI", description: "FSPID / SPI MOSI (IO MUX default)" },
      ],
      warnings: [],
    },
    {
      position: 24,
      side: "right",
      label: "GPIO6",
      gpio: 6,
      functions: [
        { category: "gpio", label: "GPIO6", description: "General-purpose I/O" },
        { category: "spi", label: "SPI CLK", description: "FSPICLK / SPI clock (IO MUX default)" },
      ],
      warnings: [],
    },
    {
      position: 25,
      side: "right",
      label: "GPIO5",
      gpio: 5,
      functions: [
        { category: "gpio", label: "GPIO5", description: "General-purpose I/O" },
        { category: "adc", label: "ADC2_CH0", description: "ADC2 channel 0" },
      ],
      warnings: [
        { severity: "warning", text: "ADC2 may conflict with Wi-Fi" },
      ],
    },
    {
      position: 26,
      side: "right",
      label: "GPIO4",
      gpio: 4,
      functions: [
        { category: "gpio", label: "GPIO4", description: "General-purpose I/O" },
        { category: "adc", label: "ADC1_CH4", description: "ADC1 channel 4" },
      ],
      warnings: [],
    },
    {
      position: 27,
      side: "right",
      label: "GND",
      gpio: null,
      functions: [
        { category: "ground", label: "Ground", description: "Ground reference" },
      ],
      warnings: [],
    },
    {
      position: 28,
      side: "right",
      label: "GPIO18",
      gpio: 18,
      functions: [
        { category: "gpio", label: "GPIO18", description: "General-purpose I/O" },
        { category: "usb", label: "USB D-", description: "USB Serial/JTAG D-" },
      ],
      warnings: [
        { severity: "danger", text: "Used by USB Serial/JTAG — do not use if built-in USB is needed" },
      ],
    },
    {
      position: 29,
      side: "right",
      label: "GPIO19",
      gpio: 19,
      functions: [
        { category: "gpio", label: "GPIO19", description: "General-purpose I/O" },
        { category: "usb", label: "USB D+", description: "USB Serial/JTAG D+" },
      ],
      warnings: [
        { severity: "danger", text: "Used by USB Serial/JTAG — do not use if built-in USB is needed" },
      ],
    },
    {
      position: 30,
      side: "right",
      label: "GND",
      gpio: null,
      functions: [
        { category: "ground", label: "Ground", description: "Ground reference" },
      ],
      warnings: [],
    },
  ],
};
