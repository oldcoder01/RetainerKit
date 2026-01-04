"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ApiError = { error?: string };

export function CreateClientForm() {
  const router = useRouter();
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const nextName = name.trim();
    if (nextName.length < 1 || nextName.length > 120) {
      setError("Client name must be 1–120 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null;
        setError(data?.error ?? "Failed to create client.");
        return;
      }

      setName("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="font-semibold">Create client</h2>

      <label className="form-control w-full">
        <div className="label">
          <span className="label-text">Client name</span>
        </div>
        <input
          className="input input-bordered w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Co."
        />
      </label>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <button className="btn btn-primary" disabled={loading}>
        {loading ? "Creating..." : "Create"}
      </button>
    </form>
  );
}
