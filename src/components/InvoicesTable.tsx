"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type ContractOption = { id: string; label: string };
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export type InvoiceListItem = {
  id: string;
  contractId: string;
  contractLabel: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  amountCents: number;
  currency: string;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
};

type ApiError = { error?: string };

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function dollarsToCents(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return NaN;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100);
}

export function InvoicesTable(props: { invoices: InvoiceListItem[]; contracts: ContractOption[] }) {
  const router = useRouter();
  const invoices = props.invoices;
  const contracts = props.contracts;

  const editDialogRef = useRef<HTMLDialogElement | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement | null>(null);

  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const selected = useMemo<InvoiceListItem | null>(() => {
    if (!selectedId) return null;
    return invoices.find((i) => i.id === selectedId) ?? null;
  }, [invoices, selectedId]);

  const [draftContractId, setDraftContractId] = useState<string>("");
  const [draftPeriodStart, setDraftPeriodStart] = useState<string>("");
  const [draftPeriodEnd, setDraftPeriodEnd] = useState<string>("");
  const [draftAmount, setDraftAmount] = useState<string>("0.00");
  const [draftCurrency, setDraftCurrency] = useState<string>("USD");
  const [draftStatus, setDraftStatus] = useState<InvoiceStatus>("draft");

  function openEdit(i: InvoiceListItem) {
    setError("");
    setSelectedId(i.id);
    setDraftContractId(i.contractId);
    setDraftPeriodStart(i.periodStart);
    setDraftPeriodEnd(i.periodEnd);
    setDraftAmount(centsToDollars(i.amountCents));
    setDraftCurrency(i.currency);
    setDraftStatus(i.status);
    editDialogRef.current?.showModal();
  }

  function openDelete(i: InvoiceListItem) {
    setError("");
    setSelectedId(i.id);
    deleteDialogRef.current?.showModal();
  }

  async function submitEdit() {
    setError("");
    if (!selectedId) return;

    if (draftPeriodStart > draftPeriodEnd) {
      setError("Period start must be <= period end.");
      return;
    }

    const amountCents = dollarsToCents(draftAmount);
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      setError("Amount must be a non-negative number.");
      return;
    }

    const currency = draftCurrency.trim().toUpperCase();
    if (currency.length !== 3) {
      setError("Currency must be a 3-letter code (e.g., USD).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${selectedId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractId: draftContractId,
          periodStart: draftPeriodStart,
          periodEnd: draftPeriodEnd,
          amountCents,
          currency,
          status: draftStatus,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null;
        setError(data?.error ?? "Failed to update invoice.");
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
      const res = await fetch(`/api/invoices/${selectedId}`, { method: "DELETE" });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null;
        setError(data?.error ?? "Failed to delete invoice.");
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
              <th>Period</th>
              <th>Contract</th>
              <th>Status</th>
              <th className="text-right">Amount</th>
              <th className="w-0"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id}>
                <td className="whitespace-nowrap">{i.periodStart} → {i.periodEnd}</td>
                <td className="whitespace-nowrap">{i.contractLabel}</td>
                <td><span className="badge">{i.status}</span></td>
                <td className="text-right whitespace-nowrap">
                  {i.currency} {centsToDollars(i.amountCents)}
                </td>
                <td className="text-right whitespace-nowrap">
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(i)}>Edit</button>
                  <button className="btn btn-ghost btn-sm text-error" onClick={() => openDelete(i)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dialog ref={editDialogRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">Edit invoice</h3>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="form-control w-full md:col-span-2">
              <div className="label"><span className="label-text">Contract</span></div>
              <select
                className="select select-bordered w-full"
                value={draftContractId}
                onChange={(e) => setDraftContractId(e.target.value)}
              >
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>

            <label className="form-control w-full">
              <div className="label"><span className="label-text">Period start</span></div>
              <input type="date" className="input input-bordered w-full" value={draftPeriodStart} onChange={(e) => setDraftPeriodStart(e.target.value)} />
            </label>

            <label className="form-control w-full">
              <div className="label"><span className="label-text">Period end</span></div>
              <input type="date" className="input input-bordered w-full" value={draftPeriodEnd} onChange={(e) => setDraftPeriodEnd(e.target.value)} />
            </label>

            <label className="form-control w-full">
              <div className="label"><span className="label-text">Amount</span></div>
              <input className="input input-bordered w-full" value={draftAmount} onChange={(e) => setDraftAmount(e.target.value)} inputMode="decimal" />
            </label>

            <label className="form-control w-full">
              <div className="label"><span className="label-text">Status</span></div>
              <select className="select select-bordered w-full" value={draftStatus} onChange={(e) => setDraftStatus(e.target.value as InvoiceStatus)}>
                <option value="draft">draft</option>
                <option value="sent">sent</option>
                <option value="paid">paid</option>
                <option value="void">void</option>
              </select>
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
          <h3 className="font-bold text-lg">Delete invoice</h3>
          <p className="text-sm text-base-content/70">
            Delete invoice for <span className="font-semibold">{selected?.contractLabel ?? ""}</span>?
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
