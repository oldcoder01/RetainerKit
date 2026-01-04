import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { getActiveWorkspaceForUser } from "@/lib/workspace";
import { CreateContractForm } from "@/components/CreateContractForm";
import { ContractsTable, type ContractListItem, type ClientOption } from "@/components/ContractsTable";

type ClientRow = { id: string; name: string };
type ContractRow = {
  id: string;
  client_id: string;
  title: string;
  status: string;
  hourly_rate_cents: number | null;
  monthly_retainer_cents: number | null;
  currency: string;
  created_at: unknown;
  updated_at: unknown;
  client_name: string;
};

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) return new Date(0).toISOString();
  return dt.toISOString();
}

export default async function ContractsPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  const ws = await getActiveWorkspaceForUser(userId);
  const pool = getPool();

  const clientsRes = await pool.query<ClientRow>(
    `SELECT id, name FROM clients WHERE workspace_id = $1 ORDER BY created_at DESC`,
    [ws.id]
  );

  const contractsRes = await pool.query<ContractRow>(
    `
      SELECT
        c.id,
        c.client_id,
        c.title,
        c.status,
        c.hourly_rate_cents,
        c.monthly_retainer_cents,
        c.currency,
        c.created_at,
        c.updated_at,
        cl.name AS client_name
      FROM contracts c
      JOIN clients cl
        ON cl.id = c.client_id AND cl.workspace_id = c.workspace_id
      WHERE c.workspace_id = $1
      ORDER BY c.created_at DESC
    `,
    [ws.id]
  );

  const clientOptions: ClientOption[] = clientsRes.rows.map((c) => ({ id: c.id, name: c.name }));

  const contracts: ContractListItem[] = contractsRes.rows.map((c) => {
    return {
      id: c.id,
      clientId: c.client_id,
      clientName: c.client_name,
      title: c.title,
      status: c.status as ContractListItem["status"],
      hourlyRateCents: c.hourly_rate_cents,
      monthlyRetainerCents: c.monthly_retainer_cents,
      currency: c.currency,
      createdAt: toIsoString(c.created_at),
      updatedAt: toIsoString(c.updated_at),
    };
  });

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow">
        <div className="card-body space-y-2">
          <h1 className="text-2xl font-bold">Contracts</h1>
          <p className="text-sm text-base-content/70">
            Workspace: <span className="font-medium">{ws.name}</span>
          </p>
        </div>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <CreateContractForm clients={clientOptions} />
        </div>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="font-semibold">Your contracts</h2>

          {contracts.length === 0 ? (
            <p className="text-sm text-base-content/70">No contracts yet.</p>
          ) : (
            <ContractsTable contracts={contracts} clients={clientOptions} />
          )}
        </div>
      </div>
    </div>
  );
}
