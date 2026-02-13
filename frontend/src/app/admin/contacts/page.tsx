"use client";

import { useState, useEffect } from "react";
import { useAuth, authFetch } from "@/lib/auth";
import Pagination from "@/components/admin/Pagination";

interface Contact {
  id: number;
  name: string;
  email: string;
  message: string;
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PAGE_SIZE = 20;

export default function AdminContacts() {
  const { token } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchContacts();
  }, [token, skip]);

  async function fetchContacts() {
    if (!token) return;
    try {
      const res = await authFetch(`${API_URL}/api/admin/contacts?skip=${skip}&limit=${PAGE_SIZE}`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.items);
        setTotal(data.total);
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
        {contacts.length === 0 && skip === 0 ? (
          <p className="text-muted">No contact messages yet.</p>
        ) : (
          contacts.map((contact) => (
            <div key={contact.id} className="p-4 border border-border rounded-lg">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{contact.name}</h3>
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-sm text-accent hover:underline break-all"
                  >
                    {contact.email}
                  </a>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted whitespace-nowrap">{formatDate(contact.created_at)}</span>
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
      <Pagination total={total} skip={skip} limit={PAGE_SIZE} onPageChange={setSkip} />
    </div>
  );
}
