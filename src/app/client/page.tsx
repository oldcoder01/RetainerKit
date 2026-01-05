import { getServerSession } from "next-auth/next";
import Link from "next/link";

import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { getActiveWorkspaceForUser } from "@/lib/workspace";
import { getActiveClientForUserInWorkspace } from "@/lib/client";

type ContractSummaryRow = { status: string; count: string };
type InvoiceSummaryRow = { status: string; count: string; total_cents: string };

function formatMoney(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default async function ClientDashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  const ws = await getActiveWorkspaceForUser(userId);
  const client = await getActiveClientForUserInWorkspace(userId, ws.id);

  if (!client) {
    return (
      <div className="card bg-base-100 shadow">
        <div className="card-body space-y-2">
          <h1 className="text-2xl font-bold">Client dashboard</h1>
          <p className="text-sm text-base-content/70">
            Your account is marked as a client user, but you have not been assigned to any client yet.
          </p>
          <p className="text-sm text-base-content/70">Ask your contractor/admin to add you as a client member.</p>
        </div>
      </div>
    );
  }

  const pool = getPool();

  const contractSummary = await pool.query<ContractSummaryRow>(
    `
      SELECT c.status, COUNT(*)::text AS count
      FROM contracts c
      WHERE c.workspace_id = $1
        AND c.client_id = $2
      GROUP BY c.status
      ORDER BY c.status
    `,
    [ws.id, client.id]
  );

  const invoiceSummary = await pool.query<InvoiceSummaryRow>(
    `
      SELECT i.status,
             COUNT(*)::text AS count,
             COALESCE(SUM(i.amount_cents), 0)::text AS total_cents
      FROM invoices i
      JOIN contracts c ON c.id = i.contract_id
      WHERE i.workspace_id = $1
        AND c.client_id = $2
      GROUP BY i.status
      ORDER BY i.status
    `,
    [ws.id, client.id]
  );

  const totals = invoiceSummary.rows.reduce(
    (acc, r) => {
      const cents = Number(r.total_cents);
      if (!Number.isFinite(cents)) return acc;
      return acc + cents;
    },
    0
  );

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow">
        <div className="card-body space-y-2">
          <h1 className="text-2xl font-bold">Client dashboard</h1>
          <p className="text-sm text-base-content/70">
            Welcome, <span className="font-medium">{client.name}</span>.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card bg-base-100 shadow">
          <div className="card-body space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Contracts</h2>
              <span className="badge badge-neutral">{contractSummary.rows.reduce((a, r) => a + Number(r.count), 0)}</span>
            </div>

            {contractSummary.rowCount === 0 ? (
              <p className="text-sm text-base-content/70">No contracts yet.</p>
            ) : (
              <div className="space-y-2">
                {contractSummary.rows.map((r) => (
                  <div key={r.status} className="flex items-center justify-between text-sm">
                    <div className="capitalize">{r.status}</div>
                    <div className="font-mono">{r.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card bg-base-100 shadow">
          <div className="card-body space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Invoices</h2>
              <Link href="/client/invoices" className="btn btn-ghost btn-sm">
                View
              </Link>
            </div>

            {invoiceSummary.rowCount === 0 ? (
              <p className="text-sm text-base-content/70">No invoices yet.</p>
            ) : (
              <div className="space-y-2">
                {invoiceSummary.rows.map((r) => (
                  <div key={r.status} className="flex items-center justify-between text-sm">
                    <div className="capitalize">{r.status}</div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono">{r.count}</span>
                      <span className="font-mono">{formatMoney(Number(r.total_cents), "USD")}</span>
                    </div>
                  </div>
                ))}
                <div className="divider my-1" />
                <div className="flex items-center justify-between text-sm">
                  <div className="font-semibold">Total</div>
                  <div className="font-mono">{formatMoney(totals, "USD")}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
