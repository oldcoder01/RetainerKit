"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type ContractRateOption = {
  id: string;
  label: string;
  hourlyRateCents: number | null;
  currency: string;
};

type Preview = {
  contractId: string;
  periodStart: string;
  periodEnd: string;
  totalMinutes: number;
  hourlyRateCents: number;
  amountCents: number;
  currency: string;
};

type ApiResponse = {
  preview?: Preview;
  breakdown?: Preview;
  error?: string;
};

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function centsToDollars(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const v = Math.abs(cents);
  const whole = Math.floor(v / 100);
  const frac = String(v % 100).padStart(2, "0");
  return `${sign}${whole}.${frac}`;
}

function hoursFromMinutes(totalMinutes: number): string {
  const hours = totalMinutes / 60;
  return hours.toFixed(2);
}

export function GenerateInvoiceFromLogsForm(props: { contracts: ContractRateOption[] }) {
  const router = useRouter();
  const contracts = props.contracts;

  const hasContracts = useMemo<boolean>(() => contracts.length > 0, [contracts]);
  const [contractId, setContractId] = useState<string>(contracts[0]?.id ?? "");
  const [periodStart, setPeriodStart] = useState<string>(todayIsoDate());
  const [periodEnd, setPeriodEnd] = useState<string>(todayIsoDate());

  const [rateOverride, setRateOverride] = useState<string>("");
  const [currencyOverride, setCurrencyOverride] = useState<string>("");

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const selectedContract = useMemo<ContractRateOption | null>(() => {
    const found = contracts.find((c) => c.id === contractId);
    return found ?? null;
  }, [contracts, contractId]);

  function getEffectiveCurrency(): string {
    const raw = (currencyOverride || selectedContract?.currency || "USD").trim().toUpperCase();
    return raw;
  }

  function parseRateOverrideCents(): number | null {
    const trimmed = rateOverride.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) return NaN;
    return Math.round(n * 100);
  }

  async function call(previewOnly: boolean) {
    setError("");
    setPreview(null);

    if (!hasContracts) {
      setError("Create a contract first.");
      return;
    }

    if (periodStart > periodEnd) {
      setError("Period start must be <= period end.");
      return;
    }

    const cur = getEffectiveCurrency();
    if (cur.length !== 3) {
      setError("Currency must be a 3-letter code (e.g., USD).");
      return;
    }

    const overrideCents = parseRateOverrideCents();
    if (overrideCents !== null) {
      if (!Number.isInteger(overrideCents) || overrideCents <= 0) {
        setError("Hourly rate override must be a positive number.");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/invoices/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractId,
          periodStart,
          periodEnd,
          hourlyRateCents: overrideCents === null ? undefined : overrideCents,
          currency: currencyOverride.trim() ? cur : undefined,
          preview: previewOnly,
        }),
      });

      const data = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!res.ok) {
        setError(data?.error ?? "Request failed.");
        return;
      }

      const nextPreview = (data?.preview ?? data?.breakdown) ?? null;
      setPreview(nextPreview);

      if (!previewOnly) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Generate from work logs</h2>
        <div className="text-xs text-base-content/60">Creates a draft invoice.</div>
      </div>

      {!hasContracts ? (
        <div className="alert alert-warning">You need at least one contract before generating invoices.</div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="form-control w-full md:col-span-2">
          <div className="label"><span className="label-text">Contract</span></div>
          <select
            className="select select-bordered w-full"
            value={contractId}
            onChange={(e) => {
              setContractId(e.target.value);
              setPreview(null);
              setError("");
            }}
            disabled={!hasContracts}
          >
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <div className="label">
            <span className="label-text-alt text-base-content/60">
              Contract rate: {selectedContract?.hourlyRateCents ? `$${centsToDollars(selectedContract.hourlyRateCents)}/hr` : "(none set)"}
            </span>
          </div>
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
          <div className="label"><span className="label-text">Hourly rate override (optional)</span></div>
          <input
            className="input input-bordered w-full"
            value={rateOverride}
            onChange={(e) => setRateOverride(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 75"
            disabled={!hasContracts}
          />
          <div className="label">
            <span className="label-text-alt text-base-content/60">Leave blank to use contract.hourly_rate_cents</span>
          </div>
        </label>

        <label className="form-control w-full">
          <div className="label"><span className="label-text">Currency override (optional)</span></div>
          <input
            className="input input-bordered w-full"
            value={currencyOverride}
            onChange={(e) => setCurrencyOverride(e.target.value)}
            placeholder={selectedContract?.currency ?? "USD"}
            disabled={!hasContracts}
          />
          <div className="label">
            <span className="label-text-alt text-base-content/60">Leave blank to use contract.currency</span>
          </div>
        </label>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="flex flex-wrap gap-2">
        <button
          className="btn btn-outline"
          disabled={loading || !hasContracts}
          onClick={() => void call(true)}
          type="button"
        >
          {loading ? "Working..." : "Preview"}
        </button>
        <button
          className="btn btn-primary"
          disabled={loading || !hasContracts}
          onClick={() => void call(false)}
          type="button"
        >
          {loading ? "Generating..." : "Generate invoice"}
        </button>
      </div>

      {preview ? (
        <div className="rounded-box border border-base-300 p-4 space-y-2">
          <div className="text-sm font-semibold">Preview</div>
          <div className="text-sm text-base-content/70">
            Range: <span className="font-medium">{preview.periodStart}</span> → <span className="font-medium">{preview.periodEnd}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="stat bg-base-100 border border-base-200 rounded-box">
              <div className="stat-title">Total minutes</div>
              <div className="stat-value text-2xl">{preview.totalMinutes}</div>
              <div className="stat-desc">Hours: {hoursFromMinutes(preview.totalMinutes)}</div>
            </div>
            <div className="stat bg-base-100 border border-base-200 rounded-box">
              <div className="stat-title">Rate</div>
              <div className="stat-value text-2xl">${centsToDollars(preview.hourlyRateCents)}/hr</div>
              <div className="stat-desc">Currency: {preview.currency}</div>
            </div>
            <div className="stat bg-base-100 border border-base-200 rounded-box">
              <div className="stat-title">Amount</div>
              <div className="stat-value text-2xl">${centsToDollars(preview.amountCents)}</div>
              <div className="stat-desc">Rounded to cents</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
