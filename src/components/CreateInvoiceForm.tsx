"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type ContractOption = { id: string; label: string };

type ApiError = { error?: string };
type InvoiceStatus = "draft" | "sent" | "paid" | "void";

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dollarsToCents(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return NaN;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100);
}

export function CreateInvoiceForm(props: { contracts: ContractOption[] }) {
  const router = useRouter();
  const contracts = props.contracts;

  const [contractId, setContractId] = useState<string>(contracts[0]?.id ?? "");
  const [periodStart, setPeriodStart] = useState<string>(todayIsoDate());
  const [periodEnd, setPeriodEnd] = useState<string>(todayIsoDate());
  const [amount, setAmount] = useState<string>("0");
  const [currency, setCurrency] = useState<string>("USD");
  const [status, setStatus] = useState<InvoiceStatus>("draft");

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const hasContracts = useMemo<boolean>(() => contracts.length > 0, [contracts]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!hasContracts) {
      setError("Create a contract first.");
      return;
    }

    if (periodStart > periodEnd) {
      setError("Period start must be <= period end.");
      return;
    }

    const amountCents = dollarsToCents(amount);
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      setError("Amount must be a non-negative number.");
      return;
    }

    const cur = currency.trim().toUpperCase();
    if (cur.length !== 3) {
      setError("Currency must be a 3-letter code (e.g., USD).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractId,
          periodStart,
          periodEnd,
          amountCents,
          currency: cur,
          status,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null;
        setError(data?.error ?? "Failed to create invoice.");
        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="font-semibold">Create invoice</h2>

      {!hasContracts ? (
        <div className="alert alert-warning">You need at least one contract before creating invoices.</div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="form-control w-full md:col-span-2">
          <div className="label"><span className="label-text">Contract</span></div>
          <select
            className="select select-bordered w-full"
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            disabled={!hasContracts}
          >
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>

        <label className="form-control w-full">
          <div className="label"><span className="label-text">Period start</span></div>
          <input
            type="date"
            className="input input-bordered w-full"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            disabled={!hasContracts}
          />
        </label>

        <label className="form-control w-full">
          <div className="label"><span className="label-text">Period end</span></div>
          <input
            type="date"
            className="input input-bordered w-full"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            disabled={!hasContracts}
          />
        </label>

        <label className="form-control w-full">
          <div className="label"><span className="label-text">Amount</span></div>
          <input
            className="input input-bordered w-full"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 2500"
            disabled={!hasContracts}
          />
        </label>

        <label className="form-control w-full">
          <div className="label"><span className="label-text">Status</span></div>
          <select
            className="select select-bordered w-full"
            value={status}
            onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
            disabled={!hasContracts}
          >
            <option value="draft">draft</option>
            <option value="sent">sent</option>
            <option value="paid">paid</option>
            <option value="void">void</option>
          </select>
        </label>

        <label className="form-control w-full md:col-span-2">
          <div className="label"><span className="label-text">Currency</span></div>
          <input
            className="input input-bordered w-full"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            placeholder="USD"
            disabled={!hasContracts}
          />
        </label>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <button className="btn btn-primary" disabled={loading || !hasContracts}>
        {loading ? "Creating..." : "Create"}
      </button>
    </form>
  );
}
