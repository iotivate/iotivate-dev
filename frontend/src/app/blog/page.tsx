import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Blog",
  description: "Articles on IoT, ESP32 development, and hardware projects.",
};

export default function BlogPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <PageHeader
        title="Blog"
        description="Articles on IoT development, ESP32 tips, and project deep-dives."
      />
      <div className="border border-border rounded-lg p-12 text-center">
        <h2 className="text-xl font-semibold mb-2">No posts yet</h2>
        <p className="text-sm text-muted">
          We&apos;re working on our first articles. Check back soon.
        </p>
      </div>
    </div>
  );
}
