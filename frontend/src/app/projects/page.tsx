import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { getProjects, type Project } from "@/lib/api";

export const metadata: Metadata = {
  title: "Projects",
  description: "Real IoT projects built with ESP32 — documented builds with source code and schematics.",
};

const fallbackProjects: Partial<Project>[] = [
  {
    id: 1,
    slug: "wirelessear",
    name: "WirelessEar",
    description:
      "A wireless audio monitoring system built with ESP32. Stream audio over Wi-Fi with minimal latency.",
    tags: "ESP32,Audio,Wi-Fi",
  },
];

export default async function ProjectsPage() {
  const result = await getProjects();
  const projects = result?.items || fallbackProjects;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <PageHeader
        title="Projects"
        description="Real IoT builds — documented, open-source, and ready to learn from."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.map((project) => (
          <Link
            key={project.slug}
            href={`/projects/${project.slug}`}
            className="block p-6 border border-border rounded-lg hover:border-accent/50 transition-colors group"
          >
            <h2 className="text-lg font-semibold mb-2 group-hover:text-accent transition-colors">{project.name}</h2>
            <p className="text-sm text-muted leading-relaxed mb-4">
              {project.description}
            </p>
            <div className="flex flex-wrap gap-2">
              {(project.tags || "")
                .split(",")
                .filter(Boolean)
                .map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-1 rounded bg-surface text-muted border border-border"
                  >
                    {tag.trim()}
                  </span>
                ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
