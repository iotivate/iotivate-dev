import type { Metadata } from "next";
import { ProjectPage, type ProjectData } from "@/components/project";

export const metadata: Metadata = {
  title: "Smart Relay - IoT Power Control",
  description: "Build a WiFi-controlled relay switch with ESP32. Control appliances from your phone with scheduling and automation.",
};

const projectData: ProjectData = {
  slug: "smart-relay",
  title: "Smart Relay",
  description: "WiFi-controlled power switch with scheduling, monitoring, and app control. Perfect for home automation.",

  youtubeId: "dQw4w9WgXcQ",

  overview: `
    <p>
      The Smart Relay is a WiFi-enabled power switch that lets you control any AC appliance
      from your smartphone. Built with an ESP32 and a relay module, it features scheduling,
      power monitoring, and integrates with Home Assistant for advanced automation.
    </p>
    <p>
      This project is perfect for controlling lamps, fans, heaters, or any device up to 10A.
      The companion app makes setup easy — just scan, connect, and control.
    </p>
  `,

  parts: [
    { name: "ESP32 DevKit V1", quantity: 1, description: "Any ESP32 board works", buyLink: "https://amazon.com", price: "$8" },
    { name: "5V Relay Module", quantity: 1, description: "Single channel, optocoupler isolated", buyLink: "https://amazon.com", price: "$3" },
    { name: "Hi-Link 5V PSU", quantity: 1, description: "AC-DC 5V 3W module", buyLink: "https://amazon.com", price: "$4" },
    { name: "Project Box", quantity: 1, description: "100x60x25mm or 3D print", buyLink: "https://amazon.com", price: "$5" },
    { name: "Terminal Blocks", quantity: 3, description: "2-pin screw terminals", price: "$1" },
    { name: "Wires & Connectors", quantity: 1, description: "Jumper wires, heat shrink" },
  ],

  downloads: [
    { name: "Enclosure Top.stl", url: "/files/smart-relay/enclosure-top.stl", size: "1.2 MB", type: "stl" },
    { name: "Enclosure Bottom.stl", url: "/files/smart-relay/enclosure-bottom.stl", size: "0.8 MB", type: "stl" },
    { name: "Schematic PDF", url: "/files/smart-relay/schematic.pdf", size: "245 KB", type: "pdf" },
  ],

  circuit: {
    src: "/images/projects/smart-relay-circuit.png",
    alt: "Smart Relay Circuit Diagram",
    downloadUrl: "/files/smart-relay/schematic.pdf",
  },

  buildGuide: [
    {
      title: "Step 1: Print the Enclosure",
      content: "<p>Download the STL files and print both parts. Use PETG or ABS for heat resistance. No supports needed, print with the flat side down.</p>",
    },
    {
      title: "Step 2: Wire the Power Supply",
      content: "<p>Connect the Hi-Link module to AC input (L and N). The 5V output powers both the ESP32 and relay module. Double-check polarity before powering on.</p>",
      warning: "This project involves mains voltage. Disconnect power before making any connections. If unsure, consult an electrician.",
    },
    {
      title: "Step 3: Connect the ESP32",
      content: "<p>Wire the relay signal pin to GPIO 5 on the ESP32. Connect VCC to 5V and GND to ground. The relay is active-low, so it turns ON when GPIO 5 is LOW.</p>",
    },
    {
      title: "Step 4: Flash the Firmware",
      content: "<p>Purchase the firmware below, then connect your ESP32 via USB and click \"Flash Now\". No Arduino IDE or special tools needed — it flashes directly in your browser.</p>",
    },
    {
      title: "Step 5: Setup with the App",
      content: "<p>Download the companion app, scan the QR code shown on first boot, and follow the setup wizard to connect to your WiFi network.</p>",
    },
  ],

  firmware: {
    name: "Smart Relay Firmware",
    version: "2.1.0",
    price: 5.99,
    features: [
      "WiFi provisioning via app",
      "Manual and scheduled control",
      "Power consumption monitoring",
      "OTA firmware updates",
      "Works with Home Assistant",
    ],
  },

  app: {
    name: "Smart Relay Controller",
    description: "Control and monitor your Smart Relay from anywhere.",
    playStoreUrl: "https://play.google.com/store",
    apkUrl: "/apps/smart-relay-controller.apk",
    apkVersion: "1.4.2",
    apkSize: "12 MB",
    features: [
      "Control relay from anywhere",
      "Create schedules and timers",
      "View power usage history",
      "Multiple device support",
    ],
  },

  support: {
    text: "Having trouble with the build? Check out the video tutorial or reach out for support.",
    links: [
      { label: "Watch Tutorial", url: "#" },
      { label: "Contact Support", url: "/contact" },
    ],
  },
};

export default function SmartRelayProject() {
  return <ProjectPage data={projectData} />;
}
