import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { getActiveWorkspaceForUser } from "@/lib/workspace";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type InvoiceStatus = "draft" | "sent" | "paid" | "void";

type InvoiceRow = {
  id: string;
  workspace_id: string;
  contract_id: string;
  period_start: string;
  period_end: string;
  amount_cents: number;
  currency: string;
  status: InvoiceStatus;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
};

type PatchBody = {
  contractId?: string;
  periodStart?: string;
  periodEnd?: string;
  amountCents?: number;
  currency?: string;
  status?: InvoiceStatus;
};

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidStatus(value: string): value is InvoiceStatus {
  return value === "draft" || value === "sent" || value === "paid" || value === "void";
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
  const invoiceId = params.id;

  if (!isUuid(invoiceId)) {
    return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
  }

  const body = (await req.json()) as PatchBody;
  const updates: { col: string; val: unknown }[] = [];

  if (body.contractId !== undefined) {
    const v = body.contractId.trim();
    if (!isUuid(v)) return NextResponse.json({ error: "contractId must be a UUID." }, { status: 400 });
    updates.push({ col: "contract_id", val: v });
  }

  if (body.periodStart !== undefined) {
    const v = body.periodStart.trim();
    if (!isIsoDate(v)) return NextResponse.json({ error: "periodStart must be YYYY-MM-DD." }, { status: 400 });
    updates.push({ col: "period_start", val: v });
  }

  if (body.periodEnd !== undefined) {
    const v = body.periodEnd.trim();
    if (!isIsoDate(v)) return NextResponse.json({ error: "periodEnd must be YYYY-MM-DD." }, { status: 400 });
    updates.push({ col: "period_end", val: v });
  }

  if (body.amountCents !== undefined) {
    const v = body.amountCents;
    if (!Number.isInteger(v) || v < 0 || v > 1000000000) {
      return NextResponse.json({ error: "amountCents must be a non-negative integer." }, { status: 400 });
    }
    updates.push({ col: "amount_cents", val: v });
  }

  if (body.currency !== undefined) {
    const v = normalizeCurrency(body.currency);
    if (v.length !== 3) return NextResponse.json({ error: "Currency must be a 3-letter code." }, { status: 400 });
    updates.push({ col: "currency", val: v });
  }

  if (body.status !== undefined) {
    const v = body.status;
    if (!isValidStatus(v)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    updates.push({ col: "status", val: v });
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  const ws = await getActiveWorkspaceForUser(session.user.id);
  const pool = getPool();

  // If contract changed, verify it exists in workspace
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

  // If period changed, validate start <= end (need current values)
  const hasPeriodStart = updates.some((u) => u.col === "period_start");
  const hasPeriodEnd = updates.some((u) => u.col === "period_end");
  if (hasPeriodStart || hasPeriodEnd) {
    const cur = await pool.query<{ period_start: string; period_end: string }>(
      `SELECT period_start::text AS period_start, period_end::text AS period_end
       FROM invoices
       WHERE id = $1 AND workspace_id = $2`,
      [invoiceId, ws.id]
    );
    if (cur.rowCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const nextStart = String(updates.find((u) => u.col === "period_start")?.val ?? cur.rows[0].period_start);
    const nextEnd = String(updates.find((u) => u.col === "period_end")?.val ?? cur.rows[0].period_end);

    if (nextStart > nextEnd) {
      return NextResponse.json({ error: "periodStart must be <= periodEnd." }, { status: 400 });
    }
  }

  const setSql = updates.map((u, i) => `${u.col} = $${i + 1}`).join(", ");
  const values = updates.map((u) => u.val);

  const sql = `
    UPDATE invoices
    SET ${setSql}, updated_at = now()
    WHERE id = $${values.length + 1} AND workspace_id = $${values.length + 2}
    RETURNING *
  `;

  const res = await pool.query<InvoiceRow>(sql, [...values, invoiceId, ws.id]);

  if (res.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ invoice: res.rows[0] }, { status: 200 });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await ctx.params;
  const invoiceId = params.id;

  if (!isUuid(invoiceId)) {
    return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
  }

  const ws = await getActiveWorkspaceForUser(session.user.id);
  const pool = getPool();

  const res = await pool.query<{ id: string }>(
    `DELETE FROM invoices WHERE id = $1 AND workspace_id = $2 RETURNING id`,
    [invoiceId, ws.id]
  );

  if (res.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true, id: res.rows[0].id }, { status: 200 });
}
