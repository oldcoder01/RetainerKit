import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { getActiveWorkspaceForUser } from "@/lib/workspace";
import { CreateInvoiceForm } from "@/components/CreateInvoiceForm";
import { InvoicesTable, type InvoiceListItem, type ContractOption } from "@/components/InvoicesTable";

type ContractRow = { id: string; title: string; client_name: string };

type InvoiceRow = {
  id: string;
  contract_id: string;
  period_start: string;
  period_end: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: unknown;
  updated_at: unknown;
  contract_title: string;
  client_name: string;
};

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) return new Date(0).toISOString();
  return dt.toISOString();
}

export default async function InvoicesPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  const ws = await getActiveWorkspaceForUser(userId);
  const pool = getPool();

  const contractsRes = await pool.query<ContractRow>(
    `
      SELECT c.id, c.title, cl.name AS client_name
      FROM contracts c
      JOIN clients cl
        ON cl.id = c.client_id AND cl.workspace_id = c.workspace_id
      WHERE c.workspace_id = $1
      ORDER BY cl.name ASC, c.title ASC
    `,
    [ws.id]
  );

  const invoicesRes = await pool.query<InvoiceRow>(
    `
      SELECT
        i.id,
        i.contract_id,
        i.period_start::text AS period_start,
        i.period_end::text AS period_end,
        i.amount_cents,
        i.currency,
        i.status,
        i.created_at,
        i.updated_at,
        c.title AS contract_title,
        cl.name AS client_name
      FROM invoices i
      JOIN contracts c
        ON c.id = i.contract_id AND c.workspace_id = i.workspace_id
      JOIN clients cl
        ON cl.id = c.client_id AND cl.workspace_id = c.workspace_id
      WHERE i.workspace_id = $1
      ORDER BY i.period_end DESC, i.created_at DESC
      LIMIT 200
    `,
    [ws.id]
  );

  const contractOptions: ContractOption[] = contractsRes.rows.map((c) => ({
    id: c.id,
    label: `${c.client_name} — ${c.title}`,
  }));

  const invoices: InvoiceListItem[] = invoicesRes.rows.map((i) => ({
    id: i.id,
    contractId: i.contract_id,
    contractLabel: `${i.client_name} — ${i.contract_title}`,
    periodStart: i.period_start,
    periodEnd: i.period_end,
    amountCents: i.amount_cents,
    currency: i.currency,
    status: i.status as InvoiceListItem["status"],
    createdAt: toIsoString(i.created_at),
    updatedAt: toIsoString(i.updated_at),
  }));

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow">
        <div className="card-body space-y-2">
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-base-content/70">
            Workspace: <span className="font-medium">{ws.name}</span>
          </p>
        </div>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <CreateInvoiceForm contracts={contractOptions} />
        </div>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="font-semibold">Recent invoices</h2>
          {invoices.length === 0 ? (
            <p className="text-sm text-base-content/70">No invoices yet.</p>
          ) : (
            <InvoicesTable invoices={invoices} contracts={contractOptions} />
          )}
        </div>
      </div>
    </div>
  );
}
