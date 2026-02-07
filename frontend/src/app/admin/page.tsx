"use client";

import Link from "next/link";

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/admin/tools"
          className="p-6 border border-border rounded-lg hover:border-accent/50 transition-colors"
        >
          <h2 className="font-semibold mb-2">Tools</h2>
          <p className="text-sm text-muted">Manage tools and their status</p>
        </Link>
        <Link
          href="/admin/projects"
          className="p-6 border border-border rounded-lg hover:border-accent/50 transition-colors"
        >
          <h2 className="font-semibold mb-2">Projects</h2>
          <p className="text-sm text-muted">Manage project showcases</p>
        </Link>
        <Link
          href="/admin/contacts"
          className="p-6 border border-border rounded-lg hover:border-accent/50 transition-colors"
        >
          <h2 className="font-semibold mb-2">Contacts</h2>
          <p className="text-sm text-muted">View contact form submissions</p>
        </Link>
      </div>
    </div>
  );
}
