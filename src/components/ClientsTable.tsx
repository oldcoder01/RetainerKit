"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type ClientListItem = {
  id: string;
  name: string;
  createdAt: string;
};

type ApiError = { error?: string };

export function ClientsTable(props: { clients: ClientListItem[] }) {
  const router = useRouter();
  const clients = props.clients;

  const renameDialogRef = useRef<HTMLDialogElement | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement | null>(null);

  const [selectedId, setSelectedId] = useState<string>("");
  const [draftName, setDraftName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const selectedClient = useMemo<ClientListItem | null>(() => {
    if (!selectedId) return null;
    const found = clients.find((c) => c.id === selectedId);
    return found ?? null;
  }, [clients, selectedId]);

  function openRename(c: ClientListItem) {
    setError("");
    setSelectedId(c.id);
    setDraftName(c.name);
    renameDialogRef.current?.showModal();
  }

  function openDelete(c: ClientListItem) {
    setError("");
    setSelectedId(c.id);
    setDraftName(c.name);
    deleteDialogRef.current?.showModal();
  }

  async function submitRename() {
    setError("");
    const nextName = draftName.trim();
    if (nextName.length < 1 || nextName.length > 120) {
      setError("Client name must be 1–120 characters.");
      return;
    }

    if (!selectedId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${selectedId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null;
        setError(data?.error ?? "Failed to rename client.");
        return;
      }

      renameDialogRef.current?.close();
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
      const res = await fetch(`/api/clients/${selectedId}`, { method: "DELETE" });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null;
        setError(data?.error ?? "Failed to delete client.");
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
              <th>Name</th>
              <th>Created</th>
              <th className="w-0"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td className="text-sm text-base-content/70">{new Date(c.createdAt).toLocaleString()}</td>
                <td className="text-right whitespace-nowrap">
                  <Link href={`/portal/clients/${c.id}`} className="btn btn-ghost btn-sm">
                    Members
                  </Link>
                  <button className="btn btn-ghost btn-sm" onClick={() => openRename(c)}>
                    Rename
                  </button>
                  <button className="btn btn-ghost btn-sm text-error" onClick={() => openDelete(c)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dialog ref={renameDialogRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">Rename client</h3>

          <div className="mt-4 space-y-3">
            <label className="form-control w-full">
              <div className="label">
                <span className="label-text">Client name</span>
              </div>
              <input
                className="input input-bordered w-full"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
              />
            </label>

            {error ? <div className="alert alert-error">{error}</div> : null}
          </div>

          <div className="modal-action">
            <button className="btn" disabled={loading} onClick={() => renameDialogRef.current?.close()}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={loading} onClick={submitRename}>
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
          <h3 className="font-bold text-lg">Delete client</h3>
          <p className="text-sm text-base-content/70">
            This permanently deletes <span className="font-semibold">{selectedClient?.name ?? ""}</span>.
          </p>

          {error ? <div className="alert alert-error mt-4">{error}</div> : null}

          <div className="modal-action">
            <button className="btn" disabled={loading} onClick={() => deleteDialogRef.current?.close()}>
              Cancel
            </button>
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
