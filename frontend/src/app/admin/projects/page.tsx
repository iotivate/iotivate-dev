"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";

interface Project {
  id: number;
  slug: string;
  name: string;
  description: string;
  tags: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AdminProjects() {
  const { token } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ slug: "", name: "", description: "", tags: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, [token]);

  async function fetchProjects() {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setProjects(await res.json());
      }
    } catch {
      setError("Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ slug: "", name: "", description: "", tags: "" });
        setShowCreate(false);
        fetchProjects();
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to create project");
      }
    } catch {
      setError("Failed to create project");
    }
  }

  async function handleUpdate(id: number) {
    setError(null);
    const project = projects.find((p) => p.id === id);
    if (!project) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/projects/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: project.name,
          description: project.description,
          tags: project.tags,
        }),
      });
      if (res.ok) {
        setEditing(null);
        fetchProjects();
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to update project");
      }
    } catch {
      setError("Failed to update project");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this project?")) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/projects/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchProjects();
      }
    } catch {
      setError("Failed to delete project");
    }
  }

  function updateProject(id: number, field: string, value: string) {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  }

  if (loading) {
    return <div className="text-muted">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
        >
          {showCreate ? "Cancel" : "Add Project"}
        </button>
      </div>

      {error && (
        <div className="p-4 mb-6 border border-red-500/30 bg-red-500/5 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="p-6 border border-border rounded-lg mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="slug (e.g., my-project)"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
              required
            />
            <input
              type="text"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
              required
            />
          </div>
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
            rows={3}
            required
          />
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Tags (comma-separated: ESP32,Audio,Wi-Fi)"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
            >
              Create Project
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {projects.length === 0 ? (
          <p className="text-muted">No projects yet.</p>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="p-4 border border-border rounded-lg">
              {editing === project.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={project.name}
                    onChange={(e) => updateProject(project.id, "name", e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                  />
                  <textarea
                    value={project.description}
                    onChange={(e) => updateProject(project.id, "description", e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                    rows={2}
                  />
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={project.tags}
                      onChange={(e) => updateProject(project.id, "tags", e.target.value)}
                      placeholder="Tags (comma-separated)"
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg"
                    />
                    <button
                      onClick={() => handleUpdate(project.id)}
                      className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditing(null);
                        fetchProjects();
                      }}
                      className="px-4 py-2 border border-border rounded-lg hover:bg-surface transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold mb-1">{project.name}</h3>
                    <p className="text-sm text-muted mb-2">{project.description}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">/{project.slug}</span>
                      {project.tags && (
                        <div className="flex gap-1">
                          {project.tags.split(",").filter(Boolean).map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-2 py-0.5 rounded bg-surface text-muted border border-border"
                            >
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(project.id)}
                      className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-surface transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="px-3 py-1.5 text-sm text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
