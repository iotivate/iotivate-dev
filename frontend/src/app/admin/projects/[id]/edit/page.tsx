"use client";

import { useState, useEffect, use } from "react";
import { useAuth, authFetch } from "@/lib/auth";
import ProjectEditor from "@/components/admin/ProjectEditor";
import type { Project } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = parseInt(resolvedParams.id);
  const { token } = useAuth();
  const [projectData, setProjectData] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProject() {
      if (!token) return;
      try {
        const res = await authFetch(`${API_URL}/api/admin/projects/${projectId}`);
        if (res.ok) {
          const data = await res.json();
          setProjectData(data);
        } else {
          setError("Project not found");
        }
      } catch {
        setError("Failed to fetch project");
      } finally {
        setLoading(false);
      }
    }
    fetchProject();
  }, [token, projectId]);

  if (loading) {
    return <div className="text-muted">Loading project...</div>;
  }

  if (error) {
    return (
      <div className="p-4 border border-red-500/30 bg-red-500/5 rounded-lg text-sm text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Edit Project</h1>
      {projectData && (
        <ProjectEditor
          initialData={projectData as React.ComponentProps<typeof ProjectEditor>["initialData"]}
          projectId={projectId}
          isEdit
        />
      )}
    </div>
  );
}
