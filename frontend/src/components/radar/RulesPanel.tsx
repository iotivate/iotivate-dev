"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePro } from "@/lib/auth";
import ProGate from "@/components/ProGate";
import {
  createRule,
  deleteRule,
  listRules,
  updateRule,
  TRIGGER_LABELS,
  type Rule,
  type RuleCreate,
  type TriggerType,
  type Zone,
} from "@/lib/zones";

const TRIGGERS: TriggerType[] = ["enter", "exit", "dwell", "occupancy"];

function triggerSummary(r: Rule): string {
  switch (r.trigger_type) {
    case "enter":
      return "When someone enters";
    case "exit":
      return "When the zone empties";
    case "dwell":
      return `Occupied ≥ ${r.dwell_seconds ?? "?"}s`;
    case "occupancy":
      return `Occupancy ≥ ${r.occupancy_threshold ?? "?"}`;
  }
}

interface FormState {
  zone_id: string;
  name: string;
  trigger_type: TriggerType;
  dwell_seconds: string;
  occupancy_threshold: string;
  cooldown_seconds: string;
  action_dashboard: boolean;
  action_email: boolean;
  notify_email: string;
  action_alarm: boolean;
  alarm_duration_s: string;
}

const EMPTY_FORM: FormState = {
  zone_id: "",
  name: "",
  trigger_type: "enter",
  dwell_seconds: "30",
  occupancy_threshold: "2",
  cooldown_seconds: "60",
  action_dashboard: true,
  action_email: false,
  notify_email: "",
  action_alarm: false,
  alarm_duration_s: "10",
};

export default function RulesPanel({
  deviceId,
  zones,
  reloadSignal,
}: {
  deviceId: number;
  zones: Zone[];
  reloadSignal: number;
}) {
  const { isPro } = usePro();
  const [rules, setRules] = useState<Rule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const zoneName = useMemo(() => {
    const m = new Map<number, string>();
    zones.forEach((z) => m.set(z.id, z.name));
    return m;
  }, [zones]);

  const load = useCallback(() => {
    listRules(deviceId)
      .then((rs) => {
        setRules(rs.items);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load rules"));
  }, [deviceId]);

  useEffect(() => {
    load();
  }, [load, reloadSignal]);

  async function handleToggle(rule: Rule) {
    try {
      const updated = await updateRule(rule.id, { enabled: !rule.enabled });
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update rule");
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete rule");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const zoneId = Number(form.zone_id);
    if (!zoneId) {
      setError("Choose a zone for this rule");
      return;
    }
    const body: RuleCreate = {
      zone_id: zoneId,
      name: form.name.trim(),
      trigger_type: form.trigger_type,
      cooldown_seconds: Number(form.cooldown_seconds) || 0,
      action_dashboard: form.action_dashboard,
      action_email: form.action_email,
      notify_email: form.action_email ? form.notify_email.trim() : null,
      action_alarm: form.action_alarm,
      alarm_duration_ms: form.action_alarm && form.alarm_duration_s
        ? Number(form.alarm_duration_s) * 1000
        : null,
    };
    if (form.trigger_type === "dwell") body.dwell_seconds = Number(form.dwell_seconds) || 0;
    if (form.trigger_type === "occupancy") body.occupancy_threshold = Number(form.occupancy_threshold) || 0;

    setBusy(true);
    setError(null);
    try {
      const created = await createRule(deviceId, body);
      setRules((prev) => [...prev, created]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create rule");
    } finally {
      setBusy(false);
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Rules</h2>
        {isPro && zones.length > 0 && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-background"
          >
            {showForm ? "Cancel" : "Add rule"}
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {!isPro && (
        <ProGate featureName="Automation rules">
          <></>
        </ProGate>
      )}

      {zones.length === 0 ? (
        <p className="text-sm text-muted">Draw a zone on the map first, then add rules to it.</p>
      ) : rules.length === 0 ? (
        <p className="text-sm text-muted">No rules yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{r.name}</span>
                  <span className="rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent">
                    {TRIGGER_LABELS[r.trigger_type]}
                  </span>
                  {!r.enabled && <span className="text-xs text-muted">(disabled)</span>}
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {zoneName.get(r.zone_id) ?? "zone"} · {triggerSummary(r)} · alerts:{" "}
                  {[r.action_dashboard && "dashboard", r.action_email && "email", r.action_alarm && "alarm"].filter(Boolean).join(", ") || "none"}
                </div>
              </div>
              {isPro && (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => handleToggle(r)}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-background"
                  >
                    {r.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="rounded-lg border border-red-300 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {isPro && showForm && zones.length > 0 && (
        <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-xl border border-accent bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-muted">Zone</span>
              <select
                value={form.zone_id}
                onChange={(e) => set("zone_id", e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                required
              >
                <option value="">Select a zone…</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-muted">Rule name</span>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Front door entry"
                maxLength={80}
                required
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-muted">Trigger</span>
              <select
                value={form.trigger_type}
                onChange={(e) => set("trigger_type", e.target.value as TriggerType)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                {TRIGGERS.map((t) => (
                  <option key={t} value={t}>
                    {TRIGGER_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            {form.trigger_type === "dwell" && (
              <label className="text-sm">
                <span className="text-muted">Dwell seconds</span>
                <input
                  type="number"
                  min={1}
                  value={form.dwell_seconds}
                  onChange={(e) => set("dwell_seconds", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </label>
            )}
            {form.trigger_type === "occupancy" && (
              <label className="text-sm">
                <span className="text-muted">Occupancy threshold</span>
                <input
                  type="number"
                  min={1}
                  value={form.occupancy_threshold}
                  onChange={(e) => set("occupancy_threshold", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </label>
            )}
            <label className="text-sm">
              <span className="text-muted">Cooldown seconds</span>
              <input
                type="number"
                min={0}
                value={form.cooldown_seconds}
                onChange={(e) => set("cooldown_seconds", e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.action_dashboard}
                onChange={(e) => set("action_dashboard", e.target.checked)}
              />
              Dashboard alert
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.action_email}
                onChange={(e) => set("action_email", e.target.checked)}
              />
              Email
            </label>
            {form.action_email && (
              <input
                type="email"
                value={form.notify_email}
                onChange={(e) => set("notify_email", e.target.value)}
                placeholder="alerts@example.com"
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.action_alarm}
                onChange={(e) => set("action_alarm", e.target.checked)}
              />
              Sound the device alarm
            </label>
            {form.action_alarm && (
              <label className="flex items-center gap-2 text-sm text-muted">
                Auto-off after
                <input
                  type="number"
                  min={0}
                  value={form.alarm_duration_s}
                  onChange={(e) => set("alarm_duration_s", e.target.value)}
                  className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm"
                />
                seconds (0 = until turned off)
              </label>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Create rule
          </button>
        </form>
      )}
    </section>
  );
}
