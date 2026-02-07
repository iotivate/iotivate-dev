import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import WebFlasher from "@/components/WebFlasher";
import { getTool, getTools } from "@/lib/api";

// Map tool slugs to their components
const TOOL_COMPONENTS: Record<string, React.ComponentType> = {
  "esp32-web-flasher": WebFlasher,
};

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tool = await getTool(slug);

  if (!tool) {
    return { title: "Tool Not Found" };
  }

  return {
    title: tool.name,
    description: tool.description,
  };
}

export async function generateStaticParams() {
  const tools = await getTools();
  if (!tools) return [];
  return tools.map((tool) => ({ slug: tool.slug }));
}

export default async function ToolPage({ params }: Props) {
  const { slug } = await params;
  const tool = await getTool(slug);

  if (!tool) {
    notFound();
  }

  const ToolComponent = TOOL_COMPONENTS[slug];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <PageHeader title={tool.name} description={tool.description} />

      {ToolComponent ? (
        <ToolComponent />
      ) : (
        <div className="p-8 border border-border rounded-lg bg-surface/50 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 text-accent mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
          <p className="text-muted text-sm max-w-md mx-auto">
            This tool is currently under development. Check back soon for updates.
          </p>
          {tool.status === "coming_soon" && (
            <span className="inline-block mt-4 text-xs px-3 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
              In Development
            </span>
          )}
        </div>
      )}
    </div>
  );
}
