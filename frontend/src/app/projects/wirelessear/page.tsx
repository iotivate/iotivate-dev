import type { Metadata } from "next";
import { ProjectPage, type ProjectData } from "@/components/project";

export const metadata: Metadata = {
  title: "WirelessEar - Audio Monitoring",
  description: "Stream audio wirelessly from ESP32 to your phone. Perfect for baby monitors, room monitoring, and more.",
};

// Example: A simpler project without STL files or companion app
const projectData: ProjectData = {
  slug: "wirelessear",
  title: "WirelessEar",
  description: "Wireless audio monitoring system built with ESP32. Stream audio over Wi-Fi with minimal latency.",

  youtubeId: "dQw4w9WgXcQ",

  overview: `
    <p>
      WirelessEar turns your ESP32 into a wireless audio transmitter. Connect a microphone,
      flash the firmware, and stream audio to any device on your network. Great for baby monitors,
      security systems, or remote audio monitoring.
    </p>
  `,

  parts: [
    { name: "ESP32 DevKit V1", quantity: 1, description: "With PSRAM recommended", buyLink: "https://amazon.com", price: "$10" },
    { name: "INMP441 I2S Microphone", quantity: 1, description: "Digital MEMS microphone", buyLink: "https://amazon.com", price: "$5" },
    { name: "Jumper Wires", quantity: 1, description: "Female-to-female, 10cm" },
  ],

  // No STL files for this project
  // No circuit diagram (simple wiring described in guide)

  buildGuide: [
    {
      title: "Step 1: Wire the Microphone",
      content: `
        <p>Connect the INMP441 to ESP32:</p>
        <ul>
          <li>VDD → 3.3V</li>
          <li>GND → GND</li>
          <li>SD → GPIO 32</li>
          <li>WS → GPIO 25</li>
          <li>SCK → GPIO 33</li>
          <li>L/R → GND (left channel)</li>
        </ul>
      `,
    },
    {
      title: "Step 2: Flash the Firmware",
      content: "<p>Connect your ESP32 via USB and use the flasher below. The device will create a WiFi access point on first boot.</p>",
    },
    {
      title: "Step 3: Configure WiFi",
      content: "<p>Connect to the \"WirelessEar-XXXX\" network, open 192.168.4.1 in your browser, and enter your WiFi credentials.</p>",
    },
    {
      title: "Step 4: Listen",
      content: "<p>Open the audio stream URL shown on the config page in VLC, or use any HTTP audio player.</p>",
    },
  ],

  firmware: {
    name: "WirelessEar Firmware",
    version: "1.2.0",
    price: 3.99,
    features: [
      "HTTP audio streaming",
      "Web configuration portal",
      "Low latency (~200ms)",
      "Auto-reconnect on WiFi loss",
    ],
  },

  // No companion app for this project

  support: {
    text: "Questions about the build?",
    links: [
      { label: "Contact Support", url: "/contact" },
    ],
  },
};

export default function WirelessEarProject() {
  return <ProjectPage data={projectData} />;
}
