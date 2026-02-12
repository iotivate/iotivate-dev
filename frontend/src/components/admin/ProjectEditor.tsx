"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import FilePicker, {
  StagedFilePreview,
  FilePreview,
  uploadStagedFiles,
  type StagedFile,
} from "./FileUpload";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Part {
  name: string;
  quantity: number;
  description?: string;
  buyLink?: string;
  price?: string;
}

interface Download {
  name: string;
  url: string;
  size?: string;
  type: string;
}

interface BuildStep {
  title: string;
  content: string;
  warning?: string;
}

interface ProjectFormData {
  slug: string;
  name: string;
  description: string;
  tags: string;
  youtube_id: string;
  overview: string;
  parts: Part[];
  downloads: Download[];
  circuit: { src: string; alt: string; downloadUrl: string } | null;
  build_guide: BuildStep[];
  firmware: {
    name: string;
    version: string;
    price: number;
    features: string[];
  } | null;
  app: {
    name: string;
    description: string;
    playStoreUrl: string;
    apkUrl: string;
    apkVersion: string;
    apkSize: string;
    features: string[];
  } | null;
  support: { text: string; links: { label: string; url: string }[] } | null;
  is_published: boolean;
}

interface ProjectEditorProps {
  initialData?: Partial<ProjectFormData>;
  projectId?: number;
  isEdit?: boolean;
}

const emptyForm: ProjectFormData = {
  slug: "",
  name: "",
  description: "",
  tags: "",
  youtube_id: "",
  overview: "",
  parts: [],
  downloads: [],
  circuit: null,
  build_guide: [],
  firmware: null,
  app: null,
  support: null,
  is_published: false,
};

function mergeFormData(initial?: Partial<ProjectFormData>): ProjectFormData {
  if (!initial) return emptyForm;
  return {
    ...emptyForm,
    ...initial,
    parts: initial.parts ?? [],
    downloads: initial.downloads ?? [],
    build_guide: initial.build_guide ?? [],
    youtube_id: initial.youtube_id ?? "",
    overview: initial.overview ?? "",
    tags: initial.tags ?? "",
  };
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function getFileType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const typeMap: Record<string, string> = {
    stl: "stl", pdf: "pdf", zip: "zip", rar: "zip", "7z": "zip",
  };
  return typeMap[ext || ""] || "other";
}

export default function ProjectEditor({ initialData, projectId, isEdit = false }: ProjectEditorProps) {
  const { token } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<ProjectFormData>(() => mergeFormData(initialData));
  const [activeTab, setActiveTab] = useState("basic");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveProgress, setSaveProgress] = useState<string | null>(null);

  // Staged files (not yet uploaded)
  const [stagedDownloads, setStagedDownloads] = useState<StagedFile[]>([]);
  const [stagedCircuit, setStagedCircuit] = useState<StagedFile | null>(null);

  const tabs = [
    { id: "basic", label: "Basic Info" },
    { id: "content", label: "Content" },
    { id: "parts", label: "Parts List" },
    { id: "downloads", label: "Downloads" },
    { id: "guide", label: "Build Guide" },
    { id: "firmware", label: "Firmware" },
    { id: "app", label: "App" },
  ];

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setError(null);

    try {
      const folder = `projects/${form.slug || "new"}`;
      let updatedDownloads = [...form.downloads];
      let updatedCircuit = form.circuit;

      // Upload staged download files
      if (stagedDownloads.length > 0) {
        setSaveProgress("Uploading files...");
        const results = await uploadStagedFiles(
          stagedDownloads,
          folder,
          token,
          (current, total, filename) =>
            setSaveProgress(`Uploading ${current}/${total}: ${filename}`)
        );

        const newDownloads: Download[] = results.map((r) => ({
          name: r.filename,
          url: r.url,
          size: formatSize(r.size),
          type: getFileType(r.filename),
        }));
        updatedDownloads = [...updatedDownloads, ...newDownloads];
      }

      // Upload staged circuit diagram
      if (stagedCircuit) {
        setSaveProgress("Uploading circuit diagram...");
        const [result] = await uploadStagedFiles(
          [stagedCircuit],
          `${folder}/circuit`,
          token
        );
        updatedCircuit = {
          src: result.url,
          alt: form.name ? `${form.name} Circuit Diagram` : "",
          downloadUrl: result.url,
        };
      }

      // Save the project
      setSaveProgress("Saving project...");
      const url = isEdit
        ? `${API_URL}/api/admin/projects/${projectId}`
        : `${API_URL}/api/admin/projects`;

      const payload = {
        ...form,
        downloads: updatedDownloads.length > 0 ? updatedDownloads : null,
        circuit: updatedCircuit,
        parts: form.parts.length > 0 ? form.parts : null,
        build_guide: form.build_guide.length > 0 ? form.build_guide : null,
      };

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push("/admin/projects");
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to save project");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save project");
    } finally {
      setSaving(false);
      setSaveProgress(null);
    }
  }

  // Parts management
  function addPart() {
    setForm({
      ...form,
      parts: [...form.parts, { name: "", quantity: 1, description: "", buyLink: "", price: "" }],
    });
  }

  function updatePart(index: number, field: string, value: string | number) {
    const updated = [...form.parts];
    updated[index] = { ...updated[index], [field]: value };
    setForm({ ...form, parts: updated });
  }

  function removePart(index: number) {
    setForm({ ...form, parts: form.parts.filter((_, i) => i !== index) });
  }

  // Downloads management
  function updateDownload(index: number, field: string, value: string) {
    const updated = [...form.downloads];
    updated[index] = { ...updated[index], [field]: value };
    setForm({ ...form, downloads: updated });
  }

  function removeDownload(index: number) {
    setForm({ ...form, downloads: form.downloads.filter((_, i) => i !== index) });
  }

  // Build steps management
  function addStep() {
    setForm({
      ...form,
      build_guide: [...form.build_guide, { title: "", content: "", warning: "" }],
    });
  }

  function updateStep(index: number, field: string, value: string) {
    const updated = [...form.build_guide];
    updated[index] = { ...updated[index], [field]: value };
    setForm({ ...form, build_guide: updated });
  }

  function removeStep(index: number) {
    setForm({ ...form, build_guide: form.build_guide.filter((_, i) => i !== index) });
  }

  const totalPendingFiles = stagedDownloads.length + (stagedCircuit ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              activeTab === tab.id
                ? "bg-accent text-white"
                : "hover:bg-surface"
            }`}
          >
            {tab.label}
            {tab.id === "downloads" && stagedDownloads.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-accent/20 rounded-full">
                {stagedDownloads.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 border border-red-500/30 bg-red-500/5 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Basic Info Tab */}
      {activeTab === "basic" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Slug *</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                placeholder="my-project"
                disabled={isEdit}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My Awesome Project"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description for project cards"
              rows={2}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tags</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="ESP32,WiFi,IoT"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg"
              />
              <p className="text-xs text-muted mt-1">Comma-separated</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">YouTube Video ID</label>
              <input
                type="text"
                value={form.youtube_id || ""}
                onChange={(e) => setForm({ ...form, youtube_id: e.target.value })}
                placeholder="dQw4w9WgXcQ"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg"
              />
              <p className="text-xs text-muted mt-1">From youtube.com/watch?v=THIS_PART</p>
            </div>
          </div>
        </div>
      )}

      {/* Content Tab */}
      {activeTab === "content" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Overview (HTML)</label>
            <textarea
              value={form.overview || ""}
              onChange={(e) => setForm({ ...form, overview: e.target.value })}
              placeholder="<p>Detailed project overview...</p>"
              rows={8}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg font-mono text-sm"
            />
          </div>

          {/* Circuit Diagram */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">Circuit Diagram</label>
            {form.circuit?.src ? (
              <div className="p-4 border border-border rounded-lg space-y-3">
                <FilePreview
                  url={form.circuit.src}
                  filename="Circuit Diagram"
                  onRemove={() => setForm({ ...form, circuit: null })}
                />
                <input
                  type="text"
                  value={form.circuit.alt || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      circuit: { ...form.circuit!, alt: e.target.value },
                    })
                  }
                  placeholder="Alt text (e.g., 'Smart Relay Wiring Diagram')"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                />
              </div>
            ) : stagedCircuit ? (
              <div className="p-4 border border-border rounded-lg">
                <StagedFilePreview
                  staged={stagedCircuit}
                  onRemove={() => setStagedCircuit(null)}
                />
              </div>
            ) : (
              <FilePicker
                accept=".png,.jpg,.jpeg,.svg,.webp,.pdf"
                hint="PNG, JPG, SVG, or PDF"
                multiple={false}
                onFiles={(files) => setStagedCircuit(files[0])}
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Support Text</label>
            <input
              type="text"
              value={form.support?.text || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  support: { text: e.target.value, links: form.support?.links || [] },
                })
              }
              placeholder="Need help with the build?"
              className="w-full px-4 py-2 bg-background border border-border rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Parts Tab */}
      {activeTab === "parts" && (
        <div className="space-y-4">
          {form.parts.map((part, index) => (
            <div key={index} className="p-4 border border-border rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Part {index + 1}</span>
                <button onClick={() => removePart(index)} className="text-red-400 hover:text-red-300">
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  value={part.name}
                  onChange={(e) => updatePart(index, "name", e.target.value)}
                  placeholder="Part name"
                  className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                />
                <input
                  type="number"
                  value={part.quantity}
                  onChange={(e) => updatePart(index, "quantity", parseInt(e.target.value) || 1)}
                  placeholder="Qty"
                  className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                />
                <input
                  type="text"
                  value={part.price || ""}
                  onChange={(e) => updatePart(index, "price", e.target.value)}
                  placeholder="$5"
                  className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                />
                <input
                  type="text"
                  value={part.buyLink || ""}
                  onChange={(e) => updatePart(index, "buyLink", e.target.value)}
                  placeholder="Buy link URL"
                  className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                />
              </div>
              <input
                type="text"
                value={part.description || ""}
                onChange={(e) => updatePart(index, "description", e.target.value)}
                placeholder="Description / notes"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
              />
            </div>
          ))}
          <button
            onClick={addPart}
            className="px-4 py-2 border border-dashed border-border rounded-lg hover:bg-surface transition-colors w-full"
          >
            + Add Part
          </button>
        </div>
      )}

      {/* Downloads Tab */}
      {activeTab === "downloads" && (
        <div className="space-y-4">
          {/* File picker */}
          <FilePicker
            accept=".stl,.pdf,.zip,.rar,.7z,.bin,.hex,.png,.jpg,.jpeg"
            label="Add Files"
            hint="STL, PDF, ZIP, firmware, images (max 100MB each)"
            onFiles={(files) => setStagedDownloads((prev) => [...prev, ...files])}
          />

          {/* Staged files (pending upload) */}
          {stagedDownloads.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-accent">
                Pending Upload ({stagedDownloads.length} file{stagedDownloads.length > 1 ? "s" : ""})
              </h4>
              {stagedDownloads.map((staged) => (
                <StagedFilePreview
                  key={staged.id}
                  staged={staged}
                  onRemove={() =>
                    setStagedDownloads((prev) => prev.filter((f) => f.id !== staged.id))
                  }
                />
              ))}
            </div>
          )}

          {/* Already uploaded files */}
          {form.downloads.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted">Uploaded Files</h4>
              {form.downloads.map((dl, index) => (
                <div key={index} className="p-4 border border-border rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{dl.name}</span>
                    <button onClick={() => removeDownload(index)} className="text-red-400 hover:text-red-300 text-sm">
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <input
                      type="text"
                      value={dl.name}
                      onChange={(e) => updateDownload(index, "name", e.target.value)}
                      placeholder="Display name"
                      className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      value={dl.url}
                      placeholder="URL"
                      className="px-3 py-2 bg-background border border-border rounded-lg text-sm opacity-50"
                      readOnly
                    />
                    <input
                      type="text"
                      value={dl.size || ""}
                      onChange={(e) => updateDownload(index, "size", e.target.value)}
                      placeholder="Size"
                      className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    />
                    <select
                      value={dl.type}
                      onChange={(e) => updateDownload(index, "type", e.target.value)}
                      className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    >
                      <option value="stl">STL</option>
                      <option value="pdf">PDF</option>
                      <option value="zip">ZIP</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Build Guide Tab */}
      {activeTab === "guide" && (
        <div className="space-y-4">
          {form.build_guide.map((step, index) => (
            <div key={index} className="p-4 border border-border rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Step {index + 1}</span>
                <button onClick={() => removeStep(index)} className="text-red-400 hover:text-red-300">
                  Remove
                </button>
              </div>
              <input
                type="text"
                value={step.title}
                onChange={(e) => updateStep(index, "title", e.target.value)}
                placeholder="Step title"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
              />
              <textarea
                value={step.content}
                onChange={(e) => updateStep(index, "content", e.target.value)}
                placeholder="<p>Step content in HTML...</p>"
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono"
              />
              <input
                type="text"
                value={step.warning || ""}
                onChange={(e) => updateStep(index, "warning", e.target.value)}
                placeholder="Warning message (optional)"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
              />
            </div>
          ))}
          <button
            onClick={addStep}
            className="px-4 py-2 border border-dashed border-border rounded-lg hover:bg-surface transition-colors w-full"
          >
            + Add Step
          </button>
        </div>
      )}

      {/* Firmware Tab */}
      {activeTab === "firmware" && (
        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.firmware !== null}
              onChange={(e) =>
                setForm({
                  ...form,
                  firmware: e.target.checked
                    ? { name: "", version: "1.0.0", price: 0, features: [] }
                    : null,
                })
              }
              className="rounded border-border"
            />
            <span className="text-sm">This project has firmware for sale</span>
          </label>

          {form.firmware && (
            <div className="p-4 border border-border rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Firmware Name</label>
                  <input
                    type="text"
                    value={form.firmware.name}
                    onChange={(e) => setForm({ ...form, firmware: { ...form.firmware!, name: e.target.value } })}
                    placeholder="My Project Firmware"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Version</label>
                  <input
                    type="text"
                    value={form.firmware.version}
                    onChange={(e) => setForm({ ...form, firmware: { ...form.firmware!, version: e.target.value } })}
                    placeholder="1.0.0"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Price (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.firmware.price}
                    onChange={(e) => setForm({ ...form, firmware: { ...form.firmware!, price: parseFloat(e.target.value) || 0 } })}
                    placeholder="5.99"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Features (one per line)</label>
                <textarea
                  value={form.firmware.features.join("\n")}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      firmware: { ...form.firmware!, features: e.target.value.split("\n").filter(Boolean) },
                    })
                  }
                  placeholder="WiFi configuration&#10;OTA updates&#10;Web interface"
                  rows={4}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* App Tab */}
      {activeTab === "app" && (
        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.app !== null}
              onChange={(e) =>
                setForm({
                  ...form,
                  app: e.target.checked
                    ? { name: "", description: "", playStoreUrl: "", apkUrl: "", apkVersion: "", apkSize: "", features: [] }
                    : null,
                })
              }
              className="rounded border-border"
            />
            <span className="text-sm">This project has a companion app</span>
          </label>

          {form.app && (
            <div className="p-4 border border-border rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">App Name</label>
                  <input
                    type="text"
                    value={form.app.name}
                    onChange={(e) => setForm({ ...form, app: { ...form.app!, name: e.target.value } })}
                    placeholder="My Project Controller"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <input
                    type="text"
                    value={form.app.description}
                    onChange={(e) => setForm({ ...form, app: { ...form.app!, description: e.target.value } })}
                    placeholder="Control your device from anywhere"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Play Store URL</label>
                  <input
                    type="text"
                    value={form.app.playStoreUrl}
                    onChange={(e) => setForm({ ...form, app: { ...form.app!, playStoreUrl: e.target.value } })}
                    placeholder="https://play.google.com/store/apps/..."
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">APK Download URL</label>
                  <input
                    type="text"
                    value={form.app.apkUrl}
                    onChange={(e) => setForm({ ...form, app: { ...form.app!, apkUrl: e.target.value } })}
                    placeholder="/apps/my-app.apk"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">APK Version</label>
                  <input
                    type="text"
                    value={form.app.apkVersion}
                    onChange={(e) => setForm({ ...form, app: { ...form.app!, apkVersion: e.target.value } })}
                    placeholder="1.0.0"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">APK Size</label>
                  <input
                    type="text"
                    value={form.app.apkSize}
                    onChange={(e) => setForm({ ...form, app: { ...form.app!, apkSize: e.target.value } })}
                    placeholder="12 MB"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Features (one per line)</label>
                <textarea
                  value={form.app.features.join("\n")}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      app: { ...form.app!, features: e.target.value.split("\n").filter(Boolean) },
                    })
                  }
                  placeholder="Remote control&#10;Scheduling&#10;Notifications"
                  rows={4}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.is_published}
            onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
            className="rounded border-border"
          />
          <span className="text-sm">Publish immediately</span>
        </label>
        <div className="flex items-center gap-3">
          {saveProgress && (
            <span className="text-sm text-accent">{saveProgress}</span>
          )}
          {totalPendingFiles > 0 && !saving && (
            <span className="text-xs text-muted">
              {totalPendingFiles} file{totalPendingFiles > 1 ? "s" : ""} will be uploaded on save
            </span>
          )}
          <button
            onClick={() => router.push("/admin/projects")}
            className="px-4 py-2 border border-border rounded-lg hover:bg-surface transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.slug || !form.name || !form.description}
            className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : isEdit ? "Update Project" : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}
