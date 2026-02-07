import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import {
  VideoEmbed,
  PartsList,
  CircuitDiagram,
  FileDownloads,
  FirmwarePurchase,
  AppDownload,
} from "@/components/project";
import type { Part } from "@/components/project/PartsList";
import type { DownloadFile } from "@/components/project/FileDownloads";

export const metadata: Metadata = {
  title: "Smart Relay - IoT Power Control",
  description: "Build a WiFi-controlled relay switch with ESP32. Control appliances from your phone with scheduling and automation.",
};

const parts: Part[] = [
  { name: "ESP32 DevKit V1", quantity: 1, description: "Any ESP32 board works", buyLink: "https://amazon.com", price: "$8" },
  { name: "5V Relay Module", quantity: 1, description: "Single channel, optocoupler isolated", buyLink: "https://amazon.com", price: "$3" },
  { name: "Hi-Link 5V PSU", quantity: 1, description: "AC-DC 5V 3W module", buyLink: "https://amazon.com", price: "$4" },
  { name: "Project Box", quantity: 1, description: "100x60x25mm or 3D print", buyLink: "https://amazon.com", price: "$5" },
  { name: "Terminal Blocks", quantity: 3, description: "2-pin screw terminals", price: "$1" },
  { name: "Wires & Connectors", quantity: 1, description: "Jumper wires, heat shrink" },
];

const downloads: DownloadFile[] = [
  { name: "Enclosure Top.stl", url: "/files/smart-relay/enclosure-top.stl", size: "1.2 MB", type: "stl" },
  { name: "Enclosure Bottom.stl", url: "/files/smart-relay/enclosure-bottom.stl", size: "0.8 MB", type: "stl" },
  { name: "Schematic PDF", url: "/files/smart-relay/schematic.pdf", size: "245 KB", type: "pdf" },
  { name: "All Files.zip", url: "/files/smart-relay/all-files.zip", size: "3.1 MB", type: "zip" },
];

const firmwareFeatures = [
  "WiFi provisioning via app",
  "Manual and scheduled control",
  "Power consumption monitoring",
  "OTA firmware updates",
  "Works with Home Assistant",
];

const appFeatures = [
  "Control relay from anywhere",
  "Create schedules and timers",
  "View power usage history",
  "Multiple device support",
];

export default function SmartRelayProject() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <PageHeader
        title="Smart Relay"
        description="WiFi-controlled power switch with scheduling, monitoring, and app control. Perfect for home automation."
      />

      <div className="space-y-8">
        {/* Video */}
        <section>
          <VideoEmbed youtubeId="dQw4w9WgXcQ" title="Smart Relay Build Tutorial" />
        </section>

        {/* Overview */}
        <section className="prose prose-invert max-w-none">
          <h2>Overview</h2>
          <p>
            The Smart Relay is a WiFi-enabled power switch that lets you control any AC appliance
            from your smartphone. Built with an ESP32 and a relay module, it features scheduling,
            power monitoring, and integrates with Home Assistant for advanced automation.
          </p>
          <p>
            This project is perfect for controlling lamps, fans, heaters, or any device up to 10A.
            The companion app makes setup easy — just scan, connect, and control.
          </p>
        </section>

        {/* Two column layout for parts and downloads */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PartsList parts={parts} />
          <FileDownloads title="3D Files & Documents" files={downloads} />
        </div>

        {/* Circuit Diagram */}
        <section>
          <CircuitDiagram
            src="/images/projects/smart-relay-circuit.png"
            alt="Smart Relay Circuit Diagram"
            downloadUrl="/files/smart-relay/schematic.pdf"
          />
        </section>

        {/* Build Guide */}
        <section className="prose prose-invert max-w-none">
          <h2>Build Guide</h2>

          <h3>Step 1: Print the Enclosure</h3>
          <p>
            Download the STL files and print both parts. Use PETG or ABS for heat resistance.
            No supports needed, print with the flat side down.
          </p>

          <h3>Step 2: Wire the Power Supply</h3>
          <p>
            Connect the Hi-Link module to AC input (L and N). The 5V output powers both the
            ESP32 and relay module. Double-check polarity before powering on.
          </p>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 my-4">
            <strong className="text-yellow-400">Warning:</strong> This project involves mains voltage.
            Disconnect power before making any connections. If unsure, consult an electrician.
          </div>

          <h3>Step 3: Connect the ESP32</h3>
          <p>
            Wire the relay signal pin to GPIO 5 on the ESP32. Connect VCC to 5V and GND to ground.
            The relay is active-low, so it turns ON when GPIO 5 is LOW.
          </p>

          <h3>Step 4: Flash the Firmware</h3>
          <p>
            Purchase the firmware below, then connect your ESP32 via USB and click "Flash Now".
            No Arduino IDE or special tools needed — it flashes directly in your browser.
          </p>

          <h3>Step 5: Setup with the App</h3>
          <p>
            Download the companion app, scan the QR code shown on first boot, and follow the
            setup wizard to connect to your WiFi network.
          </p>
        </section>

        {/* Firmware and App side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FirmwarePurchase
            name="Smart Relay Firmware"
            version="2.1.0"
            price={5.99}
            features={firmwareFeatures}
          />
          <AppDownload
            name="Smart Relay Controller"
            description="Control and monitor your Smart Relay from anywhere."
            playStoreUrl="https://play.google.com/store"
            apkUrl="/apps/smart-relay-controller.apk"
            apkVersion="1.4.2"
            apkSize="12 MB"
            features={appFeatures}
          />
        </div>

        {/* Support */}
        <section className="border border-border rounded-lg p-6 bg-surface/30">
          <h3 className="font-semibold mb-2">Need Help?</h3>
          <p className="text-sm text-muted mb-4">
            Having trouble with the build? Check out the video tutorial or reach out for support.
          </p>
          <div className="flex gap-3">
            <a href="#" className="text-sm text-accent hover:underline">
              Watch Tutorial
            </a>
            <a href="/contact" className="text-sm text-accent hover:underline">
              Contact Support
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
