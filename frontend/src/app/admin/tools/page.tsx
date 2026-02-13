"use client";

import { useState, useEffect } from "react";
import { useAuth, authFetch } from "@/lib/auth";
import Pagination from "@/components/admin/Pagination";

interface Tool {
  id: number;
  slug: string;
  name: string;
  description: string;
  status: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PAGE_SIZE = 20;

const STATUS_OPTIONS = ["coming_soon", "active", "beta", "deprecated"];

export default function AdminTools() {
  const { token } = useAuth();
  const [tools, setTools] = useState<Tool[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ slug: "", name: "", description: "", status: "coming_soon" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTools();
  }, [token, skip]);

  async function fetchTools() {
    if (!token) return;
    try {
      const res = await authFetch(`${API_URL}/api/admin/tools?skip=${skip}&limit=${PAGE_SIZE}`);
      if (res.ok) {
        const data = await res.json();
        setTools(data.items);
        setTotal(data.total);
      }
    } catch {
      setError("Failed to fetch tools");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/api/admin/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ slug: "", name: "", description: "", status: "coming_soon" });
        setShowCreate(false);
        fetchTools();
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to create tool");
      }
    } catch {
      setError("Failed to create tool");
    }
  }

  async function handleUpdate(id: number) {
    setError(null);
    const tool = tools.find((t) => t.id === id);
    if (!tool) return;

    try {
      const res = await authFetch(`${API_URL}/api/admin/tools/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tool.name,
          description: tool.description,
          status: tool.status,
        }),
      });
      if (res.ok) {
        setEditing(null);
        fetchTools();
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to update tool");
      }
    } catch {
      setError("Failed to update tool");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this tool?")) return;
    try {
      const res = await authFetch(`${API_URL}/api/admin/tools/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchTools();
      }
    } catch {
      setError("Failed to delete tool");
    }
  }

  function updateTool(id: number, field: string, value: string) {
    setTools((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  }

  if (loading) {
    return <div className="text-muted">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tools</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
        >
          {showCreate ? "Cancel" : "Add Tool"}
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
              placeholder="slug (e.g., my-tool)"
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
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
            >
              Create Tool
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {tools.length === 0 && skip === 0 ? (
          <p className="text-muted">No tools yet.</p>
        ) : (
          tools.map((tool) => (
            <div key={tool.id} className="p-4 border border-border rounded-lg">
              {editing === tool.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={tool.name}
                    onChange={(e) => updateTool(tool.id, "name", e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                  />
                  <textarea
                    value={tool.description}
                    onChange={(e) => updateTool(tool.id, "description", e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                    rows={2}
                  />
                  <div className="flex items-center gap-3">
                    <select
                      value={tool.status}
                      onChange={(e) => updateTool(tool.id, "status", e.target.value)}
                      className="px-3 py-2 bg-background border border-border rounded-lg"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleUpdate(tool.id)}
                      className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditing(null);
                        fetchTools();
                      }}
                      className="px-4 py-2 border border-border rounded-lg hover:bg-surface transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold">{tool.name}</h3>
                      <span className="text-xs px-2 py-1 rounded bg-surface text-muted border border-border">
                        {tool.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-sm text-muted mb-1">{tool.description}</p>
                    <p className="text-xs text-muted">/{tool.slug}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setEditing(tool.id)}
                      className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-surface transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(tool.id)}
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
      <Pagination total={total} skip={skip} limit={PAGE_SIZE} onPageChange={setSkip} />
    </div>
  );
}
