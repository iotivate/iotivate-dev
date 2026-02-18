import { ImageResponse } from "next/og";
import { getPostBySlug } from "@/lib/blog";

export const runtime = "nodejs";
export const alt = "iotivate.dev Blog";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  const title = post?.title || "Blog Post";
  const description = post?.description || "";
  const date = post?.date
    ? new Date(post.date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

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
        {/* Accent bar */}
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

        {/* Grid pattern */}
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

        {/* Category + date */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              padding: "6px 16px",
              borderRadius: "16px",
              backgroundColor: "rgba(91,168,160,0.15)",
              border: "1px solid rgba(91,168,160,0.3)",
              color: "#5BA8A0",
              fontSize: "16px",
              fontWeight: 500,
            }}
          >
            Blog
          </div>
          {date && (
            <div style={{ fontSize: "16px", color: "#666" }}>{date}</div>
          )}
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: "52px",
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1.15,
            letterSpacing: "-1px",
            marginBottom: "20px",
            maxWidth: "900px",
          }}
        >
          {title}
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: "22px",
            color: "#888",
            lineHeight: 1.5,
            maxWidth: "800px",
          }}
        >
          {description}
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: "50px",
            left: "80px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div style={{ fontSize: "22px", color: "#5BA8A0", fontWeight: 600 }}>
            iotivate.dev
          </div>
          <div style={{ fontSize: "22px", color: "#444" }}>/</div>
          <div style={{ fontSize: "22px", color: "#666" }}>blog</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
