import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { getActiveWorkspaceForUser } from "@/lib/workspace";

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

type CreateBody = {
  contractId?: string;
  periodStart?: string; // YYYY-MM-DD
  periodEnd?: string;   // YYYY-MM-DD
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

    const res = await pool.query<InvoiceRow>(
      `SELECT *
       FROM invoices
       WHERE workspace_id = $1 AND contract_id = $2
       ORDER BY period_end DESC, created_at DESC`,
      [ws.id, contractId]
    );

    return NextResponse.json({ invoices: res.rows }, { status: 200 });
  }

  const res = await pool.query<InvoiceRow>(
    `SELECT *
     FROM invoices
     WHERE workspace_id = $1
     ORDER BY period_end DESC, created_at DESC
     LIMIT 200`,
    [ws.id]
  );

  return NextResponse.json({ invoices: res.rows }, { status: 200 });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as CreateBody;

  const contractId = (body.contractId ?? "").trim();
  const periodStart = (body.periodStart ?? "").trim();
  const periodEnd = (body.periodEnd ?? "").trim();
  const amountCents = body.amountCents ?? 0;
  const status: InvoiceStatus = body.status ?? "draft";
  const currency = normalizeCurrency(body.currency ?? "USD");

  if (!isUuid(contractId)) {
    return NextResponse.json({ error: "contractId is required and must be a UUID." }, { status: 400 });
  }
  if (!isIsoDate(periodStart) || !isIsoDate(periodEnd)) {
    return NextResponse.json({ error: "periodStart and periodEnd must be YYYY-MM-DD." }, { status: 400 });
  }
  if (periodStart > periodEnd) {
    return NextResponse.json({ error: "periodStart must be <= periodEnd." }, { status: 400 });
  }
  if (!Number.isInteger(amountCents) || amountCents < 0 || amountCents > 1000000000) {
    return NextResponse.json({ error: "amountCents must be a non-negative integer." }, { status: 400 });
  }
  if (!isValidStatus(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  if (currency.length !== 3) {
    return NextResponse.json({ error: "Currency must be a 3-letter code (e.g., USD)." }, { status: 400 });
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

  const res = await pool.query<InvoiceRow>(
    `INSERT INTO invoices (
        workspace_id, contract_id, period_start, period_end, amount_cents, currency, status, created_by_user_id
     )
     VALUES ($1, $2, $3::date, $4::date, $5, $6, $7, $8)
     RETURNING *`,
    [ws.id, contractId, periodStart, periodEnd, amountCents, currency, status, session.user.id]
  );

  return NextResponse.json({ invoice: res.rows[0] }, { status: 201 });
}
