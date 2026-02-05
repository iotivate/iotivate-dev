import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProject, getProjects } from "@/lib/api";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const projects = await getProjects();
  if (!projects) return [];
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) {
    return { title: "Project Not Found" };
  }
  return {
    title: project.name,
    description: project.description,
  };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = await getProject(slug);

  if (!project) {
    notFound();
  }

  const tags = project.tags.split(",").filter(Boolean);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <Link
        href="/projects"
        className="inline-flex items-center text-sm text-muted hover:text-foreground mb-8"
      >
        <svg
          className="w-4 h-4 mr-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Projects
      </Link>

      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
        {project.name}
      </h1>

      <div className="flex flex-wrap gap-2 mb-8">
        {tags.map((tag) => (
          <span
            key={tag}
            className="text-xs px-2 py-1 rounded bg-surface text-muted border border-border"
          >
            {tag.trim()}
          </span>
        ))}
      </div>

      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <p className="text-lg text-muted leading-relaxed">{project.description}</p>

        <div className="mt-12 p-6 border border-border rounded-lg bg-surface/50">
          <h2 className="text-lg font-semibold mb-2">Project details coming soon</h2>
          <p className="text-sm text-muted">
            Full documentation, schematics, source code, and build guides will be available here.
          </p>
        </div>
      </div>
    </div>
  );
}
