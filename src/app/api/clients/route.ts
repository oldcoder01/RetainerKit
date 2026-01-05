import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { getActiveWorkspaceForUser } from "@/lib/workspace";
import { requireContractorWorkspace } from "@/lib/authz";

type ClientRow = {
  id: string;
  name: string;
  created_at: Date;
};

type CreateBody = {
  name?: string;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ws = await getActiveWorkspaceForUser(session.user.id);
  const gate = requireContractorWorkspace(ws);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const pool = getPool();
  const res = await pool.query<ClientRow>(
    `SELECT id, name, created_at
     FROM clients
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [ws.id]
  );

  return NextResponse.json({ clients: res.rows }, { status: 200 });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as CreateBody;
  const name = (body.name ?? "").trim();

  if (name.length < 1 || name.length > 120) {
    return NextResponse.json({ error: "Client name must be 1–120 characters." }, { status: 400 });
  }

  const ws = await getActiveWorkspaceForUser(session.user.id);
  const gate = requireContractorWorkspace(ws);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const pool = getPool();
  const res = await pool.query<ClientRow>(
    `INSERT INTO clients (workspace_id, name)
     VALUES ($1, $2)
     RETURNING id, name, created_at`,
    [ws.id, name]
  );

  return NextResponse.json({ client: res.rows[0] }, { status: 201 });
}
