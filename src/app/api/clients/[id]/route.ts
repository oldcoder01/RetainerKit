import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { getActiveWorkspaceForUser } from "@/lib/workspace";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PatchBody = {
  name?: string;
};

type ClientRow = {
  id: string;
  name: string;
  created_at: Date;
};

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await ctx.params;
  const clientId = params.id;

  if (!isUuid(clientId)) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }

  const body = (await req.json()) as PatchBody;
  const name = (body.name ?? "").trim();

  if (name.length < 1 || name.length > 120) {
    return NextResponse.json({ error: "Client name must be 1–120 characters." }, { status: 400 });
  }

  const ws = await getActiveWorkspaceForUser(session.user.id);

  const pool = getPool();
  const res = await pool.query<ClientRow>(
    `UPDATE clients
     SET name = $1
     WHERE id = $2 AND workspace_id = $3
     RETURNING id, name, created_at`,
    [name, clientId, ws.id]
  );

  if (res.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ client: res.rows[0] }, { status: 200 });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await ctx.params;
  const clientId = params.id;

  if (!isUuid(clientId)) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }

  const ws = await getActiveWorkspaceForUser(session.user.id);

  const pool = getPool();
  const res = await pool.query<{ id: string }>(
    `DELETE FROM clients
     WHERE id = $1 AND workspace_id = $2
     RETURNING id`,
    [clientId, ws.id]
  );

  if (res.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true, id: res.rows[0].id }, { status: 200 });
}
