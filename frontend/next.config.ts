import type { NextConfig } from "next";

// Allow the browser to talk to whichever API origin this deployment is
// configured for (plus its ws:// variant for radar's future live features).
// Without this, connect-src only lists the prod backend, so running against a
// local backend is blocked by CSP and surfaces as a "Network error" on login.
// Additive: the hardcoded prod hosts below stay.
const apiOrigin = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const apiConnectSrc = [apiOrigin, apiOrigin.replace(/^http/, "ws")].join(" ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.lemonsqueezy.com https://assets.lemonsqueezy.com https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob: https: https://files.iotivate.dev https://app.lemonsqueezy.com https://assets.lemonsqueezy.com https://github.com https://raw.githubusercontent.com https://user-images.githubusercontent.com https://camo.githubusercontent.com",
      "object-src https://files.iotivate.dev",
      "media-src 'self' https://files.iotivate.dev",
      "frame-src https://www.youtube.com https://app.lemonsqueezy.com https://*.lemonsqueezy.com",
      `connect-src 'self' ${apiConnectSrc} https://files.iotivate.dev https://app.lemonsqueezy.com https://assets.lemonsqueezy.com https://iotivate-backend.onrender.com https://cloudflareinsights.com`,
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.0.177"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
