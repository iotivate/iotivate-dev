"use client";

import { useState, useEffect } from "react";
import { useAuth, authFetch } from "@/lib/auth";

interface Contact {
  id: number;
  name: string;
  email: string;
  message: string;
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AdminContacts() {
  const { token } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchContacts();
  }, [token]);

  async function fetchContacts() {
    if (!token) return;
    try {
      const res = await authFetch(`${API_URL}/api/admin/contacts`);
      if (res.ok) {
        setContacts(await res.json());
      }
    } catch {
      setError("Failed to fetch contacts");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this message?")) return;
    try {
      const res = await authFetch(`${API_URL}/api/admin/contacts/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchContacts();
      }
    } catch {
      setError("Failed to delete contact");
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString();
  }

  if (loading) {
    return <div className="text-muted">Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Contact Messages</h1>

      {error && (
        <div className="p-4 mb-6 border border-red-500/30 bg-red-500/5 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {contacts.length === 0 ? (
          <p className="text-muted">No contact messages yet.</p>
        ) : (
          contacts.map((contact) => (
            <div key={contact.id} className="p-4 border border-border rounded-lg">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{contact.name}</h3>
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-sm text-accent hover:underline"
                  >
                    {contact.email}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">{formatDate(contact.created_at)}</span>
                  <button
                    onClick={() => handleDelete(contact.id)}
                    className="px-3 py-1.5 text-sm text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="text-sm text-muted whitespace-pre-wrap">{contact.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
