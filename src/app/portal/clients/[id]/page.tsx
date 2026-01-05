import { getServerSession } from "next-auth/next";
import Link from "next/link";

import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { getActiveWorkspaceForUser } from "@/lib/workspace";
import { ClientMembersManager } from "@/components/ClientMembersManager";

type PageContext = {
  params: Promise<{ id: string }>;
};

type ClientRow = { id: string; name: string; created_at: Date };

type MemberRow = {
  user_id: string;
  email: string;
  name: string | null;
  client_role: "client_admin" | "client_user";
  created_at: Date;
};

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

export default async function ClientDetailPage(ctx: PageContext) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  const params = await ctx.params;
  const clientId = params.id;
  if (!isUuid(clientId)) {
    return (
      <div className="card bg-base-100 shadow">
        <div className="card-body space-y-2">
          <h1 className="text-2xl font-bold">Client</h1>
          <p className="text-sm text-base-content/70">Invalid client id.</p>
          <Link href="/portal/clients" className="btn btn-ghost btn-sm w-fit">
            Back
          </Link>
        </div>
      </div>
    );
  }

  const ws = await getActiveWorkspaceForUser(userId);
  const pool = getPool();

  const clientRes = await pool.query<ClientRow>(
    `SELECT id, name, created_at
     FROM clients
     WHERE id = $1 AND workspace_id = $2`,
    [clientId, ws.id]
  );

  if (clientRes.rowCount === 0) {
    return (
      <div className="card bg-base-100 shadow">
        <div className="card-body space-y-2">
          <h1 className="text-2xl font-bold">Client</h1>
          <p className="text-sm text-base-content/70">Not found.</p>
          <Link href="/portal/clients" className="btn btn-ghost btn-sm w-fit">
            Back
          </Link>
        </div>
      </div>
    );
  }

  const membersRes = await pool.query<MemberRow>(
    `
      SELECT cm.user_id,
             u.email,
             u.name,
             cm.client_role,
             cm.created_at
      FROM client_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.client_id = $1
      ORDER BY cm.created_at DESC
    `,
    [clientId]
  );

  const client = clientRes.rows[0];

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow">
        <div className="card-body space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <Link href="/portal/clients" className="btn btn-ghost btn-sm">
              Back
            </Link>
          </div>
          <p className="text-sm text-base-content/70">Manage client memberships and access.</p>
        </div>
      </div>

      <ClientMembersManager clientId={clientId} initialMembers={membersRes.rows} />
    </div>
  );
}
