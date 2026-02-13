import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { getTools, type Tool } from "@/lib/api";

export const metadata: Metadata = {
  title: "Tools",
  description: "Web-based IoT and ESP32 tools — flash firmware, configure devices, and more.",
};

const fallbackTools = [
  {
    id: 1,
    slug: "esp32-web-flasher",
    name: "ESP32 Web Flasher",
    description:
      "Flash ESP32 firmware directly from your browser using Web Serial API. No drivers or desktop tools needed.",
    status: "active",
  },
];

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    coming_soon: "Coming Soon",
    active: "Available",
    beta: "Beta",
  };
  return labels[status] || status;
}

export default async function ToolsPage() {
  const result = await getTools();
  const tools: Tool[] = result?.items || fallbackTools;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <PageHeader
        title="Tools"
        description="Web-based tools for ESP32 and IoT development. No installs, no drivers — just your browser."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tools.map((tool) => (
          <Link
            key={tool.slug}
            href={`/tools/${tool.slug}`}
            className="block p-6 border border-border rounded-lg hover:border-accent/50 transition-colors group"
          >
            <div className="flex items-start justify-between mb-2">
              <h2 className="text-lg font-semibold group-hover:text-accent transition-colors">
                {tool.name}
              </h2>
              <span className="text-xs px-2 py-1 rounded-full bg-surface text-muted border border-border">
                {statusLabel(tool.status)}
              </span>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              {tool.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
