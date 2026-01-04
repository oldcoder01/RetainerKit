import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { getActiveWorkspaceForUser } from "@/lib/workspace";
import { ClientsTable, type ClientListItem } from "@/components/ClientsTable";
import { CreateClientForm } from "@/components/CreateClientForm";

type ClientRow = {
  id: string;
  name: string;
  created_at: unknown;
};

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) return new Date(0).toISOString();
  return dt.toISOString();
}

export default async function ClientsPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) return null;

  const ws = await getActiveWorkspaceForUser(userId);

  const pool = getPool();
  const res = await pool.query<ClientRow>(
    `SELECT id, name, created_at
     FROM clients
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [ws.id]
  );

  const clients: ClientListItem[] = res.rows.map((c) => {
    return { id: c.id, name: c.name, createdAt: toIsoString(c.created_at) };
  });

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow">
        <div className="card-body space-y-2">
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-base-content/70">
            Workspace: <span className="font-medium">{ws.name}</span>
          </p>
        </div>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <CreateClientForm />
        </div>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="font-semibold">Your clients</h2>
          {clients.length === 0 ? (
            <p className="text-sm text-base-content/70">No clients yet.</p>
          ) : (
            <ClientsTable clients={clients} />
          )}
        </div>
      </div>
    </div>
  );
}
