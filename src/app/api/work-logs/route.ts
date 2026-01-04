import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { getActiveWorkspaceForUser } from "@/lib/workspace";

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

type CreateBody = {
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

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ws = await getActiveWorkspaceForUser(session.user.id);

  const url = new URL(req.url);
  const contractId = url.searchParams.get("contractId");

  const pool = getPool();

  if (contractId) {
    if (!isUuid(contractId)) {
      return NextResponse.json({ error: "Invalid contractId" }, { status: 400 });
    }

    const res = await pool.query<WorkLogRow>(
      `SELECT *
       FROM work_logs
       WHERE workspace_id = $1 AND contract_id = $2
       ORDER BY work_date DESC, created_at DESC`,
      [ws.id, contractId]
    );

    return NextResponse.json({ workLogs: res.rows }, { status: 200 });
  }

  const res = await pool.query<WorkLogRow>(
    `SELECT *
     FROM work_logs
     WHERE workspace_id = $1
     ORDER BY work_date DESC, created_at DESC
     LIMIT 200`,
    [ws.id]
  );

  return NextResponse.json({ workLogs: res.rows }, { status: 200 });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as CreateBody;

  const contractId = (body.contractId ?? "").trim();
  const workDate = (body.workDate ?? "").trim();
  const minutes = body.minutes ?? 0;
  const description = (body.description ?? "").trim();

  if (!isUuid(contractId)) {
    return NextResponse.json({ error: "contractId is required and must be a UUID." }, { status: 400 });
  }
  if (!isIsoDate(workDate)) {
    return NextResponse.json({ error: "workDate is required and must be YYYY-MM-DD." }, { status: 400 });
  }
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 24 * 60) {
    return NextResponse.json({ error: "minutes must be an integer from 1 to 1440." }, { status: 400 });
  }
  if (description.length < 1 || description.length > 4000) {
    return NextResponse.json({ error: "description must be 1–4000 characters." }, { status: 400 });
  }

  const ws = await getActiveWorkspaceForUser(session.user.id);
  const pool = getPool();

  // Ensure contract is in this workspace
  const contractCheck = await pool.query<{ id: string }>(
    `SELECT id FROM contracts WHERE id = $1 AND workspace_id = $2`,
    [contractId, ws.id]
  );
  if (contractCheck.rowCount === 0) {
    return NextResponse.json({ error: "Contract not found in your workspace." }, { status: 404 });
  }

  const res = await pool.query<WorkLogRow>(
    `INSERT INTO work_logs (workspace_id, contract_id, work_date, minutes, description, created_by_user_id)
     VALUES ($1, $2, $3::date, $4, $5, $6)
     RETURNING *`,
    [ws.id, contractId, workDate, minutes, description, session.user.id]
  );

  return NextResponse.json({ workLog: res.rows[0] }, { status: 201 });
}
