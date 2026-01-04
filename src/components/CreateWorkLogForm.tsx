"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type ContractOption = { id: string; label: string };

type ApiError = { error?: string };

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CreateWorkLogForm(props: { contracts: ContractOption[] }) {
  const router = useRouter();
  const contracts = props.contracts;

  const [contractId, setContractId] = useState<string>(contracts[0]?.id ?? "");
  const [workDate, setWorkDate] = useState<string>(todayIsoDate());
  const [minutes, setMinutes] = useState<string>("60");
  const [description, setDescription] = useState<string>("");

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

    const mins = Number(minutes.trim());
    if (!Number.isInteger(mins) || mins < 1 || mins > 1440) {
      setError("Minutes must be an integer from 1 to 1440.");
      return;
    }

    const desc = description.trim();
    if (desc.length < 1 || desc.length > 4000) {
      setError("Description must be 1–4000 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/work-logs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractId,
          workDate,
          minutes: mins,
          description: desc,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null;
        setError(data?.error ?? "Failed to create work log.");
        return;
      }

      setDescription("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="font-semibold">Log work</h2>

      {!hasContracts ? (
        <div className="alert alert-warning">You need at least one contract before logging work.</div>
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
          <div className="label"><span className="label-text">Date</span></div>
          <input
            type="date"
            className="input input-bordered w-full"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            disabled={!hasContracts}
          />
        </label>

        <label className="form-control w-full">
          <div className="label"><span className="label-text">Minutes</span></div>
          <input
            className="input input-bordered w-full"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            inputMode="numeric"
            disabled={!hasContracts}
          />
        </label>

        <label className="form-control w-full md:col-span-2">
          <div className="label"><span className="label-text">Description</span></div>
          <textarea
            className="textarea textarea-bordered w-full"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What did you do?"
            disabled={!hasContracts}
          />
        </label>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <button className="btn btn-primary" disabled={loading || !hasContracts}>
        {loading ? "Saving..." : "Save log"}
      </button>
    </form>
  );
}
