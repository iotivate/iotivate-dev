import type { NextConfig } from "next";

// The radar app talks to the shared backend on api.iotivate.dev (prod) or
// api.iotivate.localhost:8000 (local subdomain dev — see
// docs/LOCAL_SUBDOMAIN_DEV.md). connect-src must allow those origins plus the
// wss:// endpoints that live radar telemetry will use from Phase 3 on.
const API_CONNECT = [
  "https://api.iotivate.dev",
  "wss://api.iotivate.dev",
  "http://api.iotivate.localhost:8000",
  "ws://api.iotivate.localhost:8000",
];

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // 'unsafe-eval'/'unsafe-inline' are required by the Next.js dev runtime.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob:",
      `connect-src 'self' ${API_CONNECT.join(" ")}`,
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin the workspace root to this app. Without it, Next infers the root from
  // the nearest lockfile and warns because sibling lockfiles exist in the repo.
  turbopack: { root: __dirname },
  // Allow the Next dev server to serve assets when reached on the shared-parent
  // localhost hosts used for cross-subdomain SSO testing.
  allowedDevOrigins: [
    "iotivate.localhost",
    "radar.iotivate.localhost",
    "api.iotivate.localhost",
  ],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
