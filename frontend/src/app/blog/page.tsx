import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { getAllPosts } from "@/lib/blog";
import { JsonLd } from "@/lib/jsonld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iotivate.dev";

export const metadata: Metadata = {
  title: "Blog",
  description: "Articles on IoT, ESP32 development, and hardware projects.",
  alternates: { canonical: "/blog" },
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Blog",
          description:
            "Articles on IoT, ESP32 development, and hardware projects.",
          url: `${SITE_URL}/blog`,
          mainEntity: {
            "@type": "ItemList",
            itemListElement: posts.map((post, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: post.title,
              url: `${SITE_URL}/blog/${post.slug}`,
            })),
          },
        }}
      />
      <PageHeader
        title="Blog"
        description="Articles on IoT development, ESP32 tips, and project deep-dives."
      />
      {posts.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center">
          <h2 className="text-xl font-semibold mb-2">No posts yet</h2>
          <p className="text-sm text-muted">
            We&apos;re working on our first articles. Check back soon.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {posts.map((post) => (
            <article key={post.slug} className="border-b border-border pb-8 last:border-0">
              <Link href={`/blog/${post.slug}`} className="group">
                <h2 className="text-xl font-semibold mb-2 group-hover:text-accent transition-colors">
                  {post.title}
                </h2>
              </Link>
              <p className="text-sm text-muted mb-3">{post.description}</p>
              <div className="flex items-center gap-4 text-xs text-muted">
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                {post.tags.length > 0 && (
                  <div className="flex gap-2">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded bg-surface border border-border"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
