"use client";

import { useState, useCallback, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface StagedFile {
  file: File;
  preview: string; // local object URL for preview
  id: string; // unique id for key prop
}

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  category: string;
}

// Upload utility function - called from ProjectEditor on submit
export async function uploadStagedFiles(
  files: StagedFile[],
  folder: string,
  token: string,
  onProgress?: (current: number, total: number, filename: string) => void
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];

  for (let i = 0; i < files.length; i++) {
    onProgress?.(i + 1, files.length, files[i].file.name);

    const formData = new FormData();
    formData.append("file", files[i].file);
    formData.append("folder", folder);

    const res = await fetch(`${API_URL}/api/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || `Failed to upload ${files[i].file.name}`);
    }

    results.push(await res.json());
  }

  return results;
}

// Helper to format file size
function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

interface FilePickerProps {
  accept?: string;
  onFiles: (files: StagedFile[]) => void;
  label?: string;
  hint?: string;
  multiple?: boolean;
}

export default function FilePicker({
  accept,
  onFiles,
  label = "Add Files",
  hint,
  multiple = true,
}: FilePickerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const stageFiles = useCallback(
    (fileList: FileList) => {
      const staged: StagedFile[] = Array.from(fileList).map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }));
      onFiles(staged);
    },
    [onFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        stageFiles(e.dataTransfer.files);
      }
    },
    [stageFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        stageFiles(e.target.files);
      }
      e.target.value = "";
    },
    [stageFiles]
  );

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium">{label}</label>}

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragging ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="space-y-2">
          <svg
            className="w-8 h-8 mx-auto text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-sm">
            <span className="text-accent font-medium">Click to add</span>
            <span className="text-muted"> or drag and drop</span>
          </p>
          {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

// Preview for a staged (not yet uploaded) file
interface StagedFilePreviewProps {
  staged: StagedFile;
  onRemove: () => void;
}

export function StagedFilePreview({ staged, onRemove }: StagedFilePreviewProps) {
  const isImage = staged.file.type.startsWith("image/");

  return (
    <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg">
      {isImage ? (
        <img src={staged.preview} alt={staged.file.name} className="w-12 h-12 object-cover rounded" />
      ) : (
        <div className="w-12 h-12 flex items-center justify-center bg-background rounded">
          <svg className="w-6 h-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{staged.file.name}</p>
        <p className="text-xs text-muted">{formatSize(staged.file.size)} — Ready to upload</p>
      </div>

      <button
        onClick={onRemove}
        className="p-1 text-muted hover:text-red-400 transition-colors"
        title="Remove"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// Preview for an already-uploaded file
interface FilePreviewProps {
  url: string;
  filename?: string;
  onRemove?: () => void;
}

export function FilePreview({ url, filename, onRemove }: FilePreviewProps) {
  const displayName = filename || url.split("/").pop() || "File";
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);

  return (
    <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg">
      {isImage ? (
        <img src={url} alt={displayName} className="w-12 h-12 object-cover rounded" />
      ) : (
        <div className="w-12 h-12 flex items-center justify-center bg-background rounded">
          <svg className="w-6 h-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{displayName}</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
          View file
        </a>
      </div>

      {onRemove && (
        <button
          onClick={onRemove}
          className="p-1 text-muted hover:text-red-400 transition-colors"
          title="Remove"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
