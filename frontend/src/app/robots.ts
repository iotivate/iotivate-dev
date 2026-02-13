import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iotivate.dev";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/api",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
