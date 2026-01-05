import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { getActiveWorkspaceForUser } from "@/lib/workspace";
import { requireContractorWorkspace } from "@/lib/authz";

type ClientRole = "client_admin" | "client_user";

type CreateBody = {
  clientId?: string;
  email?: string;
  clientRole?: ClientRole;
};

type DeleteBody = {
  clientId?: string;
  userId?: string;
};

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

function isClientRole(value: string): value is ClientRole {
  return value === "client_admin" || value === "client_user";
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ws = await getActiveWorkspaceForUser(session.user.id);
  const gate = requireContractorWorkspace(ws);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId") ?? "";
  if (!isUuid(clientId)) {
    return NextResponse.json({ error: "clientId is required (UUID)" }, { status: 400 });
  }

  const pool = getPool();

  const exists = await pool.query<{ id: string }>(
    `SELECT id FROM clients WHERE id = $1 AND workspace_id = $2`,
    [clientId, ws.id]
  );
  if (exists.rowCount === 0) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const members = await pool.query<{
    user_id: string;
    email: string;
    name: string | null;
    client_role: ClientRole;
    created_at: Date;
  }>(
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

  return NextResponse.json({ members: members.rows }, { status: 200 });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ws = await getActiveWorkspaceForUser(session.user.id);
  const gate = requireContractorWorkspace(ws);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = (await req.json()) as CreateBody;
  const clientId = (body.clientId ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const clientRole = body.clientRole ?? "client_user";

  if (!isUuid(clientId)) {
    return NextResponse.json({ error: "clientId must be a UUID" }, { status: 400 });
  }

  if (!email || email.length > 320) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  if (!isClientRole(clientRole)) {
    return NextResponse.json({ error: "clientRole must be client_admin or client_user" }, { status: 400 });
  }

  const pool = getPool();

  const exists = await pool.query<{ id: string }>(
    `SELECT id FROM clients WHERE id = $1 AND workspace_id = $2`,
    [clientId, ws.id]
  );
  if (exists.rowCount === 0) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const user = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1`,
    [email]
  );
  if (user.rowCount === 0) {
    return NextResponse.json(
      {
        error: "No user found with that email. Ask the client to register first, then add them here.",
      },
      { status: 404 }
    );
  }

  const userId = user.rows[0].id;

  await pool.query(
    `
      INSERT INTO client_members (client_id, user_id, client_role)
      VALUES ($1, $2, $3)
      ON CONFLICT (client_id, user_id)
      DO UPDATE SET client_role = EXCLUDED.client_role
    `,
    [clientId, userId, clientRole]
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ws = await getActiveWorkspaceForUser(session.user.id);
  const gate = requireContractorWorkspace(ws);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = (await req.json()) as DeleteBody;
  const clientId = (body.clientId ?? "").trim();
  const userId = (body.userId ?? "").trim();

  if (!isUuid(clientId) || !isUuid(userId)) {
    return NextResponse.json({ error: "clientId and userId must be UUIDs" }, { status: 400 });
  }

  const pool = getPool();

  const clientOk = await pool.query<{ id: string }>(
    `SELECT id FROM clients WHERE id = $1 AND workspace_id = $2`,
    [clientId, ws.id]
  );
  if (clientOk.rowCount === 0) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const res = await pool.query<{ user_id: string }>(
    `DELETE FROM client_members WHERE client_id = $1 AND user_id = $2 RETURNING user_id`,
    [clientId, userId]
  );

  if (res.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
