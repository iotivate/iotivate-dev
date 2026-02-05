const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Tool {
  id: number;
  slug: string;
  name: string;
  description: string;
  status: string;
}

export interface Project {
  id: number;
  slug: string;
  name: string;
  description: string;
  tags: string;
}

async function fetchAPI<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function getTools() {
  return fetchAPI<Tool[]>("/api/tools/");
}

export function getTool(slug: string) {
  return fetchAPI<Tool>(`/api/tools/${slug}`);
}

export function getProjects() {
  return fetchAPI<Project[]>("/api/projects/");
}

export function getProject(slug: string) {
  return fetchAPI<Project>(`/api/projects/${slug}`);
}
