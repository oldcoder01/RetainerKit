"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type ClientOption = { id: string; name: string };

export type ContractListItem = {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  status: "draft" | "active" | "paused" | "closed";
  hourlyRateCents: number | null;
  monthlyRetainerCents: number | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

type ApiError = { error?: string };

function centsToDollars(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toFixed(2);
}

function dollarsToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100);
}

export function ContractsTable(props: { contracts: ContractListItem[]; clients: ClientOption[] }) {
  const router = useRouter();
  const contracts = props.contracts;
  const clients = props.clients;

  const editDialogRef = useRef<HTMLDialogElement | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement | null>(null);

  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const selected = useMemo<ContractListItem | null>(() => {
    if (!selectedId) return null;
    return contracts.find((c) => c.id === selectedId) ?? null;
  }, [contracts, selectedId]);

  const [draftTitle, setDraftTitle] = useState<string>("");
  const [draftStatus, setDraftStatus] = useState<ContractListItem["status"]>("active");
  const [draftClientId, setDraftClientId] = useState<string>("");
  const [draftHourly, setDraftHourly] = useState<string>("");
  const [draftRetainer, setDraftRetainer] = useState<string>("");
  const [draftCurrency, setDraftCurrency] = useState<string>("USD");

  function openEdit(c: ContractListItem) {
    setError("");
    setSelectedId(c.id);
    setDraftTitle(c.title);
    setDraftStatus(c.status);
    setDraftClientId(c.clientId);
    setDraftHourly(centsToDollars(c.hourlyRateCents));
    setDraftRetainer(centsToDollars(c.monthlyRetainerCents));
    setDraftCurrency(c.currency);
    editDialogRef.current?.showModal();
  }

  function openDelete(c: ContractListItem) {
    setError("");
    setSelectedId(c.id);
    deleteDialogRef.current?.showModal();
  }

  async function submitEdit() {
    setError("");
    if (!selectedId) return;

    const title = draftTitle.trim();
    if (title.length < 1 || title.length > 160) {
      setError("Title must be 1–160 characters.");
      return;
    }

    const hourlyCents = dollarsToCents(draftHourly);
    if (Number.isNaN(hourlyCents)) {
      setError("Hourly rate must be a non-negative number.");
      return;
    }

    const retainerCents = dollarsToCents(draftRetainer);
    if (Number.isNaN(retainerCents)) {
      setError("Monthly retainer must be a non-negative number.");
      return;
    }

    const currency = draftCurrency.trim().toUpperCase();
    if (currency.length !== 3) {
      setError("Currency must be a 3-letter code (e.g., USD).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/contracts/${selectedId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          status: draftStatus,
          clientId: draftClientId,
          hourlyRateCents: hourlyCents,
          monthlyRetainerCents: retainerCents,
          currency,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null;
        setError(data?.error ?? "Failed to update contract.");
        return;
      }

      editDialogRef.current?.close();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function submitDelete() {
    setError("");
    if (!selectedId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/contracts/${selectedId}`, { method: "DELETE" });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null;
        setError(data?.error ?? "Failed to delete contract.");
        return;
      }

      deleteDialogRef.current?.close();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Client</th>
              <th>Status</th>
              <th>Rates</th>
              <th className="w-0"></th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.title}</td>
                <td>{c.clientName}</td>
                <td>
                  <span className="badge">{c.status}</span>
                </td>
                <td className="text-sm text-base-content/80">
                  {c.hourlyRateCents !== null ? `${c.currency} ${(c.hourlyRateCents / 100).toFixed(2)}/hr` : "—"}
                  {" · "}
                  {c.monthlyRetainerCents !== null ? `${c.currency} ${(c.monthlyRetainerCents / 100).toFixed(2)}/mo` : "—"}
                </td>
                <td className="text-right whitespace-nowrap">
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>Edit</button>
                  <button className="btn btn-ghost btn-sm text-error" onClick={() => openDelete(c)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dialog ref={editDialogRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">Edit contract</h3>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="form-control w-full md:col-span-2">
              <div className="label"><span className="label-text">Title</span></div>
              <input className="input input-bordered w-full" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
            </label>

            <label className="form-control w-full">
              <div className="label"><span className="label-text">Client</span></div>
              <select className="select select-bordered w-full" value={draftClientId} onChange={(e) => setDraftClientId(e.target.value)}>
                {clients.map((cl) => (
                  <option key={cl.id} value={cl.id}>{cl.name}</option>
                ))}
              </select>
            </label>

            <label className="form-control w-full">
              <div className="label"><span className="label-text">Status</span></div>
              <select
                className="select select-bordered w-full"
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value as ContractListItem["status"])}
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="closed">closed</option>
              </select>
            </label>

            <label className="form-control w-full">
              <div className="label"><span className="label-text">Hourly rate</span></div>
              <input className="input input-bordered w-full" value={draftHourly} onChange={(e) => setDraftHourly(e.target.value)} inputMode="decimal" />
            </label>

            <label className="form-control w-full">
              <div className="label"><span className="label-text">Monthly retainer</span></div>
              <input className="input input-bordered w-full" value={draftRetainer} onChange={(e) => setDraftRetainer(e.target.value)} inputMode="decimal" />
            </label>

            <label className="form-control w-full md:col-span-2">
              <div className="label"><span className="label-text">Currency</span></div>
              <input className="input input-bordered w-full" value={draftCurrency} onChange={(e) => setDraftCurrency(e.target.value)} />
            </label>
          </div>

          {error ? <div className="alert alert-error mt-4">{error}</div> : null}

          <div className="modal-action">
            <button className="btn" disabled={loading} onClick={() => editDialogRef.current?.close()}>Cancel</button>
            <button className="btn btn-primary" disabled={loading} onClick={submitEdit}>
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <form method="dialog" className="modal-backdrop">
          <button aria-label="Close">Close</button>
        </form>
      </dialog>

      <dialog ref={deleteDialogRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">Delete contract</h3>
          <p className="text-sm text-base-content/70">
            This permanently deletes <span className="font-semibold">{selected?.title ?? ""}</span>.
          </p>

          {error ? <div className="alert alert-error mt-4">{error}</div> : null}

          <div className="modal-action">
            <button className="btn" disabled={loading} onClick={() => deleteDialogRef.current?.close()}>Cancel</button>
            <button className="btn btn-error" disabled={loading} onClick={submitDelete}>
              {loading ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>

        <form method="dialog" className="modal-backdrop">
          <button aria-label="Close">Close</button>
        </form>
      </dialog>
    </>
  );
}
