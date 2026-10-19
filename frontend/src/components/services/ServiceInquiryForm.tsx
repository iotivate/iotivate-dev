"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
// Business WhatsApp (digits only, intl format). Env var overrides if set.
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "2349126497801";

const field =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-accent";
const lbl = "text-xs font-medium uppercase tracking-wide text-muted";

export default function ServiceInquiryForm({
  service,
  detailsLabel = "Tell us about your project",
  detailsPlaceholder,
}: {
  service: string;
  detailsLabel?: string;
  detailsPlaceholder?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [budget, setBudget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const waLink = WHATSAPP
    ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
        `Hi iotivate 👋 I'd like to talk about ${service}.`,
      )}`
    : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr(null);
    if (!name.trim() || !email.trim() || details.trim().length < 10) {
      setErr("Please add your name, email, and a few details about your project.");
      return;
    }
    setBusy(true);
    try {
      const message =
        `New ${service} inquiry\n` +
        `Phone: ${phone || "-"}\n` +
        `Budget: ${budget || "-"}\n` +
        `Deadline: ${deadline || "-"}\n\n` +
        `Project details:\n${details}`;
      const res = await fetch(`${API_URL}/api/contact/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(
          typeof b.detail === "string" ? b.detail : "Something went wrong — please try again.",
        );
      }
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold">Request received 🎉</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Thanks — we&apos;ve got your {service.toLowerCase()} details and we&apos;ll get back to you shortly with next steps and a quote.
        </p>
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <WhatsAppIcon /> Continue on WhatsApp
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <h3 className="text-xl font-semibold">Start your {service.toLowerCase()}</h3>
      <p className="mt-1 text-sm text-muted">
        Tell us what you need and we&apos;ll reply with a quote and timeline. No upfront payment — you only pay once we confirm.
      </p>

      {waLink && (
        <>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <WhatsAppIcon /> Chat with us on WhatsApp
          </a>
          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted">
            <span className="h-px flex-1 bg-border" /> or send the details <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={submit} className={waLink ? "space-y-4" : "mt-5 space-y-4"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className={lbl}>Full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${field}`} />
          </div>
          <div>
            <span className={lbl}>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`mt-1 ${field}`} />
          </div>
          <div>
            <span className={lbl}>Phone / WhatsApp</span>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={`mt-1 ${field}`} />
          </div>
          <div>
            <span className={lbl}>Deadline (optional)</span>
            <input value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="e.g. in 3 weeks" className={`mt-1 ${field}`} />
          </div>
        </div>
        <div>
          <span className={lbl}>Budget range (optional)</span>
          <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Helps us scope it right" className={`mt-1 ${field}`} />
        </div>
        <div>
          <span className={lbl}>{detailsLabel}</span>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={5}
            placeholder={detailsPlaceholder}
            className={`mt-1 ${field}`}
          />
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50 sm:w-auto"
        >
          {busy ? "Sending…" : "Request a quote"}
        </button>
      </form>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.148-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.693.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.485 3.488" />
    </svg>
  );
}
