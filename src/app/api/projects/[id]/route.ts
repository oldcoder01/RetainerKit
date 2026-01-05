import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { getActiveWorkspaceForUser } from "@/lib/workspace";
import { requireContractorWorkspace } from "@/lib/authz";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ProjectRow = {
  id: string;
  name: string;
  created_at: Date;
};

type PatchBody = {
  name?: string;
};

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ws = await getActiveWorkspaceForUser(session.user.id);
  const gate = requireContractorWorkspace(ws);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const params = await ctx.params;
  const projectId = params.id;

  if (!isUuid(projectId)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  const pool = getPool();
  const res = await pool.query<{ id: string }>(
    `DELETE FROM projects
     WHERE id = $1 AND workspace_id = $2
     RETURNING id`,
    [projectId, ws.id]
  );

  if (res.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true, id: res.rows[0].id }, { status: 200 });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await ctx.params;
  const projectId = params.id;
  const ws = await getActiveWorkspaceForUser(session.user.id);
  const gate = requireContractorWorkspace(ws);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  if (!isUuid(projectId)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  const body = (await req.json()) as PatchBody;
  const name = (body.name ?? "").trim();

  if (name.length < 1 || name.length > 120) {
    return NextResponse.json({ error: "Project name must be 1–120 characters." }, { status: 400 });
  }

  const pool = getPool();
  const res = await pool.query<ProjectRow>(
    `UPDATE projects
     SET name = $1
     WHERE id = $2 AND workspace_id = $3
     RETURNING id, name, created_at`,
    [name, projectId, ws.id]
  );

  if (res.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ project: res.rows[0] }, { status: 200 });
}
