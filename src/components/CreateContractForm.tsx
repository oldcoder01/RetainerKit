"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ClientOption = { id: string; name: string };
type ApiError = { error?: string };

function dollarsToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100);
}

export function CreateContractForm(props: { clients: ClientOption[] }) {
  const router = useRouter();
  const clients = props.clients;

  const [clientId, setClientId] = useState<string>(clients[0]?.id ?? "");
  const [title, setTitle] = useState<string>("");
  const [status, setStatus] = useState<"draft" | "active" | "paused" | "closed">("active");
  const [hourly, setHourly] = useState<string>("");
  const [retainer, setRetainer] = useState<string>("");
  const [currency, setCurrency] = useState<string>("USD");

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const hasClients = useMemo<boolean>(() => clients.length > 0, [clients]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!hasClients) {
      setError("Create a client first.");
      return;
    }

    const t = title.trim();
    if (t.length < 1 || t.length > 160) {
      setError("Title must be 1–160 characters.");
      return;
    }

    const hourlyCents = dollarsToCents(hourly);
    if (Number.isNaN(hourlyCents)) {
      setError("Hourly rate must be a non-negative number.");
      return;
    }

    const retainerCents = dollarsToCents(retainer);
    if (Number.isNaN(retainerCents)) {
      setError("Monthly retainer must be a non-negative number.");
      return;
    }

    const cur = currency.trim().toUpperCase();
    if (cur.length !== 3) {
      setError("Currency must be a 3-letter code (e.g., USD).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId,
          title: t,
          status,
          hourlyRateCents: hourlyCents,
          monthlyRetainerCents: retainerCents,
          currency: cur,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null;
        setError(data?.error ?? "Failed to create contract.");
        return;
      }

      setTitle("");
      setHourly("");
      setRetainer("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="font-semibold">Create contract</h2>

      {!hasClients ? (
        <div className="alert alert-warning">You need at least one client before creating contracts.</div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="form-control w-full">
          <div className="label"><span className="label-text">Client</span></div>
          <select
            className="select select-bordered w-full"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={!hasClients}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="form-control w-full">
          <div className="label"><span className="label-text">Status</span></div>
          <select
            className="select select-bordered w-full"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="closed">closed</option>
          </select>
        </label>

        <label className="form-control w-full md:col-span-2">
          <div className="label"><span className="label-text">Title</span></div>
          <input
            className="input input-bordered w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Backend Retainer"
            disabled={!hasClients}
          />
        </label>

        <label className="form-control w-full">
          <div className="label"><span className="label-text">Hourly rate (USD)</span></div>
          <input
            className="input input-bordered w-full"
            value={hourly}
            onChange={(e) => setHourly(e.target.value)}
            placeholder="e.g. 75"
            inputMode="decimal"
            disabled={!hasClients}
          />
        </label>

        <label className="form-control w-full">
          <div className="label"><span className="label-text">Monthly retainer (USD)</span></div>
          <input
            className="input input-bordered w-full"
            value={retainer}
            onChange={(e) => setRetainer(e.target.value)}
            placeholder="e.g. 2500"
            inputMode="decimal"
            disabled={!hasClients}
          />
        </label>

        <label className="form-control w-full md:col-span-2">
          <div className="label"><span className="label-text">Currency</span></div>
          <input
            className="input input-bordered w-full"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            placeholder="USD"
            disabled={!hasClients}
          />
        </label>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <button className="btn btn-primary" disabled={loading || !hasClients}>
        {loading ? "Creating..." : "Create"}
      </button>
    </form>
  );
}
