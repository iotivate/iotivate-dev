const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Tool {
  id: number;
  slug: string;
  name: string;
  description: string;
  status: string;
}

export interface Part {
  name: string;
  quantity: number;
  description?: string;
  buyLink?: string;
  price?: string;
}

export interface DownloadFile {
  name: string;
  url: string;
  size?: string;
  type: "stl" | "pdf" | "zip" | "other";
}

export interface CircuitData {
  src: string;
  alt?: string;
  downloadUrl?: string;
}

export interface BuildStep {
  title: string;
  content: string;
  warning?: string;
}

export interface FirmwareData {
  name: string;
  version: string;
  price: number;
  currency?: string;
  features?: string[];
  firmwareUrl?: string;
}

export interface AppData {
  name: string;
  description?: string;
  playStoreUrl?: string;
  apkUrl?: string;
  apkVersion?: string;
  apkSize?: string;
  iosUrl?: string;
  features?: string[];
}

export interface SupportData {
  text?: string;
  links?: { label: string; url: string }[];
}

export interface Project {
  id: number;
  slug: string;
  name: string;
  description: string;
  tags: string;
  youtube_id?: string;
  overview?: string;
  is_published: boolean;
  parts?: Part[];
  downloads?: DownloadFile[];
  circuit?: CircuitData;
  build_guide?: BuildStep[];
  firmware?: FirmwareData;
  app?: AppData;
  support?: SupportData;
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
