import type { RepairReport } from "./types";

interface RepairPanelProps {
  report: RepairReport;
  onClose: () => void;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${
        ok
          ? "bg-green-500/10 text-green-400 border border-green-500/20"
          : "bg-red-500/10 text-red-400 border border-red-500/20"
      }`}
    >
      {ok ? "\u2713" : "\u2717"} {label}
    </span>
  );
}

export default function RepairPanel({ report, onClose }: RepairPanelProps) {
  return (
    <div className="px-3 py-2 bg-surface border border-border rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          Mesh Analysis
        </span>
        <button
          onClick={onClose}
          className="text-muted hover:text-foreground text-sm transition-colors"
        >
          &times;
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <span className="text-muted">Triangles</span>
        <span className="text-foreground tabular-nums">
          {report.triangleCount.toLocaleString()}
        </span>
        <span className="text-muted">Vertices</span>
        <span className="text-foreground tabular-nums">
          {report.vertexCount.toLocaleString()}
        </span>
        <span className="text-muted">Open edges</span>
        <span className="text-foreground tabular-nums">
          {report.openEdges.toLocaleString()}
        </span>
        <span className="text-muted">Non-manifold edges</span>
        <span className="text-foreground tabular-nums">
          {report.nonManifoldEdges.toLocaleString()}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <StatusBadge ok={report.isWatertight} label="Watertight" />
        <StatusBadge ok={report.isManifold} label="Manifold" />
      </div>
    </div>
  );
}
