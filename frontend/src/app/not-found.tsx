import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <section className="py-20 sm:py-32 text-center">
        <h1 className="text-6xl sm:text-8xl font-bold text-accent">404</h1>
        <p className="mt-4 text-xl sm:text-2xl font-semibold">
          Page not found
        </p>
        <p className="mt-2 text-muted max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors"
          >
            Go Home
          </Link>
          <Link
            href="/projects"
            className="inline-flex items-center px-6 py-3 border border-border font-medium rounded-lg hover:bg-surface transition-colors"
          >
            Explore Projects
          </Link>
        </div>
      </section>
    </div>
  );
}
