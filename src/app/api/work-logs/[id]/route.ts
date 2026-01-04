import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { getActiveWorkspaceForUser } from "@/lib/workspace";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type WorkLogRow = {
  id: string;
  workspace_id: string;
  contract_id: string;
  work_date: string;
  minutes: number;
  description: string;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
};

type PatchBody = {
  contractId?: string;
  workDate?: string; // YYYY-MM-DD
  minutes?: number;
  description?: string;
};

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await ctx.params;
  const workLogId = params.id;

  if (!isUuid(workLogId)) {
    return NextResponse.json({ error: "Invalid work log id" }, { status: 400 });
  }

  const body = (await req.json()) as PatchBody;

  const updates: { col: string; val: unknown }[] = [];

  if (body.workDate !== undefined) {
    const workDate = body.workDate.trim();
    if (!isIsoDate(workDate)) {
      return NextResponse.json({ error: "workDate must be YYYY-MM-DD." }, { status: 400 });
    }
    updates.push({ col: "work_date", val: workDate });
  }

  if (body.minutes !== undefined) {
    const minutes = body.minutes;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 24 * 60) {
      return NextResponse.json({ error: "minutes must be an integer from 1 to 1440." }, { status: 400 });
    }
    updates.push({ col: "minutes", val: minutes });
  }

  if (body.description !== undefined) {
    const description = body.description.trim();
    if (description.length < 1 || description.length > 4000) {
      return NextResponse.json({ error: "description must be 1–4000 characters." }, { status: 400 });
    }
    updates.push({ col: "description", val: description });
  }

  if (body.contractId !== undefined) {
    const contractId = body.contractId.trim();
    if (!isUuid(contractId)) {
      return NextResponse.json({ error: "contractId must be a UUID." }, { status: 400 });
    }
    updates.push({ col: "contract_id", val: contractId });
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  const ws = await getActiveWorkspaceForUser(session.user.id);
  const pool = getPool();

  // If contract_id updated, enforce it exists in same workspace
  const contractUpdate = updates.find((u) => u.col === "contract_id");
  if (contractUpdate) {
    const contractId = String(contractUpdate.val);
    const exists = await pool.query<{ id: string }>(
      `SELECT id FROM contracts WHERE id = $1 AND workspace_id = $2`,
      [contractId, ws.id]
    );
    if (exists.rowCount === 0) {
      return NextResponse.json({ error: "Contract not found in your workspace." }, { status: 404 });
    }
  }

  const setSql = updates.map((u, i) => `${u.col} = $${i + 1}`).join(", ");
  const values = updates.map((u) => u.val);

  const sql = `
    UPDATE work_logs
    SET ${setSql}, updated_at = now()
    WHERE id = $${values.length + 1} AND workspace_id = $${values.length + 2}
    RETURNING *
  `;

  const res = await pool.query<WorkLogRow>(sql, [...values, workLogId, ws.id]);

  if (res.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ workLog: res.rows[0] }, { status: 200 });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await ctx.params;
  const workLogId = params.id;

  if (!isUuid(workLogId)) {
    return NextResponse.json({ error: "Invalid work log id" }, { status: 400 });
  }

  const ws = await getActiveWorkspaceForUser(session.user.id);
  const pool = getPool();

  const res = await pool.query<{ id: string }>(
    `DELETE FROM work_logs WHERE id = $1 AND workspace_id = $2 RETURNING id`,
    [workLogId, ws.id]
  );

  if (res.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true, id: res.rows[0].id }, { status: 200 });
}
