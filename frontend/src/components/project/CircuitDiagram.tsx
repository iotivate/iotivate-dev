"use client";

import { useState } from "react";
import Image from "next/image";

interface CircuitDiagramProps {
  src: string;
  alt?: string;
  downloadUrl?: string;
}

export default function CircuitDiagram({ src, alt = "Circuit Diagram", downloadUrl }: CircuitDiagramProps) {
  const [isZoomed, setIsZoomed] = useState(false);

  return (
    <>
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-surface border-b border-border">
          <h3 className="font-semibold">Circuit Diagram</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setIsZoomed(true)}
              className="text-sm text-accent hover:underline flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
              Zoom
            </button>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download
                className="text-sm text-accent hover:underline flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </a>
            )}
          </div>
        </div>
        <div
          className="p-4 bg-white cursor-pointer"
          onClick={() => setIsZoomed(true)}
        >
          <img
            src={src}
            alt={alt}
            className="w-full h-auto"
          />
        </div>
      </div>

      {/* Zoom modal */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsZoomed(false)}
        >
          <button
            onClick={() => setIsZoomed(false)}
            className="absolute top-4 right-4 text-white hover:text-accent transition-colors"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
