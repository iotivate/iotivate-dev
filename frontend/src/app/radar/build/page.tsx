import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iotivate.dev";

const META_DESCRIPTION =
  "Build your own IoTivate Radar: an ESP32 + HLK-LD2450 mmWave sensor. Bill of materials, " +
  "wiring, assembly, and how to flash and pair it.";

export const metadata: Metadata = {
  title: "Build your radar",
  description: META_DESCRIPTION,
  alternates: { canonical: "/radar/build" },
  openGraph: {
    title: "Build your IoTivate Radar",
    description: META_DESCRIPTION,
    url: `${SITE_URL}/radar/build`,
    type: "article",
  },
};

// NOTE: pin assignments, baud rate, and the enclosure are placeholders to confirm
// against the actual firmware build — marked "confirm" below.
const BOM = [
  ["ESP32 dev board", "Any ESP32 with a spare hardware UART and USB (e.g. ESP32-DevKitC)."],
  ["HLK-LD2450 mmWave module", "24 GHz radar; tracks up to 3 moving targets with X/Y + velocity over UART."],
  ["Jumper wires", "4 for the sensor UART (+2 if adding an alarm)."],
  ["USB data cable", "For flashing and power (must carry data, not charge-only)."],
  ["Buzzer or relay (optional)", "For the remote-alarm action; driven from a spare GPIO."],
  ["Enclosure (optional)", "3D-printed mount — STL link: TODO."],
];

const WIRING = [
  ["LD2450 VCC", "ESP32 5V", "Module is 5V-powered."],
  ["LD2450 GND", "ESP32 GND", "Common ground."],
  ["LD2450 TX", "ESP32 RX (GPIO16 — confirm)", "Sensor → ESP32 data."],
  ["LD2450 RX", "ESP32 TX (GPIO17 — confirm)", "ESP32 → sensor (config)."],
  ["Buzzer/relay +", "GPIO (confirm)", "Optional alarm output."],
];

const STEPS = [
  "Wire the LD2450 to the ESP32 per the table above (double-check TX/RX aren't swapped).",
  "If you want the remote alarm, wire a buzzer or relay to a spare GPIO.",
  "Flash the firmware from the browser — no toolchain needed.",
  "Power the ESP32 and join it to WiFi (via the firmware's provisioning / captive portal).",
  "In the dashboard, add a device to get a pairing code.",
  "Enter that code on the device to pair it (it receives its own device token).",
  "Open the device dashboard — you should see live targets. Draw zones and add rules.",
];

function Section({ children }: { children: React.ReactNode }) {
  return <section className="flex flex-col gap-4">{children}</section>;
}

export default function RadarBuildPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-6 py-16">
      <header className="flex flex-col gap-2">
        <span className="text-sm font-medium uppercase tracking-widest text-accent">
          IoTivate Radar
        </span>
        <h1 className="text-3xl font-semibold sm:text-4xl">Build your radar</h1>
        <p className="text-muted">
          A presence sensor you assemble in an afternoon: an ESP32 paired with an HLK-LD2450 mmWave
          module, streaming live X/Y target tracking to your dashboard.
        </p>
      </header>

      <Section>
        <h2 className="text-xl font-semibold">Bill of materials</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {BOM.map(([part, note]) => (
                <tr key={part} className="border-b border-border align-top">
                  <td className="py-2 pr-4 font-medium whitespace-nowrap">{part}</td>
                  <td className="py-2 text-muted">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold">Wiring</h2>
        <p className="text-sm text-muted">
          The LD2450 speaks UART. Connect it to a hardware serial port on the ESP32. Pin numbers
          below are a starting point — confirm them against your board and the firmware config.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 pr-4 font-medium">Sensor</th>
                <th className="py-2 pr-4 font-medium">ESP32</th>
                <th className="py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {WIRING.map(([from, to, note]) => (
                <tr key={from} className="border-b border-border align-top">
                  <td className="py-2 pr-4 font-mono whitespace-nowrap">{from}</td>
                  <td className="py-2 pr-4 font-mono whitespace-nowrap">{to}</td>
                  <td className="py-2 text-muted">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">
          Mount the sensor upright with a clear view of the area; the dashboard treats the device as
          the origin with +Y pointing away from it.
        </p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold">Assemble &amp; connect</h2>
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
                {i + 1}
              </span>
              <span className="pt-0.5 text-sm">{step}</span>
            </li>
          ))}
        </ol>
      </Section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/radar/flash"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          Flash firmware →
        </Link>
        <Link
          href="/radar/devices"
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface"
        >
          Pair a device
        </Link>
      </div>
    </div>
  );
}
