"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ClientRole = "client_admin" | "client_user";

export type ClientMemberRow = {
  user_id: string;
  email: string;
  name: string | null;
  client_role: ClientRole;
  created_at: string | Date;
};

type Props = {
  clientId: string;
  initialMembers: ClientMemberRow[];
};

function toIsoDate(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toISOString();
}

export function ClientMembersManager({ clientId, initialMembers }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [role, setRole] = useState<ClientRole>("client_user");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const members = useMemo(() => {
    return [...initialMembers].sort((a, b) => {
      const ad = new Date(toIsoDate(a.created_at)).getTime();
      const bd = new Date(toIsoDate(b.created_at)).getTime();
      return bd - ad;
    });
  }, [initialMembers]);

  async function addMember() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/client-members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, email, clientRole: role }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to add member");
        return;
      }

      setEmail("");
      router.refresh();
    } catch {
      setError("Failed to add member");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/client-members", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, userId }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to remove member");
        return;
      }

      router.refresh();
    } catch {
      setError("Failed to remove member");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body space-y-4">
        <h2 className="text-lg font-semibold">Client members</h2>

        {error ? <div className="alert alert-error">{error}</div> : null}

        <div className="grid gap-2 md:grid-cols-[1fr_160px_120px]">
          <input
            className="input input-bordered"
            placeholder="client@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <select
            className="select select-bordered"
            value={role}
            onChange={(e) => setRole(e.target.value as ClientRole)}
            disabled={busy}
          >
            <option value="client_user">client_user</option>
            <option value="client_admin">client_admin</option>
          </select>
          <button
            className="btn btn-primary"
            onClick={() => void addMember()}
            disabled={busy || email.trim().length < 3}
          >
            Add
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-sm text-base-content/70">
                    No client members yet.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.user_id}>
                    <td className="font-mono text-sm">{m.email}</td>
                    <td>{m.name ?? ""}</td>
                    <td>
                      <span className="badge badge-neutral">{m.client_role}</span>
                    </td>
                    <td className="font-mono text-xs">{toIsoDate(m.created_at).slice(0, 10)}</td>
                    <td className="text-right">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => void removeMember(m.user_id)}
                        disabled={busy}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-base-content/60">
          Note: this expects the client user to already exist. If the email isn't found, have them register first.
        </div>
      </div>
    </div>
  );
}
