"use client";

export interface Part {
  name: string;
  quantity: number;
  description?: string;
  buyLink?: string;
  price?: string;
}

interface PartsListProps {
  parts: Part[];
}

export default function PartsList({ parts }: PartsListProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-surface border-b border-border">
        <h3 className="font-semibold">Parts List</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-muted">Component</th>
              <th className="px-4 py-2 text-center font-medium text-muted">Qty</th>
              <th className="px-4 py-2 text-left font-medium text-muted">Notes</th>
              <th className="px-4 py-2 text-right font-medium text-muted">Buy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {parts.map((part, index) => (
              <tr key={index} className="hover:bg-surface/30">
                <td className="px-4 py-3 font-medium">{part.name}</td>
                <td className="px-4 py-3 text-center text-muted">{part.quantity}</td>
                <td className="px-4 py-3 text-muted">{part.description || "—"}</td>
                <td className="px-4 py-3 text-right">
                  {part.buyLink ? (
                    <a
                      href={part.buyLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-accent hover:underline"
                    >
                      {part.price || "Buy"}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
