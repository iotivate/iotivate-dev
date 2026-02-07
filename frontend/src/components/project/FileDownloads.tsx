"use client";

import { ReactNode } from "react";

export interface DownloadFile {
  name: string;
  url: string;
  size?: string;
  type: "stl" | "pdf" | "zip" | "other";
}

interface FileDownloadsProps {
  title?: string;
  files: DownloadFile[];
}

const FILE_ICONS: Record<string, ReactNode> = {
  stl: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
    </svg>
  ),
  pdf: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  zip: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  ),
  other: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

export default function FileDownloads({ title = "Downloads", files }: FileDownloadsProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-surface border-b border-border">
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="divide-y divide-border">
        {files.map((file, index) => (
          <a
            key={index}
            href={file.url}
            download
            className="flex items-center gap-3 px-4 py-3 hover:bg-surface/50 transition-colors"
          >
            <div className="text-accent">
              {FILE_ICONS[file.type] || FILE_ICONS.other}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">{file.name}</div>
              {file.size && <div className="text-xs text-muted">{file.size}</div>}
            </div>
            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  );
}
