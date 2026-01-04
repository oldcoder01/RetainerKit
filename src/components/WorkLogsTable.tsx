"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type ContractOption = { id: string; label: string };

export type WorkLogListItem = {
  id: string;
  contractId: string;
  contractLabel: string;
  workDate: string; // YYYY-MM-DD
  minutes: number;
  description: string;
  createdAt: string;
  updatedAt: string;
};

type ApiError = { error?: string };

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function WorkLogsTable(props: { workLogs: WorkLogListItem[]; contracts: ContractOption[] }) {
  const router = useRouter();
  const workLogs = props.workLogs;
  const contracts = props.contracts;

  const editDialogRef = useRef<HTMLDialogElement | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement | null>(null);

  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const selected = useMemo<WorkLogListItem | null>(() => {
    if (!selectedId) return null;
    return workLogs.find((w) => w.id === selectedId) ?? null;
  }, [workLogs, selectedId]);

  const [draftContractId, setDraftContractId] = useState<string>("");
  const [draftWorkDate, setDraftWorkDate] = useState<string>("");
  const [draftMinutes, setDraftMinutes] = useState<string>("60");
  const [draftDescription, setDraftDescription] = useState<string>("");

  function openEdit(w: WorkLogListItem) {
    setError("");
    setSelectedId(w.id);
    setDraftContractId(w.contractId);
    setDraftWorkDate(w.workDate);
    setDraftMinutes(String(w.minutes));
    setDraftDescription(w.description);
    editDialogRef.current?.showModal();
  }

  function openDelete(w: WorkLogListItem) {
    setError("");
    setSelectedId(w.id);
    deleteDialogRef.current?.showModal();
  }

  async function submitEdit() {
    setError("");
    if (!selectedId) return;

    const mins = Number(draftMinutes.trim());
    if (!Number.isInteger(mins) || mins < 1 || mins > 1440) {
      setError("Minutes must be an integer from 1 to 1440.");
      return;
    }

    const desc = draftDescription.trim();
    if (desc.length < 1 || desc.length > 4000) {
      setError("Description must be 1–4000 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/work-logs/${selectedId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractId: draftContractId,
          workDate: draftWorkDate,
          minutes: mins,
          description: desc,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null;
        setError(data?.error ?? "Failed to update work log.");
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
      const res = await fetch(`/api/work-logs/${selectedId}`, { method: "DELETE" });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null;
        setError(data?.error ?? "Failed to delete work log.");
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
              <th>Date</th>
              <th>Contract</th>
              <th>Time</th>
              <th>Description</th>
              <th className="w-0"></th>
            </tr>
          </thead>
          <tbody>
            {workLogs.map((w) => (
              <tr key={w.id}>
                <td className="whitespace-nowrap">{w.workDate}</td>
                <td className="whitespace-nowrap">{w.contractLabel}</td>
                <td className="whitespace-nowrap">{formatMinutes(w.minutes)}</td>
                <td className="max-w-xl">
                  <div className="truncate">{w.description}</div>
                </td>
                <td className="text-right whitespace-nowrap">
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(w)}>Edit</button>
                  <button className="btn btn-ghost btn-sm text-error" onClick={() => openDelete(w)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dialog ref={editDialogRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">Edit work log</h3>

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
              <div className="label"><span className="label-text">Date</span></div>
              <input
                type="date"
                className="input input-bordered w-full"
                value={draftWorkDate}
                onChange={(e) => setDraftWorkDate(e.target.value)}
              />
            </label>

            <label className="form-control w-full">
              <div className="label"><span className="label-text">Minutes</span></div>
              <input
                className="input input-bordered w-full"
                value={draftMinutes}
                onChange={(e) => setDraftMinutes(e.target.value)}
                inputMode="numeric"
              />
            </label>

            <label className="form-control w-full md:col-span-2">
              <div className="label"><span className="label-text">Description</span></div>
              <textarea
                className="textarea textarea-bordered w-full"
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
              />
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
          <h3 className="font-bold text-lg">Delete work log</h3>
          <p className="text-sm text-base-content/70">
            Delete this log ({selected ? `${selected.workDate} • ${formatMinutes(selected.minutes)}` : ""})?
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
