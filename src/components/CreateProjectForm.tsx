"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateProjectForm() {
  const router = useRouter();
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Project name is required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Failed to create project.");
        return;
      }

      setName("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="form-control w-full">
        <div className="label">
          <span className="label-text">New project name</span>
        </div>
        <input
          className="input input-bordered w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. January Retainer"
        />
      </label>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create project"}
      </button>
    </form>
  );
}
