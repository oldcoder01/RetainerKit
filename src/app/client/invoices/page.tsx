import { getServerSession } from "next-auth/next";
import Link from "next/link";

import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { getActiveWorkspaceForUser } from "@/lib/workspace";
import { getActiveClientForUserInWorkspace } from "@/lib/client";

type InvoiceRow = {
  id: string;
  period_start: unknown;
  period_end: unknown;
  amount_cents: number;
  currency: string;
  status: "draft" | "sent" | "paid" | "void";
  contract_title: string;
  created_at: unknown;
};

function toDateString(value: unknown): string {
  const dt = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

function formatMoney(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default async function ClientInvoicesPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  const ws = await getActiveWorkspaceForUser(userId);
  const client = await getActiveClientForUserInWorkspace(userId, ws.id);

  if (!client) {
    return (
      <div className="card bg-base-100 shadow">
        <div className="card-body space-y-2">
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-base-content/70">You are not assigned to a client yet.</p>
          <Link href="/client" className="btn btn-ghost btn-sm w-fit">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const pool = getPool();
  const res = await pool.query<InvoiceRow>(
    `
      SELECT i.id,
             i.period_start,
             i.period_end,
             i.amount_cents,
             i.currency,
             i.status,
             i.created_at,
             c.title AS contract_title
      FROM invoices i
      JOIN contracts c ON c.id = i.contract_id
      WHERE i.workspace_id = $1
        AND c.client_id = $2
      ORDER BY i.period_start DESC, i.created_at DESC
    `,
    [ws.id, client.id]
  );

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow">
        <div className="card-body space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Invoices</h1>
            <Link href="/client" className="btn btn-ghost btn-sm">
              Dashboard
            </Link>
          </div>
          <p className="text-sm text-base-content/70">
            Client: <span className="font-medium">{client.name}</span>
          </p>
        </div>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          {res.rowCount === 0 ? (
            <p className="text-sm text-base-content/70">No invoices yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Contract</th>
                    <th>Status</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {res.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-sm">
                        {toDateString(r.period_start)} → {toDateString(r.period_end)}
                      </td>
                      <td>{r.contract_title}</td>
                      <td>
                        <span className="badge badge-neutral capitalize">{r.status}</span>
                      </td>
                      <td className="text-right font-mono">{formatMoney(r.amount_cents, r.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
