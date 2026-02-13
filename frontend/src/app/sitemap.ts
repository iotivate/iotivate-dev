import type { MetadataRoute } from "next";
import { getProjects } from "@/lib/api";
import { getTools } from "@/lib/api";
import { getAllPosts } from "@/lib/blog";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iotivate.dev";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/about`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/contact`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/projects`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/tools`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/blog`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  const projectEntries: MetadataRoute.Sitemap = [];
  const projects = await getProjects();
  if (projects) {
    for (const project of projects) {
      projectEntries.push({
        url: `${SITE_URL}/projects/${project.slug}`,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }

  const toolEntries: MetadataRoute.Sitemap = [];
  const tools = await getTools();
  if (tools) {
    for (const tool of tools) {
      if (tool.status === "active" || tool.status === "beta") {
        toolEntries.push({
          url: `${SITE_URL}/tools/${tool.slug}`,
          changeFrequency: "monthly",
          priority: 0.6,
        });
      }
    }
  }

  const blogEntries: MetadataRoute.Sitemap = [];
  const posts = getAllPosts();
  for (const post of posts) {
    blogEntries.push({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: post.date || undefined,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  return [...staticPages, ...projectEntries, ...toolEntries, ...blogEntries];
}
