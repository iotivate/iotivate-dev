import type { BoardVariant } from "../types";

export const esp32Wroom32_30pin: BoardVariant = {
  id: "esp32-wroom-32-30pin",
  name: "ESP32-WROOM-32 DevKit V1 (30-pin)",
  shortName: "ESP32 30-pin",
  chipFamily: "ESP32",
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
      label: "ESP32-WROOM-32",
      description: "Dual-core Xtensa LX6 Wi-Fi + Bluetooth SoC module",
      specs: [
        { label: "CPU", value: "Xtensa LX6 dual-core @ 240 MHz" },
        { label: "Flash", value: "4 MB SPI Flash" },
        { label: "SRAM", value: "520 KB" },
        { label: "Wi-Fi", value: "802.11 b/g/n" },
        { label: "Bluetooth", value: "v4.2 BR/EDR + BLE" },
      ],
      bounds: { x: 165, y: 80, w: 190, h: 180 },
    },
    {
      id: "usb-uart",
      label: "CP2102 / CH340",
      description: "USB-to-UART bridge for programming and serial communication",
      specs: [
        { label: "Interface", value: "USB 2.0 Full Speed" },
        { label: "Baud Rate", value: "Up to 921600" },
        { label: "Signals", value: "TX, RX, DTR, RTS" },
      ],
      bounds: { x: 210, y: 420, w: 100, h: 50 },
    },
    {
      id: "antenna",
      label: "PCB Antenna",
      description: "Onboard PCB trace antenna for Wi-Fi and Bluetooth",
      specs: [
        { label: "Type", value: "Meandered inverted-F" },
        { label: "Frequency", value: "2.4 GHz" },
        { label: "Gain", value: "2 dBi typical" },
      ],
      bounds: { x: 195, y: 35, w: 130, h: 40 },
    },
    {
      id: "ldo",
      label: "AMS1117-3.3",
      description: "3.3V low-dropout voltage regulator",
      specs: [
        { label: "Output", value: "3.3V @ 800mA" },
        { label: "Dropout", value: "1.1V typical" },
        { label: "Input", value: "5V via USB" },
      ],
      bounds: { x: 165, y: 380, w: 40, h: 30 },
    },
    {
      id: "btn-en",
      label: "EN Button",
      description: "Reset button — pulls EN pin low to restart the chip",
      specs: [{ label: "Function", value: "Hardware reset" }],
      bounds: { x: 145, y: 310, w: 30, h: 20 },
    },
    {
      id: "btn-boot",
      label: "BOOT Button",
      description: "Boot mode button — hold during reset to enter flashing mode (GPIO0)",
      specs: [
        { label: "Function", value: "GPIO0 → GND" },
        { label: "Use", value: "Enter download mode" },
      ],
      bounds: { x: 345, y: 310, w: 30, h: 20 },
    },
    {
      id: "led",
      label: "Power LED",
      description: "Indicates 3.3V power rail is active",
      specs: [{ label: "Color", value: "Red" }],
      bounds: { x: 165, y: 350, w: 15, h: 10 },
    },
  ],
  pins: [
    // Left side, top to bottom (positions 1–15)
    {
      position: 1,
      side: "left",
      label: "3V3",
      gpio: null,
      functions: [
        { category: "power", label: "3.3V", description: "3.3V power output from LDO regulator" },
      ],
      warnings: [
        { severity: "danger", text: "Do not exceed 3.3V on this pin" },
        { severity: "info", text: "Max output: ~600mA (shared with chip)" },
      ],
    },
    {
      position: 2,
      side: "left",
      label: "EN",
      gpio: null,
      functions: [
        { category: "enable", label: "Chip Enable", description: "Active-high enable pin — pull low to reset the chip" },
      ],
      warnings: [
        { severity: "warning", text: "Has internal pull-up; do not leave floating in designs" },
      ],
    },
    {
      position: 3,
      side: "left",
      label: "VP / GPIO36",
      gpio: 36,
      inputOnly: true,
      functions: [
        { category: "gpio", label: "GPIO36", description: "General-purpose input only" },
        { category: "adc", label: "ADC1_CH0", description: "12-bit ADC channel 0 (0–3.3V)" },
      ],
      warnings: [
        { severity: "info", text: "Input only — no internal pull-up/pull-down" },
      ],
    },
    {
      position: 4,
      side: "left",
      label: "VN / GPIO39",
      gpio: 39,
      inputOnly: true,
      functions: [
        { category: "gpio", label: "GPIO39", description: "General-purpose input only" },
        { category: "adc", label: "ADC1_CH3", description: "12-bit ADC channel 3 (0–3.3V)" },
      ],
      warnings: [
        { severity: "info", text: "Input only — no internal pull-up/pull-down" },
      ],
    },
    {
      position: 5,
      side: "left",
      label: "GPIO34",
      gpio: 34,
      inputOnly: true,
      functions: [
        { category: "gpio", label: "GPIO34", description: "General-purpose input only" },
        { category: "adc", label: "ADC1_CH6", description: "12-bit ADC channel 6 (0–3.3V)" },
      ],
      warnings: [
        { severity: "info", text: "Input only — no internal pull-up/pull-down" },
      ],
    },
    {
      position: 6,
      side: "left",
      label: "GPIO35",
      gpio: 35,
      inputOnly: true,
      functions: [
        { category: "gpio", label: "GPIO35", description: "General-purpose input only" },
        { category: "adc", label: "ADC1_CH7", description: "12-bit ADC channel 7 (0–3.3V)" },
      ],
      warnings: [
        { severity: "info", text: "Input only — no internal pull-up/pull-down" },
      ],
    },
    {
      position: 7,
      side: "left",
      label: "GPIO32",
      gpio: 32,
      functions: [
        { category: "gpio", label: "GPIO32", description: "General-purpose I/O" },
        { category: "adc", label: "ADC1_CH4", description: "12-bit ADC channel 4" },
        { category: "touch", label: "Touch9", description: "Capacitive touch sensor 9" },
        { category: "clock", label: "32K_XP", description: "32.768 kHz crystal oscillator input" },
      ],
      warnings: [],
    },
    {
      position: 8,
      side: "left",
      label: "GPIO33",
      gpio: 33,
      functions: [
        { category: "gpio", label: "GPIO33", description: "General-purpose I/O" },
        { category: "adc", label: "ADC1_CH5", description: "12-bit ADC channel 5" },
        { category: "touch", label: "Touch8", description: "Capacitive touch sensor 8" },
        { category: "clock", label: "32K_XN", description: "32.768 kHz crystal oscillator output" },
      ],
      warnings: [],
    },
    {
      position: 9,
      side: "left",
      label: "GPIO25",
      gpio: 25,
      functions: [
        { category: "gpio", label: "GPIO25", description: "General-purpose I/O" },
        { category: "adc", label: "ADC2_CH8", description: "12-bit ADC2 channel 8 (unavailable during Wi-Fi)" },
        { category: "dac", label: "DAC1", description: "8-bit DAC channel 1" },
      ],
      warnings: [
        { severity: "warning", text: "ADC2 cannot be used while Wi-Fi is active" },
      ],
    },
    {
      position: 10,
      side: "left",
      label: "GPIO26",
      gpio: 26,
      functions: [
        { category: "gpio", label: "GPIO26", description: "General-purpose I/O" },
        { category: "adc", label: "ADC2_CH9", description: "12-bit ADC2 channel 9 (unavailable during Wi-Fi)" },
        { category: "dac", label: "DAC2", description: "8-bit DAC channel 2" },
      ],
      warnings: [
        { severity: "warning", text: "ADC2 cannot be used while Wi-Fi is active" },
      ],
    },
    {
      position: 11,
      side: "left",
      label: "GPIO27",
      gpio: 27,
      functions: [
        { category: "gpio", label: "GPIO27", description: "General-purpose I/O" },
        { category: "adc", label: "ADC2_CH7", description: "12-bit ADC2 channel 7 (unavailable during Wi-Fi)" },
        { category: "touch", label: "Touch7", description: "Capacitive touch sensor 7" },
      ],
      warnings: [
        { severity: "warning", text: "ADC2 cannot be used while Wi-Fi is active" },
      ],
    },
    {
      position: 12,
      side: "left",
      label: "GPIO14",
      gpio: 14,
      functions: [
        { category: "gpio", label: "GPIO14", description: "General-purpose I/O" },
        { category: "adc", label: "ADC2_CH6", description: "12-bit ADC2 channel 6" },
        { category: "touch", label: "Touch6", description: "Capacitive touch sensor 6" },
        { category: "spi", label: "HSPI CLK", description: "HSPI clock (default)" },
      ],
      warnings: [
        { severity: "warning", text: "Outputs PWM signal at boot" },
      ],
    },
    {
      position: 13,
      side: "left",
      label: "GPIO12",
      gpio: 12,
      functions: [
        { category: "gpio", label: "GPIO12", description: "General-purpose I/O" },
        { category: "adc", label: "ADC2_CH5", description: "12-bit ADC2 channel 5" },
        { category: "touch", label: "Touch5", description: "Capacitive touch sensor 5" },
        { category: "spi", label: "HSPI MISO", description: "HSPI MISO (default)" },
      ],
      warnings: [
        { severity: "danger", text: "Strapping pin — must be LOW at boot (controls flash voltage)" },
      ],
    },
    {
      position: 14,
      side: "left",
      label: "GND",
      gpio: null,
      functions: [
        { category: "ground", label: "Ground", description: "Ground reference" },
      ],
      warnings: [],
    },
    {
      position: 15,
      side: "left",
      label: "GPIO13",
      gpio: 13,
      functions: [
        { category: "gpio", label: "GPIO13", description: "General-purpose I/O" },
        { category: "adc", label: "ADC2_CH4", description: "12-bit ADC2 channel 4" },
        { category: "touch", label: "Touch4", description: "Capacitive touch sensor 4" },
        { category: "spi", label: "HSPI MOSI", description: "HSPI MOSI (default)" },
      ],
      warnings: [],
    },

    // Right side, top to bottom (positions 16–30)
    {
      position: 16,
      side: "right",
      label: "VIN",
      gpio: null,
      functions: [
        { category: "power", label: "5V Input", description: "5V power input (or output when powered via USB)" },
      ],
      warnings: [
        { severity: "warning", text: "Unregulated — connects directly to USB 5V" },
        { severity: "info", text: "Can supply 5V to external devices when USB-powered" },
      ],
    },
    {
      position: 17,
      side: "right",
      label: "GND",
      gpio: null,
      functions: [
        { category: "ground", label: "Ground", description: "Ground reference" },
      ],
      warnings: [],
    },
    {
      position: 18,
      side: "right",
      label: "GPIO15",
      gpio: 15,
      functions: [
        { category: "gpio", label: "GPIO15", description: "General-purpose I/O" },
        { category: "adc", label: "ADC2_CH3", description: "12-bit ADC2 channel 3" },
        { category: "touch", label: "Touch3", description: "Capacitive touch sensor 3" },
        { category: "spi", label: "HSPI CS", description: "HSPI chip-select (default)" },
      ],
      warnings: [
        { severity: "warning", text: "Strapping pin — outputs PWM at boot (controls debug log output)" },
      ],
    },
    {
      position: 19,
      side: "right",
      label: "GPIO2",
      gpio: 2,
      functions: [
        { category: "gpio", label: "GPIO2", description: "General-purpose I/O" },
        { category: "adc", label: "ADC2_CH2", description: "12-bit ADC2 channel 2" },
        { category: "touch", label: "Touch2", description: "Capacitive touch sensor 2" },
      ],
      warnings: [
        { severity: "warning", text: "Strapping pin — must be LOW or floating at boot" },
        { severity: "info", text: "Connected to onboard LED on many dev boards" },
      ],
    },
    {
      position: 20,
      side: "right",
      label: "GPIO4",
      gpio: 4,
      functions: [
        { category: "gpio", label: "GPIO4", description: "General-purpose I/O" },
        { category: "adc", label: "ADC2_CH0", description: "12-bit ADC2 channel 0" },
        { category: "touch", label: "Touch0", description: "Capacitive touch sensor 0" },
      ],
      warnings: [],
    },
    {
      position: 21,
      side: "right",
      label: "RX2 / GPIO16",
      gpio: 16,
      functions: [
        { category: "gpio", label: "GPIO16", description: "General-purpose I/O" },
        { category: "uart", label: "UART2 RX", description: "UART2 receive (default)" },
      ],
      warnings: [],
    },
    {
      position: 22,
      side: "right",
      label: "TX2 / GPIO17",
      gpio: 17,
      functions: [
        { category: "gpio", label: "GPIO17", description: "General-purpose I/O" },
        { category: "uart", label: "UART2 TX", description: "UART2 transmit (default)" },
      ],
      warnings: [],
    },
    {
      position: 23,
      side: "right",
      label: "GPIO5",
      gpio: 5,
      functions: [
        { category: "gpio", label: "GPIO5", description: "General-purpose I/O" },
        { category: "spi", label: "VSPI CS", description: "VSPI chip-select (default)" },
      ],
      warnings: [
        { severity: "warning", text: "Strapping pin — outputs PWM at boot" },
      ],
    },
    {
      position: 24,
      side: "right",
      label: "GPIO18",
      gpio: 18,
      functions: [
        { category: "gpio", label: "GPIO18", description: "General-purpose I/O" },
        { category: "spi", label: "VSPI CLK", description: "VSPI clock (default)" },
      ],
      warnings: [],
    },
    {
      position: 25,
      side: "right",
      label: "GPIO19",
      gpio: 19,
      functions: [
        { category: "gpio", label: "GPIO19", description: "General-purpose I/O" },
        { category: "spi", label: "VSPI MISO", description: "VSPI MISO (default)" },
      ],
      warnings: [],
    },
    {
      position: 26,
      side: "right",
      label: "GPIO21",
      gpio: 21,
      functions: [
        { category: "gpio", label: "GPIO21", description: "General-purpose I/O" },
        { category: "i2c", label: "SDA", description: "Default I2C data line" },
      ],
      warnings: [],
    },
    {
      position: 27,
      side: "right",
      label: "RX0 / GPIO3",
      gpio: 3,
      functions: [
        { category: "gpio", label: "GPIO3", description: "General-purpose I/O" },
        { category: "uart", label: "UART0 RX", description: "UART0 receive — used for USB serial" },
      ],
      warnings: [
        { severity: "warning", text: "Used by USB-UART bridge — avoid using if serial monitor is needed" },
      ],
    },
    {
      position: 28,
      side: "right",
      label: "TX0 / GPIO1",
      gpio: 1,
      functions: [
        { category: "gpio", label: "GPIO1", description: "General-purpose I/O" },
        { category: "uart", label: "UART0 TX", description: "UART0 transmit — used for USB serial" },
      ],
      warnings: [
        { severity: "danger", text: "Used by USB-UART bridge — outputs debug log at boot" },
      ],
    },
    {
      position: 29,
      side: "right",
      label: "GPIO22",
      gpio: 22,
      functions: [
        { category: "gpio", label: "GPIO22", description: "General-purpose I/O" },
        { category: "i2c", label: "SCL", description: "Default I2C clock line" },
      ],
      warnings: [],
    },
    {
      position: 30,
      side: "right",
      label: "GPIO23",
      gpio: 23,
      functions: [
        { category: "gpio", label: "GPIO23", description: "General-purpose I/O" },
        { category: "spi", label: "VSPI MOSI", description: "VSPI MOSI (default)" },
      ],
      warnings: [],
    },
  ],
};
