"use client";

import { useState, useEffect } from "react";
import { useAuth, authFetch } from "@/lib/auth";
import Pagination from "@/components/admin/Pagination";

interface WebhookEvent {
  id: number;
  event_name: string;
  lemon_order_id: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PAGE_SIZE = 20;

const STATUS_COLORS: Record<string, string> = {
  processed: "bg-green-500/20 text-green-400 border-green-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  ignored: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

export default function AdminWebhooks() {
  const { token } = useAuth();
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
  }, [token, skip]);

  async function fetchEvents() {
    if (!token) return;
    try {
      const res = await authFetch(`${API_URL}/api/admin/webhooks?skip=${skip}&limit=${PAGE_SIZE}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.items);
        setTotal(data.total);
      }
    } catch {
      setError("Failed to fetch webhook events");
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/api/admin/webhooks/sync`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setSyncResult(
          `Checked ${data.total_orders} orders. ${data.missing_orders} missing from local database.`
        );
      } else {
        const data = await res.json();
        setError(data.detail || "Sync failed");
      }
    } catch {
      setError("Failed to sync orders");
    } finally {
      setSyncing(false);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold">Webhook Events</h1>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncing ? "Syncing..." : "Sync Orders"}
        </button>
      </div>

      {error && (
        <div className="p-4 mb-6 border border-red-500/30 bg-red-500/5 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {syncResult && (
        <div className="p-4 mb-6 border border-accent/30 bg-accent/5 rounded-lg text-sm text-accent">
          {syncResult}
        </div>
      )}

      <div className="space-y-3">
        {events.length === 0 && skip === 0 ? (
          <p className="text-muted">No webhook events yet.</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="p-4 border border-border rounded-lg">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-sm">{event.event_name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        STATUS_COLORS[event.status] || "bg-surface text-muted border-border"
                      }`}
                    >
                      {event.status}
                    </span>
                  </div>
                  {event.lemon_order_id && (
                    <p className="text-xs text-muted">Order: {event.lemon_order_id}</p>
                  )}
                  {event.error_message && (
                    <p className="text-xs text-red-400 mt-1 break-all">{event.error_message}</p>
                  )}
                </div>
                <span className="text-xs text-muted whitespace-nowrap shrink-0">
                  {formatDate(event.created_at)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      <Pagination total={total} skip={skip} limit={PAGE_SIZE} onPageChange={setSkip} />
    </div>
  );
}
