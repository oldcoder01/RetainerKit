"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectListItem = {
  id: string;
  name: string;
  createdAt: string;
};

type ApiError = {
  error?: string;
};

export function ProjectsTable(props: { projects: ProjectListItem[] }) {
  const router = useRouter();
  const projects = props.projects;

  const renameDialogRef = useRef<HTMLDialogElement | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement | null>(null);

  const [selectedId, setSelectedId] = useState<string>("");
  const [draftName, setDraftName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const selectedProject = useMemo<ProjectListItem | null>(() => {
    if (!selectedId) return null;
    const found = projects.find((p) => p.id === selectedId);
    return found ?? null;
  }, [projects, selectedId]);

  function openRename(p: ProjectListItem) {
    setError("");
    setSelectedId(p.id);
    setDraftName(p.name);
    renameDialogRef.current?.showModal();
  }

  function openDelete(p: ProjectListItem) {
    setError("");
    setSelectedId(p.id);
    setDraftName(p.name);
    deleteDialogRef.current?.showModal();
  }

  async function submitRename() {
    setError("");
    const nextName = draftName.trim();
    if (nextName.length < 1 || nextName.length > 120) {
      setError("Project name must be 1–120 characters.");
      return;
    }

    if (!selectedId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${selectedId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null;
        setError(data?.error ?? "Failed to rename project.");
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
      const res = await fetch(`/api/projects/${selectedId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null;
        setError(data?.error ?? "Failed to delete project.");
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
            {projects.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.name}</td>
                <td className="text-sm text-base-content/70">{new Date(p.createdAt).toLocaleString()}</td>
                <td className="text-right whitespace-nowrap">
                  <button className="btn btn-ghost btn-sm" onClick={() => openRename(p)}>
                    Rename
                  </button>
                  <button className="btn btn-ghost btn-sm text-error" onClick={() => openDelete(p)}>
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
          <h3 className="font-bold text-lg">Rename project</h3>
          <p className="text-sm text-base-content/70">Update the display name for this project.</p>

          <div className="mt-4 space-y-3">
            <label className="form-control w-full">
              <div className="label">
                <span className="label-text">Project name</span>
              </div>
              <input
                className="input input-bordered w-full"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="e.g. January Retainer"
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
          <h3 className="font-bold text-lg">Delete project</h3>
          <p className="text-sm text-base-content/70">
            This permanently deletes <span className="font-semibold">{selectedProject?.name ?? ""}</span>.
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
