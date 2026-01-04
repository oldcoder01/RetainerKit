import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { getActiveWorkspaceForUser } from "@/lib/workspace";

type ContractRow = {
  id: string;
  workspace_id: string;
  client_id: string;
  title: string;
  status: "draft" | "active" | "paused" | "closed";
  hourly_rate_cents: number | null;
  monthly_retainer_cents: number | null;
  currency: string;
  created_at: Date;
  updated_at: Date;
};

type CreateBody = {
  clientId?: string;
  title?: string;
  status?: ContractRow["status"];
  hourlyRateCents?: number | null;
  monthlyRetainerCents?: number | null;
  currency?: string;
};

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

function isValidStatus(value: string): value is ContractRow["status"] {
  return value === "draft" || value === "active" || value === "paused" || value === "closed";
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
  const clientId = url.searchParams.get("clientId");

  const pool = getPool();

  if (clientId) {
    if (!isUuid(clientId)) {
      return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
    }

    const res = await pool.query<ContractRow>(
      `SELECT *
       FROM contracts
       WHERE workspace_id = $1 AND client_id = $2
       ORDER BY created_at DESC`,
      [ws.id, clientId]
    );
    return NextResponse.json({ contracts: res.rows }, { status: 200 });
  }

  const res = await pool.query<ContractRow>(
    `SELECT *
     FROM contracts
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [ws.id]
  );

  return NextResponse.json({ contracts: res.rows }, { status: 200 });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as CreateBody;

  const clientId = (body.clientId ?? "").trim();
  const title = (body.title ?? "").trim();
  const status = body.status ?? "active";
  const currency = normalizeCurrency(body.currency ?? "USD");

  if (!isUuid(clientId)) {
    return NextResponse.json({ error: "clientId is required and must be a UUID." }, { status: 400 });
  }
  if (title.length < 1 || title.length > 160) {
    return NextResponse.json({ error: "Title must be 1–160 characters." }, { status: 400 });
  }
  if (!isValidStatus(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  if (currency.length !== 3) {
    return NextResponse.json({ error: "Currency must be a 3-letter code (e.g., USD)." }, { status: 400 });
  }

  const hourly = body.hourlyRateCents ?? null;
  const retainer = body.monthlyRetainerCents ?? null;

  if (hourly !== null && (!Number.isInteger(hourly) || hourly < 0 || hourly > 100000000)) {
    return NextResponse.json({ error: "hourlyRateCents must be a non-negative integer." }, { status: 400 });
  }
  if (retainer !== null && (!Number.isInteger(retainer) || retainer < 0 || retainer > 1000000000)) {
    return NextResponse.json({ error: "monthlyRetainerCents must be a non-negative integer." }, { status: 400 });
  }

  const ws = await getActiveWorkspaceForUser(session.user.id);
  const pool = getPool();

  // Friendly check: client must exist in this workspace
  const clientCheck = await pool.query<{ id: string }>(
    `SELECT id FROM clients WHERE id = $1 AND workspace_id = $2`,
    [clientId, ws.id]
  );
  if (clientCheck.rowCount === 0) {
    return NextResponse.json({ error: "Client not found in your workspace." }, { status: 404 });
  }

  const res = await pool.query<ContractRow>(
    `INSERT INTO contracts (
        workspace_id, client_id, title, status, hourly_rate_cents, monthly_retainer_cents, currency
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [ws.id, clientId, title, status, hourly, retainer, currency]
  );

  return NextResponse.json({ contract: res.rows[0] }, { status: 201 });
}
