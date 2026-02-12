"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <section className="py-20 sm:py-32 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold">Something went wrong</h1>
        <p className="mt-4 text-muted max-w-md mx-auto">
          An unexpected error occurred. Please try again.
        </p>
        <div className="mt-8">
          <button
            onClick={reset}
            className="inline-flex items-center px-6 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors"
          >
            Try Again
          </button>
        </div>
      </section>
    </div>
  );
}
