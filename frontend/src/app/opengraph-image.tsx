import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "iotivate.dev — Simplifying IoT, One Module at a Time";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: "#111",
          padding: "60px 80px",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Accent bar at top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "6px",
            background: "linear-gradient(90deg, #5BA8A0, #6BB8B0, #5BA8A0)",
          }}
        />

        {/* Subtle grid pattern */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(91,168,160,0.06) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              fontSize: "64px",
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.1,
              letterSpacing: "-2px",
            }}
          >
            iotivate.dev
          </div>
          <div
            style={{
              fontSize: "28px",
              color: "#5BA8A0",
              fontWeight: 500,
              lineHeight: 1.3,
            }}
          >
            Simplifying IoT, One Module at a Time
          </div>
          <div
            style={{
              fontSize: "20px",
              color: "#888",
              lineHeight: 1.5,
              maxWidth: "700px",
            }}
          >
            Web-based tools, firmware, and hardware for ESP32 and IoT projects.
            No installs required.
          </div>
        </div>

        {/* Bottom pills */}
        <div
          style={{
            position: "absolute",
            bottom: "50px",
            left: "80px",
            display: "flex",
            gap: "12px",
          }}
        >
          {["Web Flasher", "Serial Monitor", "Pin Planner"].map((tool) => (
            <div
              key={tool}
              style={{
                padding: "8px 20px",
                borderRadius: "20px",
                border: "1px solid rgba(91,168,160,0.3)",
                color: "#5BA8A0",
                fontSize: "16px",
              }}
            >
              {tool}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
