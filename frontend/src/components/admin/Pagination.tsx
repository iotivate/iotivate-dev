"use client";

interface PaginationProps {
  total: number;
  skip: number;
  limit: number;
  onPageChange: (skip: number) => void;
}

export default function Pagination({ total, skip, limit, onPageChange }: PaginationProps) {
  if (total <= limit) return null;

  const currentPage = Math.floor(skip / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex items-center justify-between mt-6 text-sm">
      <span className="text-muted">
        Showing {skip + 1}–{Math.min(skip + limit, total)} of {total}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(skip - limit)}
          disabled={currentPage <= 1}
          className="px-3 py-1.5 border border-border rounded-lg hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="px-3 py-1.5 text-muted">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(skip + limit)}
          disabled={currentPage >= totalPages}
          className="px-3 py-1.5 border border-border rounded-lg hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
