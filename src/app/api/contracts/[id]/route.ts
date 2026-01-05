import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { getActiveWorkspaceForUser } from "@/lib/workspace";
import { requireContractorWorkspace } from "@/lib/authz";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ContractStatus = "draft" | "active" | "paused" | "closed";

type ContractRow = {
  id: string;
  workspace_id: string;
  client_id: string;
  title: string;
  status: ContractStatus;
  hourly_rate_cents: number | null;
  monthly_retainer_cents: number | null;
  currency: string;
  created_at: Date;
  updated_at: Date;
};

type PatchBody = {
  title?: string;
  status?: ContractStatus;
  hourlyRateCents?: number | null;
  monthlyRetainerCents?: number | null;
  currency?: string;
  clientId?: string;
};

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

function isValidStatus(value: string): value is ContractStatus {
  return value === "draft" || value === "active" || value === "paused" || value === "closed";
}

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await ctx.params;
  const contractId = params.id;

  if (!isUuid(contractId)) {
    return NextResponse.json({ error: "Invalid contract id" }, { status: 400 });
  }

  const body = (await req.json()) as PatchBody;

  const updates: { col: string; val: unknown }[] = [];

  if (body.title !== undefined) {
    const title = body.title.trim();
    if (title.length < 1 || title.length > 160) {
      return NextResponse.json({ error: "Title must be 1–160 characters." }, { status: 400 });
    }
    updates.push({ col: "title", val: title });
  }

  if (body.status !== undefined) {
    if (!isValidStatus(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    updates.push({ col: "status", val: body.status });
  }

  if (body.currency !== undefined) {
    const currency = normalizeCurrency(body.currency);
    if (currency.length !== 3) {
      return NextResponse.json({ error: "Currency must be a 3-letter code (e.g., USD)." }, { status: 400 });
    }
    updates.push({ col: "currency", val: currency });
  }

  if (body.hourlyRateCents !== undefined) {
    const v = body.hourlyRateCents;
    if (v !== null && (!Number.isInteger(v) || v < 0 || v > 100000000)) {
      return NextResponse.json({ error: "hourlyRateCents must be a non-negative integer or null." }, { status: 400 });
    }
    updates.push({ col: "hourly_rate_cents", val: v });
  }

  if (body.monthlyRetainerCents !== undefined) {
    const v = body.monthlyRetainerCents;
    if (v !== null && (!Number.isInteger(v) || v < 0 || v > 1000000000)) {
      return NextResponse.json({ error: "monthlyRetainerCents must be a non-negative integer or null." }, { status: 400 });
    }
    updates.push({ col: "monthly_retainer_cents", val: v });
  }

  if (body.clientId !== undefined) {
    const clientId = body.clientId.trim();
    if (!isUuid(clientId)) {
      return NextResponse.json({ error: "clientId must be a UUID." }, { status: 400 });
    }
    updates.push({ col: "client_id", val: clientId });
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  const ws = await getActiveWorkspaceForUser(session.user.id);
  const gate = requireContractorWorkspace(ws);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const pool = getPool();

  // If client_id is being updated, enforce it exists in same workspace
  const clientUpdate = updates.find((u) => u.col === "client_id");
  if (clientUpdate) {
    const clientId = String(clientUpdate.val);
    const exists = await pool.query<{ id: string }>(
      `SELECT id FROM clients WHERE id = $1 AND workspace_id = $2`,
      [clientId, ws.id]
    );
    if (exists.rowCount === 0) {
      return NextResponse.json({ error: "Client not found in your workspace." }, { status: 404 });
    }
  }

  const setSql = updates.map((u, i) => `${u.col} = $${i + 1}`).join(", ");
  const values = updates.map((u) => u.val);

  // also bump updated_at
  const sql = `
    UPDATE contracts
    SET ${setSql}, updated_at = now()
    WHERE id = $${values.length + 1} AND workspace_id = $${values.length + 2}
    RETURNING *
  `;

  const res = await pool.query<ContractRow>(sql, [...values, contractId, ws.id]);

  if (res.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ contract: res.rows[0] }, { status: 200 });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await ctx.params;
  const contractId = params.id;

  if (!isUuid(contractId)) {
    return NextResponse.json({ error: "Invalid contract id" }, { status: 400 });
  }

  const ws = await getActiveWorkspaceForUser(session.user.id);
  const gate = requireContractorWorkspace(ws);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const pool = getPool();

  const res = await pool.query<{ id: string }>(
    `DELETE FROM contracts WHERE id = $1 AND workspace_id = $2 RETURNING id`,
    [contractId, ws.id]
  );

  if (res.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true, id: res.rows[0].id }, { status: 200 });
}
