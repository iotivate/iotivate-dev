import type { LoadedFile } from "./types";
import type { Unit } from "./utils";
import { formatLength } from "./utils";

interface FileListPanelProps {
  files: LoadedFile[];
  activeFileId: string | null;
  unit: Unit;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function FileListPanel({
  files,
  activeFileId,
  unit,
  onSelect,
  onToggleVisibility,
  onRemove,
}: FileListPanelProps) {
  if (files.length === 0) return null;

  const uLabel = unit;
  const sup3 = unit === "mm" ? "mm\u00B3" : "in\u00B3";

  return (
    <div className="px-3 py-2 bg-surface border border-border rounded-lg space-y-1">
      <span className="text-xs text-muted font-medium">
        Files ({files.length})
      </span>
      {files.map((f) => (
        <div
          key={f.id}
          onClick={() => onSelect(f.id)}
          className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors text-sm ${
            f.id === activeFileId
              ? "bg-accent/10 border border-accent/20"
              : "hover:bg-surface-hover border border-transparent"
          }`}
        >
          {/* Color dot */}
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: f.color }}
          />

          {/* Name + dimensions */}
          <span className="flex-1 min-w-0 truncate text-foreground">
            {f.name}
          </span>
          <span className="text-xs text-muted tabular-nums whitespace-nowrap">
            {formatLength(f.dimensions.x, unit)}&times;
            {formatLength(f.dimensions.y, unit)}&times;
            {formatLength(f.dimensions.z, unit)} {uLabel}
          </span>

          {/* Visibility toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility(f.id);
            }}
            className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
              f.visible
                ? "text-muted hover:text-foreground"
                : "text-muted/40 hover:text-muted"
            }`}
            title={f.visible ? "Hide" : "Show"}
          >
            {f.visible ? "\u25C9" : "\u25CE"}
          </button>

          {/* Remove */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(f.id);
            }}
            className="text-xs text-muted hover:text-red-400 transition-colors"
            title="Remove"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
