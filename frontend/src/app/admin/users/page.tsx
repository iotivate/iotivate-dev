"use client";

import { useState, useEffect } from "react";
import { useAuth, authFetch } from "@/lib/auth";
import Pagination from "@/components/admin/Pagination";

interface AdminUser {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  is_admin: boolean;
  is_pro: boolean;
  subscription_status: string | null;
  subscription_ends_at: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PAGE_SIZE = 20;

export default function AdminUsers() {
  const { token } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [token, skip]);

  async function fetchUsers() {
    if (!token) return;
    try {
      const res = await authFetch(`${API_URL}/api/admin/users?skip=${skip}&limit=${PAGE_SIZE}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.items);
        setTotal(data.total);
      }
    } catch {
      setError("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString();
  }

  if (loading) {
    return <div className="text-muted">Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Users</h1>

      {error && (
        <div className="p-4 mb-6 border border-red-500/30 bg-red-500/5 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-3 font-medium text-muted">Username</th>
              <th className="pb-3 font-medium text-muted">Email</th>
              <th className="pb-3 font-medium text-muted">Role</th>
              <th className="pb-3 font-medium text-muted">Subscription</th>
              <th className="pb-3 font-medium text-muted">Ends At</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && skip === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b border-border/50">
                  <td className="py-3">
                    <span className="font-medium">{user.username}</span>
                  </td>
                  <td className="py-3 text-muted">{user.email}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-1.5">
                      {user.is_admin && (
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          Admin
                        </span>
                      )}
                      {user.is_pro && (
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-accent/10 text-accent border border-accent/20">
                          Pro
                        </span>
                      )}
                      {!user.is_admin && !user.is_pro && (
                        <span className="text-xs text-muted">Free</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3">
                    {user.subscription_status ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        user.subscription_status === "active"
                          ? "bg-green-500/10 text-green-400"
                          : user.subscription_status === "cancelled"
                          ? "bg-yellow-500/10 text-yellow-400"
                          : user.subscription_status === "expired"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-surface text-muted"
                      }`}>
                        {user.subscription_status}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="py-3 text-xs text-muted">
                    {formatDate(user.subscription_ends_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination total={total} skip={skip} limit={PAGE_SIZE} onPageChange={setSkip} />
    </div>
  );
}
