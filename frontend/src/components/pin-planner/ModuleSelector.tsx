import type { BoardVariant } from "./types";

interface ModuleSelectorProps {
  variants: BoardVariant[];
  selectedId: string;
  onChange: (id: string) => void;
}

export default function ModuleSelector({
  variants,
  selectedId,
  onChange,
}: ModuleSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-sm font-medium text-muted shrink-0">Board:</label>
      <div className="flex flex-wrap gap-1.5">
        {variants.map((v) => (
          <button
            key={v.id}
            onClick={() => onChange(v.id)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              v.id === selectedId
                ? "bg-accent/10 border-accent text-accent font-medium"
                : "bg-surface border-border text-muted hover:border-accent/40 hover:text-foreground"
            }`}
          >
            {v.shortName}
            <span className="text-[10px] ml-1 opacity-60">{v.pinCount}p</span>
          </button>
        ))}
      </div>
    </div>
  );
}
