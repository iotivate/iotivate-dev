"use client";

import { useState, useEffect } from "react";
import { useAuth, authFetch } from "@/lib/auth";
import Link from "next/link";
import Pagination from "@/components/admin/Pagination";

interface Project {
  id: number;
  slug: string;
  name: string;
  description: string;
  tags: string;
  is_published: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PAGE_SIZE = 20;

export default function AdminProjects() {
  const { token } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    fetchProjects();
  }, [token, skip]);

  async function fetchProjects() {
    if (!token) return;
    try {
      const res = await authFetch(`${API_URL}/api/admin/projects?skip=${skip}&limit=${PAGE_SIZE}`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.items);
        setTotal(data.total);
      }
    } catch {
      setError("Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this project?")) return;
    setBusyId(id);
    try {
      const res = await authFetch(`${API_URL}/api/admin/projects/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchProjects();
      }
    } catch {
      setError("Failed to delete project");
    } finally {
      setBusyId(null);
    }
  }

  async function togglePublish(id: number, currentStatus: boolean) {
    setBusyId(id);
    try {
      const res = await authFetch(`${API_URL}/api/admin/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: !currentStatus }),
      });
      if (res.ok) {
        fetchProjects();
      }
    } catch {
      setError("Failed to update project");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="text-muted">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Link
          href="/admin/projects/new"
          className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
        >
          New Project
        </Link>
      </div>

      {error && (
        <div className="p-4 mb-6 border border-red-500/30 bg-red-500/5 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {projects.length === 0 && skip === 0 ? (
          <p className="text-muted">No projects yet. Create your first one.</p>
        ) : (
          projects.map((project) => {
            const isBusy = busyId === project.id;
            return (
              <div key={project.id} className="p-4 border border-border rounded-lg">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold">{project.name}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          project.is_published
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                        }`}
                      >
                        {project.is_published ? "Published" : "Draft"}
                      </span>
                    </div>
                    <p className="text-sm text-muted mb-2">{project.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span>/{project.slug}</span>
                      {project.tags && (
                        <div className="flex gap-1">
                          {project.tags.split(",").filter(Boolean).map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 bg-surface rounded">
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => togglePublish(project.id, project.is_published)}
                      disabled={isBusy}
                      className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isBusy ? (
                        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : project.is_published ? (
                        "Unpublish"
                      ) : (
                        "Publish"
                      )}
                    </button>
                    <Link
                      href={`/admin/projects/${project.id}/edit`}
                      className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-surface transition-colors"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(project.id)}
                      disabled={isBusy}
                      className="px-3 py-1.5 text-sm text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isBusy ? (
                        <span className="inline-block w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        "Delete"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <Pagination total={total} skip={skip} limit={PAGE_SIZE} onPageChange={setSkip} />
    </div>
  );
}
